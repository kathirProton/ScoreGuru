"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";
import { fetchMatchBundle, MatchBundle } from "@/lib/cricket/load";
import { buildMatchView, playerName } from "@/lib/cricket/matchview";
import { Avatar, LiveDot } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { BallChip } from "@/components/match/Chip";
import { MatchHighlights } from "@/components/match/MatchHighlights";
import {
  recordDelivery,
  warmup,
  undoLast,
  undoLastBall,
  restartInnings,
  recordDroppedCatch,
  selectOpeningBatsmen,
  selectNextBatsman,
  retireBatsman,
  swapStrike,
  replaceBatsman,
  startSecondInnings,
} from "@/lib/actions/scoring";
import { abandonMatch, restartMatch, deleteMatch } from "@/lib/actions/matches";
import type {
  Player,
  WicketType,
  ExtraType,
  Delivery,
  BattingEvent,
  BattingEventType,
} from "@/lib/types";
import { WICKET_LABELS } from "@/lib/types";
import { bowlerOvers } from "@/lib/cricket/engine";

type MV = ReturnType<typeof buildMatchView>;
type DeliveryPayload = {
  runs_off_bat: number;
  extra_type: ExtraType;
  extra_runs: number;
  is_wicket: boolean;
  wicket_type?: WicketType | null;
  dismissed_player_id?: string | null;
  fielder_id?: string | null;
  no_strike_change?: boolean;
};

