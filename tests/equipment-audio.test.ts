import { describe, expect, test } from "bun:test";
import { EQUIPMENT } from "../src/lib/equipment";
import { equipmentSoundFor, equipmentSoundVolume } from "../src/lib/equipment-audio";
import { soundChannelFor, type SfxName } from "../src/lib/sound";

describe("tactical equipment sound cues", () => {
  test("all equipment has the expected release or deployment feedback", () => {
    for (const item of EQUIPMENT) {
      if (item.id === "mine") expect(equipmentSoundFor(item.id, "placed")).toBe("equipment_mine_arm");
      else if (item.id === "cover") expect(equipmentSoundFor(item.id, "deploy")).toBe("equipment_cover");
      else expect(equipmentSoundFor(item.id, "release")).toBe("equipment_throw");
    }
  });

  test("impact sounds differentiate lethal explosives and utility effects", () => {
    expect(equipmentSoundFor("frag", "impact")).toBe("equipment_frag");
    expect(equipmentSoundFor("flashbang", "impact")).toBe("equipment_flash");
    expect(equipmentSoundFor("taser", "impact")).toBe("equipment_taser");
    expect(equipmentSoundFor("knives", "impact")).toBe("equipment_impact");
    expect(equipmentSoundFor("poison_dart", "impact")).toBe("equipment_poison");
    expect(equipmentSoundFor("mine", "triggered")).toBe("equipment_mine_detonate");
    expect(equipmentSoundFor("mine", "impact")).toBeNull();
    expect(equipmentSoundFor("cover", "release")).toBeNull();
  });

  test("throwing follows weapon mixer; detonations follow combat mixer, never UI", () => {
    expect(soundChannelFor("equipment_throw")).toBe("weapons");
    for (const name of ["equipment_impact","equipment_frag","equipment_flash","equipment_taser",
      "equipment_mine_arm","equipment_mine_detonate","equipment_cover","equipment_poison"] as SfxName[])
      expect(soundChannelFor(name)).toBe("combat");
  });

  test("attenuation is strongest nearby and silent beyond its audible radius", () => {
    expect(equipmentSoundVolume(0)).toBeCloseTo(0.9);
    expect(equipmentSoundVolume(10)).toBeGreaterThan(equipmentSoundVolume(30));
    expect(equipmentSoundVolume(30)).toBeGreaterThan(equipmentSoundVolume(54));
    expect(equipmentSoundVolume(55)).toBe(0);
    expect(equipmentSoundVolume(999)).toBe(0);
    expect(equipmentSoundVolume(-1)).toBe(0);
    expect(equipmentSoundVolume(Number.NaN)).toBe(0);
  });
});
