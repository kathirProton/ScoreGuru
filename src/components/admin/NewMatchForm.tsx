"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/primitives";
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
      <select className="sg-input mb-3" value={team} onChange={(e) => onTeam(e.target.value)}>
        <option value="">Select team…</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
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

export function NewMatchForm({
  teams,
  players,
  rosters,
}: {
  teams: Team[];
  players: Player[];
  rosters: Record<string, string[]>;
}) {
  const router = useRouter();
  const approvedIds = new Set(players.map((p) => p.id));
  const [name, setName] = useState("");
  const [overs, setOvers] = useState("6");
  const [venue, setVenue] = useState("");
  const [freeHit, setFreeHit] = useState(true);
  const [lastMan, setLastMan] = useState(true);
  const [blockConsec, setBlockConsec] = useState(true);
  const [superOvers, setSuperOvers] = useState("1");
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [lineupA, setLineupA] = useState<Set<string>>(new Set());
  const [lineupB, setLineupB] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setter(next);
  };

  // Selecting a team pre-fills its lineup from the roster (approved players
  // only, minus anyone already picked for the other side). Still fully editable.
  const rosterFor = (teamId: string, otherLineup: Set<string>) =>
    new Set((rosters[teamId] ?? []).filter((id) => approvedIds.has(id) && !otherLineup.has(id)));

  const selectTeamA = (id: string) => {
    setTeamA(id);
    setLineupA(id ? rosterFor(id, lineupB) : new Set());
  };
  const selectTeamB = (id: string) => {
    setTeamB(id);
    setLineupB(id ? rosterFor(id, lineupA) : new Set());
  };

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
      block_consecutive_overs: blockConsec,
      super_over_overs: parseInt(superOvers, 10) || 1,
    });
    setBusy(false);
    if (res?.error) return setError(res.error);
    if (res?.matchId) router.push(`/admin/matches/${res.matchId}/score`);
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
          <Toggle label="Block consecutive overs" hint="A bowler can't bowl two overs in a row" value={blockConsec} onChange={setBlockConsec} />
        </div>
      </div>

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
