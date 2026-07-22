import { DocumentLibrary } from "@/components/DocumentLibrary";

/**
 * Thin server shell — documents + plan/storage entitlements load on the client
 * so Soft Navigation is not blocked on both queries (V2 SSR regression).
 */
export default function VaultFilesPage() {
  return (
    <div className="mx-auto max-w-lg">
      <p className="mb-6 text-sm text-ink-muted">
        Files you attach become part of your vault and can support answers.
      </p>
      <DocumentLibrary />
    </div>
  );
}
