import { describe, expect, test } from "bun:test";
import { MUSIC_THEMES, musicThemeForMap, type MusicThemeId } from "../src/lib/music-themes";
import type { MapId } from "../src/lib/game-protocol";

const maps: MapId[] = ["compound", "skybridge", "bunker", "shipyard", "terminal", "arena_neon"];

describe("menu, lobby and map-specific soundtrack", () => {
  test("every arena has its own cue distinct from the menu and lobby", () => {
    const ids: MusicThemeId[] = ["menu", "lobby", ...maps];
    expect(Object.keys(MUSIC_THEMES).sort()).toEqual([...ids].sort());
    const signatures = ids.map(id => {
      const { bpm, roots, melody, chord, wave, leadLevel, padLevel, bassLevel, noteLength } = MUSIC_THEMES[id];
      return JSON.stringify({ bpm, roots, melody, chord, wave, leadLevel, padLevel, bassLevel, noteLength });
    });
    expect(new Set(signatures).size).toBe(ids.length);
  });

  test("map themes are resolved by the real MapId, including server-changed maps", () => {
    for (const id of maps) {
      expect(musicThemeForMap(id)).toBe(id);
      expect(MUSIC_THEMES[musicThemeForMap(id)]).toBeDefined();
      expect(MUSIC_THEMES[id].bpm).toBeGreaterThanOrEqual(70);
      expect(MUSIC_THEMES[id].bpm).toBeLessThanOrEqual(140);
    }
  });

  test("all arrangements have valid playable notes and a four-bar progression", () => {
    for (const theme of Object.values(MUSIC_THEMES)) {
      expect(theme.roots).toHaveLength(4);
      expect(theme.chord).toHaveLength(3);
      expect(theme.melody).toHaveLength(8);
      expect(theme.melody.some(note => note !== null)).toBe(true);
      expect(theme.leadLevel).toBeGreaterThan(0);
      expect(theme.padLevel).toBeGreaterThan(0);
      expect(theme.bassLevel).toBeGreaterThan(0);
      expect(theme.noteLength).toBeGreaterThan(0);
    }
  });
});
