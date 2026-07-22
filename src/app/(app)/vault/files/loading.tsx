export default function FilesLoading() {
  return (
    <div className="mx-auto max-w-lg" aria-busy="true" aria-label="Loading files">
      <div className="mb-6 h-4 w-72 max-w-full animate-pulse rounded bg-mist-200/70" />
      <div className="h-40 animate-pulse rounded-2xl border border-dashed border-mist-200 bg-mist-50" />
      <div className="mt-6 space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-4 rounded-2xl border border-mist-200 p-4">
            <div className="h-10 w-10 animate-pulse rounded-lg bg-mist-200/80" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 animate-pulse rounded bg-mist-200/80" />
              <div className="h-3 w-28 animate-pulse rounded bg-mist-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
