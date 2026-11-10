import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { weaponById, usesWonderCharges } from "../src/lib/game-data";
import { buildFirstPersonWeapon, WEAPON_VISUALS } from "../src/lib/weapon-models";
import { buildMeleeWeaponParts } from "../src/lib/melee-model";
import { wonderHologramModel } from "../src/lib/wonder-models";
import { seismicPulseHit, seismicPushPosition } from "../src/lib/wonder-abilities";

describe("Wonder gear roles and charge economy", () => {
  test("Phasebreaker is a sniper with only two charged rounds", () => {
    const w=weaponById("wonder_phasebreaker");
    expect(w.category).toBe("sniper");
    expect(w.stats.magSize).toBe(2);
    expect(w.wonder?.maxCharges).toBe(2);
    expect(usesWonderCharges(w)).toBe(true);
  });
  test("Whiteout is a deliberate DMR and Seismic Lance is charged melee", () => {
    expect(weaponById("wonder_whiteout").category).toBe("dmr");
    expect(weaponById("wonder_whiteout").stats.auto).toBe(false);
    const lance=weaponById("wonder_seismic");
    expect(lance.category).toBe("melee");
    expect(lance.stats.damage).toBeLessThan(64);
    expect(lance.wonder?.kind).toBe("seismic");
    expect(usesWonderCharges(lance)).toBe(true);
  });
});
describe("Seismic Lance 360-degree slam", () => {
  const center:[number,number,number]=[3,0,4];
  test("targets behind and to the side are hit independently of facing", () => {
    expect(seismicPulseHit(center,[-2,0,4],8)).toBe(true);
    expect(seismicPulseHit(center,[3,0,-3],8)).toBe(true);
    expect(seismicPulseHit(center,[11.2,0,4],8)).toBe(false);
    expect(seismicPulseHit(center,[3,8,4],8)).toBe(false);
  });
  test("knockback pushes directly away from impact, not down the crosshair", () => {
    expect(seismicPushPosition(center,[3,0,-1],4)).toEqual([3,0,-5]);
    expect(seismicPushPosition(center,[5,0,4],4)).toEqual([9,0,4]);
  });
  test("the weapon is an actual pointed long spear, not a shotgun", () => {
    const meshes:THREE.Mesh[]=[];
    const mat=new THREE.MeshBasicMaterial({color:0xffffff});
    const tip=buildMeleeWeaponParts("wonder_seismic",mat,mat,(mesh)=>meshes.push(mesh));
    expect(tip).toBeLessThan(-1);
    expect(meshes.some(m=>m.geometry instanceof THREE.ConeGeometry)).toBe(true);
    meshes.forEach(m=>m.geometry.dispose());mat.dispose();
  });
});
describe("Distinct deployed gear models",()=>{
  test.each(["wonder_juggernaut","wonder_chrono","wonder_phantom"])("%s is a controller, not an LMG",id=>{
    const parts:THREE.Object3D[]=[];
    const mat=new THREE.MeshBasicMaterial({color:0xffffff});
    buildFirstPersonWeapon(id,mat,mat,(o)=>parts.push(o));
    expect(parts.some(o=>o.name==="wonder_controller_display")).toBe(true);
    expect(parts.some(o=>o.name==="weapon_receiver")).toBe(false);
    for(const p of parts)p.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose()});
    mat.dispose();
  });
  test("Ripper exposes the saw and has a bespoke launcher profile",()=>{
    const parts:THREE.Object3D[]=[];
    const mat=new THREE.MeshBasicMaterial({color:0xffffff});
    buildFirstPersonWeapon("wonder_ripper",mat,mat,(o)=>parts.push(o));
    expect(parts.some(p=>p.name==="wonder_ripper_carried_saw")).toBe(true);
    expect(WEAPON_VISUALS.wonder_ripper.magazine).toBe("none");
    parts.forEach(o=>o.traverse(m=>{if(m instanceof THREE.Mesh)m.geometry.dispose()}));mat.dispose();
  });
  test("Phantom is opaque, visibly armed and has a disabled muzzle flash",()=>{
    const model=wonderHologramModel();
    const meshes:THREE.Mesh[]=[];
    model.group.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o)});
    expect(meshes.length).toBeGreaterThan(15);
    const flash=model.group.getObjectByName("phantom_muzzle_flash");
    expect(flash).toBeDefined();
    expect(flash?.visible).toBe(false);
    expect(meshes.filter(m=>m!==flash).every(m=>{
      const mat=m.material as THREE.Material;
      return !mat.transparent || mat.opacity===1;
    })).toBe(true);
    model.dispose();
  });
});
