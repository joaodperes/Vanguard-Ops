/** Browsing is always available; equip and purchase permissions are separate. */
export function attachmentViewPermissions(
  weaponId: string, equippedWeaponId: string, weaponOwned: boolean,
): { canEquip: boolean; canPurchase: boolean } {
  return { canEquip: weaponOwned && weaponId === equippedWeaponId, canPurchase: weaponOwned };
}
