"use client";

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ResponseInfoMeta {
  createdAt: string;
  modelLabel: string;
  memoryRegistered: boolean;
}

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

/**
 * Discreet ⓘ under a Thinking response. Hover/click on desktop; tap on mobile.
 */
export function ResponseInfoButton({ meta }: { meta: ResponseInfoMeta }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative mt-1.5 inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="Response details"
        aria-expanded={open}
        className={cn(
          "rounded-md p-1 text-ink-faint transition-colors hover:bg-mist-100 hover:text-ink-muted",
          open && "bg-mist-100 text-ink-muted"
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <Info className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-xl border border-mist-200 bg-white p-3 text-xs leading-relaxed text-ink-muted shadow-soft">
          <p className="text-ink">{formatWhen(meta.createdAt)}</p>
          <p className="mt-1.5">
            <span className="text-ink-faint">Model · </span>
            {meta.modelLabel}
          </p>
          <p className="mt-1.5">
            {meta.memoryRegistered ? "Added to memory" : "No memory added"}
          </p>
        </div>
      )}
    </div>
  );
}
