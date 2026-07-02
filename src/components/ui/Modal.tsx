"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { popoverJustClosed } from "./popover";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => { if (!popoverJustClosed()) onClose(); }}
          />
          <motion.div
            className="relative z-10 max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl border border-line bg-cream p-5 shadow-lift sm:max-w-md sm:rounded-3xl"
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            {title && (
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
                <button onClick={onClose} className="rounded-full p-1.5 text-ink-muted hover:bg-cream-200">
                  ✕
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
