"use client";
import { create } from "zustand";
import { DEFAULT_AUDIO_MIX, type AudioMixSettings } from "./audio-mix";

export interface GameSettings extends AudioMixSettings {
  sensitivity: number;     // 0.5 .. 3.0
  fov: number;             // 70 .. 110
  crosshairColor: string;  // hex
  crosshairSize: number;   // 4 .. 14
  showFps: boolean;
  showPing: boolean;
  showHealthBars: boolean; // Floating health bars over other operatives (not your HUD health)
  damageNumbers: boolean;
  autoAdsOnFire: boolean;  // automatically ADS when firing (great for mobile)
  invertY: boolean;        // invert vertical look (flight-sim style)
  botDifficulty: "easy" | "normal" | "hard" | "veteran";  // scales bot skill
  scopeOverlay: boolean;   // show scope reticle overlay when ADS with a magnified sight
}

const DEFAULTS: GameSettings = {
  sensitivity: 1.0,
  fov: 90,
  crosshairColor: "#22c55e",
  crosshairSize: 8,
  showFps: false,
  showPing: true,
  showHealthBars: true,
  damageNumbers: true,
  ...DEFAULT_AUDIO_MIX,
  autoAdsOnFire: false,
  invertY: false,
  botDifficulty: "normal",
  scopeOverlay: true,
};

const STORAGE_KEY = "vanguard_settings";

function loadSettings(): GameSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const saved = JSON.parse(raw) as Record<string, unknown>;
    delete saved.musicVolume; // Discard legacy music preference.
    return { ...DEFAULTS, ...saved } as GameSettings;
  } catch {
    return DEFAULTS;
  }
}

function persistSettings(s: GameSettings) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

interface SettingsStore {
  settings: GameSettings;
  loaded: boolean;
  update: (partial: Partial<GameSettings>) => void;
  reset: () => void;
  load: () => void;
}

export const useSettings = create<SettingsStore>((set, get) => ({
  settings: DEFAULTS,
  loaded: false,
  load: () => {
    const s = loadSettings();
    set({ settings: s, loaded: true });
  },
  update: (partial) => {
    const next = { ...get().settings, ...partial };
    persistSettings(next);
    set({ settings: next });
  },
  reset: () => {
    persistSettings(DEFAULTS);
    set({ settings: DEFAULTS });
  },
}));

export const CROSSHAIR_PRESETS = [
  { name: "Green", color: "#22c55e" },
  { name: "Cyan", color: "#06b6d4" },
  { name: "Yellow", color: "#facc15" },
  { name: "Red", color: "#ef4444" },
  { name: "Pink", color: "#ec4899" },
  { name: "White", color: "#ffffff" },
];
