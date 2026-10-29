import {describe,test,expect} from "bun:test";
import {collectorProgress,collectorSkinEntitlements} from "../src/lib/collector";
import {CAREER_REQUIRED_COMPLETIONS,careerContractOffer,careerContractDelta,freshCareerXp} from "../src/lib/career-contracts";
import {SHOP_ITEMS,shopItemKey,shopItemById} from "../src/lib/shop-catalog";
import {ownsOperativeSkin} from "../src/lib/collection-ownership";
import {WEAPONS,WEAPON_SKINS,PLAYER_SKINS,compatibleAttachments,weaponAttachmentSlots} from "../src/lib/game-data";
import {MAX_PLAYER_LEVEL,totalXpForLevel} from "../src/lib/progression";

describe("Career Tokens and exclusive cosmetic economy",()=>{
  test("each token requires three distinct contracts chosen from five",()=>{
    expect(CAREER_REQUIRED_COMPLETIONS).toBe(3);
    for(let cycle=0;cycle<12;cycle++){
      const offered=careerContractOffer(cycle);
      expect(offered).toHaveLength(5);
      expect(new Set(offered.map(c=>c.id)).size).toBe(5);
      expect(offered.every(c=>c.goal>0)).toBe(true);
    }
  });
  test("fresh XP ignores historic overflow, and category kills use actual weapons",()=>{
    const cap=totalXpForLevel(MAX_PLAYER_LEVEL);
    expect(freshCareerXp(cap+1000000,0)).toBe(0);
    expect(freshCareerXp(cap-150,200)).toBe(50);
    expect(freshCareerXp(cap+1000000,230)).toBe(230);
    const evidence={mode:"tdm",won:true,kills:14,headshots:5,
      perWeaponKills:{rifle_ar:{kills:8,headshots:3},pistol_side:{kills:6,headshots:2}}};
    expect(careerContractDelta("kills_assault",evidence,1000)).toBe(8);
    expect(careerContractDelta("kills_pistol",evidence,1000)).toBe(6);
    expect(careerContractDelta("kills_dmr",evidence,1000)).toBe(0);
    expect(careerContractDelta("wins",evidence,1000)).toBe(1);
    expect(careerContractDelta("fresh_xp",evidence,1000)).toBe(1000);
  });
  test("shop products use two currencies and weapon-specific keys",()=>{
    expect(new Set(SHOP_ITEMS.map(i=>i.currency))).toEqual(new Set(["credits","career"]));
    expect(SHOP_ITEMS.filter(i=>i.kind==="reticle").length).toBeGreaterThan(4);
    expect(SHOP_ITEMS.every(i=>i.cost>0)).toBe(true);
    for(const i of SHOP_ITEMS){
      expect(shopItemById(i.id)).toEqual(i);
      expect(shopItemKey(i,i.kind==="weaponSkin"?"rifle_ar":undefined)).toBe(i.kind==="weaponSkin"?i.id+":rifle_ar":i.id);
    }
  });
  test("zero-priced Shop skins do not auto-unlock at level 1",()=>{
    const shop=PLAYER_SKINS.find(s=>s.id==="shop_urban")!;
    expect(shop.unlockCost).toBe(0);
    expect(ownsOperativeSkin(shop,40,[])).toBe(false);
    expect(ownsOperativeSkin(shop,40,[shop.id])).toBe(true);
  });
});
describe("Collector achievement percentage",()=>{
  test("counts independently earned Viridian and Eventide even without purchased skin rows",()=>{
    const result=collectorSkinEntitlements([],[{weaponId:"rifle_ar",kills:600,headshots:110}],
      [{weaponId:"pistol_side",legacyReward:false},{weaponId:"smg_kp",legacyReward:true}]);
    expect(result.rifle_ar).toContain("prestige_cosmic");
    expect(result.rifle_ar??[]).not.toContain("prestige_toxic");
    expect(result.pistol_side).toContain("prestige_toxic");
    expect(result.pistol_side).not.toContain("prestige_cosmic");
    expect(result.smg_kp).toContain("prestige_cosmic");
    expect(result.smg_kp).toContain("prestige_toxic");
  });
  const normal=WEAPONS.filter(w=>!w.wonder);
  const skins=WEAPON_SKINS.filter(s=>s.shopCurrency!=="career");
  const operators=PLAYER_SKINS.filter(s=>s.shopCurrency!=="career");
  const allAttachments=Object.fromEntries(normal.map(w=>[w.id,weaponAttachmentSlots(w).flatMap(slot=>compatibleAttachments(w.id,slot))]));
  const allWeaponSkins=Object.fromEntries(normal.map(w=>[w.id,skins.map(s=>s.id)]));
  const fullyOwned={
    level:40,unlockedWeapons:normal.map(w=>w.id),
    ownedAttachments:allAttachments,ownedWeaponSkins:allWeaponSkins,ownedOperators:operators.map(s=>s.id),
  };
  test("a complete non-token collection earns 100% and has no token-only denominator",()=>{
    const collection=collectorProgress(fullyOwned);
    expect(collection.percent).toBe(100);
    expect(collection.weapons.total).toBe(normal.length);
    expect(collection.weaponSkins.total).toBe(normal.length*skins.length);
    expect(collection.operatorSkins.total).toBe(operators.length);
    expect(collection.attachments.total).toBeGreaterThan(500);
  });
  test("Wonder purchases and Career-only skins never affect numerator or denominator",()=>{
    const before=collectorProgress(fullyOwned);
    const withTokens=collectorProgress({...fullyOwned,
      unlockedWeapons:[...fullyOwned.unlockedWeapons,...WEAPONS.filter(w=>w.wonder).map(w=>w.id)],
      ownedWeaponSkins:Object.fromEntries(normal.map(w=>[w.id,[...skins.map(s=>s.id),"shop_void"]])),
      ownedOperators:[...operators.map(s=>s.id),"shop_phantom"],
    });
    expect(withTokens).toEqual(before);
  });
  test("unowned regular content counts against completion",()=>{
    const minimal=collectorProgress({level:1,unlockedWeapons:[],ownedAttachments:{},ownedWeaponSkins:{},ownedOperators:["default"]});
    expect(minimal.percent).toBeLessThan(25);
    expect(minimal.total).toBe(collectorProgress(fullyOwned).total);
  });
});
