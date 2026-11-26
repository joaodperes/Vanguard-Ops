import { describe, expect, test } from "bun:test";
import { frontierMovementSpeed, frontierWeaponIdAllowed } from "../src/lib/game-mode-rules";

describe("Frontier standard movement and weapon slots", () => {
  test("uses standard movement speed whether walking or sprinting", () => {
    expect(frontierMovementSpeed(6, false)).toBe(6);
    expect(frontierMovementSpeed(6, true)).toBe(6);
  });
  test("allows the configured melee slot without widening the firearm whitelist", () => {
    expect(frontierWeaponIdAllowed("knife_tactical")).toBe(false);
    expect(frontierWeaponIdAllowed("sniper_scout")).toBe(true);
    expect(frontierWeaponIdAllowed("rifle_ar")).toBe(false);
  });
});
