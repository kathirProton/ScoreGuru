"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { compressImage } from "@/lib/image";
import { uploadImage } from "@/lib/actions/upload";
import { createTeam, updateTeam, deleteTeam, setTeamRoster } from "@/lib/actions/teams";
import type { Team, Player } from "@/lib/types";

const COLORS = ["#2BEE34", "#59C749", "#1E7FD6", "#E23D33", "#D9A300", "#7C3AED", "#E07A1F", "#0EA5A4"];

function TeamForm({
  team,
  players,
  initialRoster,
  onDone,
}: {
  team?: Team;
  players: Player[];
  initialRoster: string[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(team?.name ?? "");
  const [color, setColor] = useState(team?.color ?? "#2BEE34");
  const [logo, setLogo] = useState<string | null>(team?.logo_url ?? null);
  const [roster, setRoster] = useState<Set<string>>(new Set(initialRoster));
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) => {
    const next = new Set(roster);
    next.has(id) ? next.delete(id) : next.add(id);
    setRoster(next);
  };

  const filtered = players.filter((p) =>
    (p.nickname || p.name).toLowerCase().includes(query.trim().toLowerCase())
  );

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
    if (res?.error) { setBusy(false); return setError(res.error); }
    const teamId = team?.id ?? (res as { teamId?: string }).teamId;
    if (teamId) {
      const rosterRes = await setTeamRoster(teamId, [...roster]);
      if (rosterRes?.error) { setBusy(false); return setError(rosterRes.error); }
    }
    setBusy(false);
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar name={name || "?"} photo={logo} size={64} />
        <label className="sg-btn-ghost cursor-pointer px-4 py-2.5 text-sm">
          {uploading ? "Uploading…" : logo ? "Change photo" : "Add photo"}
          <input type="file" accept="image/*" className="hidden" onChange={handleLogo} disabled={uploading} />
        </label>
      </div>
      <div>
        <label className="sg-label">Team name *</label>
        <input className="sg-input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} />
      </div>
      <div>
        <label className="sg-label">Colour</label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setColor(c)}
              className={`h-9 w-9 rounded-full transition ${color === c ? "ring-2 ring-offset-2 ring-offset-cream ring-ink" : ""}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="sg-label">Roster · {roster.size} player{roster.size === 1 ? "" : "s"}</label>
        <input
          className="sg-input mb-2"
          placeholder="Search players…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="max-h-60 space-y-1 overflow-y-auto pr-1">
          {filtered.length === 0 && <p className="px-1 py-4 text-center text-sm text-ink-muted">No players match.</p>}
          {filtered.map((p) => {
            const sel = roster.has(p.id);
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => toggle(p.id)}
                className={`flex w-full items-center gap-2.5 rounded-xl border p-2 text-left transition ${
                  sel ? "border-brand bg-brand-50" : "border-line bg-cream-200"
                }`}
              >
                <Avatar name={p.name} photo={p.photo_url} size={32} />
                <span className="flex-1 truncate text-sm text-ink">{p.nickname || p.name}</span>
                {sel && <span className="text-brand-600">✓</span>}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-ink-muted">A player can be on more than one team.</p>
      </div>

      {error && <p className="text-sm font-medium text-wicket">{error}</p>}
      <button disabled={busy || uploading} className="sg-btn-primary w-full py-3">
        {busy ? "Saving…" : team ? "Save team" : "Create team"}
      </button>
    </form>
  );
}

export function TeamsAdmin({
  teams,
  players,
  rosters,
}: {
  teams: Team[];
  players: Player[];
  rosters: Record<string, string[]>;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const playerById = new Map(players.map((p) => [p.id, p]));

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
          {teams.map((t) => {
            const roster = (rosters[t.id] ?? []).map((id) => playerById.get(id)).filter(Boolean) as Player[];
            return (
              <div key={t.id} className="sg-card p-4">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: t.color ?? "#2BEE34" }} />
                  <Avatar name={t.name} photo={t.logo_url} size={44} />
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink">{t.name}</span>
                  <div className="flex shrink-0 gap-1.5">
                    <button onClick={() => setEditing(t)} className="sg-btn-ghost px-2.5 py-1.5 text-xs">Edit</button>
                    <button disabled={pending} onClick={() => remove(t.id)} className="sg-btn-ghost px-2.5 py-1.5 text-xs text-wicket">Delete</button>
                  </div>
                </div>
                <p className="mt-3 text-xs font-medium text-ink-muted">
                  {roster.length} player{roster.length === 1 ? "" : "s"}
                </p>
                {roster.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {roster.slice(0, 8).map((p) => (
                      <span key={p.id} className="rounded-full bg-cream-200 px-2 py-0.5 text-xs text-ink-soft">
                        {p.nickname || p.name}
                      </span>
                    ))}
                    {roster.length > 8 && <span className="text-xs text-ink-muted">+{roster.length - 8}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add team">
        <TeamForm players={players} initialRoster={[]} onDone={() => setCreateOpen(false)} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit team">
        {editing && (
          <TeamForm team={editing} players={players} initialRoster={rosters[editing.id] ?? []} onDone={() => setEditing(null)} />
        )}
      </Modal>
    </>
  );
}
