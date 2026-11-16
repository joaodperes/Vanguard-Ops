import {describe, expect, test} from "bun:test";
import * as THREE from "three";
import {
  sampleReloadMotion,visualReloadRecoveryActive,type ShellReloadSequence,
} from "../src/lib/first-person-animation";
import {firstPersonShellContacts,firstPersonPresentationScale} from "../src/lib/weapon-models";
import {advanceIncrementalReload,ROUND_INSERT_FRACTION} from "../src/lib/incremental-reload";
import {hideFirstPersonRigOnDeath,syncFirstPersonSupportArmVisibility} from "../src/lib/first-person-rig-visibility";

const close=(a:number,b:number)=>expect(Math.abs(a-b)).toBeLessThan(1e-7);
const same=(a:readonly number[],b:readonly number[])=>{
  a.forEach((v,i)=>close(v,b[i]));
};

describe("continuous shotgun shell loading",()=>{
  const shotguns=["shotgun_br","shotgun_auto","shotgun_combat"] as const;
  for(const id of shotguns){
    test(id+" keeps the offhand at the shell pocket between rounds",()=>{
      const scale=firstPersonPresentationScale(id,"shotgun");
      const contacts=firstPersonShellContacts(id,scale);
      const first:ShellReloadSequence={firstCycle:true,finalCycle:false};
      const middle:ShellReloadSequence={firstCycle:false,finalCycle:false};
      const last:ShellReloadSequence={firstCycle:false,finalCycle:true};
      const firstStart=sampleReloadMotion(0,"shell",contacts,first);
      const firstEnd=sampleReloadMotion(1,"shell",contacts,first);
      const repeatStart=sampleReloadMotion(0,"shell",contacts,middle);
      const repeatEnd=sampleReloadMotion(1,"shell",contacts,middle);
      const finishAtInsert=sampleReloadMotion(ROUND_INSERT_FRACTION,"shell",contacts,last);
      const lastEnd=sampleReloadMotion(1,"shell",contacts,last);
      close(firstStart.armWeight!,0);
      close(firstEnd.armWeight!,1);
      close(repeatStart.armWeight!,1);
      close(repeatEnd.armWeight!,1);
      close(finishAtInsert.armWeight!,1);
      close(lastEnd.armWeight!,0);
      // At every repeated boundary, the hand, weapon pose and glove rotation
      // are IDENTICAL. No dropped gun, foregrip grip, or jumping elbow.
      same(firstEnd.hand,repeatStart.hand);
      same(repeatEnd.hand,repeatStart.hand);
      same(repeatEnd.prop,repeatStart.prop);
      close(firstEnd.dip,repeatStart.dip);
      close(firstEnd.pitch,repeatStart.pitch);
      close(firstEnd.roll,repeatStart.roll);
      close(firstEnd.handRoll,repeatStart.handRoll);
      close(repeatEnd.handRoll,repeatStart.handRoll);
      same(repeatEnd.hand,contacts.pocket);
      expect(repeatEnd.armWeight).toBe(1);
      // The last shell returns directly from the port to the real grip,
      // without another unnecessary shell-pocket trip.
      same(finishAtInsert.hand,contacts.port);
      same(lastEnd.hand,contacts.port);
      expect(finishAtInsert.propVisible).toBe(false);
      close(lastEnd.pitch,0);
      close(lastEnd.roll,0);
      close(lastEnd.dip,0);
      // The single-shell case must both release and reacquire the foregrip.
      const single:ShellReloadSequence={firstCycle:true,finalCycle:true};
      close(sampleReloadMotion(0,"shell",contacts,single).armWeight!,0);
      close(sampleReloadMotion(1,"shell",contacts,single).armWeight!,0);
    });
  }

  test("repeat cycles keep the same arm pose at cycle boundaries",()=>{
    const contacts=firstPersonShellContacts("shotgun_br",
      firstPersonPresentationScale("shotgun_br","shotgun"));
    const view=(p:number,seq:ShellReloadSequence)=>{
      const pose=sampleReloadMotion(p,"shell",contacts,seq);
      const offset=new THREE.Vector3(.30,-.18,-.48);
      const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.pitch,0,pose.roll));
      const cameraPivot=new THREE.Vector3(0,-.11,.12);
      const hand=new THREE.Vector3(...pose.hand).sub(cameraPivot).applyQuaternion(rotation)
        .add(cameraPivot).add(offset);
      return {hand,rotation,weight:pose.armWeight!};
    };
    const end=view(1,{firstCycle:false,finalCycle:false});
    const next=view(0,{firstCycle:false,finalCycle:false});
    expect(end.hand.distanceTo(next.hand)).toBeLessThan(1e-7);
    expect(end.rotation.angleTo(next.rotation)).toBeLessThan(1e-7);
    close(end.weight,next.weight);
  });

  test("each round still credits at 70% and only the final round returns",()=>{
    const magSize=6,period=900;
    let ammo=0;
    for(let cycle=0;cycle<magSize;cycle++){
      const start=1000+cycle*period;
      const atInsert=advanceIncrementalReload(ammo,magSize,false,start,period,start+period*ROUND_INSERT_FRACTION);
      expect(atInsert.ammo).toBe(ammo+1);
      expect(atInsert.magazineFull).toBe(cycle===magSize-1);
      const seq:ShellReloadSequence={firstCycle:cycle===0,finalCycle:atInsert.magazineFull};
      const loaded=sampleReloadMotion(ROUND_INSERT_FRACTION,"shell",undefined,seq);
      expect(loaded.armWeight).toBeCloseTo(1);
      const atEnd=sampleReloadMotion(1,"shell",undefined,seq);
      expect(atEnd.armWeight).toBe(atInsert.magazineFull?0:1);
      ammo=atInsert.ammo;
    }
    expect(visualReloadRecoveryActive(1000,1100,true,false)).toBe(true);
    expect(visualReloadRecoveryActive(1200,1100,true,false)).toBe(false);
    expect(visualReloadRecoveryActive(1000,1100,true,true)).toBe(false);
  });

  test("non-shell reloads and legacy isolated shell samples remain unchanged",()=>{
    const kinds=["magazine","side_bolt","vent","cylinder","bolt"] as const;
    for(const kind of kinds){
      const p=.82;
      const before=sampleReloadMotion(p,kind);
      const withShellState=sampleReloadMotion(p,kind,undefined,{firstCycle:false,finalCycle:false});
      expect(withShellState).toEqual(before);
      expect(before.armWeight).toBeUndefined();
    }
    const standalone=sampleReloadMotion(1,"shell");
    expect(standalone.armWeight).toBeUndefined();
  });
});

