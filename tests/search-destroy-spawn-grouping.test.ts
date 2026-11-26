import { describe, expect, test } from "bun:test";
import { getMap } from "../src/lib/game-protocol";
import { chooseSpawn } from "../src/lib/spawn-selection";

describe("Search & Destroy squad deployment", () => {
  test("teammates use the same tight spawn cluster instead of spreading across the map", () => {
    const base = getMap("dustwater", "searchdestroy");
    const map: typeof base = {
      ...base,
      cover: [],
      environment: [],
      props: [],
      spawns: {
        ...base.spawns,
        red: [[0, 0, 0], [4, 0, 0], [8, 0, 0], [80, 0, 0], [84, 0, 0], [88, 0, 0]] as typeof base.spawns.red,
      },
    };
    const room = {};
    const first = chooseSpawn(room, map, "red", [], 100, () => 0, "searchdestroy");
    const second = chooseSpawn(room, map, "red", [{ pos: first, team: "red" }], 101, () => 0, "searchdestroy");
    expect(first[0]).toBeLessThan(20);
    expect(second[0]).toBeLessThan(20);
    expect(Math.hypot(first[0] - second[0], first[2] - second[2])).toBeGreaterThanOrEqual(4);
  });
});
