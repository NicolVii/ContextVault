"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SystemHealthReport, HealthStatus } from "@/lib/admin/system-health";
import type { OperationalControlKey } from "@/lib/admin/system-controls";

function statusTone(status: HealthStatus): string {
  switch (status) {
    case "ok":
      return "text-emerald-800";
    case "warn":
      return "text-amber-800";
    case "error":
      return "text-red-800";
    default:
      return "text-ink-muted";
  }
}

function statusLabel(status: HealthStatus): string {
  switch (status) {
    case "ok":
      return "OK";
    case "warn":
      return "Warn";
    case "error":
      return "Error";
    default:
      return "Unknown";
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

export function AdminSystemPanel({
  report: initialReport,
  canEdit,
}: {
  report: SystemHealthReport;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [report, setReport] = useState(initialReport);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expiryDrafts, setExpiryDrafts] = useState<Record<string, string>>({});
  const [targetDrafts, setTargetDrafts] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        initialReport.controls.map((c) => [c.key, c.targetIds.join(", ")])
      )
  );

  async function patchControl(
    key: OperationalControlKey,
    enabled: boolean
  ) {
    if (!canEdit) return;
    if (reason.trim().length < 3) {
      setMessage("Enter a reason (at least 3 characters) before mutating.");
      return;
    }
    setBusy(key);
    setMessage(null);
    const expiresRaw = expiryDrafts[key]?.trim();
    let expiresAt: string | null = null;
    if (enabled && expiresRaw) {
      const ms = Date.parse(expiresRaw);
      if (!Number.isFinite(ms)) {
        setMessage("Invalid expiry datetime.");
        setBusy(null);
        return;
      }
      expiresAt = new Date(ms).toISOString();
    }
    const targets = (targetDrafts[key] ?? "")
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/admin/system", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          enabled,
          reason: reason.trim(),
          expiresAt,
          targetIds: targets,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        control?: SystemHealthReport["controls"][number];
      };
      if (!res.ok) {
        setMessage(`${res.status}: ${body.error ?? "update failed"}`);
        return;
      }
      if (body.control) {
        setReport((prev) => ({
          ...prev,
          controls: prev.controls.map((c) =>
            c.key === key
              ? {
                  ...c,
                  ...body.control!,
                  label: c.label,
                  description: c.description,
                  supportsTargets: c.supportsTargets,
                }
              : c
          ),
        }));
      }
      setMessage(
        enabled ? `Enabled ${key}.` : `Disabled ${key}.`
      );
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  async function refresh() {
    setBusy("refresh");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/system");
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        report?: SystemHealthReport;
      };
      if (!res.ok || !body.report) {
        setMessage(body.error ?? "Refresh failed");
        return;
      }
      setReport(body.report);
      setTargetDrafts(
        Object.fromEntries(
          body.report.controls.map((c) => [c.key, c.targetIds.join(", ")])
        )
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Commercial mode" value={report.commercialMode} />
          <Metric
            label="Environment"
            value={
              [report.environment.nodeEnv, report.environment.vercelEnv]
                .filter(Boolean)
                .join(" / ") || "—"
            }
          />
          <Metric
            label="Deployment"
            value={report.deploymentId ?? "—"}
          />
          <Metric
            label="Generated"
            value={new Date(report.generatedAt).toLocaleString()}
          />
        </div>
        <button
          type="button"
          className="btn-ghost text-sm"
          disabled={busy === "refresh"}
          onClick={() => void refresh()}
        >
          Refresh
        </button>
      </div>

      <Section title="Health checks">
        <ul className="divide-y divide-mist-100 border-t border-mist-200">
          {report.checks.map((check) => (
            <li
              key={check.id}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{check.label}</p>
                <p className="text-sm text-ink-muted">{check.detail}</p>
              </div>
              <p
                className={`shrink-0 font-mono text-xs uppercase tracking-wide ${statusTone(check.status)}`}
              >
                {statusLabel(check.status)}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Failure signals (30d)">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Failed jobs"
            value={String(report.failures.failedJobs)}
          />
          <Metric
            label="Failed inference"
            value={String(report.failures.failedInferenceRequests30d)}
          />
          <Metric
            label="Failed webhooks"
            value={String(report.failures.failedWebhooks30d)}
          />
          <Metric
            label="Critical errors"
            value={String(report.failures.criticalErrors30d)}
          />
        </div>
      </Section>

      <Section title="Feature flags">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(report.featureFlags).map(([key, on]) => (
            <li
              key={key}
              className="flex items-center justify-between gap-3 border-b border-mist-100 py-2 text-sm"
            >
              <span className="font-mono text-ink">{key}</span>
              <span className={on ? "text-emerald-800" : "text-ink-faint"}>
                {on ? "on" : "off"}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Operational controls">
        {!canEdit ? (
          <p className="text-sm text-ink-muted">
            Support role is read-only. Admin or super_admin required to mutate.
          </p>
        ) : (
          <div className="space-y-3">
            <label className="block space-y-1 text-sm">
              <span className="text-ink-muted">Audit reason (required)</span>
              <input
                className="input w-full max-w-xl"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are you changing this control?"
              />
            </label>
            {message ? (
              <p className="text-sm text-ink-muted" role="status">
                {message}
              </p>
            ) : null}
          </div>
        )}

        <ul className="divide-y divide-mist-100 border-t border-mist-200">
          {report.controls.map((ctl) => (
            <li key={ctl.key} className="space-y-3 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 max-w-xl space-y-1">
                  <p className="text-sm font-medium text-ink">{ctl.label}</p>
                  <p className="text-sm text-ink-muted">{ctl.description}</p>
                  <p className="font-mono text-xs text-ink-faint">{ctl.key}</p>
                  {ctl.active ? (
                    <p className="text-xs text-amber-800">
                      Active
                      {ctl.expiresAt
                        ? ` · expires ${new Date(ctl.expiresAt).toLocaleString()}`
                        : " · no expiry"}
                      {ctl.reason ? ` · ${ctl.reason}` : ""}
                    </p>
                  ) : (
                    <p className="text-xs text-ink-faint">Inactive</p>
                  )}
                  {ctl.supportsTargets && ctl.targetIds.length > 0 ? (
                    <p className="font-mono text-xs text-ink-muted">
                      targets: {ctl.targetIds.join(", ")}
                    </p>
                  ) : null}
                </div>
                {canEdit ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-ghost text-sm"
                      disabled={busy === ctl.key || ctl.active}
                      onClick={() => void patchControl(ctl.key, true)}
                    >
                      Enable
                    </button>
                    <button
                      type="button"
                      className="btn-ghost text-sm"
                      disabled={busy === ctl.key || !ctl.enabled}
                      onClick={() => void patchControl(ctl.key, false)}
                    >
                      Disable
                    </button>
                  </div>
                ) : null}
              </div>
              {canEdit ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1 text-xs">
                    <span className="text-ink-muted">
                      Optional expiry (local datetime)
                    </span>
                    <input
                      type="datetime-local"
                      className="input w-full text-sm"
                      value={expiryDrafts[ctl.key] ?? ""}
                      onChange={(e) =>
                        setExpiryDrafts((prev) => ({
                          ...prev,
                          [ctl.key]: e.target.value,
                        }))
                      }
                    />
                  </label>
                  {ctl.supportsTargets ? (
                    <label className="block space-y-1 text-xs">
                      <span className="text-ink-muted">
                        Target ids (comma-separated; empty = all)
                      </span>
                      <input
                        className="input w-full font-mono text-sm"
                        value={targetDrafts[ctl.key] ?? ""}
                        onChange={(e) =>
                          setTargetDrafts((prev) => ({
                            ...prev,
                            [ctl.key]: e.target.value,
                          }))
                        }
                        placeholder="e.g. openai, anthropic"
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
