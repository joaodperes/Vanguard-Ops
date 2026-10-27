import { describe, expect, test } from "bun:test";
import { WEAPON_SKINS, RARITY_COLORS } from "../src/lib/game-data";
import { coatsAllWeaponParts } from "../src/lib/weapon-finish";
describe("weapon finish visuals and rarity", () => {
  test("all ten skins have distinct art briefs", () => {
    expect(WEAPON_SKINS).toHaveLength(10);
    for (const skin of WEAPON_SKINS) expect(skin.artBrief.length).toBeGreaterThan(25);
    expect(new Set(WEAPON_SKINS.map(s => s.artBrief)).size).toBe(WEAPON_SKINS.length);
  });
  test("gold keeps detail while Prestige and Inferno coat the model", () => {
    const skin = (id: string) => WEAPON_SKINS.find(s => s.id === id)!;
    expect(coatsAllWeaponParts(skin("gold"))).toBe(false);
    expect(coatsAllWeaponParts(skin("carbon"))).toBe(false);
    expect(coatsAllWeaponParts(skin("inferno"))).toBe(true);
    expect(coatsAllWeaponParts(skin("prestige_cosmic"))).toBe(true);
    expect(coatsAllWeaponParts(skin("prestige_toxic"))).toBe(true);
  });
  test("prestige skins have Prestige rarity and a defined visual color", () => {
    expect(WEAPON_SKINS.filter(s=>s.rarity === "prestige").map(s=>s.id).sort()).toEqual(["prestige_cosmic","prestige_toxic"]);
    for (const skin of WEAPON_SKINS) expect(RARITY_COLORS[skin.rarity]).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
