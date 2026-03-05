import type {
  GenieErrorPayload,
  GenieMessageResponse,
  GeniePollResponse,
  GenieProxyRequest,
  GenieResultResponse,
  GenieStartResponse,
  GenieStatus,
} from "@/lib/genie-types";

const GENIE_API_PATH = "/api/genie";
const DEFAULT_POLL_INITIAL_MS = 2_000;
const DEFAULT_POLL_MAX_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 120_000;
const TERMINAL_STATUSES = new Set<GenieStatus>(["COMPLETED", "FAILED", "CANCELLED"]);

export class GenieClientError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message);
    this.name = "GenieClientError";
    this.code = options?.code;
    this.status = options?.status;
  }
}

export interface SendAndPollOptions {
  conversationId?: string | null;
  onStatusChange?: (status: GenieStatus, elapsedMs: number, rawStatus: string | null) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
  pollInitialMs?: number;
  pollMaxMs?: number;
}

export interface SendAndPollResult {
  conversationId: string;
  messageId: string;
  status: GenieStatus;
  rawStatus: string | null;
  assistantText: string;
  query: string | null;
  queryResult: GenieResultResponse["queryResult"] | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isErrorPayload(value: unknown): value is GenieErrorPayload {
  return isObject(value) && isObject(value.error) && typeof value.error.message === "string";
}

function abortError(): Error {
  const error = new Error("Request was cancelled.");
  error.name = "AbortError";
  return error;
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw abortError();
  }
}

async function waitFor(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timeout);
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
      reject(abortError());
    };

    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

async function postGenie<T>(payload: GenieProxyRequest, signal?: AbortSignal): Promise<T> {
  assertNotAborted(signal);

  const response = await fetch(GENIE_API_PATH, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });

  let responseBody: unknown = null;
  try {
    responseBody = await response.json();
  } catch {
    responseBody = null;
  }

  if (!response.ok) {
    if (isErrorPayload(responseBody)) {
      throw new GenieClientError(responseBody.error.message, {
        code: responseBody.error.code,
        status: response.status,
      });
    }
    throw new GenieClientError("The Genie request failed.", { status: response.status });
  }

  if (isErrorPayload(responseBody)) {
    throw new GenieClientError(responseBody.error.message, { code: responseBody.error.code });
  }

  return responseBody as T;
}

export function genieStart(content: string, signal?: AbortSignal): Promise<GenieStartResponse> {
  return postGenie<GenieStartResponse>({ action: "start", content }, signal);
}

export function genieMessage(
  conversationId: string,
  content: string,
  signal?: AbortSignal,
): Promise<GenieMessageResponse> {
  return postGenie<GenieMessageResponse>({ action: "message", conversationId, content }, signal);
}

export function geniePoll(
  conversationId: string,
  messageId: string,
  signal?: AbortSignal,
): Promise<GeniePollResponse> {
  return postGenie<GeniePollResponse>({ action: "poll", conversationId, messageId }, signal);
}

export function genieResult(
  conversationId: string,
  messageId: string,
  attachmentId: string,
  signal?: AbortSignal,
): Promise<GenieResultResponse> {
  return postGenie<GenieResultResponse>({
    action: "result",
    conversationId,
    messageId,
    attachmentId,
  }, signal);
}

export async function sendAndPoll(content: string, options: SendAndPollOptions = {}): Promise<SendAndPollResult> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new GenieClientError("Question cannot be empty.", { code: "EMPTY_CONTENT" });
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let backoffMs = options.pollInitialMs ?? DEFAULT_POLL_INITIAL_MS;
  const pollMaxMs = options.pollMaxMs ?? DEFAULT_POLL_MAX_MS;

  const openResponse = options.conversationId
    ? await genieMessage(options.conversationId, trimmed, options.signal)
    : await genieStart(trimmed, options.signal);

  const conversationId = openResponse.conversationId;
  const messageId = openResponse.messageId;

  let assistantText = "";
  let query: string | null = null;
  let rawStatus: string | null = openResponse.status;
  let status: GenieStatus = openResponse.status;

  const startedAt = Date.now();

  while (true) {
    assertNotAborted(options.signal);

    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs > timeoutMs) {
      throw new GenieClientError("Genie timed out before returning a result.", { code: "TIMEOUT" });
    }

    const poll = await geniePoll(conversationId, messageId, options.signal);
    status = poll.status;
    rawStatus = poll.rawStatus;
    assistantText = poll.assistantText ?? assistantText;
    query = poll.query ?? query;

    options.onStatusChange?.(status, elapsedMs, rawStatus);

    if (status === "FAILED" || status === "CANCELLED") {
      throw new GenieClientError(poll.error ?? "Genie could not complete the request.", {
        code: status,
      });
    }

    if (status === "COMPLETED") {
      let queryResult: GenieResultResponse["queryResult"] | null = null;
      if (poll.hasQueryResult) {
        if (!poll.attachmentId) {
          throw new GenieClientError("Genie returned a query result without an attachment id.", {
            code: "MISSING_ATTACHMENT_ID",
          });
        }
        const result = await genieResult(conversationId, messageId, poll.attachmentId, options.signal);
        queryResult = result.queryResult;
      }

      return {
        conversationId,
        messageId,
        status,
        rawStatus,
        assistantText,
        query,
        queryResult,
      };
    }

    if (!TERMINAL_STATUSES.has(status)) {
      await waitFor(backoffMs, options.signal);
      backoffMs = Math.min(pollMaxMs, Math.ceil(backoffMs * 1.5));
      continue;
    }
  }
}
