/**
 * Score Guru cricket engine.
 *
 * Single source of truth: the immutable delivery log + batting events.
 * Everything (live score, strike, over progress, scorecards, partnerships,
 * fall of wickets, result) is DERIVED here by replaying events in seq order.
 * Pure & isomorphic — runs identically on server and client (optimistic UI).
 */
import type { Delivery, BattingEvent, WicketType, ExtraType } from "../types";
import { BOWLER_WICKETS } from "../types";

export interface DeriveInput {
  deliveries: Delivery[];
  events: BattingEvent[];
  maxOvers: number;
  target: number | null;
  battingTeamSize: number;
  lastManStands: boolean;
  freeHitEnabled: boolean;
}

export type BatStatus =
  | "yet_to_bat"
  | "batting"
  | "out"
  | "not_out"
  | "retired_not_out"
  | "retired_out";

export interface BatsmanStat {
  playerId: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  status: BatStatus;
  /** e.g. "b Smith", "c Jones b Smith", "run out (Jones)", "not out" */
  howOut: string | null;
  bowlerId: string | null;
  fielderId: string | null;
  wicketType: WicketType | null;
  onStrike: boolean;
  atCrease: boolean;
  battingPosition: number; // order they first came to the crease (1-based)
}

export interface BowlerStat {
  playerId: string;
  legalBalls: number;
  runsConceded: number;
  wickets: number;
  maidens: number;
  wides: number;
  noBalls: number;
  dots: number;
}

export interface FallOfWicket {
  wicketNumber: number;
  score: number;
  overDisplay: string;
  playerId: string; // who got out
}

export interface Partnership {
  batsmen: [string | null, string | null];
  runs: number;
  balls: number;
  out: boolean;
}

export interface OverDelivery {
  id: string;
  chip: string; // "1", ".", "4", "6", "W", "1wd", "nb", "2lb" ...
  isWicket: boolean;
  isBoundary4: boolean;
  isBoundary6: boolean;
  isExtra: boolean;
  runs: number; // total runs from this delivery
}

export interface OverSummary {
  overNumber: number;
  bowlerId: string;
  deliveries: OverDelivery[];
  runs: number;
  wickets: number;
  isMaiden: boolean;
  legalBalls: number;
}

export interface InningsState {
  totalRuns: number;
  wickets: number;
  legalBalls: number;
  oversDisplay: string; // "4.3"
  oversFloat: number;
  currentOverNumber: number;
  ballsThisOver: number; // legal balls bowled in current over (0-5 → 6 closes it)
  strikerId: string | null;
  nonStrikerId: string | null;
  currentBowlerId: string | null;
  lastBowlerId: string | null; // for consecutive-over rule
  nextIsFreeHit: boolean;
  batsmen: BatsmanStat[];
  bowlers: BowlerStat[];
  overs: OverSummary[];
  thisOver: OverDelivery[];
  fallOfWickets: FallOfWicket[];
  partnerships: Partnership[];
  currentPartnership: Partnership | null;
  extras: {
    byes: number;
    legByes: number;
    wides: number;
    noBalls: number;
    total: number;
  };
  runRate: number;
  // chase context (innings 2+)
  target: number | null;
  runsNeeded: number | null;
  ballsRemaining: number | null;
  requiredRunRate: number | null;
  // termination
  isAllOut: boolean;
  oversComplete: boolean;
  targetReached: boolean;
  isInningsOver: boolean;
  /** true when only one batsman remains and last_man_stands is active */
  loneBatsman: boolean;
}

// ── helpers ──────────────────────────────────────────────────────
function isLegal(extra: ExtraType): boolean {
  return extra === "none" || extra === "bye" || extra === "leg_bye";
}

/** Runs the batsmen physically ran (determines strike rotation). */
function runsRun(d: Delivery): number {
  switch (d.extra_type) {
    case "none":
      return d.runs_off_bat;
    case "bye":
    case "leg_bye":
      return d.extra_runs;
    case "wide":
      return Math.max(0, d.extra_runs - 1); // minus the 1-run penalty
    case "no_ball":
      return d.runs_off_bat + Math.max(0, d.extra_runs - 1);
    default:
      return 0;
  }
}

/** Runs charged to the bowler's analysis on this delivery. */
function bowlerRuns(d: Delivery): number {
  switch (d.extra_type) {
    case "none":
      return d.runs_off_bat;
    case "wide":
      return d.extra_runs; // whole wide (penalty + any runs) charged to bowler
    case "no_ball":
      return d.runs_off_bat + 1; // bat runs + no-ball penalty; byes NOT charged
    case "bye":
    case "leg_bye":
      return 0;
    default:
      return 0;
  }
}

function deliveryTotal(d: Delivery): number {
  return d.runs_off_bat + d.extra_runs;
}

