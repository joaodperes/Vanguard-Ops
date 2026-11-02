/** Shared physical bullet panel. Coordinates use feet Y, yaw 0 facing +Z. */
import type { Vec3 } from "./game-protocol";
export const RIOT_SHIELD_ID = "wonder_riot_shield";
export const RIOT_SHIELD_HP = 250;
/** The shield rebuilds in one step after destruction, independently of
 * P-9 ammo. All owner kills shorten cooldown, even Bulwark P-9 kills.
 * Death/respawn still restores durability immediately. */
export const RIOT_SHIELD_RECHARGE_MS = 27_000;
export const RIOT_SHIELD_KILL_BONUS_MS = 3_000;
export interface RiotShieldDurability { hp: number; readyAt: number }
export function hitRiotShield(hp: number, readyAt: number, damage: number, now: number): RiotShieldDurability {
  if (hp <= 0 || damage <= 0) return { hp, readyAt };
  const remaining = damageRiotShield(hp, damage);
  return { hp: remaining, readyAt: remaining <= 0 ? now + RIOT_SHIELD_RECHARGE_MS : readyAt };
}
export function tickRiotShield(hp: number, readyAt: number, now: number): RiotShieldDurability {
  return hp <= 0 && readyAt > 0 && now >= readyAt
    ? { hp: RIOT_SHIELD_HP, readyAt: 0 } : { hp, readyAt };
}
export function accelerateRiotShield(hp: number, readyAt: number, now: number): RiotShieldDurability {
  return tickRiotShield(hp, hp <= 0 && readyAt > 0 ? Math.max(now, readyAt - RIOT_SHIELD_KILL_BONUS_MS) : readyAt, now);
}
export function riotShieldCooldownMs(hp: number, readyAt: number, now: number): number {
  return hp <= 0 && readyAt > 0 ? Math.max(0, readyAt - now) : 0;
}

export interface ShieldCarrier { pos: Vec3; yaw: number; weaponId: string; riotShieldHp?: number; riotShieldRaised?: boolean }
export function shieldPanel(raised: boolean) {
  return raised
    ? { right: 0, forward: .54, yawOffset: 0, width: 1.65, height: 2.12, centerY: 1.02 }
    : { right: -.43, forward: .32, yawOffset: Math.PI / 4, width: .94, height: 1.78, centerY: .92 };
}
/** One-sided rectangle: no protection from the rear, flanks, or outside the panel. */
export function rayRiotShield(origin: Vec3, dir: Vec3, carrier: ShieldCarrier): number | null {
  if (carrier.weaponId !== RIOT_SHIELD_ID || (carrier.riotShieldHp ?? RIOT_SHIELD_HP) <= 0) return null;
  const p = shieldPanel(!!carrier.riotShieldRaised), sy = Math.sin(carrier.yaw), cy = Math.cos(carrier.yaw);
  const center: Vec3 = [carrier.pos[0] - cy*p.right + sy*p.forward, carrier.pos[1]+p.centerY,
    carrier.pos[2] + sy*p.right + cy*p.forward];
  const a = carrier.yaw+p.yawOffset, nx=Math.sin(a), nz=Math.cos(a);
  const facing=dir[0]*nx+dir[2]*nz;
  if (facing >= -.15) return null;
  const t=((center[0]-origin[0])*nx+(center[2]-origin[2])*nz)/facing;
  if(t<0) return null;
  const x=origin[0]+dir[0]*t-center[0], y=origin[1]+dir[1]*t-center[1], z=origin[2]+dir[2]*t-center[2];
  return Math.abs(x*Math.cos(a)-z*Math.sin(a)) <= p.width/2 && Math.abs(y)<=p.height/2 ? t : null;
}
/** The breaking bullet is absorbed. Subsequent bullets hit the player. */
export function damageRiotShield(hp: number, damage: number): number {
  return Math.max(0, hp-Math.max(0,damage));
}
export function shieldBlocksFire(weaponId: string, raised: boolean, hp: number): boolean {
  return weaponId===RIOT_SHIELD_ID && raised && hp>0;
}
