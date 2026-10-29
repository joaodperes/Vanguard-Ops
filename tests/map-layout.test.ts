import { describe, expect, test } from "bun:test";
import { MAP_LIST } from "../src/lib/game-protocol";
import { MAP_BLUEPRINTS } from "../src/lib/map-blueprints";
import { TACTICAL_COVER, OUTER_SPAWNS } from "../src/lib/map-tactics";
import { MAP_FOOTPRINT } from "../src/lib/map-footprint";
import { makeEnvironmentMap } from "../src/lib/dynamic-environment";
import { botPositionEmbedded } from "../src/lib/bot-physics";

describe("authored map combat layouts", () => {
  test("all nine maps have dedicated tactical cover and playable spawns", () => {
    expect(MAP_LIST).toHaveLength(9);
    for (const map of MAP_LIST) {
      if(map.id==="floodgate"){
        expect(MAP_BLUEPRINTS.maps.floodgate.features.length).toBeGreaterThanOrEqual(80);
        expect(map.spawns.ffa).toHaveLength(32);
        expect(map.spawns.red).toHaveLength(16);
        expect(map.spawns.blue).toHaveLength(16);
        continue;
      }
      expect(TACTICAL_COVER[map.id].length).toBeGreaterThanOrEqual(16);
      expect(OUTER_SPAWNS[map.id].ffa.length).toBeGreaterThanOrEqual(6);
      expect(OUTER_SPAWNS[map.id].red.length).toBeGreaterThanOrEqual(3);
      expect(OUTER_SPAWNS[map.id].blue.length).toBeGreaterThanOrEqual(3);
    }
  });

  test("every new spawn has solid-cover and hazard clearance", () => {
    for (const map of MAP_LIST) {
      const collision = makeEnvironmentMap(map).cover;
      for (const team of ["ffa", "red", "blue"] as const) {
        if(map.id==="forest_warfare") {
          for(const point of map.spawns[team]) expect(botPositionEmbedded(collision,point)).toBe(false);
          continue;
        }
        if(map.id==="skybridge"||map.id==="floodgate"){
          // Ridgefall's old outdoor spawn coordinates were deliberately removed.
          // The compiled factory must use only the new indoor JSON spawn set.
          expect(map.spawns[team]).toEqual(MAP_BLUEPRINTS.maps[map.id].spawns[team]);
          for(const point of map.spawns[team])expect(botPositionEmbedded(collision,point)).toBe(false);
          continue;
        }
        const authored = OUTER_SPAWNS[map.id === "terminal" ? "arena_neon" : map.id][team];
        // MAP_LIST already scales every spawn, wall and hazard together.
        // Check the *actual* appended spawn positions, not unscaled design
        // coordinates against the compact/tactical arena bounds.
        // Afterlight expands its city spawn pool; inherited outer spawns remain
        // valid but no longer necessarily appear at the end of the list.
        const points = (map.id==="arena_neon"||map.id==="terminal")
          ? authored.map(design=>{
              const factor=MAP_FOOTPRINT[map.id].scale;
              const found=map.spawns[team].find(point=>
                Math.abs(point[0]-design[0]*factor)<.005&&
                Math.abs(point[2]-design[2]*factor)<.005);
              if(!found)throw new Error(`${map.id} missing inherited outer spawn ${design}`);
              return found;
            })
          : map.spawns[team].slice(-authored.length);
        expect(points).toHaveLength(authored.length);
        for (let i = 0; i < points.length; i++) {
          const point = points[i];
          const design = authored[i];
          const factor = MAP_FOOTPRINT[map.id].scale;
          expect(point[0]).toBeCloseTo(design[0] * factor, 2);
          expect(point[2]).toBeCloseTo(design[2] * factor, 2);
          expect(point[1]).toBe(design[1]);
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

  test("all player and bot spawns avoid blocking cover", () => {
    for (const map of MAP_LIST) {
      const collision = makeEnvironmentMap(map).cover;
      for (const points of Object.values(map.spawns)) {
        for (const point of points) {
          expect(botPositionEmbedded(collision, point)).toBe(false);
        }
      }
    }
  });

  test("destructible doors have actual flanking partitions and stable IDs", () => {
    const ids = new Set<string>();
    for (const map of MAP_LIST) {
      const doors = map.environment?.filter(e => e.type === "destructible_wall") ?? [];
      if (map.id === "arena_neon" || map.id === "terminal" || map.id === "forest_warfare") {
        expect(doors).toHaveLength(0);
        expect(map.environment?.length ?? 0).toBe(0);
        continue;
      }
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
        // The breach should matter: no gap wide enough to walk through
        // before its central destructible panel is removed.
        const left = barriers.filter(box => box.pos[0] < door.pos[0] - 3)
          .reduce((edge,box) => Math.max(edge, box.pos[0] + box.size[0]), -Infinity);
        const right = barriers.filter(box => box.pos[0] > door.pos[0] + 3)
          .reduce((edge,box) => Math.min(edge, box.pos[0] - box.size[0]), Infinity);
        expect(door.pos[0] - door.size[0] - left).toBeLessThan(0.9);
        expect(right - (door.pos[0] + door.size[0])).toBeLessThan(0.9);
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

  test("every staircase crest joins a reachable-height roof or walkway", () => {
    for (const map of MAP_LIST) {
      const steps = map.cover.filter(box => box.kind === "stair");
      let crests = 0;
      for (const box of steps) {
        const top = box.pos[1] + box.size[1];
        const higherNeighbour = steps.some(other => other !== box &&
          other.pos[1] + other.size[1] > top + 0.15 &&
          other.pos[1] + other.size[1] < top + 0.7 &&
          Math.hypot(other.pos[0] - box.pos[0], other.pos[2] - box.pos[2]) < 2.1);
        if (higherNeighbour) continue;
        crests++;
        const supported = map.cover.some(support => support.kind !== "stair" && support.kind !== "accent" &&
          Math.abs(support.pos[1] + support.size[1] - top) < 0.65 &&
          Math.hypot(
            Math.max(0, Math.abs(support.pos[0] - box.pos[0]) - support.size[0]),
            Math.max(0, Math.abs(support.pos[2] - box.pos[2]) - support.size[2]),
          ) < 1.1);
        expect(supported).toBe(true);
      }
      expect(crests).toBeGreaterThan(0);
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
