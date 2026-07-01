"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMatchFromLast } from "@/lib/actions/matches";

export function RepeatMatchButton({ sourceMatchId }: { sourceMatchId?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const res = await createMatchFromLast(sourceMatchId);
    if (res?.error) { setBusy(false); return setError(res.error); }
    if (res?.matchId) router.push(`/admin/matches/${res.matchId}/score`);
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button onClick={go} disabled={busy} className="sg-btn-ghost px-4 py-2.5 text-sm">
        {busy ? "Setting up…" : "↺ Same as last match"}
      </button>
      {error && <span className="mt-1 text-xs text-wicket">{error}</span>}
    </span>
  );
}
