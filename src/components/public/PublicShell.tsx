import Link from "next/link";
import { BrandWordmark } from "@/components/ui/Brand";
import { BottomNav } from "./BottomNav";

const desktopLinks = [
  { href: "/live", label: "Live" },
  { href: "/matches", label: "Matches" },
  { href: "/players", label: "Players" },
  { href: "/stats", label: "Stats" },
  { href: "/submit-player", label: "Submit" },
];

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-cream/85 backdrop-blur-lg safe-top">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <BrandWordmark />
          <nav className="hidden items-center gap-1 md:flex">
            {desktopLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-cream-200 hover:text-ink transition"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/admin"
              className="ml-2 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-soft hover:bg-cream-200 transition"
            >
              Admin
            </Link>
          </nav>
          <Link
            href="/submit-player"
            className="sg-btn-primary px-3 py-2 text-sm md:hidden"
          >
            + Player
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-5 md:pb-12">{children}</main>

      <BottomNav />
    </div>
  );
}
