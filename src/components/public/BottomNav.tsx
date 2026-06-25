"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/live", label: "Live", icon: LiveIcon },
  { href: "/matches", label: "Matches", icon: MatchIcon },
  { href: "/players", label: "Players", icon: PlayersIcon },
  { href: "/stats", label: "Stats", icon: StatsIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-cream/90 backdrop-blur-lg safe-bottom md:hidden">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2">
        {items.map((it) => {
          const active = isActive(it.href);
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className="flex flex-1 flex-col items-center gap-1 py-2.5 active:scale-95 transition"
            >
              <Icon active={active} />
              <span
                className={`text-[10px] font-medium ${
                  active ? "text-brand-600" : "text-ink-faint"
                }`}
              >
                {it.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function base(active: boolean) {
  return active ? "#2F8526" : "#9AA79B";
}
function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" stroke={base(active)} strokeWidth="1.8" strokeLinejoin="round" fill={active ? "#D6F5CF" : "none"} />
    </svg>
  );
}
function LiveIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" fill={base(active)} />
      <path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8" stroke={base(active)} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function MatchIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" stroke={base(active)} strokeWidth="1.8" fill={active ? "#D6F5CF" : "none"} />
      <path d="M7 9h10M7 13h7" stroke={base(active)} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function PlayersIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.4" stroke={base(active)} strokeWidth="1.8" fill={active ? "#D6F5CF" : "none"} />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke={base(active)} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function StatsIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M5 19V11M12 19V5M19 19v-6" stroke={base(active)} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
