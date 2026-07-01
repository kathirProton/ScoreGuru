"use client";
import { useState } from "react";
import { Avatar } from "@/components/ui/primitives";
import type { Team, Player } from "@/lib/types";

export function TeamsExplorer({
  teams,
  players,
  rosters,
}: {
  teams: Team[];
  players: Player[];
  rosters: Record<string, string[]>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const playerById = new Map(players.map((p) => [p.id, p]));

  const rosterOf = (teamId: string): Player[] =>
    (rosters[teamId] ?? [])
      .map((id) => playerById.get(id))
      .filter(Boolean)
      .sort((a, b) => (a!.nickname || a!.name).localeCompare(b!.nickname || b!.name)) as Player[];

  const toggle = (teamId: string) =>
    setSelected((prev) => {
      if (prev.includes(teamId)) return prev.filter((id) => id !== teamId);
      if (prev.length >= 2) return [prev[1], teamId]; // keep the latest two
      return [...prev, teamId];
    });

  const compareTeams = selected.map((id) => teams.find((t) => t.id === id)).filter(Boolean) as Team[];

  return (
    <div className="space-y-6">
      {compareTeams.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {compareTeams.map((team) => (
            <TeamCard key={team.id} team={team} roster={rosterOf(team.id)} expanded onClose={() => toggle(team.id)} />
          ))}
          {compareTeams.length === 1 && (
            <div className="flex items-center justify-center rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-muted">
              Pick one more team to compare
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {teams.map((team) => (
          <button
            key={team.id}
            onClick={() => toggle(team.id)}
            className={`sg-card overflow-hidden p-0 text-left transition active:scale-[0.99] ${
              selected.includes(team.id) ? "ring-2 ring-brand" : "hover:shadow-lift"
            }`}
          >
            <TeamCard team={team} roster={rosterOf(team.id)} />
          </button>
        ))}
      </div>
    </div>
  );
}

function TeamCard({
  team,
  roster,
  expanded,
  onClose,
}: {
  team: Team;
  roster: Player[];
  expanded?: boolean;
  onClose?: () => void;
}) {
  const color = team.color ?? "#2BEE34";
  return (
    <div className={expanded ? "sg-card overflow-hidden p-0" : ""}>
      <div className="flex items-center gap-2.5 px-3.5 pb-2.5 pt-3" style={{ borderTop: `3px solid ${color}` }}>
        <Avatar name={team.name} photo={team.logo_url} size={expanded ? 40 : 34} />
        <span className="min-w-0 flex-1 truncate font-display font-bold text-ink">{team.name}</span>
        {expanded && onClose ? (
          <button onClick={onClose} className="text-ink-faint hover:text-ink" aria-label="Remove from comparison">✕</button>
        ) : (
          <span className="shrink-0 text-xs text-ink-faint">{roster.length}</span>
        )}
      </div>
      <ul className={`space-y-1 border-t border-line px-3.5 py-2.5 ${expanded ? "max-h-[60vh] overflow-y-auto" : ""}`}>
        {roster.length === 0 && <li className="py-2 text-center text-xs text-ink-muted">No players yet</li>}
        {roster.map((p) => (
          <li key={p.id} className="flex items-center gap-2 text-sm">
            <Avatar name={p.name} photo={p.photo_url} size={22} />
            <span className="min-w-0 flex-1 truncate text-ink-soft">{p.nickname || p.name}</span>
            {p.jersey_number != null && <span className="text-xs text-ink-faint">#{p.jersey_number}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
