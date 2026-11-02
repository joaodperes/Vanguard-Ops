import type { WeaponSkinDef } from "./game-data";

/** Gold is gold-plated metal with visible dark furniture, not a flat gold silhouette.
 * Animated Prestige finishes still coat all parts regardless of display rarity. */
export function coatsAllWeaponParts(skin: Pick<WeaponSkinDef, "id" | "rarity" | "prestige">): boolean {
  return !!skin.prestige || (skin.rarity === "legendary" && skin.id !== "gold");
}
