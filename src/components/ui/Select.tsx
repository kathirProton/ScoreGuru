"use client";
import { useEffect, useRef, useState } from "react";
import { notePopoverClose } from "./popover";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Website-styled dropdown replacing the native <select> (which renders in the
 * OS/browser chrome). Expands in-flow so it's never clipped inside a scrolling
 * modal. Closes on outside click / Escape.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  className = "",
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        notePopoverClose(); // tell the modal backdrop to ignore this click
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="sg-input flex items-center justify-between gap-2 text-left disabled:opacity-40"
      >
        <span className={`truncate ${selected ? "text-ink" : "text-ink-faint"}`}>
          {selected?.label ?? placeholder}
        </span>
        <span className={`shrink-0 text-ink-muted transition ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-line bg-surface-raised p-1 shadow-lift">
          {options.map((o) => (
            <button
              type="button"
              key={o.value}
              disabled={o.disabled}
              onClick={() => {
                if (o.disabled) return;
                onChange(o.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                o.value === value ? "bg-brand-50 text-brand-700" : "text-ink hover:bg-cream-300"
              } ${o.disabled ? "cursor-not-allowed opacity-30" : ""}`}
            >
              <span className="truncate">{o.label}</span>
              {o.value === value && <span className="ml-2 text-brand-600">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
