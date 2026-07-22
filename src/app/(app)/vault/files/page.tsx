import { redirect } from "next/navigation";
import { DocumentLibrary } from "@/components/DocumentLibrary";
import { getSessionContext } from "@/lib/auth";
import { getPlanUsageSnapshot } from "@/lib/billing/plan-usage";
import { timed } from "@/lib/perf";
import type { DocumentRecord } from "@/lib/types";

export default async function VaultFilesPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  const [docsRes, snap] = await Promise.all([
    timed("vault.files.documents", () =>
      ctx.supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false })
    ),
    timed("vault.files.planSnapshot", () => getPlanUsageSnapshot(ctx.user.id)),
  ]);

  if (docsRes.error) {
    console.error("vault files list failed", docsRes.error.message);
  }

  const documents = (docsRes.data ?? []) as DocumentRecord[];
  const storageUsedBytes = documents.reduce(
    (n, d) => n + (Number(d.size_bytes) || 0),
    0
  );

  return (
    <div className="mx-auto max-w-lg">
      <p className="mb-6 text-sm text-ink-muted">
        Files you attach become part of your vault and can support answers.
      </p>
      <DocumentLibrary
        initialDocuments={documents}
        initialAttachmentsAllowed={Boolean(snap.entitlements.attachments)}
        initialStorageUsed={storageUsedBytes}
        initialStorageCap={Number(snap.entitlements.storageBytes) || 0}
      />
    </div>
  );
}
