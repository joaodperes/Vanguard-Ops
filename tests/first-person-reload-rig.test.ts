import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { placeFirstPersonActionTarget } from "../src/lib/first-person-action-target";
import {
  animatedSupportArm, reloadMotionFor, sampleReloadMotion, supportActionWeight,
  calibratedSupportArm, supportArmFraming, SUPPORT_LONG_UPPER_ARM_LENGTH, SUPPORT_LONG_FOREARM_LENGTH,
} from "../src/lib/first-person-animation";
import { firstPersonSupportGrip } from "../src/lib/weapon-models";

const pivot = new THREE.Vector3(0,-.11,.12);
const offset = new THREE.Vector3(.30,-.18,-.48);
const cuff = new THREE.Vector3(-.045,-.125,.10);
const distance = (a:readonly number[],b:readonly number[]) =>
  Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);

describe("weapon-relative reload contacts and articulated arm",()=>{
  test("contact coordinates follow the same pivot and rotation as the weapon",()=>{
    const contact:[number,number,number]=[-.16,-.035,-.18];
    for(const [pitch,roll] of [[0,0],[.08,-.18],[.40,-.28],[-.20,.31]]){
      const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch,0,roll,"XYZ"));
      const expected=new THREE.Vector3(...contact).sub(pivot)
        .applyQuaternion(rotation).add(pivot).add(offset);
      const actual=placeFirstPersonActionTarget(new THREE.Vector3(),contact,rotation,
        offset.x,offset.y,offset.z);
      expect(actual.distanceTo(expected)).toBeLessThan(1e-8);
    }
  });

  test("Annihilator bolt stroke drives hand, elbow and shoulder over the entire reload",()=>{
    expect(reloadMotionFor("sniper_heavy","sniper")).toBe("side_bolt");
    const contact=firstPersonSupportGrip("sniper_heavy");
    const nominal:[number,number,number]=[
      contact[0]*1.20+.30-.045,contact[1]*1.20-.18-.125,
      contact[2]*1.20-.48+.10,
    ];
    const frame=calibratedSupportArm("sniper",nominal,16/9);
    const grip=new THREE.Vector3(...contact).multiplyScalar(1.20);
    let previous: {shoulder:[number,number,number]; elbow:[number,number,number]} | undefined;
    let maxStep=0, maxElbowMove=0, maxShoulderMove=0;
    let atPort:ReturnType<typeof animatedSupportArm>|null=null;
    let atBack:ReturnType<typeof animatedSupportArm>|null=null;

    for(let index=0;index<=100;index++){
      const p=index/100, pose=sampleReloadMotion(p,"side_bolt");
      const quat=new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.pitch,0,pose.roll,"XYZ"));
      const restHand=grip.clone().sub(pivot).applyQuaternion(quat).add(pivot).add(offset);
      restHand.y+=pose.dip;
      const restWrist=restHand.clone().add(cuff.clone().applyQuaternion(quat));

      const weaponHand=placeFirstPersonActionTarget(new THREE.Vector3(),pose.hand,quat,
        offset.x,offset.y+pose.dip,offset.z);
      const extra=new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.handRoll*.25,0,pose.handRoll));
      const handQuat=quat.clone().multiply(extra);
      const blend=supportActionWeight(p);
      const hand=weaponHand.lerp(restHand,1-blend);
      handQuat.slerp(quat,1-blend);
      const wrist=hand.add(cuff.clone().applyQuaternion(handQuat));
      const joints=animatedSupportArm(frame,restWrist.toArray() as [number,number,number],
        wrist.toArray() as [number,number,number],blend,
        frame.upperLength,frame.forearmLength);
      expect(joints.shoulder.every(Number.isFinite)).toBe(true);
      expect(joints.elbow.every(Number.isFinite)).toBe(true);
      const upper=distance(joints.shoulder,joints.elbow);
      const fore=distance(joints.elbow,wrist.toArray());
      const stretch=Math.max(1,distance(joints.shoulder,wrist.toArray())/
        ((frame.upperLength+frame.forearmLength)*.998));
      expect(upper).toBeCloseTo(frame.upperLength*stretch,4);
      expect(fore).toBeCloseTo(frame.forearmLength*stretch,4);
      if(previous){
        const step=distance(joints.elbow,previous.elbow);
        maxStep=Math.max(maxStep,step);
      }
      if(index===22)atPort=joints;
      if(index===50)atBack=joints;
      previous=joints;
    }
    expect(atPort).not.toBeNull();
    expect(atBack).not.toBeNull();
    maxElbowMove=distance(atPort!.elbow,atBack!.elbow);
    maxShoulderMove=distance(atPort!.shoulder,atBack!.shoulder);
    expect(maxElbowMove).toBeGreaterThan(.07);
    expect(maxShoulderMove).toBeGreaterThan(.055);
    expect(maxStep).toBeLessThan(.035); // no sudden elbow flip at keyframe boundaries
  });

  test("action root motion is bounded and zero at the rest state",()=>{
    const rest:[number,number,number]=[.107,-.411,-.659];
    const f=calibratedSupportArm("sniper",rest,16/9);
    for(const wrist of [[.45,-.36,.02],[-.10,.18,-.68],[-.6,-.8,-.6],[.04,-.34,-.28]]){
      const joints=animatedSupportArm(f,rest,wrist,1,
        f.upperLength,f.forearmLength);
      expect(Math.abs(joints.shoulder[0]-f.shoulder[0])).toBeLessThanOrEqual(.110001);
      expect(Math.abs(joints.shoulder[1]-f.shoulder[1])).toBeLessThanOrEqual(.100001);
      expect(Math.abs(joints.shoulder[2]-f.shoulder[2])).toBeLessThanOrEqual(.170001);
    }
    const neutral=animatedSupportArm(f,rest,rest,0,
      f.upperLength,f.forearmLength);
    expect(neutral.shoulder).toEqual(f.shoulder);
  });
});
