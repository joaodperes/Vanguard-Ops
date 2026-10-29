import {describe,test,expect} from "bun:test";
import {DAILY_SHOP_SLOTS,dailyShopRotation,isShopItemFeatured,isShopOfferFeatured} from "../src/lib/shop-rotation";
import {SHOP_CATEGORIES,SHOP_ITEMS,shopItemById,shopItemKey} from "../src/lib/shop-catalog";
import {WEAPONS,WEAPON_SKINS,PLAYER_SKINS} from "../src/lib/game-data";
import {cosmeticById} from "../src/lib/cosmetics";

describe("shared rotating Shop",()=>{
  const first=new Date("2026-10-29T00:00:01Z");
  const second=new Date("2026-10-30T00:00:01Z");
  test("rotates at UTC midnight, and is identical for all players",()=>{
    const today=dailyShopRotation(first);
    expect(today).toEqual(dailyShopRotation(new Date("2026-10-29T23:59:59Z")));
    expect(today.dayKey).toBe("2026-10-29");
    expect(today.refreshAt).toBe("2026-10-30T00:00:00.000Z");
    expect(dailyShopRotation(new Date("2026-10-28T20:00:01-04:00"))).toEqual(today);
    expect(today).not.toEqual(dailyShopRotation(second));
    expect(new Set(today.itemIds).size).toBe(today.itemIds.length);
    expect(isShopItemFeatured(today.itemIds[0],first)).toBe(true);
    expect(today.offers).toHaveLength(today.itemIds.length);
    expect(today.offers.map(o=>o.itemId)).toEqual(today.itemIds);
  });
  test("exactly three offers per type in both currencies; each type changes daily",()=>{
    const a=new Set(dailyShopRotation(first).itemIds),b=new Set(dailyShopRotation(second).itemIds);
    expect(DAILY_SHOP_SLOTS).toBe(3);
    expect(a.size).toBe(DAILY_SHOP_SLOTS*5*2);
    for(const currency of ["credits","career"] as const)for(const category of SHOP_CATEGORIES){
      if(category.id==="all")continue;
      const candidates=SHOP_ITEMS.filter(i=>i.currency===currency&&i.kind===category.id);
      const now=candidates.filter(i=>a.has(i.id));
      const next=candidates.filter(i=>b.has(i.id));
      expect(candidates.length).toBeGreaterThan(3);
      expect(now).toHaveLength(3);
      expect(next).toHaveLength(3);
      expect(now.map(i=>i.id).sort()).not.toEqual(next.map(i=>i.id).sort());
    }
  });
  test("every offer is a real collectible and weapon skins are purchased per gun",()=>{
    for(const id of dailyShopRotation(first).itemIds){
      const item=shopItemById(id)!;
      expect(item).toBeDefined();
      if(item.kind==="weaponSkin")expect(WEAPON_SKINS.some(s=>s.id===item.skinId)).toBe(true);
      else if(item.kind==="playerSkin")expect(PLAYER_SKINS.some(s=>s.id===item.skinId)).toBe(true);
      else expect(cosmeticById(item.cosmeticId??"",item.kind)).toBeDefined();
    }
    const offered=dailyShopRotation(first).offers.filter(o=>shopItemById(o.itemId)?.kind==="weaponSkin");
    expect(offered).toHaveLength(6);
    for(const offer of offered){
      expect(WEAPONS.some(w=>w.id===offer.weaponId&&!w.wonder&&!w.disabled&&w.category!=="melee")).toBe(true);
      expect(isShopOfferFeatured(offer.itemId,offer.weaponId,first)).toBe(true);
      expect(isShopOfferFeatured(offer.itemId,"__arbitrary_weapon__",first)).toBe(false);
      expect(isShopOfferFeatured(offer.itemId,undefined,first)).toBe(false);
    }
    expect(dailyShopRotation(first).offers).toEqual(dailyShopRotation(first).offers);
    const finish=SHOP_ITEMS.find(i=>i.kind==="weaponSkin")!;
    expect(shopItemKey(finish,"rifle_ar")).not.toBe(shopItemKey(finish,"pistol_side"));
    expect(shopItemKey(finish,"rifle_ar")).toBe(shopItemKey(finish,"rifle_ar"));
    for(const type of ["charm","nameplate","reticle"] as const){
      const item=SHOP_ITEMS.find(i=>i.kind===type)!;
      expect(shopItemKey(item,"rifle_ar")).toBe(shopItemKey(item,"pistol_side"));
    }
  });
});
