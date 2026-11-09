import {describe,test,expect} from "bun:test";
import * as THREE from "three";
import catalog from "../src/data/catalogs/weapons.json";
import {firstPersonSupportGrip,firstPersonShellContacts,WEAPON_VISUALS,weaponHoldPoints} from "../src/lib/weapon-models";
import {
  calibratedSupportArm,animatedSupportArm,supportElbowPosition,
  sampleReloadMotion,reloadMotionFor,supportActionWeight,
} from "../src/lib/first-person-animation";
import {placeFirstPersonActionTarget} from "../src/lib/first-person-action-target";
import {ROUND_INSERT_FRACTION} from "../src/lib/incremental-reload";

const dist=(a:readonly number[],b:readonly number[])=>
  Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const nominal=(id:string,touch=false):[number,number,number]=>{
  const p=firstPersonSupportGrip(id);
  return [p[0]*1.2+(touch?.22:.30)-.045,
    p[1]*1.2+(touch?-.20:-.18)-.125,
    p[2]*1.2+(touch?-.50:-.48)+.10];
};
const cuff=new THREE.Vector3(-.045,-.125,.10);
const pivot=new THREE.Vector3(0,-.11,.12);
const offset=new THREE.Vector3(.30,-.18,-.48);

describe("arsenal-wide support-arm rig",()=>{
  test("every modeled firearm keeps its elbow behind the support glove without overextending",()=>{
    let count=0;
    for(const weapon of catalog){
      if(!WEAPON_VISUALS[weapon.id]||weapon.category==="melee")continue;
      count++;
      for(const touch of [false,true]){
        const wrist=nominal(weapon.id,touch);
        for(const aspect of [16/9,4/3,1,9/16]){
          const frame=calibratedSupportArm(weapon.category,wrist,aspect,false);
          const elbow=supportElbowPosition(frame.shoulder,wrist,frame.pole,
            frame.upperLength,frame.forearmLength);
          const reach=dist(frame.shoulder,wrist);
          const stretch=Math.max(1,reach/((frame.upperLength+frame.forearmLength)*.998));
          expect(stretch).toBeLessThan(1.12);
          expect(dist(frame.shoulder,elbow)).toBeCloseTo(frame.upperLength*stretch,6);
          expect(dist(elbow,wrist)).toBeCloseTo(frame.forearmLength*stretch,6);
          expect(frame.shoulder[2]-elbow[2]).toBeGreaterThan(.09);
          expect(elbow[2]-wrist[2]).toBeGreaterThan(.14);
          expect(elbow[0]).toBeLessThan(wrist[0]-.03);
          expect(elbow.every(Number.isFinite)).toBe(true);
        }
      }
    }
    expect(count).toBeGreaterThan(35);
  });
  test("assault/DMR/LMG and sniper reach uses the same physically positioned bones",()=>{
    for(const [id,category] of [
      ["rifle_ar","assault"],["rifle_heavy","assault"],["rifle_dm","dmr"],
      ["dmr_scout","dmr"],["dmr_whisper","dmr"],["dmr_heavy","dmr"],
      ["lmg_light","lmg"],["lmg_hv","lmg"],["lmg_heavy","lmg"],
      ["sniper_heavy","sniper"],["sniper_scout","sniper"],
    ]){
      const wrist=nominal(id),frame=calibratedSupportArm(category,wrist,16/9);
      const elbow=supportElbowPosition(frame.shoulder,wrist,frame.pole,
        frame.upperLength,frame.forearmLength);
      expect(frame.forearmLength).toBe(.50);
      expect(elbow[2]-wrist[2]).toBeGreaterThan(.19);
      expect(dist(frame.shoulder,elbow)).toBeCloseTo(.42,5);
    }
  });
  test("updated receiver grips preserve untouched third-person holds",()=>{
    for(const id of ["rifle_heavy","dmr_heavy","dmr_whisper","lmg_heavy","sniper_heavy","sniper_lr"]){
      const old=weaponHoldPoints(id).support,newGrip=firstPersonSupportGrip(id);
      const len=WEAPON_VISUALS[id].receiver[2];
      expect(newGrip[2]).toBeGreaterThan(old[2]);
      expect(newGrip[2]).toBeLessThanOrEqual(-.12-len*.25);
      expect(newGrip[2]).toBeGreaterThanOrEqual(-.12-len/2);
    }
  });
});

