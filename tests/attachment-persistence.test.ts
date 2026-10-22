import { describe, expect, test } from "bun:test";
import { ALL_ATTACHMENT_SLOTS, WEAPONS, computeEffectiveStats, resolveLoadout, weaponById, weaponSlot } from "../src/lib/game-data";
import { emptyAttachmentMap, attachmentsForWeaponSelection } from "../src/lib/loadout-attachments";
import { sanitizeOwnedAttachments } from "../src/lib/loadout-security";
import { enqueueAttachmentSave, waitForAttachmentSaves } from "../src/lib/attachment-save-queue";

const firearms = WEAPONS.filter(w => !w.wonder && w.category !== "melee");

describe("attachment removal is generic across the weapon catalog", () => {
  test("every weapon can persist an explicit None in each attachment slot", () => {
    for (const weapon of firearms) {
      const cleared = { sight: null, barrel: null, grip: null, magazine: null };
      const updated = attachmentsForWeaponSelection(weapon.id, weapon.id, cleared);
      expect(updated).toEqual(emptyAttachmentMap());
      const read = sanitizeOwnedAttachments(weapon.id, updated, ["sight_red_dot", "mag_extended"]);
      expect(read).toEqual(emptyAttachmentMap());
      for (const slot of ALL_ATTACHMENT_SLOTS) {
        expect(read[slot]).toBeNull();
      }
      // No attachment means the weapon's own default sight, NOT the previously
      // equipped red dot or thermal sight (snipers intentionally have base scopes).
      expect(computeEffectiveStats(weapon, read).sightType).toBe(weapon.baseSightType ?? "iron");
    }
  });

  test("replacing any weapon in either firearm slot never carries over the prior optic", () => {
    for (const previous of firearms) {
      for (const next of firearms) {
        if (previous.id === next.id || weaponSlot(previous.category) !== weaponSlot(next.category)) continue;
        const changed = attachmentsForWeaponSelection(previous.id, next.id);
        expect(changed).toEqual(emptyAttachmentMap());
        const read = sanitizeOwnedAttachments(next.id, changed, ["sight_red_dot", "mag_extended"]);
        expect(computeEffectiveStats(next, read).sightType).toBe(next.baseSightType ?? "iron");
      }
    }
  });

  test("selecting the same weapon without an attachment change leaves the saved map untouched", () => {
    for (const weapon of firearms) {
      expect(attachmentsForWeaponSelection(weapon.id, weapon.id)).toBeUndefined();
    }
  });

  test("explicit attachment choices are preserved instead of being silently discarded", () => {
    const selected = { ...emptyAttachmentMap(), sight: "sight_red_dot" };
    expect(attachmentsForWeaponSelection("rifle_ar", "rifle_heavy", selected)).toEqual(selected);
  });

  test("primary and secondary attachment maps independently resolve the appropriate default sight", () => {
    const loadout = resolveLoadout({
      primaryWeapon: "sniper_lr", secondaryWeapon: "pistol_machine",
      weaponSkin: "default", playerSkin: "default",
      attachments: emptyAttachmentMap(),
      secondaryAttachments: emptyAttachmentMap(),
    });
    expect(loadout.attachments.sight).toBeNull();
    expect(loadout.secondaryAttachments.sight).toBeNull();
    expect(computeEffectiveStats(loadout.weapon, loadout.attachments).sightType).toBe("sniper_scope");
    expect(computeEffectiveStats(loadout.secondary, loadout.secondaryAttachments).sightType).toBe("iron");
    expect(weaponById("rifle_ar").baseSightType ?? "iron").toBe("iron");
  });
});

describe("attachment write order and match-start barrier", () => {
  test("a match waits for rapid sequential attachment clears to finish saving", async () => {
    let releaseFirst!: () => void;
    const blocked = new Promise<void>(resolve => { releaseFirst = resolve; });
    const order: string[] = [];
    const first = enqueueAttachmentSave(async () => { order.push("remove sight"); await blocked; });
    const second = enqueueAttachmentSave(async () => { order.push("remove barrel"); });
    let started = false;
    const launch = waitForAttachmentSaves().then(() => { started = true; });
    await Promise.resolve();
    expect(started).toBe(false);
    expect(order).toEqual(["remove sight"]);
    releaseFirst();
    await Promise.all([first, second, launch]);
    expect(order).toEqual(["remove sight", "remove barrel"]);
    expect(started).toBe(true);
  });

  test("failed attachment writes cannot silently carry on into a match", async () => {
    await expect(enqueueAttachmentSave(async () => { throw new Error("save failed"); }))
      .rejects.toThrow("save failed");
    await expect(waitForAttachmentSaves()).rejects.toThrow("save failed");
    await enqueueAttachmentSave(async () => {});
    await expect(waitForAttachmentSaves()).resolves.toBeUndefined();
  });
});
