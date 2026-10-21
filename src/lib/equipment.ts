/** Fourth (consumable) loadout slot. Selection is device-local until a
 * permanent server-side loadout equipment field is wired into /api/loadout.
 * Server always selects the known definition from the authenticated room loadout.
 */
export const EQUIPMENT = [
  { id: "frag", name: "Frag Grenade", type: "blast", charges: 2, cooldownMs: 900, radius: 6, damage: 115, description: "Area explosion with damage falloff and cover protection." },
  { id: "flashbang", name: "Flashbang", type: "flash", charges: 2, cooldownMs: 1000, radius: 7, damage: 0, description: "Disorients enemies in the blast area for two seconds." },
  { id: "taser", name: "Taser", type: "taser", charges: 2, cooldownMs: 1300, radius: 17, damage: 24, description: "Short-range electric hit with a brief stun." },
  { id: "mine", name: "Proximity Mine", type: "mine", charges: 2, cooldownMs: 1000, radius: 3.3, damage: 100, description: "Deploys a mine; triggers when an enemy approaches." },
  { id: "knives", name: "Throwing Knives", type: "knife", charges: 3, cooldownMs: 430, radius: 28, damage: 95, description: "Fast aimed projectile; very lethal but demands precision." },
  { id: "poison_dart", name: "Poison Dart", type: "poison", charges: 3, cooldownMs: 620, radius: 24, damage: 18, description: "Aimed dart that inflicts additional poison damage over time." },
] as const;
export type EquipmentId = (typeof EQUIPMENT)[number]["id"];
export type EquipmentDef = (typeof EQUIPMENT)[number];
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
