import { describe, expect, test } from "bun:test";
import { audioGainLevels, DEFAULT_AUDIO_MIX, EFFECTS_OUTPUT_BOOST, WEAPON_OUTPUT_SCALE } from "../src/lib/audio-mix";

describe("audio mixer without music", () => {
  test("boosts base loudness without changing the slider semantics", () => {
    expect(EFFECTS_OUTPUT_BOOST).toBeGreaterThan(1);
    expect(EFFECTS_OUTPUT_BOOST).toBeLessThan(1.6);
    expect(WEAPON_OUTPUT_SCALE).toBeGreaterThan(0.32);
    // Weapon output was deliberately raised to 0.58 for punchier gunfire.
    expect(WEAPON_OUTPUT_SCALE).toBeLessThan(0.7);
    expect(audioGainLevels({ masterVolume: 100, footstepVolume: 100, fxVolume: 100 }))
      .toEqual({ master: 1, footsteps: 1, fx: 1, weaponOutputPercent: 100 });
  });
  test("keeps master, footsteps, FX and weapon output controls", () => {
    expect(audioGainLevels(DEFAULT_AUDIO_MIX)).toEqual({ master: .8, footsteps: .85, fx: 1, weaponOutputPercent: 80 });
  });
  test("footstep muting never silences combat audio", () => {
    const levels = audioGainLevels({ ...DEFAULT_AUDIO_MIX, footstepVolume: 0 });
    expect(levels.footsteps).toBe(0);
    expect(levels.fx).toBe(1);
    expect(levels.weaponOutputPercent).toBe(80);
  });
  test("FX slider and master volume independently scale weapon audio", () => {
    const levels = audioGainLevels({ masterVolume: 50, footstepVolume: 100, fxVolume: 40 });
    expect(levels.weaponOutputPercent).toBeCloseTo(20);
    expect(levels.fx).toBe(.4);
    expect(levels.master).toBe(.5);
    expect(levels.footsteps).toBe(1);
  });
  test("master mute and clipping faders remain valid", () => {
    expect(audioGainLevels({ masterVolume: 0, footstepVolume: 100, fxVolume: 100 }).weaponOutputPercent).toBe(0);
    expect(audioGainLevels({ masterVolume: 120, footstepVolume: Number.NaN, fxVolume: 140 })).toEqual({
      master: 1, footsteps: 0, fx: 1, weaponOutputPercent: 100,
    });
  });
});
