import {describe,expect,test} from "bun:test";
import { PLAYER_SKINS } from "../src/lib/game-data";
import {
  BOT_OPERATIVE_SKINS, SURVIVAL_BOSS_SKIN_ID, botOperativeSkinId,
  bossShockwaveCharge, BOSS_SHOCKWAVE_WARNING_MS, isSurvivalBoss,
} from "../src/lib/bot-appearances";
import { survivalBossPhase } from "../src/lib/survival-boss-visuals";

describe("bot operative appearance",()=>{
  test("every operative including shop-exclusive cosmetics is in the AI pool",()=>{
    expect(BOT_OPERATIVE_SKINS).toEqual(PLAYER_SKINS.map(s=>s.id));
    expect(BOT_OPERATIVE_SKINS).toContain("shop_ion");
    expect(BOT_OPERATIVE_SKINS).toContain("crimson_lord");
    expect(PLAYER_SKINS.some(s=>s.id===SURVIVAL_BOSS_SKIN_ID)).toBe(true);
  });
  test("one full lobby cycle uses every skin once, independent of offset",()=>{
    for(const offset of [0,1,6,13]){
      const found=new Set(PLAYER_SKINS.map((_,i)=>botOperativeSkinId(i,offset)));
      expect(found.size).toBe(PLAYER_SKINS.length);
      expect([...found].sort()).toEqual(BOT_OPERATIVE_SKINS.slice().sort());
    }
    expect(botOperativeSkinId(PLAYER_SKINS.length,3)).toBe(botOperativeSkinId(0,3));
  });
  test("boss detection works for both online and offline IDs without false positives",()=>{
    expect(isSurvivalBoss("svboss_10_7","BOSS · W10",true)).toBe(true);
    expect(isSurvivalBoss("svbot_xxx","BOSS · W20",true)).toBe(true);
    expect(isSurvivalBoss("human","BOSS · W20",false)).toBe(false);
    expect(isSurvivalBoss("svbot_xxx","W20·3",true)).toBe(false);
  });
  test("shockwave telegraph is silent until windup and resets after cast",()=>{
    const next=10000;
    expect(bossShockwaveCharge(next,next-BOSS_SHOCKWAVE_WARNING_MS-1)).toBe(0);
    expect(bossShockwaveCharge(next,next-BOSS_SHOCKWAVE_WARNING_MS/2)).toBeCloseTo(0.5);
    expect(bossShockwaveCharge(next,next)).toBe(1);
    expect(bossShockwaveCharge(next+12500,next)).toBe(0);
    expect(survivalBossPhase("lmg_hv")).toBe(0);
    expect(survivalBossPhase("shotgun_auto")).toBe(1);
    expect(survivalBossPhase("rifle_heavy")).toBe(2);
  });
});
