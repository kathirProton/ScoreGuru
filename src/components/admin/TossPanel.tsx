"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/primitives";
import { setTossAndStart } from "@/lib/actions/matches";
import type { Team, TossDecision } from "@/lib/types";

export function TossPanel({
  matchId,
  teamA,
  teamB,
}: {
  matchId: string;
  teamA: Team;
  teamB: Team;
}) {
  const router = useRouter();
  const [winner, setWinner] = useState<string>("");
  const [decision, setDecision] = useState<TossDecision | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (!winner || !decision) return setError("Pick the toss winner and decision.");
    setBusy(true);
    setError(null);
    const res = await setTossAndStart(matchId, winner, decision as TossDecision);
    setBusy(false);
    if (res?.error) return setError(res.error);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="text-center">
        <span className="text-4xl">🪙</span>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">Toss</h1>
        <p className="text-ink-muted">Record the toss to begin scoring.</p>
      </div>

      <div className="sg-card p-4">
        <label className="sg-label">Who won the toss?</label>
        <div className="grid grid-cols-2 gap-2.5">
          {[teamA, teamB].map((t) => (
            <button
              key={t.id}
              onClick={() => setWinner(t.id)}
              className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition ${
                winner === t.id ? "border-brand bg-brand-50" : "border-line bg-white"
              }`}
            >
              <Avatar name={t.name} photo={t.logo_url} size={44} />
              <span className="text-sm font-medium text-ink">{t.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sg-card p-4">
        <label className="sg-label">They chose to…</label>
        <div className="grid grid-cols-2 gap-2.5">
          {(["bat", "bowl"] as TossDecision[]).map((d) => (
            <button
              key={d}
              onClick={() => setDecision(d)}
              className={`rounded-xl border p-3 font-semibold capitalize transition ${
                decision === d ? "border-brand bg-brand-50 text-brand-700" : "border-line bg-white text-ink"
              }`}
            >
              {d === "bat" ? "🏏 Bat first" : "⚾ Bowl first"}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-center text-sm font-medium text-wicket">{error}</p>}
      <button disabled={busy} onClick={start} className="sg-btn-primary w-full py-3.5">
        {busy ? "Starting…" : "Start match"}
      </button>
    </div>
  );
}
