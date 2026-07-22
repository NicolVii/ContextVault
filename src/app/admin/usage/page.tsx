import { requireStaffPage } from "@/lib/admin/auth";
import {
  getAdminUsageEconomics,
  usageFilterOptions,
  type AdminUsageFilterInput,
} from "@/lib/admin/usage-economics";
import { AdminUsageDashboard } from "@/components/admin/AdminUsageDashboard";

export const dynamic = "force-dynamic";

function pick(
  value: string | string[] | undefined
): string | null {
  if (Array.isArray(value)) return value[0]?.trim() || null;
  return value?.trim() || null;
}

/** /admin/usage — Usage & Economics dashboard (server-side aggregates). */
export default async function AdminUsagePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await requireStaffPage();

  const daysRaw = pick(searchParams.days);
  const filters: AdminUsageFilterInput = {
    from: pick(searchParams.from),
    to: pick(searchParams.to),
    days: daysRaw != null ? Number(daysRaw) : 30,
    planId: pick(searchParams.plan),
    provider: pick(searchParams.provider),
    modelId: pick(searchParams.model),
    intensity: pick(searchParams.intensity),
    billingMode: pick(searchParams.billingMode),
    audience: pick(searchParams.audience),
  };

  const [stats, options] = await Promise.all([
    getAdminUsageEconomics(filters),
    Promise.resolve(usageFilterOptions()),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Usage &amp; Economics
        </h1>
        <p className="text-sm text-ink-muted">
          Platform activity and estimated unit economics. Aggregates run on the
          server — raw usage events are never sent to the browser. Estimated
          costs and catalog revenue are distinct from confirmed Stripe cash.
        </p>
      </header>
      <AdminUsageDashboard stats={stats} options={options} />
    </div>
  );
}
