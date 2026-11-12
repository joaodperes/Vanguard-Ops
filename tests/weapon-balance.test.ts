import { describe, expect, test } from "bun:test";
import {
  WEAPONS, weaponById, compatibleAttachments, computeEffectiveStats, damageAtRange, maxWeaponHitRange,
} from "../src/lib/game-data";
import { attachmentChallenge } from "../src/lib/armory-challenges";
import { canStartWeaponReload, crossbowReloadCycleMs, crossbowReloadControlsCadence } from "../src/lib/weapon-mechanics";
import { hitsToEliminate, idealTimeToKillMs } from "../src/lib/weapon-balance";

describe("weapon range and damage falloff", () => {
  test("close shots do full damage and shots at the far edge use each weapon's floor", () => {
    for (const weapon of WEAPONS.filter(w => !w.wonder && w.category !== "melee")) {
      const stats = weapon.stats;
      const full = damageAtRange(stats.damage, stats.range, stats.range, stats);
      expect(full).toBe(stats.damage);
      const far = maxWeaponHitRange(stats.range, stats);
      expect(far).toBeGreaterThan(stats.range);
      expect(damageAtRange(stats.damage, far, stats.range, stats))
        .toBeCloseTo(stats.damage * (stats.minDamageMultiplier ?? 0.4), 5);
      const halfway = (far + stats.range) / 2;
      const mid = damageAtRange(stats.damage, halfway, stats.range, stats);
      expect(mid).toBeLessThan(full);
      expect(mid).toBeGreaterThan(damageAtRange(stats.damage, far, stats.range, stats));
    }
  });

  test("assaults have shorter reach and the machine pistol loses damage sooner than the magnum", () => {
    const rifle = weaponById("rifle_ar").stats;
    const machine = weaponById("pistol_machine").stats;
    const magnum = weaponById("pistol_magnum").stats;
    expect(rifle.range).toBeLessThan(60);
    expect(machine.range).toBeLessThan(magnum.range);
    expect(maxWeaponHitRange(machine.range, machine)).toBeLessThan(maxWeaponHitRange(magnum.range, magnum));
    expect(machine.minDamageMultiplier!).toBeLessThan(magnum.minDamageMultiplier!);
  });
});

describe("2026 magazine kill-potential tuning", () => {
  test("VK-12 and Behemoth carry 24 rounds, Burst Pistol carries six complete bursts", () => {
    const cases = [
      ["rifle_ar", 24, 3, 8],
      ["rifle_heavy", 24, 3, 8],
      ["pistol_burst", 18, 3, 6],
    ] as const;
    for (const [weaponId, magazine, bodyHits, bodyKillPotential] of cases) {
      const weapon = weaponById(weaponId);
      const base = computeEffectiveStats(weapon, { sight:null, barrel:null, grip:null, magazine:null });
      expect(weapon.stats.magSize).toBe(magazine);
      expect(base.magSize).toBe(magazine);
      expect(hitsToEliminate(base)).toBe(bodyHits);
      expect(Math.floor(base.magSize / bodyHits)).toBe(bodyKillPotential);
      if (base.burst) expect(base.magSize % base.burst).toBe(0);
    }
  });

  test("magazine attachments scale from the new baseline without incomplete pistol bursts", () => {
    const empty = { sight:null, barrel:null, grip:null, magazine:null };
    expect(computeEffectiveStats(weaponById("rifle_ar"), { ...empty, magazine:"mag_extended" }).magSize).toBe(31);
    expect(computeEffectiveStats(weaponById("rifle_heavy"), { ...empty, magazine:"mag_extended" }).magSize).toBe(31);
    for (const mag of compatibleAttachments("pistol_burst", "magazine")) {
      const effective = computeEffectiveStats(weaponById("pistol_burst"), { ...empty, magazine:mag });
      expect(effective.magSize % 3).toBe(0);
    }
  });
});

