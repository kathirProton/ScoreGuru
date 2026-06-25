import Link from "next/link";
import { ensureAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { createReadClient } from "@/lib/supabase/server";
import { Pill, LiveDot, EmptyState, Avatar } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await ensureAdmin();
  const supabase = createReadClient();
  const [{ data: matches }, { data: teams }, { data: pending }] = await Promise.all([
    supabase.from("matches").select("*").order("created_at", { ascending: false }),
    supabase.from("teams").select("*"),
    supabase.from("players").select("id").eq("status", "pending"),
  ]);
  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
  const nameOf = (id: string | null) => (id ? teamById.get(id)?.name ?? "—" : "—");

  const inProgress = (matches ?? []).filter((m) =>
    ["setup", "live", "innings_break", "super_over"].includes(m.status)
  );
  const finished = (matches ?? []).filter((m) =>
    ["completed", "abandoned"].includes(m.status)
  );

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-ink">Dashboard</h1>
        <Link href="/admin/matches/new" className="sg-btn-primary px-4 py-2.5 text-sm">
          + New Match
        </Link>
      </div>

      {pending && pending.length > 0 && (
        <Link
          href="/admin/players"
          className="mb-6 flex items-center justify-between rounded-2xl border border-gold/30 bg-gold-soft p-4 transition hover:shadow-card"
        >
          <span className="font-medium text-gold-dark">
            🛎️ {pending.length} player submission{pending.length === 1 ? "" : "s"} awaiting approval
          </span>
          <span className="text-sm font-semibold text-gold-dark">Review →</span>
        </Link>
      )}

      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg font-bold text-ink">In progress</h2>
        {inProgress.length === 0 ? (
          <EmptyState title="No active matches" subtitle="Create a new match to start scoring." icon="🏏" />
        ) : (
          <div className="space-y-3">
            {inProgress.map((m) => (
              <div key={m.id} className="sg-card flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-semibold text-ink">
                      {nameOf(m.team_a_id)} vs {nameOf(m.team_b_id)}
                    </span>
                    {m.status === "setup" ? (
                      <Pill tone="neutral">Setup</Pill>
                    ) : m.status === "innings_break" ? (
                      <Pill tone="gold">Break</Pill>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-wicket">
                        <LiveDot /> LIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-muted">
                    {m.overs} overs · {formatDate(m.match_date)}
                  </p>
                </div>
                <Link href={`/admin/matches/${m.id}/score`} className="sg-btn-primary shrink-0 px-4 py-2.5 text-sm">
                  {m.status === "setup" ? "Set up" : "Score"}
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-ink">Completed</h2>
        {finished.length === 0 ? (
          <p className="text-sm text-ink-muted">No completed matches yet.</p>
        ) : (
          <div className="space-y-3">
            {finished.map((m) => (
              <div key={m.id} className="sg-card flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <span className="font-display font-semibold text-ink">
                    {nameOf(m.team_a_id)} vs {nameOf(m.team_b_id)}
                  </span>
                  <p className="truncate text-xs text-ink-muted">
                    {m.result_text || "—"} · {formatDate(m.match_date)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link href={`/matches/${m.id}`} className="sg-btn-ghost px-3 py-2 text-sm">
                    View
                  </Link>
                  <Link href={`/admin/matches/${m.id}/edit`} className="sg-btn-ghost px-3 py-2 text-sm">
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
