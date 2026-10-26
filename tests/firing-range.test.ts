import { describe, expect, test } from "bun:test";
import { createFiringRangeMap, RANGE_TARGETS, RANGE_SPAWN } from "../src/lib/firing-range";
import { getMap, rayBox, PLAYER_HEIGHT } from "../src/lib/game-protocol";

describe("Armory firing range", () => {
  test("is a separate, non-mutating practice map", () => {
    const normal = getMap("compound");
    const initialCoverLength = normal.cover.length;
    const range = createFiringRangeMap();
    expect(range.name).toBe("Firing Range");
    expect(range.environment).toEqual([]);
    expect(range.regions).toBeUndefined();
    expect(range.spawns.ffa).toEqual([RANGE_SPAWN]);
    expect(normal.cover.length).toBe(initialCoverLength);
    expect(normal.name).not.toBe(range.name);
  });

  test("places four practice targets downrange in open firing lanes", () => {
    const range = createFiringRangeMap();
    expect(RANGE_TARGETS).toHaveLength(4);
    for (const target of RANGE_TARGETS) {
      expect(target[2]).toBeGreaterThan(RANGE_SPAWN[2]);
      expect(Math.abs(target[0])).toBeLessThan(10);
      const dx = target[0] - RANGE_SPAWN[0];
      const dz = target[2] - RANGE_SPAWN[2];
      const length = Math.hypot(dx, dz);
      const direction: [number, number, number] = [dx / length, 0, dz / length];
      for (const cover of range.cover) {
        expect(rayBox([RANGE_SPAWN[0], PLAYER_HEIGHT / 2, RANGE_SPAWN[2]], direction,
          cover.pos, cover.size)).toBeNull();
      }
    }
  });

  test("keeps the normal spawn catalog isolated", () => {
    const normal = getMap("compound");
    const count = normal.spawns.ffa.length;
    createFiringRangeMap().spawns.ffa.push([9, 0, 9]);
    expect(getMap("compound").spawns.ffa).toHaveLength(count);
  });
});
