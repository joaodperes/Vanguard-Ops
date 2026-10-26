import type { MapId } from "./game-protocol";

/**
 * Quiet, melodic 4-bar background cues. Each map has its own written 32-step
 * melody, four harmonies, instrumentation and accompaniment rhythm rather than
 * sharing the same eight-note minor-key motif. No external sound assets.
 */
export type MusicThemeId = MapId | "menu" | "lobby";
export type MusicInstrument = "keys" | "bell" | "flute" | "guitar" | "organ" | "marimba" | "bass";
export type MusicGroove = "gentle" | "lobby" | "smooth" | "airy" | "retro" | "bossa" | "lounge" | "neon";
export interface MusicTheme {
  bpm: number;
  roots: readonly [number, number, number, number]; // MIDI bass root per bar
  chords: readonly [
    readonly [number, number, number, number],
    readonly [number, number, number, number],
    readonly [number, number, number, number],
    readonly [number, number, number, number],
  ]; // soft major 6ths / major 7ths, occasional mellow minor 7th
  melody: readonly (number | null)[]; // precisely 32 eighth-note steps; null is a rest
  lead: MusicInstrument;
  accompaniment: MusicInstrument;
  groove: MusicGroove;
  leadLevel: number;
  padLevel: number;
  bassLevel: number;
  noteLength: number; // eighth-note step multiplier
}

