"use client";
import { AnimatePresence, motion } from "framer-motion";

export interface CelebrationEvent {
  type: "six" | "four" | "wicket";
  key: number;
}

const CONFIG: Record<CelebrationEvent["type"], { big: string; caption: string; color: string; glow: string }> = {
  six: { big: "6", caption: "SIXER!", color: "#2BEE34", glow: "rgba(43,238,52,0.55)" },
  four: { big: "4", caption: "FOUR!", color: "#3D9BFF", glow: "rgba(61,155,255,0.55)" },
  wicket: { big: "OUT", caption: "WICKET!", color: "#FF5147", glow: "rgba(255,81,71,0.55)" },
};

/**
 * Full-screen, center-stage celebration that pops when a boundary or wicket is
 * scored. pointer-events-none so it never blocks the page. The parent supplies
 * an `event` with a changing `key` and clears it after the animation.
 */
export function ScoreCelebration({ event }: { event: CelebrationEvent | null }) {
  return (
    <AnimatePresence>
      {event && (
        <motion.div
          key={event.key}
          className="pointer-events-none fixed inset-0 z-[55] flex flex-col items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="absolute h-72 w-72 rounded-full blur-3xl"
            style={{ background: CONFIG[event.type].glow }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.7, 1.3], opacity: [0, 0.9, 0.5] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          />
          <motion.div
            initial={{ scale: 0.2, rotate: -18, opacity: 0 }}
            animate={{ scale: [0.2, 1.3, 1], rotate: [-18, 6, 0], opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0, y: -30 }}
            transition={{ duration: 0.55, ease: "easeOut", times: [0, 0.6, 1] }}
            className="relative font-display font-black leading-none tabular-nums"
            style={{ color: CONFIG[event.type].color, fontSize: "min(44vw, 18rem)", textShadow: `0 0 55px ${CONFIG[event.type].glow}` }}
          >
            {CONFIG[event.type].big}
          </motion.div>
          <motion.p
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.12, duration: 0.3 }}
            className="relative -mt-2 font-display text-2xl font-black uppercase tracking-[0.3em] sm:text-4xl"
            style={{ color: CONFIG[event.type].color }}
          >
            {CONFIG[event.type].caption}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
