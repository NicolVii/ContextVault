import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStaffPage } from "@/lib/admin/auth";
import { isAdminRole } from "@/lib/admin/roles";
import { isLaunchPlanId } from "@/lib/billing/plan-config";
import { getAdminPlanDetail } from "@/lib/billing/plan-editor";
import { AdminPlanEditor } from "@/components/admin/AdminPlanEditor";

export const dynamic = "force-dynamic";

type PageProps = { params: { planId: string } };

/** /admin/plans/[planId] — edit entitlements, pricing, campaigns, rollback. */
export default async function AdminPlanDetailPage({ params }: PageProps) {
  const ctx = await requireStaffPage();
  if (!isLaunchPlanId(params.planId)) notFound();

  let detail;
  try {
    detail = await getAdminPlanDetail(params.planId);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm">
          <Link
            href="/admin/plans"
            className="text-ink-muted transition-colors hover:text-accent"
          >
            ← Plans
          </Link>
        </p>
        <h1 className="font-display text-3xl text-ink">
          {detail.product.label}
        </h1>
        <p className="text-sm text-ink-muted">
          Active version{" "}
          <span className="font-mono">
            {detail.activeVersion
              ? `v${detail.activeVersion.version}`
              : "none"}
          </span>
          . Changes publish a new version, write an audit entry, and can be
          rolled back.
        </p>
      </header>
      <AdminPlanEditor detail={detail} canMutate={isAdminRole(ctx.role)} />
    </div>
  );
}
