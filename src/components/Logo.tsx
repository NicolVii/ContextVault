import { Vault } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
        <Vault className="h-5 w-5" />
      </span>
      <span className="text-brand-900">Context Vault</span>
    </span>
  );
}
