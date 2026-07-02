"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { PlayerForm } from "@/components/PlayerForm";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { checkPlayerPassword } from "@/lib/actions/players";
import type { Player } from "@/lib/types";

/**
 * Public, password-gated self edit. The player taps "Edit my details", enters
 * their password (default Test@123), and — if it matches — can update their
 * photo, batting/bowling style, jersey and password. `player` arrives with its
 * password blanked out, so the real one never reaches the browser.
 */
export function PlayerSelfEdit({ player }: { player: Player }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [authPassword, setAuthPassword] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setOpen(false); setPassword(""); setAuthPassword(null); setError(null); };

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await checkPlayerPassword(player.id, password);
    setBusy(false);
    if (res.ok) setAuthPassword(password);
    else setError("Incorrect password. Ask the admin if you've forgotten it.");
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="sg-btn-ghost shrink-0 px-3 py-2 text-sm">
        ✎ Edit
      </button>
      <Modal open={open} onClose={reset} title={authPassword ? "Edit your details" : "Verify it's you"}>
        {authPassword ? (
          <PlayerForm
            mode="self-edit"
            player={player}
            authPassword={authPassword}
            onDone={() => { reset(); router.refresh(); }}
          />
        ) : (
          <form onSubmit={unlock} className="space-y-4">
            <p className="text-sm text-ink-soft">
              Enter your edit password to change your photo and details.
            </p>
            <PasswordInput value={password} onChange={setPassword} autoFocus placeholder="Edit password" />
            {error && <p className="text-sm font-medium text-wicket">{error}</p>}
            <button type="submit" disabled={busy || !password} className="sg-btn-primary w-full py-3">
              {busy ? "Checking…" : "Unlock"}
            </button>
          </form>
        )}
      </Modal>
    </>
  );
}
