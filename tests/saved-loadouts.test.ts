import { describe, expect, test } from "bun:test";
import { captureSavedLoadout, cleanLoadoutName, parseSavedLoadouts, MAX_SAVED_LOADOUTS } from "../src/lib/saved-loadouts";

const equipped = {
  primaryWeapon: "rifle_ar", secondaryWeapon: "pistol_side", meleeWeapon: "knife_tactical",
  weaponSkin: "default", secondaryWeaponSkin: "default", meleeWeaponSkin: "default",
  playerSkin: "default", primaryReticle:"reticle_orbit",secondaryReticle:"dot",primaryCharm:"charm_tag",secondaryCharm:"none", attachments: '{"sight":"red_dot"}',
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
    expect(preset.primaryReticle).toBe("reticle_orbit");
    expect(preset.secondaryReticle).toBe("dot");
    expect(preset.primaryCharm).toBe("charm_tag");
    expect(preset.secondaryAttachments).toEqual({});
  });
  test("round-trips three independent weapon skins and attachment maps through a preset",()=>{
    const active={...equipped,weaponSkin:"crimson",secondaryWeaponSkin:"neon",meleeWeaponSkin:"arctic",playerSkin:"blue",
      attachments:JSON.stringify({sight:"sight_acog",barrel:"barrel_heavy",grip:"grip_vertical",magazine:"mag_quickdraw"}),
      secondaryAttachments:JSON.stringify({sight:"sight_red_dot",barrel:"barrel_suppressor",grip:null,magazine:"mag_extended"}),
      meleeAttachments:JSON.stringify({sight:null,barrel:null,grip:null,magazine:null}),
    };
    const snapshot=captureSavedLoadout(active,"saved","Mixed Loadout","steady");
    const restored=parseSavedLoadouts(JSON.stringify([snapshot]))[0];
    expect(restored.weaponSkin).toBe("crimson");
    expect(restored.secondaryWeaponSkin).toBe("neon");
    expect(restored.meleeWeaponSkin).toBe("arctic");
    expect(restored.playerSkin).toBe("blue");
    expect(restored.primaryReticle).toBe("reticle_orbit");
    expect(restored.secondaryReticle).toBe("dot");
    expect(restored.primaryCharm).toBe("charm_tag");
    expect(restored.attachments.barrel).toBe("barrel_heavy");
    expect(restored.secondaryAttachments.magazine).toBe("mag_extended");
    expect(restored.meleeAttachments).toEqual({sight:null,barrel:null,grip:null,magazine:null});
    expect(snapshot.attachments).toEqual(restored.attachments);
  });
  test("sanitizes long or broken names and invalid serialized data", () => {
    expect(cleanLoadoutName("   Heavy   Weapons   ")).toBe("Heavy Weapons");
    expect(cleanLoadoutName("x".repeat(100)).length).toBe(24);
    expect(parseSavedLoadouts("{broken")).toEqual([]);
    expect(parseSavedLoadouts('{"not":"a list"}')).toEqual([]);
  });
});