describe("complete offhand/shoulder/elbow reload motion for every weapon class",()=>{
  const cases=[
    ["rifle_ar","assault","magazine"],
    ["rifle_heavy","assault","magazine"],
    ["dmr_scout","dmr","magazine"],["dmr_heavy","dmr","magazine"],
    ["lmg_light","lmg","magazine"],["lmg_heavy","lmg","magazine"],
    ["sniper_lr","sniper","magazine"],["sniper_heavy","sniper","side_bolt"],
    ["shotgun_br","shotgun","shell"],["shotgun_auto","shotgun","shell"],
    ["shotgun_combat","shotgun","shell"],["pistol_magnum","pistol","cylinder"],
    ["pistol_bastion","pistol","cylinder_speedloader"],
    ["crossbow_reclaimer","dmr","bolt"],["rifle_electron","assault","vent"],
  ] as const;
  for(const [id,category,style] of cases){
    test(id+" "+style+" animates all joints over its full reload",()=>{
      const grip=firstPersonSupportGrip(id),frame=calibratedSupportArm(category,nominal(id),16/9);
      const shell=firstPersonShellContacts(id);
      const gripPosition=new THREE.Vector3(...grip).multiplyScalar(1.2);
      let previous:ReturnType<typeof animatedSupportArm>|null=null;
      let jump=0, shoulderTravel=0, elbowTravel=0;
      let first:ReturnType<typeof animatedSupportArm>|null=null;
      for(let step=0;step<=100;step++){
        const p=step/100, pose=sampleReloadMotion(p,style,style==="shell"?shell:undefined);
        const rot=new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.pitch,0,pose.roll,"XYZ"));
        const restHand=gripPosition.clone().sub(pivot).applyQuaternion(rot).add(pivot).add(offset);
        restHand.y+=pose.dip;
        const restCuff=restHand.clone().add(cuff.clone().applyQuaternion(rot));
        const action=placeFirstPersonActionTarget(new THREE.Vector3(),pose.hand,rot,
          offset.x,offset.y+pose.dip,offset.z);
        const handQuat=rot.clone().multiply(new THREE.Quaternion()
          .setFromEuler(new THREE.Euler(pose.handRoll*.25,0,pose.handRoll)));
        const blend=supportActionWeight(p);
        action.lerp(restHand,1-blend);
        handQuat.slerp(rot,1-blend);
        const wrist=action.add(cuff.clone().applyQuaternion(handQuat));
        const joints=animatedSupportArm(frame,restCuff.toArray() as [number,number,number],
          wrist.toArray() as [number,number,number],blend,frame.upperLength,frame.forearmLength);
        const stretch=Math.max(1,dist(joints.shoulder,wrist.toArray())/
          ((frame.upperLength+frame.forearmLength)*.998));
        expect(dist(joints.shoulder,joints.elbow)).toBeCloseTo(frame.upperLength*stretch,5);
        expect(dist(joints.elbow,wrist.toArray())).toBeCloseTo(frame.forearmLength*stretch,5);
        expect(joints.elbow.every(Number.isFinite)).toBe(true);
        if(!first)first=joints;
        if(previous)jump=Math.max(jump,dist(previous.elbow,joints.elbow));
        shoulderTravel=Math.max(shoulderTravel,dist(frame.shoulder,joints.shoulder));
        elbowTravel=Math.max(elbowTravel,dist(first!.elbow,joints.elbow));
        previous=joints;
      }
      expect(jump).toBeLessThan(.09);
      expect(shoulderTravel).toBeGreaterThan(.015);
      expect(elbowTravel).toBeGreaterThan(.025);
    });
  }
  test("shell positions follow each shotgun receiver; gameplay insertion time is identical",()=>{
    for(const id of ["shotgun_br","shotgun_auto","shotgun_combat"]){
      const c=firstPersonShellContacts(id);
      expect(sampleReloadMotion(.24,"shell",c).hand).toEqual(c.pocket);
      expect(sampleReloadMotion(ROUND_INSERT_FRACTION,"shell",c).hand).toEqual(c.port);
      expect(sampleReloadMotion(.50,"shell",c).propVisible).toBe(true);
      expect(sampleReloadMotion(.71,"shell",c).propVisible).toBe(false);
      expect(c.port[2]).toBeLessThan(c.pocket[2]);
    }
    expect(firstPersonShellContacts("shotgun_br").port)
      .not.toEqual(firstPersonShellContacts("shotgun_auto").port);
    expect(ROUND_INSERT_FRACTION).toBe(.70);
    expect(reloadMotionFor("shotgun_br","shotgun")).toBe("shell");
    expect(reloadMotionFor("shotgun_auto","shotgun")).toBe("shell");
    expect(reloadMotionFor("shotgun_combat","shotgun")).toBe("shell");
  });
});
