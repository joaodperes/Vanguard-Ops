import { describe, expect, test } from "bun:test";
import { footstepVolumeAtDistance } from "../src/lib/sound";
import { perkById, perkUnlocked } from "../src/lib/perks";

describe("world-space footstep audio", () => {
  test("a footstep gets quieter with distance and silent beyond hearing range", () => {
    const near = footstepVolumeAtDistance(2);
    const medium = footstepVolumeAtDistance(15);
    const far = footstepVolumeAtDistance(30);
    expect(near).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
    expect(footstepVolumeAtDistance(38)).toBe(0);
    expect(footstepVolumeAtDistance(500)).toBe(0);
    expect(footstepVolumeAtDistance(Number.NaN)).toBe(0);
  });

  test("sprinting is louder than walking at the same distance", () => {
    expect(footstepVolumeAtDistance(12, true))
      .toBeGreaterThan(footstepVolumeAtDistance(12));
  });

  test("water steps are quieter than dry steps at the same distance", () => {
    for (const sprinting of [false, true]) {
      const dry=footstepVolumeAtDistance(10,sprinting);
      const wet=footstepVolumeAtDistance(10,sprinting,true);
      expect(wet).toBeGreaterThan(0);
      expect(wet).toBeLessThan(dry);
      expect(wet/dry).toBeCloseTo(.8);
      expect(footstepVolumeAtDistance(38,sprinting,true)).toBe(0);
    }
  });

  test("Silent Steps is earned at level 31 and silences steps only", () => {
    expect(perkById("silent_steps").unlockLevel).toBe(31);
    expect(perkUnlocked("silent_steps", 30)).toBe(false);
    expect(perkUnlocked("silent_steps", 31)).toBe(true);
    expect(perkById("silent_steps").description.toLowerCase()).toContain("footstep");
  });
});
