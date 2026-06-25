import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { EditMatchForm } from "@/components/admin/EditMatchForm";
import { createReadClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EditMatchPage({ params }: { params: { id: string } }) {
  await ensureAdmin();
  const supabase = createReadClient();
  const { data: match } = await supabase.from("matches").select("*").eq("id", params.id).maybeSingle();
  if (!match) notFound();
  return (
    <AdminShell>
      <div className="mb-4">
        <Link href="/admin" className="text-sm text-ink-muted hover:text-ink">← Dashboard</Link>
      </div>
      <h1 className="mb-5 text-center font-display text-2xl font-bold text-ink">Edit match</h1>
      <EditMatchForm match={match} />
    </AdminShell>
  );
}
