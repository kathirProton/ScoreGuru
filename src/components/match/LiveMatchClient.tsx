"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { fetchMatchBundle, MatchBundle } from "@/lib/cricket/load";
import { buildMatchView } from "@/lib/cricket/matchview";
import { playerName } from "@/lib/cricket/matchview";
import type { MatchView } from "@/lib/cricket/matchview";
import { matchHighlights } from "@/lib/cricket/highlights";
import type { Delivery } from "@/lib/types";
import { LivePanel } from "./LivePanel";
import { Scorecard } from "./Scorecard";
import { OverLog } from "./OverLog";
import { MatchHighlights } from "./MatchHighlights";
import { ScoreCelebration, CelebrationEvent } from "./ScoreCelebration";

function celebrationType(d: Delivery): CelebrationEvent["type"] | null {
  if (d.is_wicket) return "wicket";
  if (d.extra_type !== "wide" && d.runs_off_bat === 6) return "six";
  if (d.extra_type !== "wide" && d.runs_off_bat === 4) return "four";
  return null;
}

export function LiveMatchClient({ initial }: { initial: MatchBundle }) {
  const [bundle, setBundle] = useState<MatchBundle>(initial);
  const matchId = initial.match.id;
  const refetching = useRef(false);

  const refetch = useCallback(async () => {
    if (refetching.current) return;
    refetching.current = true;
    try {
      const fresh = await fetchMatchBundle(getBrowserClient(), matchId);
      if (fresh) setBundle(fresh);
    } finally {
      refetching.current = false;
    }
  }, [matchId]);

  useEffect(() => {
    const supabase = getBrowserClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const ping = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refetch, 180);
    };
    const channel = supabase
      .channel(`match-${matchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, ping)
      .on("postgres_changes", { event: "*", schema: "public", table: "batting_events" }, ping)
      .on("postgres_changes", { event: "*", schema: "public", table: "innings" }, ping)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `id=eq.${matchId}` },
        ping
      )
      .subscribe();

    // safety poll every 12s in case a realtime event is missed
    const poll = setInterval(refetch, 12000);

    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [matchId, refetch]);

  const view = useMemo(() => buildMatchView(bundle), [bundle]);
  const isLive = ["live", "super_over", "innings_break"].includes(view.match.status);

  // Celebrate the newest boundary / wicket with a center-stage burst. We track
  // the latest delivery seq and only fire for balls that arrive after mount
  // (so opening the page doesn't replay the last ball).
  const [celebration, setCelebration] = useState<CelebrationEvent | null>(null);
  const lastSeqRef = useRef<number | null>(null);
  useEffect(() => {
    const ds = bundle.deliveries;
    if (ds.length === 0) return;
    const latest = ds.reduce((m, d) => (d.seq > m.seq ? d : m));
    if (lastSeqRef.current === null) {
      lastSeqRef.current = latest.seq;
      return;
    }
    if (latest.seq > lastSeqRef.current) {
      lastSeqRef.current = latest.seq;
      const type = celebrationType(latest);
      if (type) setCelebration({ type, key: latest.seq });
    }
  }, [bundle]);
  useEffect(() => {
    if (!celebration) return;
    const t = setTimeout(() => setCelebration(null), 1800);
    return () => clearTimeout(t);
  }, [celebration]);

  return (
    <div className="space-y-6">
      <ScoreCelebration event={celebration} />
      {isLive && view.currentInnings && <LivePanel view={view} />}

      {view.match.status === "innings_break" && (
        <div className="sg-card bg-gold-soft border-gold/30 p-4 text-center">
          <p className="font-display font-bold text-gold-dark">Innings Break</p>
          <p className="text-sm text-ink-soft">
            Target {((view.currentInnings?.state.target) ?? 0)} — second innings about to begin.
          </p>
        </div>
      )}

      {["completed", "abandoned"].includes(view.match.status) ? (
        <MatchHighlights view={view} />
      ) : (
        <LiveHighlights view={view} />
      )}

      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-ink">Scorecard</h2>
        <Scorecard view={view} />
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-ink">Ball by ball</h2>
        <OverLog view={view} />
      </section>
    </div>
  );
}

/** Compact live "match so far" stats — top score & top partnership. */
function LiveHighlights({ view }: { view: MatchView }) {
  const h = matchHighlights(view);
  if (!h.topScore && !h.topPartnership) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {h.topScore && (
        <div className="sg-card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Top score so far</p>
          <p className="mt-1 font-display text-lg font-bold text-ink">
            {playerName(view, h.topScore.playerId)}{" "}
            <span className="font-mono text-brand-600">{h.topScore.runs}</span>
            <span className="text-sm font-normal text-ink-muted"> ({h.topScore.balls})</span>
          </p>
        </div>
      )}
      {h.topPartnership && h.topPartnership.a && h.topPartnership.b && (
        <div className="sg-card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Best partnership</p>
          <p className="mt-1 font-display text-lg font-bold text-ink">
            <span className="font-mono text-brand-600">{h.topPartnership.runs}</span>{" "}
            <span className="text-sm font-normal text-ink-muted">
              — {playerName(view, h.topPartnership.a)} &amp; {playerName(view, h.topPartnership.b)}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
