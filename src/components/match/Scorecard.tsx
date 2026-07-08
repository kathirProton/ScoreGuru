import Link from "next/link";
import type { MatchView, InningsView } from "@/lib/cricket/matchview";
import { playerName } from "@/lib/cricket/matchview";
import type { BatsmanStat } from "@/lib/cricket/engine";
import { strikeRate, economy, bowlerOvers } from "@/lib/cricket/engine";
import { fmt1, fmt2 } from "@/lib/format";

function dismissalText(view: MatchView, b: BatsmanStat): string {
  if (!b.isOut) {
    if (b.status === "retired_not_out") return "retired not out";
    return b.balls > 0 || b.status === "not_out" ? "not out" : "did not bat";
  }
  const bowler = b.bowlerId ? playerName(view, b.bowlerId) : null;
  const fielder = b.fielderId ? playerName(view, b.fielderId) : null;
  switch (b.wicketType) {
    case "bowled":
      return `b ${bowler}`;
    case "lbw":
      return `lbw b ${bowler}`;
    case "caught":
      return `c ${fielder ?? "?"} b ${bowler}`;
    case "caught_and_bowled":
      return `c & b ${bowler}`;
    case "stumped":
      return `st ${fielder ?? "?"} b ${bowler}`;
    case "hit_wicket":
      return `hit wkt b ${bowler}`;
    case "run_out":
      return `run out${fielder ? ` (${fielder})` : ""}`;
    case "obstructing":
      return "obstructing the field";
    case "retired_out":
      return "retired out";
    default:
      return "out";
  }
}

function InningsTable({ view, iv }: { view: MatchView; iv: InningsView }) {
  const { state, battingTeam } = iv;
  const batted = state.batsmen.filter(
    (b) => b.balls > 0 || b.isOut || b.status === "not_out" || b.status === "retired_not_out"
  );

  // Full batting squad, so we can show who is yet to bat.
  const battedIds = new Set(batted.map((b) => b.playerId));
  const atCrease = new Set([state.strikerId, state.nonStrikerId].filter(Boolean) as string[]);
  const yetToBat = view.matchPlayers
    .filter((mp) => mp.team_id === iv.innings.batting_team_id)
    .map((mp) => view.playerById.get(mp.player_id))
    .filter((p): p is NonNullable<typeof p> => !!p && !battedIds.has(p.id) && !atCrease.has(p.id));

  return (
    <div className="sg-card overflow-hidden">
      <div className="flex items-center justify-between bg-brand-50 px-4 py-3">
        <h3 className="font-display font-bold text-ink">{battingTeam?.name ?? "Innings"}</h3>
        <span className="font-mono text-lg font-bold tabular-nums text-brand-700">
          {state.totalRuns}/{state.wickets}
          <span className="ml-1 text-sm font-medium text-ink-muted">({state.oversDisplay})</span>
        </span>
      </div>

      {/* Batting */}
      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-2 text-left font-medium">Batter</th>
              <th className="px-2 py-2 text-right font-medium">R</th>
              <th className="px-2 py-2 text-right font-medium">B</th>
              <th className="px-2 py-2 text-right font-medium">4s</th>
              <th className="px-2 py-2 text-right font-medium">6s</th>
              <th className="px-4 py-2 text-right font-medium">SR</th>
            </tr>
          </thead>
          <tbody>
            {batted.map((b) => (
              <tr key={b.playerId} className="border-t border-line">
                <td className="px-4 py-2">
                  <Link href={`/players/${b.playerId}`} className="font-medium text-ink hover:text-brand-600">
                    {playerName(view, b.playerId)}
                  </Link>
                  <div className="text-xs text-ink-muted">{dismissalText(view, b)}</div>
                </td>
                <td className="px-2 py-2 text-right font-mono font-semibold tabular-nums text-ink">{b.runs}</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums text-ink-muted">{b.balls}</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums text-ink-muted">{b.fours}</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums text-ink-muted">{b.sixes}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-ink-muted">
                  {fmt1(strikeRate(b.runs, b.balls))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Extras + total */}
      <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-sm">
        <span className="text-ink-muted">
          Extras <span className="font-medium text-ink">{state.extras.total}</span>{" "}
          <span className="text-xs text-ink-faint">
            (b {state.extras.byes}, lb {state.extras.legByes}, w {state.extras.wides}, nb {state.extras.noBalls})
          </span>
        </span>
        <span className="font-semibold text-ink">
          Total {state.totalRuns}/{state.wickets}
        </span>
      </div>

      {/* Yet to bat */}
      {yetToBat.length > 0 && (
        <div className="border-t border-line px-4 py-2.5 text-xs text-ink-muted">
          <span className="font-medium text-ink-soft">Yet to bat: </span>
          {yetToBat.map((p, i) => (
            <span key={p.id} className="capitalize">
              {p.nickname || p.name}
              {i < yetToBat.length - 1 ? ", " : ""}
            </span>
          ))}
        </div>
      )}

      {/* Fall of wickets */}
      {state.fallOfWickets.length > 0 && (
        <div className="border-t border-line px-4 py-2.5 text-xs text-ink-muted">
          <span className="font-medium text-ink-soft">Fall: </span>
          {state.fallOfWickets.map((f, i) => (
            <span key={i}>
              {f.score}-{f.wicketNumber} ({playerName(view, f.playerId)}, {f.overDisplay})
              {i < state.fallOfWickets.length - 1 ? " · " : ""}
            </span>
          ))}
        </div>
      )}

      {/* Bowling */}
      <div className="overflow-x-auto no-scrollbar border-t-4 border-cream-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-2 text-left font-medium">Bowler</th>
              <th className="px-2 py-2 text-right font-medium">O</th>
              <th className="px-2 py-2 text-right font-medium">M</th>
              <th className="px-2 py-2 text-right font-medium">R</th>
              <th className="px-2 py-2 text-right font-medium">W</th>
              <th className="px-4 py-2 text-right font-medium">Econ</th>
            </tr>
          </thead>
          <tbody>
            {state.bowlers.map((bw) => (
              <tr key={bw.playerId} className="border-t border-line">
                <td className="px-4 py-2">
                  <Link href={`/players/${bw.playerId}`} className="font-medium text-ink hover:text-brand-600">
                    {playerName(view, bw.playerId)}
                  </Link>
                </td>
                <td className="px-2 py-2 text-right font-mono tabular-nums text-ink-muted">{bowlerOvers(bw.legalBalls)}</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums text-ink-muted">{bw.maidens}</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums text-ink-muted">{bw.runsConceded}</td>
                <td className="px-2 py-2 text-right font-mono font-semibold tabular-nums text-ink">{bw.wickets}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-ink-muted">
                  {fmt2(economy(bw.runsConceded, bw.legalBalls))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Scorecard({ view }: { view: MatchView }) {
  const mainInnings = view.inningsViews.filter((iv) => !iv.innings.is_super_over);
  const superInnings = view.inningsViews.filter((iv) => iv.innings.is_super_over);
  return (
    <div className="space-y-5">
      {mainInnings.map((iv) => (
        <InningsTable key={iv.innings.id} view={view} iv={iv} />
      ))}
      {superInnings.length > 0 && (
        <div>
          <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-gold-dark">
            Super Over
          </h3>
          <div className="space-y-3">
            {superInnings.map((iv) => (
              <InningsTable key={iv.innings.id} view={view} iv={iv} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
