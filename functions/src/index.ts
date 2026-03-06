import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onRequest, type Request } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import type { Response } from "express";
import {
  extractAttachmentSummary,
  normaliseQueryResult,
  type ProxyAction,
  readDatabricksId,
  RequestValidationError,
  validateProxyRequestBody,
} from "./genie-proxy-utils";
import { normaliseHost, warehouseIdFromHttpPath } from "./databricks-utils";
import {
  buildSiteSnapshotPayload,
  createSiteSnapshot,
  siteSnapshotBytes,
  siteSnapshotQueries,
} from "./site-snapshot";
import { z } from "zod";

const DATABRICKS_HOST = defineSecret("DATABRICKS_HOST");
const DATABRICKS_TOKEN = defineSecret("DATABRICKS_TOKEN");
const DATABRICKS_HTTP_PATH = defineSecret("DATABRICKS_HTTP_PATH");
const GENIE_SPACE_ID = defineSecret("GENIE_SPACE_ID");
const SITE_REFRESH_TOKEN = defineSecret("SITE_REFRESH_TOKEN");

const RATE_LIMIT_RULES: Record<ProxyAction, { maxRequests: number; windowMs: number }> = {
  start: { maxRequests: 10, windowMs: 60_000 },
  message: { maxRequests: 20, windowMs: 60_000 },
  poll: { maxRequests: 180, windowMs: 60_000 },
  result: { maxRequests: 60, windowMs: 60_000 },
};

const REGION = "australia-southeast1";
const SITE_CACHE_DOC_PATH = "site_cache/latest";
const MAX_SITE_SNAPSHOT_BYTES = 900_000;

type JsonResponse = unknown;

const ipBuckets = new Map<string, { count: number; windowStartMs: number; action: ProxyAction }>();

const statementResponseSchema = z.object({
  statement_id: z.string(),
  status: z.object({
    state: z.string(),
  }),
  result: z
    .object({
      data_array: z.array(z.array(z.unknown())).optional(),
    })
    .optional(),
  manifest: z
    .object({
      schema: z
        .object({
          columns: z.array(
            z.object({
              name: z.string(),
            }),
          ),
        })
        .optional(),
    })
    .optional(),
});

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

function ensureFirestore() {
  if (getApps().length === 0) {
    initializeApp();
  }
  return getFirestore();
}

function jsonNoStore(res: Response, status: number, body: JsonResponse): void {
  res.set("Cache-Control", "no-store");
  res.status(status).json(body);
}

function jsonPublic(
  res: Response,
  status: number,
  body: JsonResponse,
  options: { cacheControl: string; etag?: string },
): void {
  res.set("Cache-Control", options.cacheControl);
  if (options.etag) {
    res.set("ETag", options.etag);
  }
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

function readRefreshToken(req: Request): string | null {
  const headerValue = req.get("x-site-refresh-token");
  return headerValue ? headerValue.trim() : null;
}

function normalizeRefreshToken(secretValue: string): string {
  const trimmed = secretValue.trim();
  if (!trimmed) {
    throw new Error("SITE_REFRESH_TOKEN secret is empty.");
  }
  return trimmed;
}

function quoteEtag(snapshotVersion: string): string {
  return `"${snapshotVersion}"`;
}

function matchesIfNoneMatch(headerValue: string | undefined, snapshotVersion: string): boolean {
  if (!headerValue) {
    return false;
  }

  const normalized = headerValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return normalized.includes("*") || normalized.includes(snapshotVersion) || normalized.includes(quoteEtag(snapshotVersion));
}

function serializeSnapshot(snapshot: ReturnType<typeof createSiteSnapshot>) {
  return JSON.parse(JSON.stringify(snapshot)) as ReturnType<typeof createSiteSnapshot>;
}

async function executeSqlStatement(params: {
  host: string;
  token: string;
  warehouseId: string;
  statement: string;
}): Promise<Array<Record<string, unknown>>> {
  const submit = await fetch(`${params.host}/api/2.0/sql/statements`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      statement: params.statement,
      warehouse_id: params.warehouseId,
      wait_timeout: "10s",
    }),
  });

  if (!submit.ok) {
    throw new Error(`Statement submission failed: ${submit.status} ${submit.statusText}`);
  }

  const submitted = statementResponseSchema.parse(await submit.json());
  let state = submitted.status.state;
  let latest = submitted;

  while (state === "PENDING" || state === "RUNNING") {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    const poll = await fetch(`${params.host}/api/2.0/sql/statements/${submitted.statement_id}`, {
      headers: {
        Authorization: `Bearer ${params.token}`,
      },
    });

    if (!poll.ok) {
      throw new Error(`Statement polling failed: ${poll.status} ${poll.statusText}`);
    }

    latest = statementResponseSchema.parse(await poll.json());
    state = latest.status.state;
  }

  if (state !== "SUCCEEDED") {
    throw new Error(`Statement failed with state=${state}`);
  }

  const columns = latest.manifest?.schema?.columns?.map((column) => column.name) ?? [];
  const rows = latest.result?.data_array ?? [];

  return rows.map((row) => {
    const mapped: Record<string, unknown> = {};
    for (let index = 0; index < columns.length; index += 1) {
      mapped[columns[index]] = row[index];
    }
    return mapped;
  });
}

