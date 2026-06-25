import { deriveInnings, InningsState } from "./engine";
import type { MatchBundle } from "./load";
import type { Innings, Player, Team } from "../types";

export interface InningsView {
  innings: Innings;
  state: InningsState;
  battingTeam: Team | undefined;
  bowlingTeam: Team | undefined;
}

export interface MatchView extends MatchBundle {
  playerById: Map<string, Player>;
  teamById: Map<string, Team>;
  inningsViews: InningsView[];
  /** the innings currently being played (live), if any */
  currentInnings: InningsView | null;
}

export function buildMatchView(bundle: MatchBundle): MatchView {
  const playerById = new Map(bundle.players.map((p) => [p.id, p]));
  const teamById = new Map(bundle.teams.map((t) => [t.id, t]));

  const sizeOf = (teamId: string) =>
    bundle.matchPlayers.filter((mp) => mp.team_id === teamId).length || 11;

  const inningsViews: InningsView[] = bundle.innings.map((inn) => {
    const deliveries = bundle.deliveries.filter((d) => d.innings_id === inn.id);
    const events = bundle.events.filter((e) => e.innings_id === inn.id);
    const maxOvers = inn.is_super_over ? bundle.match.super_over_overs : bundle.match.overs;
    const state = deriveInnings({
      deliveries,
      events,
      maxOvers,
      target: inn.target,
      battingTeamSize: sizeOf(inn.batting_team_id),
      lastManStands: bundle.match.last_man_stands,
      freeHitEnabled: bundle.match.free_hit_enabled,
    });
    return {
      innings: inn,
      state,
      battingTeam: teamById.get(inn.batting_team_id),
      bowlingTeam: teamById.get(inn.bowling_team_id),
    };
  });

  let currentInnings: InningsView | null = null;
  if (["live", "super_over"].includes(bundle.match.status)) {
    // last innings that is not closed (or the latest)
    currentInnings =
      [...inningsViews].reverse().find((v) => !v.innings.is_closed) ??
      inningsViews[inningsViews.length - 1] ??
      null;
  } else if (bundle.match.status === "innings_break") {
    currentInnings = inningsViews[inningsViews.length - 1] ?? null;
  }

  return {
    ...bundle,
    playerById,
    teamById,
    inningsViews,
    currentInnings,
  };
}

export function playerName(view: MatchView, id: string | null | undefined): string {
  if (!id) return "—";
  const p = view.playerById.get(id);
  return p ? p.nickname || p.name : "Unknown";
}
