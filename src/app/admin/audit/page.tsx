import { requireStaffPage } from "@/lib/admin/auth";
import { listAdminAuditEntries } from "@/lib/admin/console";
import { AdminAuditBrowser } from "@/components/admin/AdminAuditBrowser";

export const dynamic = "force-dynamic";

/** /admin/audit — browse admin_audit_log. */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: { action?: string; targetUserId?: string };
}) {
  await requireStaffPage();
  const action = searchParams.action ?? "";
  const targetUserId = searchParams.targetUserId ?? "";
  const entries = await listAdminAuditEntries({
    action: action || undefined,
    targetUserId: targetUserId || undefined,
    limit: 100,
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Audit</h1>
        <p className="text-sm text-ink-muted">
          Every admin mutation is recorded here with actor, target, and reason.
        </p>
      </header>
      <AdminAuditBrowser
        entries={entries}
        initialAction={action}
        initialTargetUserId={targetUserId}
      />
    </div>
  );
}
