import { describe, expect, test } from "bun:test";
import { COSMETICS, cosmeticById, cosmeticShopOwnership } from "../src/lib/cosmetics";
import { SHOP_ITEMS, shopItemById, shopItemsForCategory } from "../src/lib/shop-catalog";
import { dailyShopRotation } from "../src/lib/shop-rotation";

const NOVEMBER_NAMEPLATES = [
  { shopId: "verdant_signal", cosmeticId: "plate_verdant_signal", currency: "credits", cost: 9000 },
  { shopId: "cinder_guard", cosmeticId: "plate_cinder_guard", currency: "credits", cost: 13500 },
  { shopId: "umbra_cipher", cosmeticId: "plate_umbra_cipher", currency: "career", cost: 1 },
  { shopId: "auric_horizon", cosmeticId: "plate_auric_horizon", currency: "career", cost: 2 },
] as const;

describe("November 2026 Shop nameplates", () => {
  test("each new design has distinct, readable catalog presentation and an authoritative Shop offer", () => {
    const colors = new Set<string>();
    const symbols = new Set<string>();
    for (const entry of NOVEMBER_NAMEPLATES) {
      const cosmetic = cosmeticById(entry.cosmeticId, "nameplate");
      const item = shopItemById(entry.shopId);
      expect(cosmetic).toBeDefined();
      expect(cosmetic?.kind).toBe("nameplate");
      expect(cosmetic?.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(cosmetic?.symbol.length).toBeGreaterThan(0);
      expect(cosmetic?.description.length).toBeGreaterThan(20);
      expect(item).toMatchObject({
        id: entry.shopId, cosmeticId: entry.cosmeticId,
        kind: "nameplate", currency: entry.currency, cost: entry.cost,
      });
      expect(item?.name).toBe(cosmetic?.name);
      colors.add(cosmetic!.color);
      symbols.add(cosmetic!.symbol);
    }
    expect(colors.size).toBe(NOVEMBER_NAMEPLATES.length);
    expect(symbols.size).toBe(NOVEMBER_NAMEPLATES.length);
    expect(new Set(COSMETICS.map(c => c.id)).size).toBe(COSMETICS.length);
    expect(new Set(SHOP_ITEMS.map(i => i.id)).size).toBe(SHOP_ITEMS.length);
  });

  test("new nameplates require a paid purchase and never become free account entitlements", () => {
    const free = cosmeticShopOwnership([]);
    expect(free).toContain("standard");
    for (const entry of NOVEMBER_NAMEPLATES) {
      expect(free).not.toContain(entry.cosmeticId);
      const purchased = cosmeticShopOwnership([entry.shopId]);
      expect(purchased).toContain(entry.cosmeticId);
      for (const other of NOVEMBER_NAMEPLATES.filter(x => x.shopId !== entry.shopId))
        expect(purchased).not.toContain(other.cosmeticId);
    }
    for (const cosmetic of COSMETICS.filter(c => c.kind === "nameplate" && c.id !== "standard"))
      expect(SHOP_ITEMS.filter(i => i.kind === "nameplate" && i.cosmeticId === cosmetic.id)).toHaveLength(1);
  });

  test("both existing Shop tabs rotate the new nameplates into daily offers", () => {
    expect(shopItemsForCategory("credits", "nameplate").length).toBeGreaterThanOrEqual(6);
    expect(shopItemsForCategory("career", "nameplate").length).toBeGreaterThanOrEqual(6);
    const featured = new Set<string>();
    for (let day = 1; day <= 40; day++) {
      const rotation = dailyShopRotation(new Date(Date.UTC(2026, 10, day)));
      for (const entry of NOVEMBER_NAMEPLATES) {
        if (rotation.offers.some(o => o.itemId === entry.shopId)) featured.add(entry.shopId);
      }
      const creditNameplates = rotation.offers.filter(o =>
        shopItemById(o.itemId)?.kind === "nameplate" &&
        shopItemById(o.itemId)?.currency === "credits");
      const careerNameplates = rotation.offers.filter(o =>
        shopItemById(o.itemId)?.kind === "nameplate" &&
        shopItemById(o.itemId)?.currency === "career");
      expect(creditNameplates).toHaveLength(3);
      expect(careerNameplates).toHaveLength(3);
    }
    expect(featured).toEqual(new Set(NOVEMBER_NAMEPLATES.map(x => x.shopId)));
  });
});
