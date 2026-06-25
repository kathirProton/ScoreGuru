import { ensureAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { PlayersAdmin } from "@/components/admin/PlayersAdmin";
import { getPlayers } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminPlayersPage() {
  await ensureAdmin();
  const [pending, roster] = await Promise.all([
    getPlayers(["pending"]),
    getPlayers(["approved", "hidden"]),
  ]);
  return (
    <AdminShell>
      <PlayersAdmin pending={pending} roster={roster} />
    </AdminShell>
  );
}
