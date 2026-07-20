"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import { ConfirmModal } from "@/components/ConfirmModal";

export function DangerZone() {
  const router = useRouter();
  const [mode, setMode] = useState<null | "memories" | "account">(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!mode) return;
    setBusy(true);
    const res = await fetch("/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true, scope: mode }),
    });
    setBusy(false);
    const done = mode;
    setMode(null);
    if (!res.ok) return;
    if (done === "account") {
      router.push("/");
    } else {
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-brand-900">Export your data</h2>
        <p className="mt-1 text-sm text-brand-600">
          Download all of your memories, profile and document metadata as JSON. Your data is yours.
        </p>
        <a href="/api/export" className="btn-secondary mt-4">
          <Download className="h-4 w-4" /> Export as JSON
        </a>
      </div>

      <div className="card border-red-200 p-6">
        <h2 className="text-lg font-semibold text-red-700">Danger zone</h2>
        <p className="mt-1 text-sm text-brand-600">
          These actions are permanent. You&apos;ll be asked to confirm before anything is deleted.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button className="btn-secondary" onClick={() => setMode("memories")}>
            <Trash2 className="h-4 w-4" /> Delete all memories
          </button>
          <button className="btn-danger" onClick={() => setMode("account")}>
            <Trash2 className="h-4 w-4" /> Delete my account
          </button>
        </div>
      </div>

      <ConfirmModal
        open={mode === "memories"}
        title="Delete all memories?"
        description="Every memory will be permanently deleted. Your account and documents remain. This cannot be undone."
        confirmLabel="Delete all memories"
        requirePhrase="DELETE"
        loading={busy}
        onConfirm={run}
        onCancel={() => setMode(null)}
      />
      <ConfirmModal
        open={mode === "account"}
        title="Delete your entire account?"
        description="This permanently deletes your account and all associated memories, documents and chats. This cannot be undone."
        confirmLabel="Delete my account"
        requirePhrase="DELETE MY ACCOUNT"
        loading={busy}
        onConfirm={run}
        onCancel={() => setMode(null)}
      />
    </div>
  );
}
