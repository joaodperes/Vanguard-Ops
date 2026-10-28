import {describe,test,expect} from "bun:test";
import { COSMETICS,cosmeticById,cosmeticShopOwnership,parseEquippedCharms,DEFAULT_COSMETICS } from "../src/lib/cosmetics";
import {SHOP_ITEMS,shopItemKey} from "../src/lib/shop-catalog";
import {WEAPONS} from "../src/lib/game-data";

describe("new cosmetic equipment and credit/career shop catalogs",()=>{
  test("all four free selections are always available without currency",()=>{
    const owned=cosmeticShopOwnership([]);
    expect(owned.sort()).toEqual(["classic","dot","none","standard"].sort());
    for(const [kind,id] of Object.entries(DEFAULT_COSMETICS))
      expect(cosmeticById(id,kind as "reticle"|"charm"|"nameplate")).toBeDefined();
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
