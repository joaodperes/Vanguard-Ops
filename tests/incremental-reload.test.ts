import { describe, expect, test } from "bun:test";
import { WEAPONS } from "../src/lib/game-data";
import { sampleReloadMotion } from "../src/lib/first-person-animation";
import { advanceIncrementalReload, ROUND_INSERT_FRACTION } from "../src/lib/incremental-reload";

describe("incremental shell and bolt reloads", () => {
  test("round is credited when hand inserts shell, not after complete animation", () => {
    const start = 1000, duration = 1000;
    const initial = advanceIncrementalReload(0, 7, false, start, duration, 1690);
    expect(initial.ammo).toBe(0);
    const inserted = advanceIncrementalReload(initial.ammo, 7, initial.inserted, start, duration, 1700);
    expect(ROUND_INSERT_FRACTION).toBe(0.70);
    expect(inserted.ammo).toBe(1);
    expect(inserted.cycleComplete).toBe(false);
    const again = advanceIncrementalReload(inserted.ammo, 7, inserted.inserted, start, duration, 1900);
    expect(again.ammo).toBe(1); // never double credit a cycle
  });

  test("interrupted reload retains committed shells, including when fired or swapped", () => {
    const first = advanceIncrementalReload(2, 7, false, 0, 1000, 750);
    expect(first.ammo).toBe(3);
    // In the actual game setting reloading=false stops the tick: magazine stays 3.
    expect(first.cycleComplete).toBe(false);
    const resume = advanceIncrementalReload(first.ammo, 7, false, 2500, 1000, 3200);
    expect(resume.ammo).toBe(4);
  });

  test("a new shell is inserted on every cycle until full", () => {
    let ammo = 0;
    for (let i=0;i<7;i++) {
      const cycle = advanceIncrementalReload(ammo, 7, false, i*1000, 1000, i*1000+750);
      ammo = cycle.ammo;
      expect(ammo).toBe(i+1);
      expect(cycle.magazineFull).toBe(i===6);
    }
  });

  test("the animation has a single trip to the loading port per shell", () => {
    const pocket = sampleReloadMotion(0.10,"shell").hand;
    const port = sampleReloadMotion(0.70,"shell").hand;
    const recovery = sampleReloadMotion(1,"shell").hand;
    expect(Math.abs(port[0])).toBeLessThan(Math.abs(pocket[0]));
    // Floating-point interpolation can differ by a final machine epsilon.
    for (let i = 0; i < 3; i++) expect(recovery[i]).toBeCloseTo(pocket[i], 10);
  });

  test("all shotguns and bolt-action snipers have readable per-round timings", () => {
    for (const w of WEAPONS.filter(w=>!w.wonder&&(w.category==="shotgun" || w.category==="sniper"))) {
      expect(w.stats.reloadStyle).toBe("incremental");
      expect(w.stats.reloadPerRound!).toBeGreaterThanOrEqual(0.9);
    }
  });
});
