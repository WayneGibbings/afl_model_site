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
        <p className="mt-3 text-xs text-[var(--muted)]">
          Questions submitted here are visible to the site owner and may be reviewed to improve answer quality.
        </p>
        <ul className="mt-2 space-y-0.5 text-xs text-[var(--muted)]">
          <li>Questions may take up to a minute to return an answer.</li>
          <li>Refreshing the page clears the chat.</li>
          <li>Game data goes back to 2003.</li>
        </ul>
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

      <details className="card group overflow-hidden">
        <summary className="flex cursor-pointer items-center justify-between bg-[var(--surface-raised)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors list-none">
          Feature Glossary
          <svg
            className="h-4 w-4 transition-transform group-open:rotate-180"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>

        <div className="border-t border-[var(--border)] px-4 py-5 sm:px-6 text-sm text-[var(--muted)] space-y-6">
          <p>All features are computed from the home team&rsquo;s perspective (positive = home team advantage). EWMA features use a half-life of 5 games, computed strictly from games <strong>prior</strong> to the current match (no data leakage).</p>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--foreground)]">Elo Features</h3>
            <table className="data-table w-full text-xs">
              <thead><tr><th>Feature</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><code>elo_home</code></td><td>Home team&rsquo;s Elo rating before the match. Initialised at 1500; decays 55% toward the mean between seasons. K-factor 28 regular season, 36 finals.</td></tr>
                <tr><td><code>elo_away</code></td><td>Away team&rsquo;s Elo rating before the match. Same system as <code>elo_home</code>.</td></tr>
                <tr><td><code>elo_diff</code></td><td><code>elo_home − elo_away</code>. Zero means evenly matched; positive means the home team is rated higher.</td></tr>
                <tr><td><code>venue_hga</code></td><td>Home ground advantage at this venue in Elo points. Default 20 points when unknown.</td></tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--foreground)]">Form Features</h3>
            <p className="text-xs">Differentials (home − away) of EWMA signals with a 5-game half-life.</p>
            <table className="data-table w-full text-xs">
              <thead><tr><th>Feature</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><code>form_margin_last5</code></td><td>EWMA scoring margin differential. Positive means the home team has been winning by larger margins recently.</td></tr>
                <tr><td><code>form_win_pct_last5</code></td><td>EWMA win rate differential (1.0 = win, 0.5 = draw, 0.0 = loss). Positive means the home team has been winning more frequently.</td></tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--foreground)]">Game Style Features</h3>
            <p className="text-xs">Differentials (home − away) of EWMA game-style statistics.</p>
            <table className="data-table w-full text-xs">
              <thead><tr><th>Feature</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><code>rolling_pct_diff</code></td><td>EWMA kicking efficiency differential: <code>goals / (goals + behinds)</code>. Measures scoring accuracy.</td></tr>
                <tr><td><code>i50_diff</code></td><td>EWMA inside-50s differential. Measures how often teams are entering the forward 50.</td></tr>
                <tr><td><code>r50_efficiency</code></td><td>EWMA rebound-50 efficiency differential: <code>rebound_50s / inside_50s</code>. Measures defensive conversion of opposition forward entries.</td></tr>
                <tr><td><code>contested_possession_diff</code></td><td>EWMA contested possessions differential. Measures physical dominance at the contest.</td></tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--foreground)]">Contextual Features</h3>
            <table className="data-table w-full text-xs">
              <thead><tr><th>Feature</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><code>days_rest_diff</code></td><td><code>home_days_rest − away_days_rest</code>. Positive means the home team has had more recovery time. Default 7 days for first game of season.</td></tr>
                <tr><td><code>completed_rounds</code></td><td>Rounds the home team has completed before this match (<code>round_number − 1</code>). Season-progress proxy; early-season features are less reliable.</td></tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--foreground)]">Target Variable</h3>
            <table className="data-table w-full text-xs">
              <thead><tr><th>Column</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><code>home_margin</code></td><td><code>home_score − away_score</code>. What the model predicts; win probability is derived via a calibrated sigmoid.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </div>
  );
}
