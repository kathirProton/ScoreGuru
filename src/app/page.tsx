import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { MatchCard } from "@/components/public/MatchCard";
import { BrandMark } from "@/components/ui/Brand";
import { SectionTitle, EmptyState, LiveDot } from "@/components/ui/primitives";
import { getLiveMatches, getCompletedMatches, getMatchView } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [live, completed] = await Promise.all([getLiveMatches(), getCompletedMatches()]);
  const liveViews = (await Promise.all(live.slice(0, 3).map((m) => getMatchView(m.id)))).filter(
    Boolean
  );
  const recentViews = (
    await Promise.all(completed.slice(0, 3).map((m) => getMatchView(m.id)))
  ).filter(Boolean);

  return (
    <PublicShell>
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-brand-50 via-white to-cream-200 p-7 shadow-card">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand/20 blur-2xl" />
        <div className="relative">
          <BrandMark size={56} />
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">
            Turf cricket,
            <br />
            <span className="text-brand-600">scored like the pros.</span>
          </h1>
          <p className="mt-3 max-w-md text-ink-soft">
            Ball-by-ball live scoring, gorgeous scorecards, and all-time leaderboards
            for the crew. No spreadsheets. No arguments.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/live" className="sg-btn-primary px-5 py-3">
              {live.length > 0 ? (
                <span className="flex items-center gap-2">
                  <LiveDot /> Watch Live
                </span>
              ) : (
                "Go Live"
              )}
            </Link>
            <Link href="/stats" className="sg-btn-ghost px-5 py-3">
              Leaderboards
            </Link>
          </div>
        </div>
      </section>

      {/* Live now */}
      {liveViews.length > 0 && (
        <section className="mt-8">
          <SectionTitle action={<Link href="/live" className="text-sm font-medium text-brand-600">View all</Link>}>
            <span className="flex items-center gap-2">
              <LiveDot /> Live now
            </span>
          </SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {liveViews.map((v) => v && <MatchCard key={v.match.id} view={v} />)}
          </div>
        </section>
      )}

      {/* Quick links */}
      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: "/matches", label: "Matches", emoji: "📋" },
          { href: "/players", label: "Players", emoji: "🧢" },
          { href: "/stats", label: "Stats", emoji: "🏆" },
          { href: "/submit-player", label: "Add Player", emoji: "➕" },
        ].map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="sg-card flex flex-col items-start gap-2 p-4 transition hover:shadow-lift active:scale-[0.98]"
          >
            <span className="text-2xl">{q.emoji}</span>
            <span className="font-display font-semibold text-ink">{q.label}</span>
          </Link>
        ))}
      </section>

      {/* Recent results */}
      <section className="mt-8">
        <SectionTitle action={<Link href="/matches" className="text-sm font-medium text-brand-600">All matches</Link>}>
          Recent results
        </SectionTitle>
        {recentViews.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {recentViews.map((v) => v && <MatchCard key={v.match.id} view={v} />)}
          </div>
        ) : (
          <EmptyState
            title="No matches yet"
            subtitle="Once the admin scores a match, results will show up here."
          />
        )}
      </section>
    </PublicShell>
  );
}
