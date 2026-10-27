import { describe, expect, test } from "bun:test";
import { MAP_LIST } from "../src/lib/game-protocol";
import { cityCoverKey, hiddenCityColliderKeys } from "../src/lib/city-render-colliders";
import { cityBandstandBoxes, cityBuildingBoxes, cityInteriorFixtures, type MapProp } from "../src/lib/map-visuals";

describe("City detail meshes do not compete with collision proxies", () => {
  const house: MapProp = {
    kind: "building", x: 15, z: 27, w: 22, d: 24, h: 6.5,
    use: "house", shape: "rect", roofAccess: true,
  };

  test("only detailed furniture colliders are hidden, not walls, roof or stairs", () => {
    const boxes = cityBuildingBoxes(house);
    const fixtureCount = cityInteriorFixtures(house).length;
    expect(fixtureCount).toBeGreaterThan(0);
    const hidden = hiddenCityColliderKeys([house]);
    for (const box of boxes.slice(-fixtureCount)) expect(hidden.has(cityCoverKey(box))).toBe(true);
    for (const box of boxes.slice(0, -fixtureCount)) expect(hidden.has(cityCoverKey(box))).toBe(false);
  });

  test("rotated building fixture footprints are masked consistently", () => {
    const rotated: MapProp = { ...house, x: -25, z: 31, w: 24, d: 22, turns: 1 };
    const localW = rotated.d!;
    const localD = rotated.w!;
    const count = cityInteriorFixtures({ ...rotated, w: localW, d: localD }).length;
    expect(count).toBeGreaterThan(0);
    const collisions = cityBuildingBoxes(rotated);
    const hidden = hiddenCityColliderKeys([rotated]);
    for (const box of collisions.slice(-count)) expect(hidden.has(cityCoverKey(box))).toBe(true);
    expect(hidden.has(cityCoverKey(collisions[0]))).toBe(false);
  });

  test("bandstand columns use detailed meshes but stairs remain rendered", () => {
    const bandstand: MapProp = { kind: "bandstand", x: 8, z: -10, w: 16, d: 16, h: 5 };
    const boxes = cityBandstandBoxes(bandstand);
    const hidden = hiddenCityColliderKeys([bandstand]);
    for (const box of boxes.slice(-4)) expect(hidden.has(cityCoverKey(box))).toBe(true);
    for (const box of boxes.slice(0, -4)) expect(hidden.has(cityCoverKey(box))).toBe(false);
  });

  test("the city maps contain actual hidden detail proxies without changing collision", () => {
    const cities = MAP_LIST.filter(m => m.biome === "city" || m.biome === "city_day");
    expect(cities.length).toBeGreaterThan(0);
    for (const map of cities) {
      const keys = hiddenCityColliderKeys(map.props ?? []);
      expect(keys.size).toBeGreaterThan(0);
      const hiddenCount = map.cover.filter(c => keys.has(cityCoverKey(c))).length;
      expect(hiddenCount).toBeGreaterThan(0);
      // The physics cover is untouched; only its duplicate draw calls are masked.
      expect(map.cover.length).toBeGreaterThan(hiddenCount);
    }
  });
});
