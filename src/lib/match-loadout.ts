import { levelForXp } from "./progression";
import { perkById, DEFAULT_PERK_ID, canEquipSecondaryPrimary } from "./perks";
import { WEAPONS, isPrimaryWeaponCategory } from "./game-data";
import { equipmentById } from "./equipment";
import type { LoadoutWire } from "./game-protocol";

/** Shared authoritative entitlement check, independent of cached Player.level. */
export function resolveMatchLoadout(player: {
  xp: number;
  weaponUnlocks: { weaponId: string }[];
  wonderUnlocks?: { weaponId: string }[];
  loadout: { secondaryWeapon: string; primaryReticle: string; secondaryReticle: string; primaryCharm: string; secondaryCharm: string; wonderWeaponId: string; equipmentId?: string } | null;
}, requested: LoadoutWire): LoadoutWire {
  const level = levelForXp(player.xp);
  const perk = perkById(requested.perkId);
  let perkId = perk.unlockLevel <= level ? perk.id : DEFAULT_PERK_ID;
  if(perkId==="wonder_weapon" && !player.wonderUnlocks?.some(w=>w.weaponId===requested.wonderWeaponId && w.weaponId===player.loadout?.wonderWeaponId))perkId=DEFAULT_PERK_ID;
  let secondaryWeaponId = requested.secondaryWeaponId ?? "pistol_side";
  const w = WEAPONS.find(x => x.id === secondaryWeaponId);
  if (!w || w.disabled || w.wonder || w.category === "melee" ||
      (!w.wonder && w.unlockCost > 0 && !player?.weaponUnlocks.some(x => x.weaponId === w.id)) ||
      (isPrimaryWeaponCategory(w.category) &&
      (!canEquipSecondaryPrimary(perkId, level) || !!w.wonder ||
       secondaryWeaponId === requested.weaponId ||
       player?.loadout?.secondaryWeapon !== secondaryWeaponId ||
       (w.unlockCost > 0 && !player?.weaponUnlocks.some(x => x.weaponId === w.id))))) {
    secondaryWeaponId = "pistol_side";
  }
  const selectedPrimary=WEAPONS.find(x=>x.id===requested.weaponId);
  const weaponId=!selectedPrimary || selectedPrimary.disabled || !!selectedPrimary.wonder ? "rifle_ar" : requested.weaponId;
  const candidate=WEAPONS.find(x=>x.id===requested.wonderWeaponId);
  const wonderWeaponId=perkId==="wonder_weapon" && candidate?.wonder && !candidate.disabled &&
    player.wonderUnlocks?.some(x=>x.weaponId===candidate.id) &&
    candidate.id===player.loadout?.wonderWeaponId ? candidate.id : undefined;
  return { ...requested, weaponId, perkId, wonderWeaponId, secondaryWeaponId,
    equipmentId: equipmentById(player.loadout?.equipmentId).id, primaryReticleId:player.loadout?.primaryReticle??"classic", secondaryReticleId:player.loadout?.secondaryReticle??"classic", primaryCharmId:player.loadout?.primaryCharm??"none", secondaryCharmId:player.loadout?.secondaryCharm??"none", meleeCharmId:"none" };
}
