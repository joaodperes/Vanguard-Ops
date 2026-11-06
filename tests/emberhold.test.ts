import { describe, expect, test } from "bun:test";
import { getMap, type Vec3 } from "../src/lib/game-protocol";
import { botGroundHeight } from "../src/lib/bot-physics";
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

  test("both sides of every bridge and the four stair routes are navigable", () => {
    const routes: [Vec3, Vec3][] = [...crossings,
      [[-50.25, 5, -23], [-50.25, 12, -40]], [[50.25, 5, 23], [50.25, 12, 40]],
      [[0, 5, -18], [0, 8, -7]], [[0, 5, 16], [0, 8, 5]],
    ];
    for (const [start, end] of routes) {
      expect(botTraversableEdge(start, end[0], end[2], map.cover, map.environment)).toBe(end[1]);
      expect(botTraversableEdge(end, start[0], start[2], map.cover, map.environment)).toBe(start[1]);
    }
    expect(botEntersHazard(map.cover, map.environment, [0, 5, 49], [0, 5, 52], 0)).toBe(false);
  });
});
