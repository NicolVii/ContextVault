"use client";

import { useState } from "react";
import Link from "next/link";
import { formatEurCents, getSubscriptionPlan } from "@/lib/billing/products";

export function FoundingOfferBanner({
  visible,
  onDismissed,
}: {
  visible: boolean;
  onDismissed: () => void;
}) {
  const [busy, setBusy] = useState<"checkout" | "dismiss" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pro = getSubscriptionPlan("pro");

  if (!visible || !pro?.foundingEurCentsMonthly) return null;

  async function checkoutFounding() {
    setBusy("checkout");
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "subscription",
          productId: "pro",
          interval: "monthly",
          founding: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Checkout failed");
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      throw new Error("Checkout unavailable");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setBusy(null);
    }
  }

  async function dismiss() {
    setBusy("dismiss");
    setError(null);
    try {
      const res = await fetch("/api/billing/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foundingOfferDismissed: true }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Could not dismiss");
      }
      onDismissed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not dismiss");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-mist-200 bg-white/80 px-4 py-3 shadow-soft">
      <p className="text-sm font-medium text-ink">Founding Pro offer</p>
      <p className="mt-1 text-xs text-ink-muted">
        You’re on Free. Unlock the complete Cortaix experience for{" "}
        {formatEurCents(pro.foundingEurCentsMonthly)} / month
        {pro.amountEurCentsAnnual
          ? ` (or ${formatEurCents(pro.amountEurCentsAnnual)} / year — two months free)`
          : ""}
        .
      </p>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-primary text-xs"
          disabled={Boolean(busy)}
          onClick={checkoutFounding}
        >
          {busy === "checkout" ? "…" : "Claim founding Pro"}
        </button>
        <Link href="/vault/plan" className="btn-secondary text-xs">
          See plans
        </Link>
        <button
          type="button"
          className="text-xs text-ink-muted underline"
          disabled={Boolean(busy)}
          onClick={dismiss}
        >
          {busy === "dismiss" ? "…" : "Not now"}
        </button>
      </div>
    </div>
  );
}
