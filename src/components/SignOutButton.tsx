"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ConfirmModal } from "@/components/ConfirmModal";
import { cn } from "@/lib/utils";

export function SignOutButton({
  className,
  confirm = true,
}: {
  className?: string;
  /** When true, show a calm confirm dialog before signing out. */
  confirm?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setOpen(false);
    setLoading(false);
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (confirm ? setOpen(true) : void signOut())}
        className={cn(
          "w-full px-4 py-3 text-left text-sm text-ink-faint transition-colors hover:bg-mist-50 hover:text-ink-muted",
          className
        )}
      >
        Sign out
      </button>
      <ConfirmModal
        open={open}
        title="Sign out?"
        description="You can sign back in anytime with the same account."
        confirmLabel="Sign out"
        loading={loading}
        onConfirm={() => void signOut()}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
