import {describe,expect,test} from "bun:test";
import * as THREE from "three";
import catalog from "../src/data/catalogs/weapons.json";
import {
  WEAPON_VISUALS, FIRST_PERSON_COMPACT_SCALE, WORLD_WEAPON_VISUAL_SCALE,
  firstPersonPresentationScale,proceduralWeaponOverallLength,
  firstPersonSupportGrip,firstPersonShellContacts,
} from "../src/lib/weapon-models";
import {
  calibratedSupportArm, supportElbowPosition,sampleReloadMotion,
  supportActionWeight,
} from "../src/lib/first-person-animation";
import {placeFirstPersonActionTarget} from "../src/lib/first-person-action-target";
import {ROUND_INSERT_FRACTION} from "../src/lib/incremental-reload";

const distance=(a:readonly number[],b:readonly number[]) =>
  Math.hypot(...a.map((v,i)=>v-b[i]));
const scaleFor=(id:string,category:string) => firstPersonPresentationScale(id,category);
const wristFor=(id:string,category:string,touch=false):[number,number,number]=>{
  const g=firstPersonSupportGrip(id),s=scaleFor(id,category);
  return [g[0]*s+(touch?.22:.30)-.045,g[1]*s+(touch?-.20:-.18)-.125,
    g[2]*s+(touch?-.50:-.48)+.10];
};

