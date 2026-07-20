import { cn } from "@/lib/utils";
import { MEMORY_TYPE_META, type MemoryStatus, type MemoryType } from "@/lib/types";

const STATUS_STYLES: Record<MemoryStatus, string> = {
  active: "bg-green-50 text-green-700",
  proposed: "bg-amber-50 text-amber-700",
  rejected: "bg-red-50 text-red-700",
  superseded: "bg-slate-100 text-slate-600",
  archived: "bg-slate-100 text-slate-600",
  deleted: "bg-red-50 text-red-700",
};

export function StatusBadge({ status }: { status: MemoryStatus }) {
  return (
    <span className={cn("badge capitalize", STATUS_STYLES[status])}>{status}</span>
  );
}

export function TypeBadge({ type }: { type: MemoryType }) {
  return (
    <span className="badge bg-brand-50 text-brand-700">
      {MEMORY_TYPE_META[type].label}
    </span>
  );
}

export function SensitiveBadge() {
  return <span className="badge bg-purple-50 text-purple-700">Sensitive</span>;
}
