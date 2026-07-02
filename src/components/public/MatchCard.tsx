import Link from "next/link";
import type { MatchView } from "@/lib/cricket/matchview";
import { Avatar, LiveDot, Pill } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";

function TeamLine({
  name,
  logo,
  color,
  score,
  bold,
}: {
  name: string;
  logo?: string | null;
  color?: string | null;
  score?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <Avatar name={name} photo={logo} size={32} />
        <span className={`truncate ${bold ? "font-semibold text-ink" : "text-ink-soft"}`}>
          {name}
        </span>
      </div>
      {score && (
        <span className={`tabular-nums font-mono text-sm ${bold ? "text-ink font-semibold" : "text-ink-muted"}`}>
          {score}
        </span>
      )}
    </div>
  );
}

function scoreOf(view: MatchView, teamId: string): string | undefined {
  const v = view.inningsViews
    .filter((iv) => !iv.innings.is_super_over)
    .find((iv) => iv.innings.batting_team_id === teamId);
  if (!v) return undefined;
  return `${v.state.totalRuns}/${v.state.wickets} (${v.state.oversDisplay})`;
}

export function MatchCard({ view }: { view: MatchView }) {
  const { match, teamById } = view;
  const teamA = match.team_a_id ? teamById.get(match.team_a_id) : undefined;
  const teamB = match.team_b_id ? teamById.get(match.team_b_id) : undefined;
  const isLive = ["live", "super_over"].includes(match.status);
  const isBreak = match.status === "innings_break";

  return (
    <Link
      href={`/matches/${match.id}`}
      className="sg-card block p-4 transition hover:shadow-lift active:scale-[0.99]"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted">
          {match.name || `${match.overs} overs`} · {formatDate(match.match_date)}
        </span>
        {isLive ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-wicket">
            <LiveDot /> LIVE
          </span>
        ) : isBreak ? (
          <Pill tone="gold">Innings Break</Pill>
        ) : match.status === "abandoned" ? (
          <Pill tone="neutral">No Result</Pill>
        ) : (
          <Pill tone="brand">Result</Pill>
        )}
      </div>

      <div className="space-y-2">
        {teamA && (
          <TeamLine
            name={teamA.name}
            logo={teamA.logo_url}
            color={teamA.color}
            score={scoreOf(view, teamA.id)}
            bold={match.winner_team_id === teamA.id || isLive}
          />
        )}
        {teamB && (
          <TeamLine
            name={teamB.name}
            logo={teamB.logo_url}
            color={teamB.color}
            score={scoreOf(view, teamB.id)}
            bold={match.winner_team_id === teamB.id}
          />
        )}
      </div>

      {match.result_text && (
        <p className="mt-3 border-t border-line pt-2.5 text-sm font-medium text-brand-700">
          {match.result_text}
        </p>
      )}
    </Link>
  );
}
