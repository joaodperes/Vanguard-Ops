/** Client-only Armory trials. Never used to authorize purchases or real matches. */
import { WEAPONS, compatibleAttachments, isPrimaryWeaponCategory, type AttachmentSlot, type WeaponDef, type WeaponSlot } from "./game-data";
import type { LoadoutWire } from "./game-protocol";
import { perkById } from "./perks";

type AttachmentMap = LoadoutWire["attachments"];
const ATTACHMENT_SLOTS: AttachmentSlot[] = ["sight", "barrel", "grip", "magazine"];
export const emptyRangeAttachments = (): AttachmentMap => ({
  sight: null, barrel: null, grip: null, magazine: null,
});

/** Wonders are primary-slot equipment even if their underlying weapon category differs. */
export function rangeWeaponSlot(weaponId: string): WeaponSlot | null {
  const weapon = WEAPONS.find(w => w.id === weaponId);
  if (!weapon) return null;
  if (weapon.wonder || isPrimaryWeaponCategory(weapon.category)) return "primary";
  return weapon.category === "melee" ? "melee" : "secondary";
}

export const rangePrimaryWeapons: WeaponDef[] = WEAPONS.filter(w => rangeWeaponSlot(w.id) === "primary");
export const rangeMeleeWeapons: WeaponDef[] = WEAPONS.filter(w => rangeWeaponSlot(w.id) === "melee");

export function rangeSecondaryWeapons(perkId: string | undefined, primaryWeaponId: string): WeaponDef[] {
  return WEAPONS.filter(w =>
    !w.wonder && (
      (rangeWeaponSlot(w.id) === "secondary") ||
      (perkId === "well_prepared" && isPrimaryWeaponCategory(w.category) && w.id !== primaryWeaponId)
    ),
  );
}

function safeAttachments(weaponId: string, raw: AttachmentMap | undefined): AttachmentMap {
  const result = emptyRangeAttachments();
  for (const slot of ATTACHMENT_SLOTS) {
    const id = raw?.[slot];
    result[slot] = id && compatibleAttachments(weaponId, slot).includes(id) ? id : null;
  }
  return result;
}

/** Reconcile imported presets, perk changes, and try-free links with real slot
 * rules. Cosmetic ids are deliberately ignored throughout range play.
 */
export function normalizeRangeLoadout(input: LoadoutWire): LoadoutWire {
  const perkId = perkById(input.perkId).id;
  const primary = rangeWeaponSlot(input.weaponId) === "primary" ? input.weaponId : "rifle_ar";
  const secondaryChoices = rangeSecondaryWeapons(perkId, primary);
  const secondary = secondaryChoices.some(w => w.id === input.secondaryWeaponId)
    ? input.secondaryWeaponId! : "pistol_side";
  const melee = rangeWeaponSlot(input.meleeWeaponId ?? "") === "melee"
    ? input.meleeWeaponId! : "knife_tactical";
  return {
    ...input,
    perkId,
    weaponId: primary,
    secondaryWeaponId: secondary,
    meleeWeaponId: melee,
    weaponSkinId: "default",
    secondaryWeaponSkinId: "default",
    meleeWeaponSkinId: "default",
    playerSkinId: "default",
    attachments: safeAttachments(primary, input.attachments),
    secondaryAttachments: safeAttachments(secondary, input.secondaryAttachments),
    meleeAttachments: emptyRangeAttachments(),
  };
}

/** A Try Free link previews its weapon in the correct slot, not always primary. */
export function selectRangeWeapon(loadout: LoadoutWire, weaponId: string): LoadoutWire {
  const slot = rangeWeaponSlot(weaponId);
  if (!slot) return normalizeRangeLoadout(loadout);
  if (slot === "primary") return normalizeRangeLoadout({
    ...loadout, weaponId, attachments: emptyRangeAttachments(),
  });
  if (slot === "secondary") return normalizeRangeLoadout({
    ...loadout, secondaryWeaponId: weaponId, secondaryAttachments: emptyRangeAttachments(),
  });
  return normalizeRangeLoadout({
    ...loadout, meleeWeaponId: weaponId, meleeAttachments: emptyRangeAttachments(),
  });
}
