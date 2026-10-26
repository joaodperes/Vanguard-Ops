/** Shared quick-melee target selection.  Uses ground-plane distance so a normal
 * pitch or a target's different collision height doesn't make a point-blank hit miss. */
export interface QuickMeleeCandidate {
  id: string;
  pos: readonly [number, number, number];
  alive: boolean;
  protected?: boolean;
  friendly?: boolean;
}
export const QUICK_MELEE_REACH = 0.95;
/** A quick swing is a temporary use of the equipped melee weapon.
 * Its damage, attack interval and reach must match the weapon catalog. */
export function quickMeleeProfile(stats: {damage:number;fireRate:number;range:number}) {
  const cooldownMs=Math.ceil(1000/Math.max(.1,stats.fireRate));
  return {
    damage:stats.damage,
    cooldownMs,
    swingMs:Math.max(160,Math.round(cooldownMs*.68)),
    reach:stats.range,
  };
}
export function chooseQuickMeleeTarget(
  origin: readonly [number, number, number], yaw: number,
  candidates: readonly QuickMeleeCandidate[],
  clearPath: (target: QuickMeleeCandidate, distance: number) => boolean,
  reach = QUICK_MELEE_REACH,
): QuickMeleeCandidate | null {
  let best: QuickMeleeCandidate | null = null;
  let bestDist = Infinity;
  for (const target of candidates) {
    if (!target.alive || target.protected || target.friendly) continue;
    const dx = target.pos[0] - origin[0], dz = target.pos[2] - origin[2];
    const dist = Math.hypot(dx, dz);
    if (dist > reach || dist < 0.001) continue;
    if (Math.abs(target.pos[1] - origin[1]) > 2.4) continue;
    if ((dx * Math.sin(yaw) + dz * Math.cos(yaw)) / dist < 0.35) continue;
    if (!clearPath(target, dist)) continue;
    if (dist < bestDist) { best = target; bestDist = dist; }
  }
  return best;
}
