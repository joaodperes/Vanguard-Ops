import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { buildFirstPersonWeapon, buildBastionIronSights } from "../src/lib/weapon-models";
import {
  BASTION_CYLINDER_CENTER, BASTION_CYLINDER_OPEN_X,
  BASTION_CARTRIDGE_SEATED_Z, BASTION_CARTRIDGE_TRAVEL_Z,
  bastionReloadFrame, bastionLoaderContact,
  BASTION_TOPSTRAP, BASTION_REAR_SIGHT, BASTION_FRONT_SIGHT_Y,
} from "../src/lib/bastion-revolver-rig";
import { sampleReloadMotion } from "../src/lib/first-person-animation";
import { placeFirstPersonActionTarget } from "../src/lib/first-person-action-target";

function model(id="pistol_bastion") {
  const material=new THREE.MeshBasicMaterial({color:0x647487});
  const parts:THREE.Object3D[]=[];
  buildFirstPersonWeapon(id,material,material,(piece,x,y,z)=>{
    piece.position.set(x,y,z);
    parts.push(piece);
  });
  return {parts,cylinder:parts.find(x=>x.userData.fpRevolverCylinder===true) as THREE.Group,material};
}
const axis=(q:THREE.Quaternion)=>new THREE.Vector3(0,1,0).applyQuaternion(q).normalize();

