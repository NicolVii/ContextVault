"use client";

import { DocumentLibrary } from "@/components/DocumentLibrary";

/**
 * Client page: Soft Navigation paints chrome immediately instead of waiting on
 * documents + plan/storage entitlement work (V2 SSR regression).
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
