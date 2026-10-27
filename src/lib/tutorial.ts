/** Client-only onboarding state. Each guest/account keeps its own checkpoint. */
export const TUTORIAL_VERSION = 1;
export const TUTORIAL_PHASES = ["welcome", "practice", "loadout", "modes", "ready"] as const;
export type TutorialPhase = typeof TUTORIAL_PHASES[number];
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
  ammo: number; reloading: boolean; weaponId: string;
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
  }
  return { step: state.step + (completed ? 1 : 0), distance, last: sample };
}
