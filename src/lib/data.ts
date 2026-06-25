import "server-only";
import { createReadClient } from "./supabase/server";
import { fetchMatchBundle } from "./cricket/load";
import { buildMatchView, MatchView } from "./cricket/matchview";
import type { Match, Player, MatchStatus, PlayerStatus } from "./types";

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
    return { matches: [], innings: [], deliveries: [], events: [], matchPlayers: [], players: [] };
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
  return {
    matches: matches ?? [],
    innings: innings ?? [],
    deliveries: deliveries ?? [],
    events: events ?? [],
    matchPlayers: matchPlayers ?? [],
    players: players ?? [],
  };
}
