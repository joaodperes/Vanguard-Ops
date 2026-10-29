import { describe, test, expect } from "bun:test";
import * as THREE from "three";
import { CHARM_SCALE, createWeaponCharm, weaponCharmMountPoint, swingWeaponCharm } from "../src/lib/weapon-charms";
import { WEAPON_VISUALS } from "../src/lib/weapon-models";

describe("weapon charms remain visible on gun models",()=>{
  test("mounted on visible outside of each receiver, not hanging off-screen",()=>{
    for(const id of ["rifle_dm","rifle_ar","pistol_side","smg_vector","lmg_heavy"]){
      const half=WEAPON_VISUALS[id].receiver[0]/2;
      const [x,y,z]=weaponCharmMountPoint(id,"firstPerson");
      expect(x).toBeLessThan(-half);
      expect(y).toBeGreaterThan(0);
      expect(z).toBeLessThan(-.1);
      expect(weaponCharmMountPoint(id,"thirdPerson")[0]).toBeGreaterThan(half);
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
  test("eight new distinct charms all render named 3D geometry",()=>{
    const expected={
      charm_casing:"brass_casing",
      charm_dice:"lucky_die",
      charm_compass:"compass_case",
      charm_drone:"drone_body",
      charm_phoenix:"phoenix_feather",
      charm_prism:"void_crystal",
      charm_solar:"sun_disc",
      charm_satellite:"satellite_body",
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
