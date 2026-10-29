import {CoverSpatialIndex} from "../src/lib/cover-spatial-index";
import {describe,expect,test} from "bun:test";
import * as THREE from "three";
import {bouncingProjectilePath,projectilePositionAt,bounceVelocity} from "../src/lib/bouncing-projectile";
import {clusterShots,clusterGravity,CLUSTER_MAX_DAMAGE,CLUSTER_SHELL_FUSE_MS,clusterDamage} from "../src/lib/cluster-grenades";
import {weaponById,projectileSplashRadius} from "../src/lib/game-data";
import {MOVEMENT} from "../src/lib/movement-rules";
import {orbitalGravity} from "../src/lib/orbital-reactor";
import {FPSEngine} from "../src/lib/fps-engine";
import {RIOT_SHIELD_ID,shieldPanel} from "../src/lib/riot-shield";
import type {CoverBox,Vec3} from "../src/lib/game-protocol";

const rules={gravity:MOVEMENT.gravity,radius:.1,fuseMs:1400};
const wall:CoverBox={pos:[0,2,2],size:[10,2,.1]};
describe("fuse-timed grenade ricochets",()=>{
 test("the shell bounces from a wall and keeps flying until its fuse expires",()=>{
  const path=bouncingProjectilePath([0,1.62,0],[0,3,29],[wall],rules);
  const hit=path.bounces!.find(b=>b.normal[2]===-1)!;
  expect(hit).toBeDefined();expect(hit.timeMs).toBeLessThan(100);
  expect(path.flightMs).toBe(1400);expect(path.impact[2]).toBeLessThan(hit.point[2]-1);
  expect(path.points.every(p=>p[2]<=1.801)).toBe(true);
 });
 test("the grenade's radius stops fast shots crossing very thin cover",()=>{
  const thin:CoverBox={pos:[0,2,1],size:[10,2,.005]};
  const path=bouncingProjectilePath([0,1,0],[0,0,120],[thin],{...rules,fuseMs:100});
  expect(path.bounces!.some(b=>b.normal[2]===-1)).toBe(true);
  // Inspect rendered intermediate positions too, not just integration samples.
  for(let t=0;t<=100;t++)expect(projectilePositionAt(path,t)[2]).toBeLessThan(.896);
 });
 test("floor bounces lose energy and stay above the floor",()=>{
  const path=bouncingProjectilePath([0,2,0],[0,-3,0],[],rules);
  const hits=path.bounces!.filter(b=>b.normal[1]===1);
  expect(hits.length).toBeGreaterThanOrEqual(2);
  const peak=(from:number,to:number)=>Math.max(...path.points.filter((_,i)=>path.timesMs![i]>=from&&path.timesMs![i]<=to).map(p=>p[1]));
  const first=peak(hits[0].timeMs,hits[1].timeMs);
  const second=peak(hits[1].timeMs,hits[2]?.timeMs??path.flightMs);
  expect(first).toBeGreaterThan(.25);expect(second).toBeLessThan(first);
  expect(path.points.every(p=>p[1]>=.1-1e-6)).toBe(true);
 });
 test("raised platforms and ceilings supply their own contact normals",()=>{
  const platform:CoverBox={pos:[0,1,0],size:[3,1,3],kind:"platform"};
  const landed=bouncingProjectilePath([0,4,0],[0,-2,0],[platform],rules);
  expect(landed.bounces!.some(b=>b.normal[1]===1&&b.point[1]>2)).toBe(true);
  expect(landed.points.every(p=>p[1]>=2.1-1e-6)).toBe(true);
  const ceiling:CoverBox={pos:[0,3,0],size:[4,.05,4]};
  const upward=bouncingProjectilePath([0,1.6,0],[0,10,0],[ceiling],rules);
  expect(upward.bounces!.some(b=>b.normal[1]===-1)).toBe(true);
  expect(upward.points.every(p=>p[1]<=2.851)).toBe(true);
 });
 test("a corner can reflect both axes without tunneling or losing the fuse",()=>{
  const boxes:CoverBox[]=[{pos:[1,2,0],size:[.01,2,8]},{pos:[0,2,1],size:[8,2,.01]}];
  const p=bouncingProjectilePath([0,1,0],[20,0,20],boxes,rules);
  expect(p.bounces!.some(b=>b.normal[0]===-1)).toBe(true);
  expect(p.bounces!.some(b=>b.normal[2]===-1)).toBe(true);
  for(const point of p.points){expect(point[0]).toBeLessThan(.891);expect(point[2]).toBeLessThan(.891);}
  expect(p.timesMs!.at(-1)).toBe(1400);
 });
 test("non-solid accents do not bounce grenades; solid props do",()=>{
  const accent=bouncingProjectilePath([0,1.62,0],[0,3,29],[{...wall,kind:"accent"}],rules);
  expect(accent.bounces!.some(b=>b.normal[2]!==0)).toBe(false);
  expect(accent.points.some(p=>p[2]>2)).toBe(true);
  const solid=bouncingProjectilePath([0,1.62,0],[0,3,29],[{...wall,kind:"cover"}],rules);
  expect(solid.bounces!.some(b=>b.normal[2]===-1)).toBe(true);
 });
 test("oblique ricochets damp tangential and normal energy",()=>{
  const velocity=bounceVelocity([4,-10,6],[0,1,0]);
  expect(velocity[1]).toBe(5);expect(velocity[0]).toBeCloseTo(3.12);
  expect(Math.hypot(...velocity)).toBeLessThan(Math.hypot(4,-10,6));
 });
});

