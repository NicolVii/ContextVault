"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type {
  AdminUsageEconomics,
} from "@/lib/admin/usage-economics";
import {
  formatBytes,
  formatEurCents,
  formatUsdMicros,
} from "@/lib/admin/usage-economics";

function StatBlock({
  label,
  value,
  hint,
  estimated,
}: {
  label: string;
  value: string | number;
  hint?: string;
  estimated?: boolean;
}) {
  return (
    <div className="border-b border-mist-100 pb-3 last:border-0 last:pb-0 sm:border-0 sm:pb-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
        {label}
        {estimated ? (
          <span className="ml-1 font-normal normal-case tracking-normal text-amber-800/80">
            · est.
          </span>
        ) : null}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

function Section({
  title,
  children,
  note,
}: {
  title: string;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-medium text-ink">{title}</h2>
        {note ? <p className="text-xs text-ink-muted">{note}</p> : null}
      </div>
      <div className="grid gap-6 border-t border-mist-200 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        {children}
      </div>
    </section>
  );
}

function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(rate === 0 || rate >= 0.1 ? 0 : 1)}%`;
}

function formatNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

type FilterOptions = ReturnType<
  typeof import("@/lib/admin/usage-economics").usageFilterOptions
>;

export function AdminUsageDashboard({
  stats,
  options,
}: {
  stats: AdminUsageEconomics;
  options: FilterOptions;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const f = stats.filters;

  const [days, setDays] = useState(String(f.days));
  const [plan, setPlan] = useState(f.planId ?? "");
  const [provider, setProvider] = useState(f.provider ?? "");
  const [model, setModel] = useState(f.modelId ?? "");
  const [intensity, setIntensity] = useState(f.intensity);
  const [billingMode, setBillingMode] = useState(f.billingMode);
  const [audience, setAudience] = useState(f.audience);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (days) params.set("days", days);
    if (plan) params.set("plan", plan);
    if (provider) params.set("provider", provider);
    if (model) params.set("model", model);
    if (intensity && intensity !== "all") params.set("intensity", intensity);
    if (billingMode && billingMode !== "all") {
      params.set("billingMode", billingMode);
    }
    if (audience && audience !== "all") params.set("audience", audience);
    startTransition(() => {
      router.push(`/admin/usage?${params.toString()}`);
    });
  }

  function resetFilters() {
    setDays("30");
    setPlan("");
    setProvider("");
    setModel("");
    setIntensity("all");
    setBillingMode("all");
    setAudience("all");
    startTransition(() => {
      router.push("/admin/usage");
    });
  }

  const selectClass =
    "input min-w-[8rem] flex-1 text-sm sm:max-w-[12rem]";

  return (
    <div className="space-y-10">
      <form
        onSubmit={applyFilters}
        className="flex flex-wrap items-end gap-3 border-b border-mist-200 pb-6"
      >
        <label className="space-y-1 text-xs text-ink-muted">
          <span className="block font-medium uppercase tracking-wide text-ink-faint">
            Date
          </span>
          <select
            className={selectClass}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            aria-label="Date range"
          >
            {options.days.map((d) => (
              <option key={d} value={d}>
                Last {d} days
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-xs text-ink-muted">
          <span className="block font-medium uppercase tracking-wide text-ink-faint">
            Plan
          </span>
          <select
            className={selectClass}
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            aria-label="Plan"
          >
            <option value="">All plans</option>
            {options.plans.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-xs text-ink-muted">
          <span className="block font-medium uppercase tracking-wide text-ink-faint">
            Provider
          </span>
          <select
            className={selectClass}
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            aria-label="Provider"
          >
            <option value="">All providers</option>
            {options.providers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-xs text-ink-muted">
          <span className="block font-medium uppercase tracking-wide text-ink-faint">
            Model
          </span>
          <select
            className={selectClass}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            aria-label="Model"
          >
            <option value="">All models</option>
            {options.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-xs text-ink-muted">
          <span className="block font-medium uppercase tracking-wide text-ink-faint">
            Auto / Frontier
          </span>
          <select
            className={selectClass}
            value={intensity}
            onChange={(e) =>
              setIntensity(e.target.value as typeof intensity)
            }
            aria-label="Auto or Frontier"
          >
            <option value="all">All intensities</option>
            <option value="auto">Auto</option>
            <option value="frontier">Frontier</option>
          </select>
        </label>

        <label className="space-y-1 text-xs text-ink-muted">
          <span className="block font-medium uppercase tracking-wide text-ink-faint">
            Billing mode
          </span>
          <select
            className={selectClass}
            value={billingMode}
            onChange={(e) =>
              setBillingMode(e.target.value as typeof billingMode)
            }
            aria-label="Billing mode"
          >
            <option value="all">All modes</option>
            <option value="platform">Platform</option>
            <option value="byok">BYOK</option>
          </select>
        </label>

        <label className="space-y-1 text-xs text-ink-muted">
          <span className="block font-medium uppercase tracking-wide text-ink-faint">
            Real / Demo
          </span>
          <select
            className={selectClass}
            value={audience}
            onChange={(e) =>
              setAudience(e.target.value as typeof audience)
            }
            aria-label="Real or demo audience"
          >
            <option value="all">All users</option>
            <option value="real">Real only</option>
            <option value="demo">Demo only</option>
          </select>
        </label>

        <div className="flex gap-2">
          <button type="submit" className="btn-primary text-sm" disabled={pending}>
            {pending ? "Loading…" : "Apply"}
          </button>
          <button
            type="button"
            className="btn-ghost text-sm"
            onClick={resetFilters}
            disabled={pending}
          >
            Reset
          </button>
        </div>
      </form>

      {stats.meta.usageEventsTruncated ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
          Scan capped at {formatNum(stats.meta.usageEventSamples)} usage events.
          Narrow the date range or filters for a complete window.
        </p>
      ) : null}

      <Section
        title="Users"
        note={`Window ${new Date(f.from).toLocaleDateString()} – ${new Date(f.to).toLocaleDateString()}`}
      >
        <StatBlock
          label="Active users"
          value={formatNum(stats.users.activeUsers)}
          hint="Distinct users with inference in window"
        />
        <StatBlock
          label="Registrations"
          value={formatNum(stats.users.registrations)}
          hint="Profiles created in window"
        />
        {stats.users.byPlan.length === 0 ? (
          <StatBlock label="Users by plan" value={0} hint="No subscriptions" />
        ) : (
          stats.users.byPlan.map((row) => (
            <StatBlock
              key={row.key}
              label={`Plan · ${row.label}`}
              value={formatNum(row.count)}
              hint="Current subscriptions"
            />
          ))
        )}
      </Section>

      <Section title="Turns & tokens">
        <StatBlock label="Auto turns" value={formatNum(stats.turns.auto)} />
        <StatBlock
          label="Frontier turns"
          value={formatNum(stats.turns.frontier)}
        />
        <StatBlock
          label="Total tokens"
          value={formatNum(stats.tokens.total)}
          hint={`${formatNum(stats.tokens.input)} in · ${formatNum(stats.tokens.output)} out`}
        />
        <StatBlock
          label="Avg tokens / turn"
          value={formatNum(stats.tokens.avgPerTurn)}
        />
      </Section>

      <Section
        title="Context size"
        note={stats.contextSize.note}
      >
        <StatBlock
          label="Avg input tokens"
          value={formatNum(stats.contextSize.avgInputTokens)}
        />
        <StatBlock
          label="p50 input tokens"
          value={formatNum(stats.contextSize.p50InputTokens)}
        />
        <StatBlock
          label="p90 input tokens"
          value={formatNum(stats.contextSize.p90InputTokens)}
        />
        <StatBlock
          label="Samples"
          value={formatNum(stats.contextSize.samples)}
        />
      </Section>

      <Section title="Latency & reliability">
        <StatBlock
          label="Avg latency"
          value={
            stats.latency.avgMs == null ? "—" : `${stats.latency.avgMs} ms`
          }
        />
        <StatBlock
          label="p50 / p90"
          value={
            stats.latency.p50Ms == null
              ? "—"
              : `${stats.latency.p50Ms} / ${stats.latency.p90Ms ?? "—"} ms`
          }
        />
        <StatBlock
          label="Errors"
          value={formatNum(stats.reliability.errors)}
          hint={`Rate ${formatPct(stats.reliability.errorRate)}`}
        />
        <StatBlock
          label="Failovers"
          value={formatNum(stats.reliability.failovers)}
        />
        <StatBlock
          label="Mock fallback"
          value={formatNum(stats.reliability.mockFallback)}
          hint="provider_ops mock_fallback"
        />
      </Section>

      <Section title="Memory & documents">
        <StatBlock
          label="Memories created"
          value={formatNum(stats.memory.created)}
          hint={`${formatNum(stats.memory.active)} active · ${formatNum(stats.memory.proposed)} proposed`}
        />
        <StatBlock
          label="Documents created"
          value={formatNum(stats.documents.created)}
          hint={`${formatNum(stats.documents.ready)} ready · ${formatNum(stats.documents.failed)} failed`}
        />
        <StatBlock
          label="Storage used"
          value={formatBytes(stats.storage.totalBytes)}
          hint={`${formatNum(stats.storage.documentCount)} documents (all time)`}
        />
      </Section>

      <Section
        title="Estimated economics"
        note="Price-book COGS and catalog MRR — not confirmed financial data. Stripe Dashboard is the source of paid truth."
      >
        <StatBlock
          label="Provider cost"
          value={formatUsdMicros(
            stats.economics.estimatedProviderCostUsdMicros
          )}
          hint="Platform non-mock · price book"
          estimated
        />
        <StatBlock
          label="Cost / active user"
          value={formatUsdMicros(
            stats.economics.estimatedCostPerActiveUserUsdMicros
          )}
          estimated
        />
        <StatBlock
          label="Estimated revenue"
          value={formatEurCents(stats.economics.estimatedRevenueEurCents)}
          hint={`${formatNum(stats.economics.paidSubscriptionCount)} paid subs · catalog monthly`}
          estimated
        />
        <StatBlock
          label="Est. gross margin"
          value={formatEurCents(stats.economics.estimatedGrossMarginEurCents)}
          hint="Revenue − COGS (illustrative FX)"
          estimated
        />
        <StatBlock
          label="BYOK cost avoided"
          value={formatUsdMicros(stats.economics.byokCostAvoidedUsdMicros)}
          hint="User-paid provider · Cortaix not billed"
          estimated
        />
      </Section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-ink">Cost by plan</h2>
        <p className="text-xs text-ink-muted">
          Estimated platform COGS attributed by the user&apos;s current plan.
          Revenue is catalog list × paid subscriptions (demo excluded).
        </p>
        <div className="overflow-x-auto border-t border-mist-200">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-mist-100 text-xs uppercase tracking-wide text-ink-faint">
                <th className="py-3 pr-4 font-medium">Plan</th>
                <th className="py-3 pr-4 font-medium">Active users</th>
                <th className="py-3 pr-4 font-medium">Requests</th>
                <th className="py-3 pr-4 font-medium">Est. cost</th>
                <th className="py-3 pr-4 font-medium">Est. cost / user</th>
                <th className="py-3 font-medium">Est. revenue</th>
              </tr>
            </thead>
            <tbody>
              {stats.economics.byPlan.map((row) => (
                <tr
                  key={row.planId}
                  className="border-b border-mist-50 hover:bg-white/60"
                >
                  <td className="py-3 pr-4 font-medium">{row.planId}</td>
                  <td className="py-3 pr-4 tabular-nums">
                    {formatNum(row.activeUsers)}
                  </td>
                  <td className="py-3 pr-4 tabular-nums">
                    {formatNum(row.requests)}
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs">
                    {formatUsdMicros(row.estimatedCostUsdMicros)}
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs">
                    {formatUsdMicros(row.estimatedCostPerUserUsdMicros)}
                  </td>
                  <td className="py-3 font-mono text-xs">
                    {formatEurCents(row.estimatedRevenueEurCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-ink">Provider usage</h2>
        {stats.providers.length === 0 ? (
          <p className="text-sm text-ink-muted">No provider activity in window.</p>
        ) : (
          <div className="overflow-x-auto border-t border-mist-200">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="border-b border-mist-100 text-xs uppercase tracking-wide text-ink-faint">
                  <th className="py-3 pr-4 font-medium">Provider</th>
                  <th className="py-3 pr-4 font-medium">Requests</th>
                  <th className="py-3 pr-4 font-medium">Tokens</th>
                  <th className="py-3 font-medium">Est. cost</th>
                </tr>
              </thead>
              <tbody>
                {stats.providers.map((row) => (
                  <tr
                    key={row.key}
                    className="border-b border-mist-50 hover:bg-white/60"
                  >
                    <td className="py-3 pr-4 font-mono text-xs">{row.key}</td>
                    <td className="py-3 pr-4 tabular-nums">
                      {formatNum(row.requests)}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {formatNum(row.tokens)}
                    </td>
                    <td className="py-3 font-mono text-xs">
                      {formatUsdMicros(row.estimatedCostUsdMicros)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-ink">Model usage</h2>
        {stats.models.length === 0 ? (
          <p className="text-sm text-ink-muted">No model activity in window.</p>
        ) : (
          <div className="overflow-x-auto border-t border-mist-200">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="border-b border-mist-100 text-xs uppercase tracking-wide text-ink-faint">
                  <th className="py-3 pr-4 font-medium">Model</th>
                  <th className="py-3 pr-4 font-medium">Requests</th>
                  <th className="py-3 pr-4 font-medium">Tokens</th>
                  <th className="py-3 font-medium">Est. cost</th>
                </tr>
              </thead>
              <tbody>
                {stats.models.map((row) => (
                  <tr
                    key={row.key}
                    className="border-b border-mist-50 hover:bg-white/60"
                  >
                    <td className="py-3 pr-4">
                      <span className="font-medium">{row.label}</span>
                      <p className="font-mono text-xs text-ink-muted">
                        {row.key}
                      </p>
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {formatNum(row.requests)}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {formatNum(row.tokens)}
                    </td>
                    <td className="py-3 font-mono text-xs">
                      {formatUsdMicros(row.estimatedCostUsdMicros)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <aside className="space-y-2 border-t border-mist-200 pt-4 text-xs text-ink-muted">
        <p>{stats.economics.disclaimer}</p>
        <p>
          Sampled {formatNum(stats.meta.usageEventSamples)} usage events ·{" "}
          {formatNum(stats.reliability.opsEventSamples)} ops events · generated{" "}
          {new Date(stats.meta.generatedAt).toLocaleString()}
        </p>
      </aside>
    </div>
  );
}
