import { describe, expect, test } from "bun:test";
import { MUSIC_THEMES, musicNotesForStep, musicThemeForMap, type MusicThemeId } from "../src/lib/music-themes";
import type { MapId } from "../src/lib/game-protocol";

const maps: MapId[] = ["compound", "skybridge", "bunker", "shipyard", "terminal", "arena_neon"];

describe("quiet, map-specific background music", () => {
  test("every arena has a different written melody and accompaniment", () => {
    const ids: MusicThemeId[] = ["menu", "lobby", ...maps];
    expect(Object.keys(MUSIC_THEMES).sort()).toEqual([...ids].sort());
    // A different BPM/transposition alone is not a different song. Compare
    // the actual relative melody and rhythm, not just the overall theme object.
    expect(new Set(ids.map((id) => JSON.stringify(MUSIC_THEMES[id].melody))).size).toBe(ids.length);
    expect(new Set(ids.map((id) => MUSIC_THEMES[id].groove)).size).toBe(ids.length);
    expect(new Set(ids.map((id) => JSON.stringify(
      Array.from({ length: 32 }, (_, step) => musicNotesForStep(id, step)
        .map(({ midi, instrument, durationSteps }) => [midi, instrument, durationSteps])),
    ))).size).toBe(ids.length);
  });

  test("map cues resolve to their correct music profiles", () => {
    for (const id of maps) {
      expect(musicThemeForMap(id)).toBe(id);
      expect(MUSIC_THEMES[id]).toBeDefined();
      expect(MUSIC_THEMES[id].bpm).toBeGreaterThanOrEqual(70);
      expect(MUSIC_THEMES[id].bpm).toBeLessThanOrEqual(110);
    }
  });

  test("all cues are four bars long, melodic and warm rather than dissonant", () => {
    for (const theme of Object.values(MUSIC_THEMES)) {
      expect(theme.roots).toHaveLength(4);
      expect(theme.chords).toHaveLength(4);
      expect(theme.melody).toHaveLength(32);
      expect(theme.melody.filter((note) => note !== null).length).toBeGreaterThanOrEqual(12);
      for (const chord of theme.chords) {
        expect(chord).toHaveLength(4);
        expect(chord[0]).toBe(12);
        expect([15, 16]).toContain(chord[1]); // consonant major/minor third
        expect(chord[2]).toBe(19); // perfect fifth
        expect(chord[3]).toBeGreaterThanOrEqual(21); // 6th or 7th
      }
      expect(theme.leadLevel).toBeGreaterThan(0);
      expect(theme.padLevel).toBeGreaterThan(0);
      expect(theme.bassLevel).toBeGreaterThan(0);
      expect(theme.leadLevel).toBeLessThan(.09);
      expect(theme.padLevel).toBeLessThan(.05);
      expect(theme.bassLevel).toBeLessThan(.09);
    }
  });

  test("all scheduled score events are playable, within restrained volume and cycle cleanly", () => {
    for (const id of Object.keys(MUSIC_THEMES) as MusicThemeId[]) {
      const all = Array.from({ length: 32 }, (_, step) => musicNotesForStep(id, step));
      expect(all.flat().length).toBeGreaterThan(20);
      expect(all.flat().length).toBeLessThan(125);
      for (const note of all.flat()) {
        expect(note.midi).toBeGreaterThanOrEqual(36);
        expect(note.midi).toBeLessThan(100);
        expect(note.level).toBeGreaterThan(0);
        expect(note.level).toBeLessThan(.1);
        expect(note.durationSteps).toBeGreaterThan(0);
        expect(note.durationSteps).toBeLessThan(8);
      }
      expect(musicNotesForStep(id, 32)).toEqual(musicNotesForStep(id, 0));
      expect(musicNotesForStep(id, -1)).toEqual(musicNotesForStep(id, 31));
    }
  });
});
