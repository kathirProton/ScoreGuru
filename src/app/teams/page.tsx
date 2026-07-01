import { PublicShell } from "@/components/public/PublicShell";
import { EmptyState } from "@/components/ui/primitives";
import { TeamsExplorer } from "@/components/public/TeamsExplorer";
import { getTeams, getPlayers, getRosterMap } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Teams — Score Guru" };

export default async function TeamsPage() {
  const [teams, players, rosters] = await Promise.all([
    getTeams(),
    getPlayers(["approved", "hidden"]),
    getRosterMap(),
  ]);

  return (
    <PublicShell>
      <h1 className="mb-1 font-display text-2xl font-bold tracking-tight text-ink">
        Teams <span className="text-ink-faint">· {teams.length}</span>
      </h1>
      <p className="mb-5 text-sm text-ink-muted">Tap up to two teams to compare their squads side by side.</p>

      {teams.length === 0 ? (
        <EmptyState title="No teams yet" subtitle="Teams show up here once an admin creates them." icon="🛡️" />
      ) : (
        <TeamsExplorer teams={teams} players={players} rosters={rosters} />
      )}
    </PublicShell>
  );
}
