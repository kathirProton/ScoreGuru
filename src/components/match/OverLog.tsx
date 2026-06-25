import type { MatchView } from "@/lib/cricket/matchview";
import { playerName } from "@/lib/cricket/matchview";
import { BallChip } from "./Chip";

export function OverLog({ view }: { view: MatchView }) {
  const innings = view.inningsViews.filter(
    (iv) => iv.state.overs.length > 0
  );
  if (innings.length === 0) return null;

  return (
    <div className="space-y-5">
      {innings.map((iv) => (
        <div key={iv.innings.id} className="sg-card p-4">
          <h3 className="mb-3 font-display font-bold text-ink">
            {iv.battingTeam?.name}
            {iv.innings.is_super_over && (
              <span className="ml-2 text-xs font-medium text-gold-dark">Super Over</span>
            )}
          </h3>
          <div className="space-y-2.5">
            {[...iv.state.overs].reverse().map((o) => (
              <div key={o.overNumber} className="flex items-start gap-3 border-t border-line pt-2.5 first:border-0 first:pt-0">
                <div className="w-10 shrink-0 text-xs">
                  <div className="font-mono font-bold text-ink">Ov {o.overNumber + 1}</div>
                  <div className="text-ink-faint">{o.runs} run{o.runs === 1 ? "" : "s"}</div>
                </div>
                <div className="flex flex-1 flex-wrap gap-1.5">
                  {o.deliveries.map((d) => (
                    <BallChip key={d.id} d={d} size="sm" />
                  ))}
                  {o.isMaiden && (
                    <span className="sg-chip h-7 px-2 text-[11px] bg-brand-100 text-brand-700">M</span>
                  )}
                </div>
                <div className="hidden shrink-0 text-right text-[11px] text-ink-muted sm:block">
                  {playerName(view, o.bowlerId)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
