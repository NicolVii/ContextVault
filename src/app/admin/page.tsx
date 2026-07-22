import Link from "next/link";
import { requireStaffPage } from "@/lib/admin/auth";
import { isAdminRole, isSuperAdminRole } from "@/lib/admin/roles";
import { BRAND } from "@/lib/brand";
import { AdminActionPanel } from "@/components/admin/AdminActionPanel";

/**
 * Minimal protected admin console. Access is gated server-side via
 * user_roles (support+). Normal users receive 404; unauthenticated users
 * are sent to login.
 */
export default async function AdminPage() {
  const ctx = await requireStaffPage();
  const admin = isAdminRole(ctx.role);
  const superAdmin = isSuperAdminRole(ctx.role);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <header className="space-y-2">
        <p className="text-sm text-ink-muted">{BRAND.name}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Admin</h1>
        <p className="text-ink-muted">
          Server-authorized console. Your platform role is resolved from the
          database, not from the client.
        </p>
      </header>

      <section className="space-y-3 border-t border-mist-200 pt-6">
        <h2 className="text-lg font-medium text-ink">Session</h2>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">User id</dt>
            <dd className="font-mono text-xs text-ink">{ctx.user.id}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Role</dt>
            <dd className="font-mono text-ink">{ctx.role}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Admin actions</dt>
            <dd className="text-ink">{admin ? "allowed" : "denied"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Super-admin actions</dt>
            <dd className="text-ink">{superAdmin ? "allowed" : "denied"}</dd>
          </div>
        </dl>
      </section>

      <AdminActionPanel canAdmin={admin} canSuperAdmin={superAdmin} />

      <p className="text-sm text-ink-muted">
        <Link href="/" className="underline underline-offset-2">
          Back to app
        </Link>
      </p>
    </main>
  );
}
