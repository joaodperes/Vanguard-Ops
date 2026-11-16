import {describe,expect,test} from "bun:test";
import { weaponById, computeEffectiveStats } from "../src/lib/game-data";
import { botCombatDecision, botIdealDistance, botPatrolSprint, botShotSpread } from "../src/lib/bot-combat-posture";

const stance=(category:Parameters<typeof botCombatDecision>[0],distance:number,clearShot=true,reacted=true,settled=true,ammo=true,reloading=false)=>
  botCombatDecision(category,distance,clearShot,reacted,settled,ammo,reloading);

describe("weapon-aware bot ADS and movement in offline and online matches",()=>{
  test("snipers ADS on open long sightlines, rather than sprint past firing opportunities",()=>{
    expect(stance("sniper",40).aiming).toBe(true);
    expect(stance("sniper",40).sprinting).toBe(false);
    expect(stance("sniper",40).idealDistance).toBe(25);
    expect(stance("sniper",5).aiming).toBe(false);
    expect(stance("dmr",22).aiming).toBe(true);
  });
  test("shotguns rush to close range, hipfire at point blank, and ADS for precise midrange shots",()=>{
    expect(stance("shotgun",20).sprinting).toBe(true);
    expect(stance("shotgun",20).aiming).toBe(false);
    expect(stance("shotgun",12).aiming).toBe(true);
    expect(stance("shotgun",5).aiming).toBe(false);
    expect(botIdealDistance("shotgun")).toBeLessThan(botIdealDistance("assault"));
    expect(botIdealDistance("sniper")).toBeGreaterThan(botIdealDistance("assault"));
  });
  test("ADS requires reacting and settling, available ammo and an unobstructed firing lane",()=>{
    expect(stance("sniper",30,true,false,true).aiming).toBe(false);
    expect(stance("sniper",30,true,true,false).aiming).toBe(false);
    expect(stance("sniper",30,false,true,true).aiming).toBe(false);
    expect(stance("sniper",30,true,true,true,false).aiming).toBe(false);
    expect(stance("sniper",30,true,true,true,true,true).aiming).toBe(false);
  });
  test("SMG rushes, assault bot holds ordinary firing lane and patrol sprint is available",()=>{
    expect(stance("smg",27).sprinting).toBe(true);
    expect(stance("assault",24).sprinting).toBe(false);
    expect(stance("assault",40).sprinting).toBe(true);
    expect(stance("sniper",40,false).sprinting).toBe(true);
    expect(botPatrolSprint(11)).toBe(true);
    expect(botPatrolSprint(4)).toBe(false);
  });
  test("unscoped sniper bots have the same minimum dispersion as the player",()=>{
    const sniper=weaponById("sniper_lr");
    const stats=computeEffectiveStats(sniper,{sight:null,barrel:null,grip:null,magazine:null});
    expect(botShotSpread(stats,false,"sniper")).toBeCloseTo(0.24*1.9,5);
    expect(botShotSpread(stats,false,"sniper")).toBeGreaterThan(botShotSpread(stats,false));
    expect(botShotSpread(stats,true,"sniper")).toBe(stats.adsSpread);
    const dmr=weaponById("rifle_dm");
    const dmrStats=computeEffectiveStats(dmr,{sight:null,barrel:null,grip:null,magazine:null});
    expect(botShotSpread(dmrStats,false,"dmr")).toBe(dmrStats.spread);
  });
  test("ADS uses attachment-adjusted mechanical spread for single shots AND shotgun pellets",()=>{
    for(const id of ["sniper_lr","shotgun_br","rifle_ar"]){
      const stats=computeEffectiveStats(weaponById(id),{sight:null,barrel:null,grip:null,magazine:null});
      expect(botShotSpread(stats,false)).toBe(stats.spread);
      expect(botShotSpread(stats,true)).toBe(stats.adsSpread);
      expect(botShotSpread(stats,true)).toBeLessThanOrEqual(botShotSpread(stats,false));
    }
  });
});
