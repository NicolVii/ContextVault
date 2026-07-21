"use client";

import { useRef, useState } from "react";
import { Send, Info, Sparkles, BookOpen } from "lucide-react";
import { CHAT_MODELS } from "@/lib/ai/models";
import type { RetrievedChunk, RetrievedMemory, UserIdentity } from "@/lib/types";

interface UIMessage {
  role: "user" | "assistant";
  content: string;
  model?: string;
  usedMemories?: RetrievedMemory[];
  usedChunks?: RetrievedChunk[];
  usedIdentity?: UserIdentity;
}

function hasIdentity(identity?: UserIdentity): boolean {
  return Boolean(identity?.displayName || identity?.persona);
}

export function ChatView({ initialModel }: { initialModel: string }) {
  const [model, setModel] = useState(initialModel);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openContext, setOpenContext] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || busy) return;
    setError(null);
    setNotice(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: message }]);
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, model, sessionId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed");

      setSessionId(json.sessionId);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: json.message.content,
          model: json.message.model,
          usedMemories: json.usedMemories,
          usedChunks: json.usedChunks,
          usedIdentity: json.usedIdentity,
        },
      ]);
      if (json.proposedCount > 0) {
        setNotice(
          `${json.proposedCount} new ${json.proposedCount === 1 ? "memory" : "memories"} added to your review queue.`
        );
      }
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Chat</h1>
          <p className="text-sm text-brand-600">
            Your saved context is retrieved and injected before every reply.
          </p>
        </div>
        <select className="input sm:w-64" value={model} onChange={(e) => setModel(e.target.value)}>
          {CHAT_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} · {m.vendor}
            </option>
          ))}
        </select>
      </div>

      <div className="card mt-4 flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center text-brand-500">
              <Sparkles className="mb-2 h-8 w-8 text-brand-300" />
              <p className="font-medium text-brand-700">Start a conversation</p>
              <p className="max-w-sm text-sm">
                Try “What do you know about me?” to see your memories in action.
              </p>
            </div>
          )}

          {messages.map((m, i) => {
            const contextCount =
              (m.usedMemories?.length ?? 0) +
              (m.usedChunks?.length ?? 0) +
              (hasIdentity(m.usedIdentity) ? 1 : 0);
            return (
              <div
                key={i}
                className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div className={m.role === "user" ? "max-w-[80%]" : "max-w-[85%]"}>
                  <div
                    className={
                      m.role === "user"
                        ? "rounded-2xl rounded-br-sm bg-brand-600 px-4 py-2.5 text-sm text-white"
                        : "rounded-2xl rounded-bl-sm bg-sand-100 px-4 py-2.5 text-sm text-brand-900"
                    }
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>

                  {m.role === "assistant" && (
                    <div className="mt-1.5 pl-1">
                      <span className="text-xs text-brand-400">{m.model}</span>
                      {contextCount > 0 ? (
                        <button
                          className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                          onClick={() => setOpenContext(openContext === i ? null : i)}
                        >
                          <Info className="h-3.5 w-3.5" />
                          Why does the AI know this? ({contextCount})
                        </button>
                      ) : (
                        <span className="ml-2 text-xs text-brand-400">No saved context used</span>
                      )}

                      {openContext === i && (
                        <div className="mt-2 space-y-2 rounded-xl border border-brand-100 bg-white p-3">
                          {hasIdentity(m.usedIdentity) && (
                            <div className="text-xs">
                              <span className="badge bg-brand-50 text-brand-700">identity</span>{" "}
                              <span className="text-brand-800">
                                {[
                                  m.usedIdentity?.displayName
                                    ? `Name: ${m.usedIdentity.displayName}`
                                    : null,
                                  m.usedIdentity?.persona
                                    ? `Persona: ${m.usedIdentity.persona}`
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                              <span className="text-brand-400"> · from profile</span>
                            </div>
                          )}
                          {m.usedMemories?.map((mem) => (
                            <div key={mem.id} className="text-xs">
                              <span className="badge bg-brand-50 text-brand-700">{mem.type}</span>{" "}
                              <span className="text-brand-800">{mem.content}</span>
                              <span className="text-brand-400">
                                {" "}
                                · {(mem.similarity * 100).toFixed(0)}% match · from{" "}
                                {mem.source.replace("_", " ")}
                              </span>
                            </div>
                          ))}
                          {m.usedChunks?.map((c) => (
                            <div key={c.id} className="flex items-start gap-1 text-xs">
                              <BookOpen className="mt-0.5 h-3.5 w-3.5 text-brand-500" />
                              <span className="text-brand-800">
                                {c.filename}
                                {c.page_number ? ` p.${c.page_number}` : ""}:{" "}
                                {c.content.slice(0, 120)}…
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>

        {notice && (
          <div className="border-t border-brand-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            {notice}
          </div>
        )}
        {error && (
          <div className="border-t border-brand-100 bg-red-50 px-4 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={send} className="flex gap-2 border-t border-brand-100 p-3">
          <input
            className="input"
            placeholder="Ask anything…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
          />
          <button type="submit" className="btn-primary" disabled={busy || !input.trim()}>
            <Send className="h-4 w-4" />
            {busy ? "…" : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
