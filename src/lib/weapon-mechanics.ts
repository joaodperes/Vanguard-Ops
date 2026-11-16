/** Standard semi-auto pistols, revolvers, and the two conventional shotguns.
 * Burst, Arc and full-auto machine pistols are deliberately excluded.
 * The same allowlist is used by the viewmodel, client trigger and server. */
export const AKIMBO_GRIP_ID = "grip_akimbo";
export const AKIMBO_WEAPON_IDS = [
  "pistol_side", "pistol_ghost", "pistol_magnum", "pistol_bastion",
  "shotgun_br", "shotgun_combat",
] as const;
export const AKIMBO_CYLINDER_CAPACITY = 6; // Bastion and Magnum base revolvers
export type AkimboHand = "left" | "right";
export function isAkimboWeapon(weaponId:string,grip:string|null|undefined):boolean {
  return grip===AKIMBO_GRIP_ID &&
    (AKIMBO_WEAPON_IDS as readonly string[]).includes(weaponId);
}
/** The live server is authoritative for whether Akimbo is equipped.
 * When a client's loadout is stale (e.g. a swapped preset or an old packet),
 * fall back to the regular global shot cadence instead of silently discarding
 * EVERY shot with an unexpected hand flag. This does not grant two-gun cadence
 * to an unequipped weapon: independent clocks require server-verified Akimbo. */
export function authorizedAkimboHand(
  serverAkimbo: boolean,
  requestedHand: string | undefined,
): AkimboHand | undefined {
  return serverAkimbo && (requestedHand === "left" || requestedHand === "right")
    ? requestedHand : undefined;
}
export function isBastionAkimbo(weaponId:string,grip:string|null|undefined):boolean {
  return weaponId==="pistol_bastion"&&isAkimboWeapon(weaponId,grip);
}
/** Effective dual magazine capacity is always even; each hand owns half. */
export function akimboHandCapacity(combinedMagSize:number):number {
  return Math.max(1,Math.floor(combinedMagSize/2));
}
/** Pump gun's fore-end travels rearward and returns after its own last shot.
 * The other hand is never delayed by this animation. */
export function akimboPumpStroke(msSinceShot:number):number {
  if(msSinceShot<95||msSinceShot>485)return 0;
  const t=(msSinceShot-95)/390;
  return t<.43 ? Math.sin(Math.PI/2*t/.43) :
    Math.cos(Math.PI/2*(t-.43)/.57);
}
/** The listed combined fire rate counts shots from BOTH guns. Each cylinder
 * therefore has its own two-bullet-equivalent recovery time. A shot from the
 * other hand never delays it, even when both triggers arrive on the same frame. */
export function akimboHandIntervalMs(combinedFireRate: number):number {
  return 2000 / Math.max(.01,combinedFireRate);
}
export function akimboHandReady(ammo:number,lastHandShot:number,now:number,
  combinedFireRate:number,tolerance=.9):boolean {
  return ammo>0 && now-lastHandShot>=akimboHandIntervalMs(combinedFireRate)*tolerance;
}
/** Both revolvers drop below the camera frame together, remain out while refreshed,
 * then return simultaneously. No third hand or sequential swing-out cylinder. */
export function akimboReloadDip(progress:number):number {
  const p=Math.max(0,Math.min(1,progress));
  const smooth=(v:number)=>v*v*(3-2*v);
  if(p<.20)return smooth(p/.20);
  if(p<.76)return 1;
  return 1-smooth((p-.76)/.24);
}
/** Hand crosses to the opposite hip during the holster/draw half of the shared swap. */
export function akimboCrossDrawAmount(progress: number, incoming: boolean): number {
  const p = Math.max(0, Math.min(1, progress));
  return incoming ? 1 - p : p;
}

/** Standard crossbow bolts are paced by their nocking cycle rather than a
 * second fire-rate throttle. Reclaimed bolts use a quick nock, but never
 * increase stock magazine capacity. Shared by client and authoritative server. */
export function crossbowReloadCycleMs(
  standardSeconds: number, quickSeconds: number, reclaimed: boolean,
  durationMultiplier = 1,
): number {
  return Math.max(150, (reclaimed ? quickSeconds : standardSeconds) * 1000 *
    Math.max(0.1, durationMultiplier));
}

/** Only an actual single-bolt chamber is paced entirely by re-nocking.
 * Two-bolt magazines retain their separate inter-shot cooldown. */
export function crossbowReloadControlsCadence(magazineSize: number): boolean {
  return magazineSize === 1;
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
