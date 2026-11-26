/**
 * Pure weapon-slot fallback for Frontier AI.
 *
 * The offline engine and authoritative server own their respective bot state,
 * but both must make exactly the same decision when a firearm runs dry.
 */
export interface FrontierBotWeaponFallbackInput {
  currentWeaponId: string;
  primaryWeaponId: string;
  secondaryWeaponId?: string;
  meleeWeaponId: string;
  ammoInMag: number;
  inactiveAmmoInMag?: number;
  meleeMagazineSize: number;
  now: number;
  nextSwitchAt?: number;
}

export interface FrontierBotWeaponFallback {
  weaponId: string;
  activeSlot: "primary" | "secondary" | "melee";
  ammoInMag: number;
  inactiveAmmoInMag: number;
  nextSwitchAt: number;
}

export function resolveFrontierBotWeaponFallback(
  input: FrontierBotWeaponFallbackInput,
): FrontierBotWeaponFallback | null {
  if (input.ammoInMag > 0 || input.now < (input.nextSwitchAt ?? 0)) return null;

  const isPrimary = input.currentWeaponId === input.primaryWeaponId;
  const isSecondary = !!input.secondaryWeaponId &&
    input.currentWeaponId === input.secondaryWeaponId;
  if (!isPrimary && !isSecondary) return null;

  const otherWeaponId = isPrimary ? input.secondaryWeaponId : input.primaryWeaponId;
  const otherAmmo = input.inactiveAmmoInMag ?? 0;
  if (otherWeaponId && otherAmmo > 0) {
    return {
      weaponId: otherWeaponId,
      activeSlot: isPrimary ? "secondary" : "primary",
      ammoInMag: otherAmmo,
      inactiveAmmoInMag: input.ammoInMag,
      nextSwitchAt: input.now + 500,
    };
  }

  return {
    weaponId: input.meleeWeaponId,
    activeSlot: "melee",
    ammoInMag: input.meleeMagazineSize,
    inactiveAmmoInMag: input.inactiveAmmoInMag ?? 0,
    nextSwitchAt: input.now + 500,
  };
}
