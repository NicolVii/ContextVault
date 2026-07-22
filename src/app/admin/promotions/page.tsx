import { requireStaffPage } from "@/lib/admin/auth";
import { isAdminRole } from "@/lib/admin/roles";
import { listPromotions } from "@/lib/billing";
import { AdminPromotionsPanel } from "@/components/admin/AdminPromotionsPanel";

export const dynamic = "force-dynamic";

/** /admin/promotions — Cortaix promotions (price discounts + usage bonuses). */
export default async function AdminPromotionsPage() {
  const ctx = await requireStaffPage();
  const promotions = await listPromotions({ limit: 200 });
  const canEdit = isAdminRole(ctx.role);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Promotions
        </h1>
        <p className="text-sm text-ink-muted">
          Manage public codes and automatic campaigns. Price discounts may map
          to Stripe coupons in live mode; entitlement and usage bonuses stay
          inside Cortaix. Pause, resume, and end are audited.
        </p>
        {!canEdit ? (
          <p className="text-sm text-ink-faint">
            Support role is read-only here. Admin or super_admin can mutate.
          </p>
        ) : null}
      </header>

      <AdminPromotionsPanel promotions={promotions} canEdit={canEdit} />
    </div>
  );
}
