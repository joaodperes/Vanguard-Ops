import { describe, expect, test } from "bun:test";
import {
  WEAPONS, compatibleAttachments, computeEffectiveStats, damageAtRange, maxWeaponHitRange,
  type AttachmentSlot, type EffectiveStats,
} from "../src/lib/game-data";
import { rayCombatantHit } from "../src/lib/combat-hitboxes";
import { shotgunConeRadians, shotgunPelletDirection } from "../src/lib/shotgun-pattern";
import type { Vec3 } from "../src/lib/game-protocol";

const shotguns = WEAPONS.filter(w => w.category === "shotgun" && !w.wonder);
const empty: Record<AttachmentSlot, string | null> =
  { sight: null, barrel: null, grip: null, magazine: null };
const get = (id: string, magazine: string | null = null, barrel: string | null = null) =>
  computeEffectiveStats(shotguns.find(w => w.id === id)!, { ...empty, magazine, barrel });

function randomFrom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Bench target: unarmored stationary 100-HP humanoid, centered on the reticle.
 * Uses the actual game hitboxes, falloff and pellet generator, not a guessed
 * rectangular hit-probability approximation. The only omitted factors are
 * movement/recoil, cover, network delay and target evasion.
 */
function benchmark(stats: EffectiveStats, distance: number, aiming: boolean, shots = 750, seed = 42) {
  const random = randomFrom(seed);
  const origin: Vec3 = [0, 1.55, 0];
  const feet: Vec3 = [0, 0, distance];
  const look: Vec3 = [0, -0.36, distance];
  const len = Math.hypot(...look);
  const center: Vec3 = [look[0] / len, look[1] / len, look[2] / len];
  let damage = 0, kills = 0, hits = 0;
  for (let shot = 0; shot < shots; shot++) {
    let volleyDamage = 0;
    for (let i = 0; i < (stats.pellets ?? 1); i++) {
      const dir = (stats.pellets ?? 1) > 1
        ? shotgunPelletDirection(center, stats, aiming, random)
        : center;
      const hit = rayCombatantHit(origin, dir, feet);
      if (hit && hit.t <= maxWeaponHitRange(stats.range, stats)) {
        hits++;
        volleyDamage += damageAtRange(
          stats.damage * (hit.head ? stats.headshotMult : 1), hit.t, stats.range, stats,
        );
      }
    }
    damage += volleyDamage;
    if (volleyDamage >= 100) kills++;
  }
  return { damage: damage / shots, ohkRate: kills / shots, pelletHitRate: hits / (shots * (stats.pellets ?? 1)) };
}