describe("Thunderclap blast and map gravity",()=>{
 test("uses the stronger catalog profile for both the shell and its six children",()=>{
  const weapon=weaponById("wonder_cluster"),shots=clusterShots([0,1.62,0],[0,0,1],[]);
  expect(weapon.stats.damage).toBe(120);expect(projectileSplashRadius(weapon)).toBe(6);
  expect(shots[0].damage).toBe(weapon.stats.damage);expect(shots[0].radius).toBe(6);
  expect(shots[0].path.flightMs).toBe(CLUSTER_SHELL_FUSE_MS);
  for(const s of shots.slice(1)){expect(s.damage).toBe(75);expect(s.radius).toBe(4.5);expect(s.delayMs).toBe(1400);}
  expect(shots.slice(1).some(s=>s.path.bounces!.length>0)).toBe(true);
  expect(clusterDamage(3,shots[0])).toBeGreaterThan(75);
  expect(clusterDamage(3,shots[1])).toBeGreaterThan(40);
  expect(clusterDamage(6,shots[0])).toBe(0);expect(CLUSTER_MAX_DAMAGE).toBe(240);
 });
 test("Orbital Nexus uses its lower world gravity in both flight and ricochets",()=>{
  const ordinary=clusterShots([0,1.62,0],[0,0,1],[],"compound");
  const orbital=clusterShots([0,1.62,0],[0,0,1],[],"orbital_nexus");
  expect(clusterGravity("compound")).toBe(MOVEMENT.gravity);
  expect(clusterGravity("orbital_nexus")).toBe(MOVEMENT.gravity*orbitalGravity("orbital_nexus"));
  expect(projectilePositionAt(orbital[0].path,200)[1]).toBeGreaterThan(projectilePositionAt(ordinary[0].path,200)[1]+.1);
  const firstFloor=(p:typeof ordinary)=>p[0].path.bounces!.find(b=>b.normal[1]===1)!.timeMs;
  expect(firstFloor(orbital)).toBeGreaterThan(firstFloor(ordinary));
  expect(orbital[0].path.flightMs).toBe(ordinary[0].path.flightMs);
 });
 test("server and offline inputs produce identical points, contacts and timestamps",()=>{
  const a=clusterShots([0,1.62,0],[.2,.1,.97],[wall],"orbital_nexus");
  const b=clusterShots([0,1.62,0],[.2,.1,.97],[wall],"orbital_nexus");expect(a).toEqual(b);
  for(const s of a){expect(s.path.timesMs).toHaveLength(s.path.points.length);expect(projectilePositionAt(s.path,s.path.flightMs)).toEqual(s.path.impact);}
 });
 test("legacy active volley paths remain renderable",()=>{
  expect(projectilePositionAt({points:[[0,0,0],[0,0,10]],impact:[0,0,10],flightMs:1000},500)).toEqual([0,0,5]);
 });
});

describe("Bulwark's resting angle",()=>{
 test("first-person and world shields align with the collision plane at every facing",()=>{
  for(const raised of [false,true])for(const yaw of [0,Math.PI/2,-1.4]){
   const camera=new THREE.PerspectiveCamera();camera.rotation.y=yaw+Math.PI;
   const model=new THREE.Group();camera.add(model);
   const world=new THREE.Group();world.rotation.y=yaw;
   const c:any={id:"other",weaponId:RIOT_SHIELD_ID,group:world,riotShieldHp:250,riotShieldRaised:raised};
   const e:any=Object.create(FPSEngine.prototype);
   Object.assign(e,{weaponId:RIOT_SHIELD_ID,alive:true,riotShieldHp:250,aiming:raised,reloading:false,sprinting:false,
     riotShieldModel:model,combatants:new Map([[c.id,c]])});
   e.updateRiotModels();camera.updateMatrixWorld(true);world.updateMatrixWorld(true);
   const panel=shieldPanel(raised),normal=new THREE.Vector3(Math.sin(yaw+panel.yawOffset),0,Math.cos(yaw+panel.yawOffset));
   for(const visible of [model,c.riotShieldModel]){
    const across=new THREE.Vector3(1,0,0).transformDirection(visible.matrixWorld);
    expect(Math.abs(across.dot(normal))).toBeLessThan(1e-6);
    if(!raised){
     const right=new THREE.Vector3(-Math.cos(yaw),0,Math.sin(yaw)),forward=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
     // The panel's inner edge points forward: '/' when viewed from above.
     expect(across.dot(right)*across.dot(forward)).toBeGreaterThan(0);
    }
   }
  }
 });
});

test("launch-time broadphase retains the same collision and timestamp results",()=>{
 const cover:CoverBox[]=[wall,{pos:[-5,1,0],size:[1,1,1]},...Array.from({length:80},(_,i)=>({pos:[30+i*2,2,30] as Vec3,size:[.4,2,.4] as Vec3}))];
 const full=bouncingProjectilePath([0,1.62,0],[2,3,29],cover,rules);
 const indexed=bouncingProjectilePath([0,1.62,0],[2,3,29],cover,rules,new CoverSpatialIndex(cover));
 expect(indexed).toEqual(full);
});
