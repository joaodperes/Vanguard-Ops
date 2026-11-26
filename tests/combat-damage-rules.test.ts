import { describe, expect, test } from "bun:test";
import { applyDamageFactors, resolveHealthDamage } from "../src/lib/combat-damage-rules";

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


describe("shared health damage transitions", () => {
  test("applies ordinary damage without allowing negative health", () => {
    expect(resolveHealthDamage(100, 35)).toEqual({ health: 65, appliedDamage: 35, killed: false });
    expect(resolveHealthDamage(20, 80)).toEqual({ health: 0, appliedDamage: 20, killed: true });
  });

  test("does not apply damage to an already dead combatant", () => {
    expect(resolveHealthDamage(0, 50, false)).toEqual({ health: 0, appliedDamage: 0, killed: false });
  });

  test("ignores negative and non-finite damage instead of healing", () => {
    expect(resolveHealthDamage(40, -10)).toEqual({ health: 40, appliedDamage: 0, killed: false });
    expect(resolveHealthDamage(40, Number.NaN)).toEqual({ health: 40, appliedDamage: 0, killed: false });
  });

  test("handles non-finite current health defensively", () => {
    expect(resolveHealthDamage(Number.NaN, 10)).toEqual({ health: 0, appliedDamage: 0, killed: true });
  });
});