describe("Bastion viewmodel: geometry and reload continuity",()=>{
  test("open, curved frame exposes a large cylinder instead of a pistol slide",()=>{
    const {parts,cylinder,material}=model();
    const top=parts.find(x=>x.name==="bastion_topstrap") as THREE.Mesh;
    const grip=parts.find(x=>x.name==="bastion_rounded_grip") as THREE.Mesh;
    const shroud=parts.find(x=>x.name==="bastion_round_barrel_shroud") as THREE.Mesh;
    expect(top).toBeDefined();
    expect(grip.geometry).toBeInstanceOf(THREE.CapsuleGeometry);
    expect(shroud.geometry).toBeInstanceOf(THREE.CylinderGeometry);
    expect(parts.filter(x=>x.name==="bastion_curved_frame_rail")).toHaveLength(2);
    expect(parts.some(x=>x instanceof THREE.Mesh &&
      x.geometry instanceof THREE.ExtrudeGeometry)).toBe(false);
    expect(top.position.z).toBe(BASTION_TOPSTRAP.z);
    expect(top.position.y).toBe(BASTION_TOPSTRAP.y);
    const face=cylinder.children.find(x=>x.name==="revolver_cylinder_front_web") as THREE.Mesh;
    expect((face.geometry as THREE.CylinderGeometry).parameters.radiusTop).toBeGreaterThan(.075);
    material.dispose();
  });

  test("solid rear frame seals both gaps behind the cylinder and joins the grip",()=>{
    const {parts,cylinder,material}=model();
    const named=(name:string)=>parts.find(x=>x.name===name) as THREE.Mesh;
    const recoil=named("bastion_recoil_shield");
    const backstrap=named("bastion_solid_backstrap");
    const bridge=named("bastion_lower_frame_bridge");
    const left=named("bastion_left_frame_cheek");
    const right=named("bastion_right_frame_cheek");
    expect([recoil,backstrap,bridge,left,right].every(Boolean)).toBe(true);
    expect(recoil.geometry).toBeInstanceOf(THREE.CylinderGeometry);
    expect((recoil.geometry as THREE.CylinderGeometry).parameters.openEnded).toBe(false);
    expect(backstrap.geometry).toBeInstanceOf(THREE.CapsuleGeometry);
    expect(left.geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
    expect(right.geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
    // The cylinder rear is z=-.099. Its protective solid breech must
    // almost touch it, without being parented to the moving cylinder.
    recoil.geometry.computeBoundingBox();
    const rearBreechFace = recoil.position.z-
      (recoil.geometry.boundingBox!.max.y-recoil.geometry.boundingBox!.min.y)/2;
    const rearCylinderFace = cylinder.position.z +
      BASTION_CYLINDER_HALF_LENGTH;
    expect(Math.abs(rearCylinderFace-rearBreechFace)).toBeLessThan(.012);
    // All these cast pieces are stationary vm parts, never children of the
    // swinging drum: the gun cannot develop a new hole during reload.
    for(const p of [recoil,backstrap,bridge,left,right])
      expect(cylinder.getObjectByName(p.name)).toBeUndefined();
    // Side-view rays must encounter SOLID steel around the rear of the
    // cylinder and the grip transition; thin open arc outlines failed this.
    const ray=new THREE.Raycaster();
    const checks:[number,number][]=[
      [-.028,-.067],[-.075,-.050],[-.125,-.025],[-.163,.018],
    ];
    for(const side of [-1,1]){
      for(const [y,z] of checks){
        ray.set(new THREE.Vector3(side*.32,y,z),new THREE.Vector3(-side,0,0));
        ray.far=.40;
        const intersections=ray.intersectObjects([recoil,backstrap,bridge,left,right],false);
        expect(intersections.length,
          "open back gap at side "+side+" y="+y+" z="+z).toBeGreaterThan(0);
      }
    }
    material.dispose();
  });

  test("rear U-notch rests ON the frame and front blade on barrel pedestal",()=>{
    const {parts,material}=model();
    const top=parts.find(x=>x.name==="bastion_topstrap") as THREE.Mesh;
    top.geometry.computeBoundingBox();
    const b=top.geometry.boundingBox!;
    const halfTopWidth=(b.max.x-b.min.x)/2;
    const halfTopLength=(b.max.z-b.min.z)/2;
    expect(BASTION_REAR_SIGHT.z).toBeGreaterThan(top.position.z-halfTopLength);
    expect(BASTION_REAR_SIGHT.z).toBeLessThan(top.position.z+halfTopLength);
    expect(BASTION_REAR_SIGHT.x).toBeGreaterThanOrEqual(top.position.x-halfTopWidth);
    expect(BASTION_REAR_SIGHT.x).toBeLessThanOrEqual(top.position.x+halfTopWidth);
    const {rear,front}=buildBastionIronSights(material);
    const bridge=rear.children[2] as THREE.Mesh;
    bridge.geometry.computeBoundingBox();
    const bridgeBottom=BASTION_REAR_SIGHT.y+bridge.position.y+
      bridge.geometry.boundingBox!.min.y;
    const frameTop=top.position.y+b.max.y;
    expect(bridgeBottom).toBeLessThanOrEqual(frameTop);
    expect(bridgeBottom).toBeGreaterThan(top.position.y+b.min.y);
    const bladeBottom=BASTION_FRONT_SIGHT_Y-
      (front.geometry as THREE.BoxGeometry).parameters.height/2;
    expect(bladeBottom).toBeLessThan(.056);
    expect(bladeBottom).toBeGreaterThan(.04);
    material.dispose();
  });
  test("cylinder bores point along the barrel, never sideways or diagonally",()=>{
    const {cylinder,material}=model();
    expect(cylinder).toBeDefined();
    expect(cylinder.position.toArray()).toEqual([...BASTION_CYLINDER_CENTER]);
    const sleeves=cylinder.children.filter(x=>x.name.startsWith("revolver_chamber_sleeve_")) as THREE.Mesh[];
    expect(sleeves).toHaveLength(6);
    expect(sleeves.every(x=>x.geometry instanceof THREE.CylinderGeometry &&
      (x.geometry as THREE.CylinderGeometry).parameters.openEnded===true)).toBe(true);
    const drum=cylinder.children.find(x=>x.name==="revolver_cylinder_body") as THREE.Mesh;
    expect(drum).toBeDefined();
    // CylinderGeometry is Y-axis by default. Its final axis must be Z.
    expect(Math.abs(axis(drum.quaternion).z)).toBeCloseTo(1,8);
    expect(Math.abs(axis(drum.quaternion).x)).toBeLessThan(1e-6);
    for(let i=0;i<6;i++) {
      const bullet=cylinder.children.find(x=>x.userData.fpRevolverCartridgeIndex===i)!;
      expect(bullet.position.z).toBe(BASTION_CARTRIDGE_SEATED_Z);
      expect(bullet.children.length).toBeGreaterThanOrEqual(2);
    }
    material.dispose();
  });

  test("swing-out motion is pure lateral travel in gun-local space",()=>{
    expect(bastionReloadFrame(0).open).toBe(0);
    expect(bastionReloadFrame(.50).open).toBeCloseTo(1,7);
    expect(bastionReloadFrame(1).open).toBe(0);
    for(const progress of [.15,.32,.45,.58,.75,.90]) {
      const frame=bastionReloadFrame(progress);
      const local=new THREE.Vector3(
        BASTION_CYLINDER_CENTER[0]+BASTION_CYLINDER_OPEN_X*frame.open,
        BASTION_CYLINDER_CENTER[1],BASTION_CYLINDER_CENTER[2]);
      // In any weapon reload pitch/roll, local barrel and cylinder axes
      // receive the SAME rigid quaternion; there is no cylinder-only yaw.
      const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(.22*frame.open,0,-.40*frame.open));
      const barrelAxis=new THREE.Vector3(0,0,1).applyQuaternion(q);
      const cylinderAxis=axis(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,0,0)));
      const worldCylinderAxis=cylinderAxis.clone().applyQuaternion(q);
      expect(worldCylinderAxis.dot(barrelAxis)).toBeCloseTo(1,7);
      expect(local.y).toBe(BASTION_CYLINDER_CENTER[1]);
      expect(local.z).toBe(BASTION_CYLINDER_CENTER[2]);
    }
  });

  test("rounds travel along each chamber bore and remain seated as loader withdraws",()=>{
    const outside=bastionReloadFrame(.46);
    const entering=bastionReloadFrame(.58);
    const seated=bastionReloadFrame(.70);
    const withdrawn=bastionReloadFrame(.81);
    expect(outside.cartridgesVisible).toBe(true);
    expect(outside.insertion).toBe(0);
    expect(entering.insertion).toBeGreaterThan(0);
    expect(entering.insertion).toBeLessThan(1);
    expect(seated.insertion).toBe(1);
    expect(withdrawn.insertion).toBe(1);
    expect(withdrawn.loaderVisible).toBe(false);
    for(const p of [.46,.58,.70,.81]) {
      const f=bastionReloadFrame(p);
      const cartridgeZ=BASTION_CARTRIDGE_SEATED_Z+
        BASTION_CARTRIDGE_TRAVEL_Z*(1-f.insertion);
      expect(cartridgeZ).toBeGreaterThanOrEqual(BASTION_CARTRIDGE_SEATED_Z);
      if(p>.70) expect(cartridgeZ).toBeCloseTo(BASTION_CARTRIDGE_SEATED_Z);
    }
    // A loader that only disappears at the end must have its collar meet
    // the six chamber mouths, not hover at an unrelated hand coordinate.
    const contact=bastionLoaderContact(.68,1.2);
    const expectedX=(BASTION_CYLINDER_CENTER[0]+BASTION_CYLINDER_OPEN_X)*1.2;
    expect(contact[0]).toBeCloseTo(expectedX,5);
    const pose=sampleReloadMotion(.68,"cylinder_speedloader");
    expect(pose.prop).toEqual(contact);
    expect(pose.propVisible).toBe(true);
    const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(.20,0,-.32));
    const position=placeFirstPersonActionTarget(new THREE.Vector3(),pose.prop,q,.3,-.20,-.48);
    // A forward tilt should still transform the collar with the weapon, not
    // a separate screen-space coordinate.
    const transformed=contact.length===3?new THREE.Vector3(...contact):new THREE.Vector3();
    transformed.sub(new THREE.Vector3(0,-.11,.12)).applyQuaternion(q).add(new THREE.Vector3(.3,-.31,-.36));
    expect(position.distanceTo(transformed)).toBeLessThan(1e-8);
  });

  test("Bastion iron sights have a genuinely open rear U, not a solid centre plate",()=>{
    const material=new THREE.MeshBasicMaterial({color:0x29333c});
    const {rear,front}=buildBastionIronSights(material);
    expect(rear.name).toBe("bastion_rear_u_notch");
    expect(front.name).toBe("bastion_front_blade");
    const ray=new THREE.Raycaster(new THREE.Vector3(0,.005,.25),new THREE.Vector3(0,0,-1),0,.5);
    rear.updateMatrixWorld(true);
    expect(ray.intersectObject(rear,true)).toHaveLength(0);
    ray.ray.origin.x=.037;
    expect(ray.intersectObject(rear,true).length).toBeGreaterThan(0);
    expect((front.geometry as THREE.BoxGeometry).parameters.width).toBeLessThan(.012);
    material.dispose();
  });
});
