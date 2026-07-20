"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CHAT_MODELS } from "@/lib/ai/models";
import type { Profile } from "@/lib/types";

export function ProfileForm({ profile, email }: { profile: Profile; email: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [persona, setPersona] = useState(profile.persona ?? "");
  const [model, setModel] = useState(profile.default_model);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    setError(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: displayName || null,
        persona: persona || null,
        default_model: model,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Could not save your profile");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="card space-y-5 p-6">
      <div>
        <label className="label">Email</label>
        <input className="input bg-sand-50" value={email} disabled />
      </div>
      <div>
        <label className="label">Display name</label>
        <input
          className="input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Persona / bio</label>
        <textarea
          className="input min-h-[90px]"
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
          placeholder="How would you describe yourself to a new assistant?"
        />
      </div>
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

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Saved.</p>}

      <div className="flex justify-end">
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
