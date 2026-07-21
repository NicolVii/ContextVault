"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
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

  const groups = useMemo(() => {
    const map = new Map<string, Memory[]>();
    for (const m of memories) {
      const key = dayLabel(m.created_at);
      const list = map.get(key) ?? [];
      list.push(m);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [memories]);

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex justify-end">
        <Link href="/vault/memories/new" className="btn-ghost text-sm">
          <Plus className="h-4 w-4" /> Add
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-ink-faint">Loading…</p>
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
          {groups.map(([label, items]) => (
            <section key={label}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                {label}
              </h2>
              <ul className="space-y-2">
                {items.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/vault/memories/${m.id}`}
                      className="card block px-4 py-3 transition-colors hover:bg-mist-50"
                    >
                      <p className="line-clamp-3 text-sm leading-relaxed text-ink">{m.content}</p>
                      <p className="mt-2 text-xs text-ink-faint">{formatDate(m.created_at)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
