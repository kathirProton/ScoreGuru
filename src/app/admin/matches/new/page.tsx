import Link from "next/link";
import { ensureAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { NewMatchForm } from "@/components/admin/NewMatchForm";
import { createReadClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewMatchPage() {
  await ensureAdmin();
  const supabase = createReadClient();
  const [{ data: teams }, { data: players }] = await Promise.all([
    supabase.from("teams").select("*").order("name"),
    supabase.from("players").select("*").eq("status", "approved").order("name"),
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
      <h1 className="mb-5 font-display text-2xl font-bold text-ink">New match</h1>
      <NewMatchForm teams={teams} players={players ?? []} />
    </AdminShell>
  );
}
