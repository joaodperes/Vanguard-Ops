/** Browsing is always available; equip and purchase permissions are separate. */
export function attachmentViewPermissions(
  weaponId: string, equippedWeaponId: string, weaponOwned: boolean,
): { canEquip: boolean; canPurchase: boolean } {
  return { canEquip: weaponOwned && weaponId === equippedWeaponId, canPurchase: weaponOwned };
}

/** Every attachment slot uses the same display policy.
 * A completed challenge unlocks purchasing; it must not keep showing
 * its completed requirement and progress counter while awaiting payment.
 */
export function showPendingAttachmentChallenge(owned: boolean, completed: boolean | undefined): boolean {
  return !owned && completed === false;
}
