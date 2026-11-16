import { describe, expect, test } from "bun:test";
import { weaponAvailability } from "../src/lib/weapon-availability";

const paid = { id: "paid_rifle", unlockLevel: 12, unlockCost: 2200 };
const free = { id: "free_sidearm", unlockLevel: 1, unlockCost: 0 };

describe("loadout weapon availability", () => {
  test("shows level gate while a weapon is below the required level", () => {
    expect(weaponAvailability(paid, 11, new Set())).toBe("level-locked");
  });
  test("shows unlock price, rather than level, for eligible unpurchased weapons", () => {
    expect(weaponAvailability(paid, 12, new Set())).toBe("purchasable");
    expect(weaponAvailability(paid, 25, new Set())).toBe("purchasable");
  });
  test("never shows level or price on an owned weapon, even one bought early", () => {
    expect(weaponAvailability(paid, 1, new Set([paid.id]))).toBe("owned");
    expect(weaponAvailability(paid, 25, new Set([paid.id]))).toBe("owned");
  });
  test("free default weapons remain owned through the free-by-level ownership set", () => {
    expect(weaponAvailability(free, 1, new Set([free.id]))).toBe("owned");
  });
});
