import { redirect } from "next/navigation";
import { ReviewQueue } from "@/components/ReviewQueue";
import { getSessionContext } from "@/lib/auth";
import { timed } from "@/lib/perf";
import type { Memory } from "@/lib/types";

export default async function VaultReviewPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  const { data, error } = await timed("vault.review.list", () =>
    ctx.supabase
      .from("memories")
      .select("*")
      .eq("status", "proposed")
      .order("created_at", { ascending: false })
  );

  if (error) {
    console.error("vault review list failed", error.message);
  }

  return (
    <div className="mx-auto max-w-lg">
      <p className="mb-6 text-sm text-ink-muted">
        Keep what feels right. Discard the rest. Nothing here is active until you keep it.
      </p>
      <ReviewQueue initialMemories={(data ?? []) as Memory[]} />
    </div>
  );
}
