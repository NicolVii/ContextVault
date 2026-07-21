"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface SearchHit {
  kind: "memory" | "conversation" | "file";
  id: string;
  title: string;
  snippet: string;
  href: string;
  created_at: string;
}

function VaultSearchInner() {
  const [q, setQ] = useState("");
  const [memories, setMemories] = useState<SearchHit[]>([]);
  const [conversations, setConversations] = useState<SearchHit[]>([]);
  const [files, setFiles] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!q.trim()) {
      setMemories([]);
      setConversations([]);
      setFiles([]);
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
    const json = await res.json();
    setMemories(json.memories ?? []);
    setConversations(json.conversations ?? []);
    setFiles(json.files ?? []);
    setLoading(false);
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const empty =
    !loading && q.trim() && memories.length + conversations.length + files.length === 0;

  return (
    <div className="mx-auto max-w-lg">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input
          className="input pl-9"
          placeholder="Search everything…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      </div>

      <div className="mt-6 space-y-8">
        {!q.trim() && (
          <p className="text-sm text-ink-faint">
            Search memories, conversations, and files.
          </p>
        )}
        {loading && <p className="text-sm text-ink-faint">Searching…</p>}
        {empty && <p className="text-sm text-ink-faint">No matches.</p>}

        <ResultGroup title="Memories" hits={memories} />
        <ResultGroup title="Conversations" hits={conversations} />
        <ResultGroup title="Files" hits={files} />
      </div>
    </div>
  );
}

function ResultGroup({ title, hits }: { title: string; hits: SearchHit[] }) {
  if (hits.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">
        {title}
      </h2>
      <ul className="space-y-2">
        {hits.map((hit) => (
          <li key={`${hit.kind}-${hit.id}`}>
            <Link
              href={hit.href}
              className="block rounded-2xl border border-mist-100 px-4 py-3 transition-colors hover:bg-mist-50"
            >
              <p className="line-clamp-2 text-sm text-ink">{hit.snippet || hit.title}</p>
              <p className="mt-1 text-xs text-ink-faint">{formatDate(hit.created_at)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function VaultSearchPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-faint">Loading…</p>}>
      <VaultSearchInner />
    </Suspense>
  );
}
