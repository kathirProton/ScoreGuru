"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/actions/auth";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await login(password);
    if (res?.error) {
      setError(res.error);
      setBusy(false);
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="sg-label">Password</label>
        <input
          type="password"
          autoFocus
          className="sg-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>
      {error && <p className="text-sm font-medium text-wicket">{error}</p>}
      <button type="submit" disabled={busy} className="sg-btn-primary w-full py-3">
        {busy ? "Checking…" : "Enter"}
      </button>
    </form>
  );
}
