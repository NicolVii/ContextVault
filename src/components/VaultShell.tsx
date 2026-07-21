"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

const TITLES: Record<string, string> = {
  "/vault": "Vault",
  "/vault/search": "Search",
  "/vault/memories": "Memories",
  "/vault/files": "Files",
  "/vault/review": "Review",
  "/vault/settings": "Settings",
  "/vault/connections": "Connections",
};

function titleFor(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith("/vault/memories/")) return "Memory";
  return BRAND.vaultLabel;
}

export function VaultShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isHub = pathname === "/vault";

  return (
    <div className="bg-atmosphere min-h-screen lg:flex lg:justify-end lg:bg-mist-100">
      <Link
        href="/"
        className="hidden lg:flex lg:flex-1 lg:items-start lg:justify-start lg:p-10"
        aria-label="Back to Thinking"
      >
        <span className="font-display text-2xl text-ink-faint/80">{BRAND.name}</span>
      </Link>

      <div
        className={cn(
          "flex min-h-screen w-full flex-col bg-white shadow-sheet",
          "animate-sheet-up lg:max-w-xl lg:animate-panel-in lg:rounded-l-3xl lg:shadow-soft",
          "motion-reduce:animate-none"
        )}
      >
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-mist-100 bg-white/90 px-4 py-3 backdrop-blur-md sm:px-6">
          {isHub ? (
            <Link
              href="/"
              className="rounded-lg p-2 text-ink-muted hover:bg-mist-50 hover:text-ink"
              aria-label="Close Vault"
            >
              <X className="h-5 w-5" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (pathname.startsWith("/vault/") && pathname !== "/vault") {
                  router.push("/vault");
                } else {
                  router.push("/");
                }
              }}
              className="rounded-lg p-2 text-ink-muted hover:bg-mist-50 hover:text-ink"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <h1 className="flex-1 text-base font-semibold text-ink">{titleFor(pathname)}</h1>
          {!isHub && (
            <Link href="/" className="text-sm text-ink-muted hover:text-ink">
              Done
            </Link>
          )}
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
