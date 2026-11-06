import { describe, expect, test } from "bun:test";
import {
  sampleWeaponSwapMotion, WEAPON_SWAP_HANDOFF, WEAPON_SWAP_VISUAL_MS,
} from "../src/lib/first-person-animation";

describe("first-person weapon holster and draw", () => {
  test("preserves the existing cosmetic duration and a single handoff", () => {
    expect(WEAPON_SWAP_VISUAL_MS).toBe(450);
    expect(WEAPON_SWAP_HANDOFF).toBe(0.5);
    expect(sampleWeaponSwapMotion(0.499).incoming).toBe(false);
    expect(sampleWeaponSwapMotion(0.5).incoming).toBe(true);
  });

  test("starts and finishes in the exact ready position", () => {
    for (const progress of [0, 1]) {
      const pose = sampleWeaponSwapMotion(progress);
      expect([pose.x, pose.y, pose.z, pose.pitch, pose.roll]).toEqual([0, 0, 0, 0, 0]);
    }
  });

  test("holsters the outgoing model down and to the right with the muzzle lowered", () => {
    const early = sampleWeaponSwapMotion(.2);
    const late = sampleWeaponSwapMotion(.49);
    expect(late.incoming).toBe(false);
    expect(late.x).toBeGreaterThan(early.x);
    expect(late.y).toBeLessThan(early.y);
    // A negative pitch lowers the -Z-facing muzzle; reload tilts it upward.
    expect(late.pitch).toBeLessThan(0);
  });

  test("draws the incoming model upward from below and ends fully level", () => {
    const early = sampleWeaponSwapMotion(.51);
    const late = sampleWeaponSwapMotion(.8);
    expect(early.incoming).toBe(true);
    expect(late.y).toBeGreaterThan(early.y);
    expect(late.x).toBeLessThan(early.x);
    expect(Math.abs(late.roll)).toBeLessThan(Math.abs(early.roll));
  });

  test("both weapons meet below the viewport with no upward model flash", () => {
    const outgoing = sampleWeaponSwapMotion(WEAPON_SWAP_HANDOFF - 0.00001);
    const incoming = sampleWeaponSwapMotion(WEAPON_SWAP_HANDOFF);
    expect(outgoing.y).toBeLessThan(-.79);
    expect(incoming.y).toBeCloseTo(outgoing.y, 4);
    expect(incoming.pitch).toBeLessThan(0);
  });

  test("clamps values outside the visual window", () => {
    expect(sampleWeaponSwapMotion(-2)).toEqual(sampleWeaponSwapMotion(0));
    expect(sampleWeaponSwapMotion(3)).toEqual(sampleWeaponSwapMotion(1));
  });
});
