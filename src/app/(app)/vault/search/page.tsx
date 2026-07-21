"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Memory } from "@/lib/types";

/** Stage 1: memory text search. Stage 2 adds conversations + files. */
export default function VaultSearchPage() {
  const [q, setQ] = useState("");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!q.trim()) {
      setMemories([]);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ q: q.trim(), status: "active" });
    const res = await fetch(`/api/memories?${params}`);
    const json = await res.json();
    setMemories(json.memories ?? []);
    setLoading(false);
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="mx-auto max-w-lg">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input
          className="input pl-9"
          placeholder="Search memories…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      </div>

      <div className="mt-6 space-y-2">
        {!q.trim() && (
          <p className="text-sm text-ink-faint">Start typing to search your memories.</p>
        )}
        {loading && <p className="text-sm text-ink-faint">Searching…</p>}
        {!loading && q.trim() && memories.length === 0 && (
          <p className="text-sm text-ink-faint">No matches.</p>
        )}
        {memories.map((m) => (
          <Link
            key={m.id}
            href={`/vault/memories/${m.id}`}
            className="block rounded-2xl border border-mist-100 px-4 py-3 transition-colors hover:bg-mist-50"
          >
            <p className="line-clamp-2 text-sm text-ink">{m.content}</p>
            <p className="mt-1 text-xs text-ink-faint">{formatDate(m.created_at)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
