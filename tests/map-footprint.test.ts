import { describe, expect, test } from "bun:test";
import { MAP_LIST, MAPS } from "../src/lib/game-protocol";
import { MAP_FOOTPRINT, applyMapFootprint } from "../src/lib/map-footprint";
import type { MapDef } from "../src/lib/game-protocol";

describe("map footprint variety", () => {
  test("has real physical scale and pace categories, not just labels", () => {
    const compact = MAP_LIST.filter(m => MAP_FOOTPRINT[m.id].pace === "compact");
    const balanced = MAP_LIST.filter(m => MAP_FOOTPRINT[m.id].pace === "balanced");
    const tactical = MAP_LIST.filter(m => MAP_FOOTPRINT[m.id].pace === "tactical");
    expect(compact).toHaveLength(2);
    expect(balanced).toHaveLength(2);
    expect(tactical).toHaveLength(2);
    expect(Math.max(...compact.map(m => m.size))).toBeLessThan(Math.min(...balanced.map(m => m.size)));
    expect(Math.max(...balanced.map(m => m.size))).toBeLessThan(Math.min(...tactical.map(m => m.size)));
  });

  test("a compact map has smaller walls, cover, spawn distances and hazards together", () => {
    for (const map of MAP_LIST) {
      expect(map.size * 2).toBeGreaterThan(90);
      expect(map.size * 2).toBeLessThan(500);
      for (const cover of map.cover) {
        expect(Math.abs(cover.pos[0])).toBeLessThanOrEqual(map.size + 0.01);
        expect(Math.abs(cover.pos[2])).toBeLessThanOrEqual(map.size + 0.01);
      }
      for (const positions of Object.values(map.spawns)) {
        for (const sp of positions) {
          expect(Math.abs(sp[0])).toBeLessThan(map.size - 1);
          expect(Math.abs(sp[2])).toBeLessThan(map.size - 1);
        }
      }
      for (const obj of map.environment ?? []) {
        expect(Math.abs(obj.pos[0])).toBeLessThan(map.size);
        expect(Math.abs(obj.pos[2])).toBeLessThan(map.size);
      }
    }
  });

  test("map scaling retains elevation and input maps are not mutated", () => {
    const base: MapDef = {
      ...MAPS.compound,
      size: 10,
      cover: [{ pos: [3, 2, 4], size: [1, 2, 1], kind: "platform" }],
      spawns: { ffa: [[2, 0, 4]], red: [[-2, 0, 0]], blue: [[2, 0, 0]] },
      environment: [{ id: "test", type: "jump_pad", pos: [2, 0, 2], size: [1, 0.2, 1], launch: [5, 10, -5] }],
      lights: [],
    };
    const scaled = applyMapFootprint(base);
    const factor = MAP_FOOTPRINT.compound.scale;
    expect(scaled.size).toBeCloseTo(10 * factor);
    expect(scaled.cover[0].pos[1]).toBe(2);
    expect(scaled.cover[0].size[1]).toBe(2);
    expect(scaled.cover[0].pos[0]).toBeCloseTo(3 * factor);
    expect(scaled.spawns.ffa[0][2]).toBeCloseTo(4 * factor);
    const jump = scaled.environment?.[0];
    expect(jump?.type).toBe("jump_pad");
    if (jump?.type === "jump_pad") expect(jump.launch[0]).toBeCloseTo(5 * factor);
    expect(base.cover[0].pos[0]).toBe(3);
    expect(base.spawns.ffa[0][2]).toBe(4);
  });
  test("connected districts give large maps genuinely massive irregular footprints", () => {
    for (const map of MAP_LIST) {
      expect(map.regions?.length ?? 0).toBeGreaterThanOrEqual(3);
      const r=map.regions!;
      const boundary=map.cover.filter(c=>c.kind==="solid");
      expect(boundary.length).toBeGreaterThan(4);
      const coveredArea=r.reduce((area,v)=>area+v.w*v.d,0);
      expect(coveredArea).toBeLessThan((2*map.size)**2 * 0.87);
    }
    for (const id of ["skybridge","arena_neon"] as const) {
      expect(MAPS[id].size * 2).toBeGreaterThan(380);
      expect(MAPS[id].spawns.ffa.some(p=>Math.abs(p[0])>140||Math.abs(p[2])>140)).toBe(true);
      expect(MAPS[id].cover.some(c=>c.kind==="platform" && (Math.abs(c.pos[0])>90||Math.abs(c.pos[2])>90))).toBe(true);
    }
  });

});
