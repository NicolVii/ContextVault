import { ReviewQueue } from "@/components/ReviewQueue";

export default function ReviewPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold text-brand-900">Review queue</h1>
      <p className="text-sm text-brand-600">
        Approve the memories you want the AI to keep. Reject anything that isn&apos;t right.
        Nothing here is active until you approve it.
      </p>
      <div className="mt-6">
        <ReviewQueue />
      </div>
    </div>
  );
}
