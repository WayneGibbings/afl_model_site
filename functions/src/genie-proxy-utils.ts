export type ProxyAction = "start" | "message" | "poll" | "result";

export type NormalizedStatus = "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED" | "UNKNOWN";

export interface ValidatedStartRequest {
  action: "start";
  content: string;
}

export interface ValidatedMessageRequest {
  action: "message";
  conversationId: string;
  content: string;
}

export interface ValidatedPollRequest {
  action: "poll";
  conversationId: string;
  messageId: string;
}

export interface ValidatedResultRequest {
  action: "result";
  conversationId: string;
  messageId: string;
  attachmentId: string;
}

export type ValidatedProxyRequest =
  | ValidatedStartRequest
  | ValidatedMessageRequest
  | ValidatedPollRequest
  | ValidatedResultRequest;

export interface AttachmentSummary {
  status: NormalizedStatus;
  rawStatus: string | null;
  assistantText: string | null;
  query: string | null;
  hasQueryResult: boolean;
  attachmentId: string | null;
  error: string | null;
}

export interface NormalizedQueryResult {
  columns: string[];
  rows: Array<Array<string | number | boolean | null>>;
  rowCount: number;
  truncated: boolean;
}

const MAX_CONTENT_CHARS = 1_000;
const MAX_ID_CHARS = 512;

export class RequestValidationError extends Error {
  code: string;

  constructor(message: string, code = "INVALID_REQUEST") {
    super(message);
    this.name = "RequestValidationError";
    this.code = code;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => asRecord(item)).filter((item): item is Record<string, unknown> => item !== null);
}

function toStringValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const candidateKeys = ["content", "value", "text", "query", "sql", "message"] as const;
  for (const key of candidateKeys) {
    const candidate = record[key];
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return null;
}

