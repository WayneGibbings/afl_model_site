import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendAndPoll } from "@/lib/genie-client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("sendAndPoll", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("handles a full start -> poll -> result flow", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ conversationId: "c1", messageId: "m1", status: "IN_PROGRESS" }))
      .mockResolvedValueOnce(
        jsonResponse({
          status: "IN_PROGRESS",
          rawStatus: "IN_PROGRESS",
          assistantText: null,
          query: null,
          hasQueryResult: false,
          attachmentId: null,
          error: null,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          status: "COMPLETED",
          rawStatus: "COMPLETED",
          assistantText: "Top team is Geelong.",
          query: "SELECT team FROM ladder LIMIT 1",
          hasQueryResult: true,
          attachmentId: "a1",
          error: null,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          queryResult: {
            columns: ["team"],
            rows: [["Geelong"]],
            rowCount: 1,
            truncated: false,
          },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const statusHistory: string[] = [];
    const result = await sendAndPoll("Who is first?", {
      timeoutMs: 10_000,
      pollInitialMs: 1,
      pollMaxMs: 1,
      onStatusChange: (status) => {
        statusHistory.push(status);
      },
    });

    expect(result.conversationId).toBe("c1");
    expect(result.messageId).toBe("m1");
    expect(result.assistantText).toBe("Top team is Geelong.");
    expect(result.queryResult?.rows).toEqual([["Geelong"]]);
    expect(statusHistory).toContain("IN_PROGRESS");
    expect(statusHistory.at(-1)).toBe("COMPLETED");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("throws timeout when Genie does not complete in time", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ conversationId: "c1", messageId: "m1", status: "IN_PROGRESS" }),
    );

    fetchMock.mockImplementation(() =>
      Promise.resolve(
        jsonResponse({
          status: "IN_PROGRESS",
          rawStatus: "IN_PROGRESS",
          assistantText: null,
          query: null,
          hasQueryResult: false,
          attachmentId: null,
          error: null,
        }),
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendAndPoll("Will this timeout?", {
        timeoutMs: 8,
        pollInitialMs: 1,
        pollMaxMs: 1,
      }),
    ).rejects.toThrow("timed out");
  });

  it("supports cancellation via AbortController", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ conversationId: "c1", messageId: "m1", status: "IN_PROGRESS" }),
    );

    fetchMock.mockImplementation(() =>
      Promise.resolve(
        jsonResponse({
          status: "IN_PROGRESS",
          rawStatus: "IN_PROGRESS",
          assistantText: null,
          query: null,
          hasQueryResult: false,
          attachmentId: null,
          error: null,
        }),
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5);

    await expect(
      sendAndPoll("Cancel this", {
        signal: controller.signal,
        timeoutMs: 2_000,
        pollInitialMs: 100,
        pollMaxMs: 100,
      }),
    ).rejects.toThrow("cancelled");
  });
});
