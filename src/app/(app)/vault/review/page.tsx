import { ReviewQueue } from "@/components/ReviewQueue";

export default function VaultReviewPage() {
  return (
    <div className="mx-auto max-w-lg">
      <p className="mb-6 text-sm text-ink-muted">
        Keep what feels right. Discard the rest. Nothing here is active until you keep it.
      </p>
      <ReviewQueue />
    </div>
  );
}