// Comfortable, functional "elevator music": not dissonant, minor-key suspense
// cues. The tempo, voice, rhythm, harmony, and melodic phrasing vary per map.
export const MUSIC_THEMES = {
  "menu": {
    "bpm": 78,
    "roots": [
      48,
      45,
      41,
      43
    ],
    "chords": [
      [
        12,
        16,
        19,
        23
      ],
      [
        12,
        15,
        19,
        22
      ],
      [
        12,
        16,
        19,
        23
      ],
      [
        12,
        16,
        19,
        21
      ]
    ],
    "melody": [
      24,
      null,
      null,
      28,
      null,
      31,
      null,
      28,
      24,
      null,
      27,
      null,
      31,
      null,
      27,
      null,
      28,
      null,
      31,
      null,
      35,
      null,
      31,
      null,
      24,
      null,
      28,
      null,
      31,
      null,
      28,
      null
    ],
    "lead": "keys",
    "accompaniment": "keys",
    "groove": "gentle",
    "leadLevel": 0.07,
    "padLevel": 0.038,
    "bassLevel": 0.063,
    "noteLength": 1.85
  },
  "lobby": {
    "bpm": 92,
    "roots": [
      53,
      48,
      50,
      46
    ],
    "chords": [
      [
        12,
        16,
        19,
        23
      ],
      [
        12,
        16,
        19,
        21
      ],
      [
        12,
        15,
        19,
        22
      ],
      [
        12,
        16,
        19,
        23
      ]
    ],
    "melody": [
      24,
      null,
      28,
      null,
      31,
      null,
      28,
      24,
      28,
      null,
      31,
      null,
      28,
      null,
      24,
      null,
      24,
      null,
      27,
      31,
      null,
      27,
      null,
      24,
      31,
      null,
      28,
      null,
      24,
      28,
      null,
      24
    ],
    "lead": "marimba",
    "accompaniment": "guitar",
    "groove": "lobby",
    "leadLevel": 0.068,
    "padLevel": 0.035,
    "bassLevel": 0.058,
    "noteLength": 1.2
  },
  "compound": {
    "bpm": 86,
    "roots": [
      48,
      43,
      45,
      41
    ],
    "chords": [
      [
        12,
        16,
        19,
        23
      ],
      [
        12,
        16,
        19,
        21
      ],
      [
        12,
        15,
        19,
        22
      ],
      [
        12,
        16,
        19,
        23
      ]
    ],
    "melody": [
      24,
      null,
      28,
      null,
      31,
      null,
      28,
      null,
      24,
      null,
      28,
      31,
      null,
      28,
      null,
      24,
      24,
      null,
      27,
      null,
      31,
      null,
      34,
      null,
      31,
      null,
      28,
      24,
      null,
      28,
      null,
      24
    ],
    "lead": "keys",
    "accompaniment": "keys",
    "groove": "smooth",
    "leadLevel": 0.065,
    "padLevel": 0.044,
    "bassLevel": 0.068,
    "noteLength": 1.85
  },
  "skybridge": {
    "bpm": 80,
    "roots": [
      43,
      50,
      52,
      48
    ],
    "chords": [
      [
        12,
        16,
        19,
        23
      ],
      [
        12,
        16,
        19,
        21
      ],
      [
        12,
        15,
        19,
        22
      ],
      [
        12,
        16,
        19,
        23
      ]
    ],
    "melody": [
      31,
      null,
      null,
      35,
      null,
      28,
      null,
      31,
      28,
      null,
      31,
      null,
      null,
      24,
      28,
      null,
      31,
      null,
      34,
      null,
      27,
      null,
      null,
      24,
      28,
      null,
      null,
      31,
      35,
      null,
      31,
      null
    ],
    "lead": "bell",
    "accompaniment": "flute",
    "groove": "airy",
    "leadLevel": 0.054,
    "padLevel": 0.029,
    "bassLevel": 0.045,
    "noteLength": 2.4
  },
  "bunker": {
    "bpm": 74,
    "roots": [
      50,
      45,
      43,
      50
    ],
    "chords": [
      [
        12,
        16,
        19,
        23
      ],
      [
        12,
        16,
        19,
        21
      ],
      [
        12,
        16,
        19,
        23
      ],
      [
        12,
        16,
        19,
        21
      ]
    ],
    "melody": [
      24,
      null,
      28,
      31,
      null,
      null,
      28,
      null,
      19,
      null,
      24,
      null,
      28,
      null,
      24,
      null,
      24,
      null,
      28,
      31,
      null,
      28,
      null,
      null,
      31,
      null,
      28,
      null,
      24,
      null,
      21,
      null
    ],
    "lead": "flute",
    "accompaniment": "organ",
    "groove": "retro",
    "leadLevel": 0.054,
    "padLevel": 0.034,
    "bassLevel": 0.055,
    "noteLength": 2.2
  },
  "shipyard": {
    "bpm": 98,
    "roots": [
      41,
      48,
      45,
      46
    ],
    "chords": [
      [
        12,
        16,
        19,
        23
      ],
      [
        12,
        16,
        19,
        21
      ],
      [
        12,
        15,
        19,
        22
      ],
      [
        12,
        16,
        19,
        23
      ]
    ],
    "melody": [
      24,
      null,
      28,
      null,
      31,
      28,
      null,
      24,
      24,
      28,
      null,
      31,
      null,
      28,
      24,
      null,
      27,
      null,
      31,
      34,
      null,
      31,
      null,
      27,
      24,
      28,
      null,
      31,
      28,
      null,
      24,
      null
    ],
    "lead": "guitar",
    "accompaniment": "guitar",
    "groove": "bossa",
    "leadLevel": 0.073,
    "padLevel": 0.029,
    "bassLevel": 0.06,
    "noteLength": 1.1
  },
  "terminal": {
    "bpm": 88,
    "roots": [
      48,
      53,
      55,
      48
    ],
    "chords": [
      [
        12,
        16,
        19,
        21
      ],
      [
        12,
        16,
        19,
        23
      ],
      [
        12,
        16,
        19,
        21
      ],
      [
        12,
        16,
        19,
        23
      ]
    ],
    "melody": [
      28,
      null,
      31,
      null,
      36,
      null,
      31,
      28,
      24,
      null,
      28,
      null,
      31,
      28,
      null,
      24,
      24,
      null,
      28,
      31,
      null,
      28,
      null,
      24,
      31,
      null,
      28,
      null,
      24,
      null,
      null,
      24
    ],
    "lead": "marimba",
    "accompaniment": "keys",
    "groove": "lounge",
    "leadLevel": 0.068,
    "padLevel": 0.037,
    "bassLevel": 0.061,
    "noteLength": 1.3
  },
  "arena_neon": {
    "bpm": 102,
    "roots": [
      52,
      45,
      49,
      47
    ],
    "chords": [
      [
        12,
        16,
        19,
        21
      ],
      [
        12,
        16,
        19,
        23
      ],
      [
        12,
        15,
        19,
        22
      ],
      [
        12,
        16,
        19,
        21
      ]
    ],
    "melody": [
      24,
      null,
      28,
      31,
      null,
      28,
      24,
      null,
      31,
      null,
      35,
      null,
      28,
      null,
      31,
      null,
      24,
      27,
      null,
      31,
      27,
      null,
      24,
      null,
      28,
      null,
      31,
      35,
      null,
      31,
      null,
      28
    ],
    "lead": "bell",
    "accompaniment": "keys",
    "groove": "neon",
    "leadLevel": 0.059,
    "padLevel": 0.033,
    "bassLevel": 0.058,
    "noteLength": 1.25
  }
} as const satisfies Record<MusicThemeId, MusicTheme>;

