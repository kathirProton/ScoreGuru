import "server-only";
import { createReadClient } from "./supabase/server";
import { fetchAll, fetchAllIn } from "./supabase/paginate";
import { fetchMatchBundle } from "./cricket/load";
import { buildMatchView, MatchView } from "./cricket/matchview";
import type { Match, Player, MatchStatus, PlayerStatus, Team, TeamPlayer } from "./types";

const LIVE_STATUSES: MatchStatus[] = ["live", "innings_break", "super_over"];

export async function getLiveMatches(): Promise<Match[]> {
  const supabase = createReadClient();
  return fetchAll(() =>
    supabase
      .from("matches")
      .select("*", { count: "exact" })
      .in("status", LIVE_STATUSES)
      .order("started_at", { ascending: false })
      .order("id") // unique tiebreak — started_at can be null or shared
  );
}

export async function getMatchView(matchId: string): Promise<MatchView | null> {
  const supabase = createReadClient();
  const bundle = await fetchMatchBundle(supabase, matchId);
  return bundle ? buildMatchView(bundle) : null;
}

/** Raw, serializable bundle (for passing to client realtime components). */
export async function getMatchBundle(matchId: string) {
  const supabase = createReadClient();
  return fetchMatchBundle(supabase, matchId);
}

/**
 * Config of a prior match, shaped to pre-fill the New Match form. Pass a match
 * id, or "last" (default) for the most recently created match. Returns null if
 * there's no match to copy. Lets the admin tweak (e.g. overs) before creating.
 */
export async function getMatchConfig(sourceId: string = "last") {
  const supabase = createReadClient();
  let match: Match | null;
  if (sourceId && sourceId !== "last") {
    const { data } = await supabase.from("matches").select("*").eq("id", sourceId).maybeSingle();
    match = data;
  } else {
    const { data } = await supabase
      .from("matches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    match = data;
  }
  if (!match) return null;

  const { data: mp } = await supabase
    .from("match_players")
    .select("team_id,player_id,batting_order")
    .eq("match_id", match.id)
    .order("batting_order", { ascending: true });
  const rows = mp ?? [];
  return {
    name: match.name ?? "",
    overs: String(match.overs ?? 6),
    venue: match.venue ?? "",
    freeHit: match.free_hit_enabled ?? true,
    lastMan: match.last_man_stands ?? true,
    superOvers: String(match.super_over_overs ?? 1),
    teamA: match.team_a_id ?? "",
    teamB: match.team_b_id ?? "",
    lineupA: rows.filter((r) => r.team_id === match!.team_a_id).map((r) => r.player_id),
    lineupB: rows.filter((r) => r.team_id === match!.team_b_id).map((r) => r.player_id),
  };
}

export async function getCompletedMatches(): Promise<Match[]> {
  const supabase = createReadClient();
  return fetchAll(() =>
    supabase
      .from("matches")
      .select("*", { count: "exact" })
      .in("status", ["completed", "abandoned"])
      .order("match_date", { ascending: false })
      .order("id") // unique tiebreak — same-date matches must page deterministically
  );
}

export async function getTeamsMap() {
  const supabase = createReadClient();
  const teams = await fetchAll(() =>
    supabase.from("teams").select("*", { count: "exact" }).order("id")
  );
  return new Map(teams.map((t) => [t.id, t]));
}

export async function getTeams(includeHidden = false): Promise<Team[]> {
  const supabase = createReadClient();
  return fetchAll(() => {
    const q = supabase.from("teams").select("*", { count: "exact" });
    return (includeHidden ? q : q.eq("hidden", false)).order("name").order("id");
  });
}

export async function getTeamPlayers(): Promise<TeamPlayer[]> {
  const supabase = createReadClient();
  return fetchAll(() =>
    supabase
      .from("team_players")
      .select("*", { count: "exact" })
      // No single-column key — order by the composite PK.
      .order("team_id")
      .order("player_id")
  );
}

/** Map of teamId → ordered player ids on that team's roster. */
export async function getRosterMap(): Promise<Record<string, string[]>> {
  const rows = await getTeamPlayers();
  const map: Record<string, string[]> = {};
  for (const r of rows) (map[r.team_id] ??= []).push(r.player_id);
  return map;
}

export async function getPlayers(statuses: PlayerStatus[] = ["approved"]): Promise<Player[]> {
  const supabase = createReadClient();
  return fetchAll(() =>
    supabase
      .from("players")
      .select("*", { count: "exact" })
      .in("status", statuses)
      .order("name", { ascending: true })
      .order("id") // unique tiebreak — duplicate names must page deterministically
  );
}

export async function getPlayer(id: string): Promise<Player | null> {
  const supabase = createReadClient();
  const { data } = await supabase.from("players").select("*").eq("id", id).maybeSingle();
  return data ?? null;
}

/**
 * Everything needed to aggregate career stats across completed matches.
 *
 * Every read here is paged: `deliveries` alone passes PostgREST's 1000-row cap
 * after ~10 matches, and a truncated bundle silently drops whole matches out of
 * the leaderboards. See `lib/supabase/paginate`.
 */
export async function getStatsBundle() {
  const supabase = createReadClient();
  const matches = await fetchAll(() =>
    supabase.from("matches").select("*", { count: "exact" }).eq("status", "completed").order("id")
  );
  const matchIds = matches.map((m) => m.id);
  if (matchIds.length === 0) {
    return { matches: [], innings: [], deliveries: [], events: [], matchPlayers: [], players: [], droppedCatches: [] };
  }
  const innings = await fetchAllIn(
    (ids) => supabase.from("innings").select("*", { count: "exact" }).in("match_id", ids).order("id"),
    matchIds
  );
  const innIds = innings.map((i) => i.id);
  const [deliveries, events, matchPlayers, players, droppedCatches] = await Promise.all([
    fetchAllIn(
      (ids) => supabase.from("deliveries").select("*", { count: "exact" }).in("innings_id", ids).order("id"),
      innIds
    ),
    fetchAllIn(
      (ids) => supabase.from("batting_events").select("*", { count: "exact" }).in("innings_id", ids).order("id"),
      innIds
    ),
    fetchAllIn(
      (ids) =>
        supabase
          .from("match_players")
          .select("*", { count: "exact" })
          // match_players has no single-column key — order by the composite PK.
          .in("match_id", ids)
          .order("match_id")
          .order("player_id"),
      matchIds
    ),
    fetchAll(() => supabase.from("players").select("*", { count: "exact" }).order("id")),
    fetchAllIn(
      (ids) => supabase.from("dropped_catches").select("*", { count: "exact" }).in("match_id", ids).order("id"),
      matchIds
    ),
  ]);
  return { matches, innings, deliveries, events, matchPlayers, players, droppedCatches };
}
