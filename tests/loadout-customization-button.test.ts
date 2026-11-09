import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dir, "../src/components/screens/Loadout.tsx"), "utf8");

describe("Current Loadout customization after swapping weapons", () => {
  test("customize follows the draft weapon in every slot", () => {
    expect(source).toContain('onCustomize(weaponById(primary), "primary")');
    expect(source).toContain('onCustomize(weaponById(secondary), "secondary")');
    expect(source).toContain('onCustomize(weaponById(melee), "melee")');
  });

  test("a draft primary or secondary swap keeps a customization preview button visible", () => {
    const card = source.split("function SlotCard({")[1]?.split("// Legacy standalone")[0];
    expect(card).toBeDefined();
    // Rendering depends on the callback, not whether the draft is already saved.
    expect(card).toContain("{onCustomize && (");
    expect(card).not.toMatch(/\{(?:canCustomize|customizationConfirmed) && onCustomize && \(/);
    expect(card).toContain('customizationConfirmed ? (slot === "melee"');
    expect(card).toContain(': "Preview customization"');
    expect(card).toContain("confirm your loadout to equip attachments and skins");
    // Confirmation continues to be required for applying weapon changes.
    expect(source).toContain("Confirm Loadout");
    expect(source).toContain("customizationConfirmed={primary === current.weapon.id}");
    expect(source).toContain("customizationConfirmed={secondary === current.secondary.id");
  });
});
