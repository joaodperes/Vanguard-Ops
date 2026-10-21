/** Tunable traversal settings. Units are game-world units/second and units/second^2. */
export const MOVEMENT = {
  walk: 8.65, sprintMultiplier: 1.95, sprintAdsMultiplier: 1.48,
  jumpVelocity: 8.55, sprintJumpBoost: 2.35, gravity: 22.5,
  botPursuitMultiplier: 1.16,
} as const;
export const SPRINT_ADS_GRIP = "grip_runner_ads";
export function allowsAdsWhileSprinting(grip?: string | null) { return grip === SPRINT_ADS_GRIP; }
