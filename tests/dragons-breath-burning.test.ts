import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  DRAGONS_BREATH_BURN_MS, DRAGONS_BREATH_TICK_MS, DRAGONS_BREATH_TICK_DAMAGE,
  dragonBreathVisualUntil,dragonBreathIgnition,
} from "../src/lib/incendiary-status";
import {computeEffectiveStats, weaponById} from "../src/lib/game-data";

const empty={sight:null,barrel:null,grip:null,magazine:null};
const engine=readFileSync(new URL("../src/lib/fps-engine.ts",import.meta.url),"utf8");
const server=readFileSync(new URL("../src/lib/game-server.ts",import.meta.url),"utf8");
const protocol=readFileSync(new URL("../src/lib/game-protocol.ts",import.meta.url),"utf8");

describe("Dragon's Breath ignition",()=>{
  test("all conventional shotguns resolve the incendiary shell with cover penetration",()=>{
    for (const id of ["shotgun_br","shotgun_combat","shotgun_auto"]){
      const weapon=weaponById(id);
      const stats=computeEffectiveStats(weapon,{...empty,magazine:"mag_dragons_breath"});
      expect(stats.shotgunAmmo).toBe("dragons_breath");
      expect(stats.coverPenetration).toBeGreaterThan(0);
      expect(dragonBreathIgnition(1000,stats.shotgunAmmo==="dragons_breath",true))
        .toEqual({expiresAt:4000,tickAt:1500,damagePerTick:2});
    }
  });
  test("duration and attributed damage tick stay unchanged",()=>{
    expect(DRAGONS_BREATH_BURN_MS).toBe(3000);
    expect(DRAGONS_BREATH_TICK_MS).toBe(500);
    expect(DRAGONS_BREATH_TICK_DAMAGE).toBe(2);
    expect(dragonBreathIgnition(1300,true,true)).toEqual({
      expiresAt:4300,tickAt:1800,damagePerTick:2,
    });
  });
  test("ordinary shells, shields, dead targets and invalid time never ignite",()=>{
    expect(dragonBreathIgnition(1000,false,true)).toBeNull();
    expect(dragonBreathIgnition(1000,true,false)).toBeNull();
    expect(dragonBreathIgnition(1000,true,true,true)).toBeNull();
    expect(dragonBreathIgnition(NaN,true,true)).toBeNull();
  });
  test("lethal hits immediately stop flames and never apply a DoT",()=>{
    expect(dragonBreathVisualUntil(1000,true,false,true)).toBe(4000);
    expect(dragonBreathVisualUntil(1000,true,false,false)).toBeNull();
    expect(dragonBreathVisualUntil(1000,true,true,true)).toBeNull();
    expect(dragonBreathVisualUntil(1000,false,false,true)).toBeNull();
    expect(dragonBreathIgnition(1000,true,false)).toBeNull();
    expect(engine).toContain("const burning = c.alive &&");
    expect(engine).not.toContain("c.alive||falling");
    expect(engine).toContain("this.localBurning.delete(victim.id)");
    expect(engine).toContain("this.poisonByVictim.delete(victim.id)");
  });
  test("offline: both penetrative and ordinary hits start the same burn and DoT",()=>{
    const call="this.igniteDragonBreath(";
    expect(engine.split(call).length-1).toBe(2);
    expect(engine).toContain("this.igniteDragonBreath(victim)");
    expect(engine).toContain("this.igniteDragonBreath(nearest.c)");
    expect(engine).toContain("this.localBurning.set(victim.id,until)");
    expect(engine).toContain("this.poisonByVictim.set(victim.id");
  });
  test("online: server applies status and broadcasts immediate FX as well as snapshots",()=>{
    expect(server).toContain("dragonBreathIgnition(now,incendiary,hit.victim.alive,shielded)");
    expect(server).toContain("room.burning.set(hit.victim.id,Math.max");
    expect(server).toContain('t:"burnFx"');
    expect(server).toContain("burning: [...room.burning.entries()]");
    expect(server).toContain("dragonBreathVisualUntil(now,incendiary,shielded,hit.victim.alive)");
    expect(server).toContain("room.burning.delete(id)");
    expect(server).toContain("if(killed)room.burning.delete(victim.id)");
    expect(server).toContain("room.burning.delete(p.id)");
    expect(server).toContain("room.players.get(id)?.alive || room.bots.get(id)?.alive");
    expect(protocol).toContain('t: "burnFx"');
    expect(engine).toContain('case "burnFx":');
    expect(engine).toContain("this.onlineBurning.set(msg.victimId");
    expect(engine).toContain("new THREE.ConeGeometry(.10,.35,7)");
    expect(engine).toContain("burning?14:9");
  });
});
