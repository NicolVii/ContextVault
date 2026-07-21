import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BRAND } from "@/lib/brand";

export default async function VaultHubPage() {
  const supabase = createSupabaseServerClient();
  const { count: reviewCount } = await supabase
    .from("memories")
    .select("id", { count: "exact", head: true })
    .eq("status", "proposed");

  const pending = reviewCount ?? 0;

  const links: { href: string; label: string; hint?: string; badge?: number }[] = [
    { href: "/vault/search", label: "Search", hint: "Find memories and files" },
    { href: "/vault/memories", label: "Memories", hint: "Everything you’ve kept" },
    { href: "/vault/files", label: "Files", hint: "Documents and uploads" },
  ];

  if (pending > 0) {
    links.push({
      href: "/vault/review",
      label: "Review",
      hint: "Suggested memories waiting",
      badge: pending,
    });
  }

  return (
    <div className="mx-auto max-w-lg">
      <p className="mb-6 text-sm text-ink-muted">
        The backstage of {BRAND.name}. Your Thinking screen stays clear.
      </p>

      <Link
        href="/vault/search"
        className="mb-6 flex items-center gap-3 rounded-2xl border border-mist-200 bg-mist-50 px-4 py-3 text-ink-muted transition-colors hover:border-mist-300 hover:bg-white"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-sm">Search everything…</span>
      </Link>

      <nav className="divide-y divide-mist-100 overflow-hidden rounded-2xl border border-mist-200 bg-white">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-mist-50"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink">{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span className="badge bg-amber-100 text-amber-900">{item.badge}</span>
                )}
              </div>
              {item.hint && <p className="mt-0.5 text-xs text-ink-faint">{item.hint}</p>}
            </div>
            <ChevronRight className="h-4 w-4 text-ink-faint" />
          </Link>
        ))}
      </nav>

      <nav className="mt-6 overflow-hidden rounded-2xl border border-mist-200 bg-white">
        <Link
          href="/vault/settings"
          className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-mist-50"
        >
          <div className="flex-1">
            <span className="text-sm font-medium text-ink">Settings</span>
            <p className="mt-0.5 text-xs text-ink-faint">Profile, privacy, and advanced</p>
          </div>
          <ChevronRight className="h-4 w-4 text-ink-faint" />
        </Link>
      </nav>
    </div>
  );
}
