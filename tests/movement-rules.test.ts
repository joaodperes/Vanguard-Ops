import { describe, expect, test } from "bun:test";
import {
  MOVEMENT, SPRINT_STAMINA, shouldTouchAutoSprint, responsiveHorizontalVelocity, canUseBufferedJump, runJumpTakeoffVelocity,
  isQuickReadyGrip, sprintRecoverySpreadMultiplier, sprintRecoveryAdsRate,
  SPRINT_RECOVERY_QUICK_MS, SPRINT_RECOVERY_STANDARD_MS,
} from "../src/lib/movement-rules";
import { sprintDrainMultiplier } from "../src/lib/perks";

describe("Movement V2 — horizontal response", () => {
  test("accelerates quickly without overshooting the target", () => {
    const [vx] = responsiveHorizontalVelocity(0, 0, MOVEMENT.walk, 0, true, 0.1);
    expect(vx).toBeGreaterThan(MOVEMENT.walk * 0.85);
    expect(vx).toBeLessThan(MOVEMENT.walk);
  });

  test("brakes more aggressively on ground than in air", () => {
    const ground = responsiveHorizontalVelocity(10, 0, 0, 0, true, 0.1);
    const air = responsiveHorizontalVelocity(10, 0, 0, 0, false, 0.1);
    expect(Math.abs(ground[0])).toBeLessThan(Math.abs(air[0]));
    expect(air[0]).toBeGreaterThan(8);
  });

  test("reverses direction rapidly", () => {
    const [vx] = responsiveHorizontalVelocity(8, 0, -8, 0, true, 0.08);
    expect(vx).toBeLessThan(0);
  });

  test("is frame-rate independent over the same elapsed time", () => {
    const once = responsiveHorizontalVelocity(0, 0, 10, 0, true, 0.1)[0];
    let x = 0;
    for (let i = 0; i < 6; i++) {
      x = responsiveHorizontalVelocity(x, 0, 10, 0, true, 1 / 60)[0];
    }
    expect(Math.abs(once - x)).toBeLessThan(0.00001);
  });

  test("does not create velocity at zero input", () => {
    expect(responsiveHorizontalVelocity(0, 0, 0, 0, true, 1 / 60)).toEqual([0, 0]);
  });
});

describe("Movement V2 — mobile sprint", () => {
  test("engages early, remains latched, and disengages cleanly", () => {
    expect(shouldTouchAutoSprint(0.71, 0.9, false)).toBe(false);
    expect(shouldTouchAutoSprint(0.74, 0.9, false)).toBe(true);
    expect(shouldTouchAutoSprint(0.67, 0.9, true)).toBe(true);
    expect(shouldTouchAutoSprint(0.61, 0.9, true)).toBe(false);
    expect(shouldTouchAutoSprint(0.9, 0.1, true)).toBe(false);
  });
});

describe("Movement V2 — buffered jump", () => {
  test("allows a recent jump on the ground", () => {
    expect(canUseBufferedJump(1000, 900, 1000, true)).toBe(true);
  });

  test("allows jump during brief coyote grace", () => {
    expect(canUseBufferedJump(1000, 990, 930, false)).toBe(true);
  });

  test("rejects expired jump and expired coyote grace", () => {
    expect(canUseBufferedJump(1000, 870, 1000, true)).toBe(false);
    expect(canUseBufferedJump(1000, 990, 860, false)).toBe(false);
    expect(canUseBufferedJump(1000, -Infinity, -Infinity, false)).toBe(false);
  });
});

describe("running jump takeoff momentum",()=>{
  test("a moving jump preserves motion and adds a small forward impulse",()=>{
    const [x,z]=runJumpTakeoffVelocity(MOVEMENT.walk,0,MOVEMENT.walk,0,false);
    expect(x).toBeGreaterThan(MOVEMENT.walk+1);
    expect(z).toBe(0);
  });
  test("sprint jumps carry more momentum than ordinary running jumps",()=>{
    const normal=runJumpTakeoffVelocity(MOVEMENT.walk,0,MOVEMENT.walk,0,false);
    const sprint=runJumpTakeoffVelocity(MOVEMENT.walk*MOVEMENT.sprintMultiplier,0,
      MOVEMENT.walk*MOVEMENT.sprintMultiplier,0,true);
    expect(sprint[0]-MOVEMENT.walk*MOVEMENT.sprintMultiplier).toBeGreaterThan(normal[0]-MOVEMENT.walk);
  });
  test("no free launch impulse from standing still or trying to reverse",()=>{
    expect(runJumpTakeoffVelocity(0,0,8,0,true)).toEqual([0,0]);
    expect(runJumpTakeoffVelocity(8,0,-8,0,true)).toEqual([8,0]);
  });
});

