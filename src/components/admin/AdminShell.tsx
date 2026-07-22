"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/admin/roles";

const NAV = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/usage", label: "Usage" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/plans", label: "Plans" },
  { href: "/admin/promotions", label: "Promotions" },
  { href: "/admin/providers", label: "Providers" },
  { href: "/admin/audit", label: "Audit" },
] as const;

function navActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({
  children,
  role,
  userId,
}: {
  children: React.ReactNode;
  role: AppRole;
  userId: string;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-atmosphere text-ink">
      <header className="border-b border-mist-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
              Cortaix ops
            </p>
            <Link
              href="/admin"
              className="font-display text-xl text-ink hover:text-accent"
            >
              {BRAND.name} Admin
            </Link>
          </div>
          <div className="text-right text-xs text-ink-muted">
            <p className="font-mono">{role}</p>
            <p className="max-w-[14rem] truncate font-mono" title={userId}>
              {userId}
            </p>
          </div>
          <Link href="/" className="btn-ghost text-sm">
            Back to app
          </Link>
        </div>
        <nav
          className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6"
          aria-label="Admin"
        >
          {NAV.map((item) => {
            const active = navActive(
              pathname,
              item.href,
              "exact" in item ? item.exact : false
            );
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-mist-100 text-ink"
                    : "text-ink-muted hover:bg-mist-50 hover:text-ink"
                )}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
