import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Guard the single range entry point; weapon cards (including Wonders) should
// no longer show individual Try Free shortcuts.
describe("Armory firing range entry", () => {
  test("keeps the general firing range entry without per-weapon trial buttons", () => {
    const source = readFileSync(join(import.meta.dir, "../src/components/screens/Armory.tsx"), "utf8");
    expect(source).toContain("Enter Firing Range");
    expect(source).toContain("onClick={enterFiringRange}");
    expect(source).toContain("setRangeWeaponId(null)");
    expect(source).not.toMatch(/Try Free|\\bonTry\\b|tryInRange/);
  });
});
