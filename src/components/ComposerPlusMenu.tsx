"use client";

import { useEffect, useRef } from "react";
import { Check, Paperclip } from "lucide-react";
import { AUTO_MODEL_ID, CHAT_MODELS, MODEL_PRESETS } from "@/lib/ai/models";
import { cn } from "@/lib/utils";

export function ComposerPlusMenu({
  open,
  onClose,
  modelChoice,
  onSelectModel,
  onUploadFile,
}: {
  open: boolean;
  onClose: () => void;
  modelChoice: string;
  onSelectModel: (id: string) => void;
  onUploadFile: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 z-20 mb-2 w-[min(100vw-2rem,18rem)] overflow-hidden rounded-2xl border border-mist-200 bg-white shadow-soft"
      role="menu"
    >
      <div className="max-h-[min(70vh,22rem)] overflow-y-auto p-1.5">
        <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          Model
        </p>
        <ModelOption
          selected={modelChoice === AUTO_MODEL_ID}
          label="Auto"
          hint="Recommended"
          onClick={() => {
            onSelectModel(AUTO_MODEL_ID);
            onClose();
          }}
        />
        <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          Presets
        </p>
        {MODEL_PRESETS.map((p) => (
          <ModelOption
            key={p.id}
            selected={modelChoice === `preset:${p.id}`}
            label={p.label}
            hint={p.description}
            onClick={() => {
              onSelectModel(`preset:${p.id}`);
              onClose();
            }}
          />
        ))}
        <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          Models
        </p>
        {CHAT_MODELS.map((m) => (
          <ModelOption
            key={m.id}
            selected={modelChoice === m.id}
            label={m.label}
            onClick={() => {
              onSelectModel(m.id);
              onClose();
            }}
          />
        ))}

        <div className="my-1.5 border-t border-mist-100" />

        <p className="px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          Add
        </p>
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm text-ink hover:bg-mist-50"
          onClick={() => {
            onUploadFile();
            onClose();
          }}
        >
          <Paperclip className="h-4 w-4 text-ink-muted" />
          Upload file
        </button>
      </div>
    </div>
  );
}

function ModelOption({
  selected,
  label,
  hint,
  onClick,
}: {
  selected: boolean;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      className={cn(
        "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition-colors",
        selected ? "bg-accent-soft text-ink" : "text-ink hover:bg-mist-50"
      )}
      onClick={onClick}
    >
      <span className="flex h-4 w-4 items-center justify-center">
        {selected && <Check className="h-3.5 w-3.5 text-accent" />}
      </span>
      <span className="flex-1">
        {label}
        {hint && (
          <span className="ml-1.5 text-xs font-normal text-ink-faint">{hint}</span>
        )}
      </span>
    </button>
  );
}
