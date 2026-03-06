import { describe, expect, it } from "vitest";
import { buildSiteSnapshotPayload, createSiteSnapshot, hashSiteSnapshotPayload } from "../../shared/site-snapshot";

describe("site snapshot helpers", () => {
  it("normalizes databricks rows into the site snapshot shape", () => {
    const payload = buildSiteSnapshotPayload({
      season: 2026,
      rawUpcoming: [
        {
          round: "Round 1",
          date: "2026-03-20",
          home_team: "Geelong Cats",
          away_team: "Brisbane Lions",
          venue: "MCG",
          predicted_winner: "Geelong Cats",
          home_win_probability: 0.61,
          away_win_probability: 0.39,
          predicted_margin: 14.2,
          home_elo: 1712,
          away_elo: 1678,
          elo_diff: 34,
        },
      ],
      rawLadderPreseason: [
        {
          position: 1,
          team: "Geelong Cats",
          wins: 18,
          losses: 5,
          draws: 0,
          percentage: 129.3,
        },
      ],
      rawLadderCurrent: [
        {
          position: 1,
          team: "Brisbane Lions",
          wins: 1,
          losses: 0,
          draws: 0,
          percentage: 121.2,
          predicted_final_wins: 17,
          predicted_final_position: 1,
        },
      ],
      accuracyRows: [],
    });

    expect(payload.upcomingPredictions[0].home_team).toBe("geelong");
    expect(payload.upcomingPredictions[0].away_team).toBe("brisbane");
    expect(payload.ladderPreseason[0].team).toBe("geelong");
    expect(payload.ladderCurrent[0].team).toBe("brisbane");
    expect(payload.accuracy.as_at_round).toBe("Pre-season");
  });

  it("uses a stable snapshotVersion for identical payloads", () => {
    const payload = {
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
    };

    const first = createSiteSnapshot(payload, "2026-03-06T00:00:00.000Z");
    const second = createSiteSnapshot(payload, "2026-03-07T00:00:00.000Z");

    expect(first.snapshotVersion).toBe(second.snapshotVersion);
    expect(first.snapshotVersion).toBe(hashSiteSnapshotPayload(payload));
    expect(first.generatedAt).not.toBe(second.generatedAt);
  });
});
