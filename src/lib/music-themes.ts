import type { MapId } from "./game-protocol";

/** Each setting is a self-contained, looping 4-bar cue, synthesized without
 * downloaded audio assets. Distinct modes, tempo, harmony, lead and pulse make
 * the maps recognizable without drowning out combat.
 */
export type MusicThemeId = MapId | "menu" | "lobby";
export interface MusicTheme {
  bpm: number;
  roots: readonly [number, number, number, number]; // MIDI bass roots per bar
  melody: readonly (number | null)[]; // semitones above each bar's root; null = rest
  chord: readonly [number, number, number]; // pad voicing above root
  wave: "sine" | "triangle" | "square" | "sawtooth";
  leadLevel: number;
  padLevel: number;
  bassLevel: number;
  noteLength: number; // fraction of eighth-note step
}
export const MUSIC_THEMES: Record<MusicThemeId, MusicTheme> = {
  menu: {
    bpm: 76, roots: [45, 41, 48, 43],
    melody: [12, null, 19, null, 24, 19, null, 15],
    chord: [12, 15, 19], wave: "sine",
    leadLevel: 0.095, padLevel: 0.09, bassLevel: 0.11, noteLength: 1.5,
  },
  lobby: {
    bpm: 90, roots: [50, 46, 43, 48],
    melody: [12, 19, null, 24, 22, null, 19, 15],
    chord: [12, 15, 19], wave: "triangle",
    leadLevel: 0.11, padLevel: 0.065, bassLevel: 0.15, noteLength: 0.9,
  },
  compound: {
    bpm: 106, roots: [45, 48, 43, 41],
    melody: [12, 19, 24, null, 19, 15, 12, 19],
    chord: [12, 15, 19], wave: "triangle",
    leadLevel: 0.12, padLevel: 0.06, bassLevel: 0.16, noteLength: 0.65,
  },
  skybridge: {
    bpm: 116, roots: [50, 53, 46, 48],
    melody: [24, 19, 27, null, 31, 27, 19, null],
    chord: [12, 16, 19], wave: "sine",
    leadLevel: 0.115, padLevel: 0.08, bassLevel: 0.105, noteLength: 1.8,
  },
  bunker: {
    bpm: 76, roots: [38, 41, 36, 39],
    melody: [12, null, 13, 19, null, 12, null, 15],
    chord: [12, 13, 19], wave: "sawtooth",
    leadLevel: 0.075, padLevel: 0.045, bassLevel: 0.2, noteLength: 1.2,
  },
  shipyard: {
    bpm: 98, roots: [43, 46, 41, 38],
    melody: [12, 12, 19, null, 24, 22, 19, null],
    chord: [12, 15, 19], wave: "square",
    leadLevel: 0.055, padLevel: 0.05, bassLevel: 0.17, noteLength: 0.45,
  },
  terminal: {
    bpm: 110, roots: [48, 44, 41, 46],
    melody: [24, null, 19, 27, 24, 19, 15, 19],
    chord: [12, 16, 19], wave: "triangle",
    leadLevel: 0.095, padLevel: 0.055, bassLevel: 0.135, noteLength: 0.75,
  },
  arena_neon: {
    bpm: 132, roots: [45, 48, 41, 43],
    melody: [24, 31, 27, 36, 31, 27, 24, 19],
    chord: [12, 15, 19], wave: "square",
    leadLevel: 0.085, padLevel: 0.055, bassLevel: 0.16, noteLength: 0.55,
  },
};

export function musicThemeForMap(mapId: MapId): MusicThemeId {
  return mapId;
}
