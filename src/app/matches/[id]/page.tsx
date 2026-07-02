import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/PublicShell";
import { MatchHeader } from "@/components/match/MatchHeader";
import { Scorecard } from "@/components/match/Scorecard";
import { OverLog } from "@/components/match/OverLog";
import { MatchHighlights } from "@/components/match/MatchHighlights";
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
          <MatchHighlights view={view} />
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
