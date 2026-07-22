"use client";

import { useState } from "react";
import Link from "next/link";
import {
  formatEurCents,
  getPublicPlans,
  type SubscriptionPlan,
} from "@/lib/billing/products";
import type { CommercialMode } from "@/lib/billing/commercial";
import type { PlanUsageSnapshot } from "@/lib/billing/plan-usage";
import { DemoSubscriptionBanner } from "@/components/DemoSubscriptionBanner";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
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

function AutoBlock({ snap }: { snap: PlanUsageSnapshot }) {
  if (snap.entitlements.unlimitedAuto) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Auto</p>
        <p className="mt-1 text-lg font-medium text-ink">Unlimited</p>
        <p className="text-xs text-ink-muted">Fair use · personal use</p>
      </div>
    );
  }
  const cap = snap.entitlements.autoMonthlyTurns ?? 30;
  const left = snap.autoRemaining ?? 0;
  const pct = Math.round((left / cap) * 100);
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Auto</p>
      <p className="mt-1 text-lg font-medium text-ink">
        About {left} conversation{left === 1 ? "" : "s"} left
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mist-100">
        <div
          className="h-full rounded-full bg-accent/80 transition-all"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-ink-muted">{pct}% of this month remaining</p>
    </div>
  );
}

function FrontierBlock({ snap }: { snap: PlanUsageSnapshot }) {
  if (snap.entitlements.frontierMonthlyTurns === 0) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Frontier
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Frontier models on Lite and Pro.
        </p>
      </div>
    );
  }
  if (snap.entitlements.frontierMonthlyTurns != null) {
    const left = snap.frontierRemaining ?? 0;
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Frontier
        </p>
        <p className="mt-1 text-lg font-medium text-ink">
          {left} left this month
        </p>
        {left === 0 && (
          <p className="mt-1 text-xs text-ink-muted">
            Auto still works. Upgrade to Pro for generous Frontier access.
          </p>
        )}
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
        Frontier
      </p>
      <p className="mt-1 text-lg font-medium text-ink">
        Included · {snap.frontierHeavy ? "using heavily" : "healthy"}
      </p>
      {snap.frontierHeavy && (
        <p className="mt-1 text-xs text-ink-muted">
          You’re using Frontier heavily this period. Auto remains available.
        </p>
      )}
    </div>
  );
}

