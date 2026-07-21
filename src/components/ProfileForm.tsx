"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CHAT_MODELS } from "@/lib/ai/models";
import { ProfileFields } from "@/components/ProfileFields";
import type { Profile } from "@/lib/types";

/** Legacy wrapper used by onboarding-era profile pages. */
export function ProfileForm({ profile, email }: { profile: Profile; email: string }) {
  const router = useRouter();
  const [model, setModel] = useState(profile.default_model);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function saveModel(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ default_model: model }),
    });
    setBusy(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <ProfileFields profile={profile} email={email} />
      <form onSubmit={saveModel} className="card space-y-4 p-6">
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
        {saved && <p className="text-sm text-green-700">Saved.</p>}
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "Saving…" : "Save model"}
        </button>
      </form>
    </div>
  );
}
