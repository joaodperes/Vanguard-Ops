/** Client-only onboarding state. Each guest/account keeps its own checkpoint. */
import type { GameMode } from "./game-protocol";

// The PvP briefing must cover every GameMode except Survival. Keep this
// exhaustive when a new mode is added; tests also compare with the catalog.
export type CompetitiveModeId = Exclude<GameMode, "survival">;
export const COMPETITIVE_MODE_IDS = ["ffa", "tdm", "gungame", "killconfirmed", "ctf"] as const satisfies readonly CompetitiveModeId[];
export const COMPETITIVE_MODE_GUIDES = {
  ffa: {
    label: "Free-For-All",
    objective: "Every operative fights for themselves. Reach the kill limit first, or finish with the most kills when time runs out.",
    tip: "There are no teammates — check every angle and pick your fights.",
  },
  tdm: {
    label: "Team Deathmatch",
    objective: "Red versus Blue. Every elimination adds to your team's score; the first team to the kill limit wins.",
    tip: "Stay near your squad and cover each other's approaches.",
  },
  gungame: {
    label: "Gun Game",
    objective: "Each kill advances you to a new weapon. Work through the full rotation and score a kill with the final melee weapon to win.",
    tip: "Adapt your distance and positioning as your weapon changes.",
  },
  killconfirmed: {
    label: "Kill Confirmed",
    objective: "Eliminated players drop dog tags. Collect enemy tags to score and recover friendly tags to stop opponents scoring.",
    tip: "Guard teammates collecting tags; a kill alone does not confirm the point.",
  },
  ctf: {
    label: "Capture the Flag",
    objective: "Steal the enemy flag and bring it to your base while your own flag is home. The team with the required captures wins.",
    tip: "Escort your carrier, defend your flag and return it when stolen.",
  },
} as const satisfies Record<CompetitiveModeId, { label: string; objective: string; tip: string }>;


export const TUTORIAL_VERSION = 1;
export const TUTORIAL_PHASES = ["welcome", "practice", "loadout", "ballistics", "modes", "progression", "ready"] as const;
export type TutorialPhase = typeof TUTORIAL_PHASES[number];

/** Shared chapter catalog drives both the full guide and live-practice picker.
 * New players can follow the sequence; returning players can skip to any topic.
 */
export const TUTORIAL_CHAPTERS: readonly {
  id: TutorialPhase; label: string; description: string;
}[] = [
  {id:"welcome",label:"Overview",description:"Where to begin"},
  {id:"practice",label:"Controls",description:"Live firing drills"},
  {id:"loadout",label:"Equipment",description:"Weapons and loadouts"},
  {id:"ballistics",label:"Penetration",description:"Bullets and materials"},
  {id:"modes",label:"Game modes",description:"Rules and objectives"},
  {id:"progression",label:"Progression",description:"Ranks, mastery and rewards"},
  {id:"ready",label:"Quick start",description:"Where to play next"},
];

/** Optional one-shot deep link from the Armory to a specific guide chapter. */
const TUTORIAL_REQUEST_KEY="vanguard_tutorial_chapter";
export function requestTutorialChapter(phase:TutorialPhase):void {
  try { sessionStorage.setItem(TUTORIAL_REQUEST_KEY,phase); } catch {}
}
export function consumeTutorialChapter():TutorialPhase|null {
  try {
    const value=sessionStorage.getItem(TUTORIAL_REQUEST_KEY);
    sessionStorage.removeItem(TUTORIAL_REQUEST_KEY);
    return TUTORIAL_PHASES.includes(value as TutorialPhase)?value as TutorialPhase:null;
  }catch { return null; }
}

