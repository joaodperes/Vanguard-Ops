// Capture the Flag rules shared by the authoritative server and offline engine.
import type { Vec3 } from "./game-protocol";

export type FlagTeam = "red" | "blue";
export interface CtfFlag {
  team: FlagTeam;
  pos: Vec3;
  carrierId: string | null;
  dropped: boolean;
  /** Authoritative wall-clock time for automatic recovery; absent while carried/home. */
  droppedAt?: number;
}
export type CtfFlags = { red: CtfFlag; blue: CtfFlag };
export const CTF_SPEED_MULTIPLIER = 1.10;
export const CTF_PICKUP_RADIUS = 2.4;
export const CTF_CAPTURE_RADIUS = 4;
export const CTF_TREE_X = 94;
export const CTF_TREE_TOP = 12;
export const CTF_BASE_Z = -40;
export const CTF_DROP_RETURN_MS = 30_000;

export const ctfHome = (team: FlagTeam): Vec3 =>
  [team === "red" ? -CTF_TREE_X : CTF_TREE_X, CTF_TREE_TOP + 0.2, 0];
export const ctfBase = (team: FlagTeam): Vec3 =>
  [team === "red" ? -CTF_TREE_X : CTF_TREE_X, 0, CTF_BASE_Z];
export const otherFlag = (team: FlagTeam): FlagTeam => team === "red" ? "blue" : "red";
export const ctfResetFlag = (team: FlagTeam): CtfFlag =>
  ({ team, pos: ctfHome(team), carrierId: null, dropped: false });
export const createCtfFlags = (): CtfFlags => ({red:ctfResetFlag("red"),blue:ctfResetFlag("blue")});
export const flagAtHome = (flag: CtfFlag): boolean => !flag.dropped && flag.carrierId === null;
export const ctfWithin = (a: Vec3, b: Vec3, radius: number, vertical = 2.6): boolean =>
  Math.hypot(a[0] - b[0], a[2] - b[2]) <= radius && Math.abs(a[1] - b[1]) <= vertical;
export function ctfDrop(flags: CtfFlags, carrierId: string, pos: Vec3, now = Date.now()): FlagTeam | null {
  for (const team of ["red", "blue"] as const) {
    const flag = flags[team];
    if (flag.carrierId !== carrierId) continue;
    flag.pos = [...pos]; flag.carrierId = null; flag.dropped = true; flag.droppedAt = now;
    return team;
  }
  return null;
}
/** Timed recovery is server-authoritative online and uses the same rule offline. */
export function ctfReturnExpired(flags: CtfFlags, now = Date.now()): FlagTeam[] {
  const returned: FlagTeam[] = [];
  for (const team of ["red", "blue"] as const) {
    const flag = flags[team];
    if (!flag.dropped || flag.droppedAt === undefined || now - flag.droppedAt < CTF_DROP_RETURN_MS) continue;
    flags[team] = ctfResetFlag(team);
    returned.push(team);
  }
  return returned;
}
export function ctfTouch(flags: CtfFlags, player: { id: string; team: FlagTeam; pos: Vec3 }):
  { kind: "pickup" | "return" | "capture"; flag: FlagTeam } | null {
  const own = flags[player.team], enemyTeam = otherFlag(player.team), enemy = flags[enemyTeam];
  // A returning carrier captures only when their own flag is safely home.
  if (enemy.carrierId === player.id && flagAtHome(own) &&
      ctfWithin(player.pos, ctfBase(player.team), CTF_CAPTURE_RADIUS, 3)) {
    flags[enemyTeam] = ctfResetFlag(enemyTeam);
    return { kind: "capture", flag: enemyTeam };
  }
  if (own.dropped && ctfWithin(player.pos, own.pos, CTF_PICKUP_RADIUS)) {
    flags[player.team] = ctfResetFlag(player.team);
    return { kind: "return", flag: player.team };
  }
  if (!enemy.carrierId && ctfWithin(player.pos, enemy.pos, CTF_PICKUP_RADIUS)) {
    enemy.carrierId = player.id; enemy.dropped = false; delete enemy.droppedAt;
    return { kind: "pickup", flag: enemyTeam };
  }
  return null;
}

/** Route objective bots to a stair entrance and then up its full flight.
 * Directly steering at a treetop flag made them run into the massive trunk.
 * The two flights are symmetrical and share their collision with the renderer.
 */
export function ctfBotGoal(flags: CtfFlags, team: FlagTeam, id: string, pos: Vec3): Vec3 {
  const enemyTeam = otherFlag(team), enemy = flags[enemyTeam];
  if (enemy.carrierId === id) return ctfBase(team);
  if (flags[team].dropped) return [...flags[team].pos];
  if (enemy.carrierId) return ctfBase(enemyTeam);
  if (enemy.pos[1] > CTF_TREE_TOP / 2 && pos[1] < CTF_TREE_TOP - .7) {
    const x = ctfHome(enemyTeam)[0];
    const side = pos[2] < 0 ? -1 : 1;
    const climbing = Math.abs(pos[0] - x) < 7 &&
      Math.abs(pos[2]) > 8 && Math.abs(pos[2]) < 36;
    return climbing ? [x, CTF_TREE_TOP, side*8.7] : [x, 0, side*34.5];
  }
  return [...enemy.pos];
}
