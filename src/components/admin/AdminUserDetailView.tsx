"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminUserDetail } from "@/lib/admin/console";

function formatBytes(n: number): string {
  if (n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function Dl({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs text-ink-faint">{item.label}</dt>
          <dd className="mt-0.5 break-words text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-t border-mist-200 pt-6">
      <h2 className="text-lg font-medium text-ink">{title}</h2>
      {children}
    </section>
  );
}

type ActionResult = { ok?: boolean; error?: string; action?: string };

async function postAction(
  userId: string,
  body: Record<string, unknown>
): Promise<ActionResult> {
  const res = await fetch(`/api/admin/users/${userId}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as ActionResult;
  if (!res.ok) {
    return { error: json.error ?? `HTTP ${res.status}` };
  }
  return json;
}

export function AdminUserDetailView({
  detail,
  canMutate,
}: {
  detail: AdminUserDetail;
  canMutate: boolean;
}) {
  const router = useRouter();
  const userId = detail.profile.id;
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [grantPlan, setGrantPlan] = useState<"free" | "lite" | "pro">("pro");
  const [grantEnds, setGrantEnds] = useState("");
  const [grantReason, setGrantReason] = useState("");

  const [simPlan, setSimPlan] = useState<"free" | "lite" | "pro">("lite");
  const [simEnds, setSimEnds] = useState("");
  const [simReason, setSimReason] = useState("");

  const [autoAmount, setAutoAmount] = useState("10");
  const [autoReason, setAutoReason] = useState("");
  const [frontierAmount, setFrontierAmount] = useState("5");
  const [frontierReason, setFrontierReason] = useState("");
  const [creditAmount, setCreditAmount] = useState("1000");
  const [creditReason, setCreditReason] = useState("");
  const [resetReason, setResetReason] = useState("");

  async function run(body: Record<string, unknown>) {
    if (!canMutate) {
      setMessage("Requires admin or super_admin");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await postAction(userId, body);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setMessage(`OK · ${result.action ?? "done"}`);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const snap = detail.effectivePlan;

  return (
    <div className="space-y-2">
      <header className="space-y-1 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {detail.profile.displayName || detail.profile.email || "User"}
        </h1>
        <p className="font-mono text-xs text-ink-muted">{userId}</p>
      </header>

      <Section title="Profile">
        <Dl
          items={[
            { label: "Email", value: detail.profile.email ?? "—" },
            { label: "Role", value: detail.profile.role },
            {
              label: "Onboarding",
              value: detail.profile.onboardingCompleted ? "complete" : "pending",
            },
            { label: "Default model", value: detail.profile.defaultModel ?? "—" },
            { label: "Persona", value: detail.profile.persona ?? "—" },
            {
              label: "Created",
              value: formatDate(detail.profile.createdAt),
            },
          ]}
        />
      </Section>

      <Section title="Effective plan">
        <Dl
          items={[
            { label: "Plan", value: snap.planId },
            { label: "Source", value: snap.entitlementSource },
            {
              label: "Demo",
              value: snap.isDemo ? "yes (exclude from revenue)" : "no",
            },
            { label: "Reason", value: snap.entitlementReason ?? "—" },
            { label: "Ends", value: formatDate(snap.entitlementEndsAt) },
            {
              label: "Restricted",
              value: snap.inferenceRestricted ? "yes" : "no",
            },
          ]}
        />
      </Section>

      <Section title="Real subscription">
        {detail.subscription ? (
          <Dl
            items={[
              { label: "Plan", value: detail.subscription.planId },
              { label: "Status", value: detail.subscription.status ?? "—" },
              {
                label: "Period end",
                value: formatDate(detail.subscription.currentPeriodEnd),
              },
              {
                label: "Cancel at period end",
                value: detail.subscription.cancelAtPeriodEnd ? "yes" : "no",
              },
              {
                label: "Stripe customer",
                value: detail.subscription.stripeCustomerId ?? "—",
              },
              {
                label: "Stripe subscription",
                value: detail.subscription.stripeSubscriptionId ?? "—",
              },
            ]}
          />
        ) : (
          <p className="text-sm text-ink-muted">No subscription row.</p>
        )}
      </Section>

      <Section title="Demo grants">
        {detail.demoGrants.length === 0 ? (
          <p className="text-sm text-ink-muted">None active.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {detail.demoGrants.map((g) => (
              <li key={g.id} className="border-b border-mist-50 pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {g.planId} · ends {formatDate(g.endsAt)}
                  </p>
                  {canMutate ? (
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={busy}
                      onClick={() =>
                        void run({
                          action: "revoke_grant",
                          id: g.id,
                          reason: "Ended from admin console",
                        })
                      }
                    >
                      Revoke
                    </button>
                  ) : null}
                </div>
                <p className="text-xs text-ink-muted">{g.reason ?? "—"}</p>
                <p className="font-mono text-xs text-ink-faint">{g.id}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Simulations">
        {detail.simulations.length === 0 ? (
          <p className="text-sm text-ink-muted">None active.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {detail.simulations.map((s) => (
              <li key={s.id} className="border-b border-mist-50 pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {s.planId} · ends {formatDate(s.endsAt)}
                  </p>
                  {canMutate ? (
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={busy}
                      onClick={() =>
                        void run({
                          action: "end_simulation",
                          id: s.id,
                          reason: "Ended from admin console",
                        })
                      }
                    >
                      End simulation
                    </button>
                  ) : null}
                </div>
                <p className="text-xs text-ink-muted">{s.reason ?? "—"}</p>
                <p className="font-mono text-xs text-ink-faint">{s.id}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Usage">
        <Dl
          items={[
            {
              label: "Period",
              value: `${formatDate(detail.usage.periodStart)} → ${formatDate(detail.usage.periodEnd)}`,
            },
            {
              label: "Auto turns",
              value: `${detail.usage.autoTurns}${
                detail.usage.autoRemaining != null
                  ? ` (${detail.usage.autoRemaining} left)`
                  : " (unlimited)"
              }`,
            },
            {
              label: "Frontier turns",
              value: `${detail.usage.frontierTurns}${
                detail.usage.frontierRemaining != null
                  ? ` (${detail.usage.frontierRemaining} left)`
                  : detail.usage.entitlements.frontierMonthlyTurns === 0
                    ? " (blocked)"
                    : " (soft cap)"
              }`,
            },
            {
              label: "Auto credits used",
              value: detail.usage.autoCredits,
            },
            {
              label: "Frontier credits used",
              value: detail.usage.frontierCredits,
            },
          ]}
        />
      </Section>

      <Section title="Credits">
        <Dl
          items={[
            {
              label: "Balance",
              value: detail.credits.balance.toLocaleString(),
            },
          ]}
        />
      </Section>

      <Section title="Storage">
        <Dl
          items={[
            {
              label: "Used",
              value: formatBytes(detail.storage.usedBytes),
            },
            {
              label: "Cap",
              value: formatBytes(detail.storage.capBytes),
            },
          ]}
        />
      </Section>

      <Section title="Recent provider / model activity">
        {detail.recentActivity.length === 0 ? (
          <p className="text-sm text-ink-muted">No usage events.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-xs">
              <thead>
                <tr className="text-ink-faint">
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Provider</th>
                  <th className="py-2 pr-3 font-medium">Model</th>
                  <th className="py-2 pr-3 font-medium">Purpose</th>
                  <th className="py-2 font-medium">Credits</th>
                </tr>
              </thead>
              <tbody>
                {detail.recentActivity.map((e) => (
                  <tr key={e.requestId} className="border-t border-mist-50">
                    <td className="py-2 pr-3 text-ink-muted">
                      {formatDate(e.createdAt)}
                    </td>
                    <td className="py-2 pr-3 font-mono">{e.provider}</td>
                    <td className="py-2 pr-3 font-mono">{e.modelId}</td>
                    <td className="py-2 pr-3">{e.purpose}</td>
                    <td className="py-2 tabular-nums">{e.creditsCharged}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Recent audit entries">
        {detail.recentAudit.length === 0 ? (
          <p className="text-sm text-ink-muted">No admin audit for this user.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {detail.recentAudit.map((e) => (
              <li key={e.id} className="border-b border-mist-50 pb-2">
                <p className="font-mono text-ink">{e.action}</p>
                <p className="text-ink-muted">{formatDate(e.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Admin actions">
        {!canMutate ? (
          <p className="text-sm text-ink-muted">
            View-only for support. Mutations require admin or super_admin.
          </p>
        ) : (
          <div className="space-y-8">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-ink">
                Temporary plan grant
              </h3>
              <div className="flex flex-wrap gap-3">
                <select
                  className="input max-w-[8rem]"
                  value={grantPlan}
                  onChange={(e) =>
                    setGrantPlan(e.target.value as "free" | "lite" | "pro")
                  }
                >
                  <option value="free">free</option>
                  <option value="lite">lite</option>
                  <option value="pro">pro</option>
                </select>
                <input
                  className="input max-w-xs"
                  type="datetime-local"
                  value={grantEnds}
                  onChange={(e) => setGrantEnds(e.target.value)}
                  aria-label="Grant ends at"
                />
                <input
                  className="input max-w-sm flex-1"
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  placeholder="Reason (required)"
                />
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy}
                  onClick={() =>
                    void run({
                      action: "temporary_plan_grant",
                      planId: grantPlan,
                      endsAt: grantEnds
                        ? new Date(grantEnds).toISOString()
                        : null,
                      reason: grantReason,
                    })
                  }
                >
                  Grant plan
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-ink">Plan simulation</h3>
              <div className="flex flex-wrap gap-3">
                <select
                  className="input max-w-[8rem]"
                  value={simPlan}
                  onChange={(e) =>
                    setSimPlan(e.target.value as "free" | "lite" | "pro")
                  }
                >
                  <option value="free">free</option>
                  <option value="lite">lite</option>
                  <option value="pro">pro</option>
                </select>
                <input
                  className="input max-w-xs"
                  type="datetime-local"
                  value={simEnds}
                  onChange={(e) => setSimEnds(e.target.value)}
                  aria-label="Simulation ends at"
                />
                <input
                  className="input max-w-sm flex-1"
                  value={simReason}
                  onChange={(e) => setSimReason(e.target.value)}
                  placeholder="Reason (required)"
                />
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy}
                  onClick={() =>
                    void run({
                      action: "plan_simulation",
                      planId: simPlan,
                      endsAt: simEnds
                        ? new Date(simEnds).toISOString()
                        : null,
                      reason: simReason,
                    })
                  }
                >
                  Start simulation
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-ink">Auto bonus</h3>
              <div className="flex flex-wrap gap-3">
                <input
                  className="input max-w-[8rem]"
                  type="number"
                  min={1}
                  value={autoAmount}
                  onChange={(e) => setAutoAmount(e.target.value)}
                  aria-label="Auto turn bonus"
                />
                <input
                  className="input max-w-sm flex-1"
                  value={autoReason}
                  onChange={(e) => setAutoReason(e.target.value)}
                  placeholder="Reason (required)"
                />
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() =>
                    void run({
                      action: "auto_bonus",
                      amount: Number(autoAmount),
                      reason: autoReason,
                    })
                  }
                >
                  Grant Auto bonus
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-ink">Frontier bonus</h3>
              <div className="flex flex-wrap gap-3">
                <input
                  className="input max-w-[8rem]"
                  type="number"
                  min={1}
                  value={frontierAmount}
                  onChange={(e) => setFrontierAmount(e.target.value)}
                  aria-label="Frontier turn bonus"
                />
                <input
                  className="input max-w-sm flex-1"
                  value={frontierReason}
                  onChange={(e) => setFrontierReason(e.target.value)}
                  placeholder="Reason (required)"
                />
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() =>
                    void run({
                      action: "frontier_bonus",
                      amount: Number(frontierAmount),
                      reason: frontierReason,
                    })
                  }
                >
                  Grant Frontier bonus
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-ink">Credit bonus</h3>
              <div className="flex flex-wrap gap-3">
                <input
                  className="input max-w-[8rem]"
                  type="number"
                  min={1}
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  aria-label="Credit bonus amount"
                />
                <input
                  className="input max-w-sm flex-1"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  placeholder="Reason (required)"
                />
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() =>
                    void run({
                      action: "credit_bonus",
                      amount: Number(creditAmount),
                      reason: creditReason,
                    })
                  }
                >
                  Grant credits
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-ink">Usage reset</h3>
              <p className="text-xs text-ink-muted">
                Zeros Auto/Frontier counters for the current period. Reason is
                mandatory and audited.
              </p>
              <div className="flex flex-wrap gap-3">
                <input
                  className="input max-w-sm flex-1"
                  value={resetReason}
                  onChange={(e) => setResetReason(e.target.value)}
                  placeholder="Reason (required)"
                />
                <button
                  type="button"
                  className="btn-danger"
                  disabled={busy}
                  onClick={() =>
                    void run({
                      action: "usage_reset",
                      reason: resetReason,
                    })
                  }
                >
                  Reset usage
                </button>
              </div>
            </div>
          </div>
        )}
        {message ? (
          <p className="mt-4 font-mono text-xs text-ink-muted" role="status">
            {message}
          </p>
        ) : null}
      </Section>
    </div>
  );
}
