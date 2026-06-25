import { ensureAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { TeamsAdmin } from "@/components/admin/TeamsAdmin";
import { createReadClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminTeamsPage() {
  await ensureAdmin();
  const supabase = createReadClient();
  const { data: teams } = await supabase.from("teams").select("*").order("name");
  return (
    <AdminShell>
      <TeamsAdmin teams={teams ?? []} />
    </AdminShell>
  );
}
