import { describe, expect, test } from "bun:test";
import { resolveFrontierBotWeaponFallback } from "../src/lib/bot-weapon-selection";
import { resolveBotPursuitSpeed } from "../src/lib/bot-movement-rules";
import { MOVEMENT } from "../src/lib/movement-rules";
import { cloneFrontierLoadout, frontierDropWeapon } from "../src/lib/frontier-loadout-drops";
import { botReloadDurationMs, incrementalReloadStepMs, shouldBotSmartReload, weaponReloadDurationMs } from "../src/lib/weapon-reload-rules";

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


describe("shared Frontier loadout drop rules", () => {
  test("preserves every slot, attachment set and cosmetic when cloning a kit", () => {
    const kit = {
      weaponId: "rifle_ar", secondaryWeaponId: "pistol_side", meleeWeaponId: "knife_tactical",
      weaponSkinId: "skin_primary", secondaryWeaponSkinId: "skin_secondary", meleeWeaponSkinId: "skin_melee",
      playerSkinId: "skin_operator", nameplateId: "nameplate_elite",
      primaryCharmId: "charm_primary", secondaryCharmId: "charm_secondary", meleeCharmId: "charm_melee",
      attachments: { sight: "optic_red", barrel: null, grip: "grip_vertical", magazine: "mag_extended" },
      secondaryAttachments: { sight: null, barrel: "barrel_suppressor", grip: null, magazine: null },
      meleeAttachments: { sight: null, barrel: null, grip: null, magazine: null },
    } as const;
    const copy = cloneFrontierLoadout(kit as any);
    expect(copy).toMatchObject({
      weaponId: "rifle_ar", secondaryWeaponId: "pistol_side", meleeWeaponId: "knife_tactical",
      weaponSkinId: "skin_primary", secondaryWeaponSkinId: "skin_secondary", meleeWeaponSkinId: "skin_melee",
      playerSkinId: "skin_operator", nameplateId: "nameplate_elite",
      primaryCharmId: "charm_primary", secondaryCharmId: "charm_secondary", meleeCharmId: "charm_melee",
    });
    expect(copy.attachments).toEqual(kit.attachments);
    expect(copy.secondaryAttachments).toEqual(kit.secondaryAttachments);
    expect(copy.meleeAttachments).toEqual(kit.meleeAttachments);
    expect(copy.attachments).not.toBe(kit.attachments);
    expect(copy.secondaryAttachments).not.toBe(kit.secondaryAttachments);
  });

  test("uses the currently held slot for the drop's visible weapon metadata", () => {
    const kit = {
      weaponId: "rifle_ar", secondaryWeaponId: "pistol_side",
      weaponSkinId: "skin_primary", secondaryWeaponSkinId: "skin_secondary",
      attachments: { sight: "optic_red", barrel: null, grip: null, magazine: null },
      secondaryAttachments: { sight: null, barrel: "barrel_suppressor", grip: null, magazine: null },
      playerSkinId: "default",
    } as any;
    expect(frontierDropWeapon(kit, "pistol_side")).toMatchObject({
      slot: "secondary", weaponId: "pistol_side", skinId: "skin_secondary",
      attachments: kit.secondaryAttachments,
    });
    expect(frontierDropWeapon(kit, "rifle_ar")).toMatchObject({
      slot: "primary", weaponId: "rifle_ar", skinId: "skin_primary",
      attachments: kit.attachments,
    });
  });

  test("Gunslinger drops represent the secondary slot when the primary is empty", () => {
    const kit = {
      weaponId: "rifle_ar", secondaryWeaponId: "pistol_side", emptyPrimary: true,
      weaponSkinId: "default", secondaryWeaponSkinId: "sidearm_skin",
      attachments: { sight: null, barrel: null, grip: null, magazine: null },
      secondaryAttachments: { sight: null, barrel: null, grip: null, magazine: null },
      playerSkinId: "default",
    } as any;
    expect(frontierDropWeapon(kit, "rifle_ar")).toMatchObject({
      slot: "secondary", weaponId: "pistol_side", skinId: "sidearm_skin",
    });
  });
});


describe("shared bot reload timing", () => {
  test("uses the same incremental shell interval in both simulations", () => {
    expect(Math.abs(incrementalReloadStepMs(0.42, 2.4, 6, 2.4) - 420)).toBeLessThan(1e-9);
    expect(incrementalReloadStepMs(undefined, 2.4, 6, 2.4)).toBeCloseTo(400);
  });

  test("applies Frontier and perk multipliers to conventional reloads", () => {
    expect(botReloadDurationMs({
      reloadStyle: "magazine", effectiveReloadTime: 2, magazineSize: 30,
      weaponReloadTime: 2, frontier: true, perkMultiplier: 0.8,
    })).toBeCloseTo(1792);
  });

  test("incremental weapons schedule one round at a time with perk timing", () => {
    expect(botReloadDurationMs({
      reloadStyle: "incremental", reloadPerRound: 0.35,
      effectiveReloadTime: 2.1, magazineSize: 6, weaponReloadTime: 2.1,
      frontier: true, perkMultiplier: 0.9,
    })).toBeCloseTo(315);
  });
});


describe("shared player reload timing", () => {
  test("composes Frontier, Quickdraw, Survival and single-hand modifiers", () => {
    expect(weaponReloadDurationMs(2, {
      frontier: true, perkMultiplier: 0.8, survivalMultiplier: 0.9,
      akimboSingleHand: true,
    })).toBeCloseTo(2 * 1000 * 1.12 * 0.8 * 0.9 * 0.72);
  });

  test("applies Quickdraw consistently outside Frontier too", () => {
    expect(weaponReloadDurationMs(2.5, { perkMultiplier: 0.8 })).toBe(2000);
  });

  test("keeps ordinary reload timing unchanged without modifiers", () => {
    expect(weaponReloadDurationMs(1.75)).toBe(1750);
  });
});


describe("shared bot smart-reload decision", () => {
  test("requests a smart reload only when low on ammo, safe and capable", () => {
    expect(shouldBotSmartReload(3, 30, false, 0.8, true, 0.01)).toBe(true);
    expect(shouldBotSmartReload(20, 30, false, 0.8, true, 0.01)).toBe(false);
    expect(shouldBotSmartReload(3, 30, true, 0.8, true, 0.01)).toBe(false);
    expect(shouldBotSmartReload(3, 30, false, 0.4, true, 0.01)).toBe(false);
    expect(shouldBotSmartReload(3, 30, false, 0.8, false, 0.01)).toBe(false);
    expect(shouldBotSmartReload(3, 30, false, 0.8, true, 0.02)).toBe(false);
  });
});
