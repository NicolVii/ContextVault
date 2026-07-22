import Link from "next/link";
import { demoBannerLabel } from "@/lib/billing/entitlement-resolution";
import type { EntitlementSource } from "@/lib/billing/entitlement-resolution";

function formatExpiry(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Clear notice when the effective plan comes from a plan simulation or
 * admin entitlement grant (demo), not a real Stripe subscription.
 */
export function DemoSubscriptionBanner({
  visible,
  source,
  planId,
  endsAt,
  reason,
  className = "mb-4",
}: {
  visible: boolean;
  source: EntitlementSource | null | undefined;
  planId: string;
  endsAt?: string | null;
  reason?: string | null;
  className?: string;
}) {
  if (
    !visible ||
    (source !== "plan_simulation" && source !== "admin_grant")
  ) {
    return null;
  }

  const title = demoBannerLabel({ source, planId });
  const expiry = formatExpiry(endsAt);
  const kind =
    source === "plan_simulation" ? "plan simulation" : "demo subscription";

  return (
    <div
      className={`rounded-2xl border border-mist-300 bg-mist-50/90 px-4 py-3 ${className}`}
      role="status"
      data-demo-subscription-banner="true"
      data-entitlement-source={source}
    >
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mt-1 text-xs text-ink-muted">
        You are on a temporary {kind}. This does not count as a paid
        subscription
        {expiry ? ` · ends ${expiry}` : ""}.
        {reason ? ` ${reason}` : ""}
      </p>
      <p className="mt-2 text-xs text-ink-muted">
        <Link href="/vault/plan" className="font-medium underline">
          Plan &amp; Usage
        </Link>
      </p>
    </div>
  );
}
