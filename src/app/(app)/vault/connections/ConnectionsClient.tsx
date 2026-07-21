"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { RetrievedMemory } from "@/lib/types";
import { formatDate } from "@/lib/utils";

/**
 * Lightweight Connections explorer — entered from “See all related”, not Vault hub.
 */
export default function ConnectionsClient() {
  const params = useSearchParams();
  const initialId = params.get("memory");

  const [memories, setMemories] = useState<{ id: string; content: string }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [related, setRelated] = useState<RetrievedMemory[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingRelated, setLoadingRelated] = useState(false);

  useEffect(() => {
    async function load() {
      setLoadingList(true);
      const res = await fetch("/api/memories?status=active");
      const json = await res.json();
      const list = (json.memories ?? []).map((m: { id: string; content: string }) => ({
        id: m.id,
        content: m.content,
      }));
      setMemories(list);
      setSelectedId((prev) => prev ?? list[0]?.id ?? null);
      setLoadingList(false);
    }
    void load();
  }, []);

  const loadRelated = useCallback(async (id: string) => {
    setLoadingRelated(true);
    const res = await fetch(`/api/memories/${id}/related?limit=16`);
    const json = await res.json();
    setRelated(json.related ?? []);
    setLoadingRelated(false);
  }, []);

  useEffect(() => {
    if (selectedId) void loadRelated(selectedId);
  }, [selectedId, loadRelated]);

  const selected = memories.find((m) => m.id === selectedId);

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <p className="text-sm text-ink-muted">
        See how memories connect. Choose one to explore related thoughts.
      </p>

      {loadingList ? (
        <p className="text-sm text-ink-faint">Loading…</p>
      ) : memories.length === 0 ? (
        <p className="text-sm text-ink-faint">
          Add a few memories first — connections appear as the vault fills.
        </p>
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Choose a memory
            </h2>
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {memories.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(m.id)}
                    className={`w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      selectedId === m.id
                        ? "bg-accent-soft text-ink"
                        : "text-ink-muted hover:bg-mist-50"
                    }`}
                  >
                    <span className="line-clamp-2">{m.content}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Connected to
              </h2>
              {selected && (
                <Link
                  href={`/vault/memories/${selected.id}`}
                  className="text-xs text-accent hover:underline"
                >
                  Open memory
                </Link>
              )}
            </div>
            {loadingRelated ? (
              <p className="text-sm text-ink-faint">Finding connections…</p>
            ) : related.length === 0 ? (
              <p className="text-sm text-ink-faint">No strong connections yet.</p>
            ) : (
              <ul className="space-y-2">
                {related.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/vault/memories/${m.id}`}
                      className="card block px-4 py-3 transition-colors hover:bg-mist-50"
                    >
                      <p className="text-sm leading-relaxed text-ink">{m.content}</p>
                      <p className="mt-1 text-xs text-ink-faint">
                        {formatDate(m.created_at)}
                        {m.similarity > 0.05
                          ? ` · ${Math.round(m.similarity * 100)}% alike`
                          : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
