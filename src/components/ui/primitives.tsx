import Image from "next/image";
import { initials } from "@/lib/format";

export function Avatar({
  name,
  photo,
  size = 44,
  ring,
}: {
  name: string;
  photo?: string | null;
  size?: number;
  ring?: boolean;
}) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-brand-700 font-semibold ${
        ring ? "ring-2 ring-brand ring-offset-2 ring-offset-cream" : ""
      }`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {photo ? (
        <Image src={photo} alt={name} fill className="object-cover" sizes={`${size}px`} />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} />;
}

export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <h2 className="font-display text-lg font-bold text-ink tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  subtitle,
  icon = "🏏",
}: {
  title: string;
  subtitle?: string;
  icon?: string;
}) {
  return (
    <div className="sg-card flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span className="text-4xl" aria-hidden>
        {icon}
      </span>
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      {subtitle && <p className="text-sm text-ink-muted max-w-xs">{subtitle}</p>}
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "brand" | "gold" | "wicket" | "boundary";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-cream-200 text-ink-soft",
    brand: "bg-brand-100 text-brand-700",
    gold: "bg-gold-soft text-gold-dark",
    wicket: "bg-wicket-soft text-wicket-dark",
    boundary: "bg-blue-50 text-boundary",
  };
  return (
    <span className={`sg-chip px-2.5 py-1 ${tones[tone]}`}>{children}</span>
  );
}

export function LiveDot() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-wicket opacity-70" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-wicket" />
    </span>
  );
}
