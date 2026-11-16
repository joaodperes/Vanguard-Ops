import { describe, expect, test } from "bun:test";
import { DEFAULT_AUDIO_MIX, audioGainLevels, migrateLegacyAudioMix } from "../src/lib/audio-mix";
import { soundChannelFor, type SfxName } from "../src/lib/sound";

describe("audio channel mixer", () => {
  test("master and independent categories mix without double-scaling", () => {
    const levels = audioGainLevels({
      ...DEFAULT_AUDIO_MIX, masterVolume: 50, weaponVolume: 20,
      footstepVolume: 70, combatVolume: 80, uiVolume: 30,
    });
    expect(levels).toEqual({
      master: .5, footsteps: .7, weapons: .2, combat: .8, ui: .3,
      weaponOutputPercent: 10, combatOutputPercent: 40,
    });
  });

  test("zero master mutes both audio contexts and levels clamp", () => {
    const mute = audioGainLevels({ ...DEFAULT_AUDIO_MIX, masterVolume: 0 });
    expect(mute.master).toBe(0);
    expect(mute.weaponOutputPercent).toBe(0);
    expect(mute.combatOutputPercent).toBe(0);
    const clamp = audioGainLevels({
      ...DEFAULT_AUDIO_MIX, masterVolume: 120, weaponVolume: -20, combatVolume: 250,
    });
    expect(clamp.master).toBe(1);
    expect(clamp.weapons).toBe(0);
    expect(clamp.combat).toBe(1);
  });

  test("old FX level migrates, but new channel values including zero prevail", () => {
    expect(migrateLegacyAudioMix({ fxVolume: 35 })).toEqual({
      weaponVolume: 35, combatVolume: 35, uiVolume: 35,
    });
    expect(migrateLegacyAudioMix({ fxVolume: 70, weaponVolume: 0, uiVolume: 95 }))
      .toEqual({ weaponVolume: 0, combatVolume: 70, uiVolume: 95 });
    expect(migrateLegacyAudioMix({})).toEqual({
      weaponVolume: 100, combatVolume: 100, uiVolume: 100,
    });
  });

  test("all known procedural cues map to the correct slider", () => {
    const sounds: Record<"weapons" | "footsteps" | "combat" | "ui", SfxName[]> = {
      weapons: ["shot_rifle", "shot_smg", "shot_shotgun", "shot_sniper", "shot_pistol",
        "shot_lmg", "shot_dmr", "shot_launcher", "melee_swing", "melee_hit",
        "reload", "revolver_reload", "revolver_close", "empty_click", "swap",
        "ads_in", "ads_out"],
      footsteps: ["footstep", "water_footstep"],
      combat: ["hit_marker", "headshot", "kill", "death", "hit_taken"],
      ui: ["level_up", "wave_start", "countdown_tick", "match_start", "overtime_start",
        "match_win", "match_lose", "flag_taken", "flag_scored", "flag_enemy_scored",
        "flag_returned", "flag_lost"],
    };
    for (const [channel, names] of Object.entries(sounds)) {
      for (const name of names) expect(soundChannelFor(name)).toBe(channel);
    }
  });
});
