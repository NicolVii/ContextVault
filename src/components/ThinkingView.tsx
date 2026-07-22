"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mic, MicOff, Plus, Send, Paperclip, X } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { AUTO_MODEL_ID, modelLabel } from "@/lib/ai/models";
import { cn } from "@/lib/utils";
import { ComposerPlusMenu, type ComposerPlanHints } from "@/components/ComposerPlusMenu";
import { FoundingOfferBanner } from "@/components/FoundingOfferBanner";
import {
  ResponseInfoButton,
  type ResponseInfoMeta,
} from "@/components/ResponseInfoButton";

const MODEL_STORAGE_KEY = "think-model-choice";

type UsageHints = ComposerPlanHints & {
  autoRemaining: number | null;
  frontierHeavy: boolean;
  inferenceRestricted: boolean;
  unlimitedAuto: boolean;
  showFoundingOffer: boolean;
  checkoutEnabled: boolean;
};

type ThreadItem =
  | {
      id: string;
      kind: "user";
      content: string;
    }
  | {
      id: string;
      kind: "reply";
      content: string;
      meta: ResponseInfoMeta;
    };

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    SpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0?: { transcript?: string } }> }) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

function greetingFor(name?: string | null) {
  const hour = new Date().getHours();
  const hello =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return name ? `${hello}, ${name}` : hello;
}

function readStoredModel(): string {
  if (typeof window === "undefined") return AUTO_MODEL_ID;
  try {
    const v = sessionStorage.getItem(MODEL_STORAGE_KEY);
    return v || AUTO_MODEL_ID;
  } catch {
    return AUTO_MODEL_ID;
  }
}

