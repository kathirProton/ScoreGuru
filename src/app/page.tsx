import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { MatchCard } from "@/components/public/MatchCard";
import { BrandMark } from "@/components/ui/Brand";
import { SectionTitle, EmptyState, LiveDot } from "@/components/ui/primitives";
import { Leaderboard } from "@/components/public/Leaderboard";
import { CoinToss } from "@/components/ui/CoinToss";
import { getLiveMatches, getCompletedMatches, getMatchView, getStatsBundle } from "@/lib/data";
import { aggregatePlayers, matchesPlayed, bestFigures } from "@/lib/cricket/stats";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [live, completed] = await Promise.all([getLiveMatches(), getCompletedMatches()]);
  const liveViews = (await Promise.all(live.slice(0, 3).map((m) => getMatchView(m.id)))).filter(
    Boolean
  );
  const recentViews = (
    await Promise.all(completed.slice(0, 3).map((m) => getMatchView(m.id)))
  ).filter(Boolean);

  // stat leaders for the home page
  const statsBundle = await getStatsBundle();
  const players = new Map(statsBundle.players.map((p) => [p.id, p]));
  const aggs = aggregatePlayers(statsBundle);
  const all = [...aggs.values()];
  const topRuns = all
    .filter((a) => a.runs > 0)
    .sort((x, y) => y.runs - x.runs)
    .slice(0, 5)
    .map((a) => ({ playerId: a.playerId, value: `${a.runs}`, sub: `${matchesPlayed(a)} M · HS ${a.highScore}` }));
  const topWkts = all
    .filter((a) => a.wickets > 0)
    .sort((x, y) => y.wickets - x.wickets)
    .slice(0, 5)
    .map((a) => ({ playerId: a.playerId, value: `${a.wickets}`, sub: `Best ${bestFigures(a)}` }));
  const hasStats = topRuns.length > 0 || topWkts.length > 0;

  return (
    <PublicShell>
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-brand-50 via-cream-100 to-cream-200 p-7 shadow-card">
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

      {/* Stat leaders */}
      {hasStats && (
        <section className="mt-8">
          <SectionTitle action={<Link href="/stats" className="text-sm font-medium text-brand-600">All leaderboards</Link>}>
            Stat leaders
          </SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Leaderboard title="Orange Cap — Most Runs" emoji="🧡" players={players} accent="text-[#E07A1F]" rows={topRuns} />
            <Leaderboard title="Purple Cap — Most Wickets" emoji="💜" players={players} accent="text-[#7C3AED]" rows={topWkts} />
          </div>
        </section>
      )}

      {/* Toss for fun */}
      <section className="mt-8">
        <SectionTitle>Toss for fun</SectionTitle>
        <div className="sg-card relative overflow-hidden p-7">
          <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-brand/10 blur-2xl" />
          <div className="absolute -bottom-12 -right-8 h-40 w-40 rounded-full bg-[#f6cd50]/10 blur-2xl" />
          <div className="relative flex flex-col items-center">
            <p className="mb-5 max-w-sm text-center text-sm text-ink-soft">
              Can&apos;t decide who bats first? Settle it the only way that matters —
              <span className="font-semibold text-brand-600"> Thala or Thalapathy</span>.
            </p>
            <CoinToss />
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
