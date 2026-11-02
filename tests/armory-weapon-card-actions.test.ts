import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Armory weapon-card actions", () => {
  test("purchase and equip states share the same aligned two-row action layout", () => {
    const source = readFileSync(join(import.meta.dir, "../src/components/screens/Armory.tsx"), "utf8");
    const card = source.split("function WeaponCard(props: WeaponCardProps) {")[1]?.split("// CustomizeModal —")[0];
    expect(card).toBeDefined();
    expect(card).toContain('className="mt-auto flex flex-col gap-2"');
    expect(card).toContain('onPurchase("weapon", w.id, w.unlockCost, w.name)');
    expect(card).toContain('onEquip(w, slot)');
    expect(card).toContain('onCustomize(w)');
    // Equal heights and one shared gap on all three action variants.
    expect(card!.match(/h-9 w-full/g)).toHaveLength(3);
    expect(card).not.toMatch(/w-full mb-2|mb-2 font-semibold/);
    expect(card).not.toContain("Try Free");
  });
});
