import { describe, expect, test } from "bun:test";
import { buildGunGameWeapons, gunGameMeleeShortcutWeapon } from "../src/lib/gun-game";
import { weaponById } from "../src/lib/game-data";

describe("Gun Game F melee shortcut", () => {
  test("does not give firearm tiers a free loadout knife attack", () => {
    const weapons = buildGunGameWeapons("all", 1, () => 0);
    const last = weapons.length - 1;
    expect(weaponById(weapons[last]).category).toBe("melee");
    expect(gunGameMeleeShortcutWeapon(0, weapons, weapons[0])).toBeNull();
    expect(gunGameMeleeShortcutWeapon(last - 1, weapons, weapons[last - 1])).toBeNull();
    expect(gunGameMeleeShortcutWeapon(0, weapons, "knife_tactical")).toBeNull();
  });

  test("F uses the actual final-tier melee weapon, including randomly chosen variants", () => {
    for (const draw of [0, 0.5, 0.999]) {
      const weapons = buildGunGameWeapons("all", 1, () => draw);
      const finalIndex = weapons.length - 1;
      const equipped = weapons[finalIndex];
      expect(weaponById(equipped).category).toBe("melee");
      expect(gunGameMeleeShortcutWeapon(finalIndex, weapons, equipped)).toBe(equipped);
    }
  });

  test("supports melee checkpoints in expanded Gun Game without bypassing other tiers", () => {
    const weapons = buildGunGameWeapons("cqc", 3, () => 0);
    expect(weapons).toHaveLength(90);
    for (const idx of [29, 59, 89]) {
      expect(gunGameMeleeShortcutWeapon(idx, weapons, weapons[idx])).toBe(weapons[idx]);
      expect(gunGameMeleeShortcutWeapon(idx - 1, weapons, weapons[idx - 1])).toBeNull();
    }
  });

  test("rejects invalid or out-of-sync progression/weapon pairs", () => {
    const weapons = buildGunGameWeapons("all", 1, () => 0);
    const index = weapons.length - 1;
    expect(gunGameMeleeShortcutWeapon(index, weapons, weapons[index - 1])).toBeNull();
    expect(gunGameMeleeShortcutWeapon(index - 1, weapons, weapons[index])).toBeNull();
    expect(gunGameMeleeShortcutWeapon(-1, weapons, weapons[index])).toBeNull();
    expect(gunGameMeleeShortcutWeapon(weapons.length, weapons, weapons[index])).toBeNull();
    expect(gunGameMeleeShortcutWeapon(NaN, weapons, weapons[index])).toBeNull();
  });
});