describe("first-person firearm proportions",()=>{
  test("full-length firearms align with the already-established 0.72 world scale",()=>{
    const fullSize=[
      ["rifle_ar","assault",.82,.90],
      ["rifle_heavy","assault",1.02,1.11],
      ["rifle_falcon","assault",1.06,1.14],
      ["dmr_heavy","dmr",1.20,1.29],
      ["lmg_hv","lmg",1.0,1.09],
      ["lmg_heavy","lmg",1.25,1.34],
      ["sniper_heavy","sniper",1.44,1.56],
      ["sniper_lr","sniper",1.25,1.37],
      ["shotgun_br","shotgun",.84,.94],
      ["shotgun_auto","shotgun",.91,1.00],
    ] as const;
    expect(WORLD_WEAPON_VISUAL_SCALE).toBe(.72);
    for(const [id,category,min,max] of fullSize){
      const modelLength=proceduralWeaponOverallLength(id);
      const scale=scaleFor(id,category);
      const total=modelLength*scale;
      expect(scale).toBeCloseTo(WORLD_WEAPON_VISUAL_SCALE,8);
      expect(total).toBeGreaterThan(min);
      expect(total).toBeLessThan(max);
      expect(total).toBeLessThan(modelLength*FIRST_PERSON_COMPACT_SCALE*.72);
    }
  });
  test("existing pistol, PDW and SMG presentation is unchanged",()=>{
    for(const weapon of catalog){
      if(!["pistol","pdw","smg","melee"].includes(weapon.category))continue;
      expect(scaleFor(weapon.id,weapon.category)).toBe(FIRST_PERSON_COMPACT_SCALE);
    }
    expect(scaleFor("wonder_turret","lmg")).toBe(FIRST_PERSON_COMPACT_SCALE);
  });
  test("small experimental weapons blend smoothly instead of jumping categories",()=>{
    expect(scaleFor("wonder_singularity","dmr")).toBeCloseTo(FIRST_PERSON_COMPACT_SCALE,8);
    expect(scaleFor("wonder_deadlock","dmr")).toBeCloseTo(FIRST_PERSON_COMPACT_SCALE,8);
    const short=scaleFor("wonder_stormweaver","shotgun");
    expect(short).toBeLessThan(FIRST_PERSON_COMPACT_SCALE);
    expect(short).toBeGreaterThan(WORLD_WEAPON_VISUAL_SCALE);
    expect(scaleFor("shotgun_br","shotgun")).toBe(WORLD_WEAPON_VISUAL_SCALE);
    for(const weapon of catalog){
      if(!WEAPON_VISUALS[weapon.id])continue;
      const scale=scaleFor(weapon.id,weapon.category);
      expect(Number.isFinite(scale)).toBe(true);
      expect(scale).toBeGreaterThanOrEqual(WORLD_WEAPON_VISUAL_SCALE-1e-8);
      expect(scale).toBeLessThanOrEqual(FIRST_PERSON_COMPACT_SCALE+1e-8);
    }
  });
  test("every resized support grip still reaches naturally from the common arm",()=>{
    let n=0;
    for(const weapon of catalog){
      if(!WEAPON_VISUALS[weapon.id]||weapon.category==="melee")continue;
      n++;
      for(const touch of [false,true])for(const aspect of [16/9,4/3,1,9/16]){
        const wrist=wristFor(weapon.id,weapon.category,touch);
        const f=calibratedSupportArm(weapon.category,wrist,aspect,false);
        const elbow=supportElbowPosition(f.shoulder,wrist,f.pole,f.upperLength,f.forearmLength);
        const reach=distance(f.shoulder,wrist);
        const stretch=Math.max(1,reach/((f.upperLength+f.forearmLength)*.998));
        expect(stretch).toBeLessThan(1.15);
        expect(distance(f.shoulder,elbow)).toBeCloseTo(f.upperLength*stretch,5);
        expect(distance(elbow,wrist)).toBeCloseTo(f.forearmLength*stretch,5);
        expect(elbow[2]-wrist[2]).toBeGreaterThan(.13);
        expect(f.shoulder[2]-elbow[2]).toBeGreaterThan(.08);
        expect(elbow.every(Number.isFinite)).toBe(true);
      }
    }
    expect(n).toBeGreaterThan(35);
  });
  test("weapon attachments and barrel endpoints use the same uniform scale",()=>{
    for(const [id,category] of [
      ["rifle_ar","assault"],["dmr_heavy","dmr"],["lmg_heavy","lmg"],
      ["sniper_heavy","sniper"],["shotgun_br","shotgun"],
    ]){
      const scale=scaleFor(id,category);
      const p=WEAPON_VISUALS[id];
      const muzzleLocal=-.12-p.receiver[2]/2-p.guardLength-p.barrelLength+.04;
      const scopeMount=-.12;
      const ox=.30,oz=-.48;
      const barrelWorldZ=muzzleLocal*scale+oz;
      const scopeWorldZ=scopeMount*scale+oz;
      expect(barrelWorldZ).toBeLessThan(scopeWorldZ-.15);
      const point=(v:number)=>v*scale+oz;
      expect(point(muzzleLocal+.02)-point(muzzleLocal)).toBeCloseTo(.02*scale,8);
      expect(point(-.12)-point(muzzleLocal)).toBeGreaterThan(.16);
      expect(ox).toBe(.30);
    }
  });
});

