import { onRequest, type Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import { defineSecret } from "firebase-functions/params";
import {
  extractAttachmentSummary,
  normaliseQueryResult,
  type ProxyAction,
  readDatabricksId,
  RequestValidationError,
  validateProxyRequestBody,
} from "./genie-proxy-utils";

const DATABRICKS_HOST = defineSecret("DATABRICKS_HOST");
const DATABRICKS_TOKEN = defineSecret("DATABRICKS_TOKEN");
const GENIE_SPACE_ID = defineSecret("GENIE_SPACE_ID");

const RATE_LIMIT_RULES: Record<ProxyAction, { maxRequests: number; windowMs: number }> = {
  start: { maxRequests: 10, windowMs: 60_000 },
  message: { maxRequests: 20, windowMs: 60_000 },
  poll: { maxRequests: 180, windowMs: 60_000 },
  result: { maxRequests: 60, windowMs: 60_000 },
};

type JsonResponse = Record<string, unknown>;

const ipBuckets = new Map<string, { count: number; windowStartMs: number; action: ProxyAction }>();

class UpstreamError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(`Upstream request failed with status ${status}`);
    this.name = "UpstreamError";
    this.status = status;
    this.body = body;
  }
}

function normalizeHost(rawHost: string): string {
  if (rawHost.startsWith("http://") || rawHost.startsWith("https://")) {
    return rawHost;
  }
  return `https://${rawHost}`;
}

function json(res: Response, status: number, body: JsonResponse): void {
  res.set("Cache-Control", "no-store");
  res.status(status).json(body);
}

function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return req.ip || "unknown";
}

function cleanupRateLimitBuckets(now: number): void {
  for (const [bucketKey, bucket] of ipBuckets) {
    const windowMs = RATE_LIMIT_RULES[bucket.action].windowMs;
    if (now - bucket.windowStartMs > windowMs) {
      ipBuckets.delete(bucketKey);
    }
  }
}

function isRateLimited(ip: string, action: ProxyAction): boolean {
  const rule = RATE_LIMIT_RULES[action];
  const bucketKey = `${ip}:${action}`;
  const now = Date.now();
  cleanupRateLimitBuckets(now);

  const existing = ipBuckets.get(bucketKey);
  if (!existing || now - existing.windowStartMs > rule.windowMs) {
    ipBuckets.set(bucketKey, { count: 1, windowStartMs: now, action });
    return false;
  }

  if (existing.count >= rule.maxRequests) {
    return true;
  }

  existing.count += 1;
  return false;
}

async function parseJsonBody(req: Request): Promise<unknown> {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      throw new RequestValidationError("Body must be valid JSON.");
    }
  }

  if (Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(req.body.toString("utf8"));
    } catch {
      throw new RequestValidationError("Body must be valid JSON.");
    }
  }

  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (Buffer.isBuffer(req.rawBody)) {
    try {
      return JSON.parse(req.rawBody.toString("utf8"));
    } catch {
      throw new RequestValidationError("Body must be valid JSON.");
    }
  }

  throw new RequestValidationError("Body is required.");
}

