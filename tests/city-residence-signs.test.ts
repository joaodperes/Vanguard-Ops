import { describe, expect, test } from "bun:test";
import { getMap } from "../src/lib/game-protocol";

describe("Afterlight City house labels", () => {
  test("no generic RESIDENCE sign is attached to generated or authored buildings", () => {
    for (const mapId of ["terminal", "arena_neon"] as const) {
      const map = getMap(mapId);
      const buildings = (map.props ?? []).filter(p => p.kind === "building");
      const homes = buildings.filter(p => p.use === "house");
      expect(buildings.length).toBeGreaterThan(0);
      expect(homes.length).toBeGreaterThan(0);
      expect(homes.every(p => !p.text || p.text.trim().toUpperCase() !== "RESIDENCE")).toBe(true);
      // Commercial and public sites retain their identities.
      expect(buildings.some(p => p.use !== "house" && !!p.text)).toBe(true);
    }
  });
});
