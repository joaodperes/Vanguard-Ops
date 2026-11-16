import { describe, expect, test } from "bun:test";
import { calculateWonderWallet } from "../src/lib/wonder-economy";
import { WONDER_MODULES, WONDER_FINISHES, WONDER_KILL_EFFECTS, validWonderModule,
  wonderModuleEffects, wonderModulesFor, wonderFinishesFor, wonderKillEffectsFor } from "../src/lib/wonder-expansion";
import { mechTuning, juggernautDropPoint, ripperSegments, crushesAtLanding } from "../src/lib/wonder-abilities";
import { SHOP_ITEMS, shopItemById, shopPurchaseStatus } from "../src/lib/shop-catalog";
import { WEAPONS } from "../src/lib/game-data";

describe("Wonder catalog and token balance",()=>{
  test("all new Wonders are enabled and have different abilities",()=>{
    const expected=["rail","chrono","seismic","decoy","cryo","ricochet","mech"];
    const found=WEAPONS.filter(w=>w.wonder&&expected.includes(w.wonder.kind));
    expect(found.length).toBe(7);
    expect(new Set(found.map(w=>w.wonder!.kind)).size).toBe(7);
    expect(found.every(w=>!w.disabled&&w.wonder!.rechargeMs>1000)).toBe(true);
  });
  test("every enabled Wonder has customization modules and cosmetics",()=>{
    const enabled=WEAPONS.filter(w=>w.wonder&&!w.disabled);
    for(const w of enabled){
      expect(wonderModulesFor(w.id).length).toBeGreaterThanOrEqual(2);
      for(const m of wonderModulesFor(w.id)){
        expect(validWonderModule(w.id,m.id)).toBe(true);
        expect(shopItemById("module_"+m.id)?.currency).toBe("wonder");
        expect(shopItemById("module_"+m.id)?.wonderWeaponId).toBe(w.id);
      }
      for(const camo of wonderFinishesFor(w.id))
        expect(shopItemById(camo.id+"_"+w.id)?.kind).toBe("wonderSkin");
      for(const fx of wonderKillEffectsFor(w.id))
        expect(shopItemById(fx.id+"_"+w.id)?.kind).toBe("wonderKillEffect");
    }
    expect(enabled).toHaveLength(16);
    expect(enabled.some(w=>w.id==="wonder_harbinger"&&w.wonder?.kind==="drone")).toBe(true);
    expect(WEAPONS.find(w=>w.id==="wonder_bogfather")?.disabled).toBe(true);
    expect(new Set(WONDER_MODULES.map(m=>m.id)).size).toBe(WONDER_MODULES.length);
    expect(SHOP_ITEMS.filter(x=>x.currency==="wonder").every(x=>x.cost>0)).toBe(true);
  });
  test("no token double spend across unlocks and shop buys",()=>{
    const purchases=[{currency:"wonder",cost:2},{currency:"career",cost:10},{currency:"wonder",cost:1}];
    const wallet=calculateWonderWallet(7,0,2,purchases);
    expect(wallet.earned).toBe(7);
    expect(wallet.shopSpent).toBe(3);
    expect(wallet.unlocked).toBe(2);
    expect(wallet.available).toBe(2);
    expect(calculateWonderWallet(2,1,2,purchases).available).toBe(0);
    expect(calculateWonderWallet(0,0,0,purchases).available).toBe(0);
  });
  test("Wonder shop requires owning the Wonder and sufficient tokens",()=>{
    const item=shopItemById("module_swarm_pod")!;
    expect(shopPurchaseStatus(item,{owned:false,weaponOwned:false,careerUnlocked:false,credits:0,careerTokens:0,wonderTokens:10})).toBe("weapon-locked");
    expect(shopPurchaseStatus(item,{owned:false,weaponOwned:true,careerUnlocked:false,credits:0,careerTokens:0,wonderTokens:1})).toBe("tokens-short");
    expect(shopPurchaseStatus(item,{owned:false,weaponOwned:true,careerUnlocked:false,credits:0,careerTokens:0,wonderTokens:2})).toBe("available");
    expect(shopPurchaseStatus(item,{owned:true,weaponOwned:true,careerUnlocked:false,credits:0,careerTokens:0,wonderTokens:0})).toBe("owned");
  });
});
describe("Juggernaut mechanics",()=>{
 test("module choices are meaningful exclusive sidegrades",()=>{
   const base=mechTuning(),swarm=mechTuning("swarm_pod"),mule=mechTuning("munitions_mule");
   expect(base.secondary).toBe("shotgun");
   expect(swarm.secondary).toBe("swarm");
   expect(swarm.armor).toBe(base.armor);
   expect(mule.minigunAmmo).toBeGreaterThan(base.minigunAmmo);
   expect(mule.secondaryAmmo).toBeGreaterThan(base.secondaryAmmo);
   expect(mule.movement).toBeLessThan(base.movement);
   expect(mechTuning("raider_configuration").armor).toBeLessThan(base.armor);
   expect(mechTuning("siegebreaker").armor).toBeGreaterThan(base.armor);
   expect(wonderModuleEffects("wonder_juggernaut","compression_core").damageMul).toBe(1);
 });
 test("sky drop rejects overhead cover and arena edges",()=>{
   expect(juggernautDropPoint([0,0,0],0,[],100)).toEqual([0,0,-5.2]);
   expect(juggernautDropPoint([0,0,0],0,[{pos:[0,4,-5],size:[5,1,5]}],100)).toBeNull();
   expect(juggernautDropPoint([0,0,0],0,[{pos:[0,-1,-5],size:[5,1,5]}],100)).toEqual([0,0,-5.2]);
   expect(juggernautDropPoint([0,0,-95],0,[],100)).toBeNull();
 });
 test("crush hits everyone inside the landing footprint",()=>{
   expect(crushesAtLanding([0,0,0],[0,0,0])).toBe(true);
   expect(crushesAtLanding([2,0,0],[0,0,0])).toBe(true);
   expect(crushesAtLanding([3.5,0,0],[0,0,0])).toBe(false);
   expect(crushesAtLanding([0,4,0],[0,0,0])).toBe(false);
 });
});
describe("Ripper reflection",()=>{
 test("reflects off walls and its damage decays over bounces",()=>{
   const segments=ripperSegments([0,1,0],[1,0,0],[{pos:[5,1,0],size:[.2,2,3]}],18,2);
   expect(segments.length).toBeGreaterThan(1);
   expect(segments[0].to[0]).toBeCloseTo(4.8);
   expect(segments[1].to[0]).toBeLessThan(4.8);
   expect(segments[1].damageScale).toBeLessThan(segments[0].damageScale);
 });
});