async function databricksRequest<T>(params: {
  host: string;
  token: string;
  path: string;
  method: "GET" | "POST";
  body?: Record<string, unknown>;
}): Promise<T> {
  const response = await fetch(`${params.host}${params.path}`, {
    method: params.method,
    headers: {
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "application/json",
    },
    body: params.body ? JSON.stringify(params.body) : undefined,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new UpstreamError(response.status, body);
  }

  return (await response.json()) as T;
}

function mapUpstreamError(error: UpstreamError): { status: number; code: string; message: string } {
  if (error.status === 429) {
    return {
      status: 429,
      code: "GENIE_RATE_LIMITED",
      message: "Genie is rate-limited right now. Please try again shortly.",
    };
  }

  if (error.status === 401 || error.status === 403) {
    return {
      status: 502,
      code: "GENIE_AUTH_FAILED",
      message: "Proxy authentication to Genie failed.",
    };
  }

  if (error.status >= 500) {
    return {
      status: 502,
      code: "GENIE_UNAVAILABLE",
      message: "Genie is currently unavailable. Please try again.",
    };
  }

  return {
    status: 400,
    code: "GENIE_REQUEST_REJECTED",
    message: "Genie rejected the request.",
  };
}

export const genieProxy = onRequest(
  {
    timeoutSeconds: 120,
    maxInstances: 20,
    secrets: [DATABRICKS_HOST, DATABRICKS_TOKEN, GENIE_SPACE_ID],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      json(res, 405, {
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "Use POST for /api/genie.",
        },
      });
      return;
    }

    try {
      const host = normalizeHost(DATABRICKS_HOST.value());
      const token = DATABRICKS_TOKEN.value();
      const spaceId = GENIE_SPACE_ID.value();

      if (!host || !token || !spaceId) {
        throw new Error("Missing required function secrets.");
      }

      const rawBody = await parseJsonBody(req);
      const payload = validateProxyRequestBody(rawBody);
      const ip = clientIp(req);

      if (isRateLimited(ip, payload.action)) {
        json(res, 429, {
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Please wait a minute and try again.",
          },
        });
        return;
      }

      if (payload.action === "start") {
        const response = await databricksRequest<unknown>({
          host,
          token,
          method: "POST",
          path: `/api/2.0/genie/spaces/${encodeURIComponent(spaceId)}/start-conversation`,
          body: { content: payload.content },
        });

        const conversationId = readDatabricksId(response, [
          "conversation_id",
          "conversationId",
          "conversation.id",
        ]);
        const messageId = readDatabricksId(response, ["message_id", "messageId", "message.id"]);

        if (!conversationId || !messageId) {
          throw new Error("Genie did not return conversation_id/message_id for start.");
        }

        json(res, 200, {
          conversationId,
          messageId,
          status: "IN_PROGRESS",
        });
        return;
      }

      if (payload.action === "message") {
        const response = await databricksRequest<unknown>({
          host,
          token,
          method: "POST",
          path: `/api/2.0/genie/spaces/${encodeURIComponent(spaceId)}/conversations/${encodeURIComponent(payload.conversationId)}/messages`,
          body: { content: payload.content },
        });

        const messageId = readDatabricksId(response, ["message_id", "messageId", "message.id", "id"]);
        if (!messageId) {
          throw new Error("Genie did not return message_id for follow-up message.");
        }

        json(res, 200, {
          conversationId: payload.conversationId,
          messageId,
          status: "IN_PROGRESS",
        });
        return;
      }

      if (payload.action === "poll") {
        const response = await databricksRequest<unknown>({
          host,
          token,
          method: "GET",
          path: `/api/2.0/genie/spaces/${encodeURIComponent(spaceId)}/conversations/${encodeURIComponent(payload.conversationId)}/messages/${encodeURIComponent(payload.messageId)}`,
        });

        const summary = extractAttachmentSummary(response);

        json(res, 200, {
          status: summary.status,
          rawStatus: summary.rawStatus,
          assistantText: summary.assistantText,
          query: summary.query,
          hasQueryResult: summary.hasQueryResult,
          attachmentId: summary.attachmentId,
          error: summary.error,
        });
        return;
      }

      const response = await databricksRequest<unknown>({
        host,
        token,
        method: "GET",
        path: `/api/2.0/genie/spaces/${encodeURIComponent(spaceId)}/conversations/${encodeURIComponent(payload.conversationId)}/messages/${encodeURIComponent(payload.messageId)}/query-result/${encodeURIComponent(payload.attachmentId)}`,
      });

      json(res, 200, {
        queryResult: normaliseQueryResult(response),
      });
    } catch (error) {
      if (error instanceof RequestValidationError) {
        json(res, 400, {
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      if (error instanceof UpstreamError) {
        const mapped = mapUpstreamError(error);
        console.error("Genie upstream request failed", {
          status: error.status,
          body: error.body,
        });
        json(res, mapped.status, {
          error: {
            code: mapped.code,
            message: mapped.message,
          },
        });
        return;
      }

      console.error("Unhandled genieProxy error", error);
      json(res, 500, {
        error: {
          code: "INTERNAL_ERROR",
          message: "Unexpected server error while processing Genie request.",
        },
      });
    }
  },
);
