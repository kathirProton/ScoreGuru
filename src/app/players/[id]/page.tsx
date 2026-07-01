import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/PublicShell";
import { Avatar, Pill, SectionTitle, EmptyState } from "@/components/ui/primitives";
import { getPlayer, getStatsBundle, getMatchView } from "@/lib/data";
import {
  aggregatePlayers,
  battingAverage,
  playerStrikeRate,
  playerEconomy,
  bestFigures,
  matchesPlayed,
  winPct,
} from "@/lib/cricket/stats";
import { fmt1, fmt2 } from "@/lib/format";
import { MatchCard } from "@/components/public/MatchCard";

export const dynamic = "force-dynamic";

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl bg-cream-200/60 border border-line p-3 text-center">
      <div className={`font-display text-xl font-bold tabular-nums ${tone ?? "text-ink"}`}>{value}</div>
      <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">{label}</div>
    </div>
  );
}

export default async function PlayerProfile({ params }: { params: { id: string } }) {
  const player = await getPlayer(params.id);
  if (!player) notFound();
  const bundle = await getStatsBundle();
  const aggs = aggregatePlayers(bundle);
  const a = aggs.get(player.id);

  const myMatchIds = bundle.matchPlayers
    .filter((mp) => mp.player_id === player.id)
    .map((mp) => mp.match_id);
  const recent = (
    await Promise.all([...new Set(myMatchIds)].slice(0, 6).map((id) => getMatchView(id)))
  ).filter(Boolean);

  return (
    <PublicShell>
      <div className="sg-card flex items-center gap-4 p-5">
        <Avatar name={player.name} photo={player.photo_url} size={76} ring />
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{player.name}</h1>
          {player.nickname && <p className="text-ink-soft">“{player.nickname}”</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            {player.jersey_number != null && <Pill tone="brand">#{player.jersey_number}</Pill>}
            {player.batting_style && <Pill>{player.batting_style === "right" ? "RHB" : "LHB"}</Pill>}
            {player.bowling_style && <Pill>{player.bowling_style}</Pill>}
          </div>
        </div>
      </div>

      <SectionTitle>
        <span className="mt-6 block">Batting</span>
      </SectionTitle>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        <Stat label="Matches" value={a ? matchesPlayed(a) : 0} />
        <Stat label="Runs" value={a?.runs ?? 0} tone="text-brand-600" />
        <Stat label="High" value={a?.highScore ?? 0} />
        <Stat label="Avg" value={a ? fmt1(battingAverage(a)) : "—"} />
        <Stat label="SR" value={a ? fmt1(playerStrikeRate(a)) : "—"} />
        <Stat label="50/100" value={`${a?.fifties ?? 0}/${a?.hundreds ?? 0}`} />
        <Stat label="Fours" value={a?.fours ?? 0} />
        <Stat label="Sixes" value={a?.sixes ?? 0} tone="text-boundary" />
        <Stat label="Ducks" value={a?.ducks ?? 0} tone="text-wicket" />
        <Stat label="Wins" value={a?.wins ?? 0} />
        <Stat label="Win %" value={a ? fmt1(winPct(a)) : "—"} />
        <Stat label="Balls" value={a?.balls ?? 0} />
      </div>

      <SectionTitle>
        <span className="mt-6 block">Bowling & Fielding</span>
      </SectionTitle>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        <Stat label="Wickets" value={a?.wickets ?? 0} tone="text-brand-600" />
        <Stat label="Best" value={a ? bestFigures(a) : "—"} />
        <Stat label="Econ" value={a && a.ballsBowled > 0 ? fmt2(playerEconomy(a)) : "—"} />
        <Stat label="Maidens" value={a?.maidens ?? 0} />
        <Stat label="Catches" value={a?.catches ?? 0} />
        <Stat label="Run-outs" value={a?.runOuts ?? 0} />
      </div>

      <div className="mt-8">
        <SectionTitle>Recent matches</SectionTitle>
        {recent.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {recent.map((v) => v && <MatchCard key={v.match.id} view={v} />)}
          </div>
        ) : (
          <EmptyState title="No matches yet" subtitle="This player hasn't featured in a completed match." />
        )}
      </div>
    </PublicShell>
  );
}
