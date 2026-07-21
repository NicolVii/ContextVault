import { Suspense } from "react";
import ConnectionsClient from "./ConnectionsClient";

export default function ConnectionsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-faint">Loading…</p>}>
      <ConnectionsClient />
    </Suspense>
  );
}
