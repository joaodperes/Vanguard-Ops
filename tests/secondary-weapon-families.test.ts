import { describe, expect, test } from "bun:test";
import {
  WEAPONS, ALL_ATTACHMENT_SLOTS, isPrimaryWeaponCategory, weaponSlot,
  weaponById, projectileSplashRadius, compatibleAttachments,
} from "../src/lib/game-data";
import { skinChallengesForWeaponAndSkin, attachmentChallenge } from "../src/lib/armory-challenges";
import { buildGunGameWeapons, GUN_GAME_BASE_TIERS, canCompleteGunGame } from "../src/lib/gun-game";
import { WEAPON_VISUALS } from "../src/lib/weapon-models";
import { validateGameContent } from "../src/lib/content-validation";

const SECONDARY = ["pistol", "pdw", "launcher"] as const;
const NEW = ["pistol_ghost", "pistol_bastion", "pdw_mamba", "pdw_sentinel", "launcher_breach", "launcher_swarm"];
const ORIGINAL = {
  pistol_side: "pistol", pistol_burst: "pistol", pistol_magnum: "pistol",
  pistol_arc: "pistol", pistol_machine: "pdw", launcher_rocket: "launcher",
};

describe("secondary family catalog and permanent IDs", () => {
  test("all regular families are multiples of three, including 6/3/3 secondaries", () => {
    const regular = WEAPONS.filter(w => !w.wonder);
    expect(regular).toHaveLength(42);
    const counts = new Map<string, number>();
    for (const w of regular) counts.set(w.category, (counts.get(w.category) ?? 0) + 1);
    for (const count of counts.values()) expect(count % 3).toBe(0);
    expect(SECONDARY.map(cat => counts.get(cat))).toEqual([6, 3, 3]);
    expect(regular.some(w => (w.category as string) === "sidearm")).toBe(false);
    expect(WEAPONS.filter(w => w.wonder)).toHaveLength(7);
  });
  test("old persisted IDs keep their identity and original slot", () => {
    for (const [id, category] of Object.entries(ORIGINAL)) {
      const w = WEAPONS.find(w => w.id === id);
      expect(w?.category).toBe(category);
      expect(weaponSlot(w!.category)).toBe("secondary");
    }
    expect(weaponById("pistol_side").unlockCost).toBe(0);
    expect(weaponById("pistol_side").unlockLevel).toBe(1);
    expect(new Set(WEAPONS.map(w => w.id)).size).toBe(WEAPONS.length);
  });
  test("Well Prepared still gates primary SMGs and other long guns", () => {
    for (const category of SECONDARY) {
      expect(weaponSlot(category)).toBe("secondary");
      expect(isPrimaryWeaponCategory(category)).toBe(false);
    }
    for (const category of ["assault", "smg", "shotgun", "dmr", "sniper", "lmg"] as const) {
      expect(weaponSlot(category)).toBe("primary");
      expect(isPrimaryWeaponCategory(category)).toBe(true);
    }
    expect(weaponSlot("melee")).toBe("melee");
    expect(isPrimaryWeaponCategory("melee")).toBe(false);
  });
  test("all six new regular weapons have visuals, mastery and usable category attachments", () => {
    for (const id of NEW) {
      const w = WEAPONS.find(w => w.id === id)!;
      expect(w).toBeDefined();
      expect(w.wonder).toBeUndefined();
      expect(WEAPON_VISUALS[id]).toBeDefined();
      expect(w.stats.magSize).toBeGreaterThan(0);
      expect(w.unlockCost).toBeGreaterThan(0);
      for (const skin of ["arctic", "crimson", "emerald", "gold"]) {
        expect(skinChallengesForWeaponAndSkin(id, skin).length).toBeGreaterThan(0);
      }
      for (const slot of ALL_ATTACHMENT_SLOTS) {
        const ids = compatibleAttachments(id, slot);
        expect(ids.length).toBeGreaterThanOrEqual(4);
        expect(attachmentChallenge(id, ids[0])).not.toBeNull();
        if (w.category === "launcher") {
          expect(ids).not.toContain("barrel_suppressor");
          if (slot === "barrel" || slot === "grip") {
            expect(ids.some(id => id.startsWith(slot + "_launcher_"))).toBe(true);
          }
        }
      }
    }
  });
});
describe("catalog-driven launcher ballistics", () => {
  test("each conventional launcher has a separate finite blast radius", () => {
    const radii = { launcher_rocket: 1.9, launcher_breach: 2.9, launcher_swarm: 9.5 };
    for (const [id, radius] of Object.entries(radii)) {
      const w = weaponById(id);
      expect(w.category).toBe("launcher");
      expect(w.explosive?.radius).toBe(radius);
      expect(projectileSplashRadius(w)).toBe(radius);
    }
    expect(weaponById("pistol_side").explosive).toBeUndefined();
    expect(projectileSplashRadius(weaponById("wonder_singularity"))).toBe(
      weaponById("wonder_singularity").wonder?.radius!,
    );
  });
  test("validation rejects a rocket with missing or invalid blast definition", () => {
    const weapons = WEAPONS.map(w => w.id === "launcher_breach"
      ? { ...w, explosive: undefined } : w);
    expect(validateGameContent({ weapons }).some(e => e.includes("launcher requires a positive explosive radius"))).toBe(true);
  });
  test("Gun Game has distinct regular firearms followed by any standard launcher and melee", () => {
    for (const preset of ["all", "cqc", "long_range"]) {
      const selection = buildGunGameWeapons(preset, 2, () => .38);
      expect(selection).toHaveLength(GUN_GAME_BASE_TIERS * 2);
      for (let start = 0; start < selection.length; start += GUN_GAME_BASE_TIERS) {
        const stage = selection.slice(start, start + GUN_GAME_BASE_TIERS);
        expect(new Set(stage).size).toBe(GUN_GAME_BASE_TIERS);
        expect(weaponById(stage.at(-2)!).category).toBe("launcher");
        expect(weaponById(stage.at(-1)!).category).toBe("melee");
        expect(stage.slice(0, -2).every(id => weaponById(id).category !== "launcher")).toBe(true);
      }
      expect(canCompleteGunGame(selection.length - 1, selection, selection.at(-1)!)).toBe(true);
      expect(canCompleteGunGame(selection.length - 2, selection, selection.at(-2)!)).toBe(false);
    }
    const low = buildGunGameWeapons("all",1,()=>0);
    const high = buildGunGameWeapons("all",1,()=>.999);
    expect(low.at(-2)).not.toBe(high.at(-2));
    expect(low.at(-1)).not.toBe(high.at(-1));
    const bad = [...low]; bad[bad.length-2] = "pistol_side";
    expect(canCompleteGunGame(bad.length-1,bad,bad.at(-1)!)).toBe(false);
    {
    }
  });
});
