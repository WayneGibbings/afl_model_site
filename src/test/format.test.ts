import { describe, expect, it } from "vitest";
import { formatMatchDate } from "@/lib/format";

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
});
