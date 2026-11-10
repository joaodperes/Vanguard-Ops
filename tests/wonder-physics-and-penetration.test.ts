import {describe,expect,test} from "bun:test";
import * as THREE from "three";
import {weaponById} from "../src/lib/game-data";
import {PHASEBREAKER_MAX_SURFACES,resolveMaterialPenetrationShot,traceCoverPenetration} from "../src/lib/cover-penetration";
import {ripperSegments,phantomSpawnPosition,phantomTravelPosition} from "../src/lib/wonder-abilities";
import {fullWonderCharges,refundWonderCharge,spendWonderCharge} from "../src/lib/wonder-charge";
import {wonderMechModel,wonderHologramModel} from "../src/lib/wonder-models";
import {buildFirstPersonWeapon} from "../src/lib/weapon-models";
import type {CoverBox,Vec3} from "../src/lib/game-protocol";

const origin:Vec3=[0,1.2,0],direction:Vec3=[0,0,1];
const wall=(z:number,material:CoverBox["material"]="concrete",depth=.6):CoverBox=>({
  pos:[0,1.2,z],size:[4,1.2,depth/2],kind:"solid",material
});

describe("Phasebreaker deep penetration and headshot recharge",()=>{
  const w=weaponById("wonder_phasebreaker");
  test("charged rail crosses ordinary structural concrete with damage attenuation",()=>{
    const cover=[wall(5,"concrete",1.2)];
    expect(traceCoverPenetration(cover,origin,direction,50,w.stats.coverPenetration).blockedAt).toBeLessThan(Infinity);
    const trace=traceCoverPenetration(cover,origin,direction,50,w.stats.coverPenetration,true);
    expect(trace.blockedAt).toBe(Infinity);
    expect(trace.crossings[0].material).toBe("concrete");
    const resolved=resolveMaterialPenetrationShot([{target:"dummy",t:9,head:true}],cover,
      origin,direction,50,w.stats.bodyPenetration,w.stats.coverPenetration,true);
    expect(resolved.hits.map(h=>h.target)).toEqual(["dummy"]);
    expect(resolved.hits[0].damageScale).toBeGreaterThan(0);
    expect(resolved.hits[0].damageScale).toBeLessThan(1);
  });
  test("reinforced, environment barriers and excessively thick concrete remain protective",()=>{
    for(const box of [wall(5,"reinforced"),{...wall(5),environmentId:"sealed_door"},wall(5,"concrete",10)]){
      expect(traceCoverPenetration([box],origin,direction,50,w.stats.coverPenetration,true).blockedAt).toBeLessThan(Infinity);
    }
  });
  test("multiple concrete crossings spend energy and respect the Phasebreaker layer cap",()=>{
    const boxes=Array.from({length:PHASEBREAKER_MAX_SURFACES+1},(_,n)=>wall(4+n*2,"concrete",.3));
    const trace=traceCoverPenetration(boxes,origin,direction,40,w.stats.coverPenetration,true);
    expect(trace.crossings.length).toBe(PHASEBREAKER_MAX_SURFACES);
    expect(trace.blockedAt).toBeLessThan(Infinity);
  });
  test("headshot refunds at most the spent charge and preserves remaining cooldown",()=>{
    const rules=w.wonder!;
    const full=fullWonderCharges(rules);
    const spent=spendWonderCharge(full,rules,1000)!;
    expect(spent.charges).toBe(rules.maxCharges-1);
    const returned=refundWonderCharge(spent,rules,1200);
    expect(returned.charges).toBe(rules.maxCharges);
    expect(returned.nextAt).toBe(0);
    expect(refundWonderCharge(returned,rules,1300).charges).toBe(rules.maxCharges);
    const twice=spendWonderCharge(spent,rules,1300)!;
    const partial=refundWonderCharge(twice,rules,1400);
    expect(partial.charges).toBe(1);
    expect(partial.nextAt).toBe(spent.nextAt);
  });
});

describe("Wonder visual fidelity and Ripper gameplay",()=>{
  test("Phantom starts ahead and advances independently of owner movement",()=>{
    const spawn=phantomSpawnPosition([0,0,0],0);
    expect(spawn).toEqual([0,0,1.8]);
    expect(phantomTravelPosition(spawn,0,2000)[2]).toBeCloseTo(4.7);
    expect(phantomSpawnPosition([0,0,0],Math.PI/2)[0]).toBeCloseTo(1.8);
  });
  test("ricochets add range rather than dividing one short flight budget",()=>{
    const segments=ripperSegments(origin,direction,[wall(10,"concrete",1)],55,4);
    expect(segments.length).toBeGreaterThanOrEqual(2);
    const length=segments.reduce((n,segment)=>n+Math.hypot(
      segment.to[0]-segment.from[0],
      segment.to[1]-segment.from[1],
      segment.to[2]-segment.from[2]),0);
    expect(length).toBeGreaterThan(55);
  });
  test("cockpit/world minigun has a longitudinal rotating barrel assembly",()=>{
    const mech=wonderMechModel();
    const rotor=mech.group.getObjectByName("juggernaut_world_rotor");
    expect(rotor).toBeDefined();
    expect(rotor?.children.length).toBe(6);
    mech.dispose();
  });
  test("Phantom shoulders its rifle at muzzle flash height",()=>{
    const decoy=wonderHologramModel();
    const flash=decoy.group.getObjectByName("phantom_muzzle_flash");
    expect(flash?.position.y).toBeCloseTo(1.42,2);
    const forearms=decoy.group.children.filter(o=>o instanceof THREE.Mesh && o.geometry instanceof THREE.CylinderGeometry);
    expect(forearms.length).toBeGreaterThanOrEqual(4);
    decoy.dispose();
  });
  test("Ripper blade is horizontal and parallel to its launcher body",()=>{
    const parts:THREE.Object3D[]=[];
    const mat=new THREE.MeshBasicMaterial({color:0xffffff});
    buildFirstPersonWeapon("wonder_ripper",mat,mat,o=>parts.push(o));
    const blade=parts.find(o=>o.name==="wonder_ripper_carried_saw");
    expect(blade).toBeDefined();
    expect(blade?.children[0].rotation.x).toBeCloseTo(0,4);
    for(const part of parts)part.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose()});
    mat.dispose();
  });
});
