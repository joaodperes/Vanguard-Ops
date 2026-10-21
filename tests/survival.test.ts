import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SURVIVAL_GOAL, normalizeSurvivalTier, survivalWavesCleared,
  survivalIsBossWave, survivalWaveMutators, survivalUnlocked,
  survivalRecordMode, ZERO_SURVIVAL_PROGRESS,
} from "../src/lib/survival";

describe("survival difficulty progression", () => {
  test("standard caps at a thirty-wave victory", () => {
    expect(DEFAULT_SURVIVAL_GOAL).toBe(30);
    expect(survivalWavesCleared(30,true)).toBe(29);
    expect(survivalWavesCleared(30,false)).toBe(30);
    expect(survivalWavesCleared(0,false)).toBe(0);
  });
  test("unlock chain requires each preceding milestone", () => {
    expect(survivalUnlocked("default",ZERO_SURVIVAL_PROGRESS)).toBe(true);
    expect(survivalUnlocked("hard",ZERO_SURVIVAL_PROGRESS)).toBe(false);
    const hard={...ZERO_SURVIVAL_PROGRESS,defaultWins:1};
    expect(survivalUnlocked("hard",hard)).toBe(true);
    expect(survivalUnlocked("elite",hard)).toBe(false);
    const elite={...hard,hardBest:20};
    expect(survivalUnlocked("elite",elite)).toBe(true);
    expect(survivalUnlocked("nightmare",elite)).toBe(false);
    expect(survivalUnlocked("nightmare",{...elite,eliteBest:20})).toBe(true);
  });
  test("hard changes every five waves, elite every wave", () => {
    expect(survivalWaveMutators("hard",1).names).toEqual(survivalWaveMutators("hard",5).names);
    expect(survivalWaveMutators("hard",6).names).not.toEqual(survivalWaveMutators("hard",5).names);
    expect(survivalWaveMutators("elite",1).names).not.toEqual(survivalWaveMutators("elite",2).names);
  });
  test("nightmare stacks all types instead of rotating", () => {
    const five=survivalWaveMutators("nightmare",5);
    const six=survivalWaveMutators("nightmare",6);
    expect(five.names).toHaveLength(5);
    expect(six.levels.swarm).toBe(2);
    expect(six.levels.frenzy).toBe(1);
    expect(six.healthMul).toBeGreaterThanOrEqual(five.healthMul);
  });
  test("bosses only occur on elite and nightmare decades", () => {
    for (const tier of ["elite","nightmare"] as const) {
      expect(survivalIsBossWave(tier,10)).toBe(true);
      expect(survivalIsBossWave(tier,20)).toBe(true);
      expect(survivalIsBossWave(tier,9)).toBe(false);
    }
    expect(survivalIsBossWave("hard",10)).toBe(false);
    expect(survivalIsBossWave("default",30)).toBe(false);
  });
  test("tier serialization is stable and invalid values fall back", () => {
    expect(survivalRecordMode("default")).toBe("survival");
    expect(survivalRecordMode("hard")).toBe("survival_hard");
    expect(survivalRecordMode("nightmare")).toBe("survival_nightmare");
    expect(normalizeSurvivalTier("not-a-tier")).toBe("default");
  });
});
