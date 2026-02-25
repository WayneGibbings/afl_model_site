import { describe, expect, it } from "vitest";
import { getDefaultRound } from "@/lib/tips";
import { getWinProbabilityBackground } from "@/lib/win-prob";

describe("getWinProbabilityBackground", () => {
  it("returns transparent at 50%", () => {
    expect(getWinProbabilityBackground(0.5)).toBe("rgba(234, 88, 12, 0.000)");
  });

  it("keeps transparency through 55%", () => {
    expect(getWinProbabilityBackground(0.55)).toBe("rgba(234, 88, 12, 0.000)");
  });

  it("returns stronger opacity at high confidence", () => {
    expect(getWinProbabilityBackground(0.85)).toBe("rgba(234, 88, 12, 0.367)");
    expect(getWinProbabilityBackground(1)).toBe("rgba(234, 88, 12, 0.550)");
  });
});

describe("getDefaultRound", () => {
  it("returns latest completed round when results exist", () => {
    expect(
      getDefaultRound([
        { round_label: "Round 1", tip_correct: true, date: "2026-03-05T19:30:00+11:00" },
        { round_label: "Round 2", tip_correct: null, date: "2026-03-12T19:30:00+11:00" },
      ] as never),
    ).toBe("Round 1");
  });

  it("returns first round when no results exist", () => {
    expect(
      getDefaultRound([
        { round_label: "Round 3", tip_correct: null, date: "2026-03-20T19:30:00+11:00" },
        { round_label: "Round 2", tip_correct: null, date: "2026-03-13T19:30:00+11:00" },
      ] as never),
    ).toBe("Round 2");
  });
});
