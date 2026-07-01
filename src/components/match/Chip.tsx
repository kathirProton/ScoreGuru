import type { OverDelivery } from "@/lib/cricket/engine";

export function BallChip({ d, size = "md" }: { d: OverDelivery; size?: "sm" | "md" }) {
  let cls = "bg-cream-200 text-ink-soft";
  if (d.isWicket) cls = "bg-wicket text-white";
  else if (d.isBoundary6) cls = "bg-brand text-brand-900";
  else if (d.isBoundary4) cls = "bg-boundary text-white";
  else if (d.isExtra) cls = "bg-gold-soft text-gold-dark ring-1 ring-gold/40";
  else if (d.runs === 0) cls = "bg-cream-300 text-ink-faint";
  else cls = "bg-cream-200 text-ink border border-line";

  const dim = size === "sm" ? "h-7 min-w-7 text-[11px] px-1.5" : "h-9 min-w-9 text-sm px-2";
  return <span className={`sg-chip ${dim} ${cls}`}>{d.chip}</span>;
}
