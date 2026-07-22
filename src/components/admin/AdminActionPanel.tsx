"use client";

import { useState } from "react";

type Action = "staff_ping" | "admin_ping" | "super_only";

interface Props {
  canAdmin: boolean;
  canSuperAdmin: boolean;
}

export function AdminActionPanel({ canAdmin, canSuperAdmin }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: Action) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        action?: string;
        role?: string;
      };
      if (!res.ok) {
        setMessage(`${res.status}: ${body.error ?? "failed"}`);
        return;
      }
      setMessage(`OK · ${body.action} as ${body.role}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 border-t border-mist-200 pt-6">
      <h2 className="text-lg font-medium text-ink">Actions</h2>
      <p className="text-sm text-ink-muted">
        Each button hits a server route that re-checks your role. Super-admin
        actions are rejected for lower roles even if the control is shown.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run("staff_ping")}
          className="btn-secondary"
        >
          Staff ping
        </button>
        <button
          type="button"
          disabled={busy || !canAdmin}
          onClick={() => void run("admin_ping")}
          className="btn-secondary"
          title={canAdmin ? undefined : "Requires admin or super_admin"}
        >
          Admin ping
        </button>
        <button
          type="button"
          disabled={busy || !canSuperAdmin}
          onClick={() => void run("super_only")}
          className="btn-secondary"
          title={canSuperAdmin ? undefined : "Requires super_admin"}
        >
          Super-admin only
        </button>
      </div>
      {message ? (
        <p className="font-mono text-xs text-ink-muted" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
