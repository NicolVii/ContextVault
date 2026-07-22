export default function PlanLoading() {
  return (
    <div className="mx-auto max-w-lg space-y-4" aria-busy="true" aria-label="Loading plan">
      <div className="mb-6 h-4 w-56 max-w-full animate-pulse rounded bg-mist-200/70" />
      <div className="h-28 animate-pulse rounded-2xl border border-mist-200 bg-mist-50" />
      <div className="h-40 animate-pulse rounded-2xl border border-mist-200 bg-white" />
      <div className="h-24 animate-pulse rounded-2xl border border-mist-200 bg-white" />
    </div>
  );
}
