import { describe, expect, test } from "bun:test";
import { blastDistance } from "../src/lib/explosion-damage-rules";
import { MINE_TRIGGER_RADIUS, MINE_SPLASH_RADIUS, MINE_SHOT_RADIUS, groundMineImpact, mineContactPoint,
  mineSplashDamage, mineShotDistance, closestShotMine, mineOwnerActive, tacticalDirectDamage } from "../src/lib/tactical-balance";
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


describe("shootable persistent proximity mines", () => {
  const mine:Vec3 = [0,0.12,4];
  const eye:Vec3 = [0,0.23,0];
  const forward:Vec3 = [0,0,1];
  test("a bullet through the physical mine body detonates it", () => {
    expect(mineShotDistance(eye, forward, mine, 10)).toBeCloseTo(4-MINE_SHOT_RADIUS, 6);
  });
  test("bullets passing above or to the side cannot detonate a mine", () => {
    expect(mineShotDistance([1,0.23,0],forward,mine,10)).toBeNull();
    expect(mineShotDistance([0,1.6,0],forward,mine,10)).toBeNull();
  });
  test("a mine behind an obstruction or beyond weapon range cannot be shot", () => {
    expect(mineShotDistance(eye,forward,mine,2)).toBeNull();
    expect(mineShotDistance(eye,forward,mine,3.5)).toBeNull();
    expect(mineShotDistance(eye,forward,mine,4)).not.toBeNull();
  });
  test("the nearest mine struck by a bullet detonates first", () => {
    const far={id:"far",pos:mine},near={id:"near",pos:[0,0.12,2] as Vec3};
    const result=closestShotMine([far,near],eye,forward,10);
    expect(result?.mine.id).toBe("near");
    expect(result?.distance).toBeCloseTo(2-MINE_SHOT_RADIUS,6);
    expect(closestShotMine([far,near],eye,forward,1)).toBeNull();
  });
  test("a mine persists for an active owner, including beyond its old 45-second fuse", () => {
    // Mine lifecycle uses owner state, not a timer or deploy timestamp.
    const owner={id:"sniper",alive:true};
    expect(mineOwnerActive(owner)).toBe(true);
    expect(mineOwnerActive(owner)).toBe(true); // unchanged even after elapsed time
    owner.alive=false;
    expect(mineOwnerActive(owner)).toBe(false);
    expect(mineOwnerActive(null)).toBe(false); // player left the match
    expect(mineOwnerActive(undefined)).toBe(false);
  });
  test("gunshot detonation has splash damage, not the proximity direct-hit bonus", () => {
    expect(mineSplashDamage(0)).toBe(38);
    expect(mineSplashDamage(1.2)).toBeGreaterThan(0);
    expect(mineSplashDamage(MINE_SPLASH_RADIUS+.001)).toBe(0);
    // Proximity contact still deals a guaranteed elimination of a normal operator.
    expect(tacticalDirectDamage(140,300,false)).toBe(300);
  });
});
