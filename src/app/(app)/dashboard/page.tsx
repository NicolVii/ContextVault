import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { MemoriesExplorer } from "@/components/MemoriesExplorer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MEMORY_TYPE_META, type MemoryType } from "@/lib/types";

async function getStats() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("memories").select("type, status").neq("status", "deleted");
  const rows = data ?? [];
  const active = rows.filter((r) => r.status === "active").length;
  const proposed = rows.filter((r) => r.status === "proposed").length;
  const byType: Record<string, number> = {};
  for (const r of rows) {
    if (r.status === "active") byType[r.type] = (byType[r.type] ?? 0) + 1;
  }
  return { active, proposed, byType, total: rows.length };
}

export default async function DashboardPage() {
  const stats = await getStats();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Your memory dashboard</h1>
          <p className="text-sm text-brand-600">
            Your personal control centre for everything the AI remembers about you.
          </p>
        </div>
        <Link href="/memories/new" className="btn-primary">
          <PlusCircle className="h-4 w-4" /> Add memory
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Active memories" value={stats.active} />
        <StatCard label="Awaiting review" value={stats.proposed} highlight={stats.proposed > 0} />
        <StatCard label="Total stored" value={stats.total} />
        <StatCard
          label="Top type"
          value={
            Object.entries(stats.byType).sort((a, b) => b[1] - a[1])[0]?.[0]
              ? MEMORY_TYPE_META[
                  Object.entries(stats.byType).sort((a, b) => b[1] - a[1])[0][0] as MemoryType
                ].label
              : "—"
          }
        />
      </div>

      {stats.proposed > 0 && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>
            You have {stats.proposed} suggested {stats.proposed === 1 ? "memory" : "memories"} waiting for review.
          </span>
          <Link href="/review" className="font-medium underline">
            Review now
          </Link>
        </div>
      )}

      <div className="mt-8">
        <MemoriesExplorer />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div className={`card p-4 ${highlight ? "ring-1 ring-amber-200" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-brand-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-brand-900">{value}</p>
    </div>
  );
}
