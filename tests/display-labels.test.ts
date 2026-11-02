import { describe, expect, test } from "bun:test";
import { displayLabel, displayMapLabel, weaponCategoryLabel } from "../src/lib/display-labels";

describe("player-facing data labels", () => {
  test("formats raw identifiers and preserves acronyms", () => {
    expect(displayLabel("kill_confirmations")).toBe("Kill Confirmations");
    expect(displayLabel("long_range")).toBe("Long Range");
    expect(displayLabel("smg")).toBe("SMG");
    expect(displayLabel("")).toBe("");
  });

  test("converts raw map variants but preserves authored map names", () => {
    expect(displayMapLabel("City_day")).toBe("City (Day)");
    expect(displayMapLabel("city_night")).toBe("City (Night)");
    expect(displayMapLabel("arena_neon")).toBe("Arena Neon");
    expect(displayMapLabel("Afterlight City (Day)")).toBe("Afterlight City (Day)");
    expect(displayMapLabel(undefined)).toBe("Unknown Map");
  });

  test("uses readable weapon category names", () => {
    expect(weaponCategoryLabel("assault")).toBe("Assault Rifle");
    expect(weaponCategoryLabel("dmr")).toBe("DMR");
    expect(weaponCategoryLabel("sidearm")).toBe("Sidearm");
    expect(weaponCategoryLabel("unknown_type")).toBe("Unknown Type");
  });
});
