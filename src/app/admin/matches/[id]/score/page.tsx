import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { TossPanel } from "@/components/admin/TossPanel";
import { ScoringConsole } from "@/components/admin/ScoringConsole";
import { getMatchBundle } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ScorePage({ params }: { params: { id: string } }) {
  await ensureAdmin();
  const bundle = await getMatchBundle(params.id);
  if (!bundle) notFound();

  const teamA = bundle.teams.find((t) => t.id === bundle.match.team_a_id);
  const teamB = bundle.teams.find((t) => t.id === bundle.match.team_b_id);

  return (
    <AdminShell>
      <div className="mb-4 flex items-center justify-between">
        <Link href="/admin" className="text-sm text-ink-muted hover:text-ink">← Dashboard</Link>
        <div className="flex items-center gap-4">
          <Link href={`/admin/matches/${params.id}/lineups`} className="text-sm font-medium text-ink-soft hover:text-ink">
            Edit lineups
          </Link>
          <Link href={`/matches/${params.id}`} className="text-sm font-medium text-brand-600">Public view ↗</Link>
        </div>
      </div>
      {bundle.match.status === "setup" && teamA && teamB ? (
        <TossPanel matchId={params.id} teamA={teamA} teamB={teamB} />
      ) : (
        <ScoringConsole initial={bundle} />
      )}
    </AdminShell>
  );
}
