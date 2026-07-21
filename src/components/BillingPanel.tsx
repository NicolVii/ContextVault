"use client";

import { useState } from "react";
import { CREDIT_PACKS, SUBSCRIPTION_PLANS } from "@/lib/billing/products";

export function BillingPanel({
  balance,
  planId,
  planStatus,
  stripeConfigured,
  allowDevTopup,
  recent,
}: {
  balance: number;
  planId: string;
  planStatus: string | null;
  stripeConfigured: boolean;
  allowDevTopup: boolean;
  recent: {
    request_id: string;
    purpose: string;
    model_id: string;
    credits_charged: number;
    created_at: string;
  }[];
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localBalance, setLocalBalance] = useState(balance);

  async function checkout(kind: "pack" | "subscription", productId: string) {
    setBusy(productId);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, productId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Checkout failed");
      if (json.url) window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusy(null);
    }
  }

  async function portal() {
    setBusy("portal");
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Portal failed");
      if (json.url) window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portal failed");
    } finally {
      setBusy(null);
    }
  }

  async function devTopup() {
    setBusy("dev");
    setError(null);
    try {
      const res = await fetch("/api/billing/dev-topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: 100_000 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Top-up failed");
      setLocalBalance(json.balance);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Top-up failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-mist-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Credit balance
        </p>
        <p className="mt-1 text-2xl font-semibold text-ink">
          {localBalance.toLocaleString()}
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Plan: <span className="font-medium text-ink">{planId}</span>
          {planStatus ? ` · ${planStatus}` : ""}
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div>
        <h3 className="text-sm font-semibold text-ink">Buy credits</h3>
        <p className="mt-1 text-xs text-ink-muted">
          One-time packs. Invoices are from Cortaix — not the model provider.
        </p>
        <ul className="mt-3 space-y-2">
          {CREDIT_PACKS.map((pack) => (
            <li
              key={pack.id}
              className="flex items-center justify-between rounded-xl border border-mist-200 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-ink">{pack.label}</p>
                <p className="text-xs text-ink-muted">
                  ${(pack.amountUsdCents / 100).toFixed(0)}
                </p>
              </div>
              <button
                type="button"
                disabled={Boolean(busy) || !stripeConfigured}
                className="btn-primary text-xs"
                onClick={() => checkout("pack", pack.id)}
              >
                {busy === pack.id ? "…" : "Buy"}
              </button>
            </li>
          ))}
        </ul>
        {!stripeConfigured && allowDevTopup && (
          <button
            type="button"
            className="btn-secondary mt-3 text-xs"
            disabled={Boolean(busy)}
            onClick={devTopup}
          >
            {busy === "dev" ? "…" : "Dev top-up (+100k)"}
          </button>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-ink">Plans</h3>
        <ul className="mt-3 space-y-2">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <li
              key={plan.id}
              className="rounded-xl border border-mist-200 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-ink">{plan.label}</p>
                  <p className="text-xs text-ink-muted">
                    {plan.monthlyCredits > 0
                      ? `${plan.monthlyCredits.toLocaleString()} credits / month`
                      : "Included signup credits only"}
                  </p>
                </div>
                {plan.id !== "free" && (
                  <button
                    type="button"
                    disabled={Boolean(busy) || !stripeConfigured || planId === plan.id}
                    className="btn-primary text-xs"
                    onClick={() => checkout("subscription", plan.id)}
                  >
                    {planId === plan.id ? "Current" : busy === plan.id ? "…" : "Upgrade"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {stripeConfigured && (
          <button
            type="button"
            className="btn-secondary mt-3 text-xs"
            disabled={Boolean(busy)}
            onClick={portal}
          >
            {busy === "portal" ? "…" : "Manage billing"}
          </button>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-ink">Recent usage</h3>
        <ul className="mt-2 divide-y divide-mist-100 text-xs">
          {recent.length === 0 ? (
            <li className="py-2 text-ink-faint">No usage yet.</li>
          ) : (
            recent.slice(0, 8).map((row) => (
              <li key={row.request_id} className="flex justify-between py-2 text-ink-muted">
                <span>
                  {row.purpose} · {row.model_id}
                </span>
                <span>−{row.credits_charged}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
