"use client";
import { create } from "zustand";
import type { PlayerProfileView } from "@/lib/player-service";
import type { GameMode, MapId, TeamSize, CreateRoomConfig, BotDifficulty } from "@/lib/game-protocol";
import { teamSizeAllowed, teamSizesForMap } from "@/lib/game-protocol";
import type { ResolvedLoadout } from "@/lib/game-data";
import type { SurvivalTier } from "@/lib/survival";

export type Screen = "auth" | "menu" | "play" | "armory" | "loadout" | "profile" | "settings" | "tutorial" | "playing" | "results" | "range";

export interface PlayConfig {
  mode: GameMode;
  botCount: number;
  online: boolean;
  scoreLimit: number;
  timeLimit: number; // minutes
  mapId: MapId;
  botDifficulty: BotDifficulty;
  survivalTier?: SurvivalTier;
}

// Room creation form state for the Play screen's "Create a Room" tab.
export interface RoomConfig {
  mode: GameMode;
  teamSize: TeamSize;
  fillWithBots: boolean;
  mapId: MapId;
  password: string;   // empty = no password
  roomName: string;   // empty = "<host>'s Room"
  botDifficulty: BotDifficulty;
  // Round 19i: Custom match limits (FFA/TDM only).
  scoreLimit: number;  // kills to win
  timeLimit: number;   // seconds (0 = no time limit)
  tagLifetimeMs: number; // Kill Confirmed dogtag lifetime (milliseconds)
  ctfFlagResetMs: number; // CTF dropped flag reset timer, -1 = never
  denialScoreEnabled: boolean; // friendly recoveries earn +1 team point
  gungamePreset: "all" | "cqc" | "long_range";
  gungameMultiplier: number;
  survivalPlayers: 1 | 2;
  survivalTier: SurvivalTier;
}

// When joining/creating a room, the engine needs to know how to connect:
// either create a fresh room or join an existing one by id.
export interface RoomConnect {
  kind: "create" | "join";
  config?: CreateRoomConfig;   // for kind === "create"
  roomId?: string;             // for kind === "join"
  password?: string | null;    // for kind === "join"
  roomName?: string;           // display name (from roomJoined ack)
  team?: "red" | "blue" | "auto";  // requested team for joinRoom (TDM only)
}

export interface SessionInfo {
  email: string;
  name: string;
  playerKey: string;
}

export interface MatchResultView {
  kills: number; deaths: number; headshots: number; assists?: number; won: boolean; score: number; mode: GameMode;
  standings: { id: string; name: string; team: string; kills: number; deaths: number; score: number; assists?: number; isBot: boolean }[];
  rewards?: {
    xpGained: number; creditsGained: number; leveledUp: boolean; newLevel: number;
    newUnlocks: any; newAchievements: any[]; challengeAwards: any[]; challengeProgress?: { id: string; kind: string; title: string; description?: string; before: number; progress: number; goal: number; completed: boolean }[]; bonusXp: number; bonusCredits: number;
  };
  /** Optional objective counters reported by Kill Confirmed matches. */
  confirmations?: number;
  denials?: number;
  durationSec?: number;
  placement?: number;
  multikills?: number;
  survivalWaves?: number;
  survivalTier?: SurvivalTier;
  weaponId?: string;
}

interface GameStore {
  playerKey: string;
  profile: PlayerProfileView | null;
  screen: Screen;
  rangeWeaponId: string | null;
  setRangeWeaponId: (id: string | null) => void;
  playConfig: PlayConfig;
  matchResult: MatchResultView | null;
  // room lobby (Play screen)
  roomConfig: RoomConfig;
  roomConnect: RoomConnect | null;   // set when entering "playing" via a room
  // auth
  authState: "checking" | "guest" | "authenticated";
  session: SessionInfo | null;
  setSession: (s: SessionInfo | null) => void;
  setAuthState: (s: "checking" | "guest" | "authenticated") => void;
  setPlayerKey: (k: string) => void;
  setProfile: (p: PlayerProfileView | null) => void;
  setScreen: (s: Screen) => void;
  setPlayConfig: (c: Partial<PlayConfig>) => void;
  setRoomConfig: (c: Partial<RoomConfig>) => void;
  setRoomConnect: (r: RoomConnect | null) => void;
  setMatchResult: (r: MatchResultView | null) => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

function genPlayerKey() {
  return "p_" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4);
}

function loadPlayerKey(): string {
  if (typeof window === "undefined") return "p_init";
  try {
    let k = localStorage.getItem("vanguard_player_key");
    if (!k) { k = genPlayerKey(); localStorage.setItem("vanguard_player_key", k); }
    return k;
  } catch {
    return genPlayerKey();
  }
}

export const useGame = create<GameStore>((set, get) => ({
  playerKey: typeof window !== "undefined" ? loadPlayerKey() : "p_init",
  profile: null,
  screen: "auth",
  rangeWeaponId: null,
  setRangeWeaponId: (id) => set({ rangeWeaponId: id }),
  playConfig: { mode: "ffa", botCount: 5, online: false, scoreLimit: 30, timeLimit: 8, mapId: "compound", botDifficulty: "normal" },
  matchResult: null,
  roomConfig: { mode: "tdm", teamSize: 5, fillWithBots: true, mapId: "compound", password: "", roomName: "", botDifficulty: "normal", scoreLimit: 60, timeLimit: 360, tagLifetimeMs: 25000, ctfFlagResetMs: 30000, denialScoreEnabled: false, gungamePreset: "all", gungameMultiplier: 1, survivalPlayers: 2, survivalTier: "default" },
  roomConnect: null,
  authState: "checking",
  session: null,
  setSession: (s) => set({ session: s, authState: s ? "authenticated" : get().authState }),
  setAuthState: (s) => set({ authState: s }),
  setPlayerKey: (k) => set({ playerKey: k }),
  setProfile: (p) => set({ profile: p }),
  setScreen: (s) => set({ screen: s }),
  setPlayConfig: (c) => set({ playConfig: { ...get().playConfig, ...c } }),
  setRoomConfig: (c) => set(() => {
    const next = { ...get().roomConfig, ...c };
    // A saved 16-player team option must not leak into another map when
    // switching maps or modes. Keep all menu actions consistent.
    if (!teamSizeAllowed(next.mapId, next.teamSize))
      next.teamSize = teamSizesForMap(next.mapId).at(-1)!;
    return { roomConfig: next };
  }),
  setRoomConnect: (r) => set({ roomConnect: r }),
  setMatchResult: (r) => set({ matchResult: r }),
  refreshProfile: async () => {
    const key = get().playerKey;
    try {
      const res = await fetch(`/api/profile?playerKey=${encodeURIComponent(key)}`);
      if (res.ok) {
        const p = await res.json();
        set({ profile: p });
      }
    } catch (e) {
      console.error("refreshProfile failed", e);
    }
  },
  signOut: async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
    // revert to a fresh guest playerKey
    const guestKey = genPlayerKey();
    try { localStorage.setItem("vanguard_player_key", guestKey); } catch {}
    set({ session: null, authState: "guest", playerKey: guestKey, profile: null, screen: "auth" });
  },
}));

export function resolvedLoadoutFromProfile(profile: PlayerProfileView | null): ResolvedLoadout | null {
  return profile?.loadout ?? null;
}
