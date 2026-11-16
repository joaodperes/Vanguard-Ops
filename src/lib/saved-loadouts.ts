import { equipmentById } from "./equipment";
import { parseWeaponSetups } from "./weapon-setups";

/** Serialized, named copies of fully equipped player loadouts.
 * The active equipment still lives in Loadout; these are independent snapshots.
 */
export const MAX_SAVED_LOADOUTS = 5;
export const MAX_LOADOUT_NAME_LENGTH = 24;

/** Per-preset Wonder configuration, separate from the account's per-weapon defaults. */
export interface SavedWonderCustomization {
  moduleId: string;
  skinId: string;
  killEffectId: string;
}

export interface SavedLoadout {
  id: string;
  name: string;
  perkId: string;
  wonderWeaponId?: string;
  /** Absent on legacy presets: retain the weapon's current customizations. */
  wonderCustomization?: SavedWonderCustomization;
  primaryWeapon: string;
  secondaryWeapon: string;
  meleeWeapon: string;
  equipmentId: import("./equipment").EquipmentId;
  weaponSkin: string;
  secondaryWeaponSkin: string;
  meleeWeaponSkin: string;
  playerSkin: string;
  primaryReticle: string; secondaryReticle: string;
  primaryCharm: string; secondaryCharm: string;
  attachments: Record<string, string | null>;
  secondaryAttachments: Record<string, string | null>;
  meleeAttachments: Record<string, string | null>;
}

export function cleanLoadoutName(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, MAX_LOADOUT_NAME_LENGTH) : "";
}

export function parseSavedLoadouts(raw: string | null | undefined): SavedLoadout[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is SavedLoadout => {
      if (!value || typeof value !== "object") return false;
      const item = value as Record<string, unknown>;
      return typeof item.id === "string" && typeof item.name === "string" &&
        typeof item.primaryWeapon === "string" && typeof item.secondaryWeapon === "string" &&
        typeof item.meleeWeapon === "string";
    }).filter(p => !p.primaryWeapon.startsWith('wonder_')).map(p => ({
      ...p,
      // Older presets do not have this field; don't overwrite their Wonder setup.
      wonderCustomization: readWonderCustomization(p.wonderCustomization),
      equipmentId: equipmentById(p.equipmentId).id,
      primaryReticle: typeof p.primaryReticle === "string" ? p.primaryReticle : "classic",
      secondaryReticle: typeof p.secondaryReticle === "string" ? p.secondaryReticle : "classic",
      primaryCharm: typeof p.primaryCharm === "string" ? p.primaryCharm : "none",
      secondaryCharm: typeof p.secondaryCharm === "string" ? p.secondaryCharm : "none",
    })).slice(0, MAX_SAVED_LOADOUTS);
  } catch { return []; }
}

function readWonderCustomization(raw: unknown): SavedWonderCustomization | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.moduleId !== "string" || typeof obj.skinId !== "string" ||
      typeof obj.killEffectId !== "string") return undefined;
  return {
    moduleId: obj.moduleId,
    skinId: obj.skinId === "default" ? "" : obj.skinId,
    killEffectId: obj.killEffectId,
  };
}

/** Build a server-validated Wonder update only for presets that own a snapshot. */
export function presetWonderEquipFields(preset: SavedLoadout): {
  wonderCustomizeWeaponId?: string;
  wonderModuleId?: string;
  wonderSkinId?: string;
  wonderKillEffectId?: string;
} {
  if (preset.perkId !== "wonder_weapon" || !preset.wonderWeaponId ||
      !preset.wonderCustomization) return {};
  return {
    wonderCustomizeWeaponId: preset.wonderWeaponId,
    wonderModuleId: preset.wonderCustomization.moduleId,
    wonderSkinId: preset.wonderCustomization.skinId,
    wonderKillEffectId: preset.wonderCustomization.killEffectId,
  };
}

function safeAttachments(raw: string): Record<string, string | null> {
  try {
    const map: unknown = JSON.parse(raw);
    if (map && typeof map === "object" && !Array.isArray(map)) return map as Record<string, string | null>;
  } catch {}
  return {};
}

/** Copy the active, server-validated Loadout row (not arbitrary client-provided weapons). */
export function captureSavedLoadout(active: {
  primaryWeapon: string; secondaryWeapon: string; meleeWeapon: string;
  equipmentId?: string;
  wonderWeaponId?: string;
  weaponSetups?: string | null;
  weaponSkin: string; secondaryWeaponSkin: string; meleeWeaponSkin: string;
  playerSkin: string; attachments: string; secondaryAttachments: string; meleeAttachments: string;
  primaryReticle?: string; secondaryReticle?: string; primaryCharm?: string; secondaryCharm?: string;
}, id: string, name: string, perkId: string): SavedLoadout {
  // Snapshot the equipped Wonder's three independent customizations by value.
  // "default" is a standard weapon skin marker; a Wonder's default finish is "".
  const setup = perkId === "wonder_weapon" && active.wonderWeaponId
    ? parseWeaponSetups(active.weaponSetups)[active.wonderWeaponId] : undefined;
  const wonderCustomization = perkId === "wonder_weapon" && active.wonderWeaponId ? {
    moduleId: setup?.moduleId ?? "",
    skinId: setup?.skin && setup.skin !== "default" ? setup.skin : "",
    killEffectId: setup?.killEffectId ?? "",
  } : undefined;
  return {
    id, name, perkId, wonderWeaponId: active.wonderWeaponId ?? '',
    ...(wonderCustomization ? { wonderCustomization } : {}),
    primaryWeapon: active.primaryWeapon,
    equipmentId: equipmentById(active.equipmentId).id,
    secondaryWeapon: active.secondaryWeapon, meleeWeapon: active.meleeWeapon,
    weaponSkin: active.weaponSkin, secondaryWeaponSkin: active.secondaryWeaponSkin,
    meleeWeaponSkin: active.meleeWeaponSkin, playerSkin: active.playerSkin,
    primaryReticle: active.primaryReticle ?? "classic", secondaryReticle: active.secondaryReticle ?? "classic",
    primaryCharm: active.primaryCharm ?? "none", secondaryCharm: active.secondaryCharm ?? "none",
    attachments: safeAttachments(active.attachments),
    secondaryAttachments: safeAttachments(active.secondaryAttachments),
    meleeAttachments: safeAttachments(active.meleeAttachments),
  };
}