export function ScoringConsole({ initial }: { initial: MatchBundle }) {
  const router = useRouter();
  const [bundle, setBundle] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bowler picked for the upcoming over — scoped to a specific innings + over
  // so a selection never bleeds across innings (each new over/innings re-asks).
  const [selectedBowler, setSelectedBowler] = useState<{ inningsId: string; over: number; id: string } | null>(null);
  // Mid-over bowler change: forces the bowler for the rest of the current over.
  const [bowlerOverride, setBowlerOverride] = useState<{ inningsId: string; over: number; id: string } | null>(null);
  const [changeBowlerOpen, setChangeBowlerOpen] = useState(false);

  const [extra, setExtra] = useState<null | ExtraType>(null);
  const [wicketOpen, setWicketOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [restartInningsOpen, setRestartInningsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [catchDropOpen, setCatchDropOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  // Whether the match was already finished when this console mounted. If it
  // finishes DURING this session we hold on a "Complete match" gate first.
  const initiallyFinished = useRef(["completed", "abandoned"].includes(initial.match.status));
  const [completeAck, setCompleteAck] = useState(false);

  const matchId = bundle.match.id;

  // Warm the serverless function + DB on mount so the first ball isn't a cold
  // start. The scoring pad stays disabled until this resolves so the user
  // doesn't tap into the cold-start lag.
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    warmup().then(() => setWarm(true)).catch(() => setWarm(true));
  }, []);

  const refetch = useCallback(async () => {
    const fresh = await fetchMatchBundle(getBrowserClient(), matchId);
    if (fresh) setBundle(fresh);
  }, [matchId]);

  // Blocking action (used for rare status changes: abandon / restart / delete
  // / start-2nd-innings / undo on a finished screen). Shows a spinner.
  const act = useCallback(
    async (fn: () => Promise<{ error?: string; ok?: boolean } | void>) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fn();
        if (res && "error" in res && res.error) setError(res.error);
        await refetch();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
    },
    [refetch]
  );

  // Optimistic mutation: the local bundle is updated instantly (the engine is
  // pure, so the derived UI advances with zero latency) while the server write
  // runs in a serialized background queue. When the queue drains we reconcile
  // once against the authoritative DB state (real seqs, innings transitions,
  // POTM, …). This is what removes the 2-3s per-ball lag on free-tier hosting.
  const chain = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const enqueue = useCallback(
    (server: () => Promise<{ error?: string; ok?: boolean } | void>) => {
      pending.current += 1;
      setSyncing(true);
      chain.current = chain.current
        .then(async () => {
          const res = await server();
          if (res && "error" in res && res.error) setError(res.error);
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Sync failed — retry."))
        .finally(async () => {
          pending.current -= 1;
          if (pending.current === 0) {
            await refetch();
            setSyncing(false);
          }
        });
    },
    [refetch]
  );

  const mutate = useCallback(
    (
      applyOptimistic: (b: MatchBundle) => MatchBundle,
      server: () => Promise<{ error?: string; ok?: boolean } | void>
    ) => {
      setError(null);
      setBundle((prev) => applyOptimistic(prev));
      enqueue(server);
    },
    [enqueue]
  );

  const renderMatchOptions = (currentInningsId?: string) => (
    <>
      <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-4">
        {currentInningsId && (
          <button disabled={busy} onClick={() => setRestartInningsOpen(true)} className="sg-btn-ghost flex-1 py-2.5 text-sm">
            ↺ Restart innings
          </button>
        )}
        <button disabled={busy} onClick={() => setRestartOpen(true)} className="sg-btn-ghost flex-1 py-2.5 text-sm">
          ↻ Restart match
        </button>
        <button disabled={busy} onClick={() => setDeleteOpen(true)} className="sg-btn-ghost flex-1 py-2.5 text-sm text-wicket">
          🗑 Delete match
        </button>
      </div>
      {currentInningsId && (
        <Modal open={restartInningsOpen} onClose={() => setRestartInningsOpen(false)} title="Restart this innings?">
          <p className="mb-4 text-sm text-ink-soft">
            Wipes every ball of the current innings and returns to the opening batsmen. The other innings is untouched. This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setRestartInningsOpen(false)} className="sg-btn-ghost flex-1 py-2.5">Cancel</button>
            <button
              disabled={busy}
              onClick={() => { setRestartInningsOpen(false); setSelectedBowler(null); setBowlerOverride(null); act(() => restartInnings(currentInningsId)); }}
              className="sg-btn-danger flex-1 py-2.5"
            >
              Restart innings
            </button>
          </div>
        </Modal>
      )}
      <Modal open={restartOpen} onClose={() => setRestartOpen(false)} title="Restart match?">
        <p className="mb-4 text-sm text-ink-soft">
          Wipes every ball scored and returns the match to the toss. Teams & lineups are kept. This cannot be undone.
        </p>
        <div className="flex gap-2">
          <button onClick={() => setRestartOpen(false)} className="sg-btn-ghost flex-1 py-2.5">Cancel</button>
          <button
            disabled={busy}
            onClick={() => { setRestartOpen(false); act(async () => { const r = await restartMatch(matchId); router.refresh(); return r; }); }}
            className="sg-btn-danger flex-1 py-2.5"
          >
            Restart
          </button>
        </div>
      </Modal>
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete match?">
        <p className="mb-4 text-sm text-ink-soft">Permanently deletes this match and all its data. This cannot be undone.</p>
        <div className="flex gap-2">
          <button onClick={() => setDeleteOpen(false)} className="sg-btn-ghost flex-1 py-2.5">Cancel</button>
          <button
            disabled={busy}
            onClick={async () => { setDeleteOpen(false); await deleteMatch(matchId); router.push("/admin"); }}
            className="sg-btn-danger flex-1 py-2.5"
          >
            Delete
          </button>
        </div>
      </Modal>
    </>
  );

  const view = useMemo(() => buildMatchView(bundle), [bundle]);
  const current = view.currentInnings;
  const finished = ["completed", "abandoned"].includes(view.match.status);
  const showResult = finished && (initiallyFinished.current || completeAck);

  // Match ended this session but not yet acknowledged → hold on a choice screen
  // (never auto-advance to the result).
  if (finished && !showResult) {
    return (
      <div className="mx-auto max-w-md space-y-3 text-center">
        <span className="text-4xl">🏁</span>
        <h1 className="font-display text-xl font-bold text-ink">Match complete</h1>
        <p className="text-sm text-ink-soft">Nothing moves until you choose.</p>
        <button onClick={() => setCompleteAck(true)} className="sg-btn-primary w-full py-3">
          Complete match — view result
        </button>
        <button disabled={busy} onClick={() => { setSelectedBowler(null); setBowlerOverride(null); act(() => undoLastBall(matchId)); }} className="sg-btn-ghost w-full py-2.5 text-sm">
          ↩ Undo last ball
        </button>
        {renderMatchOptions()}
      </div>
    );
  }

  if (showResult) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <MatchHighlights view={view} />
        <div className="flex justify-center gap-2">
          <a href={`/matches/${matchId}`} className="sg-btn-primary px-5 py-2.5">View scorecard</a>
          <button disabled={busy} onClick={() => { setCompleteAck(false); setSelectedBowler(null); setBowlerOverride(null); act(() => undoLastBall(matchId)); }} className="sg-btn-ghost px-4 py-2.5">
            ↩ Undo last ball
          </button>
        </div>
        {renderMatchOptions()}
      </div>
    );
  }

  if (view.match.status === "innings_break") {
    const inn1 = view.inningsViews.find((iv) => iv.innings.innings_number === 1);
    const target = view.inningsViews.find((iv) => iv.innings.innings_number === 2)?.innings.target;
    return (
      <div className="mx-auto max-w-md space-y-5 text-center">
        <div className="sg-card border-gold/30 bg-gold-soft p-6">
          <h1 className="font-display text-2xl font-bold text-gold-dark">Innings Break</h1>
          {inn1 && (
            <p className="mt-2 text-ink-soft">
              {inn1.battingTeam?.name} scored <b>{inn1.state.totalRuns}/{inn1.state.wickets}</b> ({inn1.state.oversDisplay})
            </p>
          )}
          <p className="mt-1 font-display text-lg font-bold text-ink">Target: {target}</p>
        </div>
        <button disabled={busy} onClick={() => act(() => startSecondInnings(matchId))} className="sg-btn-primary w-full py-3.5">
          {busy ? "Starting…" : "Start 2nd innings"}
        </button>
        <button disabled={busy} onClick={() => act(() => undoLastBall(matchId))} className="sg-btn-ghost w-full py-3">
          ↩ Undo last ball
        </button>
        <p className="text-xs text-ink-muted">Nothing happens until you choose — undo a mistaken last ball, or start the chase.</p>
        <ErrorLine error={error} />
        {renderMatchOptions()}
      </div>
    );
  }

  if (!current) return <p className="text-center text-ink-muted">Setting up innings…</p>;

  const s = current.state;
  const battingPlayers = lineup(view, current.innings.batting_team_id);
  const bowlingPlayers = lineup(view, current.innings.bowling_team_id);

  const statusOf = (id: string) => s.batsmen.find((b) => b.playerId === id)?.status ?? "yet_to_bat";
  const atCrease = (id: string) => id === s.strikerId || id === s.nonStrikerId;
  const availableBatsmen = battingPlayers.filter(
    (p) => !atCrease(p.id) && ["yet_to_bat", "retired_not_out"].includes(statusOf(p.id))
  );

  // bowler for the next ball. Precedence: a mid-over change override (this
  // innings + over) wins; else the in-progress over reuses its bowler; else the
  // freshly picked bowler for this innings + over (so each over re-asks).
  const overrideMatch =
    bowlerOverride?.inningsId === current.innings.id && bowlerOverride.over === s.currentOverNumber;
  const selMatch =
    selectedBowler?.inningsId === current.innings.id && selectedBowler.over === s.currentOverNumber;
  const bowlerForBall = overrideMatch
    ? bowlerOverride!.id
    : s.currentBowlerId ?? (selMatch ? selectedBowler!.id : null);

  const needOpeners = s.strikerId === null && s.nonStrikerId === null && !s.isInningsOver;
  const needOneBatsman =
    !needOpeners &&
    (s.strikerId === null || s.nonStrikerId === null) &&
    !s.loneBatsman &&
    availableBatsmen.length > 0 &&
    !s.isInningsOver;
  const needBowler = !s.isInningsOver && !needOpeners && !needOneBatsman && bowlerForBall === null;

  const inningsId = current.innings.id;
  const record = (payload: DeliveryPayload) =>
    mutate(
      (b) => appendOptimisticDelivery(b, payload, bowlerForBall),
      () => recordDelivery(inningsId, bowlerForBall!, payload)
    );

  // Delete the most recent ball/event (optimistic, then persist). Keeps the
  // bowler selection so undoing the first ball of an over doesn't re-prompt.
  const deleteLastBall = () =>
    mutate(
      (b) => removeLastEvent(b),
      () => undoLast(inningsId)
    );

  // ScoringPad "Undo": if the over hasn't started (a bowler is picked but no
  // ball bowled), cancel the bowler selection to re-prompt. Otherwise delete
  // the last ball (bowler stays put).
  const undo = () => {
    if (s.ballsThisOver === 0) {
      setSelectedBowler(null);
      setBowlerOverride(null);
      return;
    }
    deleteLastBall();
  };

  // Undo across the innings break (blocking; also drops the empty next innings).
  const undoBreak = () => {
    setSelectedBowler(null);
    setBowlerOverride(null);
    act(() => undoLastBall(matchId));
  };

  const isFirstInningsBreak = current.innings.innings_number === 1 && !current.innings.is_super_over;

  const pickOpeners = (a: string, b2: string) =>
    mutate(
      (b) =>
        appendOptimisticEvents(b, inningsId, [
          { player_id: a, event_type: "in", at_end: "striker" },
          { player_id: b2, event_type: "in", at_end: "non_striker" },
        ]),
      () => selectOpeningBatsmen(inningsId, a, b2)
    );

  const pickNextBatsman = (id: string) =>
    mutate(
      (b) => appendOptimisticEvents(b, inningsId, [{ player_id: id, event_type: "in", at_end: nextEnd(b) }]),
      () => selectNextBatsman(inningsId, id)
    );

  const doSwapStrike = () =>
    mutate(
      (b) =>
        appendOptimisticEvents(b, inningsId, [
          { player_id: s.strikerId!, event_type: "swap_strike" },
        ]),
      () => swapStrike(inningsId)
    );

  const doRetire = (playerId: string, out: boolean) =>
    mutate(
      (b) =>
        appendOptimisticEvents(b, inningsId, [
          { player_id: playerId, event_type: out ? "retired_out" : "retired_not_out" },
        ]),
      () => retireBatsman(inningsId, playerId, out)
    );

  const doReplace = (outgoingId: string, incomingId: string, incomingOnStrike: boolean) =>
    mutate(
      (b) => appendOptimisticReplace(b, inningsId, outgoingId, incomingId, incomingOnStrike),
      () => replaceBatsman(inningsId, outgoingId, incomingId, incomingOnStrike)
    );

  const doCatchDrop = (fielderId: string) => act(() => recordDroppedCatch(inningsId, fielderId));

  return (
    <div className="space-y-4">
      {/* Score header */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-brand-500/15 to-cream-200 p-4">
        <div className="flex items-center justify-between">
          <span className="font-display font-bold text-ink">{current.battingTeam?.name}</span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-wicket">
            <LiveDot /> {current.innings.is_super_over ? "SUPER OVER" : `Innings ${current.innings.innings_number}`}
            {syncing && <span className="ml-1 text-ink-faint" title="Saving…">⟳</span>}
          </span>
        </div>
        <div className="mt-1 flex items-end gap-2">
          <span className="font-display text-4xl font-bold tabular-nums text-ink">
            {s.totalRuns}/{s.wickets}
          </span>
          <span className="mb-1 font-mono text-ink-muted">
            ({s.oversDisplay}/{current.innings.is_super_over ? view.match.super_over_overs : view.match.overs})
          </span>
        </div>
        {s.target != null && (
          <p className="mt-1 text-sm font-medium text-brand-700">
            Need {s.runsNeeded} off {s.ballsRemaining} · Target {s.target}
          </p>
        )}
        {s.nextIsFreeHit && (
          <span className="mt-2 inline-flex rounded-full bg-gold px-3 py-1 text-xs font-bold uppercase text-cream-50">
            ⚡ Free Hit
          </span>
        )}
        <div className="mt-3 space-y-1 text-sm">
          {[s.strikerId, s.nonStrikerId].map((id, i) => {
            if (!id) return null;
            const b = s.batsmen.find((x) => x.playerId === id);
            return (
              <div key={id} className="flex justify-between">
                <span className="text-ink">{i === 0 ? "● " : "  "}{playerName(view, id)}</span>
                <span className="font-mono text-ink-soft">{b?.runs ?? 0} ({b?.balls ?? 0})</span>
              </div>
            );
          })}
          {bowlerForBall && (
            <div className="flex justify-between border-t border-line/60 pt-1">
              <span className="text-ink-muted">
                🎯 {playerName(view, bowlerForBall)}
                {!s.currentBowlerId && <span className="ml-1 text-xs text-ink-faint">· new over</span>}
              </span>
              <span className="font-mono text-ink-soft">
                {s.bowlers.find((x) => x.playerId === bowlerForBall)?.wickets ?? 0}/
                {s.bowlers.find((x) => x.playerId === bowlerForBall)?.runsConceded ?? 0} (
                {bowlerOvers(s.bowlers.find((x) => x.playerId === bowlerForBall)?.legalBalls ?? 0)})
              </span>
            </div>
          )}
        </div>
        {s.thisOver.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {s.thisOver.map((d) => (
              <BallChip key={d.id} d={d} size="sm" />
            ))}
          </div>
        )}
      </div>

      <ErrorLine error={error} />

      {s.isInningsOver ? (
        isFirstInningsBreak ? (
          <div className="sg-card p-5 text-center">
            <p className="font-display text-lg font-bold text-ink">Innings complete</p>
            <p className="mt-1 text-sm text-ink-soft">
              {current.battingTeam?.name} {s.totalRuns}/{s.wickets} · Target {s.totalRuns + 1}
            </p>
            <div className="mt-4 space-y-2">
              <button disabled={busy} onClick={() => act(async () => { await chain.current; return startSecondInnings(matchId); })} className="sg-btn-primary w-full py-3">
                {busy ? "Starting…" : "Start 2nd innings"}
              </button>
              <button disabled={busy} onClick={undoBreak} className="sg-btn-ghost w-full py-2.5 text-sm">↩ Undo last ball</button>
            </div>
          </div>
        ) : (
          <div className="sg-card p-5 text-center">
            <p className="font-display text-lg font-bold text-ink">Innings complete</p>
            <p className="mt-1 text-sm text-ink-soft">Nothing moves until you choose.</p>
            <div className="mt-4 space-y-2">
              <button disabled={busy} onClick={() => act(async () => { await chain.current; setCompleteAck(true); })} className="sg-btn-primary w-full py-3">
                {busy ? "Finalising…" : "Complete match"}
              </button>
              <button disabled={busy} onClick={undoBreak} className="sg-btn-ghost w-full py-2.5 text-sm">↩ Undo last ball</button>
            </div>
          </div>
        )
      ) : needOpeners ? (
        <OpenerPicker players={battingPlayers} busy={busy} view={view} onPick={pickOpeners} />
      ) : needOneBatsman ? (
        <SinglePicker title="Select next batsman" players={availableBatsmen} busy={busy} onPick={pickNextBatsman} />
      ) : needBowler ? (
        <BowlerPicker
          players={bowlingPlayers}
          blockedIds={s.lastOverBowlerIds}
          canUndo={s.legalBalls > 0}
          busy={busy}
          onUndoLastBall={deleteLastBall}
          onPick={(id) => setSelectedBowler({ inningsId: current.innings.id, over: s.currentOverNumber, id })}
        />
      ) : (
        <ScoringPad
          busy={busy}
          disabled={!warm}
          onRun={(n) => record({ runs_off_bat: n, extra_type: "none", extra_runs: 0, is_wicket: false })}
          onGully={(n) => record({ runs_off_bat: n, extra_type: "none", extra_runs: 0, is_wicket: false, no_strike_change: true })}
          onExtra={setExtra}
          onWicket={() => setWicketOpen(true)}
          onManage={() => setManageOpen(true)}
          onChangeBowler={() => setChangeBowlerOpen(true)}
          onCatchDrop={() => setCatchDropOpen(true)}
          onUndo={undo}
          onAbandon={() => setAbandonOpen(true)}
        />
      )}
      {!warm && !s.isInningsOver && !needOpeners && !needOneBatsman && !needBowler && (
        <p className="text-center text-xs text-ink-muted">Warming up… buttons enable in a moment.</p>
      )}

      <ExtraModal extra={extra} onClose={() => setExtra(null)} busy={busy} onSubmit={(p) => { setExtra(null); record(p); }} />

      <WicketModal
        open={wicketOpen}
        onClose={() => setWicketOpen(false)}
        striker={s.strikerId}
        nonStriker={s.nonStrikerId}
        fielders={bowlingPlayers}
        freeHit={s.nextIsFreeHit}
        view={view}
        busy={busy}
        onSubmit={(p) => { setWicketOpen(false); record(p); }}
      />

      <ManageBatsmenModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        striker={s.strikerId}
        nonStriker={s.nonStrikerId}
        bench={availableBatsmen}
        view={view}
        busy={busy}
        onSwapStrike={() => doSwapStrike()}
        onReplace={(outgoing, incoming, onStrike) => { setManageOpen(false); doReplace(outgoing, incoming, onStrike); }}
        onRetire={(playerId, out) => { setManageOpen(false); doRetire(playerId, out); }}
      />

      <Modal open={changeBowlerOpen} onClose={() => setChangeBowlerOpen(false)} title="Change bowler">
        <p className="mb-3 text-sm text-ink-soft">
          Pick who bowls the rest of this over. The current over&apos;s remaining balls will be credited to the new bowler.
        </p>
        <div className="max-h-72 space-y-1.5 overflow-y-auto">
          {bowlingPlayers.map((p) => {
            const blocked = s.lastOverBowlerIds.includes(p.id); // bowled previous over
            return (
              <PlayerRow
                key={p.id}
                p={p}
                badge={p.id === bowlerForBall ? "bowling" : blocked ? "bowled last over" : null}
                disabled={busy || blocked}
                onClick={() => {
                  setBowlerOverride({ inningsId: current.innings.id, over: s.currentOverNumber, id: p.id });
                  setChangeBowlerOpen(false);
                }}
              />
            );
          })}
        </div>
      </Modal>

      <Modal open={catchDropOpen} onClose={() => setCatchDropOpen(false)} title="Catch dropped">
        <p className="mb-3 text-sm text-ink-soft">
          Records a dropped catch for the stats only — it doesn&apos;t change the score. Who put it down?
        </p>
        <div className="max-h-72 space-y-1.5 overflow-y-auto">
          {bowlingPlayers.map((p) => (
            <PlayerRow key={p.id} p={p} disabled={busy} onClick={() => { setCatchDropOpen(false); doCatchDrop(p.id); }} />
          ))}
        </div>
      </Modal>

      <Modal open={abandonOpen} onClose={() => setAbandonOpen(false)} title="Abandon match?">
        <p className="mb-4 text-sm text-ink-soft">Marks the match as a no-result. Scores are kept; no winner recorded.</p>
        <div className="flex gap-2">
          <button onClick={() => setAbandonOpen(false)} className="sg-btn-ghost flex-1 py-2.5">Cancel</button>
          <button
            disabled={busy}
            onClick={() => { setAbandonOpen(false); act(async () => { const r = await abandonMatch(matchId); router.refresh(); return r; }); }}
            className="sg-btn-danger flex-1 py-2.5"
          >
            Abandon
          </button>
        </div>
      </Modal>

      {renderMatchOptions(current.innings.id)}
    </div>
  );
}

