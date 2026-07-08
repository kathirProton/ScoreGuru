"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/primitives";
import { Select } from "@/components/ui/Select";
import { createMatch } from "@/lib/actions/matches";
import type { Team, Player } from "@/lib/types";

function Toggle({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between rounded-xl border border-line bg-cream-200 p-3.5 text-left"
    >
      <span>
        <span className="block font-medium text-ink">{label}</span>
        <span className="block text-xs text-ink-muted">{hint}</span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${value ? "bg-brand" : "bg-cream-300"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-ink shadow transition ${value ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function LineupPicker({
  label,
  team,
  teams,
  onTeam,
  players,
  selected,
  toggle,
  disabledIds,
}: {
  label: string;
  team: string;
  teams: Team[];
  onTeam: (id: string) => void;
  players: Player[];
  selected: Set<string>;
  toggle: (id: string) => void;
  disabledIds: Set<string>;
}) {
  return (
    <div className="sg-card p-4">
      <label className="sg-label">{label}</label>
      <div className="mb-3">
        <Select
          value={team}
          onChange={onTeam}
          placeholder="Select team…"
          options={teams.map((t) => ({ value: t.id, label: t.name }))}
        />
      </div>
      <p className="mb-2 text-xs font-medium text-ink-muted">
        Lineup · {selected.size} selected
      </p>
      <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
        {players.map((p) => {
          const isSel = selected.has(p.id);
          const isDisabled = disabledIds.has(p.id) && !isSel;
          return (
            <button
              type="button"
              key={p.id}
              disabled={isDisabled}
              onClick={() => toggle(p.id)}
              className={`flex w-full items-center gap-2.5 rounded-xl border p-2 text-left transition ${
                isSel ? "border-brand bg-brand-50" : "border-line bg-cream-200"
              } ${isDisabled ? "opacity-30" : ""}`}
            >
              <Avatar name={p.name} photo={p.photo_url} size={32} />
              <span className="flex-1 truncate text-sm text-ink">{p.nickname || p.name}</span>
              {isSel && <span className="text-brand-600">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface NewMatchInitial {
  name: string;
  overs: string;
  venue: string;
  freeHit: boolean;
  lastMan: boolean;
  superOvers: string;
  teamA: string;
  teamB: string;
  lineupA: string[];
  lineupB: string[];
}

export function NewMatchForm({
  teams,
  players,
  rosters,
  initial,
}: {
  teams: Team[];
  players: Player[];
  rosters: Record<string, string[]>;
  initial?: NewMatchInitial;
}) {
  const router = useRouter();
  const approvedIds = new Set(players.map((p) => p.id));
  // Only pre-select players who are still approved and available.
  const seedLineup = (ids: string[] = []) => new Set(ids.filter((id) => approvedIds.has(id)));
  const [name, setName] = useState(initial?.name ?? "");
  const [overs, setOvers] = useState(initial?.overs ?? "6");
  const [venue, setVenue] = useState(initial?.venue ?? "");
  const [freeHit, setFreeHit] = useState(initial?.freeHit ?? true);
  const [lastMan, setLastMan] = useState(initial?.lastMan ?? true);
  const [superOvers, setSuperOvers] = useState(initial?.superOvers ?? "1");
  const [teamA, setTeamA] = useState(initial?.teamA ?? "");
  const [teamB, setTeamB] = useState(initial?.teamB ?? "");
  const [lineupA, setLineupA] = useState<Set<string>>(() => seedLineup(initial?.lineupA));
  const [lineupB, setLineupB] = useState<Set<string>>(() => seedLineup(initial?.lineupB));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setter(next);
  };

  const playerById = new Map(players.map((p) => [p.id, p]));
  const approvedRoster = (teamId: string) =>
    teamId ? (rosters[teamId] ?? []).filter((id) => approvedIds.has(id)) : [];

  // Selecting a team pre-fills both lineups from the two rosters, EXCLUDING any
  // player who is on both rosters (a duplicate). Those are left unselected on
  // both sides so the admin explicitly assigns each to one team.
  const applyTeams = (aId: string, bId: string) => {
    const ra = approvedRoster(aId);
    const rb = approvedRoster(bId);
    const dup = new Set(ra.filter((id) => rb.includes(id)));
    setLineupA(new Set(ra.filter((id) => !dup.has(id))));
    setLineupB(new Set(rb.filter((id) => !dup.has(id))));
  };
  const selectTeamA = (id: string) => { setTeamA(id); applyTeams(id, teamB); };
  const selectTeamB = (id: string) => { setTeamB(id); applyTeams(teamA, id); };

  // Players on BOTH rosters who are still unassigned to either side.
  const rosterOverlap =
    teamA && teamB ? approvedRoster(teamA).filter((id) => approvedRoster(teamB).includes(id)) : [];
  const unresolvedDups = rosterOverlap.filter((id) => !lineupA.has(id) && !lineupB.has(id));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!teamA || !teamB) return setError("Pick both teams.");
    if (teamA === teamB) return setError("Teams must be different.");
    if (lineupA.size === 0 || lineupB.size === 0) return setError("Both teams need players.");
    setBusy(true);
    const res = await createMatch({
      name: name || null,
      overs: parseInt(overs, 10) || 6,
      venue: venue || null,
      team_a_id: teamA,
      team_b_id: teamB,
      lineup_a: [...lineupA],
      lineup_b: [...lineupB],
      free_hit_enabled: freeHit,
      last_man_stands: lastMan,
      block_consecutive_overs: true,
      super_over_overs: parseInt(superOvers, 10) || 1,
    });
    if (res?.error) {
      setBusy(false);
      return setError(res.error);
    }
    // Keep the "Creating…" label until navigation lands on the toss page.
    if (res?.matchId) router.push(`/admin/matches/${res.matchId}/score`);
    else setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="sg-card space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="sg-label">Match name (optional)</label>
            <input className="sg-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sunday Smash" />
          </div>
          <div>
            <label className="sg-label">Overs</label>
            <input className="sg-input" type="number" min={1} value={overs} onChange={(e) => setOvers(e.target.value)} />
          </div>
          <div>
            <label className="sg-label">Super-over overs</label>
            <input className="sg-input" type="number" min={1} value={superOvers} onChange={(e) => setSuperOvers(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="sg-label">Venue / turf (optional)</label>
            <input className="sg-input" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="The Turf, Indiranagar" />
          </div>
        </div>
        <div className="grid gap-2.5">
          <Toggle label="Free hit" hint="Next legal ball after a no-ball is a free hit" value={freeHit} onChange={setFreeHit} />
          <Toggle label="Last man stands" hint="Last batsman can bat alone" value={lastMan} onChange={setLastMan} />
        </div>
      </div>

      {unresolvedDups.length > 0 && (
        <div className="rounded-2xl border border-wicket/50 bg-wicket-soft p-4">
          <p className="text-sm font-bold text-wicket">
            ⚠ {unresolvedDups.length} player{unresolvedDups.length === 1 ? " is" : "s are"} on both teams
          </p>
          <p className="mt-1 text-xs text-wicket-dark">
            A player can&apos;t be on both sides of the same match. They&apos;ve been unselected from
            both lineups — add each one to only the team they&apos;re playing for below.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {unresolvedDups.map((id) => (
              <span key={id} className="rounded-full bg-wicket/20 px-2.5 py-0.5 text-xs font-medium text-wicket-dark">
                {playerById.get(id)?.name ?? "Unknown"}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <LineupPicker
          label="Team A"
          team={teamA}
          teams={teams.filter((t) => t.id !== teamB)}
          onTeam={selectTeamA}
          players={players}
          selected={lineupA}
          toggle={(id) => toggle(lineupA, setLineupA, id)}
          disabledIds={lineupB}
        />
        <LineupPicker
          label="Team B"
          team={teamB}
          teams={teams.filter((t) => t.id !== teamA)}
          onTeam={selectTeamB}
          players={players}
          selected={lineupB}
          toggle={(id) => toggle(lineupB, setLineupB, id)}
          disabledIds={lineupA}
        />
      </div>

      {error && <p className="text-sm font-medium text-wicket">{error}</p>}
      <button disabled={busy} className="sg-btn-primary w-full py-3.5">
        {busy ? "Creating…" : "Create match & go to toss"}
      </button>
    </form>
  );
}
