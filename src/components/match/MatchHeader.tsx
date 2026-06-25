import Link from "next/link";
import type { MatchView } from "@/lib/cricket/matchview";
import { Avatar, Pill } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";

export function MatchHeader({ view }: { view: MatchView }) {
  const { match, teamById } = view;
  const teamA = match.team_a_id ? teamById.get(match.team_a_id) : undefined;
  const teamB = match.team_b_id ? teamById.get(match.team_b_id) : undefined;
  const tossTeam = match.toss_winner_team_id ? teamById.get(match.toss_winner_team_id) : undefined;

  return (
    <div className="mb-5">
      <div className="mb-3 flex items-center gap-2">
        <Link href="/matches" className="text-sm text-ink-muted hover:text-ink">
          ← Matches
        </Link>
      </div>
      <div className="flex items-center justify-center gap-4 py-2 text-center">
        <div className="flex flex-1 flex-col items-center gap-1.5">
          {teamA && <Avatar name={teamA.name} photo={teamA.logo_url} size={56} />}
          <span className="font-display text-sm font-semibold text-ink">{teamA?.name}</span>
        </div>
        <span className="font-display text-xs font-bold uppercase text-ink-faint">vs</span>
        <div className="flex flex-1 flex-col items-center gap-1.5">
          {teamB && <Avatar name={teamB.name} photo={teamB.logo_url} size={56} />}
          <span className="font-display text-sm font-semibold text-ink">{teamB?.name}</span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-ink-muted">
        <Pill>{match.overs} overs</Pill>
        {match.venue && <Pill>📍 {match.venue}</Pill>}
        <Pill>{formatDate(match.match_date)}</Pill>
        {tossTeam && (
          <span>
            {tossTeam.name} won the toss & chose to {match.toss_decision}
          </span>
        )}
      </div>
    </div>
  );
}
