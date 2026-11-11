import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { weaponById } from "../src/lib/game-data";
import { firingMotionFactor, shotSpread, spreadShotDirection } from "../src/lib/weapon-accuracy";
import { automaticBloom } from "../src/lib/automatic-spread";
import { shotgunConeRadians } from "../src/lib/shotgun-pattern";

describe("one authoritative spread calculation", () => {
  test("zero spread does not change the normalized aim ray", () => {
    expect(spreadShotDirection([0, 0, 1], 0, () => .99)).toEqual([0, 0, 1]);
  });

  test("the shared sampler is reproducible and normalizes the result", () => {
    const rng = () => .75;
    const a = spreadShotDirection([0, 0, 1], .06, rng);
    const b = spreadShotDirection([0, 0, 1], .06, rng);
    expect(a).toEqual(b);
    expect(Math.hypot(...a)).toBeCloseTo(1, 10);
    expect(a[0]).toBeGreaterThan(0);
    expect(a[1]).toBeGreaterThan(0);
  });

  test("bad spread inputs cannot create an invalid direction", () => {
    expect(spreadShotDirection([0, 0, 1], -1, () => .9)).toEqual([0, 0, 1]);
    expect(spreadShotDirection([0, 0, 1], Number.NaN, () => .9)).toEqual([0, 0, 1]);
  });

  test("posture is computed from the same model in client and server", () => {
    const settled = firingMotionFactor({
      sprinting: false, airborne: false, movingFast: false,
      firing: true, aiming: true, bloom: 0, tasered: false,
    });
    const mobile = firingMotionFactor({
      sprinting: false, airborne: false, movingFast: true,
      firing: true, aiming: false, bloom: 0, tasered: false,
    });
    const tasered = firingMotionFactor({
      sprinting: false, airborne: false, movingFast: false,
      firing: true, aiming: false, bloom: 0, tasered: true,
    });
    expect(settled).toBeCloseTo(.045);
    expect(mobile).toBeCloseTo(.45);
    expect(tasered).toBeCloseTo(.70);
  });

  test("the authoritative dispersion grows through sustained automatic fire", () => {
    const lmg=weaponById("lmg_heavy");
    const steady = firingMotionFactor({
      sprinting: false, airborne: false, movingFast: false,
      firing: true, aiming: true, bloom: 0, tasered: false,
    });
    const first=shotSpread(lmg.stats,lmg.category,true,steady,0,true);
    const accumulated=automaticBloom(automaticBloom(0,lmg.stats.fireRate,60),lmg.stats.fireRate,60);
    const later=shotSpread(lmg.stats,lmg.category,true,steady,accumulated,true);
    expect(later).toBeGreaterThan(first);
    expect(later).toBeLessThan(first*5);
  });

  test("ADS vs hipfire uses the same weapon stats and firing posture", () => {
    const rifle=weaponById("rifle_ar");
    const ads=shotSpread(rifle.stats,rifle.category,true,0,0,true);
    const hip=shotSpread(rifle.stats,rifle.category,false,0,0,false);
    expect(ads).toBeLessThan(hip);
    expect(shotSpread(rifle.stats,rifle.category,false,.5,.6,false)).toBeGreaterThan(hip);
  });

  test("shotgun pellet cone is separate from normal hitscan dispersion", () => {
    const shotgun=weaponById("shotgun_br");
    expect(shotgunConeRadians(shotgun.stats,true)).toBeLessThan(shotgunConeRadians(shotgun.stats,false));
  });
});

describe("multiplayer accuracy contract", () => {
  const client=readFileSync(new URL("../src/lib/fps-engine.ts",import.meta.url),"utf8");
  const server=readFileSync(new URL("../src/lib/game-server.ts",import.meta.url),"utf8");

  test("client sends a clean ray and waits for the server-confirmed tracer", () => {
    expect(client).toContain("this.aimDir(this.opts.online || multiPelletShotgun ? 0 : spread)");
    expect(client).toContain("this.spawnTracer(msg.origin,msg.dir,msg.skinId");
    expect(client).not.toContain("this.spawnTracer(origin,dir,this.getCurrentSkinId(),this.eff.coverPenetration??0,this.eff.range);\n    } else {");
  });

  test("server samples dispersion once, not a second automatic roll", () => {
    expect(server).toContain("shotDir=spreadShotDirection(shotDir,spread)");
    expect(server).toContain("shotSpread(eff,weapon.category,aiming,motion,bloom,steadyAds)");
    expect(server).not.toContain("autoSpreadRadians(");
    expect(server).not.toContain("const extra=Math.max(0.012,eff.spread");
    expect(server).toContain("room.shotPosture.set(socket.id");
  });

  test("shotgun pellets use their own shared pattern without an extra base roll", () => {
    expect(server).toContain("!multiPelletShotgun && !nonBallisticWonder");
    expect(server).toContain("shotgunPelletDirection(shotDir");
  });
});
