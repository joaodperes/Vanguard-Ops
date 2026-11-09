import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WeaponStatsPreview, EMPTY_ATTACHMENTS } from "../src/components/screens/WeaponStatsPreview";
import { weaponById } from "../src/lib/game-data";

const penValue = (markup: string) => {
  // Read the value immediately after the PEN label, not another weapon stat.
  const row = markup.split(">PEN</span>")[1];
  return row?.match(/>(\d+\.\d)<\/span>/)?.[1];
};

describe("weapon penetration stat presentation", () => {
  test("renders PEN alongside regular compact loadout stats", () => {
    const markup = renderToStaticMarkup(createElement(WeaponStatsPreview, {
      weapon: weaponById("rifle_ar"), equipped: EMPTY_ATTACHMENTS, compact: true,
    }));
    expect(markup).toContain(">PEN</span>");
    expect(penValue(markup)).toBe("1.0");
  });

  test("shows attachment-adjusted PEN and a beneficial comparison delta", () => {
    const markup = renderToStaticMarkup(createElement(WeaponStatsPreview, {
      weapon: weaponById("rifle_ar"),
      equipped: EMPTY_ATTACHMENTS,
      preview: { ...EMPTY_ATTACHMENTS, magazine: "mag_penetrator" },
    }));
    expect(penValue(markup)).toBe("1.6");
    expect(markup).toContain("▲");
    expect(markup).toContain("60%");
  });

  test("displays zero for weapons without ballistic penetration, and omits PEN from melee", () => {
    const wonder = renderToStaticMarkup(createElement(WeaponStatsPreview, {
      weapon: weaponById("wonder_singularity"), compact: true,
    }));
    const melee = renderToStaticMarkup(createElement(WeaponStatsPreview, {
      weapon: weaponById("knife_tactical"), compact: true,
    }));
    expect(penValue(wonder)).toBe("0.0");
    expect(melee).not.toContain(">PEN</span>");
  });

  test("Armory weapon cards and customization modal use regular PEN stat bars", () => {
    const source = readFileSync(join(import.meta.dir, "../src/components/screens/Armory.tsx"), "utf8");
    expect(source).toContain('<StatBar label="PEN"');
    expect(source).toContain('<ModalStatBar label="PEN"');
    expect(source).not.toContain('aria-label={`Penetration rating');
  });
});
