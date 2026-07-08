import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { Leaderboard, BoardRow } from "@/components/public/Leaderboard";
import { EmptyState } from "@/components/ui/primitives";
import { getStatsBundle } from "@/lib/data";
import {
  aggregatePlayers,
  PlayerAgg,
  battingAverage,
  playerStrikeRate,
  playerEconomy,
  bestFigures,
  matchesPlayed,
  dismissalHeadToHead,
  boundaryHeadToHead,
} from "@/lib/cricket/stats";
import { fmt1, fmt2, monthKey, monthLabel } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stats & Leaderboards — Score Guru" };

function board(
  aggs: Map<string, PlayerAgg>,
  value: (a: PlayerAgg) => number,
  format: (a: PlayerAgg) => string,
  opts: { min?: (a: PlayerAgg) => boolean; asc?: boolean; limit?: number; sub?: (a: PlayerAgg) => string } = {}
): BoardRow[] {
  const { min, asc = false, limit = 8, sub } = opts;
  return [...aggs.values()]
    .filter((a) => (min ? min(a) : value(a) > 0))
    .sort((x, y) => (asc ? value(x) - value(y) : value(y) - value(x)))
    .slice(0, limit)
    .map((a) => ({ playerId: a.playerId, value: format(a), sub: sub?.(a) }));
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const bundle = await getStatsBundle();
  const players = new Map(bundle.players.map((p) => [p.id, p]));

  const months = [...new Set(bundle.matches.map((m) => monthKey(m.match_date)))].sort().reverse();
  const selected = searchParams.month && months.includes(searchParams.month) ? searchParams.month : null;

  const filteredMatches = selected
    ? bundle.matches.filter((m) => monthKey(m.match_date) === selected)
    : bundle.matches;
  const scopedInput = { ...bundle, matches: filteredMatches };
  const aggs = aggregatePlayers(scopedInput);
  const h2h = dismissalHeadToHead(scopedInput);
  const boundaryPairs = boundaryHeadToHead(scopedInput);
  const topSixes = boundaryPairs.filter((p) => p.sixes > 0).sort((a, b) => b.sixes - a.sixes).slice(0, 6);
  const topFours = boundaryPairs.filter((p) => p.fours > 0).sort((a, b) => b.fours - a.fours).slice(0, 6);
  const topBoundaries = boundaryPairs
    .map((p) => ({ ...p, total: p.sixes + p.fours }))
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
  const hasRivalries = h2h.length > 0 || boundaryPairs.length > 0;

  const hasData = filteredMatches.length > 0 && aggs.size > 0;

  return (
    <PublicShell>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
          Leaderboards
        </h1>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip href="/stats" label="All-time" active={!selected} />
          {months.slice(0, 6).map((m) => (
            <FilterChip key={m} href={`/stats?month=${m}`} label={monthLabel(m)} active={selected === m} />
          ))}
        </div>
      </div>

      {!hasData ? (
        <EmptyState title="No stats yet" subtitle="Stats appear once matches are completed." icon="🏆" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Leaderboard
            title="Orange Cap — Most Runs"
            emoji="🧡"
            players={players}
            accent="text-[#E07A1F]"
            rows={board(aggs, (a) => a.runs, (a) => `${a.runs}`, {
              sub: (a) => `${matchesPlayed(a)} M · HS ${a.highScore}`,
            })}
          />
          <Leaderboard
            title="Purple Cap — Most Wickets"
            emoji="💜"
            players={players}
            accent="text-[#7C3AED]"
            rows={board(aggs, (a) => a.wickets, (a) => `${a.wickets}`, {
              sub: (a) => `Best ${bestFigures(a)}`,
            })}
          />
          <Leaderboard
            title="Highest Score"
            emoji="🔥"
            players={players}
            rows={board(aggs, (a) => a.highScore, (a) => `${a.highScore}`)}
          />
          <Leaderboard
            title="Best Bowling"
            emoji="🎯"
            players={players}
            rows={[...aggs.values()]
              .filter((a) => a.bestWk > 0)
              .sort((x, y) => y.bestWk - x.bestWk || x.bestRuns - y.bestRuns)
              .slice(0, 8)
              .map((a) => ({ playerId: a.playerId, value: bestFigures(a) }))}
          />
          <Leaderboard
            title="Most Sixes"
            emoji="6️⃣"
            players={players}
            accent="text-boundary"
            rows={board(aggs, (a) => a.sixes, (a) => `${a.sixes}`)}
          />
          <Leaderboard
            title="Most Fours"
            emoji="4️⃣"
            players={players}
            accent="text-boundary"
            rows={board(aggs, (a) => a.fours, (a) => `${a.fours}`)}
          />
          <Leaderboard
            title="Best Strike Rate"
            emoji="⚡"
            players={players}
            rows={board(aggs, playerStrikeRate, (a) => fmt1(playerStrikeRate(a)), {
              min: (a) => a.balls >= 20,
              sub: (a) => `${a.runs} runs (${a.balls}b)`,
            })}
          />
          <Leaderboard
            title="Best Economy"
            emoji="🪙"
            players={players}
            rows={board(aggs, playerEconomy, (a) => fmt2(playerEconomy(a)), {
              min: (a) => a.ballsBowled >= 12,
              asc: true,
              sub: (a) => `${a.wickets} wkts`,
            })}
          />
          <Leaderboard
            title="Batting Average"
            emoji="📊"
            players={players}
            rows={board(aggs, battingAverage, (a) => fmt1(battingAverage(a)), {
              min: (a) => a.inningsBatted >= 2,
            })}
          />
          <Leaderboard
            title="Most Catches"
            emoji="🧤"
            players={players}
            rows={board(aggs, (a) => a.catches, (a) => `${a.catches}`)}
          />
          <Leaderboard
            title="Most Run-outs"
            emoji="🏃"
            players={players}
            rows={board(aggs, (a) => a.runOuts, (a) => `${a.runOuts}`)}
          />
          <Leaderboard
            title="Most Maidens"
            emoji="🛡️"
            players={players}
            rows={board(aggs, (a) => a.maidens, (a) => `${a.maidens}`)}
          />
          <Leaderboard
            title="Most Wins"
            emoji="🏅"
            players={players}
            rows={board(aggs, (a) => a.wins, (a) => `${a.wins}`, {
              sub: (a) => `${matchesPlayed(a)} played`,
            })}
          />
          <Leaderboard
            title="Most Fifties"
            emoji="5️⃣0️⃣"
            players={players}
            rows={board(aggs, (a) => a.fifties + a.hundreds, (a) => `${a.fifties + a.hundreds}`)}
          />
          <Leaderboard
            title="Most Matches"
            emoji="📅"
            players={players}
            accent="text-ink"
            rows={board(aggs, matchesPlayed, (a) => `${matchesPlayed(a)}`)}
          />
          <Leaderboard
            title="Wall of Shame — Ducks"
            emoji="🦆"
            players={players}
            accent="text-wicket"
            rows={board(aggs, (a) => a.ducks, (a) => `${a.ducks}`)}
          />
          <Leaderboard
            title="Most Aatta Naayakan"
            emoji="🏆"
            players={players}
            accent="text-gold-dark"
            rows={board(aggs, (a) => a.potmAwards, (a) => `${a.potmAwards}`, { sub: () => "player of the match" })}
          />
          <Leaderboard
            title="Most Hat-tricks"
            emoji="🎩"
            players={players}
            rows={board(aggs, (a) => a.hatTricks, (a) => `${a.hatTricks}`)}
          />
          <Leaderboard
            title="Most Catches Dropped"
            emoji="🧤"
            players={players}
            accent="text-wicket"
            rows={board(aggs, (a) => a.catchesDropped, (a) => `${a.catchesDropped}`)}
          />
        </div>
      )}

      {hasData && hasRivalries && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-lg font-bold text-ink">Rivalries 🎯</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <RivalryList
              title="Bunnies — most dismissed"
              rows={h2h.map((r) => ({
                key: `${r.bowlerId}-${r.batsmanId}`,
                a: players.get(r.bowlerId)?.name ?? "?",
                b: players.get(r.batsmanId)?.name ?? "?",
                verb: "dismissed",
                value: `${r.count}×`,
                tone: "text-wicket",
              }))}
            />
            <RivalryList
              title="Most sixes off a bowler"
              rows={topSixes.map((r) => ({
                key: `s-${r.batsmanId}-${r.bowlerId}`,
                a: players.get(r.batsmanId)?.name ?? "?",
                b: players.get(r.bowlerId)?.name ?? "?",
                verb: "off",
                value: `${r.sixes} six${r.sixes === 1 ? "" : "es"}`,
                tone: "text-brand-600",
              }))}
            />
            <RivalryList
              title="Most fours off a bowler"
              rows={topFours.map((r) => ({
                key: `f-${r.batsmanId}-${r.bowlerId}`,
                a: players.get(r.batsmanId)?.name ?? "?",
                b: players.get(r.bowlerId)?.name ?? "?",
                verb: "off",
                value: `${r.fours} four${r.fours === 1 ? "" : "s"}`,
                tone: "text-boundary",
              }))}
            />
            <RivalryList
              title="Most boundaries off a bowler"
              rows={topBoundaries.map((r) => ({
                key: `b-${r.batsmanId}-${r.bowlerId}`,
                a: players.get(r.batsmanId)?.name ?? "?",
                b: players.get(r.bowlerId)?.name ?? "?",
                verb: "off",
                value: `${r.total} boundar${r.total === 1 ? "y" : "ies"}`,
                tone: "text-ink",
              }))}
            />
          </div>
        </section>
      )}
    </PublicShell>
  );
}

function RivalryList({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; a: string; b: string; verb: string; value: string; tone: string }[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="sg-card p-3">
      <p className="mb-1 px-1 text-xs font-bold uppercase tracking-wide text-ink-faint">{title}</p>
      <div className="divide-y divide-line">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-2 px-1 py-2.5 text-sm">
            <span className="min-w-0 truncate text-ink">
              <b>{r.a}</b> {r.verb} <b>{r.b}</b>
            </span>
            <span className={`shrink-0 font-mono text-xs font-bold ${r.tone}`}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active ? "bg-brand text-brand-900 shadow-glow" : "bg-cream-200 border border-line text-ink-soft hover:bg-cream-200"
      }`}
    >
      {label}
    </Link>
  );
}
