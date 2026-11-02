import type { WeaponDef, PlayerSkinDef } from "./game-data";

/** "Owned" means purchased or granted for free at the player's level.
 * An item's level gate alone does not grant paid equipment, and Prestige-token
 * Wonder weapons are never free merely because their credit price is zero. */
export function ownsWeapon(weapon: Pick<WeaponDef, "id"|"unlockCost"|"unlockLevel"|"wonder">,
  level: number, purchased: readonly string[]): boolean {
  return purchased.includes(weapon.id) || (!weapon.wonder && weapon.unlockCost === 0 && level >= weapon.unlockLevel);
}
export function ownsOperativeSkin(skin: Pick<PlayerSkinDef,"id"|"unlockCost"|"unlockLevel"|"shopCurrency">,
  level: number, unlocked: readonly string[]): boolean {
  return unlocked.includes(skin.id) || (!skin.shopCurrency && skin.unlockCost === 0 && level >= skin.unlockLevel);
}
/** Skins are owned PER WEAPON, never just because their style was earned on
 * some other gun. Default finish belongs only to a weapon the player owns. */
export function ownsWeaponSkin(weaponId: string, skinId: string,
  level: number, unlockedWeapons: readonly string[], skinsByWeapon: Readonly<Record<string,readonly string[]>>,
  weapons: readonly Pick<WeaponDef,"id"|"unlockCost"|"unlockLevel"|"wonder">[]): boolean {
  if (skinId === "default") {
    const weapon = weapons.find(w => w.id === weaponId);
    return !!weapon && ownsWeapon(weapon,level,unlockedWeapons);
  }
  return (skinsByWeapon[weaponId] ?? []).includes(skinId);
}
