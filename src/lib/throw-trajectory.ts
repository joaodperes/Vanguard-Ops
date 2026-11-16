/** Deterministic, shared ballistic trajectory used by both game server and client.
 * Each segment is checked against world cover, so previews and server landings
 * match. Origin and launch direction are trusted only when built by the server.
 */
import {equipmentById} from "./equipment";
// Tactical throwing knives have their own stock and max flight distance,
// independent of the legacy melee-slot knife weapon.
export const TACTICAL_KNIFE_RANGE: number = equipmentById("knives").radius;
export type ThrowVec3 = [number, number, number];
export type ThrowKind = "frag" | "flashbang" | "knives" | "poison_dart" | "taser" | "mine";
export interface ThrowPath { points: ThrowVec3[]; impact: ThrowVec3; flightMs: number }
export type CollisionProbe = (from: ThrowVec3, unitDir: ThrowVec3, distance: number) => number | null;

/** Launch from the player's hand, 0.42m in front of the eyes. Gravity is
 * applied to every sampled segment; both client and authoritative server run
 * the same geometry/cover checks. The first-person G press triggers the throw.
 */
export function calculateThrowPath(origin: ThrowVec3, direction: ThrowVec3, kind: ThrowKind,
  collision: CollisionProbe, groundY = 0.12): ThrowPath {
  const len = Math.hypot(...direction) || 1;
  const dir: ThrowVec3 = [direction[0] / len, direction[1] / len, direction[2] / len];
  if (kind === "mine") {
    const horizontal = Math.hypot(dir[0], dir[2]) || 1;
    const pos: ThrowVec3 = [origin[0] + dir[0] / horizontal * 1.2, groundY,
      origin[2] + dir[2] / horizontal * 1.2];
    return {points: [origin, pos], impact: pos, flightMs: 350};
  }
  const isGrenade = kind === "frag" || kind === "flashbang";
  const speed = isGrenade ? 21 : kind === "taser" ? 28 : 36;
  const gravity = isGrenade ? 17 : 7;
  // An underhand snap adds lift, including when looking level or slightly down.
  const lift = isGrenade ? 0.30 : 0.045;
  const launchOffset = isGrenade ? 0.48 : 0.38;
  const originHand: ThrowVec3 = [origin[0] + dir[0] * launchOffset,
    origin[1] + Math.max(-0.05, dir[1] * launchOffset), origin[2] + dir[2] * launchOffset];
  const vx = dir[0] * speed, vy = (dir[1] + lift) * speed, vz = dir[2] * speed;
  const points: ThrowVec3[] = [originHand];
  const step = 0.035;
  const maxTime = isGrenade ? 3.2 : 1.5;
  for (let t = step; t <= maxTime + step / 2; t += step) {
    const prev = points[points.length - 1];
    let next: ThrowVec3 = [originHand[0] + vx * t,
      originHand[1] + vy * t - 0.5 * gravity * t * t,
      originHand[2] + vz * t];
    let fractionOfStep = 1;
    if (kind === "knives") {
      const fromDist = Math.hypot(prev[0]-origin[0],prev[1]-origin[1],prev[2]-origin[2]);
      const toDist = Math.hypot(next[0]-origin[0],next[1]-origin[1],next[2]-origin[2]);
      if (toDist >= TACTICAL_KNIFE_RANGE) {
        fractionOfStep = Math.max(0,Math.min(1,(TACTICAL_KNIFE_RANGE-fromDist)/(toDist-fromDist||1)));
        next = [prev[0]+(next[0]-prev[0])*fractionOfStep,
          prev[1]+(next[1]-prev[1])*fractionOfStep,
          prev[2]+(next[2]-prev[2])*fractionOfStep];
      }
    }
    const seg: ThrowVec3 = [next[0]-prev[0],next[1]-prev[1],next[2]-prev[2]];
    const d = Math.hypot(...seg);
    if (d > .00001) {
      const unit: ThrowVec3 = [seg[0]/d,seg[1]/d,seg[2]/d];
      const hit = collision(prev,unit,d);
      if (hit !== null && hit >= 0 && hit <= d) {
        const fraction = Math.max(0, hit - .015) / d;
        const impact: ThrowVec3 = [prev[0] + seg[0] * fraction,prev[1] + seg[1] * fraction,
          prev[2] + seg[2] * fraction];
        points.push(impact);
        return {points,impact,flightMs:Math.max(35,Math.round((t-step+step*fraction)*1000))};
      }
    }
    if (next[1] <= groundY) {
      const fraction = Math.max(0, Math.min(1, (prev[1]-groundY)/(prev[1]-next[1]||1)));
      const impact: ThrowVec3 = [prev[0]+seg[0]*fraction,groundY,prev[2]+seg[2]*fraction];
      points.push(impact);
      return {points,impact,flightMs:Math.max(35,Math.round((t-step+fraction*step)*1000))};
    }
    points.push(next);
    if (fractionOfStep < 1) return {points,impact:next,
      flightMs:Math.max(35,Math.round((t-step+step*fractionOfStep)*1000))};
  }
  return {points,impact:points[points.length-1],flightMs:Math.round(maxTime*1000)};
}
