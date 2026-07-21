"use client";

import { useState } from "react";
import { Pencil, Trash2, Archive, Check, X, Save } from "lucide-react";
import { StatusBadge, TypeBadge, SensitiveBadge } from "@/components/Badges";
import { ConfirmModal } from "@/components/ConfirmModal";
import { MEMORY_TYPES, MEMORY_TYPE_META, type Memory } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function MemoryCard({
  memory,
  onChanged,
}: {
  memory: Memory;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(memory.content);
  const [type, setType] = useState(memory.type);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isProposed = memory.status === "proposed";

  async function patch(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/memories/${memory.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Action failed");
      return;
    }
    setEditing(false);
    onChanged();
  }

  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/memories/${memory.id}`, { method: "DELETE" });
    setBusy(false);
    setConfirmDelete(false);
    if (res.ok) onChanged();
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <TypeBadge type={memory.type} />
        <StatusBadge status={memory.status} />
        {memory.is_sensitive && <SensitiveBadge />}
        {memory.category && (
          <span className="badge bg-sand-100 text-brand-600">{memory.category}</span>
        )}
        <span className="ml-auto text-xs text-brand-500">
          {memory.source.replace("_", " ")} · {formatDate(memory.created_at)}
        </span>
      </div>

      {editing ? (
        <div className="mt-3 space-y-2">
          <textarea
            className="input min-h-[70px]"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <select
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value as Memory["type"])}
          >
            {MEMORY_TYPES.map((t) => (
              <option key={t} value={t}>
                {MEMORY_TYPE_META[t].label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-brand-900">{memory.content}</p>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {isProposed ? (
          <>
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() => patch({ status: "active" })}
            >
              <Check className="h-4 w-4" /> Keep
            </button>
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() => patch({ status: "rejected" })}
            >
              <X className="h-4 w-4" /> Discard
            </button>
          </>
        ) : editing ? (
          <>
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() => patch({ content, type })}
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
            {memory.status === "archived" && (
              <button
                className="btn-ghost"
                disabled={busy}
                onClick={() => patch({ status: "active" })}
              >
                Restore
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

      <ConfirmModal
        open={confirmDelete}
        title="Delete this memory?"
        description="This permanently removes the memory. This action cannot be undone."
        confirmLabel="Delete memory"
        loading={busy}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
