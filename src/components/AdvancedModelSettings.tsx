"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CHAT_MODELS } from "@/lib/ai/models";

export function AdvancedModelSettings({ defaultModel }: { defaultModel: string }) {
  const router = useRouter();
  const [model, setModel] = useState(defaultModel);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    setError(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ default_model: model }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Could not save model");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <label className="label">Default model</label>
        <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
          {CHAT_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} · {m.vendor}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-700">Saved.</p>}
      <button type="submit" disabled={busy} className="btn-primary">
        {busy ? "Saving…" : "Save model"}
      </button>
    </form>
  );
}
