"use client";

import { useState } from "react";

type Workspace = {
  id: string;
  name: string;
  default_model: string;
  monthly_credit_budget: number | null;
};

export function WorkspacePanel({ initial }: { initial: Workspace[] }) {
  const [items, setItems] = useState(initial);
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          default_model: "auto",
          monthly_credit_budget: budget ? Number(budget) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Create failed");
      setItems((prev) => [...prev, json.workspace]);
      setName("");
      setBudget("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/workspaces?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Delete failed");
      }
      setItems((prev) => prev.filter((w) => w.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-1 text-xs text-ink-muted">
        {items.length === 0 ? (
          <li>No workspaces yet.</li>
        ) : (
          items.map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-2">
              <span>
                {w.name}
                {w.monthly_credit_budget
                  ? ` · budget ${w.monthly_credit_budget.toLocaleString()}`
                  : ""}
                {` · ${w.default_model}`}
              </span>
              <button
                type="button"
                className="text-red-600 hover:underline"
                disabled={busy}
                onClick={() => remove(w.id)}
              >
                Delete
              </button>
            </li>
          ))
        )}
      </ul>
      <form onSubmit={create} className="space-y-2">
        <input
          className="input"
          placeholder="Workspace name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="input"
          placeholder="Monthly credit budget (optional)"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          inputMode="numeric"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button type="submit" className="btn-primary text-xs" disabled={busy || !name.trim()}>
          {busy ? "…" : "Create workspace"}
        </button>
      </form>
    </div>
  );
}
