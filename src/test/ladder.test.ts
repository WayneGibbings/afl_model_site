import { describe, expect, it } from "vitest";
import { sortCurrentProjectionRows } from "@/lib/ladder";
import type { LadderEntry } from "@/lib/types";

describe("sortCurrentProjectionRows", () => {
  it("orders the current projection by projected total wins", () => {
    const rows: LadderEntry[] = [
      {
        team: "brisbane",
        position: 5,
        wins: 1,
        losses: 0,
        draws: 0,
        percentage: 110.2,
        predicted_final_wins: 15.4,
        predicted_final_position: 5,
      },
      {
        team: "geelong",
        position: 1,
        wins: 0,
        losses: 0,
        draws: 0,
        percentage: 100,
        predicted_final_wins: 15.8,
        predicted_final_position: 1,
      },
      {
        team: "carlton",
        position: 2,
        wins: 1,
        losses: 0,
        draws: 0,
        percentage: 115.9,
        predicted_final_wins: 15.4,
        predicted_final_position: 2,
      },
    ];

    const sorted = sortCurrentProjectionRows(rows);

    expect(sorted.map((row) => row.team)).toEqual(["geelong", "carlton", "brisbane"]);
  });
});
