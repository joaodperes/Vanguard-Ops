import { describe, expect, test } from "bun:test";
import {
  audioGainLevels, DEFAULT_AUDIO_MIX, EFFECTS_OUTPUT_BOOST,
  WEAPON_OUTPUT_SCALE, migrateLegacyAudioMix,
} from "../src/lib/audio-mix";

describe("independent audio channels", () => {
  test("base output boosts stay bounded; full-volume faders have unity gain", () => {
    expect(EFFECTS_OUTPUT_BOOST).toBeGreaterThan(1);
    expect(EFFECTS_OUTPUT_BOOST).toBeLessThan(1.6);
    expect(WEAPON_OUTPUT_SCALE).toBeGreaterThan(0.32);
    expect(WEAPON_OUTPUT_SCALE).toBeLessThan(0.7);
    expect(audioGainLevels({
      ...DEFAULT_AUDIO_MIX, masterVolume:100, weaponVolume:100,
      footstepVolume:100, combatVolume:100, uiVolume:100,
    })).toEqual({
      master:1, weapons:1, footsteps:1, combat:1, ui:1,
      weaponOutputPercent:100, combatOutputPercent:100,
    });
  });
  test("default outputs follow the shared settings, not frozen percentages", () => {
    const { masterVolume, weaponVolume, footstepVolume, combatVolume, uiVolume } = DEFAULT_AUDIO_MIX;
    const levels = audioGainLevels(DEFAULT_AUDIO_MIX);
    expect(levels.master).toBeCloseTo(masterVolume/100);
    expect(levels.weapons).toBeCloseTo(weaponVolume/100);
    expect(levels.footsteps).toBeCloseTo(footstepVolume/100);
    expect(levels.combat).toBeCloseTo(combatVolume/100);
    expect(levels.ui).toBeCloseTo(uiVolume/100);
    expect(levels.weaponOutputPercent).toBeCloseTo(masterVolume*weaponVolume/100);
    expect(levels.combatOutputPercent).toBeCloseTo(masterVolume*combatVolume/100);
  });
  test("footstep muting does not silence gunfire, feedback or UI", () => {
    const base=audioGainLevels(DEFAULT_AUDIO_MIX);
    const muted=audioGainLevels({...DEFAULT_AUDIO_MIX,footstepVolume:0});
    expect(muted.footsteps).toBe(0);
    expect(muted.weapons).toBe(base.weapons);
    expect(muted.combat).toBe(base.combat);
    expect(muted.ui).toBe(base.ui);
    expect(muted.weaponOutputPercent).toBe(base.weaponOutputPercent);
    expect(muted.combatOutputPercent).toBe(base.combatOutputPercent);
  });
  test("master, weapon, combat and UI faders remain isolated", () => {
    const mix={...DEFAULT_AUDIO_MIX,masterVolume:50,weaponVolume:40,combatVolume:80,uiVolume:30,footstepVolume:60};
    const base=audioGainLevels(mix);
    expect(base.weaponOutputPercent).toBeCloseTo(20);
    expect(base.combatOutputPercent).toBeCloseTo(40);
    expect(base.footsteps).toBeCloseTo(.6);
    expect(base.ui).toBeCloseTo(.3);
    const quieter=audioGainLevels({...mix,weaponVolume:10});
    expect(quieter.weaponOutputPercent).toBeLessThan(base.weaponOutputPercent);
    expect(quieter.combatOutputPercent).toBe(base.combatOutputPercent);
    expect(quieter.ui).toBe(base.ui);
    const half=audioGainLevels({...mix,masterVolume:25});
    expect(half.weaponOutputPercent).toBeCloseTo(base.weaponOutputPercent/2);
    expect(half.combatOutputPercent).toBeCloseTo(base.combatOutputPercent/2);
  });
  test("master mute and invalid faders clamp safely", () => {
    expect(audioGainLevels({...DEFAULT_AUDIO_MIX,masterVolume:0}).weaponOutputPercent).toBe(0);
    expect(audioGainLevels({
      ...DEFAULT_AUDIO_MIX,masterVolume:120,weaponVolume:140,
      combatVolume:-20,uiVolume:Infinity,footstepVolume:NaN,
    })).toEqual({
      master:1,weapons:1,footsteps:0,combat:0,ui:0,
      weaponOutputPercent:100,combatOutputPercent:0,
    });
  });
  test("legacy FX preferences migrate without overriding new fader choices", () => {
    expect(migrateLegacyAudioMix({fxVolume:37})).toEqual({
      weaponVolume:37,combatVolume:37,uiVolume:37,
    });
    expect(migrateLegacyAudioMix({fxVolume:37,weaponVolume:0,combatVolume:64,uiVolume:99}))
      .toEqual({weaponVolume:0,combatVolume:64,uiVolume:99});
    expect(migrateLegacyAudioMix({})).toEqual({
      weaponVolume:DEFAULT_AUDIO_MIX.weaponVolume,
      combatVolume:DEFAULT_AUDIO_MIX.combatVolume,
      uiVolume:DEFAULT_AUDIO_MIX.uiVolume,
    });
  });
});
