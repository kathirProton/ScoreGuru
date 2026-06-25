import Link from "next/link";
import { BrandMark } from "@/components/ui/Brand";
import { logoutAction } from "@/lib/actions/auth";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/players", label: "Players" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/matches/new", label: "New Match" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-cream/90 backdrop-blur-lg safe-top">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="flex items-center gap-2">
            <BrandMark size={32} />
            <span className="font-display font-bold text-ink">
              Admin<span className="text-brand-600">·</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-cream-200 hover:text-ink"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <form action={logoutAction}>
            <button className="sg-btn-ghost px-3 py-1.5 text-sm">Log out</button>
          </form>
        </div>
        <nav className="flex gap-1 overflow-x-auto no-scrollbar border-t border-line px-3 py-2 sm:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-cream-200"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-5">{children}</main>
    </div>
  );
}
