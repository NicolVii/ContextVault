import { requireStaffPage } from "@/lib/admin/auth";
import { isAdminRole } from "@/lib/admin/roles";
import { getSystemHealthReport } from "@/lib/admin/system-health";
import { AdminSystemPanel } from "@/components/admin/AdminSystemPanel";

export const dynamic = "force-dynamic";

/** /admin/system — Cortaix system health and operational controls. */
export default async function AdminSystemPage() {
  const ctx = await requireStaffPage();
  const report = await getSystemHealthReport();
  const canEdit = isAdminRole(ctx.role);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          System health
        </h1>
        <p className="text-sm text-ink-muted">
          Platform diagnostics and audited operational controls. Kill-switches
          are enforced server-side; optional expiry auto-clears temporary
          restrictions.
        </p>
      </header>

      <AdminSystemPanel report={report} canEdit={canEdit} />
    </div>
  );
}
