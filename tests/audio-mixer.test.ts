import { describe, expect, test } from "bun:test";
import { audioGainLevels, DEFAULT_AUDIO_MIX } from "../src/lib/audio-mix";

describe("independent audio mixer", () => {
  test("the default master volume scales each category but preserves its fader", () => {
    const levels = audioGainLevels(DEFAULT_AUDIO_MIX);
    expect(levels.master).toBe(0.8);
    expect(levels.music).toBe(0.65);
    expect(levels.footsteps).toBe(0.85);
    expect(levels.fx).toBe(1);
    expect(levels.weaponOutputPercent).toBe(80);
  });

  test("muting music does not mute footsteps or effects", () => {
    const levels = audioGainLevels({ ...DEFAULT_AUDIO_MIX, musicVolume: 0 });
    expect(levels.music).toBe(0);
    expect(levels.footsteps).toBeGreaterThan(0);
    expect(levels.fx).toBe(1);
    expect(levels.weaponOutputPercent).toBe(80);
  });

  test("muting footsteps leaves music, weapons and effects unchanged", () => {
    const levels = audioGainLevels({ ...DEFAULT_AUDIO_MIX, footstepVolume: 0 });
    expect(levels.footsteps).toBe(0);
    expect(levels.music).toBeGreaterThan(0);
    expect(levels.weaponOutputPercent).toBe(80);
  });

  test("FX volume scales standalone weapon audio, including master volume", () => {
    const levels = audioGainLevels({ masterVolume: 50, musicVolume: 100, footstepVolume: 100, fxVolume: 40 });
    expect(levels.weaponOutputPercent).toBeCloseTo(20);
    expect(levels.fx).toBe(0.4);
    expect(levels.master).toBe(0.5);
    expect(levels.music).toBe(1);
    expect(levels.footsteps).toBe(1);
  });

  test("master zero silences all channels and values are safely clamped", () => {
    const off = audioGainLevels({ masterVolume: 0, musicVolume: 100, footstepVolume: 100, fxVolume: 100 });
    expect(off.weaponOutputPercent).toBe(0);
    expect(off.master).toBe(0);
    const limits = audioGainLevels({ masterVolume: 120, musicVolume: -5, footstepVolume: Number.NaN, fxVolume: 140 });
    expect(limits).toEqual({ master: 1, music: 0, footsteps: 0, fx: 1, weaponOutputPercent: 100 });
  });
});
