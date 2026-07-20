import { DocumentLibrary } from "@/components/DocumentLibrary";

export default function DocumentsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-brand-900">Documents</h1>
      <p className="text-sm text-brand-600">
        Upload documents to give the AI grounded, citable knowledge from your own files.
      </p>
      <div className="mt-6">
        <DocumentLibrary />
      </div>
    </div>
  );
}
