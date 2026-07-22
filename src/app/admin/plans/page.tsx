import Link from "next/link";
import { requireStaffPage } from "@/lib/admin/auth";
import { listAdminPlans } from "@/lib/billing/plan-editor";
import { isAdminRole } from "@/lib/admin/roles";

export const dynamic = "force-dynamic";

function formatEur(cents: number): string {
  if (cents === 0) return "Free";
  return `€${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}/mo`;
}

/** /admin/plans — Free / Lite / Pro plan editor index. */
export default async function AdminPlansPage() {
  const ctx = await requireStaffPage();
  const plans = await listAdminPlans();
  const canEdit = isAdminRole(ctx.role);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Plan editor
        </h1>
        <p className="text-sm text-ink-muted">
          View and version Free, Lite, and Pro configuration. Every publish
          requires a reason, validates entitlements, writes a plan version, and
          appends an audit entry. Temporary campaigns can raise limits without
          permanently changing the plan.
        </p>
        {!canEdit ? (
          <p className="text-sm text-ink-faint">
            Support role is read-only here. Admin or super_admin can publish.
          </p>
        ) : null}
      </header>

      <ul className="divide-y divide-mist-200 border-y border-mist-200">
        {plans.map((plan) => (
          <li key={plan.planId}>
            <Link
              href={`/admin/plans/${plan.planId}`}
              className="flex flex-wrap items-baseline justify-between gap-2 py-4 transition-colors hover:bg-mist-50/60"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-display text-xl text-ink">{plan.label}</p>
                <p className="font-mono text-xs text-ink-faint">{plan.planId}</p>
              </div>
              <div className="text-right text-sm text-ink-muted">
                <p>{formatEur(plan.amountEurCentsMonthly)}</p>
                <p>
                  {plan.public ? "Public" : "Hidden"} · v
                  {plan.activeVersion ?? "—"}
                  {plan.activeCampaignCount > 0
                    ? ` · ${plan.activeCampaignCount} campaign${plan.activeCampaignCount === 1 ? "" : "s"}`
                    : ""}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
