import {describe,expect,test} from "bun:test";
import * as THREE from "three";
import {ExplosionEffects,MAX_EXPLOSION_EFFECTS} from "../src/lib/explosion-effects";
import {FPSEngine} from "../src/lib/fps-engine";
import {makeEngineStub} from "./helpers/engine-stub";
import {CLUSTER_MAX_DAMAGE} from "../src/lib/cluster-grenades";

const listener=new THREE.Vector3();
const meshes=(scene:THREE.Scene)=>scene.children.filter(o=>o.name==="pooled_explosion") as THREE.Mesh<THREE.SphereGeometry,THREE.MeshBasicMaterial>[];
const lights=(scene:THREE.Scene)=>scene.children.filter(o=>o instanceof THREE.PointLight) as THREE.PointLight[];
describe("bounded explosion rendering",()=>{
 test("a complete cluster burst never changes light count or allocates scene nodes",()=>{
  const scene=new THREE.Scene(),fx=new ExplosionEffects(scene),nodes=[...scene.children];
  const light=lights(scene)[0];expect(lights(scene)).toHaveLength(1);expect(light.visible).toBe(true);
  expect(light.castShadow).toBe(false);expect(light.intensity).toBe(0);
  for(let i=0;i<7;i++){
   fx.spawn(new THREE.Vector3(i,1,6),"ordinary",i===0?6:4.5,i*50,listener);fx.update(i*50,listener);
   expect(scene.children).toEqual(nodes);expect(lights(scene)).toEqual([light]);expect(light.visible).toBe(true);
  }
  expect(light.intensity).toBeGreaterThan(0);fx.update(1500,listener);
  expect(fx.activeCount).toBe(0);expect(light.intensity).toBe(0);expect(light.visible).toBe(true);
  expect(scene.children).toEqual(nodes);fx.dispose();
 });
 test("many simultaneous volleys share one geometry and a hard visual budget",()=>{
  const scene=new THREE.Scene(),fx=new ExplosionEffects(scene),pool=meshes(scene);
  expect(MAX_EXPLOSION_EFFECTS).toBeLessThanOrEqual(12);
  expect(pool).toHaveLength(MAX_EXPLOSION_EFFECTS);expect(new Set(pool.map(m=>m.geometry)).size).toBe(1);
  const ids=pool.map(m=>m.uuid);
  for(let i=0;i<200;i++){
   fx.spawn(new THREE.Vector3((i%10)*2,1,6),"ordinary",4.5,i*2,listener);fx.update(i*2,listener);
   expect(fx.activeCount).toBeLessThanOrEqual(MAX_EXPLOSION_EFFECTS);
  }
  expect(meshes(scene).map(m=>m.uuid)).toEqual(ids);expect(lights(scene)).toHaveLength(1);fx.dispose();
 });
 test("close effects take precedence over far effects when the pool is full",()=>{
  const scene=new THREE.Scene(),fx=new ExplosionEffects(scene);
  for(let i=0;i<MAX_EXPLOSION_EFFECTS;i++)fx.spawn(new THREE.Vector3(30+i,1,0),"ordinary",6,0,listener);
  expect(fx.spawn(new THREE.Vector3(90,1,0),"ordinary",6,0,listener)).toBe(false);
  expect(fx.spawn(new THREE.Vector3(1,1,0),"ordinary",6,0,listener)).toBe(true);
  expect(meshes(scene).some(m=>m.visible&&m.position.x===1)).toBe(true);
  expect(fx.spawn(new THREE.Vector3(1000,1,0),"ordinary",6,0,listener)).toBe(false);fx.dispose();
 });
 test("slots are reusable after expiry and all styles use the same fixed light",()=>{
  const scene=new THREE.Scene(),fx=new ExplosionEffects(scene),light=lights(scene)[0];
  for(const style of ["ordinary","singularity","corrosion","swarm"] as const){
   expect(fx.spawn(new THREE.Vector3(0,1,6),style,6,1000,listener)).toBe(true);fx.update(1100,listener);
   expect(lights(scene)[0]).toBe(light);expect(light.intensity).toBeGreaterThan(0);
   fx.update(2000,listener);expect(fx.activeCount).toBe(0);
  }
  fx.dispose();
 });
 test("repeated disposal releases shared geometry and each material exactly once",()=>{
  const scene=new THREE.Scene(),fx=new ExplosionEffects(scene),pool=meshes(scene);let geometries=0,materials=0;
  pool[0].geometry.addEventListener("dispose",()=>geometries++);
  for(const m of pool)m.material.addEventListener("dispose",()=>materials++);
  fx.dispose();fx.dispose();expect(geometries).toBe(1);expect(materials).toBe(MAX_EXPLOSION_EFFECTS);
  expect(scene.children).toHaveLength(0);expect(fx.spawn(listener,"ordinary",6,0,listener)).toBe(false);
 });
});

test("cluster audio coalesces adjacent reports and ignores inaudible detonations",()=>{
 const scene=new THREE.Scene(),fx=new ExplosionEffects(scene);let sounds=0;
 expect(fx.soundDue(new THREE.Vector3(1000,0,0),listener,0)).toBe(false);
 for(let i=0;i<6;i++)if(fx.soundDue(listener,listener,i*50))sounds++;
 expect(sounds).toBe(3);fx.dispose();expect(fx.soundDue(listener,listener,1000)).toBe(false);
});

test("exhausting the cosmetic budget never drops offline cluster damage",()=>{
 const run=(fill:boolean)=>{
  const scene=new THREE.Scene(),fx=new ExplosionEffects(scene),now=performance.now();
  if(fill)for(let i=0;i<MAX_EXPLOSION_EFFECTS;i++)fx.spawn(new THREE.Vector3(1,0,0),"ordinary",6,now,listener);
  const e:any=makeEngineStub(),damage:number[]=[];
  Object.assign(e,{opts:{mode:"tdm"},camera:new THREE.PerspectiveCamera(),yaw:0,explosionEffects:fx,
   weaponAudio:{play(){}},clusterVolleys:new Map(),bulletSpitters:new Map(),matchEnded:false,
   combatants:new Map([["target",{id:"target",pos:[20,0,0],alive:true,team:"blue"}]]),
   hasLineOfSight(){return true;},applyDamageLocal(_t:any,d:number){damage.push(d);}});
  const shot={path:{points:[[20,.2,0],[20,.2,0]],impact:[20,.2,0],flightMs:100},delayMs:0,damage:100,radius:3};
  e.addClusterVolley({id:"volley",ownerId:"self",ownerTeam:"red",launchedAt:Date.now()-150,shots:Array(7).fill(shot)},true);
  e.tickClusterVolleys();expect(fx.activeCount).toBeLessThanOrEqual(MAX_EXPLOSION_EFFECTS);
  fx.dispose();return damage.reduce((a,b)=>a+b,0);
 };
 expect(run(false)).toBe(CLUSTER_MAX_DAMAGE);expect(run(true)).toBe(CLUSTER_MAX_DAMAGE);
});
