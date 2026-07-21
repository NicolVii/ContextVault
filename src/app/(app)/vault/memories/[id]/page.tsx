"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Archive, Pencil, Trash2, Save } from "lucide-react";
import { ConfirmModal } from "@/components/ConfirmModal";
import { formatDate } from "@/lib/utils";
import type { Memory } from "@/lib/types";

export default function MemoryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [memory, setMemory] = useState<Memory | null>(null);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/memories/${params.id}`);
      const json = await res.json();
      if (!res.ok || !json.memory) {
        setError("Memory not found");
        return;
      }
      setMemory(json.memory);
      setContent(json.memory.content);
    }
    void load();
  }, [params.id]);

  async function patch(payload: Record<string, unknown>) {
    if (!memory) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/memories/${memory.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Could not save");
      return;
    }
    const json = await res.json();
    setMemory(json.memory ?? { ...memory, ...payload });
    setEditing(false);
  }

  async function remove() {
    if (!memory) return;
    setBusy(true);
    const res = await fetch(`/api/memories/${memory.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.push("/vault/memories");
  }

  if (error && !memory) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!memory) {
    return <p className="text-sm text-ink-faint">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-lg">
      <p className="text-xs text-ink-faint">{formatDate(memory.created_at)}</p>

      {editing ? (
        <textarea
          className="input mt-4 min-h-[160px] text-[15px] leading-relaxed"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      ) : (
        <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
          {memory.content}
        </p>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-8 flex flex-wrap gap-2">
        {editing ? (
          <>
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() => patch({ content })}
            >
              <Save className="h-4 w-4" /> Save
            </button>
            <button className="btn-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button className="btn-secondary" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </button>
            {memory.status !== "archived" && (
              <button
                className="btn-ghost"
                disabled={busy}
                onClick={() => patch({ status: "archived" })}
              >
                <Archive className="h-4 w-4" /> Archive
              </button>
            )}
            <button
              className="btn-ghost text-red-600 hover:bg-red-50"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </>
        )}
      </div>

      {/* Stage 2: related memories strip */}

      <ConfirmModal
        open={confirmDelete}
        title="Delete this memory?"
        description="This permanently removes the memory."
        confirmLabel="Delete"
        loading={busy}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
