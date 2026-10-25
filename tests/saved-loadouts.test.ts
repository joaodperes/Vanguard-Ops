import { describe, expect, test } from "bun:test";
import { captureSavedLoadout, cleanLoadoutName, parseSavedLoadouts, MAX_SAVED_LOADOUTS } from "../src/lib/saved-loadouts";

const equipped = {
  primaryWeapon: "rifle_ar", secondaryWeapon: "pistol_side", meleeWeapon: "knife_tactical",
  weaponSkin: "default", secondaryWeaponSkin: "default", meleeWeaponSkin: "default",
  playerSkin: "default", attachments: '{"sight":"red_dot"}',
  secondaryAttachments: "{}", meleeAttachments: "{}",
};

describe("Named loadout slots", () => {
  test("limits the number of serialized presets to five", () => {
    const presets = Array.from({ length: 7 }, (_, i) =>
      captureSavedLoadout(equipped, String(i), "Setup " + i, "battle_hardened"));
    expect(MAX_SAVED_LOADOUTS).toBe(5);
    expect(parseSavedLoadouts(JSON.stringify(presets)).length).toBe(5);
  });
  test("saves weapon slots, skins and attachment snapshots by value", () => {
    const preset = captureSavedLoadout(equipped, "one", "Long Range", "steady");
    expect(preset.name).toBe("Long Range");
    expect(preset.perkId).toBe("steady");
    expect(preset.primaryWeapon).toBe("rifle_ar");
    expect(preset.attachments.sight).toBe("red_dot");
    expect(preset.secondaryAttachments).toEqual({});
  });
  test("sanitizes long or broken names and invalid serialized data", () => {
    expect(cleanLoadoutName("   Heavy   Weapons   ")).toBe("Heavy Weapons");
    expect(cleanLoadoutName("x".repeat(100)).length).toBe(24);
    expect(parseSavedLoadouts("{broken")).toEqual([]);
    expect(parseSavedLoadouts('{"not":"a list"}')).toEqual([]);
  });
});
