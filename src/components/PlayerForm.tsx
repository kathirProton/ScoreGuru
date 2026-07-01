"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { compressImage } from "@/lib/image";
import { uploadPublicPlayerPhoto, uploadImage } from "@/lib/actions/upload";
import { submitPlayer, createPlayer, updatePlayer, updatePlayerSelf } from "@/lib/actions/players";
import { Avatar } from "@/components/ui/primitives";
import { Toast } from "@/components/ui/Toast";
import type { Player } from "@/lib/types";

const BOWLING_STYLES = [
  "Right-arm pace",
  "Right-arm medium",
  "Right-arm off-spin",
  "Right-arm leg-spin",
  "Left-arm pace",
  "Left-arm medium",
  "Left-arm orthodox spin",
  "Left-arm wrist spin",
  "Doesn't bowl",
];

type Mode = "public" | "admin-create" | "admin-edit" | "self-edit";

export function PlayerForm({
  mode,
  player,
  onDone,
  authPassword,
}: {
  mode: Mode;
  player?: Player;
  onDone?: () => void;
  /** For self-edit: the player's password already verified at the gate. */
  authPassword?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(player?.name ?? "");
  const [jersey, setJersey] = useState(player?.jersey_number?.toString() ?? "");
  const [batting, setBatting] = useState(player?.batting_style ?? "");
  const [bowling, setBowling] = useState(player?.bowling_style ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(player?.photo_url ?? null);
  // Password field: prefilled with the current one only when an admin is editing.
  const [password, setPassword] = useState(mode === "admin-edit" ? player?.edit_password ?? "" : "");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const publicUpload = mode === "public" || mode === "self-edit";

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const dataUrl = await compressImage(file);
      const url = publicUpload
        ? await uploadPublicPlayerPhoto(dataUrl)
        : await uploadImage("player-photos", dataUrl);
      setPhotoUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = {
      name,
      jersey_number: jersey ? parseInt(jersey, 10) : null,
      batting_style: (batting || null) as Player["batting_style"],
      bowling_style: bowling || null,
      photo_url: photoUrl,
      edit_password: password || null,
    };
    const res =
      mode === "public"
        ? await submitPlayer(payload)
        : mode === "admin-create"
        ? await createPlayer(payload)
        : mode === "self-edit"
        ? await updatePlayerSelf(player!.id, authPassword ?? "", payload)
        : await updatePlayer(player!.id, payload);
    setBusy(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    if (mode === "public") {
      setToast("Sent for approval ✓");
      setDone(true);
      setName(""); setJersey(""); setBatting(""); setBowling(""); setPhotoUrl(null); setPassword("");
    } else {
      router.refresh();
      onDone?.();
    }
  }

  if (done && mode === "public") {
    return (
      <>
        <div className="sg-card p-7 text-center">
          <div className="text-4xl">📨</div>
          <h3 className="mt-3 font-display text-xl font-bold text-ink">Sent for approval</h3>
          <p className="mt-1 text-ink-soft">
            Your player is in the queue — the admin will approve them shortly. Keep your
            edit password safe; you&apos;ll need it to update your details later.
          </p>
          <button onClick={() => setDone(false)} className="sg-btn-ghost mt-5 px-5 py-2.5">
            Add another
          </button>
        </div>
        <Toast message={toast} onDone={() => setToast(null)} />
      </>
    );
  }

  const passwordLabel =
    mode === "self-edit"
      ? "New password (leave blank to keep)"
      : mode === "admin-edit"
      ? "Edit password (share with the player)"
      : "Edit password *";
  const passwordHint =
    mode === "public"
      ? "You'll use this to edit your own details later."
      : mode === "admin-create"
      ? "Defaults to Test@123 if left blank."
      : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar name={name || "?"} photo={photoUrl} size={64} />
        <label className="sg-btn-ghost cursor-pointer px-4 py-2.5 text-sm">
          {uploading ? "Uploading…" : photoUrl ? "Change photo" : "Add photo"}
          <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} disabled={uploading} />
        </label>
      </div>

      <div>
        <label className="sg-label">Name *</label>
        <input className="sg-input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} placeholder="Full name (unique)" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="sg-label">Jersey #</label>
          <input className="sg-input" type="number" inputMode="numeric" value={jersey} onChange={(e) => setJersey(e.target.value)} placeholder="—" />
        </div>
        <div>
          <label className="sg-label">Batting</label>
          <select className="sg-input" value={batting} onChange={(e) => setBatting(e.target.value)}>
            <option value="">—</option>
            <option value="right">Right-hand</option>
            <option value="left">Left-hand</option>
          </select>
        </div>
      </div>

      <div>
        <label className="sg-label">Bowling</label>
        <select className="sg-input" value={bowling} onChange={(e) => setBowling(e.target.value)}>
          <option value="">—</option>
          {BOWLING_STYLES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="sg-label">{passwordLabel}</label>
        <input
          className="sg-input"
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required={mode === "public"}
          maxLength={40}
          placeholder={mode === "self-edit" ? "••••••" : "e.g. Test@123"}
        />
        {passwordHint && <p className="mt-1 text-xs text-ink-muted">{passwordHint}</p>}
      </div>

      {error && <p className="text-sm font-medium text-wicket">{error}</p>}

      <button type="submit" disabled={busy || uploading} className="sg-btn-primary w-full py-3.5">
        {busy
          ? "Saving…"
          : mode === "public"
          ? "Submit for approval"
          : mode === "admin-edit" || mode === "self-edit"
          ? "Save changes"
          : "Create player"}
      </button>
    </form>
  );
}
