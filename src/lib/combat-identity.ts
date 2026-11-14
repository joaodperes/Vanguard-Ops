import { weaponById, type WeaponCategory } from "./game-data";

/** Combat colours describe mechanics, never cosmetics or team allegiance. */
export const CATEGORY_IDENTITY: Record<WeaponCategory, { color: string; label: string }> = {
  assault: { color: "#ff3b3b", label: "AR" }, smg: { color: "#ffd93b", label: "SMG" },
  shotgun: { color: "#ff8c3b", label: "SG" }, dmr: { color: "#3b7bff", label: "DMR" },
  sniper: { color: "#9b3bff", label: "SNP" }, lmg: { color: "#3bff7b", label: "LMG" },
  pistol: { color: "#e0e0e0", label: "PST" }, pdw: { color: "#a6f060", label: "PDW" },
  launcher: { color: "#fb923c", label: "RKT" }, melee: { color: "#808080", label: "MLE" },
};
export interface CombatIdentity {
  color: string; label: string; counterplay: string;
  /** Ballistic tracers remain restrained; energy trails persist briefly. */
  tracerMs: number;
}
const identity = (color: string, label: string, counterplay: string): CombatIdentity =>
  ({ color, label, counterplay, tracerMs: 95 });
const SPECIAL: Record<string, CombatIdentity> = {
  rifle_electron: identity("#63eaff", "PLASMA", "Break line of sight"),
  pistol_arc: identity("#c0a0ff", "ARC", "Spread out to avoid chains"),
  crossbow_reclaimer: identity("#c1bb8e", "BOLT", "Use cover between shots"),
  wonder_singularity: identity("#9b57ff", "GRAVITY", "Leave the gravity well"),
  wonder_corrosion: identity("#78c932", "CORROSION", "Leave the toxic area"),
  wonder_turret: identity("#ffd18a", "TURRET", "Break sight or destroy the turret"),
  wonder_deadlock: identity("#ff527f", "SMART", "Break line of sight to stop tracking"),
  wonder_hellfire: identity("#ff752c", "FLAME", "Back away from the flame cone"),
  wonder_stormweaver: identity("#8deeff", "STORM", "Avoid mines and spread out"),
  wonder_bogfather: identity("#a1b535", "SLUDGE", "Leave the slowing pool"),
  wonder_cluster: identity("#ffbb43", "CLUSTER", "Clear the bomblet area"),
  wonder_riot_shield: identity("#6bb9d5", "SHIELD", "Flank the exposed sides and rear"),
  wonder_phasebreaker: identity("#74bbff", "RAIL", "Move away from penetrable cover"),
  wonder_chrono: identity("#bb9aff", "RECALL", "Watch the return anchor"),
  wonder_seismic: identity("#ffc17e", "SEISMIC", "Keep distance from the ground slam"),
  wonder_phantom: identity("#a4b8d0", "DECOY", "Watch for repeated firing patterns"),
  wonder_whiteout: identity("#80e8ff", "CRYO", "Leave the freezing cone"),
  wonder_ripper: identity("#ff822e", "SAWBLADE", "Avoid the ricochet path"),
  wonder_juggernaut: identity("#42bfee", "MECH", "Clear the landing zone; flank the suit"),
  wonder_harbinger: identity("#f8a455", "DRONE", "Break sight or destroy the drone"),
};
export function combatIdentity(weaponId: string): CombatIdentity {
  return SPECIAL[weaponId] ?? {
    ...CATEGORY_IDENTITY[weaponById(weaponId).category], counterplay: "Use solid cover", tracerMs: 45,
  };
}
/** Skin emissives belong on the model; they must not disguise incoming fire. */
export function tracerIdentity(weaponId: string): { color: string; life: number } {
  const special = SPECIAL[weaponId];
  return { color: special?.color ?? "#ffcc66", life: special?.tracerMs ?? 45 };
}
