"use client";
import { AnimatePresence, motion } from "framer-motion";
import type { MatchView } from "@/lib/cricket/matchview";
import { playerName } from "@/lib/cricket/matchview";
import { strikeRate, economy, bowlerOvers } from "@/lib/cricket/engine";
import { BallChip } from "./Chip";
import { fmt1, fmt2 } from "@/lib/format";
import { LiveDot } from "@/components/ui/primitives";

export function LivePanel({ view }: { view: MatchView }) {
  const iv = view.currentInnings;
  if (!iv) return null;
  const s = iv.state;
  const striker = s.batsmen.find((b) => b.playerId === s.strikerId);
  const nonStriker = s.batsmen.find((b) => b.playerId === s.nonStrikerId);
  const bowler = s.bowlers.find((b) => b.playerId === s.currentBowlerId);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-brand-500/15 via-cream-100 to-cream-200 p-5 shadow-card">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand/15 blur-2xl" />

      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="font-display font-bold text-ink">{iv.battingTeam?.name}</span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-wicket">
            <LiveDot /> {iv.innings.is_super_over ? "SUPER OVER" : "LIVE"}
          </span>
        </div>

        <div className="mt-1 flex items-end gap-2">
          <AnimatePresence mode="popLayout">
            <motion.span
              key={s.totalRuns}
              initial={{ y: 14, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
              className="font-display text-5xl font-bold tabular-nums leading-none text-ink"
            >
              {s.totalRuns}
            </motion.span>
          </AnimatePresence>
          <span className="font-display text-3xl font-bold text-ink-muted">/{s.wickets}</span>
          <span className="mb-1 font-mono text-lg text-ink-muted">({s.oversDisplay})</span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
          <span>CRR <b className="text-ink">{fmt1(s.runRate)}</b></span>
          {s.target != null && (
            <>
              <span>Target <b className="text-ink">{s.target}</b></span>
              <span className="font-medium text-brand-700">
                Need {s.runsNeeded} off {s.ballsRemaining}
              </span>
              {s.requiredRunRate != null && <span>RRR <b className="text-ink">{fmt1(s.requiredRunRate)}</b></span>}
            </>
          )}
        </div>

        {s.nextIsFreeHit && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-gold px-3 py-1 text-xs font-bold uppercase tracking-wide text-cream-50 shadow-sm"
          >
            ⚡ Free Hit
          </motion.div>
        )}

        {/* Batsmen */}
        <div className="mt-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {[striker, nonStriker].map(
            (b, i) =>
              b && (
                <div
                  key={b.playerId}
                  className="flex items-center justify-between rounded-xl bg-cream-200/60 px-3 py-2"
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                    {i === 0 && <span className="text-brand-600">●</span>}
                    {playerName(view, b.playerId)}
                  </span>
                  <span className="font-mono text-sm tabular-nums text-ink-soft">
                    {b.runs} <span className="text-ink-faint">({b.balls})</span>
                    <span className="ml-2 text-xs text-ink-faint">SR {fmt1(strikeRate(b.runs, b.balls))}</span>
                  </span>
                </div>
              )
          )}
        </div>

        {/* Bowler */}
        {bowler && (
          <div className="mt-1.5 flex items-center justify-between rounded-xl bg-cream-200/60 px-3 py-2">
            <span className="text-sm font-medium text-ink">🎯 {playerName(view, bowler.playerId)}</span>
            <span className="font-mono text-sm tabular-nums text-ink-soft">
              {bowler.wickets}/{bowler.runsConceded}{" "}
              <span className="text-ink-faint">({bowlerOvers(bowler.legalBalls)})</span>
              <span className="ml-2 text-xs text-ink-faint">Econ {fmt2(economy(bowler.runsConceded, bowler.legalBalls))}</span>
            </span>
          </div>
        )}

        {/* This over */}
        <div className="mt-4">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
            This over
          </div>
          <div className="flex flex-wrap gap-1.5">
            {s.thisOver.length > 0 ? (
              s.thisOver.map((d) => <BallChip key={d.id} d={d} />)
            ) : (
              <span className="text-sm text-ink-faint">Over not started</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
