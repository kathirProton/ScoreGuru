"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "../auth";
import { createServiceClient } from "../supabase/server";
import { deriveInnings, InningsState } from "../cricket/engine";
import { computePOTM } from "../cricket/stats";
import {
  ExtraType,
  WicketType,
  Match,
  Innings,
  Delivery,
  BattingEvent,
} from "../types";
import { FREE_HIT_ALLOWED } from "../types";

type SB = ReturnType<typeof createServiceClient>;

// ── loaders ──────────────────────────────────────────────────────
async function loadInningsCtx(supabase: SB, inningsId: string) {
  const { data: innings } = await supabase
    .from("innings")
    .select("*")
    .eq("id", inningsId)
    .single();
  if (!innings) throw new Error("Innings not found.");
  const { data: match } = await supabase
    .from("matches")
    .select("*")
    .eq("id", innings.match_id)
    .single();
  if (!match) throw new Error("Match not found.");
  const { data: deliveries } = await supabase
    .from("deliveries")
    .select("*")
    .eq("innings_id", inningsId)
    .order("seq", { ascending: true });
  const { data: events } = await supabase
    .from("batting_events")
    .select("*")
    .eq("innings_id", inningsId)
    .order("seq", { ascending: true });
  const { count: sizeCount } = await supabase
    .from("match_players")
    .select("*", { count: "exact", head: true })
    .eq("match_id", match.id)
    .eq("team_id", innings.batting_team_id);
  const battingTeamSize = sizeCount ?? 11;
  return { innings, match, deliveries: deliveries ?? [], events: events ?? [], battingTeamSize };
}

function stateOf(
  match: Match,
  innings: Innings,
  deliveries: Delivery[],
  events: BattingEvent[],
  battingTeamSize: number
): InningsState {
  const maxOvers = innings.is_super_over ? match.super_over_overs : match.overs;
  return deriveInnings({
    deliveries,
    events,
    maxOvers,
    target: innings.target,
    battingTeamSize,
    lastManStands: match.last_man_stands,
    freeHitEnabled: match.free_hit_enabled,
  });
}

function revalidateScoring(matchId: string) {
  revalidatePath(`/admin/matches/${matchId}/score`);
  revalidatePath("/live");
  revalidatePath(`/matches/${matchId}`);
}

// ── batsman selection ────────────────────────────────────────────
export async function selectOpeningBatsmen(
  inningsId: string,
  strikerId: string,
  nonStrikerId: string
) {
  await requireAdmin();
  if (strikerId === nonStrikerId)
    return { error: "Striker and non-striker must differ." };
  const supabase = createServiceClient();
  const { match } = await loadInningsCtx(supabase, inningsId);
  await supabase.from("batting_events").insert([
    { innings_id: inningsId, player_id: strikerId, event_type: "in", at_end: "striker" },
  ]);
  await supabase.from("batting_events").insert([
    {
      innings_id: inningsId,
      player_id: nonStrikerId,
      event_type: "in",
      at_end: "non_striker",
    },
  ]);
  revalidateScoring(match.id);
  return { ok: true };
}

export async function selectNextBatsman(inningsId: string, playerId: string) {
  await requireAdmin();
  const supabase = createServiceClient();
  const ctx = await loadInningsCtx(supabase, inningsId);
  const state = stateOf(ctx.match, ctx.innings, ctx.deliveries, ctx.events, ctx.battingTeamSize);
  const end =
    state.strikerId === null ? "striker" : state.nonStrikerId === null ? "non_striker" : "striker";
  await supabase.from("batting_events").insert({
    innings_id: inningsId,
    player_id: playerId,
    event_type: "in",
    at_end: end,
  });
  revalidateScoring(ctx.match.id);
  return { ok: true };
}

export async function retireBatsman(
  inningsId: string,
  playerId: string,
  out: boolean
) {
  await requireAdmin();
  const supabase = createServiceClient();
  const ctx = await loadInningsCtx(supabase, inningsId);
  await supabase.from("batting_events").insert({
    innings_id: inningsId,
    player_id: playerId,
    event_type: out ? "retired_out" : "retired_not_out",
  });
  await evaluateAndTransition(supabase, ctx.match.id);
  revalidateScoring(ctx.match.id);
  return { ok: true };
}

// ── delivery ─────────────────────────────────────────────────────
export interface DeliveryInput {
  runs_off_bat: number;
  extra_type: ExtraType;
  extra_runs: number;
  is_wicket: boolean;
  wicket_type?: WicketType | null;
  dismissed_player_id?: string | null;
  fielder_id?: string | null;
}

