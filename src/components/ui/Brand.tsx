import Link from "next/link";

export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <span
      className="relative inline-flex items-center justify-center rounded-2xl bg-brand shadow-glow"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* cricket ball seam motif */}
      <svg viewBox="0 0 32 32" width={size * 0.62} height={size * 0.62} fill="none">
        <circle cx="16" cy="16" r="13" fill="#fffdf1" />
        <path
          d="M9 6.5c4 3.2 4 16 0 19M23 6.5c-4 3.2-4 16 0 19"
          stroke="#16231a"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="1.6 2.4"
        />
        <path d="M16 4v24" stroke="#2F8526" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function BrandWordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5 group">
      <BrandMark size={36} />
      <span className="font-display text-xl font-bold tracking-tight text-ink leading-none">
        Score<span className="text-brand-600">Guru</span>
      </span>
    </Link>
  );
}
