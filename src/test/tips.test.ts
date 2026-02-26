import { describe, expect, it } from "vitest";
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