export async function recordDelivery(
  inningsId: string,
  bowlerId: string,
  input: DeliveryInput
) {
  await requireAdmin();
  const supabase = createServiceClient();
  const ctx = await loadInningsCtx(supabase, inningsId);
  const state = stateOf(ctx.match, ctx.innings, ctx.deliveries, ctx.events, ctx.battingTeamSize);

  if (state.isInningsOver) return { error: "Innings is already over." };
  if (state.strikerId === null || state.nonStrikerId === null) {
    if (!(state.loneBatsman && state.strikerId !== null))
      return { error: "Select the batsman(en) at the crease first." };
  }

  // bowler: first ball of an over takes the selected bowler; otherwise reuse.
  const overInProgress = state.thisOver.length > 0;
  let resolvedBowler = bowlerId;
  if (overInProgress) {
    resolvedBowler = state.currentBowlerId ?? bowlerId;
  } else {
    // start of over — enforce consecutive-over rule unless disabled
    if (
      ctx.match.block_consecutive_overs &&
      state.lastBowlerId &&
      state.lastBowlerId === bowlerId
    ) {
      return { error: "Same bowler cannot bowl consecutive overs (toggle off to override)." };
    }
  }
  if (!resolvedBowler) return { error: "Select a bowler." };

  // free hit
  const isFreeHit = state.nextIsFreeHit;

  // dismissal validation
  if (input.is_wicket) {
    if (!input.wicket_type) return { error: "Pick a dismissal type." };
    if (input.wicket_type === "retired_out")
      return { error: "Use the Retire control for retirements." };
    if (isFreeHit && !FREE_HIT_ALLOWED.includes(input.wicket_type))
      return { error: "On a free hit only run-out / obstruction is allowed." };
    if (input.extra_type === "wide" && !["run_out", "stumped", "obstructing"].includes(input.wicket_type))
      return { error: "On a wide only run-out, stumped or obstruction is allowed." };
    if (input.extra_type === "no_ball" && !["run_out", "obstructing"].includes(input.wicket_type))
      return { error: "On a no-ball only run-out / obstruction is allowed." };
    if (
      ["bowled", "lbw", "stumped", "hit_wicket"].includes(input.wicket_type) &&
      input.extra_type !== "none"
    )
      return { error: "Invalid dismissal for this delivery." };
  }

  const legal = input.extra_type === "none" || input.extra_type === "bye" || input.extra_type === "leg_bye";
  const overNumber = state.currentOverNumber;
  const ballInOver = state.ballsThisOver + 1;
  const legalBallNumber = state.legalBalls + (legal ? 1 : 0);

  const dismissed =
    input.is_wicket
      ? input.dismissed_player_id ?? state.strikerId
      : null;

  const { error } = await supabase.from("deliveries").insert({
    innings_id: inningsId,
    over_number: overNumber,
    ball_in_over: ballInOver,
    legal_ball_number: legalBallNumber,
    bowler_id: resolvedBowler,
    striker_id: state.strikerId!,
    non_striker_id: state.nonStrikerId ?? state.strikerId!,
    runs_off_bat: input.runs_off_bat,
    extra_type: input.extra_type,
    extra_runs: input.extra_runs,
    is_wicket: input.is_wicket,
    wicket_type: input.is_wicket ? input.wicket_type ?? null : null,
    dismissed_player_id: dismissed,
    fielder_id: input.fielder_id ?? null,
    is_free_hit: isFreeHit,
  });
  if (error) return { error: error.message };

  await evaluateAndTransition(supabase, ctx.match.id);
  revalidateScoring(ctx.match.id);
  return { ok: true };
}

// ── undo ─────────────────────────────────────────────────────────
export async function undoLast(inningsId: string) {
  await requireAdmin();
  const supabase = createServiceClient();
  const ctx = await loadInningsCtx(supabase, inningsId);

  const lastDelivery = ctx.deliveries[ctx.deliveries.length - 1];
  const lastEvent = ctx.events[ctx.events.length - 1];
  const dSeq = lastDelivery?.seq ?? -1;
  const eSeq = lastEvent?.seq ?? -1;
  if (dSeq < 0 && eSeq < 0) return { error: "Nothing to undo." };

  if (dSeq >= eSeq) {
    await supabase.from("deliveries").delete().eq("id", lastDelivery.id);
  } else {
    await supabase.from("batting_events").delete().eq("id", lastEvent.id);
  }

  // undo may revert a completed/innings-break state back to live
  const { data: match } = await supabase.from("matches").select("*").eq("id", ctx.match.id).single();
  if (match && (match.status === "completed" || match.status === "innings_break" || match.status === "abandoned")) {
    await supabase
      .from("matches")
      .update({ status: "live", result_text: null, winner_team_id: null, is_tie: false, potm_player_id: null, completed_at: null })
      .eq("id", ctx.match.id);
    // reopen current innings
    await supabase.from("innings").update({ is_closed: false }).eq("id", inningsId);
  }
  await evaluateAndTransition(supabase, ctx.match.id);
  revalidateScoring(ctx.match.id);
  return { ok: true };
}

