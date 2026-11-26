import { describe, expect, test } from "bun:test";
import dustwater from "../src/data/maps/dustwater.json";
import { cityBuildingBoxes, cityHasUsableInteriorStairs, cityFixtureMaterial } from "../src/lib/map-visuals";
import { featureBoxes, type MapFeature } from "../src/lib/map-blueprints";
import type { MapProp } from "../src/lib/map-theme-contract";

describe("Dustwater building access and rooftops", () => {
  const buildings = dustwater.theme.props.filter(p => p.kind === "building") as unknown as MapProp[];

  test("accessible roofs have destructible timber parapets and a stair landing opening", () => {
    expect(buildings.length).toBeGreaterThan(0);
    for (const building of buildings) {
      if (!building.roofAccess) continue;
      const boxes = cityBuildingBoxes(building);
      const parapets = boxes.filter(box => box.ballisticId?.includes("city:roof-parapet:"));
      expect(parapets.length).toBeGreaterThanOrEqual(5);
      expect(parapets.every(box => box.material === "thin_wood")).toBe(true);
      const side = building.stairSide === "east" ? 1 : -1;
      const q = (((building.turns ?? 0) % 4) + 4) % 4, odd = q % 2 === 1;
      const w = odd ? (building.d ?? 20) : (building.w ?? 20);
      const d = odd ? (building.w ?? 20) : (building.d ?? 20);
      const cos = [1,0,-1,0][q], sin = [0,1,0,-1][q];
      const lx = side * (w / 2 + .95), lz = -d / 2 + 3.2;
      const x = building.x + cos * lx + sin * lz;
      const z = building.z - sin * lx + cos * lz;
      expect(boxes.some(box => box.kind === "platform" &&
        Math.abs(box.pos[0] - x) < .01 && Math.abs(box.pos[2] - z) < .01)).toBe(true);
      const wallLocalX = side * w / 2, wallLocalZ = -d / 2 + 3.2;
      const wallX = building.x + cos * wallLocalX + sin * wallLocalZ;
      const wallZ = building.z - sin * wallLocalX + cos * wallLocalZ;
      expect(parapets.some(box => Math.abs(wallX - box.pos[0]) < box.size[0] + .45 &&
        Math.abs(wallZ - box.pos[2]) < box.size[2] + .45)).toBe(false);
    }
  });

  test("authored saloon and bank stair entrances and upper-floor hatches are clear", () => {
    const clearAt = (boxes: ReturnType<typeof featureBoxes>, x: number, z: number, radius = .45) =>
      !boxes.some(box => Math.abs(x - box.pos[0]) < box.size[0] + radius &&
        Math.abs(z - box.pos[2]) < box.size[2] + radius);
    const saloonWalls = authoredFeatures.filter(f => f.id.startsWith("saloon-south-wall")).flatMap(featureBoxes);
    const bankWalls = authoredFeatures.filter(f => f.id.startsWith("bank-south-wall")).flatMap(featureBoxes);
    expect(clearAt(saloonWalls, -18, -8)).toBe(true);
    expect(clearAt(bankWalls, -19, 32)).toBe(true);
    const saloonDeck = authoredFeatures.filter(f => f.id.startsWith("saloon-second-floor") && f.kind === "platform").flatMap(featureBoxes);
    const bankDeck = authoredFeatures.filter(f => f.id.startsWith("bank-second-floor") && f.kind === "platform").flatMap(featureBoxes);
    expect(clearAt(saloonDeck, -18, -15)).toBe(true);
    expect(clearAt(bankDeck, -19, 25)).toBe(true);
  });

  test("ordinary interior decoration is destructible wood", () => {
    const timberStyles = ["partition","bed","sofa","table","pew","altar","lectern","display","exam_bed"] as const;
    expect(timberStyles.every(style => cityFixtureMaterial(style) === "thin_wood")).toBe(true);
    expect(cityFixtureMaterial("oven")).toBe("reinforced");
  });

  test("interior stair entrances are clear through the front wall", () => {
    for (const building of buildings) {
      if (!building.roofAccess || !cityHasUsableInteriorStairs(building)) continue;
      const q = (((building.turns ?? 0) % 4) + 4) % 4, odd = q % 2 === 1;
      const w = odd ? (building.d ?? 20) : (building.w ?? 20);
      const d = odd ? (building.w ?? 20) : (building.d ?? 20);
      const cos = [1,0,-1,0][q], sin = [0,1,0,-1][q];
      const lx = w / 2 - 2.8, lz = d / 2;
      const x = building.x + cos * lx + sin * lz;
      const z = building.z - sin * lx + cos * lz;
      const blockers = cityBuildingBoxes(building).filter(box =>
        box.kind === "cover" && box.pos[1] - box.size[1] < 1.8 &&
        box.pos[1] + box.size[1] > 0 &&
        Math.abs(x - box.pos[0]) < box.size[0] + .45 &&
        Math.abs(z - box.pos[2]) < box.size[2] + .45);
      expect(blockers).toEqual([]);
    }
  });
});

const authoredFeatures = dustwater.blueprint.features as unknown as MapFeature[];

describe("Dustwater church tower ladder", () => {
  const features = authoredFeatures;
  const ladder = features.find(f => f.id === "church-tower-stairs") as unknown as MapFeature;
  const roof = features.filter(f => f.id.startsWith("church-tower-platform-")) as unknown as MapFeature[];

  test("ladder collision rises to the taller tower roof in narrow vertical steps", () => {
    expect(ladder).toBeDefined();
    expect(ladder.w).toBeLessThan(1.5);
    expect(ladder.d).toBeLessThan(1);
    expect(ladder.h).toBeGreaterThanOrEqual(8.5);
    const treads = featureBoxes(ladder);
    expect(treads.length).toBeGreaterThanOrEqual(20);
    expect(Math.max(...treads.map(box => box.pos[1] + box.size[1]))).toBeCloseTo(15, 4);
  });

  test("top landing keeps a square opening around the ladder", () => {
    expect(roof.length).toBe(4);
    const topBoxes = roof.flatMap(feature => featureBoxes(feature));
    const blocked = topBoxes.some(box =>
      Math.abs(18 - box.pos[0]) < box.size[0] + .45 &&
      Math.abs(-15 - box.pos[2]) < box.size[2] + .45);
    expect(blocked).toBe(false);
    const parapets = features.filter(f => f.id.startsWith("church-tower-roof-parapet-"));
    expect(parapets).toHaveLength(4);
    expect(parapets.every(f => f.kind === "cover" && f.material === "thin_wood")).toBe(true);
  });
});
