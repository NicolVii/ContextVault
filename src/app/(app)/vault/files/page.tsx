import { DocumentLibrary } from "@/components/DocumentLibrary";

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
