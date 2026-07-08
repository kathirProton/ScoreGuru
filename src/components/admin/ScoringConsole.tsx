"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";
import { fetchMatchBundle, MatchBundle } from "@/lib/cricket/load";
import { buildMatchView, playerName } from "@/lib/cricket/matchview";
import { Avatar, LiveDot } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { MatchHighlights } from "@/components/match/MatchHighlights";
import {
  recordDelivery,
  warmup,
  undoBall,
  undoLastBall,
  restartInnings,
  recordDroppedCatch,
  selectOpeningBatsmen,
  selectNextBatsman,
  retireBatsman,
  swapStrike,
  replaceBatsman,
  editDeliveryRuns,
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
import { bowlerOvers, planUndoBall } from "@/lib/cricket/engine";
import type { OverDelivery } from "@/lib/cricket/engine";

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
  // A batsman at the crease tapped for replace/retire (by player id).
  const [manageBatsman, setManageBatsman] = useState<{ id: string; isStriker: boolean } | null>(null);
  // A recorded ball tapped in the over-strip for re-scoring (by delivery id).
  const [selectedBallId, setSelectedBallId] = useState<string | null>(null);
  // Immersive/full-screen scoring (hides the admin chrome, fills the phone).
  const [immersive, setImmersive] = useState(false);
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

  // Full-screen scoring. Uses a fixed-inset overlay (reliable everywhere) and
  // best-effort asks the browser for real full-screen too (ignored on iOS).
  const toggleImmersive = useCallback(() => {
    setImmersive((on) => {
      const next = !on;
      try {
        if (next) document.documentElement.requestFullscreen?.().catch(() => {});
        else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      } catch {
        /* fullscreen API unavailable — the overlay alone is enough */
      }
      return next;
    });
  }, []);

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

  // Undo the last ball (optimistic, then persist). A wicket ball is reverted
  // together with the replacement batsman it forced in, so one tap restores the
  // exact pre-ball crease (out batsman un-marked and back in). Keeps the bowler
  // selection so undoing the first ball of an over doesn't re-prompt.
  const deleteLastBall = () =>
    mutate(
      (b) => applyOptimisticUndoBall(b, inningsId),
      () => undoBall(inningsId)
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

  // Re-score an already-recorded plain-bat ball (tap a ball in the over strip,
  // then tap a run). The engine re-derives strike/totals from the corrected log.
  const editBall = (deliveryId: string, runs: number) => {
    setSelectedBallId(null);
    mutate(
      (b) => applyOptimisticEditRuns(b, deliveryId, runs),
      () => editDeliveryRuns(deliveryId, runs)
    );
  };

  return (
    <div
      className={
        immersive
          ? "fixed inset-0 z-50 space-y-2.5 overflow-y-auto overscroll-contain bg-surface px-3 pb-6 pt-[max(env(safe-area-inset-top),3.25rem)] safe-bottom"
          : "space-y-3"
      }
    >
      <div className="flex items-center justify-end">
        <button onClick={toggleImmersive} className="sg-btn-ghost px-3 py-1.5 text-xs font-semibold">
          {immersive ? "⤡ Exit full screen" : "⤢ Full screen"}
        </button>
      </div>
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
        {/* Batsmen at the crease — tap the radio to set strike, tap the name to
            replace/retire that batsman. Bigger, thumb-friendly rows. */}
        <div className="mt-3 space-y-1.5">
          {[s.strikerId, s.nonStrikerId].map((id) => {
            if (!id) return null;
            const b = s.batsmen.find((x) => x.playerId === id);
            const isStriker = id === s.strikerId;
            const bothIn = s.strikerId !== null && s.nonStrikerId !== null;
            return (
              <div key={id} className="flex items-center gap-2.5">
                <button
                  aria-label={isStriker ? "on strike" : "put on strike"}
                  disabled={busy || !bothIn}
                  onClick={() => { if (!isStriker && bothIn) doSwapStrike(); }}
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition ${
                    isStriker ? "border-brand bg-brand" : "border-ink-faint"
                  }`}
                >
                  {isStriker && <span className="h-2 w-2 rounded-full bg-brand-900" />}
                </button>
                <button
                  disabled={busy}
                  onClick={() => setManageBatsman({ id, isStriker })}
                  className="min-w-0 flex-1 truncate rounded-xl border border-line bg-cream-200/70 px-3 py-2.5 text-left font-display text-xl font-bold capitalize leading-tight text-ink active:scale-[0.99]"
                >
                  {playerName(view, id)}
                </button>
                <span className="shrink-0 font-mono text-lg font-semibold text-ink-soft">
                  {b?.runs ?? 0} <span className="text-sm text-ink-muted">({b?.balls ?? 0})</span>
                </span>
              </div>
            );
          })}
          {bowlerForBall && (
            <button
              disabled={busy}
              onClick={() => setChangeBowlerOpen(true)}
              className="mt-1 flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-cream-200/50 px-3 py-2 text-left active:scale-[0.99]"
            >
              <span className="min-w-0 truncate font-display text-lg font-bold capitalize text-ink-soft">
                🎯 {playerName(view, bowlerForBall)}
                {!s.currentBowlerId && <span className="ml-1 text-xs font-normal normal-case text-ink-faint">· new over</span>}
              </span>
              <span className="shrink-0 font-mono text-sm text-ink-soft">
                {s.bowlers.find((x) => x.playerId === bowlerForBall)?.wickets ?? 0}/
                {s.bowlers.find((x) => x.playerId === bowlerForBall)?.runsConceded ?? 0} (
                {bowlerOvers(s.bowlers.find((x) => x.playerId === bowlerForBall)?.legalBalls ?? 0)})
              </span>
            </button>
          )}
        </div>
      </div>

      {/* This over — big tappable circles. Green = legal, red = wide/no-ball,
          dashed yellow = the ball about to be bowled. Tap a bat ball to re-score.
          Sits OUTSIDE the score card so the circles aren't clipped by its overflow. */}
      <BallsRound
        deliveries={s.thisOver}
        showNext={!s.isInningsOver && bowlerForBall !== null && s.strikerId !== null}
        selectedId={selectedBallId}
        disabled={busy}
        onSelect={(id) => setSelectedBallId((cur) => (cur === id ? null : id))}
      />

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
        <SinglePicker
          title="Select next batsman"
          players={availableBatsmen}
          busy={busy}
          onPick={pickNextBatsman}
          onCancel={deleteLastBall}
          cancelLabel="✕ Cancel — undo the wicket"
        />
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
          editing={selectedBallId !== null}
          onRun={(n) => {
            if (selectedBallId !== null) editBall(selectedBallId, n);
            else record({ runs_off_bat: n, extra_type: "none", extra_runs: 0, is_wicket: false });
          }}
          onCancelEdit={() => setSelectedBallId(null)}
          onGully={(n) => record({ runs_off_bat: n, extra_type: "none", extra_runs: 0, is_wicket: false, no_strike_change: true })}
          onExtra={setExtra}
          onWicket={() => setWicketOpen(true)}
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

      <BatsmanActionModal
        target={manageBatsman}
        onClose={() => setManageBatsman(null)}
        bench={availableBatsmen}
        view={view}
        busy={busy}
        onReplace={(outgoing, incoming, onStrike) => { setManageBatsman(null); doReplace(outgoing, incoming, onStrike); }}
        onRetire={(playerId, out) => { setManageBatsman(null); doRetire(playerId, out); }}
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
/** Title-case a name for contexts where CSS `capitalize` can't reach (e.g. modal titles). */
function capName(name: string): string {
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

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
      <span className="flex-1 truncate text-sm font-medium capitalize text-ink">{p.nickname || p.name}</span>
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

function SinglePicker({
  title, players, busy, onPick, onCancel, cancelLabel,
}: {
  title: string;
  players: Player[];
  busy: boolean;
  onPick: (id: string) => void;
  onCancel?: () => void;
  cancelLabel?: string;
}) {
  return (
    <div className="sg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-display font-bold text-ink">{title}</h3>
        {onCancel && (
          <button
            disabled={busy}
            onClick={onCancel}
            className="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-wicket hover:bg-cream-200"
          >
            ✕ Cancel
          </button>
        )}
      </div>
      <div className="max-h-72 space-y-1.5 overflow-y-auto">
        {players.map((p) => (
          <PlayerRow key={p.id} p={p} disabled={busy} onClick={() => onPick(p.id)} />
        ))}
      </div>
      {onCancel && (
        <button disabled={busy} onClick={onCancel} className="sg-btn-ghost mt-3 w-full py-2.5 text-sm">
          {cancelLabel ?? "✕ Cancel — undo the last ball"}
        </button>
      )}
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
  busy, disabled, editing, onRun, onCancelEdit, onGully, onExtra, onWicket, onCatchDrop, onUndo, onAbandon,
}: {
  busy: boolean;
  disabled?: boolean;
  editing: boolean;
  onRun: (n: number) => void;
  onCancelEdit: () => void;
  onGully: (n: number) => void;
  onExtra: (e: ExtraType) => void;
  onWicket: () => void;
  onCatchDrop: () => void;
  onUndo: () => void;
  onAbandon: () => void;
}) {
  const off = busy || !!disabled; // scoring buttons locked until warm / while busy
  const otherOff = off || editing; // non-run controls are disabled while re-scoring a ball
  return (
    <div className="space-y-2">
      {editing && (
        <div className="flex items-center justify-between rounded-xl border border-gold/50 bg-gold-soft px-3 py-2 text-sm">
          <span className="font-semibold text-gold-dark">Re-scoring a ball — tap the correct runs</span>
          <button onClick={onCancelEdit} className="text-xs font-semibold text-gold-dark underline">Cancel</button>
        </div>
      )}
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3, 4, 5, 6].map((n) => (
          <button
            key={n}
            disabled={off}
            onClick={() => onRun(n)}
            className={`sg-btn h-14 text-2xl font-bold ${
              editing
                ? "border-2 border-gold bg-gold-soft text-gold-dark"
                : n === 4
                ? "bg-boundary text-white"
                : n === 6
                ? "bg-brand text-brand-900 shadow-glow"
                : "border border-line bg-cream-200 text-ink"
            }`}
          >
            {n}
          </button>
        ))}
        <button disabled={otherOff} onClick={onWicket} className="sg-btn-danger h-14 text-lg font-bold">OUT</button>
      </div>
      {/* Gully runs: credited to batsman + team, but strike stays put. */}
      <div className="grid grid-cols-4 gap-2">
        <button disabled={otherOff} onClick={() => onGully(1)} className="sg-btn-ghost h-11 text-sm font-bold">1G</button>
        <button disabled={otherOff} onClick={() => onGully(2)} className="sg-btn-ghost h-11 text-sm font-bold">2G</button>
        <button disabled={otherOff} onClick={() => onExtra("wide")} className="sg-btn-ghost h-11 text-sm">Wide</button>
        <button disabled={otherOff} onClick={() => onExtra("no_ball")} className="sg-btn-ghost h-11 text-sm">No Ball</button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <button disabled={otherOff} onClick={() => onExtra("bye")} className="sg-btn-ghost h-11 text-sm">Bye</button>
        <button disabled={otherOff} onClick={() => onExtra("leg_bye")} className="sg-btn-ghost h-11 text-sm">Leg Bye</button>
        <button disabled={otherOff} onClick={onCatchDrop} className="sg-btn-ghost h-11 text-sm">Catch Drop</button>
        <button disabled={busy || editing} onClick={onUndo} className="sg-btn-ghost h-11 text-sm">
          <span className="font-bold text-wicket">✕</span>&nbsp;Undo
        </button>
      </div>
      <div className="grid grid-cols-1">
        <button disabled={busy || editing} onClick={onAbandon} className="sg-btn-ghost h-10 text-xs text-wicket">Abandon match</button>
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
                  <button key={id} onClick={() => setDismissed(id!)} className={`rounded-xl border p-2.5 text-sm capitalize transition ${dismissed === id ? "border-brand bg-brand-50" : "border-line bg-cream-200"}`}>
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
              options={fielders.map((f) => ({ value: f.id, label: capName(f.nickname || f.name) }))}
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
/**
 * The over so far, as big tappable circles. Green border = legal ball,
 * red border = wide/no-ball, dashed yellow = the ball about to be bowled.
 * Tapping a plain bat delivery selects it (yellow) so a run can be re-scored.
 */
function BallsRound({
  deliveries, showNext, selectedId, disabled, onSelect,
}: {
  deliveries: OverDelivery[];
  showNext: boolean;
  selectedId: string | null;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  if (deliveries.length === 0 && !showNext) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 px-1">
      {deliveries.map((d) => {
        const selected = d.id === selectedId;
        const canEdit = d.editable && !d.id.startsWith("opt-");
        const border = selected
          ? "border-gold ring-2 ring-gold/50"
          : d.isWicket || !d.legal
          ? "border-wicket"
          : "border-brand";
        const text = selected ? "text-gold-dark" : d.isWicket || !d.legal ? "text-wicket" : "text-ink";
        return (
          <button
            key={d.id}
            disabled={disabled || !canEdit}
            onClick={() => canEdit && onSelect(d.id)}
            className={`grid h-11 min-w-[2.75rem] place-items-center rounded-full border-2 bg-surface px-1.5 text-sm font-bold tabular-nums transition disabled:opacity-100 ${border} ${text} ${canEdit ? "active:scale-95" : "cursor-default"}`}
          >
            {d.chip}
          </button>
        );
      })}
      {showNext && (
        <span
          aria-label="next ball"
          className="grid h-11 w-11 place-items-center rounded-full border-2 border-dashed border-gold/70"
        >
          <span className="h-2 w-2 rounded-full bg-gold/70" />
        </span>
      )}
    </div>
  );
}

/**
 * Actions for a single batsman tapped at the crease: replace them with a bench
 * / returning batsman (choosing who takes strike), or retire them (not-out =
 * can return, or out = counts as a wicket). Strike itself is set from the score
 * header's radio, so there's no swap control here.
 */
function BatsmanActionModal({
  target, onClose, bench, view, busy, onReplace, onRetire,
}: {
  target: { id: string; isStriker: boolean } | null;
  onClose: () => void;
  bench: Player[];
  view: MV;
  busy: boolean;
  onReplace: (outgoingId: string, incomingId: string, incomingOnStrike: boolean) => void;
  onRetire: (playerId: string, out: boolean) => void;
}) {
  const [incoming, setIncoming] = useState<string | null>(null);
  const [onStrike, setOnStrike] = useState(true);
  const [mode, setMode] = useState<"home" | "replace">("home");

  useEffect(() => {
    setIncoming(null);
    setMode("home");
    setOnStrike(target?.isStriker ?? true);
  }, [target]);

  const name = target ? playerName(view, target.id) : "";
  return (
    <Modal open={target !== null} onClose={onClose} title={`Change ${capName(name)}`}>
      {target && mode === "home" && (
        <div className="space-y-2.5">
          <button
            disabled={busy || bench.length === 0}
            onClick={() => setMode("replace")}
            className="block w-full rounded-xl border border-line bg-cream-200 p-3 text-left transition active:scale-[0.99] disabled:opacity-40"
          >
            <span className="block font-semibold text-ink">⟳ Replace batsman</span>
            <span className="mt-0.5 block text-xs leading-snug text-ink-muted">
              {bench.length === 0 ? "no bench / returning batsmen available" : "bring in a new or returning batsman"}
            </span>
          </button>
          <button
            disabled={busy}
            onClick={() => onRetire(target.id, false)}
            className="block w-full rounded-xl border border-line bg-cream-200 p-3 text-left transition active:scale-[0.99] disabled:opacity-40"
          >
            <span className="block font-semibold text-ink">Retire — not out</span>
            <span className="mt-0.5 block text-xs leading-snug text-ink-muted">keeps their score, can return later</span>
          </button>
          <button
            disabled={busy}
            onClick={() => onRetire(target.id, true)}
            className="block w-full rounded-xl border border-wicket/40 bg-wicket-soft p-3 text-left transition active:scale-[0.99] disabled:opacity-40"
          >
            <span className="block font-semibold text-wicket-dark">Retire out</span>
            <span className="mt-0.5 block text-xs leading-snug text-wicket-dark/80">counts as a wicket</span>
          </button>
          <button onClick={onClose} className="sg-btn-ghost w-full py-2.5 text-sm">Cancel</button>
        </div>
      )}
      {target && mode === "replace" && (
        <div className="space-y-4">
          <p className="sg-label capitalize">Who comes in for {name}?</p>
          <div className="max-h-56 space-y-1.5 overflow-y-auto">
            {bench.map((p) => (
              <PlayerRow key={p.id} p={p} badge={incoming === p.id ? "coming in" : null} onClick={() => setIncoming(p.id)} />
            ))}
          </div>
          <label className="flex items-center justify-between rounded-xl border border-line bg-cream-200 p-3 text-sm">
            <span className="text-ink">New batsman takes strike</span>
            <input type="checkbox" checked={onStrike} onChange={(e) => setOnStrike(e.target.checked)} className="h-5 w-5 accent-brand" />
          </label>
          <div className="flex gap-2">
            <button onClick={() => setMode("home")} className="sg-btn-ghost flex-1 py-3">Back</button>
            <button
              disabled={busy || !incoming}
              onClick={() => incoming && onReplace(target.id, incoming, onStrike)}
              className="sg-btn-primary flex-1 py-3"
            >
              Confirm
            </button>
          </div>
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

/** Mirror editDeliveryRuns: correct one recorded delivery's off-the-bat runs. */
function applyOptimisticEditRuns(b: MatchBundle, deliveryId: string, runs: number): MatchBundle {
  return {
    ...b,
    deliveries: b.deliveries.map((d) =>
      d.id === deliveryId && d.extra_type === "none" && !d.is_wicket
        ? { ...d, runs_off_bat: runs }
        : d
    ),
  };
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

/**
 * Optimistic undo mirroring the server's undoBall: removes the last ball and,
 * if it was a wicket, the replacement batsman that came in with it — using the
 * same planUndoBall rule so the local state matches what the DB will hold.
 */
function applyOptimisticUndoBall(b: MatchBundle, inningsId: string): MatchBundle {
  const deliveries = b.deliveries.filter((d) => d.innings_id === inningsId);
  const events = b.events.filter((e) => e.innings_id === inningsId);
  const plan = planUndoBall(deliveries, events);
  const dropD = new Set(plan.deliveryIds);
  const dropE = new Set(plan.eventIds);
  if (dropD.size === 0 && dropE.size === 0) return b;
  return {
    ...b,
    deliveries: b.deliveries.filter((d) => !dropD.has(d.id)),
    events: b.events.filter((e) => !dropE.has(e.id)),
  };
}
