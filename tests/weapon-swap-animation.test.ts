import { describe, expect, test } from "bun:test";
import {
  sampleWeaponSwapMotion, sampleRiotShieldSwapMotion, WEAPON_SWAP_HANDOFF, WEAPON_SWAP_VISUAL_MS,
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

describe("Bulwark first-person shield draw", () => {
  test("retains the existing holster motion while the shield is outgoing", () => {
    for (const p of [0, .2, .499]) {
      const gun = sampleWeaponSwapMotion(p);
      const shield = sampleRiotShieldSwapMotion(p);
      expect(shield.x).toBeCloseTo(gun.x);
      expect(shield.y).toBeCloseTo(gun.y * 1.45);
      expect(shield.roll).toBeCloseTo(gun.roll);
      expect(shield.yaw).toBe(0);
    }
  });

  test("starts the incoming shield out of view behind the left shoulder", () => {
    const atHandoff = sampleRiotShieldSwapMotion(WEAPON_SWAP_HANDOFF);
    expect(atHandoff.x).toBeLessThan(-1.5);
    expect(atHandoff.y).toBeLessThan(-.6);
    expect(atHandoff.yaw).toBeLessThan(-.7);
    expect(atHandoff.z).toBeGreaterThan(0);
  });

  test("sweeps the incoming shield up and right, rotating into guard", () => {
    const early = sampleRiotShieldSwapMotion(.6);
    const mid = sampleRiotShieldSwapMotion(.75);
    const late = sampleRiotShieldSwapMotion(.9);
    expect(early.x).toBeLessThan(mid.x);
    expect(mid.x).toBeLessThan(late.x);
    expect(early.y).toBeLessThan(mid.y);
    expect(mid.y).toBeLessThan(late.y);
    expect(Math.abs(early.yaw)).toBeGreaterThan(Math.abs(mid.yaw));
    expect(Math.abs(mid.yaw)).toBeGreaterThan(Math.abs(late.yaw));
    // Keep a visible, progressive approach rather than jumping to ready.
    expect(mid.x).toBeLessThan(-.3);
    expect(mid.x).toBeGreaterThan(-.6);
  });

  test("returns exactly to its original guard orientation without extending the swap", () => {
    const rest = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };
    expect(sampleRiotShieldSwapMotion(-1)).toEqual(rest);
    expect(sampleRiotShieldSwapMotion(1)).toEqual(rest);
    expect(sampleRiotShieldSwapMotion(2)).toEqual(rest);
    expect(WEAPON_SWAP_VISUAL_MS).toBe(450);
  });
});
