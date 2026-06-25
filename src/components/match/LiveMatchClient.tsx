"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { fetchMatchBundle, MatchBundle } from "@/lib/cricket/load";
import { buildMatchView } from "@/lib/cricket/matchview";
import { LivePanel } from "./LivePanel";
import { Scorecard } from "./Scorecard";
import { OverLog } from "./OverLog";

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

  return (
    <div className="space-y-6">
      {isLive && view.currentInnings && <LivePanel view={view} />}

      {view.match.status === "innings_break" && (
        <div className="sg-card bg-gold-soft border-gold/30 p-4 text-center">
          <p className="font-display font-bold text-gold-dark">Innings Break</p>
          <p className="text-sm text-ink-soft">
            Target {((view.currentInnings?.state.target) ?? 0)} — second innings about to begin.
          </p>
        </div>
      )}

      {view.match.result_text && (
        <div className="sg-card border-brand/30 bg-brand-50 p-4 text-center">
          <p className="font-display text-lg font-bold text-brand-700">{view.match.result_text}</p>
          {view.match.potm_player_id && (
            <p className="mt-1 text-sm text-ink-soft">
              ⭐ Player of the Match:{" "}
              <span className="font-semibold text-ink">
                {view.playerById.get(view.match.potm_player_id)?.name}
              </span>
            </p>
          )}
        </div>
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
