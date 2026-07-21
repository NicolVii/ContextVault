"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { MemoryCard } from "@/components/MemoryCard";
import { SensitiveBadge } from "@/components/Badges";
import type { Memory } from "@/lib/types";

export function ReviewQueue() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/memories?status=proposed");
    const json = await res.json();
    setMemories(json.memories ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-sm text-brand-500">Loading review queue…</p>;

  if (memories.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-3 p-10 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
        <h3 className="text-lg font-semibold text-brand-900">You&apos;re all caught up</h3>
        <p className="max-w-sm text-sm text-brand-600">
          Suggested memories from your thinking will appear here. Keep what fits; discard the rest.
        </p>
      </div>
    );
  }

  const hasSensitive = memories.some((m) => m.is_sensitive);

  return (
    <div>
      {hasSensitive && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-800">
          <SensitiveBadge />
          <span>
            Some suggestions look sensitive. They are never auto-approved — review them carefully.
          </span>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {memories.map((m) => (
          <MemoryCard key={m.id} memory={m} onChanged={load} />
        ))}
      </div>
    </div>
  );
}
