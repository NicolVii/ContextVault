import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStaffPage } from "@/lib/admin/auth";
import { isAdminRole } from "@/lib/admin/roles";
import { getAdminUserDetail } from "@/lib/admin/console";
import { AdminUserDetailView } from "@/components/admin/AdminUserDetailView";

export const dynamic = "force-dynamic";

/** /admin/users/[userId] — full operator dossier + mutation actions. */
export default async function AdminUserDetailPage({
  params,
}: {
  params: { userId: string };
}) {
  const ctx = await requireStaffPage();
  const detail = await getAdminUserDetail(params.userId);
  if (!detail) notFound();

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        <Link href="/admin/users" className="underline underline-offset-2">
          ← Users
        </Link>
      </p>
      <AdminUserDetailView detail={detail} canMutate={isAdminRole(ctx.role)} />
    </div>
  );
}
