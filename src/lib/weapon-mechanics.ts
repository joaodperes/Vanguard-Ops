/** Shared, deterministic helpers for special weapons (safe for browser and Node). */
export interface HeatConfig {
  kind: "heat";
  heatPerShot: number;
  coolPerSecond: number;
  coolDelayMs: number;
  overheatAt: number;
  resumeAt: number;
  ventSeconds: number;
}
export interface ArcConfig { kind: "arc"; jumps: number; radius: number; decay: number; }
export interface BoltConfig { kind: "bolt"; pickupRadius: number; lifetimeMs: number; quickReloadSeconds: number; }
export type WeaponSpecial = HeatConfig | ArcConfig | BoltConfig;
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
