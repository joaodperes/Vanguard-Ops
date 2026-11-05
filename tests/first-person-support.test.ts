import { describe, expect, test } from "bun:test";
import { supportActionWeight, supportHandRestMode, supportElbowPosition } from "../src/lib/first-person-animation";
import { firstPersonSupportGrip, weaponHoldPoints, WEAPON_VISUALS } from "../src/lib/weapon-models";

describe("first-person support hand", () => {
  test("supports ranged guns during idle, fire, ADS and sprint", () => {
    for (const category of ["assault", "smg", "shotgun", "dmr", "sniper", "lmg", "sidearm"]) {
      expect(supportHandRestMode(category, false, false)).toBe("weapon");
    }
  });
  test("keeps melee one-handed and places Bulwark hand on its intact shield", () => {
    expect(supportHandRestMode("melee", false, false)).toBe("none");
    expect(supportHandRestMode("sidearm", true, true)).toBe("shield");
    expect(supportHandRestMode("sidearm", true, false)).toBe("weapon");
  });
  test("transitions smoothly between steady grip and equipment/reload animation", () => {
    expect(supportActionWeight(-1)).toBe(0);
    expect(supportActionWeight(0)).toBe(0);
    expect(supportActionWeight(.5)).toBe(1);
    expect(supportActionWeight(1)).toBe(0);
    expect(supportActionWeight(2)).toBe(0);
    expect(supportActionWeight(.08)).toBeGreaterThan(0);
    expect(supportActionWeight(.08)).toBeLessThan(1);
    expect(supportActionWeight(.92)).toBeGreaterThan(0);
    expect(supportActionWeight(.92)).toBeLessThan(1);
    for (let p = 0; p <= 1; p += .01) {
      expect(supportActionWeight(p)).toBeGreaterThanOrEqual(0);
      expect(supportActionWeight(p)).toBeLessThanOrEqual(1);
    }
  });
});

describe("support-arm shoulder continuity", () => {
  const shoulder: [number, number, number] = [-.39, -.47, .30];
  const length = (a: readonly number[], b: readonly number[]) =>
    Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  test("every long rifle supports a continuous shoulder -> elbow -> hand reach", () => {
    for (const id of ["sniper_lr", "sniper_heavy", "dmr_heavy", "lmg_heavy", "launcher_rocket"]) {
      const grip = firstPersonSupportGrip(id);
      // Same weapon scale and desktop hip-fire translation as the engine.
      const wrist: [number, number, number] = [
        grip[0] * 1.2 + .30 - .045,
        grip[1] * 1.2 - .18 - .125,
        grip[2] * 1.2 - .48 + .10,
      ];
      const elbow = supportElbowPosition(shoulder, wrist);
      expect(elbow.every(Number.isFinite)).toBe(true);
      expect(length(shoulder, elbow)).toBeGreaterThan(.1);
      expect(length(elbow, wrist)).toBeGreaterThan(.1);
      // The cylinder geometry is scaled to these exact segment lengths,
      // not to the old fixed 35cm sleeve that stopped short of the torso.
      expect(length(shoulder, elbow) + length(elbow, wrist)).toBeGreaterThanOrEqual(length(shoulder, wrist) - 1e-9);
    }
  });

  test("short firearms, ADS, reloads and shield hand targets never degenerate", () => {
    const targets: [number, number, number][] = [
      [.18, -.30, -.45], // two-hand pistol pose
      [-.04, -.42, -.74], // long-gun ADS pose
      [-.21, -.66, -.55], // magazine insertion
      [-.17, -.14, -.85], // bolt/vent interaction
      [-.60, -.80, -.60], // Bulwark side shield
      [-.13, -.77, -.70], // Bulwark raised shield
      [.06, -.14, -.38], // equipment use
    ];
    for (const wrist of targets) {
      const elbow = supportElbowPosition(shoulder, wrist);
      expect(elbow.every(Number.isFinite)).toBe(true);
      expect(length(shoulder, elbow)).toBeGreaterThan(.05);
      expect(length(elbow, wrist)).toBeGreaterThan(.05);
    }
  });
});

describe("compact first-person support grips for long weapons", () => {
  const shoulder: [number, number, number] = [-.39, -.47, .30];
  const reach = (grip: readonly number[]) => {
    const wrist = [grip[0] * 1.2 + .30 - .045, grip[1] * 1.2 - .18 - .125, grip[2] * 1.2 - .48 + .10];
    return Math.hypot(wrist[0] - shoulder[0], wrist[1] - shoulder[1], wrist[2] - shoulder[2]);
  };

  test("snipers have a shorter, receiver-mounted grip with continuous arm reach", () => {
    for (const id of ["sniper_lr", "sniper_scout", "sniper_heavy"]) {
      const original = weaponHoldPoints(id).support;
      const adjusted = firstPersonSupportGrip(id);
      const profile = WEAPON_VISUALS[id];
      expect(adjusted[2]).toBeGreaterThan(original[2] + .10);
      expect(reach(adjusted)).toBeLessThan(reach(original) - .12);
      // Contact must stay on the receiver side and within its fore/aft bounds.
      expect(adjusted[2]).toBeGreaterThanOrEqual(-.12 - profile.receiver[2] / 2);
      expect(adjusted[2]).toBeLessThanOrEqual(-.12 + profile.receiver[2] / 2);
      expect(-adjusted[0]).toBeGreaterThanOrEqual(profile.receiver[0] / 2);
      const elbow = supportElbowPosition(shoulder, [
        adjusted[0] * 1.2 + .30 - .045,
        adjusted[1] * 1.2 - .18 - .125,
        adjusted[2] * 1.2 - .48 + .10,
      ]);
      expect(elbow.every(Number.isFinite)).toBe(true);
    }
  });

  test("other long receivers benefit without moving short guns, launchers or third-person grips", () => {
    for (const id of ["dmr_heavy", "rifle_heavy", "lmg_heavy", "lmg_hv", "rifle_dm"]) {
      expect(firstPersonSupportGrip(id)[2]).toBeGreaterThan(weaponHoldPoints(id).support[2]);
    }
    for (const id of ["rifle_ar", "smg_kp", "shotgun_br", "pistol_side", "launcher_rocket", "wonder_riot_shield"]) {
      expect(firstPersonSupportGrip(id)).toEqual(weaponHoldPoints(id).support);
    }
  });
});
