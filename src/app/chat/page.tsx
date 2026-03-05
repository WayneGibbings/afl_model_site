"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessageBubble } from "@/components/chat/ChatMessageBubble";
import { SampleQuestions } from "@/components/chat/SampleQuestions";
import { sendAndPoll } from "@/lib/genie-client";
import type { ChatMessage, GenieStatus } from "@/lib/genie-types";

function createMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isCancelledError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return error.name === "AbortError" || message.includes("cancel");
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const canReset = useMemo(() => messages.length > 0 && !isProcessing, [isProcessing, messages.length]);

  const handleSubmit = useCallback(
    async (question: string) => {
      if (!question.trim() || isProcessing) {
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userMessage: ChatMessage = {
        id: createMessageId(),
        role: "user",
        text: question,
        status: "COMPLETED",
      };

      const assistantMessageId = createMessageId();
      const pendingAssistant: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        text: "",
        status: "IN_PROGRESS",
        rawStatus: "IN_PROGRESS",
        elapsedMs: 0,
      };

      setMessages((current) => [...current, userMessage, pendingAssistant]);
      setIsProcessing(true);

      try {
        const result = await sendAndPoll(question, {
          conversationId,
          signal: controller.signal,
          onStatusChange: (status: GenieStatus, elapsedMs: number, rawStatus: string | null) => {
            setMessages((current) =>
              current.map((message) => {
                if (message.id !== assistantMessageId) {
                  return message;
                }
                return {
                  ...message,
                  status,
                  rawStatus,
                  elapsedMs,
                };
              }),
            );
          },
        });

        setConversationId(result.conversationId);

        setMessages((current) =>
          current.map((message) => {
            if (message.id !== assistantMessageId) {
              return message;
            }

            return {
              ...message,
              status: "COMPLETED",
              rawStatus: result.rawStatus,
              text: result.assistantText || "Query complete.",
              query: result.query,
              queryResult: result.queryResult,
              error: null,
            };
          }),
        );
      } catch (error) {
        const cancelled = isCancelledError(error);
        const status: GenieStatus = cancelled ? "CANCELLED" : "FAILED";
        const message = error instanceof Error ? error.message : "Genie request failed.";

        setMessages((current) =>
          current.map((item) => {
            if (item.id !== assistantMessageId) {
              return item;
            }
            return {
              ...item,
              status,
              rawStatus: status,
              text: cancelled ? "" : item.text,
              error: message,
            };
          }),
        );
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setIsProcessing(false);
      }
    },
    [conversationId, isProcessing],
  );

  function handleReset() {
    abortRef.current?.abort();
    abortRef.current = null;
    setConversationId(null);
    setIsProcessing(false);
    setMessages([]);
  }

  return (
    <div className="space-y-6">
      <header className="page-header">
        <h1 className="page-title">Ask</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Ask natural language questions about tips, confidence, ladders, and model performance.
        </p>
      </header>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Genie Chat</p>
          <button
            type="button"
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition hover:border-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleReset}
            disabled={!canReset}
          >
            New Chat
          </button>
        </div>

        <div className="max-h-[65vh] min-h-[24rem] space-y-3 overflow-y-auto px-3 py-4 sm:px-5">
          {messages.length === 0 ? <SampleQuestions disabled={isProcessing} onSelect={(question) => void handleSubmit(question)} /> : null}

          {messages.map((message) => (
            <ChatMessageBubble key={message.id} message={message} />
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-[var(--border)] bg-[var(--surface-raised)] px-3 py-3 sm:px-5">
          <ChatInput disabled={isProcessing} onSubmit={handleSubmit} />
        </div>
      </section>
    </div>
  );
}
