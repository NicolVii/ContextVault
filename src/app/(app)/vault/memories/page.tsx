"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Pin } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Memory } from "@/lib/types";

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

/**
 * Client-loaded list: Soft Navigation can paint chrome immediately instead of
 * waiting for the full memories query on the server (V2 SSR regression).
 */
export default function VaultMemoriesPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/memories?status=active");
    const json = await res.json();
    setMemories(json.memories ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pinned = useMemo(
    () => memories.filter((m) => Boolean(m.pinned_at)),
    [memories]
  );
  const unpinned = useMemo(
    () => memories.filter((m) => !m.pinned_at),
    [memories]
  );

  const groups = useMemo(() => {
    const map = new Map<string, Memory[]>();
    for (const m of unpinned) {
      const key = dayLabel(m.created_at);
      const list = map.get(key) ?? [];
      list.push(m);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [unpinned]);

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex justify-end">
        <Link href="/vault/memories/new" className="btn-ghost text-sm">
          <Plus className="h-4 w-4" /> Add
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading memories">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2 rounded-2xl border border-mist-200 px-4 py-3">
              <div className="h-4 w-full animate-pulse rounded bg-mist-200/80" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-mist-100" />
              <div className="h-3 w-24 animate-pulse rounded bg-mist-100" />
            </div>
          ))}
        </div>
      ) : memories.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-display text-xl text-ink">No memories yet</p>
          <p className="mt-2 text-sm text-ink-muted">
            Capture a thought from Thinking, or add one here.
          </p>
          <Link href="/vault/memories/new" className="btn-primary mt-6">
            Add a memory
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {pinned.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                <Pin className="h-3 w-3" /> Pinned
              </h2>
              <ul className="space-y-2">
                {pinned.map((m) => (
                  <MemoryLink key={m.id} memory={m} />
                ))}
              </ul>
            </section>
          )}
          {groups.map(([label, items]) => (
            <section key={label}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                {label}
              </h2>
              <ul className="space-y-2">
                {items.map((m) => (
                  <MemoryLink key={m.id} memory={m} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function MemoryLink({ memory }: { memory: Memory }) {
  return (
    <li>
      <Link
        href={`/vault/memories/${memory.id}`}
        className="card block px-4 py-3 transition-colors hover:bg-mist-50"
      >
        <p className="line-clamp-3 text-sm leading-relaxed text-ink">{memory.content}</p>
        <p className="mt-2 text-xs text-ink-faint">{formatDate(memory.created_at)}</p>
      </Link>
    </li>
  );
}
