/**
 * Shared bot reload timing for the offline simulation and authoritative server.
 * Incremental weapons schedule one shell/round at a time; conventional weapons
 * complete the magazine reload immediately and use the full reload duration.
 */
export interface BotReloadTimingInput {
  reloadStyle?: string;
  reloadPerRound?: number;
  effectiveReloadTime: number;
  magazineSize: number;
  weaponReloadTime: number;
  frontier: boolean;
  perkMultiplier: number;
}

export function incrementalReloadStepMs(
  reloadPerRound: number | undefined,
  effectiveReloadTime: number,
  magazineSize: number,
  weaponReloadTime: number,
): number {
  const perRound = reloadPerRound ?? effectiveReloadTime / Math.max(1, magazineSize);
  return Math.max(300, perRound * effectiveReloadTime /
    Math.max(0.01, weaponReloadTime) * 1000);
}

export function botReloadDurationMs(input: BotReloadTimingInput): number {
  const baseDuration = input.reloadStyle === "incremental"
    ? incrementalReloadStepMs(input.reloadPerRound, input.effectiveReloadTime,
        input.magazineSize, input.weaponReloadTime)
    : input.effectiveReloadTime * 1000 * (input.frontier ? 1.12 : 1);
  return baseDuration * input.perkMultiplier;
}

/** Compose the modifiers applied to a player-initiated reload in both runtimes. */
export interface WeaponReloadModifiers {
  frontier?: boolean;
  perkMultiplier?: number;
  survivalMultiplier?: number;
  akimboSingleHand?: boolean;
}

export function weaponReloadDurationMs(
  baseDurationSeconds: number,
  modifiers: WeaponReloadModifiers = {},
): number {
  return Math.max(0, baseDurationSeconds) * 1000 *
    (modifiers.frontier ? 1.12 : 1) *
    (modifiers.perkMultiplier ?? 1) *
    (modifiers.survivalMultiplier ?? 1) *
    (modifiers.akimboSingleHand ? 0.72 : 1);
}

/** Shared low-ammo reload decision for offline and authoritative AI. */
export function shouldBotSmartReload(
  ammoInMag: number,
  magazineSize: number,
  enemyVisible: boolean,
  skill: number,
  canReload: boolean,
  randomRoll: number,
): boolean {
  const lowAmmo = ammoInMag <= Math.max(1, Math.floor(magazineSize * 0.3));
  return lowAmmo && !enemyVisible && skill > 0.4 && canReload && randomRoll < 0.02;
}
