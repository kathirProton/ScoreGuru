"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { deleteMatch } from "@/lib/actions/matches";

export function MatchDeleteButton({ matchId, label }: { matchId: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button onClick={() => setOpen(true)} className="sg-btn-ghost px-3 py-2 text-sm text-wicket">
        Delete
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Delete match?">
        <p className="mb-4 text-sm text-ink-soft">
          Permanently deletes <b>{label}</b> and all its deliveries. Stats will be recomputed without it. This cannot be undone.
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
