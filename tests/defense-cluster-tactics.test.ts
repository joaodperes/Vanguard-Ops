import {resolveMatchLoadout} from "../src/lib/match-loadout";
import {describe,expect,test} from "bun:test";
import * as THREE from "three";
import {FPSEngine} from "../src/lib/fps-engine";
import {weaponById,usesWonderCharges} from "../src/lib/game-data";
import {resolveLoadout} from "../src/lib/game-data";
import {rayRiotShield,damageRiotShield,shieldBlocksFire,RIOT_SHIELD_ID,RIOT_SHIELD_HP} from "../src/lib/riot-shield";
import {clusterShots,clusterDamage,clusterLifetime,CLUSTER_MAX_DAMAGE} from "../src/lib/cluster-grenades";
import {botTactics,botDetectionRange,botWantsCombatJump,botCornerScan} from "../src/lib/bot-difficulty";
import {botCombatDecision,botPatrolSprint} from "../src/lib/bot-combat-posture";
import {botHasJumpClearance} from "../src/lib/bot-physics";
import {sampleReloadMotion,reloadMotionFor} from "../src/lib/first-person-animation";
import {resolveShotAcoustics} from "../src/lib/weapon-audio";
import type {Vec3,CoverBox} from "../src/lib/game-protocol";

const unit=(a:Vec3)=>{const n=Math.hypot(...a);return a.map(x=>x/n) as Vec3;};
const carrier={pos:[0,0,0] as Vec3,yaw:0,weaponId:RIOT_SHIELD_ID,riotShieldHp:250,riotShieldRaised:true};
describe("physical 250 HP riot panel",()=>{
 test("raised plate covers head, torso, arms and legs from the front",()=>{
  for(const x of [-.5,0,.5])for(const y of [.12,.8,1.65,1.9])
   expect(rayRiotShield([x,y,8],[0,0,-1],carrier)).toBeGreaterThan(0);
 });
 test("back, sides and rays outside the rectangle stay exposed",()=>{
  expect(rayRiotShield([0,1,-8],[0,0,1],carrier)).toBeNull();
  expect(rayRiotShield([8,1,0],[-1,0,0],carrier)).toBeNull();
  expect(rayRiotShield([1.2,1,8],[0,0,-1],carrier)).toBeNull();
  expect(rayRiotShield([0,2.5,8],[0,0,-1],carrier)).toBeNull();
 });
 test("hip panel protects left front and leaves the pistol side open",()=>{
  const hip={...carrier,riotShieldRaised:false};
  expect(rayRiotShield([3,1,6],unit([-3,0,-6]),hip)).not.toBeNull();
  expect(rayRiotShield([-3,1,6],unit([3,0,-6]),hip)).toBeNull();
  expect(rayRiotShield([0,1,6],[0,0,-1],hip)).toBeNull();
 });
 test("facing and elevation rotate with the carrier; holstered/broken panels have no collision",()=>{
  expect(rayRiotShield([8,4,0],[-1,0,0],{...carrier,pos:[0,3,0],yaw:Math.PI/2})).not.toBeNull();
  expect(rayRiotShield([0,1,8],[0,0,-1],{...carrier,riotShieldHp:0})).toBeNull();
  expect(rayRiotShield([0,1,8],[0,0,-1],{...carrier,weaponId:"pistol_side"})).toBeNull();
  expect(damageRiotShield(250,170)).toBe(80);expect(damageRiotShield(80,170)).toBe(0);
  expect(shieldBlocksFire(RIOT_SHIELD_ID,true,250)).toBe(true);
  expect(shieldBlocksFire(RIOT_SHIELD_ID,false,250)).toBe(false);
  expect(shieldBlocksFire(RIOT_SHIELD_ID,true,0)).toBe(false);
 });
 test("actual offline bot shots drain the panel, then hit health after it breaks",()=>{
  const e:any=Object.create(FPSEngine.prototype);
  Object.assign(e,{opts:{mode:"ffa",team:"ffa",playerName:"test"},selfId:"self",pos:new THREE.Vector3(),yaw:0,
   health:100,alive:true,weaponId:RIOT_SHIELD_ID,aiming:true,reloading:false,sprinting:false,riotShieldHp:250,
   combatants:new Map(),map:{cover:[]},selfSpawnProtectedUntil:0,sound:{play(){}},takeDamage(dmg:number){this.health-=dmg;}});
  const shooter={id:"bot",name:"bot",pos:[0,0,10],team:"ffa",weaponId:"rifle_ar"};
  const eff={...weaponById("rifle_ar").stats,damage:50};
  for(let i=0;i<5;i++)e.botFireRay(shooter,[0,1,10],[0,0,-1],eff,1);
  expect(e.riotShieldHp).toBe(0);expect(e.health).toBe(100);
  e.botFireRay(shooter,[0,1,10],[0,0,-1],eff,1);expect(e.health).toBe(50);
 });
 test("the combined weapon keeps the P-9 stats, independent secondary and normal magazine",()=>{
  const w=weaponById(RIOT_SHIELD_ID),p9=weaponById("pistol_side");
  expect(usesWonderCharges(w)).toBe(false);
  expect(w.stats.damage).toBe(p9.stats.damage);expect(w.stats.magSize).toBe(p9.stats.magSize);
  const kit=resolveLoadout({primaryWeapon:w.id,secondaryWeapon:"launcher_rocket",meleeWeapon:"knife_tactical",perkId:"battle_hardened"} as any);
  expect(kit.weapon.id).toBe(w.id);expect(kit.secondary.id).toBe("launcher_rocket");
  const invalid=resolveLoadout({primaryWeapon:"rifle_ar",secondaryWeapon:w.id} as any);expect(invalid.secondary.id).toBe("pistol_side");
 });
});

