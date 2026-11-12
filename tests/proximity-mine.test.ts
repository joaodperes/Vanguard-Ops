import { describe, expect, test } from "bun:test";
import { blastDistance } from "../src/lib/explosion-damage-rules";
import { MINE_TRIGGER_RADIUS, MINE_SPLASH_RADIUS, groundMineImpact, mineContactPoint,
  mineSplashDamage, tacticalDirectDamage } from "../src/lib/tactical-balance";
import type { CoverBox, Vec3 } from "../src/lib/game-protocol";

const box = (x:number,y:number,z:number,sx:number,sy:number,sz:number,kind="stair"):CoverBox =>
  ({pos:[x,y,z],size:[sx,sy,sz],kind} as CoverBox);

describe("proximity mine surface placement and detection", () => {
  test("grounds on a staircase tread rather than the thrower's elevation", () => {
    const stair=[box(1.2,.25,0,.5,.25,.8)];
    expect(groundMineImpact([1.2,1.12,0],1,stair)).toEqual([1.2,.62,0]);
    expect(groundMineImpact([1.2,.12,0],0,stair)).toEqual([1.2,.62,0]);
  });
  test("respects elevated platforms and does not jump to unreachable overhead cover", () => {
    const roof=box(1.2,3.75,0,2,.25,2,"solid");
    expect(groundMineImpact([1.2,4.12,0],4,[roof])).toEqual([1.2,4.12,0]);
    expect(groundMineImpact([1.2,.12,0],0,[roof])).toEqual([1.2,.12,0]);
    expect(groundMineImpact([5,4.12,0],4,[roof])).toEqual([5,.12,0]);
  });
  test("lower-body contact triggers and damages a climber", () => {
    const mine:Vec3=[0,.32,0],feet:Vec3=[1,.5,0];
    const d=blastDistance(mine,mineContactPoint(mine,feet));
    expect(d).toBeLessThan(MINE_TRIGGER_RADIUS);
    expect(d).toBeLessThan(MINE_SPLASH_RADIUS);
    expect(mineSplashDamage(d)).toBeGreaterThan(0);
    expect(tacticalDirectDamage(140,500,false)).toBe(500);
  });
  test("3D range still prevents splash across floors", () => {
    const mine:Vec3=[0,.32,0],feet:Vec3=[0,3.2,0];
    expect(blastDistance(mine,mineContactPoint(mine,feet))).toBeGreaterThan(MINE_SPLASH_RADIUS);
  });
});
