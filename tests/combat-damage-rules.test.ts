import { describe, expect, test } from "bun:test";
import { applyDamageFactors } from "../src/lib/combat-damage-rules";

describe("shared combat damage rules", () => {
  test("returns base damage unchanged when no modifiers are supplied", () => {
    expect(applyDamageFactors(25)).toBe(25);
  });

  test("composes modifiers multiplicatively in both simulations", () => {
    expect(applyDamageFactors(100, 0.65, 1.2, 0.8)).toBeCloseTo(62.4);
  });

  test("supports zero damage modifiers", () => {
    expect(applyDamageFactors(50, 0)).toBe(0);
  });
});