export interface TutorialProgress {
  version: typeof TUTORIAL_VERSION;
  status: "in_progress" | "completed" | "skipped";
  phase: TutorialPhase;
  practiceStep: number;
}
export const PRACTICE_TASKS = [
  { title: "Find your feet", desktop: "Walk 5 metres with WASD. Hold Shift to sprint; Space to jump.", touch: "Move 5 metres with the left stick. Push further to sprint; tap Jump to hop." },
  { title: "Aim down sights", desktop: "Move the mouse to look. Hold the right mouse button to aim down sights.", touch: "Drag the right side to look. Hold ADS to aim down sights." },
  { title: "Eliminate a target", desktop: "Face the targets down the lane. Left-click to fire until one falls.", touch: "Face the targets down the lane. Hold Fire until one falls." },
  { title: "Reload your weapon", desktop: "Press R and let the reload finish. Fire a shot first if the magazine is full.", touch: "Tap Reload and let it finish. Fire a shot first if the magazine is full." },
  { title: "Switch weapons", desktop: "Press 2 for your sidearm, 3 for melee, or Q to quick-swap. F performs a quick melee attack.", touch: "Tap slot 2 for your sidearm or 3 for melee. The knife button performs a quick melee attack." },
  { title: "Throw a frag grenade", desktop: "Press G to throw a Frag Grenade downrange. You start with two per life; keep clear of the blast.", touch: "Tap Tactical to throw a Frag Grenade downrange. You start with two per life; keep clear of the blast." },
] as const;

export function newTutorialProgress(): TutorialProgress {
  return { version: TUTORIAL_VERSION, status: "in_progress", phase: "welcome", practiceStep: 0 };
}

export function tutorialStorageKey(playerKey: string): string {
  return `vanguard_tutorial_v${TUTORIAL_VERSION}:${playerKey}`;
}

export function parseTutorialProgress(raw: string | null): TutorialProgress | null {
  try {
    const value = JSON.parse(raw ?? "null");
    if (!value || value.version !== TUTORIAL_VERSION ||
      !["in_progress", "completed", "skipped"].includes(value.status) ||
      !TUTORIAL_PHASES.includes(value.phase) || !Number.isInteger(value.practiceStep) ||
      value.practiceStep < 0 || value.practiceStep > PRACTICE_TASKS.length) return null;
    return { version: TUTORIAL_VERSION, status: value.status, phase: value.phase, practiceStep: value.practiceStep };
  } catch { return null; }
}

export function loadTutorialProgress(playerKey: string): TutorialProgress | null {
  try { return parseTutorialProgress(localStorage.getItem(tutorialStorageKey(playerKey))); }
  catch { return null; }
}

export function saveTutorialProgress(playerKey: string, progress: TutorialProgress): void {
  try { localStorage.setItem(tutorialStorageKey(playerKey), JSON.stringify(progress)); }
  catch { /* Onboarding remains usable when storage is blocked. */ }
}

export function shouldOfferTutorial(profile: { xp: number; matchesPlayed: number }, progress: TutorialProgress | null): boolean {
  if (progress) return progress.status === "in_progress";
  return profile.xp === 0 && profile.matchesPlayed === 0;
}

/** These are real simulation observations, shared by keyboard and touch input. */
export interface PracticeSample {
  x: number; z: number; aiming: boolean; kills: number;
  ammo: number; reloading: boolean; weaponId: string; equipmentCharges?: number;
}
export interface PracticeState {
  step: number;
  distance: number;
  last?: PracticeSample;
}

export function advancePractice(state: PracticeState, sample: PracticeSample): PracticeState {
  if (state.step >= PRACTICE_TASKS.length) return state;
  const previous = state.last;
  let distance = state.distance;
  let completed = false;
  switch (state.step) {
    case 0:
      if (previous) distance += Math.hypot(sample.x - previous.x, sample.z - previous.z);
      completed = distance >= 5;
      break;
    case 1: completed = sample.aiming; break;
    case 2: completed = !!previous && sample.kills > previous.kills; break;
    case 3:
      // Swapping cancels a reload: only the same weapon gaining ammunition
      // after its reload animation ends completes this lesson.
      completed = !!previous && previous.reloading && !sample.reloading &&
        previous.weaponId === sample.weaponId && sample.ammo > previous.ammo;
      break;
    case 4: completed = !!previous && sample.weaponId !== previous.weaponId; break;
    case 5: completed = previous?.equipmentCharges !== undefined && sample.equipmentCharges !== undefined &&
      sample.equipmentCharges < previous.equipmentCharges; break;
  }
  return { step: state.step + (completed ? 1 : 0), distance, last: sample };
}
