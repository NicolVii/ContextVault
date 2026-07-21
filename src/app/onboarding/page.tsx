"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { CHAT_MODELS } from "@/lib/ai/models";

export default function OnboardingPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [persona, setPersona] = useState("");
  const [model, setModel] = useState(CHAT_MODELS[0].id);
  const [facts, setFacts] = useState(["", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName || null,
          persona: persona || null,
          default_model: model,
          onboarding_completed: true,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not save your profile");
      }
      const seedMemories = facts.map((f) => f.trim()).filter(Boolean);
      await Promise.all(
        seedMemories.map((content) =>
          fetch("/api/memories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content, type: "profile", category: "About me" }),
          })
        )
      );
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-sand-50 px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="card p-8">
          <div className="flex items-center gap-2 text-brand-600">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-medium">Let&apos;s set up your vault</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-brand-900">
            Tell us a little about you
          </h1>
          <p className="mt-1 text-sm text-brand-600">
            This becomes your first set of memories. You can edit or remove anything later.
          </p>

          <div className="mt-6 space-y-5">
            <div>
              <label className="label">What should we call you?</label>
              <input
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Alex"
              />
            </div>

            <div>
              <label className="label">A short bio / persona</label>
              <textarea
                className="input min-h-[80px]"
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                placeholder="Product designer who loves concise, practical answers."
              />
            </div>

            <div>
              <label className="label">Three things any AI should know about you</label>
              <div className="space-y-2">
                {facts.map((f, i) => (
                  <input
                    key={i}
                    className="input"
                    value={f}
                    onChange={(e) => {
                      const next = [...facts];
                      next[i] = e.target.value;
                      setFacts(next);
                    }}
                    placeholder={
                      [
                        "I prefer TypeScript over JavaScript",
                        "I live in Berlin",
                        "I like short, direct answers",
                      ][i]
                    }
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="label">Preferred model</label>
              <select
                className="input"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                {CHAT_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} · {m.vendor}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <button onClick={finish} disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? "Saving…" : "Enter my vault"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
