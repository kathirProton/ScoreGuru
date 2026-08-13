import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { fetchAllIn } from "../supabase/paginate";
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

  // Paged: `seq` is per-innings, so a match's log spans several innings and a
  // long match plus super overs can cross PostgREST's 1000-row cap. A truncated
  // log would silently rewind the live score.
  const deliveries = await fetchAllIn<Delivery>(
    (ids) =>
      supabase
        .from("deliveries")
        .select("*", { count: "exact" })
        .in("innings_id", ids)
        .order("innings_id")
        .order("seq"),
    innIds
  );
  const events = await fetchAllIn<BattingEvent>(
    (ids) =>
      supabase
        .from("batting_events")
        .select("*", { count: "exact" })
        .in("innings_id", ids)
        .order("innings_id")
        .order("seq"),
    innIds
  );

  return {
    match,
    teams: teams ?? [],
    // Never ship players' self-edit passwords to the browser (this bundle is
    // fetched with the anon key and passed into client components).
    players: (players ?? []).map((p) => ({ ...p, edit_password: "" })),
    matchPlayers: matchPlayers ?? [],
    innings: innings ?? [],
    deliveries,
    events,
  };
}
