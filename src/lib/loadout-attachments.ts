import type { AttachmentSlot } from "./game-data";

// Every loadout slot has an explicit, complete attachment map. In particular,
// null means an attachment was deliberately removed rather than "leave as was".
export function emptyAttachmentMap(): Record<AttachmentSlot, null> {
  return { sight: null, barrel: null, grip: null, magazine: null };
}

/**
 * Choose the attachment update for a loadout slot.
 * Replacing a weapon must not inherit the previous gun's attachments; without
 * an explicit new attachment map, start the newly equipped gun bare. This
 * applies equally to primary, secondary and any future attachment slots.
 */
export function attachmentsForWeaponSelection(
  previousWeaponId: string,
  nextWeaponId: string,
  supplied?: Record<string, string | null>,
): Record<string, string | null> | undefined {
  if (supplied !== undefined) return supplied;
  return previousWeaponId === nextWeaponId ? undefined : emptyAttachmentMap();
}
