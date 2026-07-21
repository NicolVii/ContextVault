"use client";

import { useEffect, useRef } from "react";
import { Check, Paperclip } from "lucide-react";
import { AUTO_MODEL_ID, CHAT_MODELS, MODEL_PRESETS } from "@/lib/ai/models";
import { isFrontierModelId } from "@/lib/billing/usage-intensity";
import { cn } from "@/lib/utils";

export type ComposerPlanHints = {
  attachments: boolean;
  frontierAllowed: boolean;
  frontierRemaining: number | null;
  byok: boolean;
  voice: boolean;
};

export function ComposerPlusMenu({
  open,
  onClose,
  modelChoice,
  onSelectModel,
  onUploadFile,
  plan,
}: {
  open: boolean;
  onClose: () => void;
  modelChoice: string;
  onSelectModel: (id: string) => void;
  onUploadFile: () => void;
  plan?: ComposerPlanHints | null;
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

  const frontierAllowed = plan?.frontierAllowed ?? true;
  const attachments = plan?.attachments ?? true;

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
        {MODEL_PRESETS.map((p) => {
          const frontierPreset = !["cheap", "fast"].includes(p.id);
          const locked = frontierPreset && !frontierAllowed;
          return (
            <ModelOption
              key={p.id}
              selected={modelChoice === `preset:${p.id}`}
              label={p.label}
              hint={locked ? "Lite or Pro" : p.description}
              disabled={locked}
              onClick={() => {
                if (locked) return;
                onSelectModel(`preset:${p.id}`);
                onClose();
              }}
            />
          );
        })}
        <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          Models
        </p>
        {CHAT_MODELS.map((m) => {
          const frontier = isFrontierModelId(m.id);
          const locked = frontier && !frontierAllowed;
          return (
            <ModelOption
              key={m.id}
              selected={modelChoice === m.id}
              label={m.label}
              hint={
                locked
                  ? "Lite or Pro"
                  : frontier && plan?.frontierRemaining != null
                    ? `${plan.frontierRemaining} Frontier left`
                    : undefined
              }
              disabled={locked}
              onClick={() => {
                if (locked) return;
                onSelectModel(m.id);
                onClose();
              }}
            />
          );
        })}

        <div className="my-1.5 border-t border-mist-100" />

        <p className="px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          Add
        </p>
        <button
          type="button"
          role="menuitem"
          disabled={!attachments}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm",
            attachments ? "text-ink hover:bg-mist-50" : "cursor-not-allowed text-ink-faint"
          )}
          onClick={() => {
            if (!attachments) return;
            onUploadFile();
            onClose();
          }}
        >
          <Paperclip className="h-4 w-4 text-ink-muted" />
          {attachments ? "Upload file" : "Upload file · Lite or Pro"}
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
  disabled,
}: {
  selected: boolean;
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm",
        disabled
          ? "cursor-not-allowed text-ink-faint"
          : selected
            ? "bg-mist-50 text-ink"
            : "text-ink hover:bg-mist-50"
      )}
      onClick={onClick}
    >
      <span className="flex-1">
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-[11px] text-ink-faint">{hint}</span>}
      </span>
      {selected && !disabled && <Check className="h-4 w-4 text-accent" />}
    </button>
  );
}
