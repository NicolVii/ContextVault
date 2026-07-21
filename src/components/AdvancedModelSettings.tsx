"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AUTO_MODEL_ID,
  chatPickerOptions,
  DEFAULT_MODEL_ID,
  resolveModelProfile,
} from "@/lib/ai/models";

const picker = chatPickerOptions();

function normalizeDefault(raw: string): string {
  if (raw === AUTO_MODEL_ID || raw.startsWith("preset:")) return raw;
  return resolveModelProfile(raw)?.id ?? DEFAULT_MODEL_ID;
}

export function AdvancedModelSettings({ defaultModel }: { defaultModel: string }) {
  const router = useRouter();
  const [model, setModel] = useState(normalizeDefault(defaultModel));
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
          <option value={AUTO_MODEL_ID}>Auto · router picks</option>
          <optgroup label="Presets">
            {picker.presets.map((p) => (
              <option key={p.id} value={`preset:${p.id}`}>
                {p.label} — {p.description}
              </option>
            ))}
          </optgroup>
          <optgroup label="Models">
            {picker.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} · {m.vendor}
              </option>
            ))}
          </optgroup>
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
