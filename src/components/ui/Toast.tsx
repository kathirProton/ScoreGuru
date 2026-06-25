"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

export type ToastTone = "success" | "error" | "info";

export function Toast({
  message,
  tone = "success",
  onDone,
  duration = 2600,
}: {
  message: string | null;
  tone?: ToastTone;
  onDone: () => void;
  duration?: number;
}) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, duration);
    return () => clearTimeout(t);
  }, [message, duration, onDone]);

  const tones: Record<ToastTone, string> = {
    success: "bg-brand-600 text-white",
    error: "bg-wicket text-white",
    info: "bg-ink text-white",
  };
  const icon = tone === "success" ? "✓" : tone === "error" ? "!" : "i";

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ y: 60, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 30, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
          className="fixed inset-x-0 bottom-24 z-[60] mx-auto flex w-fit max-w-[90vw] items-center gap-2.5 rounded-full px-5 py-3 shadow-lift md:bottom-8"
          role="status"
          aria-live="polite"
        >
          <span className={`absolute inset-0 -z-10 rounded-full ${tones[tone]}`} />
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-xs font-bold text-white">
            {icon}
          </span>
          <span className="text-sm font-semibold text-white">{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
