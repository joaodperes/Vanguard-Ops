// Capture the Flag rules shared by the authoritative server and offline engine.
import type { Vec3 } from "./game-protocol";

export type FlagTeam = "red" | "blue";
export interface CtfFlag {
  team: FlagTeam;
  pos: Vec3;
  carrierId: string | null;
  dropped: boolean;
}
export type CtfFlags = { red: CtfFlag; blue: CtfFlag };
export const CTF_SPEED_MULTIPLIER = 1.10;
export const CTF_PICKUP_RADIUS = 2.4;
export const CTF_CAPTURE_RADIUS = 4;
export const CTF_TREE_X = 37;
export const CTF_TREE_TOP = 6.25;
export const CTF_BASE_Z = -17;

export const ctfHome = (team: FlagTeam): Vec3 =>
  [team === "red" ? -CTF_TREE_X : CTF_TREE_X, CTF_TREE_TOP + 0.2, 0];
export const ctfBase = (team: FlagTeam): Vec3 =>
  [team === "red" ? -CTF_TREE_X : CTF_TREE_X, 0, CTF_BASE_Z];
export const otherFlag = (team: FlagTeam): FlagTeam => team === "red" ? "blue" : "red";
export const createCtfFlags = (): CtfFlags => ({
  red: { team: "red", pos: ctfHome("red"), carrierId: null, dropped: false },
  blue: { team: "blue", pos: ctfHome("blue"), carrierId: null, dropped: false },
});
export const flagAtHome = (flag: CtfFlag): boolean => !flag.dropped && flag.carrierId === null;
export const ctfWithin = (a: Vec3, b: Vec3, radius: number, vertical = 2.6): boolean =>
  Math.hypot(a[0] - b[0], a[2] - b[2]) <= radius && Math.abs(a[1] - b[1]) <= vertical;
export function ctfDrop(flags: CtfFlags, carrierId: string, pos: Vec3): FlagTeam | null {
  for (const team of ["red", "blue"] as const) {
    const flag = flags[team];
    if (flag.carrierId !== carrierId) continue;
    flag.pos = [...pos]; flag.carrierId = null; flag.dropped = true;
    return team;
  }
  return null;
}
export function ctfTouch(flags: CtfFlags, player: { id: string; team: FlagTeam; pos: Vec3 }):
  { kind: "pickup" | "return" | "capture"; flag: FlagTeam } | null {
  const own = flags[player.team], enemyTeam = otherFlag(player.team), enemy = flags[enemyTeam];
  // A returning carrier captures only when their own flag is safely home.
  if (enemy.carrierId === player.id && flagAtHome(own) &&
      ctfWithin(player.pos, ctfBase(player.team), CTF_CAPTURE_RADIUS, 3)) {
    flags[enemyTeam] = { team: enemyTeam, pos: ctfHome(enemyTeam), carrierId: null, dropped: false };
    return { kind: "capture", flag: enemyTeam };
  }
  if (own.dropped && ctfWithin(player.pos, own.pos, CTF_PICKUP_RADIUS)) {
    flags[player.team] = { team: player.team, pos: ctfHome(player.team), carrierId: null, dropped: false };
    return { kind: "return", flag: player.team };
  }
  if (!enemy.carrierId && ctfWithin(player.pos, enemy.pos, CTF_PICKUP_RADIUS)) {
    enemy.carrierId = player.id; enemy.dropped = false;
    return { kind: "pickup", flag: enemyTeam };
  }
  return null;
}
