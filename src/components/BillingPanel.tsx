"use client";

/**
 * @deprecated Prefer PlanUsagePanel on /vault/plan.
 * Kept as a thin compatibility shim for any legacy imports.
 */
import Link from "next/link";

export function BillingPanel(_props: {
  balance?: number;
  planId?: string;
  planStatus?: string | null;
  stripeConfigured?: boolean;
  allowDevTopup?: boolean;
  recent?: unknown[];
}) {
  return (
    <div className="rounded-2xl border border-mist-200 bg-mist-50 p-4 text-sm text-ink-muted">
      Billing moved to{" "}
      <Link href="/vault/plan" className="font-medium text-ink underline">
        Plan &amp; Usage
      </Link>
      .
    </div>
  );
}
