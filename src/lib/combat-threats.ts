import type { Vec3 } from "./game-protocol";
import { combatIdentity } from "./combat-identity";

export interface CombatHazard {
  id: string; weaponId: string; pos: Vec3; radius: number; expiresAt: number;
  ownerId: string; ownerTeam: string;
  /** Landing crush can hurt anyone, including the pilot. */
  hurtsEveryone?: boolean;
  spherical?: boolean;
}
export interface CombatThreat {
  id: string; weaponId: string; label: string; color: string; action: string;
  angle: number; distance: number; inside: boolean;
}
/** Only nearby, visible hazards are advertised. Never infer hidden opponents.
 * Called at HUD cadence, with LOS deferred until after cheap range/team checks.
 */
export function combatThreats(hazards: Iterable<CombatHazard>, viewer: {
  id: string; team: string; freeForAll: boolean; pos: Vec3; yaw: number; now: number;
}, visible: (point: Vec3) => boolean): CombatThreat[] {
  const candidates: { threat: CombatThreat; pos: Vec3 }[] = [];
  for (const hazard of hazards) {
    if (hazard.expiresAt <= viewer.now) continue;
    if (!hazard.hurtsEveryone && (hazard.ownerId === viewer.id ||
      (!viewer.freeForAll && hazard.ownerTeam === viewer.team))) continue;
    const dx = hazard.pos[0] - viewer.pos[0], dz = hazard.pos[2] - viewer.pos[2];
    const distance = Math.hypot(dx, dz);
    const vertical = Math.abs(hazard.pos[1] - viewer.pos[1]);
    const reach = hazard.spherical ? Math.hypot(distance, hazard.pos[1] - (viewer.pos[1] + 1)) : distance;
    if (reach > hazard.radius + 5 || (!hazard.spherical && vertical > 2.6)) continue;
    const cue = combatIdentity(hazard.weaponId);
    const angle = Math.atan2(Math.sin(Math.atan2(dx, dz) - viewer.yaw),
      Math.cos(Math.atan2(dx, dz) - viewer.yaw));
    candidates.push({ pos: hazard.pos, threat: { id: hazard.id, weaponId: hazard.weaponId, label: cue.label,
      color: cue.color, action: hazard.weaponId === "wonder_juggernaut" ? "Clear the landing zone" : cue.counterplay,
      angle, distance: Math.round(distance), inside: reach <= hazard.radius } });
  }
  candidates.sort(({threat: a}, {threat: b}) => Number(b.inside) - Number(a.inside) ||
    a.distance - b.distance || a.id.localeCompare(b.id));
  const threats: CombatThreat[] = [];
  for (const {threat, pos} of candidates) {
    if (!visible([pos[0], pos[1] + .2, pos[2]])) continue;
    threats.push(threat);
    if (threats.length === 2) break;
  }
  return threats;
}
