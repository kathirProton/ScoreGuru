/**
 * Aggregation of the delivery log into player career stats, POTM, and
 * leaderboards. Super-over innings are excluded from career stats.
 */
import type { Delivery, BattingEvent, Innings, Match } from "../types";
import { BOWLER_WICKETS } from "../types";
import { deriveInnings, strikeRate, economy } from "./engine";

export interface PlayerAgg {
  playerId: string;
  matches: Set<string>;
  // batting
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  outs: number; // dismissals (for average)
  inningsBatted: number;
  highScore: number;
  fifties: number;
  hundreds: number;
  ducks: number;
  // bowling
  ballsBowled: number;
  runsConceded: number;
  wickets: number;
  maidens: number;
  bestWk: number;
  bestRuns: number; // for best figures tiebreak
  // fielding
  catches: number;
  stumpings: number;
  runOuts: number;
  // results
  wins: number;
  losses: number;
  ties: number;
}

function blank(playerId: string): PlayerAgg {
  return {
    playerId,
    matches: new Set(),
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    outs: 0,
    inningsBatted: 0,
    highScore: 0,
    fifties: 0,
    hundreds: 0,
    ducks: 0,
    ballsBowled: 0,
    runsConceded: 0,
    wickets: 0,
    maidens: 0,
    bestWk: -1,
    bestRuns: 0,
    catches: 0,
    stumpings: 0,
    runOuts: 0,
    wins: 0,
    losses: 0,
    ties: 0,
  };
}

export interface AggregateInput {
  matches: Match[];
  innings: Innings[];
  deliveries: Delivery[];
  events: BattingEvent[];
  matchPlayers: { match_id: string; team_id: string; player_id: string }[];
}

/** Build per-player aggregated stats across all COMPLETED, non-super-over innings. */
export function aggregatePlayers(input: AggregateInput): Map<string, PlayerAgg> {
  const { matches, innings, deliveries, events, matchPlayers } = input;
  const aggs = new Map<string, PlayerAgg>();
  const get = (id: string) => {
    let a = aggs.get(id);
    if (!a) {
      a = blank(id);
      aggs.set(id, a);
    }
    return a;
  };

  const completed = matches.filter((m) => m.status === "completed");
  const matchById = new Map(completed.map((m) => [m.id, m]));

  // matches played + win/loss
  for (const mp of matchPlayers) {
    const m = matchById.get(mp.match_id);
    if (!m) continue;
    const a = get(mp.player_id);
    a.matches.add(mp.match_id);
    if (m.is_tie) a.ties += 1;
    else if (m.winner_team_id) {
      if (m.winner_team_id === mp.team_id) a.wins += 1;
      else a.losses += 1;
    }
  }

  const inningsById = new Map(innings.map((i) => [i.id, i]));
  const deliveriesByInnings = new Map<string, Delivery[]>();
  for (const d of deliveries) {
    if (!deliveriesByInnings.has(d.innings_id)) deliveriesByInnings.set(d.innings_id, []);
    deliveriesByInnings.get(d.innings_id)!.push(d);
  }
  const eventsByInnings = new Map<string, BattingEvent[]>();
  for (const e of events) {
    if (!eventsByInnings.has(e.innings_id)) eventsByInnings.set(e.innings_id, []);
    eventsByInnings.get(e.innings_id)!.push(e);
  }

  for (const inn of innings) {
    const m = matchById.get(inn.match_id);
    if (!m || inn.is_super_over) continue; // only completed, non-super-over
    const innDeliveries = deliveriesByInnings.get(inn.id) ?? [];
    if (innDeliveries.length === 0 && (eventsByInnings.get(inn.id)?.length ?? 0) === 0)
      continue;

    const state = deriveInnings({
      deliveries: innDeliveries,
      events: eventsByInnings.get(inn.id) ?? [],
      maxOvers: m.overs,
      target: inn.target,
      battingTeamSize: 11,
      lastManStands: m.last_man_stands,
      freeHitEnabled: m.free_hit_enabled,
    });

    // batting
    for (const b of state.batsmen) {
      if (b.balls === 0 && !b.isOut && b.status === "yet_to_bat") continue;
      const a = get(b.playerId);
      a.runs += b.runs;
      a.balls += b.balls;
      a.fours += b.fours;
      a.sixes += b.sixes;
      a.inningsBatted += 1;
      if (b.isOut) a.outs += 1;
      if (b.runs > a.highScore) a.highScore = b.runs;
      if (b.runs >= 100) a.hundreds += 1;
      else if (b.runs >= 50) a.fifties += 1;
      if (b.runs === 0 && b.isOut) a.ducks += 1;
    }

    // bowling
    for (const bw of state.bowlers) {
      const a = get(bw.playerId);
      a.ballsBowled += bw.legalBalls;
      a.runsConceded += bw.runsConceded;
      a.wickets += bw.wickets;
      a.maidens += bw.maidens;
      if (
        bw.wickets > a.bestWk ||
        (bw.wickets === a.bestWk && bw.runsConceded < a.bestRuns)
      ) {
        a.bestWk = bw.wickets;
        a.bestRuns = bw.runsConceded;
      }
    }

    // fielding (from deliveries)
    for (const d of innDeliveries) {
      if (!d.is_wicket) continue;
      if (d.wicket_type === "caught" && d.fielder_id) get(d.fielder_id).catches += 1;
      if (d.wicket_type === "caught_and_bowled") get(d.bowler_id).catches += 1;
      if (d.wicket_type === "stumped" && d.fielder_id) get(d.fielder_id).stumpings += 1;
      if (d.wicket_type === "run_out" && d.fielder_id) get(d.fielder_id).runOuts += 1;
    }
  }

  return aggs;
}

