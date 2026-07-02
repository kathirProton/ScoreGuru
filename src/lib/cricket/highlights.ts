import type { MatchView } from "./matchview";
import { playerName } from "./matchview";
import { computePOTM, computeWorstPerformer } from "./stats";
import type { AggregateInput } from "./stats";

export interface MatchHighlights {
  potmId: string | null;
  worstId: string | null;
  topScore: { playerId: string; runs: number; balls: number } | null;
  topPartnership: { a: string | null; b: string | null; runs: number } | null;
  turningMoment: string | null;
}

/** Best/worst performer, top score, top stand, and a turning-moment blurb. */
export function matchHighlights(view: MatchView): MatchHighlights {
  const input: AggregateInput = {
    matches: [view.match],
    innings: view.innings,
    deliveries: view.deliveries,
    events: view.events,
    matchPlayers: view.matchPlayers,
  };
  const potmId = view.match.potm_player_id ?? computePOTM(input, view.match.id);
  const worstId = computeWorstPerformer(input, view.match.id, potmId);

  let topScore: MatchHighlights["topScore"] = null;
  let topPartnership: MatchHighlights["topPartnership"] = null;
  for (const iv of view.inningsViews) {
    if (iv.innings.is_super_over) continue;
    for (const b of iv.state.batsmen) {
      if (b.runs > 0 && (!topScore || b.runs > topScore.runs)) {
        topScore = { playerId: b.playerId, runs: b.runs, balls: b.balls };
      }
    }
    const parts = [...iv.state.partnerships];
    if (iv.state.currentPartnership) parts.push(iv.state.currentPartnership);
    for (const p of parts) {
      if (p.runs > 0 && (!topPartnership || p.runs > topPartnership.runs)) {
        topPartnership = { a: p.batsmen[0], b: p.batsmen[1], runs: p.runs };
      }
    }
  }

  let turningMoment: string | null = null;
  if (topPartnership && topPartnership.runs >= 15 && topPartnership.a && topPartnership.b) {
    turningMoment = `The ${topPartnership.runs}-run stand between ${playerName(view, topPartnership.a)} and ${playerName(
      view,
      topPartnership.b
    )} swung the momentum — the game was won and lost right there.`;
  } else if (topScore) {
    turningMoment = `${playerName(view, topScore.playerId)}'s ${topScore.runs} (${topScore.balls}) was the innings that decided it.`;
  }

  return { potmId, worstId, topScore, topPartnership, turningMoment };
}