function overDisplay(legalBalls: number): string {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}

function chipFor(d: Delivery): string {
  const bat = d.runs_off_bat;
  switch (d.extra_type) {
    case "none": {
      if (d.is_wicket) return bat > 0 ? `${bat}W` : "W";
      return String(bat);
    }
    case "wide": {
      const ran = Math.max(0, d.extra_runs - 1);
      return ran > 0 ? `${d.extra_runs}wd` : "wd";
    }
    case "no_ball": {
      const extra = d.runs_off_bat > 0 ? `${d.runs_off_bat}` : "";
      return d.is_wicket ? `nbW` : `${extra}nb`;
    }
    case "bye":
      return `${d.extra_runs}b`;
    case "leg_bye":
      return `${d.extra_runs}lb`;
    default:
      return ".";
  }
}

interface BatInternal extends BatsmanStat {}

function blankBat(playerId: string, position: number): BatInternal {
  return {
    playerId,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    isOut: false,
    status: "yet_to_bat",
    howOut: null,
    bowlerId: null,
    fielderId: null,
    wicketType: null,
    onStrike: false,
    atCrease: false,
    battingPosition: position,
  };
}

function blankBowler(playerId: string): BowlerStat {
  return {
    playerId,
    legalBalls: 0,
    runsConceded: 0,
    wickets: 0,
    maidens: 0,
    wides: 0,
    noBalls: 0,
    dots: 0,
  };
}

type MergedEvent =
  | { kind: "delivery"; seq: number; d: Delivery }
  | { kind: "batting"; seq: number; e: BattingEvent };

