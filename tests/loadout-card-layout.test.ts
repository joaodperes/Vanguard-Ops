import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WeaponStatsPreview, EMPTY_ATTACHMENTS } from "../src/components/screens/WeaponStatsPreview";
import { weaponById } from "../src/lib/game-data";

const readSource = (file: string) => readFileSync(join(import.meta.dir, "../src/components/screens", file), "utf8");
const oneStatPerRow = "grid-cols-[112px_minmax(24px,1fr)_86px]";

describe("Current Loadout card layout", () => {
  test("primary weapons show a full-width row for every stat, without a heading", () => {
    const markup = renderToStaticMarkup(createElement(WeaponStatsPreview, {
      weapon: weaponById("rifle_ar"), equipped: EMPTY_ATTACHMENTS, compact: true,
    }));
    expect(markup.split(oneStatPerRow).length - 1).toBe(11);
    expect(markup).not.toContain(">Stats</span>");
    expect(markup).toContain("Bullet Penetration");
  });

  test("each weapon stat has an identical fixed-width label and value track, keeping bars aligned", () => {
    const layouts = ["rifle_ar", "pistol_side", "knife_tactical"].map(id =>
      renderToStaticMarkup(createElement(WeaponStatsPreview, { weapon: weaponById(id), compact: true }))
    );
    for (const markup of layouts) {
      expect(markup).toContain(oneStatPerRow);
      expect(markup).not.toContain("grid-cols-[minmax(0,1.25fr)_minmax(24px,1fr)_auto]");
    }
    const stats = readSource("WeaponStatsPreview.tsx");
    expect(stats).toContain("grid grid-cols-[112px_minmax(24px,1fr)_86px]");
    expect(stats).toContain('{label}');
    expect(stats).toContain('{bar}');
    expect(stats).toContain('{value}');
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

  test("perk and tactical descriptions appear inline beside their names, not on separate lines", () => {
    const source = readSource("Loadout.tsx");
    const perkRow = source.match(/<div className="flex min-w-0 items-baseline gap-2 mb-2">[\\s\\S]*?<\\/div>/g);
    expect(perkRow).toHaveLength(2);
    expect(perkRow![0]).toContain("perkById(perkId).name");
    expect(perkRow![0]).toContain("perkById(perkId).description");
    expect(perkRow![1]).toContain("EQUIPMENT.find(e => e.id === equipmentId)?.name");
    expect(perkRow![1]).toContain("EQUIPMENT.find(e => e.id === equipmentId)?.description");
    expect(source).not.toContain("min-h-7 leading-snug line-clamp-2");
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
