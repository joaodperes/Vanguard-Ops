import { describe, expect, test } from "bun:test";
import { resolveFrontierBotWeaponFallback } from "../src/lib/bot-weapon-selection";
import { resolveBotPursuitSpeed } from "../src/lib/bot-movement-rules";
import { MOVEMENT } from "../src/lib/movement-rules";

describe("shared Frontier bot weapon selection", () => {
  const base = {
    primaryWeaponId: "rifle_ar", secondaryWeaponId: "pistol_side",
    meleeWeaponId: "knife_tactical", meleeMagazineSize: 1, now: 10_000,
  };

  test("switches from an empty primary to a loaded secondary", () => {
    expect(resolveFrontierBotWeaponFallback({
      ...base, currentWeaponId: "rifle_ar", ammoInMag: 0, inactiveAmmoInMag: 7,
    })).toEqual({
      weaponId: "pistol_side", activeSlot: "secondary", ammoInMag: 7,
      inactiveAmmoInMag: 0, nextSwitchAt: 10_500,
    });
  });

  test("switches from an empty secondary back to a loaded primary", () => {
    expect(resolveFrontierBotWeaponFallback({
      ...base, currentWeaponId: "pistol_side", ammoInMag: 0, inactiveAmmoInMag: 19,
    })).toMatchObject({ weaponId: "rifle_ar", activeSlot: "primary", ammoInMag: 19 });
  });

  test("falls back to melee when both firearms are empty", () => {
    expect(resolveFrontierBotWeaponFallback({
      ...base, currentWeaponId: "rifle_ar", ammoInMag: 0, inactiveAmmoInMag: 0,
    })).toMatchObject({ weaponId: "knife_tactical", activeSlot: "melee", ammoInMag: 1 });
  });

  test("does not repeatedly switch while already holding melee", () => {
    expect(resolveFrontierBotWeaponFallback({
      ...base, currentWeaponId: "knife_tactical", ammoInMag: 0,
    })).toBeNull();
  });

  test("respects the weapon-switch cooldown and loaded magazines", () => {
    expect(resolveFrontierBotWeaponFallback({
      ...base, currentWeaponId: "rifle_ar", ammoInMag: 0, inactiveAmmoInMag: 5, nextSwitchAt: 10_001,
    })).toBeNull();
    expect(resolveFrontierBotWeaponFallback({
      ...base, currentWeaponId: "rifle_ar", ammoInMag: 2, inactiveAmmoInMag: 5,
    })).toBeNull();
  });
});

describe("shared bot pursuit speed", () => {
  test("matches the established sprint, perk, weapon and environment composition", () => {
    const speed = resolveBotPursuitSpeed({
      moveSpeed: 1.4, carryingFlag: true, flagSpeedMultiplier: 0.82,
      sprinting: true, perkSpeedMultiplier: 1.2, perkBaseSpeedMultiplier: 1.1,
      weaponMoveSpeedMultiplier: 0.9, orbitalMultiplier: 1.15, environmentMultiplier: 0.75,
    });
    const expected = 0.82 * 1.4 * 6 * MOVEMENT.botPursuitMultiplier *
      1.25 * (1.2 / 1.1) * 0.9 * 1.15 * 0.75;
    expect(speed).toBeCloseTo(expected);
  });

  test("uses a neutral perk ratio when the base multiplier is zero", () => {
    expect(resolveBotPursuitSpeed({
      moveSpeed: 1, carryingFlag: false, flagSpeedMultiplier: 0.8,
      sprinting: false, perkSpeedMultiplier: 0, perkBaseSpeedMultiplier: 0,
      weaponMoveSpeedMultiplier: 1,
    })).toBeCloseTo(6 * MOVEMENT.botPursuitMultiplier);
  });
});
