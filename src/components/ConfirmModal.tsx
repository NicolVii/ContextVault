"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  requirePhrase,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  requirePhrase?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  const [phrase, setPhrase] = useState("");
  if (!open) return null;
  const canConfirm = !requirePhrase || phrase === requirePhrase;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-900/40" onClick={onCancel} />
      <div className="card relative z-10 w-full max-w-md p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-brand-900">{title}</h3>
            <p className="mt-1 text-sm text-brand-700">{description}</p>
          </div>
        </div>

        {requirePhrase && (
          <div className="mt-4">
            <label className="label">
              Type <span className="font-mono text-red-600">{requirePhrase}</span> to confirm
            </label>
            <input
              className="input"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={requirePhrase}
            />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button className="btn-secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            className="btn-danger"
            onClick={onConfirm}
            disabled={!canConfirm || loading}
          >
            {loading ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
