import { requireStaffPage } from "@/lib/admin/auth";
import { getAdminOverviewStats } from "@/lib/admin/console";
import { AdminOverviewPanels } from "@/components/admin/AdminOverviewPanels";

export const dynamic = "force-dynamic";

/** /admin — operator overview (users, plans, usage, mock fallback, failures). */
export default async function AdminOverviewPage() {
  await requireStaffPage();
  const stats = await getAdminOverviewStats();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Overview
        </h1>
        <p className="text-sm text-ink-muted">
          Platform snapshot for Cortaix commercial ops. Demo grants and
          simulations are never treated as paid revenue.
        </p>
      </header>
      <AdminOverviewPanels stats={stats} />
    </div>
  );
}
