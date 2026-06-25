import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import type {
  Match,
  Team,
  Player,
  Innings,
  Delivery,
  BattingEvent,
  MatchPlayer,
} from "../types";

export type SB = SupabaseClient<Database>;

export interface MatchBundle {
  match: Match;
  teams: Team[];
  players: Player[];
  matchPlayers: MatchPlayer[];
  innings: Innings[];
  deliveries: Delivery[];
  events: BattingEvent[];
}

/** Fetch everything needed to render a match. Works with any Supabase client. */
export async function fetchMatchBundle(
  supabase: SB,
  matchId: string
): Promise<MatchBundle | null> {
  const { data: match } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return null;

  const teamIds = [match.team_a_id, match.team_b_id].filter(Boolean) as string[];
  const { data: teams } = await supabase.from("teams").select("*").in("id", teamIds);
  const { data: matchPlayers } = await supabase
    .from("match_players")
    .select("*")
    .eq("match_id", matchId);
  const playerIds = (matchPlayers ?? []).map((mp) => mp.player_id);
  const { data: players } = playerIds.length
    ? await supabase.from("players").select("*").in("id", playerIds)
    : { data: [] as Player[] };

  const { data: innings } = await supabase
    .from("innings")
    .select("*")
    .eq("match_id", matchId)
    .order("innings_number", { ascending: true });
  const innIds = (innings ?? []).map((i) => i.id);

  const { data: deliveries } = innIds.length
    ? await supabase.from("deliveries").select("*").in("innings_id", innIds).order("seq")
    : { data: [] as Delivery[] };
  const { data: events } = innIds.length
    ? await supabase.from("batting_events").select("*").in("innings_id", innIds).order("seq")
    : { data: [] as BattingEvent[] };

  return {
    match,
    teams: teams ?? [],
    players: players ?? [],
    matchPlayers: matchPlayers ?? [],
    innings: innings ?? [],
    deliveries: deliveries ?? [],
    events: events ?? [],
  };
}
