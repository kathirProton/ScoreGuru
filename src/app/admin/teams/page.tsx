import { ensureAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { TeamsAdmin } from "@/components/admin/TeamsAdmin";
import { getTeams, getPlayers, getRosterMap } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminTeamsPage() {
  await ensureAdmin();
  const [teams, players, rosters] = await Promise.all([
    getTeams(true),
    getPlayers(["approved"]),
    getRosterMap(),
  ]);
  return (
    <AdminShell>
      <TeamsAdmin teams={teams} players={players} rosters={rosters} />
    </AdminShell>
  );
}
