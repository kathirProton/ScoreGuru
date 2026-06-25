"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Pill } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { PlayerForm } from "@/components/PlayerForm";
import { approvePlayer, rejectPlayer, deletePlayer, setPlayerStatus } from "@/lib/actions/players";
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

  const run = (fn: () => Promise<unknown>, message?: string) =>
    startTransition(async () => {
      await fn();
      router.refresh();
      if (message) setToast(message);
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
        <h2 className="mb-3 font-display text-lg font-bold text-ink">
          Roster <span className="text-ink-faint">· {roster.length}</span>
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {roster.map((p) => (
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
          ))}
        </div>
      </section>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add player">
        <PlayerForm mode="admin-create" onDone={() => { setCreateOpen(false); setToast("Player created ✓"); }} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit player">
        {editing && <PlayerForm mode="admin-edit" player={editing} onDone={() => { setEditing(null); setToast("Changes saved ✓"); }} />}
      </Modal>

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
