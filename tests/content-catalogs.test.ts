import { MAX_PLAYER_LEVEL } from "../src/lib/progression";
import { describe, expect, test } from "bun:test";
import { validateGameContent } from "../src/lib/content-validation";
import { WEAPONS, WEAPON_CHALLENGES, ATTACHMENTS, WEAPON_SKINS, PLAYER_SKINS } from "../src/lib/game-data";

describe("JSON catalog contract", () => {
  test("all published catalogs and map blueprints satisfy runtime and reference constraints", () => {
    expect(validateGameContent()).toEqual([]);
  });
  test("detects duplicate IDs before a release", () => {
    const errors = validateGameContent({ weapons: [...WEAPONS, { ...WEAPONS[0] }] });
    expect(errors.some(e => e.includes("duplicate ID " + WEAPONS[0].id))).toBe(true);
  });
  test("detects references to non-existent weapons and skins", () => {
    const bad = { ...WEAPON_CHALLENGES[0], id: "broken_challenge", weaponId: "missing_gun", skinId: "missing_skin" };
    const errors = validateGameContent({ weaponChallenges: [...WEAPON_CHALLENGES, bad] });
    expect(errors.some(e => e.includes("unknown weapon missing_gun"))).toBe(true);
    expect(errors.some(e => e.includes("unknown skin missing_skin"))).toBe(true);
  });
  test("detects malformed combat stats and attachment effects", () => {
    const brokenWeapon = { ...WEAPONS[0], stats: { ...WEAPONS[0].stats, fireRate: -10 } };
    const brokenAttachment = { ...ATTACHMENTS[0], effects: { ...ATTACHMENTS[0].effects, recoil: "not-a-number" } };
    const errors = validateGameContent({ weapons: [brokenWeapon, ...WEAPONS.slice(1)], attachments: [brokenAttachment, ...ATTACHMENTS.slice(1)] });
    expect(errors.some(e => e.includes("weapons [0.stats.fireRate]"))).toBe(true);
    expect(errors.some(e => e.includes("attachments [0.effects.recoil]"))).toBe(true);
  });
  test("rejects level gates above the equipment cap instead of shipping unreachable unlocks", () => {
    const broken = { ...WEAPONS[0], unlockLevel: MAX_PLAYER_LEVEL + 1 };
    expect(validateGameContent({ weapons: [broken, ...WEAPONS.slice(1)] }).some(e => e.includes("weapons [0.unlockLevel]"))).toBe(true);
  });
  test("unchanged JSON catalogs retain player-facing stable identifiers", () => {
    expect(WEAPONS.length).toBe(49);
    expect(ATTACHMENTS.length).toBe(45);
    expect(WEAPON_SKINS.length).toBe(10);
    expect(PLAYER_SKINS.length).toBe(8);
    expect(WEAPON_CHALLENGES.length).toBe(189);
    expect(WEAPONS.some(w => w.id === "rifle_ar")).toBe(true);
    expect(WEAPONS.some(w => w.id === "wonder_turret")).toBe(true);
  });
});
