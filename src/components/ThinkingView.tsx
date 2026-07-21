"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mic, MicOff, Plus, Send, Paperclip, X } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import type { RetrievedChunk, RetrievedMemory } from "@/lib/types";

type ThreadItem =
  | {
      id: string;
      kind: "user";
      content: string;
    }
  | {
      id: string;
      kind: "remembered";
      content: string;
      memoryId: string;
      undone?: boolean;
    }
  | {
      id: string;
      kind: "confirmation";
      content: string;
    }
  | {
      id: string;
      kind: "answer";
      content: string;
      usedMemories?: RetrievedMemory[];
      usedChunks?: RetrievedChunk[];
    };

declare global {
  interface Window {
    // Web Speech API — not in all TS DOM libs consistently.
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
  const [attachOpen, setAttachOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [basedOnId, setBasedOnId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const hasContent = input.trim().length > 0 || Boolean(pendingFile);

  useEffect(() => {
    if (!initialSessionId) return;
    let cancelled = false;
    async function restore() {
      const res = await fetch(`/api/sessions/${initialSessionId}`);
      const json = await res.json();
      if (!res.ok || cancelled) return;
      setSessionId(json.session?.id ?? initialSessionId);
      const items: ThreadItem[] = (json.messages ?? []).map(
        (m: { id: string; role: string; content: string }) => {
          if (m.role === "user") {
            return { id: m.id, kind: "user" as const, content: m.content };
          }
          return { id: m.id, kind: "answer" as const, content: m.content };
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
  }, [thread, busy]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  function toggleVoice() {
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
    setAttachOpen(false);
    return json.document?.filename ?? pendingFile.name;
  }

  async function undoMemory(itemId: string, memoryId: string) {
    const res = await fetch(`/api/memories/${memoryId}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Could not undo");
      return;
    }
    setThread((items) =>
      items.map((item) =>
        item.id === itemId && item.kind === "remembered"
          ? { ...item, undone: true }
          : item
      )
    );
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
              kind: "confirmation",
              content: `Saved ${filename} to Files.`,
            },
          ]);
          setBusy(false);
          return;
        }
      }

      const res = await fetch("/api/think", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed");

      if (json.sessionId) setSessionId(json.sessionId);

      if (json.intent === "statement" || (json.intent === "instruction" && json.undoMemoryId)) {
        setThread((t) => [
          ...t,
          {
            id: crypto.randomUUID(),
            kind: "remembered",
            content: json.confirmation ?? "Remembered",
            memoryId: json.undoMemoryId ?? json.memory?.id,
          },
        ]);
      } else if (json.intent === "instruction") {
        setThread((t) => [
          ...t,
          {
            id: crypto.randomUUID(),
            kind: "confirmation",
            content: json.confirmation ?? "Done.",
          },
        ]);
      } else {
        setThread((t) => [
          ...t,
          {
            id: crypto.randomUUID(),
            kind: "answer",
            content: json.message?.content ?? "",
            usedMemories: json.usedMemories,
            usedChunks: json.usedChunks,
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
        {thread.length === 0 && (
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
            {item.kind === "remembered" && (
              <div className="flex items-center gap-3 text-sm text-ink-muted">
                <span className={cn(item.undone && "line-through opacity-50")}>
                  {item.undone ? "Removed" : item.content}
                </span>
                {!item.undone && (
                  <button
                    type="button"
                    className="text-accent hover:underline"
                    onClick={() => undoMemory(item.id, item.memoryId)}
                  >
                    Undo
                  </button>
                )}
              </div>
            )}
            {item.kind === "confirmation" && (
              <p className="text-sm leading-relaxed text-ink-muted">{item.content}</p>
            )}
            {item.kind === "answer" && (
              <div>
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
                  {item.content}
                </p>
                {((item.usedMemories?.length ?? 0) > 0 ||
                  (item.usedChunks?.length ?? 0) > 0) && (
                  <div className="mt-2">
                    <button
                      type="button"
                      className="text-xs font-medium text-ink-faint hover:text-accent"
                      onClick={() =>
                        setBasedOnId(basedOnId === item.id ? null : item.id)
                      }
                    >
                      Based on…
                    </button>
                    {basedOnId === item.id && (
                      <ul className="mt-2 space-y-1.5 rounded-xl bg-white/70 p-3 text-xs text-ink-muted">
                        {item.usedMemories?.map((m) => (
                          <li key={m.id} className="leading-snug">
                            {m.content}
                          </li>
                        ))}
                        {item.usedChunks?.map((c) => (
                          <li key={c.id} className="leading-snug">
                            {c.filename}
                            {c.page_number ? ` · p.${c.page_number}` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {busy && <p className="text-sm text-ink-faint">Thinking…</p>}
        <div ref={scrollRef} />
      </div>

      {notice && (
        <div className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {notice}{" "}
          <Link href="/vault/review" className="font-medium underline">
            Review
          </Link>
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
              aria-label="Add attachment"
              className="rounded-xl p-2 text-ink-muted hover:bg-mist-50 hover:text-ink"
              onClick={() => setAttachOpen((o) => !o)}
            >
              <Plus className="h-5 w-5" />
            </button>
            {attachOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-44 rounded-xl border border-mist-200 bg-white p-1 shadow-soft">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-mist-50"
                  onClick={() => {
                    fileRef.current?.click();
                    setAttachOpen(false);
                  }}
                >
                  <Paperclip className="h-4 w-4 text-ink-muted" />
                  Attach file
                </button>
              </div>
            )}
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
