export default function ReviewLoading() {
  return (
    <div className="mx-auto max-w-lg" aria-busy="true" aria-label="Loading review">
      <div className="mb-6 h-4 w-64 max-w-full animate-pulse rounded bg-mist-200/70" />
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-2xl bg-mist-100" />
        ))}
      </div>
    </div>
  );
}
