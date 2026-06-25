import { PublicShell } from "@/components/public/PublicShell";
import { PlayerForm } from "@/components/PlayerForm";

export const metadata = { title: "Submit a Player — Score Guru" };

export default function SubmitPlayerPage() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Submit a player</h1>
        <p className="mt-1 mb-6 text-ink-soft">
          Add yourself or a mate to the roster. The admin approves new players before
          they can be picked for a match.
        </p>
        <div className="sg-card p-5">
          <PlayerForm mode="public" />
        </div>
      </div>
    </PublicShell>
  );
}
