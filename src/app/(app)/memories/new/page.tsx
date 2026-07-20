"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { MEMORY_TYPES, MEMORY_TYPE_META, type MemoryType } from "@/lib/types";

export default function NewMemoryPage() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [type, setType] = useState<MemoryType>("semantic");
  const [category, setCategory] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        type,
        category: category || null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Could not save the memory. Please check your input.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard" className="btn-ghost mb-4 -ml-2">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="text-2xl font-bold text-brand-900">Add a memory</h1>
      <p className="text-sm text-brand-600">
        Memories you add here are trusted and active immediately.
      </p>

      <form onSubmit={submit} className="card mt-6 space-y-5 p-6">
        <div>
          <label className="label">What should the AI remember?</label>
          <textarea
            required
            className="input min-h-[110px]"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="e.g. I prefer metric units and concise explanations."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Type</label>
            <select
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value as MemoryType)}
            >
              {MEMORY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MEMORY_TYPE_META[t].label} — {MEMORY_TYPE_META[t].description}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Category (optional)</label>
            <input
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Work, Health, Preferences…"
            />
          </div>
        </div>

        {type === "temporary" && (
          <div>
            <label className="label">Expires on (optional)</label>
            <input
              type="date"
              className="input"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="flex justify-end gap-3">
          <Link href="/dashboard" className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Saving…" : "Save memory"}
          </button>
        </div>
      </form>
    </div>
  );
}
