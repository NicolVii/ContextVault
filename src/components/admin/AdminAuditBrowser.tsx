"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import type { AdminAuditEntry } from "@/lib/admin/console";

export function AdminAuditBrowser({
  entries,
  initialAction,
  initialTargetUserId,
}: {
  entries: AdminAuditEntry[];
  initialAction: string;
  initialTargetUserId: string;
}) {
  const router = useRouter();
  const [action, setAction] = useState(initialAction);
  const [targetUserId, setTargetUserId] = useState(initialTargetUserId);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (action.trim()) params.set("action", action.trim());
    if (targetUserId.trim()) params.set("targetUserId", targetUserId.trim());
    startTransition(() => {
      router.push(`/admin/audit${params.toString() ? `?${params}` : ""}`);
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Action filter (e.g. admin.usage.reset)"
          aria-label="Action filter"
        />
        <input
          className="input max-w-sm"
          value={targetUserId}
          onChange={(e) => setTargetUserId(e.target.value)}
          placeholder="Target user id"
          aria-label="Target user id"
        />
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Filtering…" : "Filter"}
        </button>
      </form>

      {entries.length === 0 ? (
        <p className="text-sm text-ink-muted">No audit entries.</p>
      ) : (
        <ul className="space-y-4 border-t border-mist-200 pt-4">
          {entries.map((e) => {
            const metaUser =
              typeof e.metadata.userId === "string" ? e.metadata.userId : null;
            const relatedUser = e.targetType === "user" ? e.targetId : metaUser;
            return (
              <li key={e.id} className="space-y-1 border-b border-mist-50 pb-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-sm text-ink">{e.action}</p>
                  <p className="text-xs text-ink-muted">
                    {new Date(e.createdAt).toLocaleString()}
                  </p>
                </div>
                <p className="text-xs text-ink-muted">
                  Actor{" "}
                  <span className="font-mono">{e.actorUserId ?? "—"}</span>
                  {e.targetType ? (
                    <>
                      {" "}
                      · {e.targetType}{" "}
                      <span className="font-mono">{e.targetId ?? "—"}</span>
                    </>
                  ) : null}
                </p>
                {relatedUser ? (
                  <p className="text-xs">
                    <Link
                      href={`/admin/users/${relatedUser}`}
                      className="text-accent hover:underline"
                    >
                      Open user
                    </Link>
                  </p>
                ) : null}
                {Object.keys(e.metadata).length > 0 ? (
                  <pre className="overflow-x-auto rounded-lg bg-mist-50 p-2 font-mono text-[11px] text-ink-muted">
                    {JSON.stringify(e.metadata, null, 2)}
                  </pre>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