export function PlanUsagePanel({
  snap,
  commercialMode,
  checkoutEnabled,
  portalEnabled,
  allowDevTopup,
  recent = [],
  creditBalance,
  omitRecent = false,
  recentSlot,
}: {
  snap: PlanUsageSnapshot;
  commercialMode: CommercialMode;
  checkoutEnabled: boolean;
  portalEnabled: boolean;
  allowDevTopup: boolean;
  creditBalance: number;
  recent?: {
    request_id: string;
    purpose: string;
    model_id: string;
    credits_charged: number;
    created_at: string;
  }[];
  /** When true, skip the Recent block (use {@link recentSlot} or {@link PlanRecentList}). */
  omitRecent?: boolean;
  /** Optional streamed Recent UI (e.g. Suspense-wrapped server slot). */
  recentSlot?: React.ReactNode;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");
  const [spendCap, setSpendCap] = useState("");
  const [spendSaved, setSpendSaved] = useState<string | null>(null);
  const plans = getPublicPlans();

  const commercialHint =
    commercialMode === "disabled"
      ? "Billing is turned off in this environment."
      : commercialMode === "demo"
        ? "Demo mode — plans are shown for preview; checkout is unavailable."
        : !checkoutEnabled
          ? "Live billing is selected, but Stripe is not configured yet."
          : null;

  async function saveSpendCap() {
    if (!portalEnabled) return;
    setBusy("spend");
    setSpendSaved(null);
    setError(null);
    try {
      const cents =
        spendCap.trim() === ""
          ? null
          : Math.round(Number(spendCap.replace(",", ".")) * 100);
      if (cents != null && (Number.isNaN(cents) || cents < 0)) {
        throw new Error("Enter a valid euro amount");
      }
      const res = await fetch("/api/billing/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthlySpendCapEurCents: cents,
          autoTopupEnabled: false,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save");
      setSpendSaved("Saved. Auto top-up stays off.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(null);
    }
  }

  async function checkout(
    productId: string,
    opts?: { founding?: boolean; interval?: "monthly" | "annual" }
  ) {
    if (!checkoutEnabled) return;
    setBusy(productId);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "subscription",
          productId,
          interval: opts?.interval ?? interval,
          founding: opts?.founding,
        }),
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
    if (!portalEnabled) return;
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
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Top-up failed");
    } finally {
      setBusy(null);
    }
  }

  const planLabel =
    plans.find((p) => p.id === snap.planId)?.label ??
    snap.planId.charAt(0).toUpperCase() + snap.planId.slice(1);

  const sourceHint =
    snap.entitlementSource === "plan_simulation"
      ? " · simulated"
      : snap.entitlementSource === "admin_grant"
        ? " · demo grant"
        : "";

  const renewLabel = snap.cancelAtPeriodEnd
    ? `Cancels ${formatDate(snap.currentPeriodEnd ?? snap.periodEnd)}`
    : snap.currentPeriodEnd
      ? `Renews ${formatDate(snap.currentPeriodEnd)}`
      : `Resets ${formatDate(snap.periodEnd)}`;

  return (
    <div className="space-y-8">
      <DemoSubscriptionBanner
        visible={snap.showDemoSubscriptionBanner}
        source={snap.entitlementSource}
        planId={snap.planId}
        endsAt={snap.entitlementEndsAt}
        reason={snap.entitlementReason}
        className=""
      />
      {snap.inferenceRestricted && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
          AI usage is paused due to a billing problem. Your memories and files are safe.{" "}
          {portalEnabled && (
            <button type="button" className="underline" onClick={portal}>
              Update billing
            </button>
          )}
        </p>
      )}
      {!snap.inferenceRestricted && snap.gracePeriodEndsAt && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
          We couldn’t renew your plan. Update your payment method by{" "}
          {formatDate(snap.gracePeriodEndsAt)} to keep uninterrupted access.
        </p>
      )}

      {commercialHint && (
        <p className="rounded-xl border border-mist-200 bg-mist-50/80 px-3 py-2 text-sm text-ink-muted">
          {commercialHint}
        </p>
      )}

      <section className="space-y-1">
        <h2 className="text-xl font-semibold text-ink">{planLabel}</h2>
        <p className="text-sm text-ink-muted">
          {renewLabel}
          {snap.planStatus ? ` · ${snap.planStatus}` : ""}
          {sourceHint}
        </p>
      </section>

      <section className="space-y-5 rounded-2xl border border-mist-200 bg-mist-50/50 p-4">
        <AutoBlock snap={snap} />
        <FrontierBlock snap={snap} />
        {snap.planId === "free" && (
          <p className="text-xs text-ink-muted">Attachments are available on Lite and Pro.</p>
        )}
        {snap.planId === "lite" && (
          <p className="text-xs text-ink-muted">File library · 100 MB</p>
        )}
        {snap.planId === "pro" && (
          <p className="text-xs text-ink-muted">
            Library storage is shown in Files. Included: every frontier family · Voice · BYOK ·
            full memory intelligence.
          </p>
        )}
      </section>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">Plans</h3>
          <div className="flex rounded-lg border border-mist-200 text-xs">
            <button
              type="button"
              className={`px-2 py-1 ${interval === "monthly" ? "bg-mist-100 font-medium" : ""}`}
              onClick={() => setInterval("monthly")}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`px-2 py-1 ${interval === "annual" ? "bg-mist-100 font-medium" : ""}`}
              onClick={() => setInterval("annual")}
            >
              Annual
            </button>
          </div>
        </div>
        <ul className="space-y-2">
          {plans.map((plan: SubscriptionPlan) => {
            const price =
              interval === "annual" && plan.amountEurCentsAnnual
                ? formatEurCents(plan.amountEurCentsAnnual) + " / year"
                : plan.amountEurCentsMonthly === 0
                  ? "€0"
                  : formatEurCents(plan.amountEurCentsMonthly) + " / month";
            const isCurrent = snap.planId === plan.id;
            return (
              <li
                key={plan.id}
                className="rounded-xl border border-mist-200 px-3 py-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-ink">{plan.label}</p>
                    <p className="text-xs text-ink-muted">{plan.purpose}</p>
                    <p className="mt-1 text-xs text-ink-faint">{price}</p>
                    <ul className="mt-2 space-y-0.5">
                      {plan.features.slice(0, 3).map((f) => (
                        <li key={f} className="text-xs text-ink-muted">
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {plan.id !== "free" && (
                    <button
                      type="button"
                      disabled={Boolean(busy) || !checkoutEnabled || isCurrent}
                      className="btn-primary shrink-0 text-xs"
                      onClick={() => checkout(plan.id)}
                    >
                      {isCurrent
                        ? "Current"
                        : busy === plan.id
                          ? "…"
                          : checkoutEnabled
                            ? "Upgrade"
                            : commercialMode === "disabled"
                              ? "Unavailable"
                              : "Preview"}
                    </button>
                  )}
                </div>
                {plan.id === "pro" &&
                  plan.foundingEurCentsMonthly &&
                  !isCurrent &&
                  checkoutEnabled && (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    className="mt-2 text-xs text-ink-muted underline"
                    onClick={() => checkout("pro", { founding: true, interval: "monthly" })}
                  >
                    Founding price {formatEurCents(plan.foundingEurCentsMonthly)} / month
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {portalEnabled && snap.planId !== "free" && (
          <div className="rounded-xl border border-mist-200 px-3 py-3">
            <h3 className="text-sm font-semibold text-ink">Spending</h3>
            <p className="mt-1 text-xs text-ink-muted">
              Optional monthly pack spend cap. Auto top-up stays off unless you enable it later.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-ink-muted">€</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="No cap"
                value={spendCap}
                onChange={(e) => setSpendCap(e.target.value)}
                className="w-24 rounded-lg border border-mist-200 px-2 py-1 text-sm"
              />
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={Boolean(busy)}
                onClick={saveSpendCap}
              >
                {busy === "spend" ? "…" : "Save"}
              </button>
            </div>
            {spendSaved && (
              <p className="mt-2 text-xs text-ink-faint">{spendSaved}</p>
            )}
            <button
              type="button"
              className="btn-secondary mt-3 text-xs"
              disabled={Boolean(busy)}
              onClick={portal}
            >
              {busy === "portal" ? "…" : "Manage billing"}
            </button>
          </div>
        )}
        {allowDevTopup && (
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={Boolean(busy)}
            onClick={devTopup}
          >
            {busy === "dev" ? "…" : "Dev top-up (+100k internal credits)"}
          </button>
        )}
      </section>

      {recentSlot}
      {!omitRecent && !recentSlot && (
        <PlanRecentList recent={recent} creditBalance={creditBalance} snap={snap} />
      )}
    </div>
  );
}

type RecentRow = {
  request_id: string;
  purpose: string;
  model_id: string;
  credits_charged: number;
  created_at: string;
};

export function PlanRecentList({
  recent,
  creditBalance,
  snap,
  showDetailsToggle = true,
}: {
  recent: RecentRow[];
  creditBalance: number;
  snap: PlanUsageSnapshot;
  showDetailsToggle?: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <section>
      <h3 className="text-sm font-semibold text-ink">Recent</h3>
      <ul className="mt-2 divide-y divide-mist-100 text-xs">
        {recent.length === 0 ? (
          <li className="py-2 text-ink-faint">No usage yet.</li>
        ) : (
          recent.slice(0, 8).map((row) => (
            <li key={row.request_id} className="flex justify-between py-2 text-ink-muted">
              <span>
                {row.purpose} · {row.model_id.replace(/^[^.]+\./, "")}
              </span>
              <span className="text-ink-faint">{formatDate(row.created_at)}</span>
            </li>
          ))
        )}
      </ul>
      {showDetailsToggle && (
        <>
          <button
            type="button"
            className="mt-3 text-xs text-ink-muted underline"
            onClick={() => setShowDetails((v) => !v)}
          >
            {showDetails ? "Hide usage details" : "Usage details"}
          </button>
          {showDetails && <UsageDetailsBody creditBalance={creditBalance} snap={snap} />}
        </>
      )}
    </section>
  );
}

function UsageDetailsBody({
  creditBalance,
  snap,
}: {
  creditBalance: number;
  snap: PlanUsageSnapshot;
}) {
  return (
    <div className="mt-2 rounded-xl border border-mist-200 bg-white p-3 text-xs text-ink-muted">
      <p>Internal credit balance: {creditBalance.toLocaleString()}</p>
      <p className="mt-1">
        Auto turns {snap.autoTurns}
        {snap.entitlements.autoMonthlyTurns != null
          ? ` / ${snap.entitlements.autoMonthlyTurns}`
          : ""}{" "}
        · Frontier turns {snap.frontierTurns}
        {snap.entitlements.frontierMonthlyTurns != null
          ? ` / ${snap.entitlements.frontierMonthlyTurns}`
          : ""}
      </p>
      <p className="mt-2 text-ink-faint">
        Credits are an internal meter. You buy from Cortaix — providers stay behind the scenes.
      </p>
      <p className="mt-2">
        <Link href="/legal/billing" className="underline">
          Subscription &amp; Billing Terms
        </Link>
      </p>
    </div>
  );
}
