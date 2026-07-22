import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Pin } from "lucide-react";
import { getSessionContext } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { timed } from "@/lib/perf";
import type { Memory } from "@/lib/types";

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

export default async function VaultMemoriesPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  const { data, error } = await timed("vault.memories.list", () =>
    ctx.supabase
      .from("memories")
      .select("*")
      .eq("status", "active")
      .order("pinned_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
  );

  if (error) {
    console.error("vault memories list failed", error.message);
  }

  const memories = (data ?? []) as Memory[];
  const pinned = memories.filter((m) => Boolean(m.pinned_at));
  const unpinned = memories.filter((m) => !m.pinned_at);

  const groups = new Map<string, Memory[]>();
  for (const m of unpinned) {
    const key = dayLabel(m.created_at);
    const list = groups.get(key) ?? [];
    list.push(m);
    groups.set(key, list);
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex justify-end">
        <Link href="/vault/memories/new" className="btn-ghost text-sm">
          <Plus className="h-4 w-4" /> Add
        </Link>
      </div>

      {memories.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-display text-xl text-ink">No memories yet</p>
          <p className="mt-2 text-sm text-ink-muted">
            Capture a thought from Thinking, or add one here.
          </p>
          <Link href="/vault/memories/new" className="btn-primary mt-6">
            Add a memory
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {pinned.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                <Pin className="h-3 w-3" /> Pinned
              </h2>
              <ul className="space-y-2">
                {pinned.map((m) => (
                  <MemoryLink key={m.id} memory={m} />
                ))}
              </ul>
            </section>
          )}
          {[...groups.entries()].map(([label, items]) => (
            <section key={label}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                {label}
              </h2>
              <ul className="space-y-2">
                {items.map((m) => (
                  <MemoryLink key={m.id} memory={m} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function MemoryLink({ memory }: { memory: Memory }) {
  return (
    <li>
      <Link
        href={`/vault/memories/${memory.id}`}
        className="card block px-4 py-3 transition-colors hover:bg-mist-50"
      >
        <p className="line-clamp-3 text-sm leading-relaxed text-ink">{memory.content}</p>
        <p className="mt-2 text-xs text-ink-faint">{formatDate(memory.created_at)}</p>
      </Link>
    </li>
  );
}
