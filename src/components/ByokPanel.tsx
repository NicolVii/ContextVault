"use client";

import { useState } from "react";
import { BYOK_PROVIDERS } from "@/lib/billing/byok-providers";

export function ByokPanel({
  initialKeys,
}: {
  initialKeys: { provider: string; label: string | null; created_at: string }[];
}) {
  const [keys, setKeys] = useState(initialKeys);
  const [provider, setProvider] = useState<(typeof BYOK_PROVIDERS)[number]>("openai");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/byok", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setApiKey("");
      const list = await fetch("/api/billing/byok").then((r) => r.json());
      setKeys(list.keys ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/billing/byok?provider=${encodeURIComponent(p)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Delete failed");
      }
      setKeys((k) => k.filter((row) => row.provider !== p));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {keys.length > 0 && (
        <ul className="space-y-1 text-xs text-ink-muted">
          {keys.map((k) => (
            <li key={k.provider} className="flex items-center justify-between">
              <span>
                {k.provider}
                {k.label ? ` · ${k.label}` : ""}
              </span>
              <button
                type="button"
                className="text-red-600 hover:underline"
                disabled={busy}
                onClick={() => remove(k.provider)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={save} className="space-y-2">
        <select
          className="input"
          value={provider}
          onChange={(e) => setProvider(e.target.value as typeof provider)}
        >
          {BYOK_PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input
          className="input"
          type="password"
          placeholder="API key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          required
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button type="submit" className="btn-primary text-xs" disabled={busy || !apiKey}>
          {busy ? "…" : "Save key"}
        </button>
      </form>
    </div>
  );
}