export const battingAverage = (a: PlayerAgg) =>
  a.outs > 0 ? a.runs / a.outs : a.runs;
export const bowlingAverage = (a: PlayerAgg) =>
  a.wickets > 0 ? a.runsConceded / a.wickets : Infinity;
export const playerStrikeRate = (a: PlayerAgg) => strikeRate(a.runs, a.balls);
export const playerEconomy = (a: PlayerAgg) => economy(a.runsConceded, a.ballsBowled);
export const matchesPlayed = (a: PlayerAgg) => a.matches.size;
export const winPct = (a: PlayerAgg) =>
  a.matches.size > 0 ? (a.wins / a.matches.size) * 100 : 0;
export const bestFigures = (a: PlayerAgg) =>
  a.bestWk >= 0 ? `${a.bestWk}/${a.bestRuns}` : "—";

/**
 * Player of the Match for a single match (excludes super overs).
 * points = runs + wk*20 + catch*10 + stump*10 + runout*8 + six*2 + four*1
 *          + low-economy bonus (bowled ≥1 over) + high-SR bonus (faced ≥5 balls)
 */
export function computePOTM(input: AggregateInput, matchId: string): string | null {
  const match = input.matches.find((m) => m.id === matchId);
  if (!match) return null;
  const single: AggregateInput = {
    matches: [match],
    innings: input.innings.filter((i) => i.match_id === matchId),
    deliveries: input.deliveries,
    events: input.events,
    matchPlayers: input.matchPlayers.filter((mp) => mp.match_id === matchId),
  };
  const aggs = aggregatePlayers(single);
  let bestId: string | null = null;
  let bestPts = -Infinity;
  for (const a of aggs.values()) {
    let pts =
      a.runs +
      a.wickets * 20 +
      a.catches * 10 +
      a.stumpings * 10 +
      a.runOuts * 8 +
      a.sixes * 2 +
      a.fours * 1;
    if (a.ballsBowled >= 6) {
      const econ = playerEconomy(a);
      if (econ < 6) pts += (6 - econ) * 2; // low-economy bonus
    }
    if (a.balls >= 5) {
      const sr = playerStrikeRate(a);
      if (sr > 120) pts += (sr - 120) / 20; // high strike-rate bonus
    }
    if (pts > bestPts) {
      bestPts = pts;
      bestId = a.playerId;
    }
  }
  return bestId;
}
