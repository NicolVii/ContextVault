"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewVaultMemoryPage() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, type: "semantic" }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Could not save the memory.");
      return;
    }
    const json = await res.json();
    router.push(`/vault/memories/${json.memory.id}`);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg">
      <p className="text-sm text-ink-muted">Add something you want kept.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <textarea
          required
          className="input min-h-[140px] text-[15px] leading-relaxed"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="A preference, a fact, a note…"
          autoFocus
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Link href="/vault/memories" className="btn-ghost">
            Cancel
          </Link>
          <button type="submit" disabled={busy || !content.trim()} className="btn-primary">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
