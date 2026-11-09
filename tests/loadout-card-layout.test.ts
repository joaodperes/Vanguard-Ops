import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WeaponStatsPreview, EMPTY_ATTACHMENTS } from "../src/components/screens/WeaponStatsPreview";
import { weaponById } from "../src/lib/game-data";

const readSource = (file: string) => readFileSync(join(import.meta.dir, "../src/components/screens", file), "utf8");
const oneStatPerRow = "grid-cols-[minmax(0,1.25fr)_minmax(24px,1fr)_auto]";

describe("Current Loadout card layout", () => {
  test("primary weapons show a full-width row for every stat, without a heading", () => {
    const markup = renderToStaticMarkup(createElement(WeaponStatsPreview, {
      weapon: weaponById("rifle_ar"), equipped: EMPTY_ATTACHMENTS, compact: true,
    }));
    expect(markup.split(oneStatPerRow).length - 1).toBe(11);
    expect(markup).not.toContain(">Stats</span>");
    expect(markup).toContain("Bullet Penetration");
  });

  test("melee shows its four applicable stats using the same one-row layout", () => {
    const markup = renderToStaticMarkup(createElement(WeaponStatsPreview, {
      weapon: weaponById("knife_tactical"), equipped: EMPTY_ATTACHMENTS, compact: true,
    }));
    expect(markup.split(oneStatPerRow).length - 1).toBe(4);
    expect(markup).toContain("Swings / sec");
    expect(markup).toContain("Reach");
  });

  test("weapon name and category share a line; stat box grows without scrolling", () => {
    const src = readSource("Loadout.tsx");
    const card = src.split("function SlotCard(")[1];
    expect(card).toContain('className="flex items-baseline gap-2 min-w-0 mb-2"');
    expect(card).toContain("{weapon.name}</div>");
    expect(card).toContain("{weaponCategoryLabel(weapon.category)}</span>");
    expect(card).not.toContain("h-[227px]");
    expect(card).not.toContain('overflow-y-auto">\n          <WeaponStatsPreview');
  });

  test("wide layout uses three columns and places Melee above Perk and Tactical", () => {
    const src = readSource("Loadout.tsx");
    expect(src).toContain("sm:grid-cols-2 lg:grid-cols-3");
    const rail = src.indexOf("sm:col-span-2 lg:col-span-1");
    const melee = src.indexOf('slot="melee"');
    const perk = src.indexOf("Perk / Wonder Weapon", rail);
    const tactical = src.indexOf(">Tactical</span>", rail);
    expect(rail).toBeGreaterThan(0);
    expect(melee).toBeGreaterThan(rail);
    expect(perk).toBeGreaterThan(melee);
    expect(tactical).toBeGreaterThan(perk);
  });
});