export function deriveInnings(input: DeriveInput): InningsState {
  const {
    deliveries,
    events,
    maxOvers,
    target,
    battingTeamSize,
    lastManStands,
    freeHitEnabled,
  } = input;

  const merged: MergedEvent[] = [
    ...deliveries.map((d) => ({ kind: "delivery" as const, seq: d.seq, d })),
    ...events.map((e) => ({ kind: "batting" as const, seq: e.seq, e })),
  ].sort((a, b) => a.seq - b.seq);

  const bats = new Map<string, BatInternal>();
  const bowlers = new Map<string, BowlerStat>();
  let positionCounter = 0;
  const getBat = (id: string): BatInternal => {
    let b = bats.get(id);
    if (!b) {
      positionCounter += 1;
      b = blankBat(id, positionCounter);
      bats.set(id, b);
    }
    return b;
  };
  const getBowler = (id: string): BowlerStat => {
    let b = bowlers.get(id);
    if (!b) {
      b = blankBowler(id);
      bowlers.set(id, b);
    }
    return b;
  };

  let striker: string | null = null;
  let nonStriker: string | null = null;
  let totalRuns = 0;
  let wickets = 0;
  let legalBalls = 0;
  let freeHitArmed = false;
  let lastBowlerId: string | null = null;
  let currentBowlerId: string | null = null;

  const byes = { byes: 0, legByes: 0, wides: 0, noBalls: 0 };
  const fallOfWickets: FallOfWicket[] = [];
  const partnerships: Partnership[] = [];
  const overs: OverSummary[] = [];

  const pship: { current: Partnership | null } = { current: null };
  const ensurePartnership = () => {
    if (!pship.current) {
      pship.current = { batsmen: [striker, nonStriker], runs: 0, balls: 0, out: false };
    } else {
      pship.current.batsmen = [striker, nonStriker];
    }
  };

  // per-over accumulation
  let overMap = new Map<number, OverSummary>();
  const getOver = (overNumber: number, bowlerId: string): OverSummary => {
    let o = overMap.get(overNumber);
    if (!o) {
      o = {
        overNumber,
        bowlerId,
        deliveries: [],
        runs: 0,
        wickets: 0,
        isMaiden: false,
        legalBalls: 0,
      };
      overMap.set(overNumber, o);
      overs.push(o);
    }
    return o;
  };

  for (const item of merged) {
    if (item.kind === "batting") {
      const e = item.e;
      const bat = getBat(e.player_id);
      if (e.event_type === "in") {
        // place into the empty slot; both empty at start → use at_end hint.
        if (striker === null && nonStriker === null) {
          if (e.at_end === "non_striker") nonStriker = e.player_id;
          else striker = e.player_id;
        } else if (striker === null) {
          striker = e.player_id;
        } else if (nonStriker === null) {
          nonStriker = e.player_id;
        }
        bat.status = "batting";
        bat.atCrease = true;
        ensurePartnership();
      } else if (e.event_type === "retired_not_out" || e.event_type === "retired_out") {
        // remove from crease
        if (striker === e.player_id) striker = null;
        else if (nonStriker === e.player_id) nonStriker = null;
        bat.atCrease = false;
        if (e.event_type === "retired_out") {
          bat.isOut = true;
          bat.status = "retired_out";
          bat.howOut = "retired out";
          wickets += 1;
          fallOfWickets.push({
            wicketNumber: wickets,
            score: totalRuns,
            overDisplay: overDisplay(legalBalls),
            playerId: e.player_id,
          });
          if (pship.current) {
            pship.current.out = true;
            partnerships.push(pship.current);
            pship.current = null;
          }
          if (lastManStands && wickets === battingTeamSize - 1) {
            striker = striker ?? nonStriker;
            nonStriker = null;
          }
        } else {
          bat.status = "retired_not_out";
          // partnership ends but not a wicket
          if (pship.current) {
            partnerships.push(pship.current);
            pship.current = null;
          }
        }
      }
      continue;
    }

    // ── delivery ──
    const d = item.d;
    currentBowlerId = d.bowler_id;
    const bowler = getBowler(d.bowler_id);
    const strikerBat = getBat(d.striker_id);
    strikerBat.status = "batting";
    strikerBat.atCrease = true;
    ensurePartnership();

    const total = deliveryTotal(d);
    totalRuns += total;
    if (pship.current) pship.current.runs += total;

    // batsman runs (off the bat only)
    if (d.extra_type === "none" || d.extra_type === "no_ball") {
      strikerBat.runs += d.runs_off_bat;
      if (d.runs_off_bat === 4) strikerBat.fours += 1;
      if (d.runs_off_bat === 6) strikerBat.sixes += 1;
    }
    // balls faced: every delivery except wides
    if (d.extra_type !== "wide") {
      strikerBat.balls += 1;
      if (pship.current) pship.current.balls += 1;
    }

    // extras tally
    if (d.extra_type === "wide") byes.wides += d.extra_runs;
    else if (d.extra_type === "no_ball") byes.noBalls += 1; // penalty count
    else if (d.extra_type === "bye") byes.byes += d.extra_runs;
    else if (d.extra_type === "leg_bye") byes.legByes += d.extra_runs;

    // bowler analysis
    bowler.runsConceded += bowlerRuns(d);
    if (d.extra_type === "wide") bowler.wides += 1;
    if (d.extra_type === "no_ball") bowler.noBalls += 1;

    const legal = isLegal(d.extra_type);
    if (legal) {
      legalBalls += 1;
      bowler.legalBalls += 1;
    }

    // over grouping (chip log)
    const o = getOver(d.over_number, d.bowler_id);
    o.deliveries.push({
      id: d.id,
      chip: chipFor(d),
      isWicket: d.is_wicket,
      isBoundary4: d.extra_type !== "wide" && d.runs_off_bat === 4,
      isBoundary6: d.extra_type !== "wide" && d.runs_off_bat === 6,
      isExtra: d.extra_type !== "none",
      runs: total,
    });
    o.runs += total;
    if (legal) o.legalBalls += 1;
    if (d.is_wicket) o.wickets += 1;

    if (legal && bowlerRuns(d) === 0) bowler.dots += 1;

    // strike rotation from runs run
    const lone = nonStriker === null && lastManStands;
    const ran = runsRun(d);
    if (!lone && nonStriker !== null && ran % 2 === 1) {
      [striker, nonStriker] = [nonStriker, striker];
    }

    // wicket on the delivery
    if (d.is_wicket && d.wicket_type !== "retired_out") {
      const outId = d.dismissed_player_id ?? striker ?? d.striker_id;
      const outBat = getBat(outId);
      outBat.isOut = true;
      outBat.status = "out";
      outBat.atCrease = false;
      outBat.wicketType = d.wicket_type;
      outBat.bowlerId = BOWLER_WICKETS.includes(d.wicket_type as WicketType)
        ? d.bowler_id
        : null;
      outBat.fielderId = d.fielder_id ?? null;
      outBat.howOut = describeDismissal(d);
      wickets += 1;
      if (BOWLER_WICKETS.includes(d.wicket_type as WicketType)) bowler.wickets += 1;
      fallOfWickets.push({
        wicketNumber: wickets,
        score: totalRuns,
        overDisplay: overDisplay(legalBalls),
        playerId: outId,
      });
      if (pship.current) {
        pship.current.out = true;
        partnerships.push(pship.current);
        pship.current = null;
      }
      // vacate the dismissed batsman's slot
      if (striker === outId) striker = null;
      else if (nonStriker === outId) nonStriker = null;

      // last-man-stands: a lone surviving batsman always bats on strike
      if (lastManStands && wickets === battingTeamSize - 1) {
        striker = striker ?? nonStriker;
        nonStriker = null;
      }
    }

    // end of over → swap strike (unless lone batsman), require new bowler
    if (legal && legalBalls % 6 === 0) {
      const loneNow = nonStriker === null && lastManStands;
      if (!loneNow && striker !== null && nonStriker !== null) {
        [striker, nonStriker] = [nonStriker, striker];
      }
      lastBowlerId = d.bowler_id;
      currentBowlerId = null;
    }

    // free-hit arming
    if (d.extra_type === "no_ball" && freeHitEnabled) freeHitArmed = true;
    else if (legal) freeHitArmed = false;
    // wide leaves freeHitArmed unchanged
  }

  // finalize current partnership (if pair still together)
  const currentPartnership = pship.current;

  // mark crease batsmen onStrike / status
  for (const b of bats.values()) {
    b.onStrike = b.playerId === striker;
    b.atCrease = b.playerId === striker || b.playerId === nonStriker;
    if (b.atCrease) b.status = "batting";
  }

  // termination conditions
  const allOutThreshold = lastManStands ? battingTeamSize : Math.max(1, battingTeamSize - 1);
  const isAllOut = wickets >= allOutThreshold;
  const oversComplete = legalBalls >= maxOvers * 6;
  const targetReached = target != null && totalRuns >= target;
  const isInningsOver = isAllOut || oversComplete || targetReached;

  // not-out status for batsmen still at crease at innings end
  if (isInningsOver) {
    for (const b of bats.values()) {
      if (b.atCrease && !b.isOut && b.status === "batting") b.status = "not_out";
    }
  }

  const oversFloat = legalBalls / 6;
  const runRate = legalBalls > 0 ? (totalRuns / legalBalls) * 6 : 0;

  let runsNeeded: number | null = null;
  let ballsRemaining: number | null = null;
  let requiredRunRate: number | null = null;
  if (target != null) {
    runsNeeded = Math.max(0, target - totalRuns);
    ballsRemaining = Math.max(0, maxOvers * 6 - legalBalls);
    requiredRunRate = ballsRemaining > 0 ? (runsNeeded / ballsRemaining) * 6 : 0;
  }

  // compute maidens now that overs are fully accumulated
  for (const o of overs) {
    const overBowlerRuns = computeOverBowlerRuns(deliveries, o.overNumber);
    o.isMaiden = o.legalBalls === 6 && overBowlerRuns === 0;
  }
  // assign maidens to bowlers
  for (const o of overs) {
    if (o.isMaiden) {
      const bw = bowlers.get(o.bowlerId);
      if (bw) bw.maidens += 1;
    }
  }

  const ballsThisOver = legalBalls % 6;
  const currentOverNumber = Math.floor(legalBalls / 6);
  const thisOver = overMap.get(currentOverNumber)?.deliveries ?? [];

  return {
    totalRuns,
    wickets,
    legalBalls,
    oversDisplay: overDisplay(legalBalls),
    oversFloat,
    currentOverNumber,
    ballsThisOver,
    strikerId: striker,
    nonStrikerId: nonStriker,
    currentBowlerId,
    lastBowlerId,
    nextIsFreeHit: freeHitArmed,
    batsmen: [...bats.values()].sort((a, b) => a.battingPosition - b.battingPosition),
    bowlers: [...bowlers.values()],
    overs,
    thisOver,
    fallOfWickets,
    partnerships,
    currentPartnership,
    extras: {
      byes: byes.byes,
      legByes: byes.legByes,
      wides: byes.wides,
      noBalls: byes.noBalls,
      total: byes.byes + byes.legByes + byes.wides + byes.noBalls,
    },
    runRate,
    target,
    runsNeeded,
    ballsRemaining,
    requiredRunRate,
    isAllOut,
    oversComplete,
    targetReached,
    isInningsOver,
    loneBatsman: nonStriker === null && striker !== null && lastManStands,
  };
}

function computeOverBowlerRuns(deliveries: Delivery[], overNumber: number): number {
  return deliveries
    .filter((d) => d.over_number === overNumber)
    .reduce((sum, d) => sum + bowlerRuns(d), 0);
}

function describeDismissal(d: Delivery): string {
  switch (d.wicket_type) {
    case "bowled":
      return "bowled";
    case "lbw":
      return "lbw";
    case "caught":
      return "caught";
    case "caught_and_bowled":
      return "c & b";
    case "stumped":
      return "stumped";
    case "hit_wicket":
      return "hit wicket";
    case "run_out":
      return "run out";
    case "obstructing":
      return "obstructing the field";
    case "retired_out":
      return "retired out";
    default:
      return "out";
  }
}

// ── derived display helpers ──────────────────────────────────────
export function strikeRate(runs: number, balls: number): number {
  return balls > 0 ? (runs / balls) * 100 : 0;
}
export function economy(runs: number, legalBalls: number): number {
  return legalBalls > 0 ? runs / (legalBalls / 6) : 0;
}
export function bowlerOvers(legalBalls: number): string {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}
