import { describe, expect, test } from "bun:test";
import { WEAPONS, compatibleAttachments, computeEffectiveStats, weaponById } from "../src/lib/game-data";
import { MAX_HEALTH } from "../src/lib/game-protocol";
import {
  BOT_WONDERS, SURVIVAL_BOT_WONDERS, SURVIVAL_BOT_WEAPONS, SURVIVAL_BOT_PERKS,
  STANDARD_BOT_PERKS, BOT_ARCHETYPE_PERKS, botPerkForMode, botWonderForMode, botPrimaryForMode,
  botSecondaryPrimary, botMovementPerkMultiplier, botAttachmentsForMode, botActiveAttachments,
  botMagazineCapacity, emptyBotAttachments, isSurvivalOneShotWeapon,
} from "../src/lib/bot-loadouts";
import { BOT_ELIGIBLE_WEAPONS, botArchetypeWeapons, type BotArchetype } from "../src/lib/bot-archetypes";

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
  test("Survival bots cannot spawn with a one-trigger full-health kill weapon", () => {
    // A close-range body hit, an ideal shotgun pellet grouping, and a possible
    // headshot must all remain nonlethal against a fresh 100-HP operative.
    expect(SURVIVAL_BOT_WEAPONS.every(w => !isSurvivalOneShotWeapon(w))).toBe(true);
    for (const w of SURVIVAL_BOT_WEAPONS) {
      expect(w.stats.damage * (w.stats.pellets ?? 1) * Math.max(1, w.stats.headshotMult ?? 1))
        .toBeLessThan(MAX_HEALTH);
    }
    for (const id of ["launcher_rocket", "shotgun_br", "shotgun_combat", "pistol_magnum", "sniper_heavy"]) {
      expect(isSurvivalOneShotWeapon(weaponById(id))).toBe(true);
      expect(SURVIVAL_BOT_WEAPONS.some(w => w.id === id)).toBe(false);
    }
    // Still keep weapon variety where one trigger cannot kill at full HP.
    for (const id of ["launcher_breach", "shotgun_auto", "dmr_whisper", "rifle_ar"]) {
      expect(SURVIVAL_BOT_WEAPONS.some(w => w.id === id)).toBe(true);
    }
    // Cover the entire random selection domain, not just a handful of examples.
    for (let i = 0; i < SURVIVAL_BOT_WEAPONS.length; i++) {
      const id = botPrimaryForMode("survival", () => (i + .5) / SURVIVAL_BOT_WEAPONS.length);
      expect(isSurvivalOneShotWeapon(weaponById(id))).toBe(false);
    }
    // RL-7 remains legal in PvP; only the Survival enemy pool changes.
    expect(BOT_ELIGIBLE_WEAPONS.some(w => w.id === "launcher_rocket")).toBe(true);
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
  test("each PvP personality selects only compatible perks, excluding forced-tier perks in Gun Game", () => {
    for (const role of ["rusher", "rifleman", "marksman", "support"] as BotArchetype[]) {
      const options = BOT_ARCHETYPE_PERKS[role];
      expect(options.length).toBeGreaterThan(3);
      expect(options.every(id => STANDARD_BOT_PERKS.includes(id))).toBe(true);
      for (let i = 0; i < options.length; i++)
        expect(botPerkForMode("tdm", 1, () => (i + .01) / options.length, role)).toBe(options[i]);
      for (const roll of [0, .2, .5, .99]) {
        const perk = botPerkForMode("gungame", 1, () => roll, role);
        expect(options).toContain(perk);
        expect(perk).not.toBe("well_prepared");
        expect(perk).not.toBe("wonder_weapon");
      }
    }
    expect(BOT_ARCHETYPE_PERKS.rusher).toContain("lightweight");
    expect(BOT_ARCHETYPE_PERKS.marksman).toContain("steady");
    expect(BOT_ARCHETYPE_PERKS.support).toContain("explonando");
  });

  test("PvP attachments fit every ordinary weapon, with distinct role builds", () => {
    for (const role of ["rusher", "rifleman", "marksman", "support"] as BotArchetype[]) {
      for (const wid of botArchetypeWeapons(role)) {
        for (const roll of [0, .5, .999]) {
          const attachments = botAttachmentsForMode("tdm", role, wid, () => roll);
          const equipped = Object.entries(attachments).filter(([, id]) => id !== null);
          expect(equipped.length).toBeGreaterThanOrEqual(2);
          expect(equipped.length).toBeLessThanOrEqual(3);
          for (const [slot, id] of equipped)
            expect(compatibleAttachments(wid, slot as keyof typeof attachments)).toContain(id);
          expect(botMagazineCapacity(wid, attachments)).toBe(
            computeEffectiveStats(WEAPONS.find(w => w.id === wid)!, attachments).magSize);
        }
      }
    }
    expect(botAttachmentsForMode("tdm", "rusher", "smg_kp", () => 0).sight).toBe("sight_laser");
    expect(botAttachmentsForMode("tdm", "marksman", "dmr_scout", () => 0).sight).toBe("sight_hunter");
  });

  test("Survival, Gun Game, Specials and swapped Wonder weapons never inherit PvP upgrades", () => {
    const primary = botAttachmentsForMode("ffa", "rifleman", "rifle_ar", () => 0);
    const secondary = botAttachmentsForMode("ffa", "rifleman", "rifle_falcon", () => .8);
    expect(botAttachmentsForMode("survival", "rifleman", "rifle_ar")).toEqual(emptyBotAttachments());
    expect(botAttachmentsForMode("gungame", "rusher", "smg_kp")).toEqual(emptyBotAttachments());
    expect(botAttachmentsForMode("tdm", "rusher", "rifle_electron")).toEqual(emptyBotAttachments());
    expect(botAttachmentsForMode("tdm", "support", "wonder_turret")).toEqual(emptyBotAttachments());
    expect(botActiveAttachments("rifle_ar", "rifle_ar", primary, "rifle_falcon", secondary)).toBe(primary);
    expect(botActiveAttachments("rifle_ar", "rifle_falcon", primary, "rifle_falcon", secondary)).toBe(secondary);
    expect(botActiveAttachments("rifle_ar", "wonder_turret", primary, "rifle_falcon", secondary))
      .toEqual(emptyBotAttachments());
    const chosen = botSecondaryPrimary("rifle_ar", () => 0, "rifleman");
    expect(chosen).not.toBe("rifle_ar");
    expect(botArchetypeWeapons("rifleman")).toContain(chosen);
  });

  test("Lightweight moves bots faster, Athlete improves sustained sprint only", () => {
    expect(botMovementPerkMultiplier("lightweight",false)).toBe(1.12);
    expect(botMovementPerkMultiplier("athlete",false)).toBe(1);
    expect(botMovementPerkMultiplier("athlete",true)).toBeGreaterThan(1);
  });
});