import {describe,expect,test} from "bun:test";
import {
 SURVIVAL_UPGRADES, SURVIVAL_UPGRADE_PREP_SEC, survivalUpgradeDue,
 SURVIVAL_SELF_REVIVE_MS, SURVIVAL_SELF_REVIVE_HP, canUseSelfRevive, survivalUpgradeValueText,
 chooseSurvivalUpgrade,generateSurvivalUpgradeChoices,upgradeRank,
 survivalOutgoingMultiplier,survivalIncomingMultiplier,survivalKillReward,
 survivalWaveHealing,survivalRegenDelayMultiplier,survivalRegenRateMultiplier,
 survivalMovementMultiplier,survivalReloadMultiplier,type SurvivalUpgradeRanks,
} from "../src/lib/survival-upgrades";

describe("run-only Survival upgrades",()=>{
 test("has 25 distinct upgrades with meaningful categories and descriptions",()=>{
   expect(SURVIVAL_UPGRADES).toHaveLength(25);
   expect(new Set(SURVIVAL_UPGRADES.map(u=>u.id)).size).toBe(25);
   expect(SURVIVAL_UPGRADES.every(u=>u.name&&u.description&&u.category)).toBe(true);
 });
 test("offers begin after wave four and recur indefinitely, including endless wave 204",()=>{
   expect(survivalUpgradeDue(0)).toBe(false);
   expect(survivalUpgradeDue(3)).toBe(false);
   expect(survivalUpgradeDue(4)).toBe(true);
   expect(survivalUpgradeDue(5)).toBe(false);
   expect(survivalUpgradeDue(9)).toBe(true);
   expect(survivalUpgradeDue(29)).toBe(true);
   expect(survivalUpgradeDue(30)).toBe(false);
   expect(survivalUpgradeDue(204)).toBe(true);
   expect(SURVIVAL_UPGRADE_PREP_SEC).toBe(5);
 });
 test("three unique weighted choices, with rerolls excluding old choices",()=>{
   const ranks:SurvivalUpgradeRanks={head_hunter:5};
   const a=generateSurvivalUpgradeChoices(ranks,()=>.31);
   expect(a).toHaveLength(3);
   expect(new Set(a).size).toBe(3);
   const b=generateSurvivalUpgradeChoices(ranks,()=>.31,a);
   expect(b).toHaveLength(3);
   expect(b.some(id=>a.includes(id))).toBe(false);
 });
 test("no max slots, rank limit or exhaustion at wave 500+",()=>{
   let ranks:SurvivalUpgradeRanks={};
   for(let i=0;i<500;i++)ranks=chooseSurvivalUpgrade(ranks,"head_hunter");
   expect(upgradeRank(ranks,"head_hunter")).toBe(500);
   for(const upgrade of SURVIVAL_UPGRADES)ranks=chooseSurvivalUpgrade(ranks,upgrade.id);
   expect(Object.keys(ranks)).toHaveLength(25);
   expect(generateSurvivalUpgradeChoices(ranks)).toHaveLength(3);
   expect(survivalOutgoingMultiplier(ranks,{headshot:true})).toBeGreaterThan(1);
 });
 test("boss-only self-revive is one-time, one use per wave, with a 30-second window",()=>{
   const normal=generateSurvivalUpgradeChoices({},()=>0);
   expect(normal).not.toContain("self_revive");
   const boss=generateSurvivalUpgradeChoices({},()=>0,[],true);
   expect(boss).toContain("self_revive");
   const chosen=chooseSurvivalUpgrade({},"self_revive");
   expect(chooseSurvivalUpgrade(chosen,"self_revive")).toEqual(chosen);
   expect(generateSurvivalUpgradeChoices(chosen,()=>0,[],true)).not.toContain("self_revive");
   expect(canUseSelfRevive({},-1,10)).toBe(false);
   expect(canUseSelfRevive(chosen,-1,10)).toBe(true);
   expect(canUseSelfRevive(chosen,10,10)).toBe(false);
   expect(canUseSelfRevive(chosen,10,11)).toBe(true);
   expect(SURVIVAL_SELF_REVIVE_MS).toBe(30000);
   expect(SURVIVAL_SELF_REVIVE_HP).toBe(35);
 });
 test("upgrade numbers are derived from combat modifiers, not arbitrary card text",()=>{
   expect(survivalUpgradeValueText("fast_hands",{})).toContain("-13% reload time");
   expect(survivalUpgradeValueText("head_hunter",{})).toContain("+10% headshot damage");
   expect(survivalUpgradeValueText("light_footed",{})).toContain("+4.5% movement speed");
   expect(survivalUpgradeValueText("fresh_start",{})).toContain("+12 HP");
   expect(survivalUpgradeValueText("self_revive",{})).toContain("30s downed");
 });
 test("damage buffs are contextual; glass cannon increases risk",()=>{
   const ranks:SurvivalUpgradeRanks={head_hunter:2,point_blank:2,boss_hunter:1,glass_cannon:1};
   const precision=survivalOutgoingMultiplier(ranks,{headshot:true,distance:6,boss:true});
   const distant=survivalOutgoingMultiplier(ranks,{distance:18});
   expect(precision).toBeGreaterThan(distant);
   expect(survivalIncomingMultiplier(ranks,{})).toBeGreaterThan(1);
   expect(survivalIncomingMultiplier({steel_skin:2,blast_guard:2},{explosive:true}))
     .toBeLessThan(survivalIncomingMultiplier({steel_skin:2,blast_guard:2},{explosive:false}));
 });
 test("defense never makes a player invulnerable even with thousands of ranks",()=>{
   const heavy={steel_skin:10000,blast_guard:10000,unyielding:10000,evasive:10000};
   const damage=survivalIncomingMultiplier(heavy,{explosive:true,sprinting:true,healthFraction:.1});
   expect(damage).toBeGreaterThan(.5);
 });
 test("kill and wave recovery are bounded, and headshots reward precision",()=>{
   expect(survivalKillReward({salvage:1,precision_loop:2,combat_medic:2,surgical_precision:1},true))
     .toEqual({health:12,ammo:5});
   expect(survivalKillReward({precision_loop:2,surgical_precision:2},false)).toEqual({health:0,ammo:0});
   expect(survivalKillReward({combat_medic:1e8,salvage:1e8},true).health).toBeLessThanOrEqual(22);
   expect(survivalWaveHealing({fresh_start:5})).toBeGreaterThan(0);
   expect(survivalWaveHealing({fresh_start:1e8})).toBeLessThanOrEqual(45);
 });
 test("regen, reload and mobility bonuses affect only appropriate mechanics",()=>{
   expect(survivalRegenDelayMultiplier({quick_recovery:2})).toBeLessThan(1);
   expect(survivalRegenRateMultiplier({vitality:2})).toBeGreaterThan(1);
   expect(survivalReloadMultiplier({overclock:1},300)).toBeLessThan(survivalReloadMultiplier({overclock:1},6000));
   expect(survivalMovementMultiplier({adrenaline:1},300)).toBeGreaterThan(survivalMovementMultiplier({adrenaline:1},6000));
 });
});