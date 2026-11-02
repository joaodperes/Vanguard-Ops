import { describe, expect, test } from "bun:test";
import { WEAPONS, ALL_ATTACHMENT_SLOTS, ATTACHMENTS, compatibleAttachments, weaponAttachmentSlots } from "../src/lib/game-data";
import { attachmentChallenge } from "../src/lib/armory-challenges";
import { turretCanTrack, turretCanAttack, TURRET_ARC_DEG, TURRET_RANGE, TURRET_LIFETIME_MS } from "../src/lib/turret-rules";
import { botHighGroundWaypoint } from "../src/lib/bot-routing";
import { getMap } from "../src/lib/game-protocol";

describe("ordinary firearm attachment catalogue", () => {
  test("every supported firearm slot offers multiple compatible challenge-gated items", () => {
    const firearms = WEAPONS.filter(w => !w.wonder && w.category !== "melee");
    expect(firearms.length).toBeGreaterThan(20);
    for (const weapon of firearms) {
      const slots = weaponAttachmentSlots(weapon);
      // Every conventional firearm, including launchers, has four slots.
      expect(slots).toEqual(ALL_ATTACHMENT_SLOTS);
      for (const slot of ALL_ATTACHMENT_SLOTS) {
        // Weapon-authored slot restrictions are intentional (e.g. no heavy-sniper magazine).
        if (!slots.includes(slot)) {
          expect(compatibleAttachments(weapon.id, slot)).toEqual([]);
          continue;
        }
        const ids = compatibleAttachments(weapon.id, slot);
        expect(ids.length).toBeGreaterThanOrEqual(4);
        for (const id of ids) {
          expect(ATTACHMENTS.some(a => a.id === id && a.slot === slot)).toBe(true);
          const challenge = attachmentChallenge(weapon.id, id);
          expect(challenge).not.toBeNull();
          expect(challenge!.goal).toBeGreaterThan(0);
          expect(challenge!.description.length).toBeGreaterThan(12);
        }
      }
    }
  });
});

describe("Bullet Spitter turret", () => {
  test("offline FFA and Gun Game can target opponents sharing the ffa label", () => {
    expect(turretCanAttack("ffa", "ffa", "ffa", false)).toBe(true);
    expect(turretCanAttack("gungame", "ffa", "ffa", false)).toBe(true);
    expect(turretCanAttack("ffa", "ffa", "ffa", true)).toBe(false);
    expect(turretCanAttack("tdm", "red", "red", false)).toBe(false);
    expect(turretCanAttack("tdm", "red", "blue", false)).toBe(true);
    expect(turretCanAttack("survival", "blue", "red", false)).toBe(true);
  });
  test("140-degree forward sweep with unlimited elevation", () => {
    expect(TURRET_ARC_DEG).toBe(140);
    expect(TURRET_RANGE).toBe(54);
    expect(TURRET_LIFETIME_MS).toBe(45000);
    const origin = [0,0,0] as const;
    expect(turretCanTrack(origin,0,[0,25,15])).toBe(true);
    expect(turretCanTrack(origin,0,[9,12,2])).toBe(false);
    expect(turretCanTrack(origin,0,[0,0,-5])).toBe(false);
    expect(turretCanTrack(origin,0,[0,0,31])).toBe(true);
    expect(turretCanTrack(origin,0,[0,0,55])).toBe(false);
  });
  test("new turret is a 1-charge Wonder Weapon with no attachments", () => {
    const weapon = WEAPONS.find(w=>w.id==="wonder_turret")!;
    expect(weapon.wonder?.kind).toBe("turret");
    expect(weapon.wonder?.maxCharges).toBe(1);
    expect(weapon.attachments).toEqual([]);
  });
});

describe("Terminal bridge navigation", () => {
  test("map offers stair approaches when the goal is on elevated bridge", () => {
    const map = getMap("terminal");
    const stairs = map.cover.filter(c=>c.kind==="stair");
    expect(stairs.length).toBeGreaterThan(10);
    const elevated = botHighGroundWaypoint([22,0,30],[23,6,31],map.cover);
    expect(elevated).not.toBeNull();
    expect(elevated![1]).toBeGreaterThan(0);
  });
});
