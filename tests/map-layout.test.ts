import { describe, expect, test } from "bun:test";
import { MAP_LIST, type MapDef } from "../src/lib/game-protocol";
import { TACTICAL_COVER, OUTER_SPAWNS } from "../src/lib/map-tactics";
import { makeEnvironmentMap } from "../src/lib/dynamic-environment";
import { botPositionEmbedded } from "../src/lib/bot-physics";

describe("authored map combat layouts", () => {
  test("all six maps have dedicated tactical cover and playable outer spawns", () => {
    expect(MAP_LIST).toHaveLength(6);
    for (const map of MAP_LIST) {
      expect(TACTICAL_COVER[map.id].length).toBeGreaterThanOrEqual(16);
      expect(OUTER_SPAWNS[map.id].ffa.length).toBeGreaterThanOrEqual(6);
      expect(OUTER_SPAWNS[map.id].red.length).toBeGreaterThanOrEqual(3);
      expect(OUTER_SPAWNS[map.id].blue.length).toBeGreaterThanOrEqual(3);
    }
  });

  test("every new spawn has solid-cover and hazard clearance", () => {
    for (const map of MAP_LIST) {
      const collision = makeEnvironmentMap(map).cover;
      for (const [team, points] of Object.entries(OUTER_SPAWNS[map.id])) {
        for (const point of points) {
          expect(Math.abs(point[0])).toBeLessThan(map.size - 2);
          expect(Math.abs(point[2])).toBeLessThan(map.size - 2);
          expect(botPositionEmbedded(collision, point)).toBe(false);
          for (const env of map.environment ?? []) {
            if (env.type !== "fire" && env.type !== "spikes") continue;
            const overlaps = Math.abs(point[0] - env.pos[0]) < env.size[0] + 1.1 &&
              Math.abs(point[2] - env.pos[2]) < env.size[2] + 1.1 &&
              Math.abs(point[1] - env.pos[1]) < 2;
            expect(overlaps).toBe(false);
          }
        }
      }
    }
  });

  test("destructible doors have actual flanking partitions and stable IDs", () => {
    const ids = new Set<string>();
    for (const map of MAP_LIST) {
      const doors = map.environment?.filter(e => e.type === "destructible_wall") ?? [];
      expect(doors.length).toBeGreaterThanOrEqual(1);
      for (const environment of map.environment ?? []) {
        expect(ids.has(environment.id)).toBe(false);
        ids.add(environment.id);
      }
      for (const door of doors) {
        const barriers = map.cover.filter(box => box.kind === "cover" &&
          Math.abs(box.pos[2] - door.pos[2]) < 2 &&
          Math.abs(box.pos[0] - door.pos[0]) < 14 &&
          box.size[1] >= 1);
        expect(barriers.some(box => box.pos[0] < door.pos[0] - 3)).toBe(true);
        expect(barriers.some(box => box.pos[0] > door.pos[0] + 3)).toBe(true);
      }
    }
  });

  test("hazards do not sit inside ground spawns", () => {
    for (const map of MAP_LIST) {
      for (const team of ["ffa","red","blue"] as const) {
        for (const pos of map.spawns[team]) {
          for (const env of map.environment ?? []) {
            if (env.type !== "fire" && env.type !== "spikes") continue;
            const groundHazard = Math.abs(pos[1] - env.pos[1]) < 2;
            const intersects = Math.abs(pos[0]-env.pos[0]) < env.size[0] + 0.7 &&
              Math.abs(pos[2]-env.pos[2]) < env.size[2] + 0.7;
            expect(groundHazard && intersects).toBe(false);
          }
        }
      }
    }
  });

  test("cover bounds and environments have finite authored coordinates", () => {
    for (const map of MAP_LIST) {
      for (const cover of map.cover) {
        for (const n of [...cover.pos,...cover.size]) expect(Number.isFinite(n)).toBe(true);
        for (const n of cover.size) expect(n).toBeGreaterThan(0);
      }
      for (const o of map.environment ?? []) {
        for (const n of [...o.pos,...o.size]) expect(Number.isFinite(n)).toBe(true);
        if (o.type === "jump_pad") expect(o.launch[1]).toBeGreaterThan(10);
      }
    }
  });
});
