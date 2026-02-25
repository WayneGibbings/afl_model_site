import { describe, expect, it } from "vitest";
import { mapTeamKey, normaliseHost, warehouseIdFromHttpPath } from "@/lib/databricks-utils";

describe("warehouseIdFromHttpPath", () => {
  it("extracts warehouse id from HTTP path", () => {
    expect(warehouseIdFromHttpPath("/sql/1.0/warehouses/28dd09c7df5b6d65")).toBe("28dd09c7df5b6d65");
  });

  it("throws on invalid path", () => {
    expect(() => warehouseIdFromHttpPath("/sql/1.0/endpoints/foo")).toThrow(
      "Could not extract warehouse id from DATABRICKS_HTTP_PATH",
    );
  });
});

describe("normaliseHost", () => {
  it("adds https when host has no scheme", () => {
    expect(normaliseHost("dbc-11025f47-daa6.cloud.databricks.com")).toBe("https://dbc-11025f47-daa6.cloud.databricks.com");
  });

  it("preserves existing scheme", () => {
    expect(normaliseHost("https://dbc-11025f47-daa6.cloud.databricks.com")).toBe("https://dbc-11025f47-daa6.cloud.databricks.com");
  });
});

describe("mapTeamKey", () => {
  it("passes through known team keys", () => {
    expect(mapTeamKey("geelong", "home_team")).toBe("geelong");
  });

  it("normalises display-name aliases", () => {
    expect(mapTeamKey("Western Bulldogs", "predicted_winner")).toBe("bulldogs");
    expect(mapTeamKey("Footscray", "predicted_winner")).toBe("bulldogs");
    expect(mapTeamKey("Brisbane Lions", "away_team")).toBe("brisbane");
  });

  it("returns null only when nullable is true", () => {
    expect(mapTeamKey(null, "actual_winner", true)).toBeNull();
    expect(() => mapTeamKey(null, "home_team", false)).toThrow("Missing team value for field: home_team");
  });

  it("throws on unknown teams", () => {
    expect(() => mapTeamKey("Tasmania Devils", "team")).toThrow("Unknown team value for field team");
  });
});
