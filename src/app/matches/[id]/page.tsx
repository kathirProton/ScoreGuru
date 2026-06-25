import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/PublicShell";
import { MatchHeader } from "@/components/match/MatchHeader";
import { Scorecard } from "@/components/match/Scorecard";
import { OverLog } from "@/components/match/OverLog";
import { LiveMatchClient } from "@/components/match/LiveMatchClient";
import { getMatchBundle } from "@/lib/data";
import { buildMatchView } from "@/lib/cricket/matchview";

export const dynamic = "force-dynamic";

export default async function MatchDetailPage({ params }: { params: { id: string } }) {
  const bundle = await getMatchBundle(params.id);
  if (!bundle) notFound();
  const view = buildMatchView(bundle);
  const isLive = ["live", "innings_break", "super_over", "setup"].includes(bundle.match.status);

  return (
    <PublicShell>
      <MatchHeader view={view} />
      {isLive ? (
        <LiveMatchClient initial={bundle} />
      ) : (
        <div className="space-y-6">
          {view.match.result_text && (
            <div className="sg-card border-brand/30 bg-brand-50 p-4 text-center">
              <p className="font-display text-lg font-bold text-brand-700">{view.match.result_text}</p>
              {view.match.potm_player_id && (
                <p className="mt-1 text-sm text-ink-soft">
                  ⭐ Player of the Match:{" "}
                  <span className="font-semibold text-ink">
                    {view.playerById.get(view.match.potm_player_id)?.name}
                  </span>
                </p>
              )}
            </div>
          )}
          <section>
            <h2 className="mb-3 font-display text-lg font-bold text-ink">Scorecard</h2>
            <Scorecard view={view} />
          </section>
          <section>
            <h2 className="mb-3 font-display text-lg font-bold text-ink">Ball by ball</h2>
            <OverLog view={view} />
          </section>
        </div>
      )}
    </PublicShell>
  );
}
