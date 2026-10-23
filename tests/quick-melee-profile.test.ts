import { describe,expect,test } from "bun:test";
import { weaponById } from "../src/lib/game-data";
import { quickMeleeProfile,chooseQuickMeleeTarget } from "../src/lib/quick-melee";

describe("equipped quick melee F",()=>{
  test("takes rate, damage and reach from the actual melee loadout",()=>{
    for(const id of ["knife_tactical","machete","shiv","baton","axe","hammer"]){
      const stats=weaponById(id).stats;
      const quick=quickMeleeProfile(stats);
      expect(quick.damage).toBe(stats.damage);
      expect(quick.reach).toBe(stats.range);
      expect(quick.cooldownMs).toBe(Math.ceil(1000/stats.fireRate));
      expect(quick.swingMs).toBeLessThanOrEqual(quick.cooldownMs);
    }
  });
  test("a hammer swings slower and hits harder than a shiv",()=>{
    const hammer=quickMeleeProfile(weaponById("hammer").stats);
    const shiv=quickMeleeProfile(weaponById("shiv").stats);
    expect(hammer.cooldownMs).toBeGreaterThan(shiv.cooldownMs);
    expect(hammer.swingMs).toBeGreaterThan(shiv.swingMs);
    expect(hammer.damage).toBeGreaterThan(shiv.damage);
  });
  test("uses equipped reach, not a fixed knife range",()=>{
    const targets=[{id:"target",pos:[0,0,2.9] as const,alive:true}];
    const from=[0,0,0] as const;
    expect(chooseQuickMeleeTarget(from,0,targets,()=>true,weaponById("shiv").stats.range)).toBeNull();
    expect(chooseQuickMeleeTarget(from,0,targets,()=>true,weaponById("baton").stats.range)?.id).toBe("target");
  });
});
