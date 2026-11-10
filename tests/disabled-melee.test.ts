import { describe, expect, test } from "bun:test";
import { WEAPONS, activeMeleeWeaponId, isStandardMeleeWeapon, resolveLoadout } from "../src/lib/game-data";
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

  test("Seismic Lance stays Wonder-only despite its melee combat category", () => {
    const lance = WEAPONS.find(w => w.id === "wonder_seismic")!;
    expect(lance.category).toBe("melee");
    expect(lance.wonder?.kind).toBe("seismic");
    expect(WEAPONS.filter(w => !!w.wonder && !w.disabled)).toContain(lance);
    expect(isStandardMeleeWeapon(lance)).toBe(false);
    expect(WEAPONS.filter(isStandardMeleeWeapon).map(w => w.id)).not.toContain(lance.id);
    expect(activeMeleeWeaponId(lance.id)).toBe("knife_tactical");

    // Legacy saves cannot move a Wonder into ordinary melee, or carry its skin.
    const resolved = resolveLoadout({
      primaryWeapon: "rifle_ar", secondaryWeapon: "pistol_side",
      meleeWeapon: lance.id, weaponSkin: "default",
      meleeWeaponSkin: "crimson", playerSkin: "default", attachments: {},
    });
    expect(resolved.melee.id).toBe("knife_tactical");
    expect(resolved.meleeWeaponSkin.id).toBe("default");

    // Even a player who owns Seismic Lance cannot inject it as ordinary melee
    // through their multiplayer loadout.
    const server = resolveMatchLoadout(
      { xp: 0, weaponUnlocks: [], wonderUnlocks: [{ weaponId: lance.id }], loadout: null },
      {
        weaponId: "rifle_ar", secondaryWeaponId: "pistol_side",
        meleeWeaponId: lance.id, meleeWeaponSkinId: "crimson",
        weaponSkinId: "default", playerSkinId: "default",
        attachments: { sight: null, barrel: null, grip: null, magazine: null },
      },
    );
    expect(server.meleeWeaponId).toBe("knife_tactical");
    expect(server.meleeWeaponSkinId).toBe("default");

    expect(buildGunGameWeapons("all", 1, () => 0.5)).not.toContain(lance.id);
  });

});
