import type { EquipmentId } from "./equipment";
import type { SfxName } from "./sound";

/** Keep equipment audio deterministic across offline players, bots and network FX. */
export type EquipmentAudioPhase = "release" | "impact" | "placed" | "triggered" | "deploy";

export function equipmentSoundFor(id: EquipmentId, phase: EquipmentAudioPhase): SfxName | null {
  if (phase === "release") return id === "mine" || id === "cover" ? null : "equipment_throw";
  if (phase === "placed") return id === "mine" ? "equipment_mine_arm" : null;
  if (phase === "triggered") return id === "mine" ? "equipment_mine_detonate" : null;
  if (phase === "deploy") return id === "cover" ? "equipment_cover" : null;
  switch (id) {
    case "frag": return "equipment_frag";
    case "flashbang": return "equipment_flash";
    case "taser": return "equipment_taser";
    case "knives": return "equipment_impact";
    case "poison_dart": return "equipment_poison";
    case "mine":
    case "cover": return null;
  }
}

/** Nearby throwables must be audible without broadcasting explosions map-wide. */
export function equipmentSoundVolume(distance: number): number {
  if (!Number.isFinite(distance) || distance < 0) return 0;
  return 0.9 * Math.pow(Math.max(0, 1 - distance / 55), 1.7);
}
