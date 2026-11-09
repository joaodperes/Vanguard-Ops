/** Persistent tactical consumable slot. The authoritative selection lives in
 * the player's Loadout row; clients send only use intent to the match server.
 * Stock refills on respawn, not on weapon swaps.
 */
export const EQUIPMENT = [
  { id: "frag", unlockLevel: 1, name: "Frag Grenade", type: "blast", charges: 2, cooldownMs: 900, radius: 12, damage: 140, description: "Large-area blast with strong center damage, falloff and cover protection." },
  { id: "flashbang", unlockLevel: 5, name: "Flashbang", type: "flash", charges: 2, cooldownMs: 1000, radius: 14, damage: 0, description: "Wide-area whiteout and reduced hearing for up to 3.6 seconds. All movement and weapon controls remain available." },
  { id: "taser", unlockLevel: 20, name: "Taser", type: "taser", charges: 3, cooldownMs: 1300, radius: 17, damage: 25, description: "Shocks for 25 damage, disables ADS for 2.4 seconds and reveals electrical arcs. Movement and hip-fire remain available." },
  { id: "mine", unlockLevel: 10, name: "Proximity Mine", type: "mine", charges: 2, cooldownMs: 1000, radius: 2.4, damage: 140, description: "One-hit takedown for the enemy that triggers it. Nearby enemies take only minor splash damage." },
  { id: "knives", unlockLevel: 15, name: "Throwing Knives", type: "knife", charges: 1, cooldownMs: 430, radius: 16, damage: 140, description: "One-hit takedown on ordinary operators. Precision throw; bosses resist." },
  { id: "cover", unlockLevel: 18, name: "Cover Shield", type: "cover", charges: 1, cooldownMs: 1200, radius: 0, damage: 0, description: "Deploy a fixed 160 HP barricade with a centered ADS firing slit. One active at a time, 40-second lifetime." },
  { id: "poison_dart", unlockLevel: 25, name: "Poison Dart", type: "poison", charges: 3, cooldownMs: 620, radius: 24, damage: 18, description: "Aimed dart that inflicts additional poison damage over time." },
] as const;
export type EquipmentId = (typeof EQUIPMENT)[number]["id"];
export type EquipmentDef = (typeof EQUIPMENT)[number];
/** Tactical gear is level-earned; no credit purchase or per-item inventory needed. */
export function equipmentUnlocked(id: string | null | undefined, level: number): boolean {
  const item = EQUIPMENT.find(e => e.id === id);
  return !!item && level >= item.unlockLevel;
}
export function equipmentAvailable(id: string | null | undefined, level: number): EquipmentId {
  return equipmentUnlocked(id, level) ? id as EquipmentId : DEFAULT_EQUIPMENT;
}
export const EQUIPMENT_STORAGE_KEY = "vanguard_equipment";
export const DEFAULT_EQUIPMENT: EquipmentId = "frag";
export function equipmentById(id: string | null | undefined): EquipmentDef {
  return EQUIPMENT.find(e => e.id === id) ?? EQUIPMENT[0];
}
export function equipmentSelection(): EquipmentId {
  if (typeof window === "undefined") return DEFAULT_EQUIPMENT;
  try { return equipmentById(localStorage.getItem(EQUIPMENT_STORAGE_KEY)).id; }
  catch { return DEFAULT_EQUIPMENT; }
}
