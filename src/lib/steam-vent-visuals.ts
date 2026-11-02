/** Fixed-mesh steam jets: no particle spawning, lights or geometry allocation per tick. */
import * as THREE from "three";
import type { EnvironmentObject } from "./game-protocol";
import { periodicHazardPhase } from "./dynamic-environment";

type PeriodicHazard = Extract<EnvironmentObject,{type:"spikes"}>;

export function buildSteamVent(group:THREE.Group,o:PeriodicHazard):void {
  const grate=new THREE.Mesh(new THREE.BoxGeometry(o.size[0]*2,.12,o.size[2]*2),
    new THREE.MeshStandardMaterial({color:0x293e48,roughness:.76,metalness:.65}));
  group.add(grate);
  const indicator=new THREE.MeshBasicMaterial({color:0x64d8dc});
  for(const side of [-1,1]){
    const rim=new THREE.Mesh(new THREE.BoxGeometry(o.size[0]*2,.12,.20),indicator);
    rim.position.set(0,.10,side*o.size[2]);group.add(rim);
  }
  const jetHeight=o.size[1]+.5;
  const geometry=new THREE.CylinderGeometry(.28,.85,jetHeight,6,1,true);
  const material=new THREE.MeshBasicMaterial({color:0xc9edf2,transparent:true,opacity:.46,
    depthWrite:false,side:THREE.DoubleSide});
  for(let i=0;i<6;i++){
    const jet=new THREE.Mesh(geometry,material);
    jet.position.set(((i%3)-1)*o.size[0]*.64,jetHeight/2,(i<3?-1:1)*o.size[2]*.55);
    jet.userData.steamJet=i+1;
    jet.visible=false;group.add(jet);
  }
  group.userData.steamIndicator=indicator;
}

export function updateSteamVent(group:THREE.Group,o:PeriodicHazard,seconds:number):void {
  const phase=periodicHazardPhase(o,seconds);
  const indicator=group.userData.steamIndicator as THREE.MeshBasicMaterial;
  indicator.color.setHex(phase==="active"?0xf9e6cd:phase==="warning"?
    (Math.sin(seconds*12)>0?0xffb347:0x74401b):0x64d8dc);
  for(const child of group.children){
    const seed=child.userData.steamJet as number|undefined;
    if(seed===undefined)continue;
    child.visible=phase==="active";
    if(child.visible){
      const height=.82+Math.sin(seconds*9+seed*2)*.12;
      child.scale.y=height;
      child.position.y=(o.size[1]+.5)*height/2;
    }
  }
}