describe("Marksman DMR magazine balance", () => {
  test("smaller 12-round base magazine still benefits from extended magazines", () => {
    const weapon = weaponById("rifle_dm");
    expect(weapon.stats.magSize).toBe(12);
    const extended = computeEffectiveStats(weapon, { sight: null, barrel: null, grip: null, magazine: "mag_extended" });
    expect(extended.magSize).toBe(15);
    expect(extended.reloadTime).toBeGreaterThan(weapon.stats.reloadTime);
  });
});

describe("distinct DMR roles at 100 HP", () => {
  test("Scout Tactical is the fast-handling three-body-hit DMR, unlike Whisper", () => {
    const scout = weaponById("dmr_scout");
    const whisper = weaponById("dmr_whisper");
    expect(scout.stats.magSize).toBe(14);
    expect(whisper.stats.magSize).toBe(14);
    expect(scout.stats.auto).toBe(false);
    expect(hitsToEliminate(scout.stats)).toBe(3);
    expect(hitsToEliminate(scout.stats, 0, 1)).toBe(2);
    expect(idealTimeToKillMs(scout, scout.stats)).toBeCloseTo(2000 / scout.stats.fireRate, 5);
    expect(hitsToEliminate(whisper.stats)).toBe(2);
    expect(scout.stats.adsTime).toBeLessThan(whisper.stats.adsTime);
    expect(scout.stats.moveSpeed).toBeGreaterThan(whisper.stats.moveSpeed);
    expect(scout.stats.range).toBeLessThan(whisper.stats.range);
    expect(scout.stats.adsSpread).toBeGreaterThan(whisper.stats.adsSpread);
    expect(scout.stats.recoil).toBeGreaterThan(whisper.stats.recoil);
  });

  test("Whisper is the longest-ranged and steadiest conventional DMR", () => {
    const whisper = weaponById("dmr_whisper");
    const otherRifles = ["dmr_scout", "rifle_dm", "dmr_cyclone", "dmr_heavy"]
      .map(weaponById);
    expect(whisper.stats.damage * whisper.stats.headshotMult).toBeLessThan(100);
    expect(hitsToEliminate(whisper.stats, 0, 1)).toBe(2);
    for (const other of otherRifles) {
      expect(whisper.stats.range).toBeGreaterThan(other.stats.range);
      expect(whisper.stats.adsSpread).toBeLessThan(other.stats.adsSpread);
      expect(whisper.stats.recoil).toBeLessThan(other.stats.recoil);
    }
  });

  test("Marksman rewards a single headshot, whereas Executioner adds penetration and en-bloc discipline", () => {
    const marksman = weaponById("rifle_dm");
    const executioner = weaponById("dmr_heavy");
    expect(hitsToEliminate(marksman.stats, 0, 1)).toBe(1);
    expect(hitsToEliminate(executioner.stats, 0, 1)).toBe(1);
    expect(hitsToEliminate(marksman.stats)).toBe(2);
    expect(hitsToEliminate(executioner.stats)).toBe(2);
    expect(marksman.stats.fireRate).toBeGreaterThan(executioner.stats.fireRate);
    expect(marksman.stats.adsTime).toBeLessThan(executioner.stats.adsTime);
    expect(executioner.stats.coverPenetration!).toBeGreaterThan(marksman.stats.coverPenetration!);
    expect(executioner.stats.bodyPenetration?.maxTargets).toBe(2);
    expect(executioner.stats.reloadOnlyWhenEmpty).toBe(true);
  });

  test("Cyclone is the only burst DMR; its 20-round magazine is ten two-round bursts", () => {
    const cyclone = weaponById("dmr_cyclone");
    expect(cyclone.stats.burst).toBe(2);
    expect(cyclone.stats.magSize / cyclone.stats.burst!).toBe(10);
    expect(hitsToEliminate(cyclone.stats)).toBe(3);
    expect(hitsToEliminate(cyclone.stats, 0, 2)).toBe(2);
    for (const id of ["dmr_scout", "dmr_whisper", "rifle_dm", "dmr_heavy"]) {
      expect(weaponById(id).stats.burst).toBeUndefined();
    }
  });

  test("Reclaimer is the recoverable single-bolt headshot specialist, not a rapid-fire rifle", () => {
    const reclaimer = weaponById("crossbow_reclaimer");
    expect(reclaimer.special?.kind).toBe("bolt");
    expect(reclaimer.stats.magSize).toBe(1);
    expect(reclaimer.stats.headshotMult).toBe(1.85);
    expect(hitsToEliminate(reclaimer.stats, 0, 1)).toBe(1);
    expect(hitsToEliminate(reclaimer.stats)).toBe(2);
    expect(idealTimeToKillMs(reclaimer, reclaimer.stats)).toBeNull();
    // The automatic quiver trades precision lethality for sustained fire.
    const quiver = computeEffectiveStats(reclaimer, { sight:null, barrel:null, grip:null, magazine:"mag_bolt_quiver" });
    expect(quiver.auto).toBe(true);
    expect(quiver.damage * quiver.headshotMult).toBeLessThan(100);
    // Recovered heavy arrows are powerful, but cannot be replenished by a normal reload.
    const heavy = computeEffectiveStats(reclaimer, { sight:null, barrel:null, grip:null, magazine:"mag_bolt_heavy" });
    expect(heavy.magSize).toBe(2);
    expect(heavy.damage).toBeGreaterThan(reclaimer.stats.damage);
  });
});

