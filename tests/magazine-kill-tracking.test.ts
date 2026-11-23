import { describe, expect, test } from "bun:test";
import { recordMagazineKill, resetMagazineKillCount } from "../src/lib/magazine-kill-tracking";

describe("sustained-fire magazine tracking", () => {
  test("awards one pair per two LMG kills in the same magazine", () => {
    const counts = new Map<string, number>();
    expect(recordMagazineKill(counts, "hailstorm", true)).toBe(false);
    expect(recordMagazineKill(counts, "hailstorm", true)).toBe(true);
    expect(recordMagazineKill(counts, "hailstorm", true)).toBe(false);
    expect(recordMagazineKill(counts, "hailstorm", true)).toBe(true);
  });

  test("preserves independent counts while switching weapon slots", () => {
    const counts = new Map<string, number>();
    expect(recordMagazineKill(counts, "hailstorm", true)).toBe(false);
    expect(recordMagazineKill(counts, "vanguard_lsw", true)).toBe(false);
    expect(recordMagazineKill(counts, "hailstorm", true)).toBe(true);
    expect(counts.get("vanguard_lsw")).toBe(1);
  });

  test("reloading resets only the selected weapon's magazine count", () => {
    const counts = new Map<string, number>([["hailstorm", 3], ["leviathan", 1]]);
    resetMagazineKillCount(counts, "hailstorm");
    expect(counts.get("hailstorm")).toBe(0);
    expect(counts.get("leviathan")).toBe(1);
  });

  test("does not track non-LMG kills", () => {
    const counts = new Map<string, number>();
    expect(recordMagazineKill(counts, "rifle_m4", false)).toBe(false);
    expect(counts.has("rifle_m4")).toBe(false);
  });
});
