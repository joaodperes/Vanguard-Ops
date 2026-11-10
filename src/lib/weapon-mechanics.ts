/** Bastion .45: Akimbo occupies the grip slot and cannot combine with fanning. */
export const AKIMBO_GRIP_ID = "grip_akimbo";
export const AKIMBO_CYLINDER_CAPACITY = 6;
export type AkimboHand = "left" | "right";
export function isBastionAkimbo(weaponId: string, grip: string | null | undefined): boolean {
  return weaponId === "pistol_bastion" && grip === AKIMBO_GRIP_ID;
}
/** Each hammer has its own mechanical recovery; the server still enforces combined cadence. */
export function akimboHandReady(ammo: number, lastHandShot: number, lastSharedShot: number,
  now: number, perHandRate: number, combinedRate: number): boolean {
  return ammo > 0 && now - lastHandShot >= 900 / Math.max(.01, perHandRate) &&
    now - lastSharedShot >= 900 / Math.max(.01, combinedRate);
}
/** Sequential left/right swing-out cylinders in one complete reload animation. */
export function akimboReloadFraction(progress: number, hand: AkimboHand): number {
  return Math.max(0, Math.min(1, progress * 2 - (hand === "right" ? 1 : 0)));
}
/** Hand crosses to the opposite hip during the holster/draw half of the shared swap. */
export function akimboCrossDrawAmount(progress: number, incoming: boolean): number {
  const p = Math.max(0, Math.min(1, progress));
  return incoming ? 1 - p : p;
}

/** Shared, deterministic helpers for special weapons (safe for browser and Node). */
export const FAN_HAMMER_RATE_MULTIPLIER = 1.85;
/** Fanning applies only to the Bastion's dedicated grip, never all revolvers. */
export function isFanHammer(weaponId: string, grip: string | null | undefined): boolean {
  return weaponId === "pistol_bastion" && grip === "grip_fan_hammer";
}

/** The Executioner and future en-bloc magazine weapons may only reload when empty. */
export function canStartWeaponReload(stats: { reloadOnlyWhenEmpty?: boolean }, ammoInMag: number): boolean {
  return !stats.reloadOnlyWhenEmpty || ammoInMag <= 0;
}
/** Special-weapon shape comes from the same contract as the authored weapon JSON.
 * Keep actual mechanics here; don't duplicate schema field declarations.
 */
export type WeaponSpecial = NonNullable<import("./catalog-contract").WeaponCatalogDef["special"]>;
export type HeatConfig = Extract<WeaponSpecial,{kind:"heat"}>;
export type ArcConfig = Extract<WeaponSpecial,{kind:"arc"}>;
export type BoltConfig = Extract<WeaponSpecial,{kind:"bolt"}>;
export type ThrowingKnifeConfig = Extract<WeaponSpecial,{kind:"throwing_knife"}>;
export interface HeatState { heat: number; lastShotAt: number; locked: boolean; }
export const freshHeat = (): HeatState => ({ heat: 0, lastShotAt: -Infinity, locked: false });
export function coolHeat(state: HeatState, config: HeatConfig, elapsedSeconds: number, nowMs: number): HeatState {
  const coolAfter = Math.max(0, nowMs - state.lastShotAt - config.coolDelayMs);
  const elapsedMs = Math.max(0, elapsedSeconds * 1000);
  const effectiveMs = Math.min(elapsedMs, coolAfter);
  const heat = Math.max(0, state.heat - config.coolPerSecond * effectiveMs / 1000);
  return { ...state, heat, locked: state.locked && heat > config.resumeAt };
}
export function addHeat(state: HeatState, config: HeatConfig, nowMs: number): HeatState | null {
  if (state.locked || state.heat >= config.overheatAt) return null;
  const heat = Math.min(config.overheatAt, state.heat + config.heatPerShot);
  return { heat, lastShotAt: nowMs, locked: heat >= config.overheatAt };
}
export interface ArcCandidate { id: string; pos: readonly [number, number, number]; alive: boolean; team: string; protected?: boolean; }
/** Select the closest eligible chain target, respecting teams, cover and hit history. */
export function nextArcTarget(
  from: ArcCandidate, candidates: ArcCandidate[], visited: ReadonlySet<string>,
  radius: number, sameTeamCanBeHit: boolean,
  hasLineOfSight: (from: ArcCandidate, to: ArcCandidate) => boolean,
): ArcCandidate | null {
  let closest: ArcCandidate | null = null;
  let distance = radius;
  for (const c of candidates) {
    if (!c.alive || c.protected || visited.has(c.id) || (!sameTeamCanBeHit && c.team === from.team)) continue;
    const d = Math.hypot(c.pos[0] - from.pos[0], c.pos[1] - from.pos[1], c.pos[2] - from.pos[2]);
    if (d <= distance && hasLineOfSight(from, c)) { closest = c; distance = d; }
  }
  return closest;
}

/**
 * Burst cadence is faster than the displayed rate, but no longer 3x faster.
 * DMRs have a deliberately slower precision cadence. Both the client
 * simulation and authoritative server must use this same interval.
 *
 * fireRate measures inter-burst recovery / nominal shots per second.
 */
export function burstShotIntervalMs(fireRate: number, category: string): number {
  const intraBurstMultiplier = category === "dmr" ? 1.25 : 1.65;
  return 1000 / Math.max(0.1, fireRate * intraBurstMultiplier);
}
