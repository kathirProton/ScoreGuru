import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { MatchCard } from "@/components/public/MatchCard";
import { MatchHeader } from "@/components/match/MatchHeader";
import { LiveMatchClient } from "@/components/match/LiveMatchClient";
import { EmptyState, LiveDot } from "@/components/ui/primitives";
import { getLiveMatches, getMatchBundle, getMatchView, getCompletedMatches } from "@/lib/data";
import { buildMatchView } from "@/lib/cricket/matchview";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live — Score Guru" };

export default async function LivePage() {
  const live = await getLiveMatches();

  if (live.length === 0) {
    const completed = await getCompletedMatches();
    const last = completed[0] ? await getMatchView(completed[0].id) : null;
    return (
      <PublicShell>
        <h1 className="mb-5 flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-ink">
          <LiveDot /> Live
        </h1>
        <EmptyState
          title="No live match right now"
          subtitle="When the admin starts scoring, it'll appear here instantly."
          icon="📡"
        />
        {last && (
          <div className="mt-6">
            <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-ink-faint">
              Last match
            </h2>
            <MatchCard view={last} />
          </div>
        )}
      </PublicShell>
    );
  }

  if (live.length === 1) {
    const bundle = await getMatchBundle(live[0].id);
    if (!bundle) return null;
    const view = buildMatchView(bundle);
    return (
      <PublicShell>
        <MatchHeader view={view} />
        <LiveMatchClient initial={bundle} />
      </PublicShell>
    );
  }

  const views = (await Promise.all(live.map((m) => getMatchView(m.id)))).filter(Boolean);
  return (
    <PublicShell>
      <h1 className="mb-5 flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-ink">
        <LiveDot /> Live now
      </h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {views.map((v) => v && <MatchCard key={v.match.id} view={v} />)}
      </div>
    </PublicShell>
  );
}