// ── helpers & sub-components ─────────────────────────────────────
function lineup(view: MV, teamId: string): Player[] {
  return view.matchPlayers
    .filter((mp) => mp.team_id === teamId)
    .map((mp) => view.playerById.get(mp.player_id))
    .filter(Boolean) as Player[];
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="rounded-xl bg-wicket-soft px-3 py-2 text-sm font-medium text-wicket-dark">{error}</p>;
}

function PlayerRow({ p, onClick, disabled, badge }: { p: Player; onClick: () => void; disabled?: boolean; badge?: string | null }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left transition ${
        badge ? "border-brand bg-brand-50" : "border-line bg-cream-200"
      } ${disabled ? "opacity-30" : "active:scale-[0.99]"}`}
    >
      <Avatar name={p.name} photo={p.photo_url} size={36} />
      <span className="flex-1 truncate text-sm font-medium text-ink">{p.nickname || p.name}</span>
      {badge && <span className="text-xs font-semibold text-brand-600">{badge}</span>}
    </button>
  );
}

function OpenerPicker({ players, busy, view, onPick }: { players: Player[]; busy: boolean; view: MV; onPick: (a: string, b: string) => void }) {
  const [striker, setStriker] = useState<string | null>(null);
  const [nonStriker, setNonStriker] = useState<string | null>(null);
  return (
    <div className="sg-card p-4">
      <h3 className="mb-1 font-display font-bold text-ink">Opening batsmen</h3>
      <p className="mb-3 text-xs text-ink-muted">Tap the striker first (●), then the non-striker.</p>
      <div className="max-h-72 space-y-1.5 overflow-y-auto">
        {players.map((p) => {
          const badge = p.id === striker ? "● striker" : p.id === nonStriker ? "non-striker" : null;
          return (
            <PlayerRow
              key={p.id}
              p={p}
              badge={badge}
              onClick={() => {
                if (p.id === striker) return setStriker(null);
                if (p.id === nonStriker) return setNonStriker(null);
                if (!striker) setStriker(p.id);
                else if (!nonStriker) setNonStriker(p.id);
              }}
            />
          );
        })}
      </div>
      <button disabled={busy || !striker || !nonStriker} onClick={() => striker && nonStriker && onPick(striker, nonStriker)} className="sg-btn-primary mt-3 w-full py-3">
        Confirm openers
      </button>
    </div>
  );
}

function SinglePicker({ title, players, busy, onPick }: { title: string; players: Player[]; busy: boolean; onPick: (id: string) => void }) {
  return (
    <div className="sg-card p-4">
      <h3 className="mb-3 font-display font-bold text-ink">{title}</h3>
      <div className="max-h-72 space-y-1.5 overflow-y-auto">
        {players.map((p) => (
          <PlayerRow key={p.id} p={p} disabled={busy} onClick={() => onPick(p.id)} />
        ))}
      </div>
    </div>
  );
}

function BowlerPicker({
  players,
  blockedIds,
  canUndo,
  busy,
  onUndoLastBall,
  onPick,
}: {
  players: Player[];
  blockedIds: string[];
  canUndo: boolean;
  busy: boolean;
  onUndoLastBall: () => void;
  onPick: (id: string) => void;
}) {
  const blocked = new Set(blockedIds);
  return (
    <div className="sg-card p-4">
      <h3 className="mb-3 font-display font-bold text-ink">Select bowler for this over</h3>
      <div className="max-h-72 space-y-1.5 overflow-y-auto">
        {players.map((p) => (
          <PlayerRow
            key={p.id}
            p={p}
            badge={blocked.has(p.id) ? "bowled last over" : null}
            disabled={busy || blocked.has(p.id)}
            onClick={() => onPick(p.id)}
          />
        ))}
      </div>
      {canUndo && (
        <button disabled={busy} onClick={onUndoLastBall} className="mt-3 w-full py-2.5 sg-btn-ghost text-sm">
          ↩ Undo last ball
        </button>
      )}
    </div>
  );
}

function ScoringPad({
  busy, disabled, onRun, onGully, onExtra, onWicket, onManage, onChangeBowler, onCatchDrop, onUndo, onAbandon,
}: {
  busy: boolean;
  disabled?: boolean;
  onRun: (n: number) => void;
  onGully: (n: number) => void;
  onExtra: (e: ExtraType) => void;
  onWicket: () => void;
  onManage: () => void;
  onChangeBowler: () => void;
  onCatchDrop: () => void;
  onUndo: () => void;
  onAbandon: () => void;
}) {
  const off = busy || !!disabled; // scoring buttons locked until warm / while busy
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2.5">
        {[0, 1, 2, 3, 4, 5, 6].map((n) => (
          <button
            key={n}
            disabled={off}
            onClick={() => onRun(n)}
            className={`sg-btn h-16 text-2xl font-bold ${
              n === 4 ? "bg-boundary text-white" : n === 6 ? "bg-brand text-brand-900 shadow-glow" : "border border-line bg-cream-200 text-ink"
            }`}
          >
            {n}
          </button>
        ))}
        <button disabled={off} onClick={onWicket} className="sg-btn-danger h-16 text-lg font-bold">OUT</button>
      </div>
      {/* Gully runs: credited to batsman + team, but strike stays put. */}
      <div className="grid grid-cols-2 gap-2.5">
        <button disabled={off} onClick={() => onGully(1)} className="sg-btn h-12 border border-brand/50 bg-brand-50 text-sm font-bold text-brand-700">
          1G <span className="font-normal text-ink-muted">· keep strike</span>
        </button>
        <button disabled={off} onClick={() => onGully(2)} className="sg-btn h-12 border border-brand/50 bg-brand-50 text-sm font-bold text-brand-700">
          2G <span className="font-normal text-ink-muted">· keep strike</span>
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2.5">
        <button disabled={off} onClick={() => onExtra("wide")} className="sg-btn-ghost h-12 text-sm">Wide</button>
        <button disabled={off} onClick={() => onExtra("no_ball")} className="sg-btn-ghost h-12 text-sm">No Ball</button>
        <button disabled={off} onClick={() => onExtra("bye")} className="sg-btn-ghost h-12 text-sm">Bye</button>
        <button disabled={off} onClick={() => onExtra("leg_bye")} className="sg-btn-ghost h-12 text-sm">Leg Bye</button>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        <button disabled={busy} onClick={onManage} className="sg-btn-ghost h-12 text-sm">⇄ Batsmen</button>
        <button disabled={off} onClick={onChangeBowler} className="sg-btn-ghost h-12 text-sm">⟳ Bowler</button>
        <button disabled={off} onClick={onCatchDrop} className="sg-btn-ghost h-12 text-sm">🧤 Drop</button>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <button disabled={busy} onClick={onUndo} className="sg-btn-ghost h-12 text-sm">↩ Undo</button>
        <button disabled={busy} onClick={onAbandon} className="sg-btn-ghost h-12 text-sm text-wicket">Abandon</button>
      </div>
    </div>
  );
}

function NumberRow({ options, value, onChange }: { options: number[]; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`sg-btn h-11 w-11 text-lg font-bold ${value === n ? "bg-brand text-brand-900" : "border border-line bg-cream-200 text-ink"}`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function ExtraModal({
  extra, onClose, busy, onSubmit,
}: {
  extra: ExtraType | null;
  onClose: () => void;
  busy: boolean;
  onSubmit: (p: DeliveryPayload) => void;
}) {
  const [runRun, setRunRun] = useState(0);
  const [batRuns, setBatRuns] = useState(0);
  const open = extra !== null;
  const reset = () => { setRunRun(0); setBatRuns(0); };
  const titles: Record<string, string> = { wide: "Wide", no_ball: "No Ball", bye: "Byes", leg_bye: "Leg Byes" };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title={extra ? titles[extra] : ""}>
      {extra === "wide" && (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">+1 run automatically. Add any runs the batsmen ran (or a boundary on the wide).</p>
          <NumberRow options={[0, 1, 2, 3, 4]} value={runRun} onChange={setRunRun} />
          <button disabled={busy} onClick={() => { onSubmit({ runs_off_bat: 0, extra_type: "wide", extra_runs: 1 + runRun, is_wicket: false }); reset(); }} className="sg-btn-primary w-full py-3">
            Record wide (+{1 + runRun})
          </button>
        </div>
      )}
      {extra === "no_ball" && (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">+1 run automatically. Add runs off the bat and any byes run.</p>
          <div><p className="sg-label">Runs off the bat</p><NumberRow options={[0, 1, 2, 3, 4, 5, 6]} value={batRuns} onChange={setBatRuns} /></div>
          <div><p className="sg-label">Byes run (optional)</p><NumberRow options={[0, 1, 2, 3, 4]} value={runRun} onChange={setRunRun} /></div>
          <button disabled={busy} onClick={() => { onSubmit({ runs_off_bat: batRuns, extra_type: "no_ball", extra_runs: 1 + runRun, is_wicket: false }); reset(); }} className="sg-btn-primary w-full py-3">
            Record no-ball
          </button>
        </div>
      )}
      {(extra === "bye" || extra === "leg_bye") && (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">Legal delivery — counts toward the over. How many were run?</p>
          <NumberRow options={[1, 2, 3, 4]} value={runRun || 1} onChange={setRunRun} />
          <button disabled={busy} onClick={() => { onSubmit({ runs_off_bat: 0, extra_type: extra, extra_runs: runRun || 1, is_wicket: false }); reset(); }} className="sg-btn-primary w-full py-3">
            Record {titles[extra].toLowerCase()}
          </button>
        </div>
      )}
    </Modal>
  );
}

function WicketModal({
  open, onClose, striker, nonStriker, fielders, freeHit, view, busy, onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  striker: string | null;
  nonStriker: string | null;
  fielders: Player[];
  freeHit: boolean;
  view: MV;
  busy: boolean;
  onSubmit: (p: DeliveryPayload) => void;
}) {
  const [type, setType] = useState<WicketType | null>(null);
  const [fielder, setFielder] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(striker);
  const [runOutRuns, setRunOutRuns] = useState(0);

  const types: WicketType[] = freeHit
    ? ["run_out", "obstructing"]
    : ["bowled", "caught", "lbw", "run_out", "stumped", "hit_wicket", "caught_and_bowled", "obstructing"];
  const needsFielder = type === "caught" || type === "stumped" || type === "run_out";
  const isRunOut = type === "run_out";
  const reset = () => { setType(null); setFielder(null); setDismissed(striker); setRunOutRuns(0); };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Wicket!">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {types.map((t) => (
            <button key={t} onClick={() => setType(t)} className={`rounded-xl border p-2.5 text-sm font-medium transition ${type === t ? "border-wicket bg-wicket-soft text-wicket-dark" : "border-line bg-cream-200 text-ink"}`}>
              {WICKET_LABELS[t]}
            </button>
          ))}
        </div>
        {isRunOut && (
          <>
            <div>
              <p className="sg-label">Who is out?</p>
              <div className="grid grid-cols-2 gap-2">
                {[striker, nonStriker].filter(Boolean).map((id) => (
                  <button key={id} onClick={() => setDismissed(id!)} className={`rounded-xl border p-2.5 text-sm transition ${dismissed === id ? "border-brand bg-brand-50" : "border-line bg-cream-200"}`}>
                    {playerName(view, id)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="sg-label">Runs completed before run-out</p>
              <NumberRow options={[0, 1, 2, 3]} value={runOutRuns} onChange={setRunOutRuns} />
            </div>
          </>
        )}
        {needsFielder && (
          <div>
            <p className="sg-label">{type === "stumped" ? "Keeper" : "Fielder"}{type === "run_out" ? " (optional)" : ""}</p>
            <Select
              value={fielder ?? ""}
              onChange={(v) => setFielder(v || null)}
              placeholder="Select…"
              options={fielders.map((f) => ({ value: f.id, label: f.nickname || f.name }))}
            />
          </div>
        )}
        <button
          disabled={busy || !type || ((type === "caught" || type === "stumped") && !fielder)}
          onClick={() => type && onSubmit({
            runs_off_bat: isRunOut ? runOutRuns : 0,
            extra_type: "none",
            extra_runs: 0,
            is_wicket: true,
            wicket_type: type,
            dismissed_player_id: isRunOut ? dismissed : striker,
            fielder_id: fielder,
          })}
          className="sg-btn-danger w-full py-3"
        >
          Confirm wicket
        </button>
      </div>
    </Modal>
  );
}

/**
 * Crease management: swap strike, replace an at-crease batsman with one from
 * the bench (or a returning retired-not-out batsman, choosing who takes
 * strike), or retire a batsman (not-out = can return, or out = counts as a
 * wicket). Covers the "a batsman bats a couple of balls then leaves" case.
 */
function ManageBatsmenModal({
  open, onClose, striker, nonStriker, bench, view, busy, onSwapStrike, onReplace, onRetire,
}: {
  open: boolean;
  onClose: () => void;
  striker: string | null;
  nonStriker: string | null;
  bench: Player[];
  view: MV;
  busy: boolean;
  onSwapStrike: () => void;
  onReplace: (outgoingId: string, incomingId: string, incomingOnStrike: boolean) => void;
  onRetire: (playerId: string, out: boolean) => void;
}) {
  const crease = [striker, nonStriker].filter(Boolean) as string[];
  const [mode, setMode] = useState<"home" | "replace" | "retire">("home");
  const [outgoing, setOutgoing] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<string | null>(null);
  const [onStrike, setOnStrike] = useState(true);

  const close = () => { setMode("home"); setOutgoing(null); setIncoming(null); setOnStrike(true); onClose(); };
  const bothIn = striker !== null && nonStriker !== null;

  return (
    <Modal open={open} onClose={close} title="Manage batsmen">
      {mode === "home" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-cream-200 p-3 text-sm">
            <div className="flex justify-between"><span className="text-ink">● {playerName(view, striker)}</span><span className="text-ink-muted">on strike</span></div>
            {nonStriker && <div className="mt-1 flex justify-between"><span className="text-ink">{playerName(view, nonStriker)}</span><span className="text-ink-muted">non-striker</span></div>}
          </div>
          <button disabled={busy || !bothIn} onClick={() => { onSwapStrike(); }} className="sg-btn-ghost w-full py-3 text-sm">
            ⇄ Swap strike
          </button>
          <button disabled={busy || crease.length === 0 || bench.length === 0} onClick={() => setMode("replace")} className="sg-btn-ghost w-full py-3 text-sm">
            ⟳ Replace a batsman
            <span className="block text-xs text-ink-muted">{bench.length === 0 ? "no bench batsmen available" : "sub in a bench / returning batsman"}</span>
          </button>
          <button disabled={busy || crease.length === 0} onClick={() => setMode("retire")} className="sg-btn-ghost w-full py-3 text-sm">
            🚪 Retire a batsman
          </button>
        </div>
      )}

      {mode === "replace" && (
        <div className="space-y-4">
          <div>
            <p className="sg-label">Who is leaving?</p>
            <div className="grid grid-cols-2 gap-2">
              {crease.map((id) => (
                <button key={id} onClick={() => setOutgoing(id)} className={`rounded-xl border p-2.5 text-sm transition ${outgoing === id ? "border-brand bg-brand-50" : "border-line bg-cream-200"}`}>
                  {playerName(view, id)}{id === striker ? " ●" : ""}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="sg-label">Who comes in?</p>
            <div className="max-h-48 space-y-1.5 overflow-y-auto">
              {bench.map((p) => (
                <PlayerRow key={p.id} p={p} badge={incoming === p.id ? "coming in" : null} onClick={() => setIncoming(p.id)} />
              ))}
            </div>
          </div>
          <label className="flex items-center justify-between rounded-xl border border-line bg-cream-200 p-3 text-sm">
            <span className="text-ink">New batsman takes strike</span>
            <input type="checkbox" checked={onStrike} onChange={(e) => setOnStrike(e.target.checked)} className="h-5 w-5 accent-brand" />
          </label>
          <div className="flex gap-2">
            <button onClick={() => setMode("home")} className="sg-btn-ghost flex-1 py-3">Back</button>
            <button disabled={busy || !outgoing || !incoming} onClick={() => outgoing && incoming && onReplace(outgoing, incoming, onStrike)} className="sg-btn-primary flex-1 py-3">
              Confirm
            </button>
          </div>
        </div>
      )}

      {mode === "retire" && (
        <div className="space-y-4">
          <div>
            <p className="sg-label">Who is retiring?</p>
            <div className="grid grid-cols-2 gap-2">
              {crease.map((id) => (
                <button key={id} onClick={() => setOutgoing(id)} className={`rounded-xl border p-2.5 text-sm transition ${outgoing === id ? "border-brand bg-brand-50" : "border-line bg-cream-200"}`}>
                  {playerName(view, id)}{id === striker ? " ●" : ""}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button disabled={busy || !outgoing} onClick={() => outgoing && onRetire(outgoing, false)} className="sg-btn-ghost py-3">
              Retired — not out<span className="block text-xs text-ink-muted">can return later</span>
            </button>
            <button disabled={busy || !outgoing} onClick={() => outgoing && onRetire(outgoing, true)} className="sg-btn-danger py-3">
              Retired out<span className="block text-xs opacity-80">counts as wicket</span>
            </button>
          </div>
          <button onClick={() => setMode("home")} className="sg-btn-ghost w-full py-3">Back</button>
        </div>
      )}
    </Modal>
  );
}

// ── optimistic engine helpers ────────────────────────────────────
// Mirror the server's field computation so the local bundle advances exactly
// like the DB will. Any drift is corrected by the reconcile refetch.
function maxSeq(b: MatchBundle): number {
  let m = 0;
  for (const d of b.deliveries) if (d.seq > m) m = d.seq;
  for (const e of b.events) if (e.seq > m) m = e.seq;
  return m;
}

function appendOptimisticDelivery(
  b: MatchBundle,
  payload: DeliveryPayload,
  bowler: string | null
): MatchBundle {
  const ci = buildMatchView(b).currentInnings;
  if (!ci) return b;
  const s = ci.state;
  if (!bowler || s.strikerId === null) return b; // let the server place it
  const legal = payload.extra_type === "none" || payload.extra_type === "bye" || payload.extra_type === "leg_bye";
  const seq = maxSeq(b) + 1;
  const d: Delivery = {
    id: `opt-d-${seq}`,
    seq,
    innings_id: ci.innings.id,
    over_number: s.currentOverNumber,
    ball_in_over: s.ballsThisOver + 1,
    legal_ball_number: s.legalBalls + (legal ? 1 : 0),
    bowler_id: bowler,
    striker_id: s.strikerId,
    non_striker_id: s.nonStrikerId ?? s.strikerId,
    runs_off_bat: payload.runs_off_bat,
    extra_type: payload.extra_type,
    extra_runs: payload.extra_runs,
    is_wicket: payload.is_wicket,
    wicket_type: payload.is_wicket ? payload.wicket_type ?? null : null,
    dismissed_player_id: payload.is_wicket ? payload.dismissed_player_id ?? s.strikerId : null,
    fielder_id: payload.fielder_id ?? null,
    is_free_hit: s.nextIsFreeHit,
    no_strike_change: payload.no_strike_change ?? false,
    created_at: new Date().toISOString(),
  };
  return { ...b, deliveries: [...b.deliveries, d] };
}

function appendOptimisticEvents(
  b: MatchBundle,
  inningsId: string,
  events: { player_id: string; event_type: BattingEventType; at_end?: string | null }[]
): MatchBundle {
  let seq = maxSeq(b);
  const rows: BattingEvent[] = events.map((e) => {
    seq += 1;
    return {
      id: `opt-e-${seq}`,
      seq,
      innings_id: inningsId,
      player_id: e.player_id,
      event_type: e.event_type,
      at_end: e.at_end ?? null,
      created_at: new Date().toISOString(),
    };
  });
  return { ...b, events: [...b.events, ...rows] };
}

/** Which empty end a next batsman should fill (mirrors selectNextBatsman). */
function nextEnd(b: MatchBundle): "striker" | "non_striker" {
  const s = buildMatchView(b).currentInnings?.state;
  if (!s) return "striker";
  return s.strikerId === null ? "striker" : s.nonStrikerId === null ? "non_striker" : "striker";
}

/** Mirror replaceBatsman: retire outgoing not-out, bring incoming in, set strike. */
function appendOptimisticReplace(
  b: MatchBundle,
  inningsId: string,
  outgoingId: string,
  incomingId: string,
  incomingOnStrike: boolean
): MatchBundle {
  const s = buildMatchView(b).currentInnings?.state;
  if (!s) return b;
  const outgoingWasStriker = s.strikerId === outgoingId;
  const events: { player_id: string; event_type: BattingEventType; at_end?: string | null }[] = [
    { player_id: outgoingId, event_type: "retired_not_out" },
    { player_id: incomingId, event_type: "in", at_end: outgoingWasStriker ? "striker" : "non_striker" },
  ];
  if (incomingOnStrike !== outgoingWasStriker) {
    events.push({ player_id: incomingId, event_type: "swap_strike" });
  }
  return appendOptimisticEvents(b, inningsId, events);
}

/** Optimistic undo: drop the single highest-seq row (delivery or batting event). */
function removeLastEvent(b: MatchBundle): MatchBundle {
  const lastD = b.deliveries.length ? b.deliveries[b.deliveries.length - 1] : null;
  const lastE = b.events.length ? b.events[b.events.length - 1] : null;
  const dSeq = lastD?.seq ?? -1;
  const eSeq = lastE?.seq ?? -1;
  if (dSeq < 0 && eSeq < 0) return b;
  if (dSeq >= eSeq) return { ...b, deliveries: b.deliveries.slice(0, -1) };
  return { ...b, events: b.events.slice(0, -1) };
}
