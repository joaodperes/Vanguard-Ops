import { describe, expect, test } from "bun:test";
import { WEAPONS, compatibleAttachments } from "../src/lib/game-data";
import { attachmentViewPermissions } from "../src/lib/armory-attachment-browse";

describe("Armory attachment browsing permissions", () => {
  test("owned but unequipped weapons may browse and buy, but cannot equip attachments", () => {
    const reaver = WEAPONS.find(w => w.name === "Reaver BR");
    expect(reaver).toBeDefined();
    const allowed = compatibleAttachments(reaver!.id, "sight");
    expect(allowed.length).toBeGreaterThan(0);
    expect(attachmentViewPermissions(reaver!.id, "rifle_ar", true)).toEqual({ canEquip: false, canPurchase: true });
  });
  test("unowned weapons remain browsable but require ownership before purchase", () => {
    expect(attachmentViewPermissions("rifle_heavy", "rifle_ar", false)).toEqual({ canEquip: false, canPurchase: false });
  });
  test("only the active owned weapon can equip or remove attachments", () => {
    expect(attachmentViewPermissions("rifle_ar", "rifle_ar", true)).toEqual({ canEquip: true, canPurchase: true });
  });
});
