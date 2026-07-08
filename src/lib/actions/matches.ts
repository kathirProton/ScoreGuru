"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "../auth";
import { createServiceClient } from "../supabase/server";
import type { TossDecision } from "../types";

interface CreateMatchInput {
  name?: string | null;
  overs: number;
  venue?: string | null;
  team_a_id: string;
  team_b_id: string;
  lineup_a: string[];
  lineup_b: string[];
  free_hit_enabled: boolean;
  last_man_stands: boolean;
  block_consecutive_overs: boolean;
  super_over_overs: number;
}

export async function createMatch(input: CreateMatchInput) {
  await requireAdmin();
  if (!input.team_a_id || !input.team_b_id)
    return { error: "Both teams are required." };
  if (input.team_a_id === input.team_b_id)
    return { error: "Pick two different teams." };
  // Dedupe each lineup (guards a duplicate player within one team via API).
  const lineupA = [...new Set(input.lineup_a)];
  const lineupB = [...new Set(input.lineup_b)];
  if (lineupA.length === 0 || lineupB.length === 0)
    return { error: "Both teams need at least one player." };
  const overlap = lineupA.filter((p) => lineupB.includes(p));
  if (overlap.length > 0)
    return { error: "A player cannot be on both teams of the same match." };
  if (!Number.isInteger(input.overs) || input.overs < 1)
    return { error: "Overs must be a whole number of at least 1." };

  const supabase = createServiceClient();
  const { data: match, error } = await supabase
    .from("matches")
    .insert({
      name: input.name?.trim() || null,
      overs: input.overs,
      venue: input.venue?.trim() || null,
      team_a_id: input.team_a_id,
      team_b_id: input.team_b_id,
      free_hit_enabled: input.free_hit_enabled,
      last_man_stands: input.last_man_stands,
      block_consecutive_overs: input.block_consecutive_overs,
      super_over_overs: input.super_over_overs,
      status: "setup",
    })
    .select()
    .single();
  if (error || !match) return { error: error?.message ?? "Failed to create match." };

  const rows = [
    ...lineupA.map((player_id) => ({
      match_id: match.id,
      team_id: input.team_a_id,
      player_id,
    })),
    ...lineupB.map((player_id) => ({
      match_id: match.id,
      team_id: input.team_b_id,
      player_id,
    })),
  ];
  const { error: mpError } = await supabase.from("match_players").insert(rows);
  if (mpError) return { error: mpError.message };

  revalidatePath("/admin");
  return { ok: true, matchId: match.id };
}

/** Has this player already batted, bowled or fielded in this match? */
async function playerParticipated(
  supabase: ReturnType<typeof createServiceClient>,
  matchId: string,
  playerId: string
): Promise<boolean> {
  const { data: innings } = await supabase.from("innings").select("id").eq("match_id", matchId);
  const innIds = (innings ?? []).map((i) => i.id);
  if (innIds.length === 0) return false;
  const { count: dCount } = await supabase
    .from("deliveries")
    .select("*", { count: "exact", head: true })
    .in("innings_id", innIds)
    .or(
      `bowler_id.eq.${playerId},striker_id.eq.${playerId},non_striker_id.eq.${playerId},dismissed_player_id.eq.${playerId},fielder_id.eq.${playerId}`
    );
  if (dCount && dCount > 0) return true;
  const { count: eCount } = await supabase
    .from("batting_events")
    .select("*", { count: "exact", head: true })
    .in("innings_id", innIds)
    .eq("player_id", playerId);
  return !!(eCount && eCount > 0);
}

/** Add a player to a team's lineup (allowed any time, incl. mid-match). */
export async function addMatchPlayer(matchId: string, teamId: string, playerId: string) {
  await requireAdmin();
  const supabase = createServiceClient();
  const { data: match } = await supabase.from("matches").select("*").eq("id", matchId).single();
  if (!match) return { error: "Match not found." };
  if (teamId !== match.team_a_id && teamId !== match.team_b_id)
    return { error: "That team is not in this match." };
  const { data: existing } = await supabase
    .from("match_players")
    .select("team_id")
    .eq("match_id", matchId)
    .eq("player_id", playerId)
    .maybeSingle();
  if (existing) return { error: "Player is already in this match." };

  const { error } = await supabase
    .from("match_players")
    .insert({ match_id: matchId, team_id: teamId, player_id: playerId });
  if (error) return { error: error.message };
  revalidatePath(`/admin/matches/${matchId}/score`);
  revalidatePath(`/admin/matches/${matchId}/lineups`);
  revalidatePath(`/matches/${matchId}`);
  return { ok: true };
}

