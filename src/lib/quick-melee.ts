/** Shared quick-melee target selection.  Uses ground-plane distance so a normal
 * pitch or a target's different collision height doesn't make a point-blank hit miss. */
export interface QuickMeleeCandidate {
  id: string;
  pos: readonly [number, number, number];
  alive: boolean;
  protected?: boolean;
  friendly?: boolean;
}
export const QUICK_MELEE_REACH = 1.9; // hard safety cap; every weapon still uses its own shorter reach

/** Half-angle to either side of the attacker's forward direction.
 * Fast stabbing weapons stay focused; heavy axe and hammer swings are broader.
 * Shared by local play, F quick melee, and authoritative online hit selection. */
export const MELEE_HALF_ARC_DEGREES: Readonly<Record<string,number>> = {
  shiv: 26,
  knife_tactical: 28,
  baton: 30,
  machete: 32,
  axe: 41,
  hammer: 45,
  orbital_reaper: 50,
};
export function meleeHalfArcDegrees(weaponId:string):number {
  return MELEE_HALF_ARC_DEGREES[weaponId] ?? 26;
}
export function meleeForwardHit(dx:number,dz:number,yaw:number,halfArcDegrees=26):boolean {
  const distance=Math.hypot(dx,dz);
  if(distance<0.001)return false;
  const forward=dx*Math.sin(yaw)+dz*Math.cos(yaw);
  // A continuous forward arc handles realistic sideways movement. The former
  // tight lateral clamp narrowed long-reach weapons to almost straight ahead.
  return forward/distance>=Math.cos(halfArcDegrees*Math.PI/180);
}
/** A quick swing is a temporary use of the equipped melee weapon.
 * Its damage, attack interval, reach and hit arc match an equipped swing. */
export function quickMeleeProfile(stats: {damage:number;fireRate:number;range:number},weaponId="knife_tactical") {
  const cooldownMs=Math.ceil(1000/Math.max(.1,stats.fireRate));
  return {
    damage:stats.damage,
    cooldownMs,
    swingMs:Math.max(160,Math.round(cooldownMs*.68)),
    reach:Math.min(stats.range, QUICK_MELEE_REACH),
    halfArcDegrees:meleeHalfArcDegrees(weaponId),
  };
}
export function chooseQuickMeleeTarget(
  origin: readonly [number, number, number], yaw: number,
  candidates: readonly QuickMeleeCandidate[],
  clearPath: (target: QuickMeleeCandidate, distance: number) => boolean,
  reach = QUICK_MELEE_REACH,
  halfArcDegrees = 26,
): QuickMeleeCandidate | null {
  let best: QuickMeleeCandidate | null = null;
  let bestDist = Infinity;
  for (const target of candidates) {
    if (!target.alive || target.protected || target.friendly) continue;
    const dx = target.pos[0] - origin[0], dz = target.pos[2] - origin[2];
    const dist = Math.hypot(dx, dz);
    // Hard clamp even if a caller passes stale/modified effective range.
    if (dist > Math.min(reach, QUICK_MELEE_REACH) || dist < 0.001) continue;
    if (Math.abs(target.pos[1] - origin[1]) > 1.15) continue;
    if (!meleeForwardHit(dx,dz,yaw,halfArcDegrees)) continue;
    if (!clearPath(target, dist)) continue;
    if (dist < bestDist) { best = target; bestDist = dist; }
  }
  return best;
}
