import { describe, expect, test } from "bun:test";
import { WEAPONS } from "../src/lib/game-data";
import {
  BOT_WONDERS, SURVIVAL_BOT_WONDERS, SURVIVAL_BOT_WEAPONS, SURVIVAL_BOT_PERKS,
  STANDARD_BOT_PERKS, botPerkForMode, botWonderForMode, botPrimaryForMode,
  botSecondaryPrimary, botMovementPerkMultiplier,
} from "../src/lib/bot-loadouts";
import { BOT_ELIGIBLE_WEAPONS } from "../src/lib/bot-archetypes";

describe("bot perk and weapon policy", () => {
  test("excludes Battle-Hardened in every mode", () => {
    expect(STANDARD_BOT_PERKS).not.toContain("battle_hardened");
    expect(SURVIVAL_BOT_PERKS).not.toContain("battle_hardened");
    for(const mode of ["ffa", "tdm", "gungame", "survival"] as const)
      for(const roll of [0, .15, .4, .8, .999])
        expect(botPerkForMode(mode,20,()=>roll)).not.toBe("battle_hardened");
  });
  test("normal bots include conventional launchers, but not Wonder primaries", () => {
    expect(BOT_ELIGIBLE_WEAPONS.some(w=>w.category==="launcher")).toBe(true);
    expect(BOT_ELIGIBLE_WEAPONS.every(w=>!w.disabled&&!w.wonder&&!w.special)).toBe(true);
  });
  test("Survival lists contain available conventional weapons, launchers, and rare Wonders", () => {
    expect(SURVIVAL_BOT_WEAPONS.length).toBeGreaterThan(10);
    expect(SURVIVAL_BOT_WEAPONS.some(w=>w.category==="launcher")).toBe(true);
    expect(SURVIVAL_BOT_WEAPONS.every(w=>!w.disabled&&!w.wonder&&!w.special)).toBe(true);
    expect(SURVIVAL_BOT_WONDERS.length).toBeGreaterThan(0);
    expect(SURVIVAL_BOT_WONDERS.every(w=>!!w.wonder && BOT_WONDERS.includes(w))).toBe(true);
    expect(botPerkForMode("survival",1,()=>0)).not.toBe("wonder_weapon");
    expect(botPerkForMode("survival",12,()=>0)).toBe("wonder_weapon");
  });
  test("all selected IDs exist in their intended pool", () => {
    for(const roll of [0,.2,.5,.9,.999]) {
      const r=()=>roll;
      expect(SURVIVAL_BOT_WEAPONS.some(w=>w.id===botPrimaryForMode("survival",r))).toBe(true);
      expect(SURVIVAL_BOT_WONDERS.some(w=>w.id===botWonderForMode("survival",r))).toBe(true);
      expect(BOT_WONDERS.some(w=>w.id===botWonderForMode("tdm",r))).toBe(true);
      const primary=botPrimaryForMode("ffa",r);
      const secondary=botSecondaryPrimary(primary,r);
      expect(primary).not.toBe(secondary);
      expect(WEAPONS.some(w=>w.id===secondary)).toBe(true);
    }
  });
  test("Lightweight moves bots faster, Athlete improves sustained sprint only", () => {
    expect(botMovementPerkMultiplier("lightweight",false)).toBe(1.12);
    expect(botMovementPerkMultiplier("athlete",false)).toBe(1);
    expect(botMovementPerkMultiplier("athlete",true)).toBeGreaterThan(1);
  });
});