/** Remove a lineup player — only if they haven't batted / bowled / fielded. */
export async function removeMatchPlayer(matchId: string, playerId: string) {
  await requireAdmin();
  const supabase = createServiceClient();
  if (await playerParticipated(supabase, matchId, playerId))
    return { error: "Can't remove — this player has already batted, bowled or fielded." };
  const { error } = await supabase
    .from("match_players")
    .delete()
    .eq("match_id", matchId)
    .eq("player_id", playerId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/matches/${matchId}/score`);
  revalidatePath(`/admin/matches/${matchId}/lineups`);
  revalidatePath(`/matches/${matchId}`);
  return { ok: true };
}

/** Record toss and start the match: create innings 1, set status live. */
export async function setTossAndStart(
  matchId: string,
  tossWinnerTeamId: string,
  decision: TossDecision
) {
  await requireAdmin();
  const supabase = createServiceClient();
  const { data: match } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();
  if (!match) return { error: "Match not found." };
  if (!match.team_a_id || !match.team_b_id) return { error: "Teams not set." };

  const otherTeam =
    tossWinnerTeamId === match.team_a_id ? match.team_b_id : match.team_a_id;
  const battingFirst = decision === "bat" ? tossWinnerTeamId : otherTeam;
  const bowlingFirst = battingFirst === match.team_a_id ? match.team_b_id : match.team_a_id;

  const { error: upErr } = await supabase
    .from("matches")
    .update({
      toss_winner_team_id: tossWinnerTeamId,
      toss_decision: decision,
      status: "live",
      started_at: new Date().toISOString(),
    })
    .eq("id", matchId);
  if (upErr) return { error: upErr.message };

  // create innings 1 if not present
  const { data: existing } = await supabase
    .from("innings")
    .select("id")
    .eq("match_id", matchId)
    .eq("innings_number", 1)
    .maybeSingle();
  if (!existing) {
    const { error: innErr } = await supabase.from("innings").insert({
      match_id: matchId,
      innings_number: 1,
      batting_team_id: battingFirst,
      bowling_team_id: bowlingFirst,
    });
    if (innErr) return { error: innErr.message };
  }

  revalidatePath(`/admin/matches/${matchId}/score`);
  revalidatePath("/live");
  return { ok: true };
}

/** Edit non-score details after completion (name, venue, date). */
export async function updateMatchDetails(
  matchId: string,
  input: { name?: string | null; venue?: string | null; match_date?: string | null }
) {
  await requireAdmin();
  const supabase = createServiceClient();
  const patch: { name?: string | null; venue?: string | null; match_date?: string } = {};
  if (input.name !== undefined) patch.name = input.name?.trim() || null;
  if (input.venue !== undefined) patch.venue = input.venue?.trim() || null;
  if (input.match_date) patch.match_date = input.match_date;
  const { error } = await supabase.from("matches").update(patch).eq("id", matchId);
  if (error) return { error: error.message };
  revalidatePath(`/matches/${matchId}`);
  revalidatePath(`/admin/matches/${matchId}/edit`);
  return { ok: true };
}

/**
 * Restart a match: wipe all scoring (innings cascade-deletes deliveries &
 * batting_events) and reset to the toss screen. Lineups & teams are kept.
 */
export async function restartMatch(matchId: string) {
  await requireAdmin();
  const supabase = createServiceClient();
  await supabase.from("innings").delete().eq("match_id", matchId);
  const { error } = await supabase
    .from("matches")
    .update({
      status: "setup",
      toss_winner_team_id: null,
      toss_decision: null,
      result_text: null,
      winner_team_id: null,
      is_tie: false,
      potm_player_id: null,
      started_at: null,
      completed_at: null,
    })
    .eq("id", matchId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/matches/${matchId}/score`);
  revalidatePath("/live");
  revalidatePath(`/matches/${matchId}`);
  return { ok: true };
}

export async function deleteMatch(matchId: string) {
  await requireAdmin();
  const supabase = createServiceClient();
  // cascade removes innings, deliveries, batting_events, match_players
  const { error } = await supabase.from("matches").delete().eq("id", matchId);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidatePath("/matches");
  return { ok: true };
}

export async function abandonMatch(matchId: string, resultText?: string) {
  await requireAdmin();
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("matches")
    .update({
      status: "abandoned",
      result_text: resultText || "Match abandoned — no result.",
      completed_at: new Date().toISOString(),
    })
    .eq("id", matchId);
  if (error) return { error: error.message };
  revalidatePath("/live");
  revalidatePath(`/matches/${matchId}`);
  return { ok: true };
}
