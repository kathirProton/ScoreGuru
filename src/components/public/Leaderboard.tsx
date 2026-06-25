import Link from "next/link";
import { Avatar } from "@/components/ui/primitives";
import type { Player } from "@/lib/types";

export interface BoardRow {
  playerId: string;
  value: string;
  sub?: string;
}

export function Leaderboard({
  title,
  emoji,
  rows,
  players,
  accent = "text-brand-600",
}: {
  title: string;
  emoji: string;
  rows: BoardRow[];
  players: Map<string, Player>;
  accent?: string;
}) {
  return (
    <div className="sg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 font-display font-bold text-ink">
        <span>{emoji}</span> {title}
      </h3>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-faint">No data yet</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, i) => {
            const p = players.get(r.playerId);
            if (!p) return null;
            return (
              <li key={r.playerId}>
                <Link
                  href={`/players/${r.playerId}`}
                  className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-cream-200"
                >
                  <span className={`w-5 text-center font-mono text-sm font-bold ${i === 0 ? "text-gold-dark" : "text-ink-faint"}`}>
                    {i + 1}
                  </span>
                  <Avatar name={p.name} photo={p.photo_url} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{p.nickname || p.name}</p>
                    {r.sub && <p className="truncate text-xs text-ink-faint">{r.sub}</p>}
                  </div>
                  <span className={`font-mono font-bold tabular-nums ${accent}`}>{r.value}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