describe("cluster shell and delayed area damage",()=>{
 test("one shell releases six independently timed ballistic bomblets",()=>{
  const shots=clusterShots([0,1.62,0],[0,0,1],[]);
  expect(shots).toHaveLength(7);
  expect(shots[0].path.points.some(p=>p[1]>1.7)).toBe(true);
  for(const s of shots.slice(1)){
   expect(s.delayMs).toBe(shots[0].path.flightMs);
   expect(s.path.flightMs).toBeGreaterThan(100);
   expect(s.path.points[0][2]).toBeCloseTo(shots[0].path.impact[2]);
  }
  expect(clusterLifetime(shots)).toBeGreaterThan(shots[0].path.flightMs+400);
  expect(clusterDamage(0,shots[1])).toBe(75);
  expect(clusterDamage(shots[1].radius,shots[1])).toBe(0);
 });
 test("wall ricochets keep the main shell and bomblets on the safe side, even at point blank",()=>{
  const wall:CoverBox={pos:[0,2,2],size:[10,2,.1]};
  const shots=clusterShots([0,1.62,0],[0,0,1],[wall]);
  for(const s of shots)for(const p of s.path.points)expect(p[2]).toBeLessThan(1.901);
  const near=clusterShots([0,1.62,1.84],[0,0,1],[wall]);
  expect(near[0].path.impact[2]).toBeLessThan(1.9);
 });
 test("actual offline volley caps stacked blasts and respects cover",()=>{
  const run=(clear:boolean)=>{
   const e:any=Object.create(FPSEngine.prototype),damage:number[]=[];
   const target={id:"enemy",pos:[0,0,0],alive:true,team:"blue"};
   Object.assign(e,{opts:{mode:"tdm"},bulletSpitters:new Map(),clusterVolleys:new Map(),matchEnded:false,combatants:new Map([[target.id,target]]),
    spawnExplosion(){},hasLineOfSight(){return clear;},applyDamageLocal(_t:any,d:number){damage.push(d);}});
   const shot={path:{points:[[0,.2,0],[0,.2,0]],impact:[0,.2,0],flightMs:100},delayMs:0,damage:100,radius:3};
   e.addClusterVolley({id:"volley",ownerId:"self",ownerTeam:"red",launchedAt:Date.now()-150,shots:Array(7).fill(shot)},true);
   e.tickClusterVolleys();return damage.reduce((a,b)=>a+b,0);
  };
  expect(run(true)).toBe(CLUSTER_MAX_DAMAGE);expect(run(false)).toBe(0);
 });
});

describe("bot tactics extend beyond accuracy",()=>{
 test("easy pursues with hipfire; veterans keep sniper distance and ADS",()=>{
  const args=["sniper",40,true,true,true,true,false] as const;
  const easy=botCombatDecision(...args,"easy"),veteran=botCombatDecision(...args,"veteran");
  expect(easy.aiming).toBe(false);expect(easy.strafe).toBe(0);expect(easy.idealDistance).toBe(8);
  expect(veteran.aiming).toBe(true);expect(veteran.idealDistance).toBeGreaterThan(50);
  expect(botDetectionRange("veteran","sniper")).toBeGreaterThan(botDetectionRange("easy","sniper"));
  expect(botPatrolSprint(7,"easy")).toBe(false);expect(botPatrolSprint(7,"hard")).toBe(true);
 });
 test("jump attempts scale with difficulty and respect cooldown and ceilings",()=>{
  expect(botWantsCombatJump("easy","assault",12,true,true,1000,0,0)).toBe(false);
  expect(botWantsCombatJump("veteran","assault",12,true,true,1000,0,.1)).toBe(true);
  expect(botWantsCombatJump("veteran","assault",12,true,true,1000,2000,0)).toBe(false);
  expect(botWantsCombatJump("veteran","sniper",50,true,true,1000,0,0)).toBe(false);
  expect(botHasJumpClearance([],[0,0,0])).toBe(true);
  expect(botHasJumpClearance([{pos:[0,2.4,0],size:[2,.1,2]}],[0,0,0])).toBe(false);
  expect(botHasJumpClearance([],[0,1,0])).toBe(false);
  expect(botTactics("hard").highGround).toBeGreaterThan(botTactics("easy").highGround);
 });
 test("hard bots pause to sweep corners on a bounded schedule",()=>{
  const state:{cornerUntil?:number;nextCornerAt?:number}={};
  botCornerScan("hard",true,1000,state);expect(state.cornerUntil).toBe(1650);
  expect(Math.abs(botCornerScan("hard",true,1160,state))).toBeGreaterThan(.5);
  expect(botCornerScan("hard",true,1900,state)).toBe(0);
  const easy={};expect(botCornerScan("easy",true,1000,easy)).toBe(0);expect(easy).toEqual({});
 });
});

