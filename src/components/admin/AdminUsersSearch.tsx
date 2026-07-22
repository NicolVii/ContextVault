"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import type { AdminUserListItem } from "@/lib/admin/console";

export function AdminUsersSearch({
  initialQ,
  users,
}: {
  initialQ: string;
  users: AdminUserListItem[];
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    startTransition(() => {
      router.push(`/admin/users${params.toString() ? `?${params}` : ""}`);
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="flex flex-wrap gap-3">
        <input
          className="input max-w-md flex-1"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search email, name, or user id"
          aria-label="Search users"
        />
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Searching…" : "Search"}
        </button>
      </form>

      {users.length === 0 ? (
        <p className="text-sm text-ink-muted">No users match.</p>
      ) : (
        <div className="overflow-x-auto border-t border-mist-200">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-mist-100 text-xs uppercase tracking-wide text-ink-faint">
                <th className="py-3 pr-4 font-medium">User</th>
                <th className="py-3 pr-4 font-medium">Role</th>
                <th className="py-3 pr-4 font-medium">Plan</th>
                <th className="py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-mist-50 hover:bg-white/60"
                >
                  <td className="py-3 pr-4">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="font-medium text-accent hover:underline"
                    >
                      {u.displayName || u.email || u.id.slice(0, 8)}
                    </Link>
                    <p className="font-mono text-xs text-ink-muted">
                      {u.email ?? "—"}
                    </p>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs">{u.role}</td>
                  <td className="py-3 pr-4">
                    <span className="font-medium">{u.planId}</span>
                    {u.planStatus ? (
                      <span className="ml-2 text-xs text-ink-muted">
                        {u.planStatus}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 text-xs text-ink-muted">
                    {u.createdAt
                      ? new Date(u.createdAt).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
