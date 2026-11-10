import { describe, test, expect } from "bun:test";
import * as THREE from "three";
import { CHARM_SCALE, createWeaponCharm, weaponCharmMountPoint, swingWeaponCharm } from "../src/lib/weapon-charms";
import { WEAPON_VISUALS, firstPersonSupportGrip } from "../src/lib/weapon-models";

describe("weapon charms remain visible on gun models",()=>{
  test("first-person mounts clear each weapon's support hand, without moving bot charms",()=>{
    for(const [id,profile] of Object.entries(WEAPON_VISUALS)){
      const half=profile.receiver[0]/2;
      const [x,y,z]=weaponCharmMountPoint(id,"firstPerson");
      const hand=firstPersonSupportGrip(id);
      const pendantCenter:[number,number,number]=[x,y-.13,z];
      const clearance=Math.hypot(...pendantCenter.map((v,i)=>v-hand[i]));
      expect(x).toBeLessThan(-half);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(.065);
      expect(z).toBeGreaterThanOrEqual(-.12-profile.receiver[2]/2);
      expect(z).toBeLessThanOrEqual(-.12+profile.receiver[2]/2);
      expect(clearance).toBeGreaterThanOrEqual(.19-1e-8);
      // Third-person operator/bot pins must not move with viewmodel calibration.
      expect(weaponCharmMountPoint(id,"thirdPerson")).toEqual([
        Math.max(.09,half+.025),.025,-.22,
      ]);
    }
  });
  test("Skull Token is lit, sizeable, and has visible skull features",()=>{
    const first=createWeaponCharm("charm_skull",true)!;
    const world=createWeaponCharm("charm_skull")!;
    expect(first.name).toBe("weapon_charm");
    expect(first.scale.x).toBe(CHARM_SCALE.firstPerson);
    expect(world.scale.x).toBe(CHARM_SCALE.thirdPerson);
    expect(first.scale.x).toBeLessThan(1.22);
    expect(world.scale.x).toBeLessThan(1);
    const pendant=first.getObjectByName("weapon_charm_pendant")!;
    expect(pendant.children.length).toBeGreaterThan(5);
    expect(first.children.some(o=>o instanceof THREE.Mesh)).toBe(true);
    const materials:THREE.Material[]=[];
    first.traverse(o=>{if(o instanceof THREE.Mesh){materials.push(o.material as THREE.Material);expect(o.frustumCulled).toBe(false);}});
    expect(materials.some(m=>m instanceof THREE.MeshBasicMaterial)).toBe(true);
    const worldMaterials:THREE.Material[]=[];
    world.traverse(o=>{if(o instanceof THREE.Mesh)worldMaterials.push(o.material as THREE.Material);});
    expect(worldMaterials.some(m=>m instanceof THREE.MeshStandardMaterial)).toBe(true);
    const initial=pendant.rotation.z;
    swingWeaponCharm(first,900);
    expect(pendant.rotation.z).not.toBe(initial);
  });
  test("all new distinct charms render named 3D geometry",()=>{
    const expected={
      charm_casing:"brass_casing",
      charm_dice:"lucky_die",
      charm_compass:"compass_case",
      charm_drone:"drone_body",
      charm_phoenix:"phoenix_feather",
      charm_prism:"void_crystal",
      charm_solar:"sun_disc",
      charm_satellite:"satellite_body",
      charm_bolt:"lightning_token",
      charm_anchor:"anchor_shaft",
      charm_rocket:"rocket_body",
      charm_moon:"moon_crescent",
    } as const;
    for(const [id,part] of Object.entries(expected)){
      for(const firstPerson of [false,true]){
        const model=createWeaponCharm(id,firstPerson);
        expect(model).not.toBeNull();
        expect(model!.userData.cosmeticId).toBe(id);
        expect(model!.getObjectByName(part)).toBeDefined();
        expect(model!.getObjectByName("weapon_charm_pendant")).toBeDefined();
        const meshes:THREE.Mesh[]=[];
        model!.traverse(obj=>{if(obj instanceof THREE.Mesh)meshes.push(obj);});
        expect(meshes.length).toBeGreaterThan(3);
        expect(meshes.every(m=>!m.frustumCulled)).toBe(true);
        expect(model!.scale.x).toBe(firstPerson?CHARM_SCALE.firstPerson:CHARM_SCALE.thirdPerson);
      }
    }
  });
  test("unknown or empty charms render no object",()=>{
    expect(createWeaponCharm("none")).toBeNull();
    expect(createWeaponCharm("unknown_id")).toBeNull();
  });
});
