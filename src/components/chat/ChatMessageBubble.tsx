import type { ChatMessage } from "@/lib/genie-types";
import { ResultTable } from "@/components/chat/ResultTable";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";

interface ChatMessageBubbleProps {
  message: ChatMessage;
}

function statusLabel(message: ChatMessage): string {
  const status = (message.rawStatus ?? message.status).toUpperCase();

  if (status === "FETCHING_METADATA") {
    return "Understanding your question...";
  }
  if (status === "ASKING_AI") {
    return "Generating query...";
  }
  if (status === "EXECUTING_QUERY") {
    return "Running query against the data...";
  }
  if (status === "IN_PROGRESS") {
    return "Working on your question...";
  }
  if (status === "FAILED") {
    return "Genie failed to complete this request.";
  }
  if (status === "CANCELLED") {
    return "Request cancelled.";
  }

  return "Working on your question...";
}

function formatElapsed(elapsedMs?: number): string {
  const totalSeconds = Math.max(0, Math.floor((elapsedMs ?? 0) / 1000));
  return `${totalSeconds}s`;
}

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isUser = message.role === "user";
  const isLoading =
    message.role === "assistant" && message.status !== "COMPLETED" && message.status !== "FAILED" && message.status !== "CANCELLED";

  return (
    <div className={`chat-message flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isUser
            ? "max-w-[90%] rounded-2xl rounded-br-md bg-[var(--brand)] px-4 py-3 text-sm text-white shadow-sm sm:max-w-[75%]"
            : `card max-w-[95%] rounded-2xl rounded-bl-md px-4 py-3 text-sm text-[var(--foreground)] sm:max-w-[82%] ${isLoading ? "chat-shimmer" : ""}`
        }
      >
        {message.text ? (
          isUser ? (
            <p className="m-0 whitespace-pre-wrap leading-6">{message.text}</p>
          ) : (
            <div className="space-y-3 leading-6">
              <ReactMarkdown
                remarkPlugins={[remarkBreaks]}
                components={{
                  p: ({ children }) => <p className="m-0">{children}</p>,
                  ul: ({ children }) => <ul className="m-0 list-disc space-y-1 pl-5">{children}</ul>,
                  ol: ({ children }) => <ol className="m-0 list-decimal space-y-1 pl-5">{children}</ol>,
                  li: ({ children }) => <li>{children}</li>,
                  a: ({ children, href }) => (
                    <a
                      className="text-[var(--brand)] underline underline-offset-2"
                      href={href}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {children}
                    </a>
                  ),
                  code: ({ children }) => (
                    <code className="rounded bg-[var(--surface-raised)] px-1 py-0.5 text-[0.95em]">{children}</code>
                  ),
                }}
              >
                {message.text}
              </ReactMarkdown>
            </div>
          )
        ) : null}

        {isLoading ? (
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-1" aria-live="polite" aria-label="Assistant is generating a response">
              <span className="chat-loading-dot" />
              <span className="chat-loading-dot" />
              <span className="chat-loading-dot" />
            </div>
            <p className="m-0 text-xs text-[var(--muted)]">{statusLabel(message)}</p>
            <p className="chat-timer m-0">{formatElapsed(message.elapsedMs)}</p>
          </div>
        ) : null}

        {message.queryResult ? <ResultTable queryResult={message.queryResult} /> : null}

        {message.error ? <p className="mt-2 mb-0 text-xs text-[var(--danger)]">{message.error}</p> : null}
      </div>
    </div>
  );
}
