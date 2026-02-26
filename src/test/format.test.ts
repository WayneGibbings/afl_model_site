import { describe, expect, it } from "vitest";
import {
  formatMarginPoints,
  formatMatchDate,
  formatPct,
  formatPredictionDate,
  getPredictionChronologicalValue,
} from "@/lib/format";

describe("formatMatchDate", () => {
  it("includes timezone abbreviation in output", () => {
    const result = formatMatchDate("2026-03-05T19:30:00+11:00");
    expect(result).toMatch(/^[A-Za-z]{3} \d{1,2} [A-Za-z]{3} \d{1,2}:\d{2}(am|pm) .+/);
  });

  it("supports explicit timezone override", () => {
    const result = formatMatchDate("2026-03-05T19:30:00+11:00", "UTC");
    expect(result.startsWith("Thu 5 Mar 8:30am ")).toBe(true);
  });

  it("returns different local times for different zones", () => {
    const melbourne = formatMatchDate("2026-03-05T19:30:00+11:00", "Australia/Melbourne");
    const newYork = formatMatchDate("2026-03-05T19:30:00+11:00", "America/New_York");
    expect(melbourne).not.toBe(newYork);
  });

  it("prefers kickoff_time_utc_iso for timezone rendering", () => {
    const result = formatPredictionDate(
      {
        date: "2026-03-05",
        kickoff_time_utc_iso: "2026-03-05T08:30:00Z",
      },
      "Australia/Melbourne",
    );
    expect(result.startsWith("Thu 5 Mar 7:30pm ")).toBe(true);
  });

  it("renders date-only fixtures when kickoff_time_utc_iso is null", () => {
    const result = formatPredictionDate(
      {
        date: "2026-03-05",
        kickoff_time_utc_iso: null,
      },
      "America/New_York",
    );
    expect(result).toBe("Thu 5 Mar");
  });

  it("uses kickoff_time_utc_iso for chronological sorting when available", () => {
    const early = getPredictionChronologicalValue({
      date: "2026-03-05",
      kickoff_time_utc_iso: "2026-03-05T08:30:00Z",
    });
    const late = getPredictionChronologicalValue({
      date: "2026-03-05",
      kickoff_time_utc_iso: "2026-03-05T10:30:00Z",
    });
    expect(early).toBeLessThan(late);
  });
});

describe("formatPct", () => {
  it("rounds win percentage to whole numbers", () => {
    expect(formatPct(0.612)).toBe("61%");
    expect(formatPct(0.669)).toBe("67%");
  });
});

describe("formatMarginPoints", () => {
  it("floors margin and appends points", () => {
    expect(formatMarginPoints(8.9)).toBe("8 points");
    expect(formatMarginPoints(1.1)).toBe("1 points");
  });

  it("handles negative margins (away-team win)", () => {
    expect(formatMarginPoints(-8.9)).toBe("8 points");
  });
});
