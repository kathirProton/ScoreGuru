import Link from "next/link";
import { ensureAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { NewMatchForm } from "@/components/admin/NewMatchForm";
import { getTeams, getPlayers, getRosterMap, getMatchConfig } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function NewMatchPage({
  searchParams,
}: {
  searchParams: { from?: string };
}) {
  await ensureAdmin();
  const [teams, players, rosters, initial] = await Promise.all([
    getTeams(),
    getPlayers(["approved"]),
    getRosterMap(),
    searchParams.from ? getMatchConfig(searchParams.from) : Promise.resolve(null),
  ]);

  if (!teams || teams.length < 2) {
    return (
      <AdminShell>
        <h1 className="mb-3 font-display text-2xl font-bold text-ink">New match</h1>
        <div className="sg-card p-8 text-center">
          <p className="text-ink-soft">You need at least two teams first.</p>
          <Link href="/admin/teams" className="sg-btn-primary mt-4 inline-flex px-5 py-2.5">
            Create teams
          </Link>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <h1 className="mb-2 font-display text-2xl font-bold text-ink">New match</h1>
      {initial && (
        <p className="mb-5 flex items-center gap-2 rounded-xl border border-brand/30 bg-brand-50 px-3.5 py-2.5 text-sm text-brand-700">
          <span>↺</span>
          <span>Copied from your last match — tweak the overs or anything else, then create.</span>
        </p>
      )}
      {!initial && <div className="mb-5" />}
      <NewMatchForm teams={teams} players={players ?? []} rosters={rosters} initial={initial ?? undefined} />
    </AdminShell>
  );
}
