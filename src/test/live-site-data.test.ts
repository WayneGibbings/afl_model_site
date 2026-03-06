import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLatestSiteSnapshot } from "@/lib/live-site-data";

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

describe("fetchLatestSiteSnapshot", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null on 304 responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 304 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchLatestSiteSnapshot("abc123");

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/site-data/latest",
      expect.objectContaining({
        headers: {
          "If-None-Match": "\"abc123\"",
        },
      }),
    );
  });

  it("returns the latest snapshot on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        snapshotVersion: "next-version",
        generatedAt: "2026-03-06T00:00:00.000Z",
        season: 2026,
        upcomingPredictions: [],
        accuracy: {
          season: 2026,
          as_at_round: "Pre-season",
          total_tips: 0,
          tips_correct: 0,
          accuracy_pct: 0,
          mae: 0,
          bits: 0,
          by_round: [],
        },
        ladderCurrent: [],
        ladderPreseason: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchLatestSiteSnapshot("abc123");

    expect(result?.snapshotVersion).toBe("next-version");
    expect(result?.season).toBe(2026);
  });
});