function readRequiredString(record: Record<string, unknown>, key: string, maxLength = MAX_ID_CHARS): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new RequestValidationError(`Expected ${key} to be a string.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new RequestValidationError(`Expected ${key} to be non-empty.`);
  }

  if (trimmed.length > maxLength) {
    throw new RequestValidationError(`${key} is too long.`);
  }

  return trimmed;
}

function readContent(record: Record<string, unknown>): string {
  const content = readRequiredString(record, "content", MAX_CONTENT_CHARS);
  if (content.length > MAX_CONTENT_CHARS) {
    throw new RequestValidationError(`content cannot exceed ${MAX_CONTENT_CHARS} characters.`);
  }
  return content;
}

export function validateProxyRequestBody(body: unknown): ValidatedProxyRequest {
  const record = asRecord(body);
  if (!record) {
    throw new RequestValidationError("Body must be a JSON object.");
  }

  const action = readRequiredString(record, "action", 32).toLowerCase();

  if (action === "start") {
    return {
      action: "start",
      content: readContent(record),
    };
  }

  if (action === "message") {
    return {
      action: "message",
      conversationId: readRequiredString(record, "conversationId"),
      content: readContent(record),
    };
  }

  if (action === "poll") {
    return {
      action: "poll",
      conversationId: readRequiredString(record, "conversationId"),
      messageId: readRequiredString(record, "messageId"),
    };
  }

  if (action === "result") {
    return {
      action: "result",
      conversationId: readRequiredString(record, "conversationId"),
      messageId: readRequiredString(record, "messageId"),
      attachmentId: readRequiredString(record, "attachmentId"),
    };
  }

  throw new RequestValidationError(`Unknown action: ${action}`);
}

export function normaliseStatus(rawStatus: unknown): NormalizedStatus {
  if (typeof rawStatus !== "string") {
    return "UNKNOWN";
  }

  const upper = rawStatus.toUpperCase();
  if (upper === "IN_PROGRESS" || upper === "COMPLETED" || upper === "FAILED" || upper === "CANCELLED") {
    return upper;
  }

  return "UNKNOWN";
}

function normaliseValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  const record = asRecord(value);
  if (!record) {
    return String(value);
  }

  const typedKeys = ["str", "string", "long", "int", "double", "float", "boolean"] as const;
  for (const key of typedKeys) {
    const typedValue = record[key];
    if (typeof typedValue === "string" || typeof typedValue === "number" || typeof typedValue === "boolean") {
      return typedValue;
    }
  }

  if (record.null === true || record.is_null === true) {
    return null;
  }

  const contentValue = toStringValue(record);
  if (contentValue !== null) {
    return contentValue;
  }

  return JSON.stringify(record);
}

export function extractAttachmentSummary(rawMessage: unknown): AttachmentSummary {
  const message = asRecord(rawMessage) ?? {};
  const attachments = asRecordArray(message.attachments);

  // Genie `content` is user-authored message text, not assistant output.
  let assistantText = toStringValue(message.text) ?? toStringValue(message.response);
  let query: string | null = null;
  let attachmentId: string | null = null;

  for (const attachment of attachments) {
    if (!assistantText) {
      assistantText =
        toStringValue(attachment.text) ??
        toStringValue(attachment.response) ??
        toStringValue(attachment.content) ??
        toStringValue(attachment.message);
    }

    if (!query) {
      query = toStringValue(attachment.query) ?? toStringValue(attachment.sql);
    }

    const candidateId = toStringValue(attachment.attachment_id) ?? toStringValue(attachment.id);
    const attachmentType = toStringValue(attachment.attachment_type) ?? "";

    if (!attachmentId) {
      const hasQueryHints =
        query !== null ||
        attachmentType.toLowerCase().includes("query") ||
        attachment.query_result !== undefined ||
        attachment.query_result_metadata !== undefined ||
        attachment.statement_response !== undefined;

      if (candidateId && hasQueryHints) {
        attachmentId = candidateId;
      }
    }
  }

  const rawStatus = toStringValue(message.status);
  const normalizedStatus = normaliseStatus(rawStatus);
  const errorMessage =
    toStringValue(message.error) ??
    toStringValue(asRecord(message.error)?.message) ??
    toStringValue(asRecord(message.error)?.detail);

  return {
    status: normalizedStatus,
    rawStatus,
    assistantText,
    query,
    hasQueryResult: attachmentId !== null,
    attachmentId,
    error: errorMessage,
  };
}

function extractRows(statementResponse: Record<string, unknown>, columnNames: string[]): Array<Array<string | number | boolean | null>> {
  const result = asRecord(statementResponse.result);
  const dataArray = result?.data_array;

  if (Array.isArray(dataArray)) {
    return dataArray.map((row) => {
      if (!Array.isArray(row)) {
        return [normaliseValue(row)];
      }
      return row.map((cell) => normaliseValue(cell));
    });
  }

  const typedArray = result?.data_typed_array;
  if (Array.isArray(typedArray)) {
    return typedArray.map((row) => {
      if (Array.isArray(row)) {
        return row.map((cell) => normaliseValue(cell));
      }

      const recordRow = asRecord(row);
      if (!recordRow) {
        return [normaliseValue(row)];
      }

      if (columnNames.length > 0) {
        return columnNames.map((columnName) => normaliseValue(recordRow[columnName]));
      }

      return Object.values(recordRow).map((cell) => normaliseValue(cell));
    });
  }

  return [];
}

export function normaliseQueryResult(rawPayload: unknown): NormalizedQueryResult {
  const payload = asRecord(rawPayload) ?? {};
  const statementResponse = asRecord(payload.statement_response) ?? payload;
  const manifest = asRecord(statementResponse.manifest) ?? {};
  const schema = asRecord(manifest.schema) ?? {};
  const columnsRaw = asRecordArray(schema.columns);

  const columns = columnsRaw.map((column, index) => toStringValue(column.name) ?? `column_${index + 1}`);

  const rows = extractRows(statementResponse, columns);

  let rowCount = rows.length;
  if (typeof manifest.total_row_count === "number" && Number.isFinite(manifest.total_row_count)) {
    rowCount = manifest.total_row_count;
  }

  const truncated = manifest.truncated === true;

  return {
    columns,
    rows,
    rowCount,
    truncated,
  };
}

export function readDatabricksId(rawPayload: unknown, keys: string[]): string | null {
  const payload = asRecord(rawPayload);
  if (!payload) {
    return null;
  }

  for (const key of keys) {
    const segments = key.split(".");
    let current: unknown = payload;

    for (const segment of segments) {
      const currentRecord = asRecord(current);
      if (!currentRecord) {
        current = null;
        break;
      }
      current = currentRecord[segment];
    }

    if (typeof current === "string" && current.trim()) {
      return current.trim();
    }
  }

  return null;
}
