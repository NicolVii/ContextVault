import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Search } from "lucide-react";
import { getCachedUser, getSessionContext } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { SignOutButton } from "@/components/SignOutButton";
import { getPlanUsageSnapshot } from "@/lib/billing/plan-usage";
import { getSubscriptionPlan } from "@/lib/billing/products";
import { timed } from "@/lib/perf";

async function PlanNavRow() {
  const user = await getCachedUser();

  let planLabel = "Free";
  let planHint = "Free";

  if (user) {
    const snap = await timed("vault.hub.planSnapshot", () =>
      getPlanUsageSnapshot(user.id)
    );
    planLabel = getSubscriptionPlan(snap.planId ?? "free")?.label ?? "Free";
    planHint =
      snap.planId === "free" && snap.autoRemaining != null
        ? `${planLabel} · about ${snap.autoRemaining} Auto left`
        : planLabel;
  }

  return (
    <Link
      href="/vault/plan"
      className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-mist-50"
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink">Plan &amp; Usage</span>
          <span className="badge bg-mist-100 text-ink-muted">{planLabel}</span>
        </div>
        <p className="mt-0.5 text-xs text-ink-faint">{planHint}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-ink-faint" />
    </Link>
  );
}

function PlanNavRowFallback() {
  return (
    <Link
      href="/vault/plan"
      className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-mist-50"
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink">Plan &amp; Usage</span>
          <span className="badge bg-mist-100 text-ink-muted">Plan</span>
        </div>
        <p className="mt-0.5 text-xs text-ink-faint">Usage and billing</p>
      </div>
      <ChevronRight className="h-4 w-4 text-ink-faint" />
    </Link>
  );
}

export default async function VaultHubPage() {
  const ctx = await getSessionContext();
  const { count: reviewCount } = await timed("vault.hub.reviewCount", async () => {
    if (!ctx) return { count: 0 };
    return ctx.supabase
      .from("memories")
      .select("id", { count: "exact", head: true })
      .eq("status", "proposed");
  });

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
    <div className="mx-auto flex max-w-lg flex-col">
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

      <nav className="mt-6 divide-y divide-mist-100 overflow-hidden rounded-2xl border border-mist-200 bg-white">
        <Suspense fallback={<PlanNavRowFallback />}>
          <PlanNavRow />
        </Suspense>
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

      <div className="mt-10 border-t border-mist-100 pt-2">
        <SignOutButton />
      </div>
    </div>
  );
}
