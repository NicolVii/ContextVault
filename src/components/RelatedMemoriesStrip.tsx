"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { RetrievedMemory } from "@/lib/types";

export function RelatedMemoriesStrip({
  memoryId,
  limit = 6,
}: {
  memoryId: string;
  limit?: number;
}) {
  const [related, setRelated] = useState<RetrievedMemory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/memories/${memoryId}/related?limit=${limit}`);
      const json = await res.json();
      if (!cancelled) {
        setRelated(json.related ?? []);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [memoryId, limit]);

  if (loading) {
    return (
      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Related
        </h2>
        <p className="mt-3 text-sm text-ink-faint">Looking for connections…</p>
      </section>
    );
  }

  if (related.length === 0) {
    return (
      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Related
        </h2>
        <p className="mt-3 text-sm text-ink-faint">
          Connections will appear as your vault grows.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Related
        </h2>
        <Link
          href={`/vault/connections?memory=${memoryId}`}
          className="text-xs font-medium text-accent hover:underline"
        >
          See all related
        </Link>
      </div>
      <ul className="mt-3 flex gap-3 overflow-x-auto pb-1">
        {related.map((m) => (
          <li key={m.id} className="w-44 shrink-0">
            <Link
              href={`/vault/memories/${m.id}`}
              className="card block h-full px-3 py-3 transition-colors hover:bg-mist-50"
            >
              <p className="line-clamp-4 text-xs leading-relaxed text-ink">{m.content}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
