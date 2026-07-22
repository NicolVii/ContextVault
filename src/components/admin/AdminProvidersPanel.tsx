"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  ModelAdminView,
  ProviderAdminView,
} from "@/lib/inference/provider-ops";

function formatUsdMicros(micros: number): string {
  if (!Number.isFinite(micros) || micros === 0) return "$0";
  const usd = micros / 1_000_000;
  if (usd < 0.01) return `<$0.01`;
  return `$${usd.toFixed(usd < 1 ? 3 : 2)}`;
}

function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(rate === 0 || rate >= 0.1 ? 0 : 1)}%`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 border-t border-mist-200 pt-6">
      <h2 className="text-lg font-medium text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] uppercase tracking-wide text-ink-faint">
        {label}
      </p>
      <p className="font-mono text-sm text-ink">{value}</p>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-ink">
      <span>{label}</span>
      <input
        type="checkbox"
        className="h-4 w-4 accent-accent"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function AdminProvidersPanel({
  providers: initialProviders,
  models: initialModels,
  canEdit,
}: {
  providers: ProviderAdminView[];
  models: ModelAdminView[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [providers, setProviders] = useState(initialProviders);
  const [models, setModels] = useState(initialModels);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [ceilingDrafts, setCeilingDrafts] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        initialProviders.map((p) => [
          p.id,
          p.dailyCostCeilingUsdMicros == null
            ? ""
            : String(p.dailyCostCeilingUsdMicros / 1_000_000),
        ])
      )
  );
  const [priorityDrafts, setPriorityDrafts] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        initialProviders.map((p) => [p.id, String(p.fallbackPriority)])
      )
  );

  async function patchProvider(
    providerId: string,
    patch: Record<string, unknown>
  ) {
    if (!canEdit) return;
    if (reason.trim().length < 3) {
      setMessage("Enter a reason (at least 3 characters) before mutating.");
      return;
    }
    setBusy(`provider:${providerId}`);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/providers/${providerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim(), ...patch }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        provider?: {
          enabled: boolean;
          fallbackPriority: number;
          dailyCostCeilingUsdMicros: number | null;
          mockOnly: boolean;
        };
      };
      if (!res.ok) {
        setMessage(`${res.status}: ${body.error ?? "update failed"}`);
        return;
      }
      if (body.provider) {
        setProviders((prev) =>
          prev.map((p) =>
            p.id === providerId
              ? {
                  ...p,
                  enabled: body.provider!.enabled,
                  fallbackPriority: body.provider!.fallbackPriority,
                  dailyCostCeilingUsdMicros:
                    body.provider!.dailyCostCeilingUsdMicros,
                  mockOnly: body.provider!.mockOnly,
                }
              : p
          )
        );
      }
      setMessage(`Updated ${providerId}`);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "request failed");
    } finally {
      setBusy(null);
    }
  }

  async function patchModel(
    modelId: string,
    patch: Record<string, unknown>
  ) {
    if (!canEdit) return;
    if (reason.trim().length < 3) {
      setMessage("Enter a reason (at least 3 characters) before mutating.");
      return;
    }
    setBusy(`model:${modelId}`);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/models/${encodeURIComponent(modelId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim(), ...patch }),
        }
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        model?: {
          enabled: boolean;
          autoEligible: boolean;
          frontierEligible: boolean;
        };
      };
      if (!res.ok) {
        setMessage(`${res.status}: ${body.error ?? "update failed"}`);
        return;
      }
      if (body.model) {
        setModels((prev) =>
          prev.map((m) =>
            m.modelId === modelId
              ? {
                  ...m,
                  enabled: body.model!.enabled,
                  autoEligible: body.model!.autoEligible,
                  frontierEligible: body.model!.frontierEligible,
                }
              : m
          )
        );
      }
      setMessage(`Updated ${modelId}`);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "request failed");
    } finally {
      setBusy(null);
    }
  }

  async function runHealth(providerId: string) {
    if (!canEdit) return;
    setBusy(`health:${providerId}`);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/providers/${providerId}/health`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        healthy?: boolean;
        latencyMs?: number | null;
        errorClass?: string | null;
        configured?: boolean;
      };
      if (!res.ok) {
        setMessage(`${res.status}: ${body.error ?? "health test failed"}`);
        return;
      }
      setMessage(
        body.healthy
          ? `${providerId} healthy · ${body.latencyMs ?? "?"}ms`
          : `${providerId} unhealthy · ${body.errorClass ?? "unknown"}` +
              (body.configured === false ? " (not configured)" : "")
      );
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "request failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      {canEdit ? (
        <div className="space-y-2">
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-ink-faint">
              Mutation reason (required for saves)
            </span>
            <input
              className="input w-full max-w-xl"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Disable OpenAI during incident"
            />
          </label>
          {message ? (
            <p className="font-mono text-xs text-ink-muted" role="status">
              {message}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-ink-faint">
          Support role is read-only. Admin or super_admin can mutate and run
          health tests.
        </p>
      )}

      <Section title="Providers">
        <ul className="divide-y divide-mist-200 border-y border-mist-200">
          {providers.map((p) => {
            const disabled = !canEdit || busy !== null;
            return (
              <li key={p.id} className="space-y-4 py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-display text-xl text-ink">
                      {p.displayName}
                    </p>
                    <p className="font-mono text-xs text-ink-faint">{p.id}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span
                      className={
                        p.configured
                          ? "text-ink"
                          : "text-ink-faint"
                      }
                    >
                      {p.configured ? "Configured" : "Not configured"}
                    </span>
                    <span className="text-mist-300">·</span>
                    <span>{p.enabled ? "Enabled" : "Disabled"}</span>
                    {p.mockOnly ? (
                      <>
                        <span className="text-mist-300">·</span>
                        <span>Mock-only</span>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  <Metric
                    label="Last success"
                    value={formatWhen(p.metrics.lastSuccessAt)}
                  />
                  <Metric
                    label="Last failure"
                    value={formatWhen(p.metrics.lastFailureAt)}
                  />
                  <Metric
                    label="Requests (30d)"
                    value={String(p.metrics.requestCount)}
                  />
                  <Metric
                    label="Error rate"
                    value={formatPct(p.metrics.errorRate)}
                  />
                  <Metric
                    label="Avg latency"
                    value={
                      p.metrics.avgLatencyMs == null
                        ? "—"
                        : `${p.metrics.avgLatencyMs}ms`
                    }
                  />
                  <Metric
                    label="Est. cost (30d)"
                    value={formatUsdMicros(p.metrics.estimatedCostUsdMicros)}
                  />
                  <Metric
                    label="Failovers"
                    value={String(p.metrics.failoverCount)}
                  />
                  <Metric
                    label="Mock fallbacks"
                    value={String(p.metrics.mockFallbackCount)}
                  />
                  <Metric
                    label="Routing priority"
                    value={String(p.fallbackPriority)}
                  />
                  <Metric
                    label="Daily cost ceiling"
                    value={
                      p.dailyCostCeilingUsdMicros == null
                        ? "None"
                        : formatUsdMicros(p.dailyCostCeilingUsdMicros)
                    }
                  />
                  <Metric
                    label="Last health"
                    value={
                      p.lastHealthCheck
                        ? `${p.lastHealthCheck.ok ? "ok" : "fail"} · ${
                            p.lastHealthCheck.latencyMs ?? "?"
                          }ms`
                        : "—"
                    }
                  />
                </div>

                <div>
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-ink-faint">
                    Supported models
                  </p>
                  {p.supportedModels.length === 0 ? (
                    <p className="text-sm text-ink-muted">None</p>
                  ) : (
                    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-muted">
                      {p.supportedModels.map((m) => (
                        <li key={m.modelId} className="font-mono text-xs">
                          {m.displayName}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {canEdit ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <ToggleRow
                      label="Enabled"
                      checked={p.enabled}
                      disabled={disabled}
                      onChange={(next) =>
                        void patchProvider(p.id, { enabled: next })
                      }
                    />
                    <ToggleRow
                      label="Mock-only mode"
                      checked={p.mockOnly}
                      disabled={disabled || p.id === "mock"}
                      onChange={(next) =>
                        void patchProvider(p.id, { mockOnly: next })
                      }
                    />
                    <label className="block space-y-1 text-sm">
                      <span className="text-xs text-ink-faint">
                        Fallback priority (lower = preferred)
                      </span>
                      <div className="flex gap-2">
                        <input
                          className="input w-full"
                          value={priorityDrafts[p.id] ?? ""}
                          disabled={disabled}
                          onChange={(e) =>
                            setPriorityDrafts((prev) => ({
                              ...prev,
                              [p.id]: e.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          className="btn-secondary shrink-0"
                          disabled={disabled}
                          onClick={() => {
                            const n = Number(priorityDrafts[p.id]);
                            if (!Number.isFinite(n)) {
                              setMessage("Priority must be a number");
                              return;
                            }
                            void patchProvider(p.id, {
                              fallbackPriority: Math.round(n),
                            });
                          }}
                        >
                          Save
                        </button>
                      </div>
                    </label>
                    <label className="block space-y-1 text-sm sm:col-span-2">
                      <span className="text-xs text-ink-faint">
                        Daily cost ceiling (USD, empty = none)
                      </span>
                      <div className="flex gap-2">
                        <input
                          className="input w-full max-w-xs"
                          value={ceilingDrafts[p.id] ?? ""}
                          disabled={disabled}
                          placeholder="e.g. 25"
                          onChange={(e) =>
                            setCeilingDrafts((prev) => ({
                              ...prev,
                              [p.id]: e.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          className="btn-secondary shrink-0"
                          disabled={disabled}
                          onClick={() => {
                            const raw = (ceilingDrafts[p.id] ?? "").trim();
                            if (raw === "") {
                              void patchProvider(p.id, {
                                dailyCostCeilingUsdMicros: null,
                              });
                              return;
                            }
                            const usd = Number(raw);
                            if (!Number.isFinite(usd) || usd < 0) {
                              setMessage("Ceiling must be a non-negative number");
                              return;
                            }
                            void patchProvider(p.id, {
                              dailyCostCeilingUsdMicros: Math.round(
                                usd * 1_000_000
                              ),
                            });
                          }}
                        >
                          Save
                        </button>
                      </div>
                    </label>
                    <div className="flex items-end">
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={disabled}
                        onClick={() => void runHealth(p.id)}
                      >
                        {busy === `health:${p.id}`
                          ? "Testing…"
                          : "Safe health test"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Models">
        <ul className="divide-y divide-mist-200 border-y border-mist-200">
          {models.map((m) => {
            const disabled = !canEdit || busy !== null;
            return (
              <li key={m.modelId} className="space-y-3 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="text-base font-medium text-ink">
                      {m.displayName}
                    </p>
                    <p className="font-mono text-xs text-ink-faint">
                      {m.modelId} · {m.vendor} · catalog {m.catalogStatus}
                    </p>
                  </div>
                  <p className="text-xs text-ink-muted">
                    Bindings:{" "}
                    {m.bindings.map((b) => b.provider).join(", ") || "—"}
                  </p>
                </div>
                {canEdit ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <ToggleRow
                      label="Enabled"
                      checked={m.enabled}
                      disabled={disabled}
                      onChange={(next) =>
                        void patchModel(m.modelId, { enabled: next })
                      }
                    />
                    <ToggleRow
                      label="Auto eligibility"
                      checked={m.autoEligible}
                      disabled={disabled}
                      onChange={(next) =>
                        void patchModel(m.modelId, { autoEligible: next })
                      }
                    />
                    <ToggleRow
                      label="Frontier eligibility"
                      checked={m.frontierEligible}
                      disabled={disabled}
                      onChange={(next) =>
                        void patchModel(m.modelId, {
                          frontierEligible: next,
                        })
                      }
                    />
                  </div>
                ) : (
                  <p className="text-sm text-ink-muted">
                    {m.enabled ? "Enabled" : "Disabled"}
                    {" · "}
                    Auto {m.autoEligible ? "on" : "off"}
                    {" · "}
                    Frontier {m.frontierEligible ? "on" : "off"}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}
