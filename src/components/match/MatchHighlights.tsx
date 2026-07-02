import type { MatchView } from "@/lib/cricket/matchview";
import { playerName } from "@/lib/cricket/matchview";
import { matchHighlights } from "@/lib/cricket/highlights";
import { Avatar } from "@/components/ui/primitives";

export function MatchHighlights({ view }: { view: MatchView }) {
  const h = matchHighlights(view);
  const potm = h.potmId ? view.playerById.get(h.potmId) : null;
  const worst = h.worstId ? view.playerById.get(h.worstId) : null;

  return (
    <div className="space-y-4">
      {view.match.result_text && (
        <div className="sg-card border-brand/30 bg-brand-50 p-4 text-center">
          <p className="font-display text-lg font-bold text-brand-700">{view.match.result_text}</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {potm && (
          <div className="sg-card border-brand/30 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-600">🏆 Aatta Naayakan</p>
            <div className="mt-2 flex items-center gap-3">
              <Avatar name={potm.name} photo={potm.photo_url} size={44} ring />
              <div className="min-w-0">
                <p className="truncate font-display font-bold text-ink">{potm.name}</p>
                <p className="text-xs text-ink-muted">Player of the match</p>
              </div>
            </div>
          </div>
        )}
        {worst && (
          <div className="sg-card border-wicket/30 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-wicket">😵 Sodhappal</p>
            <div className="mt-2 flex items-center gap-3">
              <Avatar name={worst.name} photo={worst.photo_url} size={44} />
              <div className="min-w-0">
                <p className="truncate font-display font-bold text-ink">{worst.name}</p>
                <p className="text-xs text-ink-muted">Off day at the office</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {h.topScore && (
          <div className="sg-card p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Highest score</p>
            <p className="mt-1 font-display text-lg font-bold text-ink">
              {playerName(view, h.topScore.playerId)}{" "}
              <span className="font-mono text-brand-600">{h.topScore.runs}</span>
              <span className="text-sm font-normal text-ink-muted"> ({h.topScore.balls})</span>
            </p>
          </div>
        )}
        {h.topPartnership && h.topPartnership.a && h.topPartnership.b && (
          <div className="sg-card p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Highest partnership</p>
            <p className="mt-1 font-display text-lg font-bold text-ink">
              <span className="font-mono text-brand-600">{h.topPartnership.runs}</span>{" "}
              <span className="text-sm font-normal text-ink-muted">
                — {playerName(view, h.topPartnership.a)} &amp; {playerName(view, h.topPartnership.b)}
              </span>
            </p>
          </div>
        )}
      </div>

      {h.turningMoment && (
        <div className="sg-card border-gold/30 bg-gold-soft p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gold-dark">⚡ Match Turning Moment</p>
          <p className="mt-1.5 text-sm text-ink-soft">{h.turningMoment}</p>
        </div>
      )}
    </div>
  );
}