describe("shotgun attachment combinations", () => {
  test("all regular shotgun variants are covered", () => {
    expect(shotguns.map(w => w.id).sort()).toEqual(["shotgun_auto", "shotgun_br", "shotgun_combat"]);
  });

  test("every legal sight/barrel/grip/ammunition combination has sane ballistic stats", () => {
    let count = 0;
    for (const weapon of shotguns) {
      const idsFor = (slot: AttachmentSlot) => [null, ...compatibleAttachments(weapon.id, slot)];
      for (const sight of idsFor("sight"))
      for (const barrel of idsFor("barrel"))
      for (const grip of idsFor("grip"))
      for (const magazine of idsFor("magazine")) {
        const s = computeEffectiveStats(weapon, { sight, barrel, grip, magazine });
        count++;
        for (const key of ["damage", "range", "fireRate", "spread", "adsSpread", "recoil", "magSize", "reloadTime"] as const) {
          expect(Number.isFinite(s[key])).toBe(true);
        }
        expect(s.damage).toBeGreaterThan(0);
        expect(s.range).toBeGreaterThan(0);
        expect(s.pellets ?? 1).toBeGreaterThan(0);
        expect(s.pellets ?? 1).toBeLessThanOrEqual(20);
        expect(s.magSize).toBeGreaterThanOrEqual(1);
        // Hipfire lasers may intentionally make hip spread tighter than ADS.
        expect(shotgunConeRadians(s, true)).toBeGreaterThan(0);
        expect(shotgunConeRadians(s, false)).toBeGreaterThan(0);
        const p = shotgunPelletDirection([0, 0, 1], s, false, randomFrom(13));
        expect(Math.hypot(...p)).toBeCloseTo(1, 9);
        expect(p.every(Number.isFinite)).toBe(true);
      }
    }
    // 5 sights x 5 barrels x 5 grips x 6 magazine choices x 3 shotguns.
    expect(count).toBe(2250);
  });

  test("special ammunition forms clearly different damage, pattern and range trades", () => {
    for (const weapon of shotguns) {
      const base = get(weapon.id);
      const slug = get(weapon.id, "mag_slug");
      const swarm = get(weapon.id, "mag_pellets");
      const breath = get(weapon.id, "mag_dragons_breath");
      const beanbag = get(weapon.id, "mag_beanbag");
      expect(base.pellets).toBe(8);
      expect(slug.pellets).toBe(1);
      expect(slug.range).toBeGreaterThan(base.range);
      expect(slug.range).toBeLessThan(base.range * 2.5);
      expect(swarm.pellets).toBe(14);
      expect(swarm.spread).toBeGreaterThan(base.spread);
      expect(swarm.range).toBeLessThan(base.range);
      expect(breath.pellets).toBe(6);
      expect(breath.range).toBeLessThan(base.range);
      expect(beanbag.pellets).toBe(5);
      expect(beanbag.damage).toBeLessThan(base.damage);
      expect(beanbag.fireRate).toBeGreaterThan(base.fireRate);
    }
  });

  test("a choke actually tightens close-range patterns, including hipfire", () => {
    for (const weapon of shotguns) {
      const base = get(weapon.id);
      const choke = get(weapon.id, null, "barrel_choke");
      expect(shotgunConeRadians(choke, false)).toBeLessThan(shotgunConeRadians(base, false));
      expect(shotgunConeRadians(choke, true)).toBeLessThan(shotgunConeRadians(base, true));
      expect(benchmark(choke, 12, false, 2000).pelletHitRate)
        .toBeGreaterThanOrEqual(benchmark(base, 12, false, 2000).pelletHitRate);
    }
  });

  test("buckshot can consistently fight in close quarters, but loses at long range", () => {
    const breacher = get("shotgun_br");
    const wraith = get("shotgun_auto");
    const mauler = get("shotgun_combat");
    expect(benchmark(breacher, 4, false).damage).toBeGreaterThan(110);
    expect(benchmark(breacher, 8, false).damage).toBeGreaterThan(55);
    expect(benchmark(breacher, 18, true).damage).toBeLessThan(45);
    expect(benchmark(wraith, 4, false).damage).toBeGreaterThan(50);
    expect(benchmark(wraith, 18, true).damage).toBeLessThan(20);
    expect(benchmark(mauler, 4, false).damage).toBeGreaterThan(90);
    expect(benchmark(mauler, 20, true).damage).toBeLessThan(45);
    for (const w of shotguns) {
      const base = get(w.id);
      expect(benchmark(base, 25, true).ohkRate).toBe(0);
      // ADS must connect at least as many pellets; slightly wider hip patterns
      // can occasionally land more headshots and therefore more raw damage.
      expect(benchmark(base, 8, true).pelletHitRate).toBeGreaterThanOrEqual(
        benchmark(base, 8, false).pelletHitRate,
      );
    }
  });

  test("wide shot stays centered, normalized and works for steep aim angles", () => {
    for (const dir of [[0, 0, 1], [0, 1, 0], [0, -1, 0], [0.5, 0.4, 0.7]] as Vec3[]) {
      const s = get("shotgun_br");
      const rng = randomFrom(7);
      for (let i = 0; i < 500; i++) {
        const p = shotgunPelletDirection(dir, s, i % 2 === 0, rng);
        expect(p.every(Number.isFinite)).toBe(true);
        expect(Math.hypot(...p)).toBeCloseTo(1, 9);
      }
    }
  });
});