describe("Reclaimer Crossbow baseline tempo", () => {
  test("stock single-bolt firing is deliberate but no longer waits 2.1 seconds to re-nock", () => {
    const w = weaponById("crossbow_reclaimer");
    const bolt = w.special;
    expect(bolt?.kind).toBe("bolt");
    if (bolt?.kind !== "bolt") return;
    expect(w.stats.magSize).toBe(1);
    expect(w.stats.reloadTime).toBe(1.65);
    expect(w.stats.fireRate).toBe(0.65);
    expect(bolt.pickupRadius).toBe(3);
    expect(hitsToEliminate(w.stats, 0, 1)).toBe(1);
    expect(crossbowReloadCycleMs(w.stats.reloadTime,bolt.quickReloadSeconds,false)).toBe(1650);
    expect(crossbowReloadCycleMs(w.stats.reloadTime,bolt.quickReloadSeconds,true)).toBe(650);
  });

  test("retrieval improves the next nock, while loadouts keep their distinctive limits", () => {
    const w=weaponById("crossbow_reclaimer");
    if(w.special?.kind!=="bolt")throw Error("crossbow lost recovery special");
    const t=w.special.quickReloadSeconds;
    expect(crossbowReloadCycleMs(w.stats.reloadTime,t,true))
      .toBeLessThan(crossbowReloadCycleMs(w.stats.reloadTime,t,false)*.5);
    const none={sight:null,barrel:null,grip:null,magazine:null} as const;
    const light=computeEffectiveStats(w,{...none,magazine:"mag_bolt_light_quiver"});
    expect(light.magSize).toBe(1);
    expect(crossbowReloadControlsCadence(light.magSize)).toBe(true);
    expect(light.auto).toBe(false);
    expect(light.reloadTime).toBeCloseTo(1.65*.85,5);
    expect(crossbowReloadCycleMs(light.reloadTime,t,false)).toBeCloseTo(1402.5,3);
    expect(crossbowReloadCycleMs(light.reloadTime,t,false,.8)).toBeCloseTo(1122,3);
    const quiver=computeEffectiveStats(w,{...none,magazine:"mag_bolt_quiver"});
    const heavy=computeEffectiveStats(w,{...none,magazine:"mag_bolt_heavy"});
    expect(quiver.auto).toBe(true);
    expect(quiver.magSize).toBe(10);
    expect(quiver.damage * quiver.headshotMult).toBeLessThan(100);
    expect(heavy.magSize).toBe(2);
    expect(crossbowReloadControlsCadence(heavy.magSize)).toBe(false);
    expect(heavy.auto).toBe(false);
    const extended=computeEffectiveStats(w,{...none,magazine:"mag_extended"});
    expect(extended.magSize).toBe(2);
    expect(crossbowReloadControlsCadence(extended.magSize)).toBe(false);
    expect(extended.reloadTime).toBeGreaterThan(w.stats.reloadTime);
  });
});

