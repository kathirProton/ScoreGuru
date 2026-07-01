"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Pill } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { PlayerForm } from "@/components/PlayerForm";
import { approvePlayer, rejectPlayer, deletePlayer, deletePlayers, setPlayerStatus } from "@/lib/actions/players";
import type { Player } from "@/lib/types";

export function PlayersAdmin({
  pending,
  roster,
}: {
  pending: Player[];
  roster: Player[];
}) {
  const router = useRouter();
  const [pendingAction, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // multi-select delete
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const run = (fn: () => Promise<unknown>, message?: string) =>
    startTransition(async () => {
      await fn();
      router.refresh();
      if (message) setToast(message);
    });

  const toggleSel = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };

  const bulkDelete = () =>
    startTransition(async () => {
      const ids = [...selected];
      const res = await deletePlayers(ids);
      setConfirmOpen(false);
      exitSelect();
      router.refresh();
      if (res && "error" in res && res.error) setToast(res.error);
      else if (res && "ok" in res) {
        const parts = [];
        if (res.deleted) parts.push(`${res.deleted} deleted`);
        if (res.hidden) parts.push(`${res.hidden} hidden (had match history)`);
        setToast(parts.length ? parts.join(" · ") : "Done");
      }
    });

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">Players</h1>
        <button onClick={() => setCreateOpen(true)} className="sg-btn-primary px-4 py-2.5 text-sm">
          + Add Player
        </button>
      </div>

      {/* Pending queue */}
      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-ink">
            Pending <Pill tone="gold">{pending.length}</Pill>
          </h2>
          <div className="space-y-3">
            {pending.map((p) => (
              <div key={p.id} className="sg-card flex items-center gap-3 p-4">
                <Avatar name={p.name} photo={p.photo_url} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{p.name}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {[p.nickname && `“${p.nickname}”`, p.batting_style, p.bowling_style]
                      .filter(Boolean)
                      .join(" · ") || "No details"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    disabled={pendingAction}
                    onClick={() => run(() => approvePlayer(p.id), `${p.name} approved ✓`)}
                    className="sg-btn-primary px-3 py-2 text-sm"
                  >
                    Approve
                  </button>
                  <button
                    disabled={pendingAction}
                    onClick={() => run(() => rejectPlayer(p.id), "Submission rejected")}
                    className="sg-btn-ghost px-3 py-2 text-sm text-wicket"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Roster */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-ink">
            Roster <span className="text-ink-faint">· {roster.length}</span>
          </h2>
          {roster.length > 0 &&
            (selectMode ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelected((prev) => (prev.size === roster.length ? new Set() : new Set(roster.map((p) => p.id))))}
                  className="text-xs font-medium text-ink-soft hover:text-ink"
                >
                  {selected.size === roster.length ? "Clear" : "Select all"}
                </button>
                <button onClick={exitSelect} className="sg-btn-ghost px-3 py-1.5 text-xs">Cancel</button>
                <button
                  disabled={pendingAction || selected.size === 0}
                  onClick={() => setConfirmOpen(true)}
                  className="sg-btn-danger px-3 py-1.5 text-xs"
                >
                  Delete ({selected.size})
                </button>
              </div>
            ) : (
              <button onClick={() => setSelectMode(true)} className="sg-btn-ghost px-3 py-1.5 text-xs">
                Select
              </button>
            ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {roster.map((p) => {
            const isSel = selected.has(p.id);
            if (selectMode) {
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleSel(p.id)}
                  className={`sg-card flex items-center gap-3 p-3.5 text-left transition active:scale-[0.99] ${
                    isSel ? "ring-2 ring-brand" : ""
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                      isSel ? "border-brand bg-brand text-brand-900" : "border-line text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <Avatar name={p.name} photo={p.photo_url} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-ink">{p.name}</p>
                      {p.status === "hidden" && <Pill tone="neutral">Hidden</Pill>}
                    </div>
                    <p className="truncate text-xs text-ink-muted">{p.bowling_style || "—"}</p>
                  </div>
                </button>
              );
            }
            return (
              <div key={p.id} className="sg-card flex items-center gap-3 p-3.5">
                <Avatar name={p.name} photo={p.photo_url} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-ink">{p.name}</p>
                    {p.status === "hidden" && <Pill tone="neutral">Hidden</Pill>}
                  </div>
                  <p className="truncate text-xs text-ink-muted">{p.bowling_style || "—"}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button onClick={() => setEditing(p)} className="sg-btn-ghost px-2.5 py-1.5 text-xs">
                    Edit
                  </button>
                  {p.status !== "hidden" ? (
                    <button
                      disabled={pendingAction}
                      onClick={() => run(() => deletePlayer(p.id), "Player removed")}
                      className="sg-btn-ghost px-2.5 py-1.5 text-xs text-wicket"
                      title="Delete (or hide if they have match history)"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      disabled={pendingAction}
                      onClick={() => run(() => setPlayerStatus(p.id, "approved"), "Player unhidden")}
                      className="sg-btn-ghost px-2.5 py-1.5 text-xs"
                    >
                      Unhide
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add player">
        <PlayerForm mode="admin-create" onDone={() => { setCreateOpen(false); setToast("Player created ✓"); }} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit player">
        {editing && <PlayerForm mode="admin-edit" player={editing} onDone={() => { setEditing(null); setToast("Changes saved ✓"); }} />}
      </Modal>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={`Delete ${selected.size} player${selected.size === 1 ? "" : "s"}?`}>
        <p className="mb-4 text-sm text-ink-soft">
          Selected players with no match history are permanently deleted. Any who have played are hidden instead, so their scorecards and stats stay intact.
        </p>
        <div className="flex gap-2">
          <button onClick={() => setConfirmOpen(false)} className="sg-btn-ghost flex-1 py-2.5">Cancel</button>
          <button disabled={pendingAction} onClick={bulkDelete} className="sg-btn-danger flex-1 py-2.5">
            Delete {selected.size}
          </button>
        </div>
      </Modal>

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
