// Availability in loadout swap menus is based on ownership first, then level.
// Meeting the level requirement only makes a paid weapon purchasable.
export type WeaponAvailability = "owned" | "purchasable" | "level-locked";

export function weaponAvailability(
  weapon: { id: string; unlockLevel: number; unlockCost: number },
  playerLevel: number,
  ownedWeaponIds: ReadonlySet<string>,
): WeaponAvailability {
  if (ownedWeaponIds.has(weapon.id)) return "owned";
  return playerLevel < weapon.unlockLevel ? "level-locked" : "purchasable";
}
