import { describe, expect, it } from "vitest";
import { normalizeTipsPredictions } from "@/lib/data";

describe("normalizeTipsPredictions", () => {
  it("converts legacy predictions.json rows into the current site shape", () => {
    const predictions = normalizeTipsPredictions([
      {
        season: 2026,
        round: 2,
        round_label: "Round 2",
        date: "2026-03-12T19:20:00+11:00",
        venue: "Optus Stadium",
        home_team: "westcoast",
        away_team: "melbourne",
        predicted_winner: "melbourne",
        predicted_margin: 11.8,
        win_probability: 0.669,
        actual_winner: null,
        actual_margin: null,
        tip_correct: null,
        margin_error: null,
      },
    ]);

    expect(predictions).not.toBeNull();
    expect(predictions).toHaveLength(1);
    expect(predictions?.[0]).toMatchObject({
      round: "Round 2",
      home_win_probability: 0.331,
      away_win_probability: 0.669,
      home_elo: 1500,
      away_elo: 1500,
      elo_diff: 0,
    });
  });
});