test("temporary Reaper jump boost transfers greater horizontal momentum without creating motion from rest",()=>{
  const normal=runJumpTakeoffVelocity(15,0,15,0,true,1);
  const reaper=runJumpTakeoffVelocity(15,0,15,0,true,1.55);
  expect(reaper[0]).toBeGreaterThan(normal[0]+1);
  expect(runJumpTakeoffVelocity(0,0,15,0,true,1.55)).toEqual([0,0]);
  expect(runJumpTakeoffVelocity(15,0,-15,0,true,1.55)).toEqual([15,0]);
});

describe("Quick-Ready grip replacing Sprint ADS",()=>{
  test("retains the original attachment ID for saved loadouts",()=>{
    expect(isQuickReadyGrip("grip_runner_ads")).toBe(true);
    expect(isQuickReadyGrip("grip_vertical")).toBe(false);
    expect(isQuickReadyGrip(null)).toBe(false);
  });
  test("hipfire settles over 300ms normally but within 95ms with the grip",()=>{
    expect(SPRINT_RECOVERY_STANDARD_MS).toBe(300);
    expect(SPRINT_RECOVERY_QUICK_MS).toBe(95);
    expect(sprintRecoverySpreadMultiplier(1000,0,null)).toBe(1);
    expect(sprintRecoverySpreadMultiplier(1000,2000,null)).toBe(1);
    expect(sprintRecoverySpreadMultiplier(1000,1000,null)).toBeCloseTo(1.35);
    expect(sprintRecoverySpreadMultiplier(1150,1000,null)).toBeCloseTo(1.175);
    expect(sprintRecoverySpreadMultiplier(1150,1000,"grip_runner_ads")).toBe(1);
    expect(sprintRecoverySpreadMultiplier(1095,1000,"grip_runner_ads")).toBe(1);
    expect(sprintRecoverySpreadMultiplier(1300,1000,null)).toBe(1);
    expect(sprintRecoverySpreadMultiplier(1040,1000,"grip_runner_ads"))
      .toBeLessThan(sprintRecoverySpreadMultiplier(1040,1000,null));
  });
  test("sight raise accelerates only just after sprint, not at rest or while sprinting",()=>{
    expect(sprintRecoveryAdsRate(1200,1000,"grip_runner_ads")).toBe(20);
    expect(sprintRecoveryAdsRate(1200,1000,"grip_vertical")).toBe(12);
    expect(sprintRecoveryAdsRate(1400,1000,"grip_runner_ads")).toBe(12);
    expect(sprintRecoveryAdsRate(100,0,"grip_runner_ads")).toBe(12);
  });
});


describe("sprint stamina balance", () => {
  test("base sprint lasts 6.5 seconds; Athlete doubles that to 13 seconds", () => {
    const base = SPRINT_STAMINA.maximum / (SPRINT_STAMINA.drainPerSecond * sprintDrainMultiplier(null));
    const athlete = SPRINT_STAMINA.maximum / (SPRINT_STAMINA.drainPerSecond * sprintDrainMultiplier("athlete"));
    expect(base).toBeCloseTo(6.5, 6);
    expect(athlete).toBeCloseTo(13, 6);
  });

  test("stamina starts recovering after 750ms and fills in 2.5 seconds", () => {
    expect(SPRINT_STAMINA.regenerationDelayMs).toBe(750);
    expect(SPRINT_STAMINA.maximum / SPRINT_STAMINA.regenerationPerSecond).toBeCloseTo(2.5, 6);
    expect(SPRINT_STAMINA.regenerationDelayMs / 1000 +
      SPRINT_STAMINA.maximum / SPRINT_STAMINA.regenerationPerSecond).toBeCloseTo(3.25, 6);
  });

  test("exhaustion requires a 25% refill (about 1.38s including the delay)", () => {
    expect(SPRINT_STAMINA.resumeThreshold).toBe(25);
    const resumeAfterSeconds = SPRINT_STAMINA.regenerationDelayMs / 1000 +
      SPRINT_STAMINA.resumeThreshold / SPRINT_STAMINA.regenerationPerSecond;
    expect(resumeAfterSeconds).toBeCloseTo(1.375, 6);
  });
});
