import { describe, expect, test } from "bun:test";
import { WEAPONS, activeMeleeWeaponId, resolveLoadout } from "../src/lib/game-data";
import { resolveMatchLoadout } from "../src/lib/match-loadout";
import { weaponAvailability } from "../src/lib/weapon-availability";
import { buildGunGameWeapons } from "../src/lib/gun-game";

const disabled = ["shiv", "baton", "axe"];
const playable = ["knife_tactical", "machete", "hammer"];

describe("disabled melee weapons", () => {
  test("remain in the catalog but are unavailable even when owned", () => {
    for (const id of disabled) {
      const weapon = WEAPONS.find(w => w.id === id)!;
      expect(weapon.category).toBe("melee");
      expect(weapon.disabled).toBe(true);
      expect(weaponAvailability(weapon, 100, new Set([id]))).toBe("disabled");
      expect(weaponAvailability(weapon, 100, new Set())).toBe("disabled");
      expect(activeMeleeWeaponId(id)).toBe("knife_tactical");
    }
    for (const id of playable) {
      expect(WEAPONS.find(w => w.id === id)?.disabled).toBeFalsy();
      expect(activeMeleeWeaponId(id)).toBe(id);
    }
  });

  test("old saved melee choices fall back without carrying over weapon skins", () => {
    for (const id of disabled) {
      const resolved = resolveLoadout({
        primaryWeapon: "rifle_ar", secondaryWeapon: "pistol_side",
        meleeWeapon: id, weaponSkin: "default",
        meleeWeaponSkin: "crimson", playerSkin: "default", attachments: {},
      });
      expect(resolved.melee.id).toBe("knife_tactical");
      expect(resolved.meleeWeaponSkin.id).toBe("default");
    }
  });

  test("multiplayer rejects disabled melee choices supplied by the client", () => {
    for (const id of disabled) {
      const result = resolveMatchLoadout(
        { xp: 0, weaponUnlocks: [], loadout: null },
        {
          weaponId: "rifle_ar", secondaryWeaponId: "pistol_side", meleeWeaponId: id,
          weaponSkinId: "default", meleeWeaponSkinId: "crimson",
          playerSkinId: "default",
          attachments: { sight: null, barrel: null, grip: null, magazine: null },
        },
      );
      expect(result.meleeWeaponId).toBe("knife_tactical");
      expect(result.meleeWeaponSkinId).toBe("default");
    }
  });

  test("Gun Game finishers never include disabled melee", () => {
    for (const random of [0, 0.3, 0.7, 0.999]) {
      const tiers = buildGunGameWeapons("all", 3, () => random);
      expect(tiers).toHaveLength(90);
      for (const id of tiers) expect(disabled).not.toContain(id);
      for (const id of [tiers[29], tiers[59], tiers[89]]) expect(playable).toContain(id);
    }
  });
});
