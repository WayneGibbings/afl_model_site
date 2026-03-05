import { describe, expect, it } from "vitest";
import {
  extractAttachmentSummary,
  normaliseQueryResult,
  normaliseStatus,
  readDatabricksId,
  RequestValidationError,
  validateProxyRequestBody,
} from "../../functions/src/genie-proxy-utils";

describe("validateProxyRequestBody", () => {
  it("parses start requests", () => {
    const request = validateProxyRequestBody({ action: "start", content: "Who is first?" });
    expect(request).toEqual({ action: "start", content: "Who is first?" });
  });

  it("parses result requests", () => {
    const request = validateProxyRequestBody({
      action: "result",
      conversationId: "c1",
      messageId: "m1",
      attachmentId: "a1",
    });

    expect(request).toEqual({
      action: "result",
      conversationId: "c1",
      messageId: "m1",
      attachmentId: "a1",
    });
  });

  it("rejects unknown actions", () => {
    expect(() => validateProxyRequestBody({ action: "explode" })).toThrow(RequestValidationError);
  });

  it("rejects blank content", () => {
    expect(() => validateProxyRequestBody({ action: "start", content: "   " })).toThrow("Expected content to be non-empty.");
  });
});

describe("normaliseStatus", () => {
  it("maps known statuses and falls back to UNKNOWN", () => {
    expect(normaliseStatus("IN_PROGRESS")).toBe("IN_PROGRESS");
    expect(normaliseStatus("completed")).toBe("COMPLETED");
    expect(normaliseStatus("FETCHING_METADATA")).toBe("UNKNOWN");
  });
});

describe("extractAttachmentSummary", () => {
  it("extracts query attachment and assistant text", () => {
    const summary = extractAttachmentSummary({
      status: "COMPLETED",
      attachments: [
        {
          attachment_id: "att-1",
          attachment_type: "query_result",
          query: "SELECT team, wins FROM ladder",
          text: "Top teams are shown below.",
        },
      ],
    });

    expect(summary).toEqual({
      status: "COMPLETED",
      rawStatus: "COMPLETED",
      assistantText: "Top teams are shown below.",
      query: "SELECT team, wins FROM ladder",
      hasQueryResult: true,
      attachmentId: "att-1",
      error: null,
    });
  });

  it("does not treat user content as assistant text", () => {
    const summary = extractAttachmentSummary({
      status: "IN_PROGRESS",
      content: "Which team is first?",
      attachments: [],
    });

    expect(summary.assistantText).toBeNull();
  });
});

describe("normaliseQueryResult", () => {
  it("normalizes statement_response data arrays", () => {
    const queryResult = normaliseQueryResult({
      statement_response: {
        manifest: {
          schema: {
            columns: [{ name: "team" }, { name: "wins" }],
          },
          total_row_count: 2,
          truncated: false,
        },
        result: {
          data_array: [
            ["Geelong", 16],
            ["Brisbane", 15],
          ],
        },
      },
    });

    expect(queryResult.columns).toEqual(["team", "wins"]);
    expect(queryResult.rows).toEqual([
      ["Geelong", 16],
      ["Brisbane", 15],
    ]);
    expect(queryResult.rowCount).toBe(2);
    expect(queryResult.truncated).toBe(false);
  });
});

describe("readDatabricksId", () => {
  it("supports nested key paths", () => {
    const response = {
      conversation: { id: "conv-123" },
      message: { id: "msg-456" },
    };

    expect(readDatabricksId(response, ["conversation.id"])).toBe("conv-123");
    expect(readDatabricksId(response, ["message.id", "message_id"])).toBe("msg-456");
  });

  it("returns null when no candidate key exists", () => {
    expect(readDatabricksId({ foo: "bar" }, ["message.id"])).toBeNull();
  });
});
