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

/** Readable stat labels for Armory attachment modifiers. */
export function attachmentEffectLabel(key: string): string {
  switch (key) {
    case "damage": return "DMG";
    case "fireRate": return "fire rate";
    case "recoil": return "recoil";
    case "spread": return "hipfire";
    case "adsSpread": return "ADS spread";
    case "adsTime": return "ADS time";
    case "magSize": return "mag";
    case "reloadTime": return "reload";
    case "moveSpeed": return "mobility";
    case "range": return "range";
    case "heatPerShot": return "heat/shot";
    case "coolPerSecond": return "cooling/sec";
    case "coolDelayMs": return "cool delay";
    case "ventSeconds": return "vent time";
    case "overheatAt": return "heat cap";
    case "resumeAt": return "resume threshold";
    default: return key;
  }
}
