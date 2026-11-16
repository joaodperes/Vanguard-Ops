import { describe, expect, test } from "bun:test";
import { wonderModulesFor } from "../src/lib/wonder-expansion";
import type { LoadoutWire } from "../src/lib/game-protocol";
import { WEAPONS, WEAPON_SKINS, PLAYER_SKINS, isPrimaryWeaponCategory } from "../src/lib/game-data";
import {
  rangePrimaryWeapons, rangeWonderWeapons, rangeSecondaryWeapons, rangeMeleeWeapons,
  rangeWeaponSlot, normalizeRangeLoadout, selectRangeWeapon, rangePrimarySelection, selectRangePrimary,
} from "../src/lib/firing-range-loadout";

const sample: LoadoutWire = {
  weaponId: "rifle_ar",
  secondaryWeaponId: "pistol_side",
  meleeWeaponId: "knife_tactical",
  perkId: "battle_hardened",
  weaponSkinId: "red",
  secondaryWeaponSkinId: "blue",
  meleeWeaponSkinId: "green",
  playerSkinId: "blue",
  attachments: { sight: null, barrel: null, grip: null, magazine: null },
  secondaryAttachments: { sight: null, barrel: null, grip: null, magazine: null },
};

describe("Armory firing range loadout restrictions", () => {
  test("primary selector excludes Wonders, which occupy the distinct slot four", () => {
    expect(rangePrimaryWeapons.length).toBeGreaterThan(0);
    expect(rangePrimaryWeapons.some(w => !!w.wonder)).toBe(false);
    expect(rangeWonderWeapons.every(w => !!w.wonder && !w.disabled)).toBe(true);
    for (const weapon of WEAPONS) {
      const primary = !weapon.disabled && !weapon.wonder && isPrimaryWeaponCategory(weapon.category);
      expect(rangePrimaryWeapons.some(w => w.id === weapon.id)).toBe(primary);
    }
    expect(rangeWeaponSlot("pistol_side")).toBe("secondary");
    expect(rangeWeaponSlot("knife_tactical")).toBe("melee");
    expect(rangeWeaponSlot("no-such-weapon")).toBeNull();
  });

  test("Firing Range selectors preview secondary and melee weapons in the correct slot", () => {
    const sidearm = WEAPONS.find(w => w.category === "pistol" && w.id !== "pistol_side" && !w.wonder);
    const knife = WEAPONS.find(w => w.category === "melee" && w.id !== "knife_tactical" && !w.wonder && !w.disabled);
    expect(sidearm).toBeDefined();
    expect(knife).toBeDefined();
    const previewSidearm = selectRangeWeapon(sample, sidearm!.id);
    expect(previewSidearm.weaponId).toBe(sample.weaponId);
    expect(previewSidearm.secondaryWeaponId).toBe(sidearm!.id);
    const previewMelee = selectRangeWeapon(sample, knife!.id);
    expect(previewMelee.weaponId).toBe(sample.weaponId);
    expect(previewMelee.meleeWeaponId).toBe(knife!.id);
    const wonder = WEAPONS.find(w => !!w.wonder)!;
    const previewWonder=selectRangeWeapon(sample, wonder.id);
    expect(previewWonder.weaponId).toBe(sample.weaponId);
    expect(previewWonder.perkId).toBe("wonder_weapon");
    expect(previewWonder.wonderWeaponId).toBe(wonder.id);
  });

  test("Wonder primary trials use slot-4 gameplay and offer only their own modules", () => {
    const wonder = rangeWonderWeapons.find(w => wonderModulesFor(w.id).length > 0)!;
    expect(wonder).toBeDefined();
    const chosen = selectRangePrimary(sample, wonder.id);
    expect(rangePrimarySelection(chosen)).toBe(wonder.id);
    expect(chosen.weaponId).toBe(sample.weaponId); // valid fallback primary for the engine
    expect(chosen.perkId).toBe("wonder_weapon");
    expect(chosen.wonderWeaponId).toBe(wonder.id);
    const module = wonderModulesFor(wonder.id)[0];
    expect(normalizeRangeLoadout({...chosen,wonderModuleId:module.id}).wonderModuleId).toBe(module.id);
    const wrongModule=rangeWonderWeapons.flatMap(w=>wonderModulesFor(w.id)).find(m=>m.wonderWeaponId!==wonder.id);
    if(wrongModule)expect(normalizeRangeLoadout({...chosen,wonderModuleId:wrongModule.id}).wonderModuleId).toBe("");
    const normal=selectRangePrimary(chosen,"smg_kp");
    expect(rangePrimarySelection(normal)).toBe("smg_kp");
    expect(normal.perkId).toBe("battle_hardened");
    expect(normal.wonderWeaponId).toBe("");
    expect(normal.wonderModuleId).toBe("");
  });

  test("normalizes incompatible saved presets while retaining valid trial cosmetics", () => {
    const legacy = normalizeRangeLoadout({
      ...sample,
      weaponId: "pistol_side",
      secondaryWeaponId: "rifle_ar",
      meleeWeaponId: "rifle_ar",
      attachments: { sight: "nonexistent", barrel: null, grip: null, magazine: null },
    });
    expect(legacy.weaponId).toBe("rifle_ar");
    expect(legacy.secondaryWeaponId).toBe("pistol_side");
    expect(legacy.meleeWeaponId).toBe("knife_tactical");
    expect(legacy.attachments.sight).toBeNull();
    expect(legacy.weaponSkinId).toBe(WEAPON_SKINS.find(s=>s.id===sample.weaponSkinId)?.id??"default");
    expect(legacy.secondaryWeaponSkinId).toBe(WEAPON_SKINS.find(s=>s.id===sample.secondaryWeaponSkinId)?.id??"default");
    expect(legacy.meleeWeaponSkinId).toBe(WEAPON_SKINS.find(s=>s.id===sample.meleeWeaponSkinId)?.id??"default");
    expect(legacy.playerSkinId).toBe(PLAYER_SKINS.find(s=>s.id===sample.playerSkinId)?.id??"default");
    const preview=normalizeRangeLoadout({...sample,primaryReticleId:"reticle_orbit",primaryCharmId:"charm_dice"});
    expect(preview.primaryReticleId).toBe("reticle_orbit");
    expect(preview.primaryCharmId).toBe("charm_dice");
    expect(normalizeRangeLoadout({...sample,primaryReticleId:"invalid"}).primaryReticleId).toBe("classic");
  });

  test("range keeps any valid tactical choice independent of match unlocks", () => {
    expect(normalizeRangeLoadout({...sample,equipmentId:"poison_dart"}).equipmentId).toBe("poison_dart");
    expect(normalizeRangeLoadout({...sample,equipmentId:"mine"}).equipmentId).toBe("mine");
    expect(normalizeRangeLoadout({...sample,equipmentId:"invalid" as any}).equipmentId).toBe("frag");
  });
  test("allows a distinct secondary primary only with Well Prepared", () => {
    const extraPrimary = WEAPONS.find(w => isPrimaryWeaponCategory(w.category) && w.id !== sample.weaponId && !w.wonder)!;
    expect(rangeSecondaryWeapons("battle_hardened", sample.weaponId).some(w => w.id === extraPrimary.id)).toBe(false);
    expect(rangeSecondaryWeapons("well_prepared", sample.weaponId).some(w => w.id === extraPrimary.id)).toBe(true);
    expect(rangeSecondaryWeapons("well_prepared", sample.weaponId).some(w => w.id === sample.weaponId)).toBe(false);
    expect(rangeSecondaryWeapons("well_prepared", sample.weaponId).every(w => !w.wonder)).toBe(true);
    const prepared = normalizeRangeLoadout({ ...sample, perkId: "well_prepared", secondaryWeaponId: extraPrimary.id });
    expect(prepared.secondaryWeaponId).toBe(extraPrimary.id);
    expect(normalizeRangeLoadout({ ...prepared, perkId: "steady" }).secondaryWeaponId).toBe("pistol_side");
    expect(rangeMeleeWeapons.every(w => w.category === "melee" && !w.disabled)).toBe(true);
  });

  test("starting a new weapon trial clears its old incompatible attachments", () => {
    const preview = selectRangeWeapon({ ...sample, attachments: {
      sight: "invalid-attachment", barrel: null, grip: null, magazine: null,
    } }, "smg_kp");
    expect(preview.weaponId).toBe("smg_kp");
    expect(preview.attachments).toEqual({ sight: null, barrel: null, grip: null, magazine: null });
    expect(preview.weaponSkinId).toBe("default");
  });
});

import { groupedRangeWeapons } from "../src/lib/firing-range-loadout";
test("range weapon selectors hide disabled entries and group by type and unlock level",()=>{
 const grouped=groupedRangeWeapons([...rangePrimaryWeapons,...rangeWonderWeapons]);
 expect(grouped.some(g=>g.weapons.some(w=>w.id==="wonder_bogfather"))).toBe(false);
 const wonder=grouped.find(g=>g.type==="wonder")!;
 expect(wonder.weapons.map(w=>w.name)).toEqual(
   wonder.weapons.map(w=>w.name).sort((a,b)=>a.localeCompare(b)));
 for(const group of grouped.filter(g=>g.type!=="wonder"))
   expect(group.weapons.map(w=>w.unlockLevel)).toEqual(
     group.weapons.map(w=>w.unlockLevel).sort((a,b)=>a-b));
});
