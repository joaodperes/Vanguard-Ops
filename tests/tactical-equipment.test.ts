import { describe, expect, test } from "bun:test";
import { equipmentById, EQUIPMENT } from "../src/lib/equipment";
import { tacticalGrenadePath, TACTICAL_GRENADE_FUSE_MS } from "../src/lib/tactical-grenades";
import { projectilePositionAt } from "../src/lib/bouncing-projectile";
import { resolveMatchLoadout } from "../src/lib/match-loadout";
import { captureSavedLoadout, parseSavedLoadouts } from "../src/lib/saved-loadouts";
import { FPSEngine } from "../src/lib/fps-engine";
import type { CoverBox, LoadoutWire } from "../src/lib/game-protocol";
describe("tactical equipment loadout",()=>{
 test("the catalog contains six unique, usable items",()=>{
  expect(EQUIPMENT).toHaveLength(6);
  expect(new Set(EQUIPMENT.map(e=>e.id)).size).toBe(EQUIPMENT.length);
  expect(EQUIPMENT.every(e=>e.charges>0&&e.cooldownMs>0)).toBe(true);
  expect(equipmentById("untrusted").id).toBe("frag");
 });
 test("online match rejects an untrusted tactical item",()=>{
  const request={weaponId:"rifle_ar",secondaryWeaponId:"pistol_side",meleeWeaponId:"knife_tactical",
    equipmentId:"taser",weaponSkinId:"default",playerSkinId:"default",
    attachments:{sight:null,barrel:null,grip:null,magazine:null}} as LoadoutWire;
  const player={xp:0,weaponUnlocks:[],wonderUnlocks:[],loadout:{
    secondaryWeapon:"pistol_side",primaryReticle:"classic",secondaryReticle:"classic",
    primaryCharm:"none",secondaryCharm:"none",wonderWeaponId:"",equipmentId:"flashbang"}};
  expect(resolveMatchLoadout(player,request).equipmentId).toBe("flashbang");
  expect(resolveMatchLoadout({...player,loadout:{...player.loadout,equipmentId:"invalid"}},request).equipmentId).toBe("frag");
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
