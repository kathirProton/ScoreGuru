"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { addMatchPlayer, removeMatchPlayer } from "@/lib/actions/matches";
import type { Team, Player, MatchPlayer } from "@/lib/types";

export function LineupEditor({
  matchId,
  teams,
  matchPlayers,
  players,
  rosters,
  lockedIds,
}: {
  matchId: string;
  teams: Team[];
  matchPlayers: MatchPlayer[];
  players: Player[];
  rosters: Record<string, string[]>;
  lockedIds: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [addTo, setAddTo] = useState<Team | null>(null);

  const locked = new Set(lockedIds);
  const playerById = new Map(players.map((p) => [p.id, p]));
  const inMatch = new Set(matchPlayers.map((mp) => mp.player_id));

  const run = (fn: () => Promise<{ error?: string } | void>) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (res && "error" in res && res.error) setError(res.error);
      router.refresh();
    });

  return (
    <>
      {error && <p className="mb-4 rounded-xl bg-wicket-soft px-3 py-2 text-sm font-medium text-wicket-dark">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {teams.map((team) => {
          const roster = matchPlayers
            .filter((mp) => mp.team_id === team.id)
            .map((mp) => playerById.get(mp.player_id))
            .filter(Boolean) as Player[];
          return (
            <div key={team.id} className="sg-card p-4">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: team.color ?? "#2BEE34" }} />
                <Avatar name={team.name} photo={team.logo_url} size={36} />
                <span className="flex-1 truncate font-display font-bold text-ink">{team.name}</span>
                <span className="text-xs text-ink-muted">{roster.length}</span>
              </div>
              <div className="space-y-1.5">
                {roster.map((p) => {
                  const isLocked = locked.has(p.id);
                  return (
                    <div key={p.id} className="flex items-center gap-2.5 rounded-xl border border-line bg-cream-200 p-2">
                      <Avatar name={p.name} photo={p.photo_url} size={30} />
                      <span className="flex-1 truncate text-sm text-ink">{p.nickname || p.name}</span>
                      {isLocked ? (
                        <span className="text-xs text-ink-faint" title="Already played — locked">🔒 played</span>
                      ) : (
                        <button
                          disabled={pending}
                          onClick={() => run(() => removeMatchPlayer(matchId, p.id))}
                          className="text-xs font-medium text-wicket hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <button onClick={() => setAddTo(team)} className="sg-btn-ghost mt-3 w-full py-2.5 text-sm">
                + Add player
              </button>
            </div>
          );
        })}
      </div>

      <Modal open={!!addTo} onClose={() => setAddTo(null)} title={addTo ? `Add to ${addTo.name}` : ""}>
        {addTo && (
          <AddPicker
            team={addTo}
            players={players}
            rosterIds={rosters[addTo.id] ?? []}
            inMatch={inMatch}
            pending={pending}
            onAdd={(playerId) => run(() => addMatchPlayer(matchId, addTo.id, playerId))}
            onDone={() => setAddTo(null)}
          />
        )}
      </Modal>
    </>
  );
}

function AddPicker({
  team,
  players,
  rosterIds,
  inMatch,
  pending,
  onAdd,
  onDone,
}: {
  team: Team;
  players: Player[];
  rosterIds: string[];
  inMatch: Set<string>;
  pending: boolean;
  onAdd: (playerId: string) => void;
  onDone: () => void;
}) {
  const [query, setQuery] = useState("");
  const rosterSet = new Set(rosterIds);
  // Not already in the match; roster players first, then everyone else.
  const available = players
    .filter((p) => !inMatch.has(p.id))
    .filter((p) => (p.nickname || p.name).toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => Number(rosterSet.has(b.id)) - Number(rosterSet.has(a.id)));

  return (
    <div className="space-y-3">
      <input className="sg-input" placeholder="Search players…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="max-h-72 space-y-1.5 overflow-y-auto">
        {available.length === 0 && <p className="py-4 text-center text-sm text-ink-muted">No available players.</p>}
        {available.map((p) => (
          <button
            key={p.id}
            disabled={pending}
            onClick={() => { onAdd(p.id); onDone(); }}
            className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-cream-200 p-2 text-left transition active:scale-[0.99]"
          >
            <Avatar name={p.name} photo={p.photo_url} size={30} />
            <span className="flex-1 truncate text-sm text-ink">{p.nickname || p.name}</span>
            {rosterSet.has(p.id) && <span className="text-xs text-brand-600">roster</span>}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-muted">
        {team.name} roster players are listed first. Any approved player can be added.
      </p>
    </div>
  );
}
