import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/admin/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Admin · ${BRAND.name}`,
  robots: { index: false, follow: false },
};

/**
 * Protected admin console layout. Staff gate runs here so every nested
 * page inherits server-side authorization (anon → login, user → 404).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireStaffPage();

  return (
    <AdminShell role={ctx.role} userId={ctx.user.id}>
      {children}
    </AdminShell>
  );
}
