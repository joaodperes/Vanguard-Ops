import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SURVIVAL_GOAL, normalizeSurvivalTier, survivalWavesCleared, survivalPrepSeconds,
  survivalIsBossWave, survivalWaveMutators, survivalBotDifficulty, survivalUnlocked,
  survivalRecordMode, ZERO_SURVIVAL_PROGRESS,
} from "../src/lib/survival";

describe("survival difficulty progression", () => {
  test("standard ramps skill over 30 waves without a second bot difficulty selector",()=>{
    expect(survivalBotDifficulty("default",1)).toBe("easy");
    expect(survivalBotDifficulty("default",10)).toBe("normal");
    expect(survivalBotDifficulty("default",20)).toBe("hard");
    expect(survivalBotDifficulty("default",28)).toBe("veteran");
    expect(survivalBotDifficulty("hard",7)).toBe("hard");
    expect(survivalBotDifficulty("nightmare",1)).toBe("veteran");
    const standard=survivalWaveMutators("default",10);
    const hard=survivalWaveMutators("hard",10);
    expect(standard.spawnMul).toBeLessThan(hard.spawnMul);
    expect(standard.damageMul).toBeLessThan(hard.damageMul);
    expect(standard.healthMul).toBeLessThan(hard.healthMul);
  });
  test("standard caps at a thirty-wave victory", () => {
    expect(DEFAULT_SURVIVAL_GOAL).toBe(30);
    expect(survivalWavesCleared(30,true)).toBe(29);
    expect(survivalWavesCleared(30,false)).toBe(30);
    expect(survivalWavesCleared(0,false)).toBe(0);
  });
  test("preparation starts at two seconds and caps at five by wave ten",()=>{
    expect(survivalPrepSeconds(1)).toBe(2);
    expect(survivalPrepSeconds(4)).toBe(3);
    expect(survivalPrepSeconds(7)).toBe(4);
    expect(survivalPrepSeconds(10)).toBe(5);
    expect(survivalPrepSeconds(100)).toBe(5);
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
