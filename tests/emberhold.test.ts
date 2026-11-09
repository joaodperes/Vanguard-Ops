import { describe, expect, test } from "bun:test";
import { getMap, type Vec3 } from "../src/lib/game-protocol";
import { botAirStep, botGroundHeight, botHasJumpClearance } from "../src/lib/bot-physics";
import { botEntersHazard, botTraversableEdge } from "../src/lib/bot-routing";
import { lavaAt, makeEnvironmentMap } from "../src/lib/dynamic-environment";
import { MAP_DOCUMENTS } from "../src/lib/map-documents";
import { importMapDocuments } from "../src/lib/map-document-io";
import { featureBoxes, resolveStairAttachments } from "../src/lib/map-blueprints";
import { chooseSpawn, spawnClear } from "../src/lib/spawn-selection";

const map = makeEnvironmentMap(getMap("emberhold"));
const crossings: [Vec3, Vec3][] = [
  [[0, 5, 40], [0, 5, 72]],
  [[-26, 5, -39], [-26, 5, -72]],
  [[48, 5, -12], [82, 5, -12]],
  [[-48, 5, 18], [-82, 5, 18]],
];

describe("Emberhold Castle", () => {
  test("dungeon bots cannot jump or launch upward through the courtyard ceiling",()=>{
    const crypt:Vec3=[-24,.5,1];
    const underside=4; // keep-paving-0 above the crypt.
    expect(botHasJumpClearance(map.cover,crypt)).toBe(false);
    let pos:Vec3=[...crypt],velocity=11;
    let impacted=false;
    for(let tick=0;tick<28;tick++){
      const step=botAirStep(map.cover,pos,0,velocity/20,0);
      pos=step.pos;
      impacted ||= step.hitCeiling;
      velocity=step.hitCeiling?0:velocity-22/20;
      expect(pos[1]+1.8).toBeLessThanOrEqual(underside+.00001);
    }
    expect(impacted).toBe(true);
    expect(botAirStep(map.cover,[150,.5,150],0,1.5,0).hitCeiling).toBe(false);
  });
  test("the map document preserves the complete authored geometry and lava", () => {
    const doc = MAP_DOCUMENTS.emberhold;
    const { documents } = importMapDocuments(doc, {}, doc.id);
    expect(documents.emberhold).toEqual(doc);
    const compiled = new Set(map.cover.map(box => JSON.stringify(box)));
    for (const feature of resolveStairAttachments(doc.blueprint.features)) {
      for (const box of featureBoxes(feature)) expect(compiled.has(JSON.stringify(box))).toBe(true);
    }
    expect(map.environment?.filter(o => o.type === "lava")).toHaveLength(4);
  });

  test("outer stair walls have collision-open loopholes and larger landing windows", () => {
    // Probe the actual compiled map: a cosmetic texture cutout would fail.
    const openings: {point: Vec3; sill: number; lintel: number}[] = [
      {point: [-11.5, 8.3, -7.5], sill: 7.0, lintel: 9.65},
      {point: [-11.5, 14.0, 0.4], sill: 12.8, lintel: 15.4},
      {point: [-11.5, 22.0, 7.4], sill: 20.9, lintel: 23.2},
      {point: [11.5, 13.0, -7.4], sill: 11.95, lintel: 14.25},
      {point: [11.5, 16.0, 0.3], sill: 14.9, lintel: 17.3},
      {point: [11.5, 18.2, 7.3], sill: 17.2, lintel: 19.5},
      {point: [-7.5, 9.1, -11.5], sill: 8.0, lintel: 10.3},
      {point: [0.4, 13.0, -11.5], sill: 11.7, lintel: 14.3},
      {point: [-1.7, 22.0, 11.5], sill: 21.0, lintel: 23.4},
      {point: [7, 18.1, 11.5], sill: 17.0, lintel: 19.4},
    ];
    const stoneAt = ([x, y, z]: Vec3) => map.cover.some(box =>
      box.kind === "cover" &&
      Math.abs(x - box.pos[0]) < box.size[0] - 0.001 &&
      Math.abs(y - box.pos[1]) < box.size[1] - 0.001 &&
      Math.abs(z - box.pos[2]) < box.size[2] - 0.001
    );
    for (const {point, sill, lintel} of openings) {
      expect(stoneAt(point)).toBe(false);
      expect(stoneAt([point[0], sill, point[2]])).toBe(true);
      expect(stoneAt([point[0], lintel, point[2]])).toBe(true);
    }
  });

  test("keep corner gaps have masonry above their doorways instead of open shafts to the roof", () => {
    // Probe compiled collision rather than a cosmetic wall: projectile rays
    // and character movement must both see the new stone.
    const stoneAt = ([x, y, z]: Vec3) => map.cover.some(box =>
      box.kind === "cover" &&
      Math.abs(x - box.pos[0]) < box.size[0] - 0.001 &&
      Math.abs(y - box.pos[1]) < box.size[1] - 0.001 &&
      Math.abs(z - box.pos[2]) < box.size[2] - 0.001
    );
    const masonry = MAP_DOCUMENTS.emberhold.blueprint.features.filter(f =>
      f.id.startsWith("donjon-wall-") && f.id.includes("-entry-"));
    expect(masonry).toHaveLength(3);
    // South: 5-unit high ground-level entry with stone all the way to the roof.
    for (const y of [5.5, 7, 9.8]) expect(stoneAt([-8, y, 11.5])).toBe(false);
    for (const y of [10.2, 16, 22, 24.5]) expect(stoneAt([-8, y, 11.5])).toBe(true);
    // North: the rear stair arrives at y=15. Keep headroom for jumping,
    // but close the gap both under the landing and above its doorway.
    for (const y of [6, 12.5, 20.2, 24.5]) expect(stoneAt([8, y, -11.5])).toBe(true);
    for (const y of [13.5, 15.5, 18, 19.8]) expect(stoneAt([8, y, -11.5])).toBe(false);
    // Neither the ground entrance nor the rear-stair access is blocked.
    expect(botTraversableEdge([-8, 5, 14], -8, 8, map.cover, map.environment)).toBe(5);
    expect(botTraversableEdge([8, 5, -32], 8, -8, map.cover, map.environment)).toBe(15);
  });

  test("stair parapet merlons run along all four outer keep walls", () => {
    const merlons = MAP_DOCUMENTS.emberhold.blueprint.features.filter(f =>
      f.id.startsWith("donjon-outer-merlon-"));
    expect(merlons).toHaveLength(24);
    expect(merlons.every(f => f.kind === "cover" && f.y === 25 && f.h >= 1.4)).toBe(true);
    for (const face of ["west", "east", "north", "south"]) {
      expect(merlons.some(f => f.id.startsWith(`donjon-outer-merlon-${face}-`))).toBe(true);
    }
    // Existing keep ascent is still navigable from both directions.
    expect(botTraversableEdge([-8, 10, -8], 8, -8, map.cover, map.environment)).toBe(15);
    expect(botTraversableEdge([8, 20, 8], -8, 8, map.cover, map.environment)).toBe(25);
  });

  test("a full 32-player lobby has distinct spawns on safe, supported ground", () => {
    for (const point of map.spawns.ffa) {
      expect(spawnClear(map, point)).toBe(true);
      expect(botGroundHeight(map.cover, point[0], point[2], point[1])).toBe(point[1]);
    }
    const occupants: { pos: Vec3; team: string }[] = [];
    const room = {};
    for (let slot = 0; slot < 32; slot++) {
      occupants.push({ pos: chooseSpawn(room, map, "ffa", occupants, 0, () => 0), team: "ffa" });
    }
    expect(new Set(occupants.map(p => p.pos.join(","))).size).toBe(32);
  });

  test("lava contact uses the surface height and the same footprint on all four sides", () => {
    for (const [x, z] of [[24, 60], [24, -60], [70, 5], [-70, 5]]) {
      expect(lavaAt(map.environment, [x, 0.05, z])).toBe(true);
      expect(lavaAt(map.environment, [x, 0.06, z])).toBe(false);
      expect(spawnClear(map, [x, 0, z])).toBe(false);
    }
    expect(lavaAt(map.environment, [79, 0, 50])).toBe(true);
    expect(lavaAt(map.environment, [79.01, 0, 50])).toBe(false);
    expect(lavaAt(map.environment, [0, 0, 0])).toBe(false);
    expect(botEntersHazard(map.cover, map.environment, [24, 5, 49], [24, 5, 52], 0)).toBe(true);
    expect(botTraversableEdge([24, 5, 49], 24, 52, map.cover, map.environment)).toBeNull();
  });

  test("surface bridges and corner tower stairs remain navigable", () => {
    const routes: [Vec3, Vec3][] = [...crossings,
      [[-50.25, 5, -23], [-50.25, 12, -40]], [[50.25, 5, 23], [50.25, 12, 40]],
    ];
    for (const [start, end] of routes) {
      expect(botTraversableEdge(start, end[0], end[2], map.cover, map.environment)).toBe(end[1]);
      expect(botTraversableEdge(end, start[0], start[2], map.cover, map.environment)).toBe(start[1]);
    }
    expect(botEntersHazard(map.cover, map.environment, [0, 5, 49], [0, 5, 52], 0)).toBe(false);
  });
  test("wall walks, both keep approaches and all dungeon entrances have two-way routes", () => {
    const routes: Record<string, Vec3[]> = {
      battlements: [[-54,12,-43],[54,12,-43],[54,12,43],[-54,12,43],[-54,12,-43]],
      keepEntrance: [[-8,5,14],[-8,5,8]],
      spiral: [[7,.5,8],[-8,5,8],[-8,10,-8],[8,15,-8],[8,20,8],[-8,25,8],[-8,25,0]],
      rearStair: [[8,5,-32],[8,15,-8]],
      keepDungeon: [[7,.5,8],[7,.5,16],[-6,.5,16]],
      westDungeon: [[-94,5,27],[-80.5,.5,27],[-80.5,.5,18],[-6,.5,18],[-6,.5,24],[-6,5,39]],
      eastDungeon: [[94,5,-3],[80.5,.5,-3],[80.5,.5,-12],[7,.5,-12],[7,.5,16],[-6,.5,16],[-6,.5,24],[-6,5,39]],
    };
    for (const [name, points] of Object.entries(routes)) {
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i];
        expect(botTraversableEdge(a, b[0], b[2], map.cover, map.environment), name).toBe(b[1]);
        expect(botTraversableEdge(b, a[0], a[2], map.cover, map.environment), name).toBe(a[1]);
      }
    }
    expect(lavaAt(map.environment, [-70,.5,18])).toBe(false);
    expect(lavaAt(map.environment, [-70,0,18])).toBe(true);
    expect(botTraversableEdge([-8,5,8], -16, 8, map.cover, map.environment)).toBeNull();
  });

});