export interface MusicNote {
  midi: number;
  durationSteps: number;
  level: number;
  instrument: MusicInstrument;
}

/** Deterministic, testable score events. Web Audio only handles synthesis. */
export function musicNotesForStep(themeId: MusicThemeId, step: number): MusicNote[] {
  const theme = MUSIC_THEMES[themeId];
  const index = ((Math.floor(step) % 32) + 32) % 32;
  const beat = index % 8;
  const bar = Math.floor(index / 8);
  const root = theme.roots[bar];
  const chord = theme.chords[bar];
  const notes: MusicNote[] = [];
  const add = (offset: number, durationSteps: number, level: number, instrument: MusicInstrument) => {
    notes.push({ midi: root + offset, durationSteps, level, instrument });
  };
  const addChord = (durationSteps: number, level = 1, tones = 4) => {
    for (let i = 0; i < tones; i++) add(chord[i], durationSteps, theme.padLevel * level, theme.accompaniment);
  };
  const bass = (durationSteps: number, level = 1) =>
    add(0, durationSteps, theme.bassLevel * level, "bass");
  const picked = (toneIndex: number, durationSteps: number, level = 0.8) =>
    add(chord[toneIndex] + 12, durationSteps, theme.padLevel * level, theme.lead);

  // Distinct accompaniments make these actual different tunes, not a shared
  // riff transposed between maps. All patterns are deliberately unhurried.
  switch (theme.groove) {
    case "gentle":
      if (beat === 0) { addChord(6.5); bass(3.4); }
      if (beat === 4) bass(2.4, .65);
      break;
    case "lobby":
      if (beat === 0) bass(2.6);
      if (beat === 2 || beat === 6) addChord(1.8, .7, 3);
      if (beat === 5) bass(2.0, .6);
      break;
    case "smooth":
      if (beat === 0) { addChord(4.4); bass(3); }
      if (beat === 4) { addChord(2.6, .57, 3); bass(2.4, .65); }
      break;
    case "airy":
      if (beat === 0) { addChord(7, .75); bass(4.8, .75); }
      if (beat === 3) picked(2, 2.0, .55);
      break;
    case "retro":
      if (beat === 0) { addChord(5.5, .75); bass(3.4); }
      if (beat === 5) addChord(2.2, .45, 3);
      break;
    case "bossa":
      if (beat === 0) bass(2.8);
      if (beat === 2 || beat === 6) addChord(1.5, .72, 3);
      if (beat === 4) bass(2.4, .7);
      if (beat === 7) picked(2, 1.15, .55);
      break;
    case "lounge":
      if (beat === 0) { addChord(4.0, .85); bass(3.1); }
      if (beat === 5) addChord(2.1, .5, 3);
      if (beat === 4) bass(2.3, .65);
      break;
    case "neon":
      if (beat === 0) { addChord(2.8, .8); bass(3); }
      if (beat === 3 || beat === 6) picked(beat === 3 ? 2 : 3, 1.4, .65);
      if (beat === 4) bass(2.2, .68);
      break;
  }

  const melody = theme.melody[index];
  if (melody !== null) add(melody, theme.noteLength, theme.leadLevel, theme.lead);
  return notes;
}

export function musicThemeForMap(mapId: MapId): MusicThemeId {
  return mapId;
}
