import { describe, expect, test } from "bun:test";
import { captureSavedLoadout, cleanLoadoutName, parseSavedLoadouts, presetWonderEquipFields, MAX_SAVED_LOADOUTS } from "../src/lib/saved-loadouts";

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
  test("replacing a slot preserves its stable ID/name and updates both reticles and charms", () => {
    const previous = captureSavedLoadout(equipped, "slot-one", "Long Range", "steady");
    const updated = captureSavedLoadout({ ...equipped,
      primaryReticle: "reticle_pulse", secondaryReticle: "classic",
      primaryCharm: "charm_skull", secondaryCharm: "charm_compass",
      attachments: '{"sight":"sight_acog"}',
    }, previous.id, previous.name, "battle_hardened");
    const slots = parseSavedLoadouts(JSON.stringify([updated]));
    expect(slots).toHaveLength(1);
    expect(slots[0].id).toBe(previous.id);
    expect(slots[0].name).toBe(previous.name);
    expect(slots[0].perkId).toBe("battle_hardened");
    expect(slots[0].primaryReticle).toBe("reticle_pulse");
    expect(slots[0].secondaryReticle).toBe("classic");
    expect(slots[0].primaryCharm).toBe("charm_skull");
    expect(slots[0].secondaryCharm).toBe("charm_compass");
    expect(slots[0].attachments.sight).toBe("sight_acog");
  });
  test("captures tactical and an equipped Wonder's module, finish and kill effect", () => {
    const active = {
      ...equipped,
      equipmentId: "cover",
      wonderWeaponId: "wonder_phasebreaker",
      weaponSetups: JSON.stringify({
        wonder_phasebreaker: {
          skin: "wonder_ion_accelerator", moduleId: "overcharged_coil",
          killEffectId: "wonder_kill_rail_fracture", attachments: {},
        },
      }),
    };
    const preset = captureSavedLoadout(active, "wonder", "Phasebreaker", "wonder_weapon");
    expect(preset.equipmentId).toBe("cover");
    expect(preset.wonderCustomization).toEqual({
      moduleId: "overcharged_coil", skinId: "wonder_ion_accelerator",
      killEffectId: "wonder_kill_rail_fracture",
    });
    const loaded = parseSavedLoadouts(JSON.stringify([preset]))[0];
    expect(presetWonderEquipFields(loaded)).toEqual({
      wonderCustomizeWeaponId: "wonder_phasebreaker",
      wonderModuleId: "overcharged_coil", wonderSkinId: "wonder_ion_accelerator",
      wonderKillEffectId: "wonder_kill_rail_fracture",
    });
  });

  test("different presets can remember independent configurations of the same Wonder", () => {
    const base = { ...equipped, wonderWeaponId: "wonder_phasebreaker" };
    const first = captureSavedLoadout({
      ...base, weaponSetups: JSON.stringify({ wonder_phasebreaker: {
        skin: "wonder_ion_accelerator", moduleId: "overcharged_coil",
        killEffectId: "wonder_kill_rail_fracture", attachments: {},
      } }),
    }, "first", "High Impact", "wonder_weapon");
    const second = captureSavedLoadout({
      ...base, weaponSetups: JSON.stringify({ wonder_phasebreaker: {
        skin: "default", moduleId: "magnetized_rounds", killEffectId: "", attachments: {},
      } }),
    }, "second", "Long Range", "wonder_weapon");
    const [savedFirst, savedSecond] = parseSavedLoadouts(JSON.stringify([first, second]));
    expect(savedFirst.wonderCustomization?.moduleId).toBe("overcharged_coil");
    expect(savedSecond.wonderCustomization).toEqual({
      moduleId: "magnetized_rounds", skinId: "", killEffectId: "",
    });
    expect(presetWonderEquipFields(savedSecond).wonderSkinId).toBe("");
    expect(savedFirst.wonderCustomization?.moduleId).toBe("overcharged_coil");
  });

  test("legacy presets and non-Wonder perks leave the global Wonder setup unchanged", () => {
    const old = captureSavedLoadout(equipped, "old", "Legacy", "steady");
    expect(presetWonderEquipFields(old)).toEqual({});
    const legacyWonder = { ...old, perkId: "wonder_weapon", wonderWeaponId: "wonder_phasebreaker" };
    expect(presetWonderEquipFields(parseSavedLoadouts(JSON.stringify([legacyWonder]))[0])).toEqual({});
    const unusedWonder = captureSavedLoadout({
      ...equipped, wonderWeaponId: "wonder_phasebreaker", weaponSetups: "{}",
    }, "no-wonder", "Standard", "steady");
    expect(unusedWonder.wonderCustomization).toBeUndefined();
    expect(presetWonderEquipFields(unusedWonder)).toEqual({});
    const malformedWonder = { ...legacyWonder, wonderCustomization: { moduleId: 42 } };
    expect(parseSavedLoadouts(JSON.stringify([malformedWonder]))[0].wonderCustomization).toBeUndefined();
  });

  test("sanitizes long or broken names and invalid serialized data", () => {
    expect(cleanLoadoutName("   Heavy   Weapons   ")).toBe("Heavy Weapons");
    expect(cleanLoadoutName("x".repeat(100)).length).toBe(24);
    expect(parseSavedLoadouts("{broken")).toEqual([]);
    expect(parseSavedLoadouts('{"not":"a list"}')).toEqual([]);
  });
});
