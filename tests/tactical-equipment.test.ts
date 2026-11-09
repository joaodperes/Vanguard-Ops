import { describe, expect, test } from "bun:test";
import { equipmentById, equipmentAvailable, equipmentUnlocked, EQUIPMENT } from "../src/lib/equipment";
import { tacticalGrenadePath, TACTICAL_GRENADE_FUSE_MS } from "../src/lib/tactical-grenades";
import { projectilePositionAt } from "../src/lib/bouncing-projectile";
import { resolveMatchLoadout } from "../src/lib/match-loadout";
import { captureSavedLoadout, parseSavedLoadouts } from "../src/lib/saved-loadouts";
import { FPSEngine } from "../src/lib/fps-engine";
import type { CoverBox, LoadoutWire } from "../src/lib/game-protocol";
describe("tactical equipment loadout",()=>{
 test("the shared catalog contains unique, usable tactical items",()=>{
  expect(EQUIPMENT.length).toBeGreaterThan(0);
  expect(new Set(EQUIPMENT.map(e=>e.id)).size).toBe(EQUIPMENT.length);
  expect(EQUIPMENT.every(e=>e.charges>0&&e.cooldownMs>0)).toBe(true);
  expect(equipmentById("untrusted").id).toBe("frag");
  expect(EQUIPMENT.every(e => e.unlockLevel>=1)).toBe(true);
  expect(equipmentById("cover").type).toBe("cover");
  expect(equipmentById("cover").unlockLevel).toBe(18);
  expect(equipmentById("taser").charges).toBe(3);
  expect(equipmentById("knives").charges).toBe(1);
  // All match, firing-range and bot refills should read the shared catalog.
  expect(EQUIPMENT.filter(e => e.charges===3).map(e=>e.id).sort()).toEqual(["poison_dart","taser"]);
 });
 test("online match rejects an untrusted tactical item",()=>{
  const request={weaponId:"rifle_ar",secondaryWeaponId:"pistol_side",meleeWeaponId:"knife_tactical",
    equipmentId:"taser",weaponSkinId:"default",playerSkinId:"default",
    attachments:{sight:null,barrel:null,grip:null,magazine:null}} as LoadoutWire;
  const player={xp:100000000000,weaponUnlocks:[],wonderUnlocks:[],loadout:{
    secondaryWeapon:"pistol_side",primaryReticle:"classic",secondaryReticle:"classic",
    primaryCharm:"none",secondaryCharm:"none",wonderWeaponId:"",equipmentId:"flashbang"}};
  expect(resolveMatchLoadout(player,request).equipmentId).toBe("flashbang");
  expect(resolveMatchLoadout({...player,loadout:{...player.loadout,equipmentId:"invalid"}},request).equipmentId).toBe("frag");
 });
 test("tactical progression has no credit cost, rejects invalid or early choices",()=>{
  for (const item of EQUIPMENT) {
    expect(equipmentUnlocked(item.id, item.unlockLevel)).toBe(true);
    expect(equipmentUnlocked(item.id, item.unlockLevel-1)).toBe(item.id==="frag" && item.unlockLevel-1>=1);
    expect(equipmentAvailable(item.id,item.unlockLevel-1)).toBe("frag");
  }
  expect(equipmentUnlocked("bogus",999)).toBe(false);
  expect(equipmentAvailable("bogus",999)).toBe("frag");
 });
 test("match downgrades a previously saved level-locked selection",()=>{
   const request={weaponId:"rifle_ar",weaponSkinId:"default",playerSkinId:"default",
     attachments:{sight:null,barrel:null,grip:null,magazine:null}} as LoadoutWire;
   const player={xp:0,weaponUnlocks:[],loadout:{secondaryWeapon:"pistol_side",primaryReticle:"classic",
     secondaryReticle:"classic",primaryCharm:"none",secondaryCharm:"none",wonderWeaponId:"",equipmentId:"poison_dart"}};
   expect(resolveMatchLoadout(player,request).equipmentId).toBe("frag");
 });
 test("named presets preserve equipment, old presets default to frag",()=>{
  const active={primaryWeapon:"rifle_ar",secondaryWeapon:"pistol_side",meleeWeapon:"knife_tactical",equipmentId:"mine",
    weaponSkin:"default",secondaryWeaponSkin:"default",meleeWeaponSkin:"default",playerSkin:"default",
    attachments:"{}",secondaryAttachments:"{}",meleeAttachments:"{}"};
  const saved=captureSavedLoadout(active,"slot-a","My Kit","battle_hardened");
  expect(parseSavedLoadouts(JSON.stringify([saved]))[0].equipmentId).toBe("mine");
  expect(parseSavedLoadouts(JSON.stringify([{...saved,equipmentId:undefined}]))[0].equipmentId).toBe("frag");
 });
});
describe("tactical grenade physics and input",()=>{
 const wall:CoverBox={pos:[0,2,2],size:[10,2,.1]};
 test("grenades ricochet and detonate on fuse, not on initial contact",()=>{
  const path=tacticalGrenadePath([0,1.6,0],[0,0,1],[wall]);
  expect(path.bounces!.some(b=>b.normal[2]===-1)).toBe(true);
  expect(path.flightMs).toBe(TACTICAL_GRENADE_FUSE_MS);
  expect(path.timesMs).toHaveLength(path.points.length);
  expect(path.impact[2]).toBeLessThan(1.8);
  expect(projectilePositionAt(path,path.flightMs)).toEqual(path.impact);
 });
 test("map gravity changes the trajectory but not the fuse",()=>{
  const regular=tacticalGrenadePath([0,1.6,0],[0,.15,1],[],"compound");
  const orbital=tacticalGrenadePath([0,1.6,0],[0,.15,1],[],"orbital_nexus");
  expect(projectilePositionAt(orbital,300)[1]).toBeGreaterThan(projectilePositionAt(regular,300)[1]);
  expect(regular.flightMs).toBe(orbital.flightMs);
 });
 test("animation commits exactly once after release",()=>{
  const e:any=Object.create(FPSEngine.prototype);
  Object.assign(e,{opts:{mode:"ffa",online:false,loadout:{equipmentId:"frag"}},
    inputSuspended:false,disposed:false,alive:true,survivalDowned:false,matchEnded:false,
    lobbyActive:false,preMatchCountdown:0,equipmentAction:null,reloading:false,
    equipmentStunUntil:0,pointerLocked:true,touchMode:false,equipmentCharges:2,equipmentLastAt:-10000,
    manualAiming:true,aiming:true,unlockAudio(){},commitEquipmentUse(id:string){this.calls.push(id);},calls:[]});
  e.useEquipment();
  expect(e.equipmentAction?.id).toBe("frag");
  expect(e.aiming).toBe(false);
  const start=e.equipmentAction.startedAt,duration=e.equipmentAction.duration;
  e.updateEquipmentAction(start+duration*.25);
  expect(e.calls).toHaveLength(0);
  e.updateEquipmentAction(start+duration*.75);
  e.updateEquipmentAction(start+duration*.9);
  expect(e.calls).toEqual(["frag"]);
 });
});