async function fetchSiteSnapshotFromDatabricks(params: {
  host: string;
  token: string;
  httpPath: string;
}) {
  const warehouseId = warehouseIdFromHttpPath(params.httpPath);
  const seasonRows = await executeSqlStatement({
    host: params.host,
    token: params.token,
    warehouseId,
    statement: siteSnapshotQueries.currentSeason,
  });

  const targetSeason = Number(seasonRows[0]?.season);
  if (!Number.isFinite(targetSeason)) {
    throw new Error("Could not determine current season from gold_predictions");
  }

  const [rawUpcoming, rawLadderPreseason, rawLadderCurrent, accuracyRows] = await Promise.all([
    executeSqlStatement({
      host: params.host,
      token: params.token,
      warehouseId,
      statement: siteSnapshotQueries.upcomingPredictions(targetSeason),
    }),
    executeSqlStatement({
      host: params.host,
      token: params.token,
      warehouseId,
      statement: siteSnapshotQueries.ladderPreseason(targetSeason),
    }),
    executeSqlStatement({
      host: params.host,
      token: params.token,
      warehouseId,
      statement: siteSnapshotQueries.ladderCurrent(targetSeason),
    }),
    executeSqlStatement({
      host: params.host,
      token: params.token,
      warehouseId,
      statement: siteSnapshotQueries.accuracy(targetSeason),
    }),
  ]);

  const payload = buildSiteSnapshotPayload({
    season: targetSeason,
    rawUpcoming,
    rawLadderPreseason,
    rawLadderCurrent,
    accuracyRows,
  });

  return serializeSnapshot(createSiteSnapshot(payload));
}

