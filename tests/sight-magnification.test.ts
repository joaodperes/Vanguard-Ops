import { describe, expect, test } from "bun:test";
import { SIGHT_DEFS, ATTACHMENTS, adsFieldOfView, sightDefForAttachments } from "../src/lib/game-data";

describe("true sight magnification", () => {
  test("Hunter 2x, ACOG 4x and Thermal 6x match catalog attachment labels", () => {
    for (const [id, type, zoom] of [
      ["sight_hunter", "hunter", 2],
      ["sight_acog", "acog", 4],
      ["sight_thermal", "thermal", 6],
    ] as const) {
      const attachment = ATTACHMENTS.find(a => a.id === id);
      expect(attachment?.name).toContain(`${zoom}x`);
      expect(attachment?.sightType).toBe(type);
      expect(sightDefForAttachments({ sight: id }).zoom).toBe(zoom);
      expect(SIGHT_DEFS[type].zoom).toBe(zoom);
    }
  });
  test("2x, 4x and 6x correspond to real camera magnification at different user FOV settings", () => {
    for (const baseFov of [60, 75, 100]) {
      for (const [type, zoom] of [["hunter", 2], ["acog", 4], ["thermal", 6]] as const) {
        const scoped = adsFieldOfView(baseFov, SIGHT_DEFS[type], 1);
        const magnification = Math.tan(baseFov * Math.PI / 360) /
          Math.tan(scoped * Math.PI / 360);
        expect(magnification).toBeCloseTo(zoom, 6);
        expect(adsFieldOfView(baseFov, SIGHT_DEFS[type], 0)).toBe(baseFov);
        expect(adsFieldOfView(baseFov, SIGHT_DEFS[type], 0.5)).toBeCloseTo((baseFov + scoped) / 2);
      }
      const hunter = adsFieldOfView(baseFov, SIGHT_DEFS.hunter);
      const acog = adsFieldOfView(baseFov, SIGHT_DEFS.acog);
      const thermal = adsFieldOfView(baseFov, SIGHT_DEFS.thermal);
      expect(hunter).toBeGreaterThan(acog);
      expect(acog).toBeGreaterThan(thermal);
    }
  });
  test("1x iron and red dot maintain existing ADS framing", () => {
    expect(adsFieldOfView(75, SIGHT_DEFS.iron)).toBe(75 - SIGHT_DEFS.iron.adsFovReduction);
    expect(adsFieldOfView(75, SIGHT_DEFS.red_dot)).toBe(75 - SIGHT_DEFS.red_dot.adsFovReduction);
  });
});
