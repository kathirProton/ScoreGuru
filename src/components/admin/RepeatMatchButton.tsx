import Link from "next/link";

/**
 * Opens the New Match form pre-filled with the previous match's teams, lineups
 * and rules. Nothing is created until the admin hits "Create match" — so the
 * same fixture can be replayed with, say, a different number of overs.
 */
export function RepeatMatchButton({ sourceMatchId }: { sourceMatchId?: string }) {
  return (
    <Link
      href={`/admin/matches/new?from=${sourceMatchId ?? "last"}`}
      className="sg-btn-ghost px-4 py-2.5 text-sm"
    >
      ↺ Same as last match
    </Link>
  );
}
