"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateMatchDetails, deleteMatch } from "@/lib/actions/matches";
import { Modal } from "@/components/ui/Modal";
import type { Match } from "@/lib/types";

export function EditMatchForm({ match }: { match: Match }) {
  const router = useRouter();
  const [name, setName] = useState(match.name ?? "");
  const [venue, setVenue] = useState(match.venue ?? "");
  const [date, setDate] = useState(match.match_date.slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await updateMatchDetails(match.id, {
      name: name || null,
      venue: venue || null,
      match_date: new Date(date).toISOString(),
    });
    setBusy(false);
    if (res?.error) return setError(res.error);
    setMsg("Saved.");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <form onSubmit={save} className="sg-card space-y-4 p-5">
        <p className="text-sm text-ink-muted">
          Scores and stats are locked. You can only edit match details.
        </p>
        <div>
          <label className="sg-label">Match name</label>
          <input className="sg-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="sg-label">Venue</label>
          <input className="sg-input" value={venue} onChange={(e) => setVenue(e.target.value)} />
        </div>
        <div>
          <label className="sg-label">Date</label>
          <input className="sg-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {error && <p className="text-sm font-medium text-wicket">{error}</p>}
        {msg && <p className="text-sm font-medium text-brand-600">{msg}</p>}
        <button disabled={busy} className="sg-btn-primary w-full py-3">{busy ? "Saving…" : "Save details"}</button>
      </form>

      <button onClick={() => setConfirmDelete(true)} className="sg-btn-ghost w-full py-3 text-wicket">
        Delete this match
      </button>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete match?">
        <p className="mb-4 text-sm text-ink-soft">
          This permanently deletes the match and all its deliveries. Stats will be recomputed without it. This cannot be undone.
        </p>
        <div className="flex gap-2">
          <button onClick={() => setConfirmDelete(false)} className="sg-btn-ghost flex-1 py-2.5">Cancel</button>
          <button
            onClick={async () => {
              await deleteMatch(match.id);
              router.push("/admin");
            }}
            className="sg-btn-danger flex-1 py-2.5"
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
