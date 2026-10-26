import { describe, expect, test } from "bun:test";
import type { LoadoutWire } from "../src/lib/game-protocol";
import { WEAPONS, isPrimaryWeaponCategory } from "../src/lib/game-data";
import {
  rangePrimaryWeapons, rangeSecondaryWeapons, rangeMeleeWeapons,
  rangeWeaponSlot, normalizeRangeLoadout, selectRangeWeapon,
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
  test("primary selector includes only primary-class weapons and wonders", () => {
    expect(rangePrimaryWeapons.length).toBeGreaterThan(0);
    expect(rangePrimaryWeapons.some(w => !!w.wonder)).toBe(true);
    for (const weapon of WEAPONS) {
      const primary = !!weapon.wonder || isPrimaryWeaponCategory(weapon.category);
      expect(rangePrimaryWeapons.some(w => w.id === weapon.id)).toBe(primary);
    }
    expect(rangeWeaponSlot("pistol_side")).toBe("secondary");
    expect(rangeWeaponSlot("knife_tactical")).toBe("melee");
    expect(rangeWeaponSlot("no-such-weapon")).toBeNull();
  });

  test("Try Free routes secondary and melee weapons to the correct slot", () => {
    const sidearm = WEAPONS.find(w => w.category === "pistol" && w.id !== "pistol_side" && !w.wonder);
    const knife = WEAPONS.find(w => w.category === "melee" && w.id !== "knife_tactical" && !w.wonder);
    expect(sidearm).toBeDefined();
    expect(knife).toBeDefined();
    const previewSidearm = selectRangeWeapon(sample, sidearm!.id);
    expect(previewSidearm.weaponId).toBe(sample.weaponId);
    expect(previewSidearm.secondaryWeaponId).toBe(sidearm!.id);
    const previewMelee = selectRangeWeapon(sample, knife!.id);
    expect(previewMelee.weaponId).toBe(sample.weaponId);
    expect(previewMelee.meleeWeaponId).toBe(knife!.id);
    const wonder = WEAPONS.find(w => !!w.wonder)!;
    expect(selectRangeWeapon(sample, wonder.id).weaponId).toBe(wonder.id);
  });

  test("normalizes incompatible or legacy saved presets without showing cosmetics", () => {
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
    expect(legacy.weaponSkinId).toBe("default");
    expect(legacy.secondaryWeaponSkinId).toBe("default");
    expect(legacy.meleeWeaponSkinId).toBe("default");
    expect(legacy.playerSkinId).toBe("default");
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
    expect(rangeMeleeWeapons.every(w => w.category === "melee")).toBe(true);
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
 const grouped=groupedRangeWeapons(rangePrimaryWeapons);
 expect(grouped.some(g=>g.weapons.some(w=>w.id==="wonder_bogfather"))).toBe(false);
 const wonder=grouped.find(g=>g.type==="wonder")!;
 expect(wonder.weapons.map(w=>w.name)).toEqual(
   wonder.weapons.map(w=>w.name).sort((a,b)=>a.localeCompare(b)));
 for(const group of grouped.filter(g=>g.type!=="wonder"))
   expect(group.weapons.map(w=>w.unlockLevel)).toEqual(
     group.weapons.map(w=>w.unlockLevel).sort((a,b)=>a-b));
});