export const genieProxy = onRequest(
  {
    region: REGION,
    invoker: "public",
    timeoutSeconds: 120,
    maxInstances: 20,
    secrets: [DATABRICKS_HOST, DATABRICKS_TOKEN, GENIE_SPACE_ID],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      jsonNoStore(res, 405, {
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "Use POST for /api/genie.",
        },
      });
      return;
    }

    try {
      const host = normaliseHost(DATABRICKS_HOST.value());
      const token = DATABRICKS_TOKEN.value();
      const spaceId = GENIE_SPACE_ID.value();

      if (!host || !token || !spaceId) {
        throw new Error("Missing required function secrets.");
      }

      const rawBody = await parseJsonBody(req);
      const payload = validateProxyRequestBody(rawBody);
      const ip = clientIp(req);

      if (isRateLimited(ip, payload.action)) {
        jsonNoStore(res, 429, {
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

        const conversationId = readDatabricksId(response, ["conversation_id", "conversationId", "conversation.id"]);
        const messageId = readDatabricksId(response, ["message_id", "messageId", "message.id"]);

        if (!conversationId || !messageId) {
          throw new Error("Genie did not return conversation_id/message_id for start.");
        }

        jsonNoStore(res, 200, {
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

        jsonNoStore(res, 200, {
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

        jsonNoStore(res, 200, {
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

      jsonNoStore(res, 200, {
        queryResult: normaliseQueryResult(response),
      });
    } catch (error) {
      if (error instanceof RequestValidationError) {
        jsonNoStore(res, 400, {
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
        jsonNoStore(res, mapped.status, {
          error: {
            code: mapped.code,
            message: mapped.message,
          },
        });
        return;
      }

      console.error("Unhandled genieProxy error", error);
      jsonNoStore(res, 500, {
        error: {
          code: "INTERNAL_ERROR",
          message: "Unexpected server error while processing Genie request.",
        },
      });
    }
  },
);

export const siteDataRefresh = onRequest(
  {
    region: REGION,
    invoker: "public",
    timeoutSeconds: 180,
    maxInstances: 10,
    secrets: [DATABRICKS_HOST, DATABRICKS_TOKEN, DATABRICKS_HTTP_PATH, SITE_REFRESH_TOKEN],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      jsonNoStore(res, 405, {
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "Use POST for /api/site-data/refresh.",
        },
      });
      return;
    }

    try {
      const expectedToken = normalizeRefreshToken(SITE_REFRESH_TOKEN.value());
      const providedToken = readRefreshToken(req);
      if (!providedToken || providedToken !== expectedToken) {
        jsonNoStore(res, 401, {
          error: {
            code: "UNAUTHORIZED",
            message: "Missing or invalid site refresh token.",
          },
        });
        return;
      }

      const host = normaliseHost(DATABRICKS_HOST.value());
      const token = DATABRICKS_TOKEN.value();
      const httpPath = DATABRICKS_HTTP_PATH.value();
      if (!host || !token || !httpPath) {
        throw new Error("Missing required site data refresh secrets.");
      }

      const snapshot = await fetchSiteSnapshotFromDatabricks({ host, token, httpPath });
      if (siteSnapshotBytes(snapshot) > MAX_SITE_SNAPSHOT_BYTES) {
        throw new Error(`Site snapshot exceeds ${MAX_SITE_SNAPSHOT_BYTES} bytes.`);
      }

      const db = ensureFirestore();
      const docRef = db.doc(SITE_CACHE_DOC_PATH);
      const existing = await docRef.get();
      const existingVersion = existing.exists ? existing.data()?.snapshotVersion : null;

      if (existingVersion === snapshot.snapshotVersion) {
        jsonNoStore(res, 200, {
          ok: true,
          snapshotVersion: snapshot.snapshotVersion,
          updated: false,
        });
        return;
      }

      await docRef.set(snapshot);
      jsonNoStore(res, 200, {
        ok: true,
        snapshotVersion: snapshot.snapshotVersion,
        updated: true,
      });
    } catch (error) {
      console.error("Unhandled siteDataRefresh error", error);
      jsonNoStore(res, 500, {
        error: {
          code: "INTERNAL_ERROR",
          message: "Unexpected server error while refreshing site data.",
        },
      });
    }
  },
);

export const siteDataLatest = onRequest(
  {
    region: REGION,
    invoker: "public",
    timeoutSeconds: 60,
    maxInstances: 20,
  },
  async (req, res) => {
    if (req.method !== "GET") {
      jsonNoStore(res, 405, {
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "Use GET for /api/site-data/latest.",
        },
      });
      return;
    }

    try {
      const db = ensureFirestore();
      const doc = await db.doc(SITE_CACHE_DOC_PATH).get();
      if (!doc.exists) {
        jsonNoStore(res, 404, {
          error: {
            code: "NOT_FOUND",
            message: "No live site snapshot is available yet.",
          },
        });
        return;
      }

      const snapshot = doc.data() as ReturnType<typeof createSiteSnapshot>;
      if (matchesIfNoneMatch(req.get("if-none-match") ?? undefined, snapshot.snapshotVersion)) {
        res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
        res.set("ETag", quoteEtag(snapshot.snapshotVersion));
        res.status(304).send();
        return;
      }

      jsonPublic(res, 200, snapshot, {
        cacheControl: "public, max-age=60, stale-while-revalidate=300",
        etag: quoteEtag(snapshot.snapshotVersion),
      });
    } catch (error) {
      console.error("Unhandled siteDataLatest error", error);
      jsonNoStore(res, 500, {
        error: {
          code: "INTERNAL_ERROR",
          message: "Unexpected server error while reading site data.",
        },
      });
    }
  },
);
