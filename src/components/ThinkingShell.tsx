"use client";

import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { Logo } from "@/components/Logo";

export function ThinkingShell({
  children,
  reviewCount = 0,
}: {
  children: React.ReactNode;
  reviewCount?: number;
}) {
  return (
    <div className="bg-atmosphere flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo href="/" showWordmark />
        <Link
          href="/vault"
          className="relative rounded-xl px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-white/70 hover:text-ink"
        >
          {BRAND.vaultLabel}
          {reviewCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-md bg-amber-500 px-1 text-[10px] font-semibold text-white">
              {reviewCount > 9 ? "9+" : reviewCount}
            </span>
          )}
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pb-8 sm:px-8">
        {children}
      </main>
    </div>
  );
}
