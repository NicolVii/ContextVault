"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, PlusCircle, Inbox } from "lucide-react";
import { MemoryCard } from "@/components/MemoryCard";
import { MEMORY_TYPES, MEMORY_TYPE_META, type Memory, type MemoryType } from "@/lib/types";

export function MemoriesExplorer() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [type, setType] = useState<MemoryType | "">("");
  const [status, setStatus] = useState("active");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    const res = await fetch(`/api/memories?${params.toString()}`);
    const json = await res.json();
    setMemories(json.memories ?? []);
    setLoading(false);
  }, [q, type, status]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-400" />
          <input
            className="input pl-9"
            placeholder="Search your memories…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="input sm:w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">Active</option>
          <option value="proposed">Proposed</option>
          <option value="archived">Archived</option>
          <option value="">All statuses</option>
        </select>
        <select
          className="input sm:w-44"
          value={type}
          onChange={(e) => setType(e.target.value as MemoryType | "")}
        >
          <option value="">All types</option>
          {MEMORY_TYPES.map((t) => (
            <option key={t} value={t}>
              {MEMORY_TYPE_META[t].label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-brand-500">Loading memories…</p>
        ) : memories.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 p-10 text-center">
            <Inbox className="h-10 w-10 text-brand-300" />
            <h3 className="text-lg font-semibold text-brand-900">No memories here yet</h3>
            <p className="max-w-sm text-sm text-brand-600">
              Add your first memory or start a chat — Context Vault will suggest memories you can review.
            </p>
            <Link href="/memories/new" className="btn-primary mt-2">
              <PlusCircle className="h-4 w-4" /> Add a memory
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {memories.map((m) => (
              <MemoryCard key={m.id} memory={m} onChanged={load} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
