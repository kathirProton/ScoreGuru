import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { Avatar, EmptyState } from "@/components/ui/primitives";
import { getPlayers, getStatsBundle } from "@/lib/data";
import { aggregatePlayers, matchesPlayed } from "@/lib/cricket/stats";
import { roleLabel } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Players — Score Guru" };

export default async function PlayersPage() {
  const [players, bundle] = await Promise.all([getPlayers(["approved"]), getStatsBundle()]);
  const aggs = aggregatePlayers(bundle);

  return (
    <PublicShell>
      <h1 className="mb-5 font-display text-2xl font-bold tracking-tight text-ink">
        Players <span className="text-ink-faint">· {players.length}</span>
      </h1>

      {players.length === 0 ? (
        <EmptyState title="No players yet" subtitle="Submit one to get started." icon="🧢" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((p) => {
            const a = aggs.get(p.id);
            return (
              <Link
                key={p.id}
                href={`/players/${p.id}`}
                className="sg-card flex items-center gap-3.5 p-4 transition hover:shadow-lift active:scale-[0.99]"
              >
                <Avatar name={p.name} photo={p.photo_url} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-display font-semibold text-ink">
                      {p.nickname || p.name}
                    </p>
                    {p.jersey_number != null && (
                      <span className="text-xs font-medium text-ink-faint">#{p.jersey_number}</span>
                    )}
                  </div>
                  <p className="truncate text-xs text-ink-muted">{roleLabel(p.role)}</p>
                  <div className="mt-1.5 flex gap-3 text-xs tabular-nums text-ink-soft">
                    <span>{a ? matchesPlayed(a) : 0} M</span>
                    <span>{a?.runs ?? 0} runs</span>
                    <span>{a?.wickets ?? 0} wkts</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PublicShell>
  );
}
