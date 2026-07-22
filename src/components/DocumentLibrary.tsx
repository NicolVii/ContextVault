"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Upload, FileText, Trash2, Loader2, FileWarning } from "lucide-react";
import { ConfirmModal } from "@/components/ConfirmModal";
import type { DocumentRecord } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function DocumentLibrary({
  initialDocuments,
  initialAttachmentsAllowed = true,
  initialStorageUsed = 0,
  initialStorageCap = 0,
}: {
  initialDocuments?: DocumentRecord[];
  initialAttachmentsAllowed?: boolean;
  initialStorageUsed?: number;
  initialStorageCap?: number;
} = {}) {
  const hasInitial = initialDocuments !== undefined;
  const [docs, setDocs] = useState<DocumentRecord[]>(initialDocuments ?? []);
  const [loading, setLoading] = useState(!hasInitial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<DocumentRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [attachmentsAllowed, setAttachmentsAllowed] = useState(
    initialAttachmentsAllowed
  );
  const [storageUsed, setStorageUsed] = useState(initialStorageUsed);
  const [storageCap, setStorageCap] = useState(initialStorageCap);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [docsRes, usageRes] = await Promise.all([
      fetch("/api/documents"),
      fetch("/api/billing/usage"),
    ]);
    const json = await docsRes.json();
    setDocs(json.documents ?? []);
    if (usageRes.ok) {
      const usage = await usageRes.json();
      setAttachmentsAllowed(Boolean(usage.entitlements?.attachments));
      setStorageCap(Number(usage.entitlements?.storageBytes) || 0);
      setStorageUsed(Number(usage.storageUsedBytes) || 0);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!hasInitial) {
      void load();
    }
  }, [hasInitial, load]);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/documents", { method: "POST", body });
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Upload failed");
      return;
    }
    void load();
  }

  async function remove() {
    if (!toDelete) return;
    setBusy(true);
    await fetch(`/api/documents/${toDelete.id}`, { method: "DELETE" });
    setBusy(false);
    setToDelete(null);
    void load();
  }

  const storagePct =
    storageCap > 0 ? Math.min(100, Math.round((storageUsed / storageCap) * 100)) : 0;

  return (
    <div>
      {storageCap > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Library storage</span>
            <span>{storagePct}% used</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-mist-100">
            <div
              className="h-full rounded-full bg-accent/80"
              style={{ width: `${storagePct}%` }}
            />
          </div>
        </div>
      )}

      {!attachmentsAllowed ? (
        <div className="rounded-2xl border border-mist-200 bg-mist-50 p-6 text-center">
          <p className="text-sm font-medium text-ink">Files are on Lite and Pro</p>
          <p className="mt-1 text-xs text-ink-muted">
            Your memories stay available. Upgrade to attach documents.
          </p>
          <Link href="/vault/plan" className="btn-primary mt-4 inline-flex text-xs">
            View plans
          </Link>
        </div>
      ) : (
        <div className="card flex flex-col items-center gap-3 border-dashed p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Upload className="h-6 w-6" />
            )}
          </div>
          <div>
            <p className="font-medium text-brand-900">Upload a PDF or text file</p>
            <p className="text-sm text-brand-600">
              We extract the text, split it into searchable chunks and cite it in chat. Max 20 MiB.
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,text/plain,text/markdown,.pdf,.txt,.md"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
          <button
            className="btn-primary"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? "Processing…" : "Choose file"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading library">
            {[0, 1].map((i) => (
              <div key={i} className="card flex items-center gap-4 p-4">
                <div className="h-10 w-10 animate-pulse rounded-lg bg-mist-200/80" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-40 animate-pulse rounded bg-mist-200/80" />
                  <div className="h-3 w-28 animate-pulse rounded bg-mist-100" />
                </div>
              </div>
            ))}
          </div>
        ) : docs.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 p-10 text-center">
            <FileText className="h-10 w-10 text-brand-300" />
            <h3 className="text-lg font-semibold text-brand-900">No documents yet</h3>
            <p className="text-sm text-brand-600">
              Upload your first document to make it searchable in chat.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {docs.map((d) => (
              <div key={d.id} className="card flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  {d.status === "failed" ? (
                    <FileWarning className="h-5 w-5 text-red-500" />
                  ) : (
                    <FileText className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-brand-900">{d.filename}</p>
                  <p className="text-xs text-brand-500">
                    {(d.size_bytes / 1024).toFixed(0)} KB
                    {d.page_count ? ` · ${d.page_count} pages` : ""} · {formatDate(d.created_at)}
                  </p>
                </div>
                <span
                  className={`badge ${
                    d.status === "ready"
                      ? "bg-green-50 text-green-700"
                      : d.status === "failed"
                        ? "bg-red-50 text-red-700"
                        : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {d.status}
                </span>
                <button
                  className="btn-ghost text-red-600 hover:bg-red-50"
                  onClick={() => setToDelete(d)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!toDelete}
        title="Delete this document?"
        description="This removes the file and all of its searchable chunks. This cannot be undone."
        confirmLabel="Delete document"
        loading={busy}
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