describe("local death removes every first-person arm component",()=>{
  test("hides the entire viewmodel including independently camera-parented elbow and sleeve",()=>{
    const gunPart=new THREE.Group(),sight=new THREE.Group(),glove=new THREE.Group(),
      prop=new THREE.Group(),arm=new THREE.Group(),elbow=new THREE.Group(),upper=new THREE.Group();
    arm.add(elbow,upper);
    hideFirstPersonRigOnDeath([{obj:gunPart},{obj:sight}],glove,prop,arm);
    for(const item of [gunPart,sight,glove,prop,arm])
      expect(item.visible).toBe(false);
    expect(arm.children.length).toBe(2); // hidden together without removing/disposal
    // Fresh spawn re-poses and re-enables the shared meshes.
    for(const item of [gunPart,sight,glove,prop,arm])item.visible=true;
    expect(arm.visible).toBe(true);
    hideFirstPersonRigOnDeath([{obj:gunPart},{obj:sight}],glove,prop,arm);
    expect(arm.visible).toBe(false);
  });
  test("death visibility tolerates a melee/unfinished rig with missing optional nodes",()=>{
    const part=new THREE.Group();
    hideFirstPersonRigOnDeath([{obj:part}],null,null,null);
    expect(part.visible).toBe(false);
    hideFirstPersonRigOnDeath([],null,null,null);
  });
});

describe("Akimbo equipment hand visibility",()=>{
  test("returns a raised left sleeve to hidden immediately after a throw",()=>{
    const glove=new THREE.Group(),arm=new THREE.Group();
    const forearm=new THREE.Mesh(),elbow=new THREE.Mesh();
    arm.add(forearm,elbow);
    // Throw in progress: temporary offhand and sleeve are raised.
    glove.visible=true;
    syncFirstPersonSupportArmVisibility(arm,glove,false);
    expect(arm.visible).toBe(true);
    // Equipment completes: Akimbo hides the action glove. The sleeve MUST
    // not be resurrected by the following per-frame visibility update.
    glove.visible=false;
    syncFirstPersonSupportArmVisibility(arm,glove,false);
    expect(arm.visible).toBe(false);
    expect(forearm.visible).toBe(true); // inherited visibility from root
    syncFirstPersonSupportArmVisibility(arm,glove,false);
    expect(arm.visible).toBe(false);
  });
  test("normal two-hand support returns and Juggernaut hides the sleeve",()=>{
    const glove=new THREE.Group(),arm=new THREE.Group();
    glove.visible=true;
    syncFirstPersonSupportArmVisibility(arm,glove,false);
    expect(arm.visible).toBe(true);
    syncFirstPersonSupportArmVisibility(arm,glove,true);
    expect(arm.visible).toBe(false);
    syncFirstPersonSupportArmVisibility(arm,glove,false);
    expect(arm.visible).toBe(true);
    syncFirstPersonSupportArmVisibility(null,glove,false);
  });
});
