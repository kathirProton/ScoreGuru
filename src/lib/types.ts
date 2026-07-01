import type { Tables, Enums } from "./database.types";

export type Player = Tables<"players">;
export type Team = Tables<"teams">;
export type TeamPlayer = Tables<"team_players">;
export type Match = Tables<"matches">;
export type MatchPlayer = Tables<"match_players">;
export type Innings = Tables<"innings">;
export type Delivery = Tables<"deliveries">;
export type BattingEvent = Tables<"batting_events">;

export type PlayerStatus = Enums<"player_status">;
export type MatchStatus = Enums<"match_status">;
export type ExtraType = Enums<"extra_type">;
export type WicketType = Enums<"wicket_type">;
export type TossDecision = Enums<"toss_decision">;
export type BattingHand = Enums<"batting_hand">;
export type BattingEventType = Enums<"batting_event_type">;

export const WICKET_LABELS: Record<WicketType, string> = {
  bowled: "Bowled",
  caught: "Caught",
  lbw: "LBW",
  run_out: "Run Out",
  stumped: "Stumped",
  hit_wicket: "Hit Wicket",
  caught_and_bowled: "Caught & Bowled",
  retired_out: "Retired Out",
  obstructing: "Obstructing the Field",
};

export const EXTRA_LABELS: Record<ExtraType, string> = {
  none: "—",
  wide: "Wide",
  no_ball: "No Ball",
  bye: "Bye",
  leg_bye: "Leg Bye",
};

/** Wicket types where the bowler gets credit. */
export const BOWLER_WICKETS: WicketType[] = [
  "bowled",
  "caught",
  "lbw",
  "stumped",
  "hit_wicket",
  "caught_and_bowled",
];

/** On a free hit, only these dismissals are allowed. */
export const FREE_HIT_ALLOWED: WicketType[] = ["run_out", "obstructing"];
