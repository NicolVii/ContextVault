import { requireStaffPage } from "@/lib/admin/auth";
import { listAdminUsers } from "@/lib/admin/console";
import { AdminUsersSearch } from "@/components/admin/AdminUsersSearch";

export const dynamic = "force-dynamic";

/** /admin/users — searchable user directory. */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  await requireStaffPage();
  const q = searchParams.q ?? "";
  const users = await listAdminUsers({ q: q || undefined, limit: 100 });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Users</h1>
        <p className="text-sm text-ink-muted">
          Look up accounts by email, display name, or user id.
        </p>
      </header>
      <AdminUsersSearch initialQ={q} users={users} />
    </div>
  );
}
