import {describe,test,expect} from "bun:test";
import { COSMETICS,cosmeticById,cosmeticShopOwnership,parseEquippedCharms,DEFAULT_COSMETICS } from "../src/lib/cosmetics";
import {SHOP_ITEMS,SHOP_CATEGORIES,shopItemKey,shopItemsForCategory} from "../src/lib/shop-catalog";
import {WEAPONS} from "../src/lib/game-data";

describe("new cosmetic equipment and credit/career shop catalogs",()=>{
  test("all four free selections are always available without currency",()=>{
    const owned=cosmeticShopOwnership([]);
    expect(owned.sort()).toEqual(["classic","dot","none","standard"].sort());
    for(const [kind,id] of Object.entries(DEFAULT_COSMETICS))
      expect(cosmeticById(id,kind as "reticle"|"charm"|"nameplate")).toBeDefined();
  });
  test("cosmetic descriptions do not display redundant always-free copy",()=>{
    expect(COSMETICS.every(c => !/always free/i.test(c.description))).toBe(true);
    expect(cosmeticShopOwnership([])).toEqual(expect.arrayContaining(["classic","dot","none","standard"]));
  });
  test("every premium reticle, charm and nameplate has exactly one priced Shop entry",()=>{
    for(const cosmetic of COSMETICS.filter(x=>!["classic","dot","none","standard"].includes(x.id))){
      const entries=SHOP_ITEMS.filter(item=>item.cosmeticId===cosmetic.id);
      expect(entries).toHaveLength(1);
      expect(entries[0].kind).toBe(cosmetic.kind);
      expect(entries[0].cost).toBeGreaterThan(0);
      expect(["credits","career"]).toContain(entries[0].currency);
      expect(shopItemKey(entries[0])).toBe(entries[0].id);
      const owned=cosmeticShopOwnership([entries[0].id]);
      expect(owned).toContain(cosmetic.id);
      expect(cosmeticShopOwnership([])).not.toContain(cosmetic.id);
    }
    expect(new Set(COSMETICS.map(x=>x.id)).size).toBe(COSMETICS.length);
  });
  test("new weapon charms are unique shop purchases across both currencies",()=>{
    const addedIds=["charm_casing","charm_dice","charm_compass","charm_drone","charm_phoenix","charm_prism","charm_solar","charm_satellite"];
    expect(new Set(addedIds).size).toBe(8);
    for(const id of addedIds){
      const cosmetic=cosmeticById(id,"charm");
      expect(cosmetic).toBeDefined();
      const purchases=SHOP_ITEMS.filter(item=>item.cosmeticId===id);
      expect(purchases).toHaveLength(1);
      expect(purchases[0].cost).toBeGreaterThan(0);
      expect(shopItemKey(purchases[0])).toBe(purchases[0].id);
      expect(cosmeticShopOwnership([purchases[0].id])).toContain(id);
      expect(cosmeticShopOwnership([])).not.toContain(id);
    }
    expect(addedIds.filter(id=>SHOP_ITEMS.find(i=>i.cosmeticId===id)?.currency==="credits")).toHaveLength(5);
    expect(addedIds.filter(id=>SHOP_ITEMS.find(i=>i.cosmeticId===id)?.currency==="career")).toHaveLength(3);
  });
  test("shop categories group every product exactly once per currency",()=>{
    expect(SHOP_CATEGORIES.map(c=>c.id)).toEqual(["all","weaponSkin","playerSkin","reticle","charm","nameplate"]);
    for(const currency of ["credits","career"] as const){
      const all=shopItemsForCategory(currency,"all");
      const groups=SHOP_CATEGORIES.filter(c=>c.id!=="all").flatMap(c=>shopItemsForCategory(currency,c.id));
      expect(groups).toHaveLength(all.length);
      expect(new Set(groups.map(i=>i.id)).size).toBe(all.length);
      expect(groups.every(i=>i.currency===currency)).toBe(true);
      for(const c of SHOP_CATEGORIES.filter(x=>x.id!=="all")){
        expect(shopItemsForCategory(currency,c.id).every(i=>i.kind===c.id)).toBe(true);
      }
    }
  });
  test("charm map tolerates malformed backups but never arbitrary IDs",()=>{
    expect(parseEquippedCharms("broken")).toEqual({});
    expect(parseEquippedCharms(JSON.stringify({
      rifle_ar:"charm_orb",pistol_side:"charm_tag",
      fake:"not-a-charm","invalid!weapon":"charm_skull",
      knife_tactical:"none",
    }))).toEqual({rifle_ar:"charm_orb",pistol_side:"charm_tag",knife_tactical:"none"});
    expect(WEAPONS.some(w=>w.id==="rifle_ar")).toBe(true);
  });
  test("reticle and nameplate equipment does not add an aiming or damage stat modifier",()=>{
    for(const item of SHOP_ITEMS.filter(i=>["reticle","charm","nameplate"].includes(i.kind))){
      expect(Object.keys(item).some(key=>["damage","accuracy","recoil","range","magSize"].includes(key))).toBe(false);
    }
  });
});