export function ThinkingView({
  displayName,
  reviewCount = 0,
  initialSessionId = null,
}: {
  displayName?: string | null;
  reviewCount?: number;
  initialSessionId?: string | null;
}) {
  const [input, setInput] = useState("");
  const [thread, setThread] = useState<ThreadItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ephemeral, setEphemeral] = useState<string | null>(null);
  const [modelChoice, setModelChoice] = useState<string>(AUTO_MODEL_ID);
  const [usage, setUsage] = useState<UsageHints | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const hasContent = input.trim().length > 0 || Boolean(pendingFile);

  useEffect(() => {
    setModelChoice(readStoredModel());
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadUsage() {
      try {
        const res = await fetch("/api/billing/usage");
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setUsage({
          attachments: Boolean(json.entitlements?.attachments),
          frontierAllowed: (json.entitlements?.frontierMonthlyTurns ?? 0) !== 0,
          frontierRemaining: json.frontierRemaining ?? null,
          byok: Boolean(json.entitlements?.byok),
          voice: Boolean(json.entitlements?.voice),
          autoRemaining: json.autoRemaining ?? null,
          frontierHeavy: Boolean(json.frontierHeavy),
          inferenceRestricted: Boolean(json.inferenceRestricted),
          unlimitedAuto: Boolean(json.entitlements?.unlimitedAuto),
          showFoundingOffer: Boolean(json.showFoundingOffer),
          checkoutEnabled: Boolean(json.checkoutEnabled),
        });
      } catch {
        /* ignore */
      }
    }
    void loadUsage();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!initialSessionId) return;
    let cancelled = false;
    async function restore() {
      const res = await fetch(`/api/sessions/${initialSessionId}`);
      const json = await res.json();
      if (!res.ok || cancelled) return;
      setSessionId(json.session?.id ?? initialSessionId);
      const items: ThreadItem[] = (json.messages ?? []).map(
        (m: { id: string; role: string; content: string; model?: string; created_at?: string }) => {
          if (m.role === "user") {
            return { id: m.id, kind: "user" as const, content: m.content };
          }
          return {
            id: m.id,
            kind: "reply" as const,
            content: m.content,
            meta: {
              createdAt: m.created_at ?? new Date().toISOString(),
              modelLabel: m.model ? modelLabel(m.model) : "Auto",
              memoryRegistered: false,
            },
          };
        }
      );
      setThread(items);
    }
    void restore();
    return () => {
      cancelled = true;
    };
  }, [initialSessionId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread, busy, ephemeral]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!ephemeral) return;
    const t = setTimeout(() => setEphemeral(null), 2200);
    return () => clearTimeout(t);
  }, [ephemeral]);

  function selectModel(id: string) {
    setModelChoice(id);
    try {
      sessionStorage.setItem(MODEL_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }

  function toggleVoice() {
    if (usage && !usage.voice) {
      setError("Voice is included with Pro.");
      return;
    }
    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : undefined;
    if (!SpeechRecognitionCtor) {
      setError("Voice input isn’t supported in this browser.");
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const transcript = result?.[0]?.transcript ?? "";
      if (transcript) setInput((prev) => (prev ? `${prev.trim()} ${transcript}` : transcript));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  async function uploadPendingFile(): Promise<string | null> {
    if (!pendingFile) return null;
    const body = new FormData();
    body.append("file", pendingFile);
    const res = await fetch("/api/documents", { method: "POST", body });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "Could not attach file");
    setPendingFile(null);
    return json.document?.filename ?? pendingFile.name;
  }

  function metaFromJson(json: Record<string, unknown>): ResponseInfoMeta {
    return {
      createdAt: (json.createdAt as string) ?? new Date().toISOString(),
      modelLabel: (json.modelLabel as string) ?? "Auto",
      memoryRegistered: Boolean(json.memoryRegistered),
    };
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const message = input.trim();
    if ((!message && !pendingFile) || busy) return;

    setError(null);
    setNotice(null);
    setBusy(true);

    const userText = message || (pendingFile ? `Attached ${pendingFile.name}` : "");
    const userId = crypto.randomUUID();
    setThread((t) => [...t, { id: userId, kind: "user", content: userText }]);
    setInput("");

    try {
      if (pendingFile) {
        const filename = await uploadPendingFile();
        if (!message && filename) {
          setThread((t) => [
            ...t,
            {
              id: crypto.randomUUID(),
              kind: "reply",
              content: `Saved ${filename} to Files.`,
              meta: {
                createdAt: new Date().toISOString(),
                modelLabel: "Auto",
                memoryRegistered: false,
              },
            },
          ]);
          setBusy(false);
          return;
        }
      }

      const res = await fetch("/api/think", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId, model: modelChoice }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed");

      if (json.sessionId) setSessionId(json.sessionId);

      if (json.intent === "statement") {
        // Quiet capture — no large Remembered / Undo in the thread.
        setEphemeral("Saved");
      } else if (json.intent === "instruction") {
        setThread((t) => [
          ...t,
          {
            id: crypto.randomUUID(),
            kind: "reply",
            content: json.confirmation ?? "Done.",
            meta: metaFromJson(json),
          },
        ]);
      } else {
        setThread((t) => [
          ...t,
          {
            id: crypto.randomUUID(),
            kind: "reply",
            content: json.message?.content ?? "",
            meta: metaFromJson(json),
          },
        ]);
      }

      if (json.proposedCount > 0) {
        setNotice(
          json.proposedCount === 1
            ? "Something new is ready to review."
            : `${json.proposedCount} items are ready to review.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto pb-4 pt-6 sm:pt-16">
        {thread.length === 0 && !ephemeral && (
          <div className="animate-fade-in flex flex-col items-center justify-center px-4 pt-10 text-center sm:pt-20">
            <p className="font-display text-3xl font-medium tracking-tight text-ink sm:text-4xl">
              {greetingFor(displayName)}
            </p>
            <p className="mt-3 max-w-sm text-sm text-ink-muted">
              Capture a thought, ask a question, or speak freely.
            </p>
          </div>
        )}

        {thread.map((item) => (
          <div key={item.id} className="animate-fade-in">
            {item.kind === "user" && (
              <p className="text-right text-[15px] font-medium leading-relaxed text-ink">
                {item.content}
              </p>
            )}
            {item.kind === "reply" && (
              <div>
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
                  {item.content}
                </p>
                <ResponseInfoButton meta={item.meta} />
              </div>
            )}
          </div>
        ))}

        {ephemeral && (
          <p className="animate-fade-in text-xs text-ink-faint">{ephemeral}</p>
        )}

        {busy && <p className="text-sm text-ink-faint">Thinking…</p>}
        <div ref={scrollRef} />
      </div>

      <FoundingOfferBanner
        visible={Boolean(usage?.showFoundingOffer)}
        checkoutEnabled={Boolean(usage?.checkoutEnabled)}
        onDismissed={() =>
          setUsage((u) => (u ? { ...u, showFoundingOffer: false } : u))
        }
      />
      {notice && (
        <div className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {notice}{" "}
          <Link href="/vault/review" className="font-medium underline">
            Review
          </Link>
        </div>
      )}
      {usage?.inferenceRestricted && (
        <div className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-950">
          AI usage is paused due to a billing problem.{" "}
          <Link href="/vault/plan" className="font-medium underline">
            Plan &amp; Usage
          </Link>
        </div>
      )}
      {usage &&
        !usage.inferenceRestricted &&
        usage.autoRemaining != null &&
        usage.autoRemaining <= 3 &&
        usage.autoRemaining > 0 && (
          <div className="mb-3 text-center text-xs text-ink-muted">
            About {usage.autoRemaining} Auto conversations left this month.{" "}
            <Link href="/vault/plan" className="underline">
              View plan
            </Link>
          </div>
        )}
      {usage &&
        !usage.inferenceRestricted &&
        usage.frontierRemaining != null &&
        usage.frontierRemaining <= 2 &&
        usage.frontierAllowed && (
          <div className="mb-3 text-center text-xs text-ink-muted">
            Frontier · {usage.frontierRemaining} left this month.{" "}
            <Link href="/vault/plan" className="underline">
              Upgrade
            </Link>
          </div>
        )}
      {usage?.frontierHeavy && (
        <div className="mb-3 text-center text-xs text-ink-muted">
          You’re using Frontier heavily this period.
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
      )}
      {reviewCount > 0 && thread.length === 0 && (
        <div className="mb-3 text-center text-xs text-ink-faint">
          <Link href="/vault/review" className="hover:text-accent">
            {reviewCount} awaiting review
          </Link>
        </div>
      )}

      <form
        onSubmit={submit}
        className="sticky bottom-0 rounded-3xl border border-mist-200 bg-white/90 p-3 shadow-soft backdrop-blur-md"
      >
        {pendingFile && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-mist-50 px-2 py-1.5 text-xs text-ink-muted">
            <Paperclip className="h-3.5 w-3.5" />
            <span className="flex-1 truncate">{pendingFile.name}</span>
            <button type="button" aria-label="Remove attachment" onClick={() => setPendingFile(null)}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <textarea
          className="max-h-40 min-h-[52px] w-full resize-none border-0 bg-transparent px-2 py-2 text-[15px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-0"
          placeholder={BRAND.composerPlaceholder}
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          disabled={busy}
        />
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              type="button"
              aria-label="More options"
              aria-expanded={plusOpen}
              className={cn(
                "rounded-xl p-2 text-ink-muted hover:bg-mist-50 hover:text-ink",
                plusOpen && "bg-mist-50 text-ink"
              )}
              onClick={() => setPlusOpen((o) => !o)}
            >
              <Plus className="h-5 w-5" />
            </button>
            <ComposerPlusMenu
              open={plusOpen}
              onClose={() => setPlusOpen(false)}
              modelChoice={modelChoice}
              onSelectModel={selectModel}
              onUploadFile={() => fileRef.current?.click()}
              plan={usage}
            />
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setPendingFile(file);
                e.target.value = "";
              }}
            />
          </div>

          <button
            type="button"
            aria-label={listening ? "Stop listening" : "Voice input"}
            className={cn(
              "rounded-xl p-2 hover:bg-mist-50",
              listening ? "text-red-600" : "text-ink-muted hover:text-ink"
            )}
            onClick={toggleVoice}
          >
            {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>

          <div className="flex-1" />

          {hasContent && (
            <button
              type="submit"
              disabled={busy}
              aria-label="Send"
              className="rounded-xl bg-accent p-2 text-white hover:bg-accent-strong disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