test("ADS has identical shot volume, bass and crack; suppressor alone changes the local report",()=>{
 for(const category of ["assault","pistol","sniper","lmg","shotgun"] as const){
  expect(resolveShotAcoustics(category,{aiming:true})).toEqual(resolveShotAcoustics(category,{aiming:false}));
  expect(resolveShotAcoustics(category,{suppressed:true}).punchLevel).toBeLessThan(resolveShotAcoustics(category).punchLevel);
 }
});
test("Annihilator loads beside the receiver while Reclaimer stays above its arrow rail",()=>{
 expect(reloadMotionFor("sniper_heavy","sniper")).toBe("side_bolt");
 const side=sampleReloadMotion(.48,"side_bolt"),top=sampleReloadMotion(.48,"bolt");
 expect(side.prop[0]).toBeLessThan(-.15);expect(side.prop[1]).toBeLessThan(0);
 expect(top.prop[0]).toBe(0);expect(top.prop[1]).toBeGreaterThan(0);
});

test("authoritative loadout accepts each Wonder as primary and rejects it as secondary",()=>{
 const player={xp:0,weaponUnlocks:[],loadout:null};
 for(const id of ["wonder_cluster",RIOT_SHIELD_ID]){
  const request:any={weaponId:id,secondaryWeaponId:id,attachments:{}};
  const kit=resolveMatchLoadout(player,request);expect(kit.weaponId).toBe(id);expect(kit.secondaryWeaponId).toBe("pistol_side");
 }
});
test("Deadlock tagged bullets hit the shield while flame cones bypass it",()=>{
 const e:any=Object.create(FPSEngine.prototype);
 const victim:any={...carrier,id:"target",pos:[0,0,8],yaw:Math.PI,alive:true,team:"blue",health:100};
 Object.assign(e,{opts:{mode:"tdm",team:"red"},selfId:"self",combatants:new Map([[victim.id,victim]]),
  smartTags:new Map([[victim.id,performance.now()+4500]]),eff:{damage:25,range:30},localBurning:new Map(),
  hasLineOfSight(){return true;},spawnWonderBeam(){},applyDamageLocal(t:any,d:number){t.health-=d;}});
 e.fireNovelWonderOffline(weaponById("wonder_deadlock"),[0,1.1,0],[0,0,1]);
 expect(victim.health).toBe(100);expect(victim.riotShieldHp).toBe(225);
 e.fireNovelWonderOffline(weaponById("wonder_hellfire"),[0,1.1,0],[0,0,1]);
 expect(victim.health).toBe(75);expect(victim.riotShieldHp).toBe(225);
});

test("death does not freeze cluster timers or leave a shield on the death camera",()=>{
 const e:any=Object.create(FPSEngine.prototype);let ticks=0;
 Object.assign(e,{opts:{mode:"ffa",online:false},pos:new THREE.Vector3(),camera:new THREE.PerspectiveCamera(),yaw:0,pitch:0,
  alive:false,matchEnded:false,lobbyActive:false,preMatchCountdown:0,elapsedSeconds:0,timeLeft:0,
  riotShieldModel:new THREE.Group(),riotShieldHp:250,weaponId:RIOT_SHIELD_ID,aiming:false,combatants:new Map(),
  vmParts:[],tracers:[],projectiles:[],respawnAt:performance.now()+5000,lastHudAt:performance.now(),
  tickDeathBombs(){},tickBulletSpitters(){},animateOrbitalReactor(){},tickOrbitalPickup(){},
  tickOfflineMines(){},pulseMineBeacons(){},updateEnvironment(){},tickGravityWells(){},
  tickClusterVolleys(){ticks++;},updateCombatantMeshes(){}});
 e.update(.05);expect(ticks).toBe(1);expect(e.riotShieldModel.visible).toBe(false);
});
