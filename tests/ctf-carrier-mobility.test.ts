import {describe,expect,test} from "bun:test";
import {CTF_SPEED_MULTIPLIER,ctfCarrierWeaponSpeed} from "../src/lib/ctf-rules";
import {WEAPONS,computeEffectiveStats} from "../src/lib/game-data";

describe("CTF carrier speed versus melee mobility",()=>{
  test("melee retains its normal movement bonus when not carrying",()=>{
    const melee=WEAPONS.find(w=>w.category==="melee"&&!w.wonder)!;
    const stats=computeEffectiveStats(melee,{sight:null,barrel:null,grip:null,magazine:null});
    expect(stats.moveSpeed).toBeGreaterThan(melee.stats.moveSpeed);
    expect(ctfCarrierWeaponSpeed(stats.moveSpeed,false)).toBe(stats.moveSpeed);
  });
  test("flag speed buff cannot multiply a melee mobility advantage",()=>{
    expect(ctfCarrierWeaponSpeed(1.19,true)*CTF_SPEED_MULTIPLIER).toBeCloseTo(1.10);
    expect(ctfCarrierWeaponSpeed(1.5,true)).toBe(1);
    expect(ctfCarrierWeaponSpeed(0.85,true)).toBe(0.85);
  });
});
