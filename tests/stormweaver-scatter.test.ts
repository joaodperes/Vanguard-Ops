import { describe, expect, test } from "bun:test";
import { weaponById } from "../src/lib/game-data";
import type { Vec3, CoverBox } from "../src/lib/game-protocol";
import {
  stormPelletDirections, traceStormPellet, stormMinePosition, stormMineInReach,
  stormEnemy, stormTargetPoint, nextStormChainTarget, STORM_PELLETS,
  STORM_CHAIN_JUMPS, STORM_MINE_JUMPS, STORM_MINE_ARM_MS,
  STORM_MINE_LIFETIME_MS, STORM_MINE_TRIGGER_RADIUS,
  STORM_MAX_MINES_PER_OWNER, STORM_MAX_DIRECT_HITS_PER_TARGET,
  STORM_MINE_DAMAGE, STORM_MINE_CHAIN_RADIUS,
} from "../src/lib/stormweaver";

const enemy=(id:string,pos:Vec3) => ({
  id,pos,alive:true,team:"blue",protected:false,
});
describe("Stormweaver scattershot + deployable energy mines",()=>{
 test("seven symmetric, unit-length pellets instead of a single hitscan",()=>{
   for(const aim of [[0,0,1],[0,.5,.87],[0,1,0]] as Vec3[]){
     const spread=stormPelletDirections(aim);
     expect(spread.length).toBe(STORM_PELLETS);
     expect(new Set(spread.map(d=>d.join(","))).size).toBe(STORM_PELLETS);
     for(const dir of spread)expect(Math.abs(Math.hypot(...dir)-1)).toBeLessThan(.00001);
   }
   expect(weaponById("wonder_stormweaver").stats.pellets).toBe(STORM_PELLETS);
 });
 test("real limb-inclusive enemy hits do not create a mine",()=>{
   const from:Vec3=[0,1.55,0],dir:Vec3=[0,0,1];
   const hit=traceStormPellet(from,dir,60,[],[enemy("bot",[0,0,8])]);
   expect(hit.victim?.id).toBe("bot");
   expect(hit.distance).toBeLessThan(8.1);
   expect(hit.point[2]).toBeLessThan(8.1);
 });
 test("wall cover beats an enemy behind it, yielding a real miss",()=>{
   const cover:CoverBox[]=[{pos:[0,1.3,4],size:[1,2,.5],kind:"solid"}];
   const hit=traceStormPellet([0,1.55,0],[0,0,1],60,cover,[enemy("hidden",[0,0,8])]);
   expect(hit.victim).toBeNull();
   expect(hit.point[2]).toBeLessThan(4);
   const land=stormMinePosition(hit.point,cover);
   expect(land[1]).toBeCloseTo(.11);
 });
 test("missed pellets fall onto floor or an exposed walkable platform",()=>{
   const base=stormMinePosition([8,5,3],[]);
   expect(base).toEqual([8,.11,3]);
   const boxes:CoverBox[]=[{pos:[8,1.5,3],size:[3,1.5,3],kind:"platform"}];
   expect(stormMinePosition([8,5,3],boxes)[1]).toBeCloseTo(3.11);
 });
 test("mine radius includes nearby opponents but not other floors",()=>{
   const mine:Vec3=[0,.11,0];
   expect(stormMineInReach(mine,[2.5,0,0])).toBe(true);
   expect(stormMineInReach(mine,[STORM_MINE_TRIGGER_RADIUS+.5,0,0])).toBe(false);
   expect(stormMineInReach(mine,[0,4,0])).toBe(false);
   expect(STORM_MINE_ARM_MS).toBeGreaterThanOrEqual(400);
   expect(STORM_MINE_LIFETIME_MS).toBe(4000);
 });
 test("nearest eligible chain target, no friendly fire / covered enemy / repeat",()=>{
   const foes=[enemy("near",[2,0,0]),enemy("far",[6,0,0]),
     {...enemy("protected",[1,0,0]),protected:true},
     {...enemy("ally",[.5,0,0]),team:"red"}];
   const seen=new Set(["near"]);
   const next=nextStormChainTarget([0,1.05,0],foes,new Set(),
     "shooter","red",false,STORM_MINE_CHAIN_RADIUS,()=>true);
   expect(next?.id).toBe("near");
   const second=nextStormChainTarget([0,1.05,0],foes,seen,
     "shooter","red",false,STORM_MINE_CHAIN_RADIUS,()=>true);
   expect(second?.id).toBe("far");
   expect(nextStormChainTarget([0,1.05,0],foes,seen,
     "shooter","red",false,STORM_MINE_CHAIN_RADIUS,()=>false)).toBeNull();
   expect(stormEnemy(foes[3],"shooter","red",false)).toBe(false);
 });
 test("shotgun-like but bounded damage and mine inventory",()=>{
   expect(STORM_CHAIN_JUMPS).toBe(2);
   expect(STORM_MINE_JUMPS).toBe(2);
   expect(STORM_MAX_MINES_PER_OWNER).toBeLessThanOrEqual(14);
   expect(STORM_MAX_DIRECT_HITS_PER_TARGET).toBeLessThan(STORM_PELLETS);
   expect(STORM_MINE_DAMAGE).toBeGreaterThan(0);
   expect(stormTargetPoint(enemy("a",[0,2,0]))).toEqual([0,3.05,0]);
   const w=weaponById("wonder_stormweaver");
   expect(w.wonder?.radius).toBe(STORM_MINE_CHAIN_RADIUS);
   expect(w.description).toContain("missed pellets");
 });
});
