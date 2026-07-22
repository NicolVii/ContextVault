import { requireStaffPage } from "@/lib/admin/auth";
import { isAdminRole } from "@/lib/admin/roles";
import { listProviderAdminViews } from "@/lib/inference/provider-ops";
import { AdminProvidersPanel } from "@/components/admin/AdminProvidersPanel";

export const dynamic = "force-dynamic";

/** /admin/providers — provider configuration, health, and routing controls. */
export default async function AdminProvidersPage() {
  const ctx = await requireStaffPage();
  const { providers, models } = await listProviderAdminViews({
    windowDays: 30,
  });
  const canEdit = isAdminRole(ctx.role);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Provider operations
        </h1>
        <p className="text-sm text-ink-muted">
          Configure inference adapters and model eligibility without exposing
          platform secrets or decrypted BYOK keys. Metrics cover the last 30
          days. Health tests use env keys only and never debit credits.
        </p>
      </header>

      <AdminProvidersPanel
        providers={providers}
        models={models}
        canEdit={canEdit}
      />
    </div>
  );
}
