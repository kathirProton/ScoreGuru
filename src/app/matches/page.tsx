import { PublicShell } from "@/components/public/PublicShell";
import { MatchCard } from "@/components/public/MatchCard";
import { SectionTitle, EmptyState, LiveDot } from "@/components/ui/primitives";
import { getLiveMatches, getCompletedMatches, getMatchView } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Matches — Score Guru" };

export default async function MatchesPage() {
  const [live, completed] = await Promise.all([getLiveMatches(), getCompletedMatches()]);
  const liveViews = (await Promise.all(live.map((m) => getMatchView(m.id)))).filter(Boolean);
  const doneViews = (await Promise.all(completed.map((m) => getMatchView(m.id)))).filter(Boolean);

  return (
    <PublicShell>
      <h1 className="mb-5 font-display text-2xl font-bold tracking-tight text-ink">Matches</h1>

      {liveViews.length > 0 && (
        <section className="mb-8">
          <SectionTitle>
            <span className="flex items-center gap-2">
              <LiveDot /> In progress
            </span>
          </SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {liveViews.map((v) => v && <MatchCard key={v.match.id} view={v} />)}
          </div>
        </section>
      )}

      <SectionTitle>Completed</SectionTitle>
      {doneViews.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {doneViews.map((v) => v && <MatchCard key={v.match.id} view={v} />)}
        </div>
      ) : (
        <EmptyState title="No completed matches yet" subtitle="Scored matches will appear here." icon="📋" />
      )}
    </PublicShell>
  );
}
