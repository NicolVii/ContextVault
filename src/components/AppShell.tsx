"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  reviewCount = 0,
}: {
  children: React.ReactNode;
  reviewCount?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-sand-50 lg:grid lg:grid-cols-[260px_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden border-r border-brand-100 bg-white lg:block">
        <div className="sticky top-0 h-screen">
          <AppNav reviewCount={reviewCount} />
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-brand-100 bg-white p-4 lg:hidden">
        <Logo />
        <button
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-brand-700 hover:bg-brand-50"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 lg:hidden",
          open ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <div
          className={cn(
            "absolute inset-0 bg-brand-900/30 transition-opacity",
            open ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setOpen(false)}
        />
        <div
          className={cn(
            "absolute left-0 top-0 h-full w-72 bg-white shadow-xl transition-transform",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <button
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute right-3 top-3 rounded-lg p-2 text-brand-700 hover:bg-brand-50"
          >
            <X className="h-5 w-5" />
          </button>
          <div onClick={() => setOpen(false)}>
            <AppNav reviewCount={reviewCount} />
          </div>
        </div>
      </div>

      <main className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
