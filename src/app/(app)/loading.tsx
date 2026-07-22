export default function AppLoading() {
  return (
    <div className="bg-atmosphere flex min-h-screen flex-col">
      <div className="mx-auto w-full max-w-3xl px-5 py-5 sm:px-8">
        <div className="h-8 w-28 animate-pulse rounded-lg bg-mist-200/80" />
        <div className="mt-10 space-y-3">
          <div className="h-4 w-3/4 max-w-md animate-pulse rounded bg-mist-200/70" />
          <div className="h-4 w-1/2 max-w-sm animate-pulse rounded bg-mist-200/60" />
          <div className="mt-8 h-24 animate-pulse rounded-2xl bg-mist-200/50" />
        </div>
      </div>
    </div>
  );
}
