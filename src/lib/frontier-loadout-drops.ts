import type { LoadoutWire } from "./game-protocol";

export type FrontierLoadoutSlot = "primary" | "secondary";
type WeaponAttachments = NonNullable<LoadoutWire["attachments"]>;

const EMPTY_ATTACHMENTS: WeaponAttachments = {
  sight: null, barrel: null, grip: null, magazine: null,
};

/** Deep-copy every per-slot attachment set while preserving all loadout fields. */
export function cloneFrontierLoadout(loadout: LoadoutWire): LoadoutWire {
  return {
    ...loadout,
    attachments: { ...EMPTY_ATTACHMENTS, ...loadout.attachments },
    secondaryAttachments: { ...EMPTY_ATTACHMENTS, ...loadout.secondaryAttachments },
    meleeAttachments: { ...EMPTY_ATTACHMENTS, ...loadout.meleeAttachments },
  };
}

/**
 * Resolve the weapon represented by a complete Frontier kit drop.
 * The drop carries the whole kit; this metadata only controls its visible icon
 * and legacy single-weapon fields in the pickup event.
 */
export function frontierDropWeapon(
  loadout: LoadoutWire,
  currentlyHeldWeaponId: string,
): {
  slot: FrontierLoadoutSlot;
  weaponId: string;
  skinId: string;
  attachments: WeaponAttachments;
} {
  const slot: FrontierLoadoutSlot = loadout.emptyPrimary
    ? "secondary"
    : currentlyHeldWeaponId === loadout.secondaryWeaponId ? "secondary" : "primary";
  return slot === "secondary"
    ? {
        slot,
        weaponId: loadout.secondaryWeaponId ?? "pistol_side",
        skinId: loadout.secondaryWeaponSkinId ?? "default",
        attachments: { ...EMPTY_ATTACHMENTS, ...loadout.secondaryAttachments },
      }
    : {
        slot,
        weaponId: loadout.weaponId,
        skinId: loadout.weaponSkinId,
        attachments: { ...EMPTY_ATTACHMENTS, ...loadout.attachments },
      };
}