// ── transitions ──────────────────────────────────────────────────
async function evaluateAndTransition(supabase: SB, matchId: string) {
  const { data: match } = await supabase.from("matches").select("*").eq("id", matchId).single();
  if (!match) return;
  const { data: inningsRows } = await supabase
    .from("innings")
    .select("*")
    .eq("match_id", matchId)
    .order("innings_number", { ascending: true });
  if (!inningsRows || inningsRows.length === 0) return;

  const current = inningsRows[inningsRows.length - 1];
  const ctx = await loadInningsCtx(supabase, current.id);
  const state = stateOf(match, current, ctx.deliveries, ctx.events, ctx.battingTeamSize);

  if (!state.isInningsOver) {
    // still going — ensure status live/super_over
    if (match.status === "setup") {
      await supabase.from("matches").update({ status: "live" }).eq("id", matchId);
    }
    return;
  }

  // innings is over → close it
  await supabase.from("innings").update({ is_closed: true }).eq("id", current.id);

  const mainInnings = inningsRows.filter((i) => !i.is_super_over);
  const superInnings = inningsRows.filter((i) => i.is_super_over);

  // First main innings finished → innings break (create innings 2 with target)
  if (!current.is_super_over && current.innings_number === 1) {
    const existing2 = inningsRows.find((i) => i.innings_number === 2);
    if (!existing2) {
      await supabase.from("innings").insert({
        match_id: matchId,
        innings_number: 2,
        batting_team_id: current.bowling_team_id,
        bowling_team_id: current.batting_team_id,
        target: state.totalRuns + 1,
      });
    }
    await supabase.from("matches").update({ status: "innings_break" }).eq("id", matchId);
    return;
  }

  // Second main innings finished → result or super over
  if (!current.is_super_over && current.innings_number === 2) {
    const inn1 = mainInnings.find((i) => i.innings_number === 1)!;
    const inn1Ctx = await loadInningsCtx(supabase, inn1.id);
    const inn1State = stateOf(match, inn1, inn1Ctx.deliveries, inn1Ctx.events, inn1Ctx.battingTeamSize);
    await finalizeOrSuperOver(supabase, match, inn1State, state, current);
    return;
  }

  // Super over innings finished
  if (current.is_super_over) {
    // pair them: each pair is (first SO, second SO)
    const idx = superInnings.findIndex((i) => i.id === current.id);
    if (idx % 2 === 0) {
      // first innings of a super-over pair done → start the chase
      await supabase.from("matches").update({ status: "super_over" }).eq("id", matchId);
      const nextNumber = current.innings_number + 1;
      const exists = inningsRows.find((i) => i.innings_number === nextNumber);
      if (!exists) {
        await supabase.from("innings").insert({
          match_id: matchId,
          innings_number: nextNumber,
          batting_team_id: current.bowling_team_id,
          bowling_team_id: current.batting_team_id,
          target: state.totalRuns + 1,
          is_super_over: true,
        });
      }
      return;
    } else {
      // second innings of pair done → compare
      const first = superInnings[idx - 1];
      const firstCtx = await loadInningsCtx(supabase, first.id);
      const firstState = stateOf(match, first, firstCtx.deliveries, firstCtx.events, firstCtx.battingTeamSize);
      if (state.totalRuns === firstState.totalRuns) {
        // tie again → another super over pair
        await supabase.from("matches").update({ status: "super_over" }).eq("id", matchId);
        const nextNumber = current.innings_number + 1;
        await supabase.from("innings").insert({
          match_id: matchId,
          innings_number: nextNumber,
          batting_team_id: current.bowling_team_id,
          bowling_team_id: current.batting_team_id,
          is_super_over: true,
        });
        return;
      }
      // decide winner of super over
      const winnerTeam =
        state.totalRuns > firstState.totalRuns ? current.batting_team_id : first.batting_team_id;
      await completeMatchInternal(supabase, match, winnerTeam, false, "(Super Over)");
      return;
    }
  }
}

