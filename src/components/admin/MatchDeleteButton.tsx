"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { deleteMatch } from "@/lib/actions/matches";
import type { MatchStatus } from "@/lib/types";

export function MatchDeleteButton({
  matchId,
  label,
  status,
}: {
  matchId: string;
  label: string;
  /** Drives the warning copy — a half-scored match is a costlier delete than a
   *  match that never got past setup. */
  status?: MatchStatus;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const scored = status === "live" || status === "innings_break" || status === "super_over";

  return (
    <>
      <button onClick={() => setOpen(true)} className="sg-btn-ghost px-3 py-2 text-sm text-wicket">
        Delete
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Delete match?">
        <p className="mb-4 text-sm text-ink-soft">
          {status === "setup" ? (
            <>
              Permanently deletes <b>{label}</b>. It was never scored, so no stats change. This cannot be undone.
            </>
          ) : scored ? (
            <>
              <b>{label}</b> is still in progress. Deleting it throws away every ball scored so far. This cannot be
              undone.
            </>
          ) : (
            <>
              Permanently deletes <b>{label}</b> and all its deliveries. Stats will be recomputed without it. This
              cannot be undone.
            </>
          )}
        </p>
        <div className="flex gap-2">
          <button onClick={() => setOpen(false)} className="sg-btn-ghost flex-1 py-2.5">Cancel</button>
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await deleteMatch(matchId);
                setOpen(false);
                setToast("Match deleted");
                router.refresh();
              })
            }
            className="sg-btn-danger flex-1 py-2.5"
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </Modal>
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
