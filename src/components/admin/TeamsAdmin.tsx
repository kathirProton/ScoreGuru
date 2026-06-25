"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { compressImage } from "@/lib/image";
import { uploadImage } from "@/lib/actions/upload";
import { createTeam, updateTeam, deleteTeam } from "@/lib/actions/teams";
import type { Team } from "@/lib/types";

const COLORS = ["#59C749", "#1E7FD6", "#E23D33", "#D9A300", "#7C3AED", "#16231A", "#E07A1F", "#0EA5A4"];

function TeamForm({ team, onDone }: { team?: Team; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(team?.name ?? "");
  const [color, setColor] = useState(team?.color ?? "#59C749");
  const [logo, setLogo] = useState<string | null>(team?.logo_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage("team-logos", await compressImage(file, 400));
      setLogo(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = { name, color, logo_url: logo };
    const res = team ? await updateTeam(team.id, payload) : await createTeam(payload);
    setBusy(false);
    if (res?.error) return setError(res.error);
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar name={name || "?"} photo={logo} size={64} />
        <label className="sg-btn-ghost cursor-pointer px-4 py-2.5 text-sm">
          {uploading ? "Uploading…" : logo ? "Change logo" : "Add logo"}
          <input type="file" accept="image/*" className="hidden" onChange={handleLogo} disabled={uploading} />
        </label>
      </div>
      <div>
        <label className="sg-label">Team name *</label>
        <input className="sg-input" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className="sg-label">Colour</label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setColor(c)}
              className={`h-9 w-9 rounded-full transition ${color === c ? "ring-2 ring-offset-2 ring-ink" : ""}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      {error && <p className="text-sm font-medium text-wicket">{error}</p>}
      <button disabled={busy || uploading} className="sg-btn-primary w-full py-3">
        {busy ? "Saving…" : team ? "Save" : "Create team"}
      </button>
    </form>
  );
}

export function TeamsAdmin({ teams }: { teams: Team[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteTeam(id);
      if (res?.error) setError(res.error);
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">Teams</h1>
        <button onClick={() => setCreateOpen(true)} className="sg-btn-primary px-4 py-2.5 text-sm">
          + Add Team
        </button>
      </div>
      {error && <p className="mb-4 text-sm font-medium text-wicket">{error}</p>}

      {teams.length === 0 ? (
        <div className="sg-card p-10 text-center text-ink-muted">No teams yet. Create one to start.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {teams.map((t) => (
            <div key={t.id} className="sg-card flex items-center gap-3 p-4">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: t.color ?? "#59C749" }}
              />
              <Avatar name={t.name} photo={t.logo_url} size={44} />
              <span className="min-w-0 flex-1 truncate font-semibold text-ink">{t.name}</span>
              <div className="flex shrink-0 gap-1.5">
                <button onClick={() => setEditing(t)} className="sg-btn-ghost px-2.5 py-1.5 text-xs">
                  Edit
                </button>
                <button
                  disabled={pending}
                  onClick={() => remove(t.id)}
                  className="sg-btn-ghost px-2.5 py-1.5 text-xs text-wicket"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add team">
        <TeamForm onDone={() => setCreateOpen(false)} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit team">
        {editing && <TeamForm team={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </>
  );
}