async function finalizeOrSuperOver(
  supabase: SB,
  match: Match,
  inn1State: InningsState,
  inn2State: InningsState,
  inn2: Innings
) {
  if (inn2State.totalRuns === inn1State.totalRuns && !inn2State.targetReached) {
    // tie → super over
    await supabase.from("matches").update({ status: "super_over" }).eq("id", match.id).select();
    // create first super-over innings: team that batted 2nd bats first
    const { data: nextRows } = await supabase
      .from("innings")
      .select("innings_number")
      .eq("match_id", match.id)
      .order("innings_number", { ascending: false })
      .limit(1);
    const nextNumber = (nextRows?.[0]?.innings_number ?? 2) + 1;
    await supabase.from("innings").insert({
      match_id: match.id,
      innings_number: nextNumber,
      batting_team_id: inn2.batting_team_id,
      bowling_team_id: inn2.bowling_team_id,
      is_super_over: true,
    });
    return;
  }

  let winnerTeam: string;
  let resultText: string;
  if (inn2State.targetReached) {
    const wicketsInHand =
      (match.last_man_stands ? inn2State.batsmen.length : 0) || 0;
    const lost = inn2State.wickets;
    const inHand = Math.max(0, (await teamSize(supabase, match.id, inn2.batting_team_id)) - lost - (match.last_man_stands ? 0 : 1));
    winnerTeam = inn2.batting_team_id;
    resultText = `won by ${inHand} wicket${inHand === 1 ? "" : "s"}`;
  } else {
    const margin = inn1State.totalRuns - inn2State.totalRuns;
    winnerTeam = inn2.bowling_team_id; // team that batted first
    resultText = `won by ${margin} run${margin === 1 ? "" : "s"}`;
  }
  await completeMatchInternal(supabase, match, winnerTeam, false, resultText);
}

async function teamSize(supabase: SB, matchId: string, teamId: string): Promise<number> {
  const { count } = await supabase
    .from("match_players")
    .select("*", { count: "exact", head: true })
    .eq("match_id", matchId)
    .eq("team_id", teamId);
  return count ?? 11;
}

async function completeMatchInternal(
  supabase: SB,
  match: Match,
  winnerTeamId: string | null,
  isTie: boolean,
  resultDetail: string
) {
  // team names
  const { data: teams } = await supabase
    .from("teams")
    .select("id,name")
    .in("id", [match.team_a_id!, match.team_b_id!]);
  const nameOf = (id: string | null) => teams?.find((t) => t.id === id)?.name ?? "Team";

  let resultText: string;
  if (isTie) resultText = "Match tied";
  else resultText = `${nameOf(winnerTeamId)} ${resultDetail}`;

  // POTM
  const potm = await computeMatchPOTM(supabase, match.id);

  await supabase
    .from("matches")
    .update({
      status: "completed",
      winner_team_id: winnerTeamId,
      is_tie: isTie,
      result_text: resultText,
      potm_player_id: potm,
      completed_at: new Date().toISOString(),
    })
    .eq("id", match.id);
}

async function computeMatchPOTM(supabase: SB, matchId: string): Promise<string | null> {
  const { data: match } = await supabase.from("matches").select("*").eq("id", matchId).single();
  const { data: innings } = await supabase.from("innings").select("*").eq("match_id", matchId);
  const innIds = (innings ?? []).map((i) => i.id);
  if (innIds.length === 0 || !match) return null;
  const { data: deliveries } = await supabase
    .from("deliveries")
    .select("*")
    .in("innings_id", innIds);
  const { data: events } = await supabase.from("batting_events").select("*").in("innings_id", innIds);
  const { data: matchPlayers } = await supabase
    .from("match_players")
    .select("match_id,team_id,player_id")
    .eq("match_id", matchId);
  // compute as if completed
  return computePOTM(
    {
      matches: [{ ...match, status: "completed" }],
      innings: innings ?? [],
      deliveries: deliveries ?? [],
      events: events ?? [],
      matchPlayers: matchPlayers ?? [],
    },
    matchId
  );
}

/** Admin proceeds from innings break → select openers happens on score page. */
export async function startSecondInnings(matchId: string) {
  await requireAdmin();
  const supabase = createServiceClient();
  await supabase.from("matches").update({ status: "live" }).eq("id", matchId);
  revalidateScoring(matchId);
  return { ok: true };
}

export async function startSuperOver(matchId: string) {
  await requireAdmin();
  const supabase = createServiceClient();
  await supabase.from("matches").update({ status: "super_over" }).eq("id", matchId);
  revalidateScoring(matchId);
  return { ok: true };
}
