export default function VaultLoading() {
  return (
    <div className="mx-auto flex max-w-lg flex-col" aria-busy="true" aria-label="Loading">
      <div className="mb-6 h-4 w-64 max-w-full animate-pulse rounded bg-mist-200/70" />
      <div className="mb-6 h-12 animate-pulse rounded-2xl border border-mist-200 bg-mist-50" />
      <div className="overflow-hidden rounded-2xl border border-mist-200 bg-white">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-mist-100 px-4 py-4 last:border-b-0"
          >
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-mist-200/80" />
              <div className="h-3 w-40 animate-pulse rounded bg-mist-100" />
            </div>
            <div className="h-4 w-4 animate-pulse rounded bg-mist-100" />
          </div>
        ))}
      </div>
      <div className="mt-6 overflow-hidden rounded-2xl border border-mist-200 bg-white">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-mist-100 px-4 py-4 last:border-b-0"
          >
            <div className="flex-1 space-y-2">
              <div className="h-4 w-28 animate-pulse rounded bg-mist-200/80" />
              <div className="h-3 w-36 animate-pulse rounded bg-mist-100" />
            </div>
            <div className="h-4 w-4 animate-pulse rounded bg-mist-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
