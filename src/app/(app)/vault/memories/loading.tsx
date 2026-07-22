export default function MemoriesLoading() {
  return (
    <div className="mx-auto max-w-lg" aria-busy="true" aria-label="Loading memories">
      <div className="mb-4 flex justify-end">
        <div className="h-8 w-16 animate-pulse rounded-lg bg-mist-100" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2 rounded-2xl border border-mist-200 px-4 py-3">
            <div className="h-4 w-full animate-pulse rounded bg-mist-200/80" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-mist-100" />
            <div className="h-3 w-24 animate-pulse rounded bg-mist-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
