/** Client-only Armory trials. Never used to authorize purchases or real matches. */
import { WEAPONS, compatibleAttachments, isPrimaryWeaponCategory, weaponSkinById, playerSkinById, type AttachmentSlot, type WeaponDef, type WeaponSlot } from "./game-data";
import type { LoadoutWire } from "./game-protocol";
import { perkById } from "./perks";
import { equipmentById } from "./equipment";
import { cosmeticById } from "./cosmetics";
import {wonderModuleById,wonderFinishById,wonderKillEffectById} from "./wonder-expansion";

type AttachmentMap = LoadoutWire["attachments"];
const ATTACHMENT_SLOTS: AttachmentSlot[] = ["sight", "barrel", "grip", "magazine"];
export const emptyRangeAttachments = (): AttachmentMap => ({
  sight: null, barrel: null, grip: null, magazine: null,
});

/** Internal selector classification: Wonders are dispatched separately as slot-4 perks. */
export function rangeWeaponSlot(weaponId: string): WeaponSlot | null {
  const weapon = WEAPONS.find(w => w.id === weaponId);
  if (!weapon || weapon.disabled) return null;
  if (weapon.wonder || isPrimaryWeaponCategory(weapon.category)) return "primary";
  return weapon.category === "melee" ? "melee" : "secondary";
}

export const rangePrimaryWeapons: WeaponDef[] = WEAPONS.filter(w => !w.wonder && rangeWeaponSlot(w.id) === "primary");
export const rangeWonderWeapons: WeaponDef[] = WEAPONS.filter(w => !!w.wonder && !w.disabled);
export const rangeMeleeWeapons: WeaponDef[] = WEAPONS.filter(w => rangeWeaponSlot(w.id) === "melee");

export function rangeSecondaryWeapons(perkId: string | undefined, primaryWeaponId: string): WeaponDef[] {
  return WEAPONS.filter(w =>
    !w.disabled && !w.wonder && (
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

/** Reconcile imported presets, perk changes, and trials with real slot rules.
 * All cosmetic selections are local to this practice session; nothing is saved.
 */
export function normalizeRangeLoadout(input: LoadoutWire): LoadoutWire {
  const perkId = perkById(input.perkId).id;
  const primary = !WEAPONS.find(w=>w.id===input.weaponId)?.wonder && rangeWeaponSlot(input.weaponId) === "primary" ? input.weaponId : "rifle_ar";
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
    equipmentId: equipmentById(input.equipmentId).id,
    weaponSkinId: weaponSkinById(input.weaponSkinId).id,
    secondaryWeaponSkinId: weaponSkinById(input.secondaryWeaponSkinId??"default").id,
    meleeWeaponSkinId: weaponSkinById(input.meleeWeaponSkinId??"default").id,
    playerSkinId: playerSkinById(input.playerSkinId).id,
    primaryReticleId: cosmeticById(input.primaryReticleId??"classic","reticle")?.id??"classic",
    secondaryReticleId: cosmeticById(input.secondaryReticleId??"classic","reticle")?.id??"classic",
    primaryCharmId: cosmeticById(input.primaryCharmId??"none","charm")?.id??"none",
    secondaryCharmId: cosmeticById(input.secondaryCharmId??"none","charm")?.id??"none",
    meleeCharmId: cosmeticById(input.meleeCharmId??"none","charm")?.id??"none",
    wonderWeaponId: perkId==="wonder_weapon"&&rangeWonderWeapons.some(w=>w.id===input.wonderWeaponId)?input.wonderWeaponId:"",
    wonderModuleId: perkId==="wonder_weapon"&&wonderModuleById(input.wonderModuleId??"")?.wonderWeaponId===input.wonderWeaponId?input.wonderModuleId:"",
    wonderSkinId: wonderFinishById(input.wonderSkinId??"")?.id??"",
    wonderKillEffectId: wonderKillEffectById(input.wonderKillEffectId??"")?.id??"",
    attachments: safeAttachments(primary, input.attachments),
    secondaryAttachments: safeAttachments(secondary, input.secondaryAttachments),
    meleeAttachments: emptyRangeAttachments(),
  };
}

/** A Wonder picked in the range's Primary selector is actually fired from
 * slot 4 by the engine. Keep a normal fallback primary weapon in the wire
 * while exposing the Wonder and its modules in the same editor panel. */
export function rangePrimarySelection(loadout: LoadoutWire): string {
  if (loadout.perkId === "wonder_weapon" && rangeWonderWeapons.some(w => w.id === loadout.wonderWeaponId)) {
    return loadout.wonderWeaponId!;
  }
  return loadout.weaponId;
}

export function selectRangePrimary(loadout: LoadoutWire, weaponId: string): LoadoutWire {
  if (rangeWonderWeapons.some(w => w.id === weaponId)) return normalizeRangeLoadout({
    ...loadout, perkId: "wonder_weapon", wonderWeaponId: weaponId,
    wonderModuleId: "", wonderSkinId: "", wonderKillEffectId: "",
  });
  if (!rangePrimaryWeapons.some(w => w.id === weaponId)) return normalizeRangeLoadout(loadout);
  return normalizeRangeLoadout({
    ...loadout, weaponId, weaponSkinId: "default", attachments: emptyRangeAttachments(),
    perkId: loadout.perkId === "wonder_weapon" ? "battle_hardened" : loadout.perkId,
    wonderWeaponId: "", wonderModuleId: "", wonderSkinId: "", wonderKillEffectId: "",
  });
}

/** A Try Free link previews its weapon in the correct slot, not always primary. */
export function selectRangeWeapon(loadout: LoadoutWire, weaponId: string): LoadoutWire {
  const slot = rangeWeaponSlot(weaponId);
  if (!slot) return normalizeRangeLoadout(loadout);
  if (slot === "primary") return selectRangePrimary(loadout, weaponId);
  if (slot === "secondary") return normalizeRangeLoadout({
    ...loadout, secondaryWeaponId: weaponId, secondaryWeaponSkinId:"default", secondaryAttachments: emptyRangeAttachments(),
  });
  return normalizeRangeLoadout({
    ...loadout, meleeWeaponId: weaponId, meleeWeaponSkinId:"default", meleeAttachments: emptyRangeAttachments(),
  });
}

/** Stable, human-readable trial dropdown ordering (type, unlock, name).
 * Wonder Weapons form their own alphabetical group after standard types.
 */
export const RANGE_TYPE_ORDER = [
  "assault","smg","shotgun","dmr","sniper","lmg",
  "pistol","pdw","launcher","melee","wonder",
] as const;
export function groupedRangeWeapons(weapons:readonly WeaponDef[]){
  return RANGE_TYPE_ORDER.map(type=>({
    type,label:type==="wonder"?"Wonder Weapons":({
      assault:"Assault Rifles",smg:"SMGs",shotgun:"Shotguns",dmr:"DMRs",
      sniper:"Sniper Rifles",lmg:"LMGs",pistol:"Pistols",pdw:"PDWs",
      launcher:"Launchers",melee:"Melee",
    } as Record<string,string>)[type],
    weapons:weapons.filter(w=>!w.disabled&&(w.wonder?"wonder":w.category)===type)
      .sort((a,b)=>type==="wonder"
        ? a.name.localeCompare(b.name)
        : a.unlockLevel-b.unlockLevel||a.name.localeCompare(b.name)),
  })).filter(g=>g.weapons.length>0);
}
