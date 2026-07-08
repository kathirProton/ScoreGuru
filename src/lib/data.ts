import "server-only";
import { createReadClient } from "./supabase/server";
import { fetchMatchBundle } from "./cricket/load";
import { buildMatchView, MatchView } from "./cricket/matchview";
import type { Match, Player, MatchStatus, PlayerStatus, Team, TeamPlayer } from "./types";

const LIVE_STATUSES: MatchStatus[] = ["live", "innings_break", "super_over"];

export async function getLiveMatches(): Promise<Match[]> {
  const supabase = createReadClient();
  const { data } = await supabase
    .from("matches")
    .select("*")
    .in("status", LIVE_STATUSES)
    .order("started_at", { ascending: false });
  return data ?? [];
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
  const { data } = await supabase
    .from("matches")
    .select("*")
    .in("status", ["completed", "abandoned"])
    .order("match_date", { ascending: false });
  return data ?? [];
}

export async function getTeamsMap() {
  const supabase = createReadClient();
  const { data } = await supabase.from("teams").select("*");
  return new Map((data ?? []).map((t) => [t.id, t]));
}

export async function getTeams(includeHidden = false): Promise<Team[]> {
  const supabase = createReadClient();
  let q = supabase.from("teams").select("*").order("name");
  if (!includeHidden) q = q.eq("hidden", false);
  const { data } = await q;
  return data ?? [];
}

export async function getTeamPlayers(): Promise<TeamPlayer[]> {
  const supabase = createReadClient();
  const { data } = await supabase.from("team_players").select("*");
  return data ?? [];
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
  const { data } = await supabase
    .from("players")
    .select("*")
    .in("status", statuses)
    .order("name", { ascending: true });
  return data ?? [];
}

export async function getPlayer(id: string): Promise<Player | null> {
  const supabase = createReadClient();
  const { data } = await supabase.from("players").select("*").eq("id", id).maybeSingle();
  return data ?? null;
}

/** Everything needed to aggregate career stats across completed matches. */
export async function getStatsBundle() {
  const supabase = createReadClient();
  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "completed");
  const matchIds = (matches ?? []).map((m) => m.id);
  if (matchIds.length === 0) {
    return { matches: [], innings: [], deliveries: [], events: [], matchPlayers: [], players: [], droppedCatches: [] };
  }
  const { data: innings } = await supabase
    .from("innings")
    .select("*")
    .in("match_id", matchIds);
  const innIds = (innings ?? []).map((i) => i.id);
  const { data: deliveries } = innIds.length
    ? await supabase.from("deliveries").select("*").in("innings_id", innIds)
    : { data: [] };
  const { data: events } = innIds.length
    ? await supabase.from("batting_events").select("*").in("innings_id", innIds)
    : { data: [] };
  const { data: matchPlayers } = await supabase
    .from("match_players")
    .select("*")
    .in("match_id", matchIds);
  const { data: players } = await supabase.from("players").select("*");
  const { data: droppedCatches } = await supabase
    .from("dropped_catches")
    .select("*")
    .in("match_id", matchIds);
  return {
    matches: matches ?? [],
    innings: innings ?? [],
    deliveries: deliveries ?? [],
    events: events ?? [],
    matchPlayers: matchPlayers ?? [],
    players: players ?? [],
    droppedCatches: droppedCatches ?? [],
  };
}
