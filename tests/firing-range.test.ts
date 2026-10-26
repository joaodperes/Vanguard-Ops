import { describe, expect, test } from "bun:test";
import { createFiringRangeMap, RANGE_TARGETS, RANGE_SPAWN, RANGE_MOVING_TARGETS, movingRangeTargetPosition } from "../src/lib/firing-range";
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
        const hit = rayBox([RANGE_SPAWN[0], PLAYER_HEIGHT / 2, RANGE_SPAWN[2]], direction,
          cover.pos, cover.size);
        expect(hit === null || hit > length).toBe(true);
      }
    }
  });

  test("adds moving targets at increasing range and speed without replacing the stationary set", () => {
    expect(RANGE_TARGETS).toHaveLength(4);
    expect(RANGE_MOVING_TARGETS).toHaveLength(3);
    const distances = RANGE_MOVING_TARGETS.map(target => target.center[2] - RANGE_SPAWN[2]);
    const speeds = RANGE_MOVING_TARGETS.map(target => target.speed);
    expect(distances).toEqual([28, 40, 52]);
    expect(speeds).toEqual([1.4, 2.8, 4.5]);
  });

  test("moves each dummy sideways at its configured speed and reverses at endpoints", () => {
    for (const target of RANGE_MOVING_TARGETS) {
      const period = 4 * target.halfTravel / target.speed;
      const leftStart = { ...target, phase: 0 };
      const start = movingRangeTargetPosition(leftStart, 0);
      const mid = movingRangeTargetPosition(leftStart, 2 * target.halfTravel / target.speed);
      const back = movingRangeTargetPosition(leftStart, period);
      expect(start[0]).toBeCloseTo(target.center[0] - target.halfTravel);
      expect(mid[0]).toBeCloseTo(target.center[0] + target.halfTravel);
      expect(back[0]).toBeCloseTo(start[0]);
      const quarterSecond = movingRangeTargetPosition(leftStart, 0.25);
      expect(quarterSecond[0] - start[0]).toBeCloseTo(target.speed * 0.25);
      // A complete cycle remains deterministic and retains target height/depth.
      const at = movingRangeTargetPosition(target, 1.37);
      const looped = movingRangeTargetPosition(target, 1.37 + period);
      expect(at[0]).toBeCloseTo(looped[0]);
      expect(at[1]).toBe(target.center[1]);
      expect(at[2]).toBe(target.center[2]);
    }
  });

  test("keeps the full moving path in the open lane without intersecting cover", () => {
    const map = createFiringRangeMap();
    for (const target of RANGE_MOVING_TARGETS) {
      const period = 4 * target.halfTravel / target.speed;
      for (let sample = 0; sample <= 40; sample++) {
        const pos = movingRangeTargetPosition(target, period * sample / 40);
        expect(Math.abs(pos[0])).toBeLessThan(11);
        const feet: [number, number, number] = [pos[0], pos[1] + PLAYER_HEIGHT / 2, pos[2]];
        for (const cover of map.cover) {
          const [hx, hy, hz] = cover.size;
          const intersects = Math.abs(feet[0] - cover.pos[0]) < hx + 0.45 &&
            Math.abs(feet[1] - cover.pos[1]) < hy + PLAYER_HEIGHT / 2 &&
            Math.abs(feet[2] - cover.pos[2]) < hz + 0.45;
          expect(intersects).toBe(false);
        }
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