describe("DMR handling balance", () => {
  test("Executioner is an 8-round slower DMR and can reload only empty", () => {
    const executioner = weaponById("dmr_heavy").stats;
    const whisper = weaponById("dmr_whisper").stats;
    expect(executioner.magSize).toBe(8);
    expect(executioner.fireRate).toBeLessThan(3);
    expect(executioner.fireRate).toBeLessThan(whisper.fireRate);
    expect(executioner.reloadOnlyWhenEmpty).toBe(true);
    expect(canStartWeaponReload(executioner, 1)).toBe(false);
    expect(canStartWeaponReload(executioner, 0)).toBe(true);
    expect(canStartWeaponReload(whisper, 1)).toBe(true);
  });
  test("Whisper no longer one-taps 100 HP heads and fires faster", () => {
    const stats = weaponById("dmr_whisper").stats;
    expect(stats.damage * stats.headshotMult).toBeLessThan(100);
    const withHeavyBarrel = computeEffectiveStats(weaponById("dmr_whisper"), { sight: null, barrel: "barrel_heavy", grip: null, magazine: null });
    expect(withHeavyBarrel.damage * stats.headshotMult).toBeLessThan(100);
    expect(stats.damage * stats.headshotMult * 2).toBeGreaterThanOrEqual(100);
    expect(stats.fireRate).toBeGreaterThan(2.7);
  });
});

describe("unmodified sight selection", () => {
  test("removing VK-12 sight returns the default iron sight configuration", () => {
    const rifle = weaponById("rifle_ar");
    const noAttachments = { sight: null, barrel: null, grip: null, magazine: null };
    expect(rifle.baseSightType ?? "iron").toBe("iron");
    expect(computeEffectiveStats(rifle, noAttachments).sightType).toBe("iron");
    expect(computeEffectiveStats(rifle, noAttachments).range).toBe(rifle.stats.range);
  });
});

describe("incremental reload profiles", () => {
  test("shotguns load shells and the heavy single-chamber sniper cycles its bolt", () => {
    for (const weapon of WEAPONS.filter(w => !w.wonder && w.category === "shotgun")) {
      expect(weapon.stats.reloadStyle).toBe("incremental");
      expect(weapon.stats.reloadPerRound).toBeGreaterThan(0);
      expect(weapon.stats.reloadPerRound).toBeLessThan(weapon.stats.reloadTime);
    }
    const heavy = weaponById("sniper_heavy");
    expect(heavy.stats.magSize).toBe(1);
    expect(heavy.stats.reloadStyle).toBe("incremental");
    expect(heavy.stats.reloadPerRound).toBeGreaterThan(0);
    expect(heavy.stats.reloadPerRound).toBeLessThan(heavy.stats.reloadTime);
    for (const id of ["sniper_scout", "sniper_lr", "rifle_ar"]) {
      expect(weaponById(id).stats.reloadStyle).toBeUndefined();
    }
  });
});

describe("attachment challenge variety", () => {
  test("magazine attachments have distinct tasks even on the Vanguard LSW", () => {
    for (const weaponId of ["lmg_light", "rifle_ar", "pistol_machine"]) {
      const ids = compatibleAttachments(weaponId, "magazine");
      expect(ids.length).toBeGreaterThanOrEqual(3);
      const signatures = ids.map(id => {
        const ch = attachmentChallenge(weaponId, id);
        expect(ch).not.toBeNull();
        return `${ch!.metric}:${ch!.goal}`;
      });
      expect(new Set(signatures).size).toBe(ids.length);
    }
  });
});