describe("reload contacts stay on resized weapon geometry",()=>{
  const pivot=new THREE.Vector3(0,-.11,.12);
  const offset=new THREE.Vector3(.30,-.18,-.48);
  test("magazine/bolt hand targets and loose props scale with the weapon",()=>{
    const contacts:[number,number,number][]=[
      [-.16,-.035,-.18],[.015,-.255,.02],[-.19,-.47,.17],
    ];
    const turns=[[0,0],[.08,-.18],[.40,-.28]] as const;
    for(const id of ["rifle_ar","lmg_heavy","sniper_heavy","dmr_heavy"]){
      const category=id.startsWith("lmg")?"lmg":id.startsWith("sniper")?"sniper":
        id.startsWith("dmr")?"dmr":"assault";
      const ratio=scaleFor(id,category)/FIRST_PERSON_COMPACT_SCALE;
      for(const contact of contacts)for(const [pitch,roll] of turns){
        const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch,0,roll,"XYZ"));
        const expected=new THREE.Vector3(...contact).multiplyScalar(ratio)
          .sub(pivot).applyQuaternion(rotation).add(pivot).add(offset);
        const result=placeFirstPersonActionTarget(
          new THREE.Vector3(),contact,rotation,offset.x,offset.y,offset.z,ratio);
        expect(result.distanceTo(expected)).toBeLessThan(1e-8);
      }
    }
  });
  test("shotgun shell contacts already include gun scale and must never scale twice",()=>{
    for(const id of ["shotgun_br","shotgun_auto","shotgun_combat"]){
      const ratio=scaleFor(id,"shotgun")/FIRST_PERSON_COMPACT_SCALE;
      const gunScale=scaleFor(id,"shotgun");
      const contacts=firstPersonShellContacts(id,gunScale);
      const pose=sampleReloadMotion(ROUND_INSERT_FRACTION,"shell",contacts);
      expect(pose.hand).toEqual(contacts.port);
      const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(.32,0,-.15,"XYZ"));
      const correct=placeFirstPersonActionTarget(new THREE.Vector3(),
        pose.hand,rotation,.30,-.28,-.48,1);
      const expected=new THREE.Vector3(...pose.hand).sub(pivot)
        .applyQuaternion(rotation).add(pivot).add(new THREE.Vector3(.30,-.28,-.48));
      expect(correct.distanceTo(expected)).toBeLessThan(1e-8);
      const incorrect=placeFirstPersonActionTarget(new THREE.Vector3(),
        pose.hand,rotation,.30,-.28,-.48,ratio);
      expect(incorrect.distanceTo(correct)).toBeGreaterThan(.03);
    }
  });
  test("all long-gun reload styles remain continuous at their actual smaller scale",()=>{
    const muzzlePose=(id:string,category:string,kind:Parameters<typeof sampleReloadMotion>[1])=>{
      const s=scaleFor(id,category),ratio=s/FIRST_PERSON_COMPACT_SCALE;
      const grip=firstPersonSupportGrip(id);
      const shell=firstPersonShellContacts(id,s);
      const pivot=new THREE.Vector3(0,-.11,.12);
      const offset=new THREE.Vector3(.30,-.18,-.48);
      const cuff=new THREE.Vector3(-.045,-.125,.10);
      const frame=calibratedSupportArm(category,wristFor(id,category),16/9);
      let last:null|ReturnType<typeof supportElbowPosition>=null,maxStep=0;
      for(let step=0;step<=100;step++){
        const progress=step/100;
        const pose=sampleReloadMotion(progress,kind,kind==="shell"?shell:undefined);
        const rotation=new THREE.Quaternion()
          .setFromEuler(new THREE.Euler(pose.pitch,0,pose.roll,"XYZ"));
        const restHand=new THREE.Vector3(...grip).multiplyScalar(s)
          .sub(pivot).applyQuaternion(rotation).add(pivot).add(offset);
        restHand.y+=pose.dip;
        const hand=placeFirstPersonActionTarget(new THREE.Vector3(),
          pose.hand,rotation,offset.x,offset.y+pose.dip,offset.z,
          kind==="shell"?1:ratio);
        const blend=supportActionWeight(progress);
        hand.lerp(restHand,1-blend);
        const wrist=hand.clone().add(cuff.clone().applyQuaternion(rotation));
        const restWrist=restHand.add(cuff.clone().applyQuaternion(rotation));
        const joint=calibratedSupportArm(category,wristFor(id,category),16/9);
        const solve=(awaitNever:unknown)=>awaitNever;
        // Check the actual rest pose and moving target are both finite.
        const elbow=supportElbowPosition(joint.shoulder,wrist,joint.pole,
          joint.upperLength,joint.forearmLength);
        expect(elbow.every(Number.isFinite)).toBe(true);
        if(last)maxStep=Math.max(maxStep,distance(last,elbow));
        last=elbow;
        expect(restWrist.every(Number.isFinite)).toBe(true);
        expect(frame.forearmLength).toBeGreaterThan(.3);
        void solve;
      }
      expect(maxStep).toBeLessThan(.10);
    };
    muzzlePose("rifle_ar","assault","magazine");
    muzzlePose("lmg_heavy","lmg","magazine");
    muzzlePose("sniper_heavy","sniper","side_bolt");
    muzzlePose("shotgun_br","shotgun","shell");
  });
});
