/** Floodgate: reservoir, spillway and a one-time moving, playable inundation.
 * Decorative meshes never create untracked colliders. Gameplay physics is
 * governed by floodgateWaterEffect in map-battle-events, not mesh dimensions. */
import * as THREE from "three";
import {
  FLOODGATE_FLOOD_START_Z,FLOODGATE_FLOOD_END_Z,FLOODGATE_FLOOD_HALF_WIDTH,
  FLOODGATE_SURGE_SECONDS,floodgateSurgeFront,
} from "./map-battle-events";

export function buildFloodgateBackdrop(scene:THREE.Scene):THREE.Group {
  const group=new THREE.Group();group.name="Floodgate reservoir and breach";
  const concrete=new THREE.MeshStandardMaterial({color:0x536973,roughness:.94});
  const water=new THREE.MeshBasicMaterial({color:0x2b8fa9,transparent:true,opacity:.88,depthWrite:false});
  const foam=new THREE.MeshBasicMaterial({color:0xb7f4ff,transparent:true,opacity:.74,depthWrite:false});
  const mountain=new THREE.MeshBasicMaterial({color:0x344e5e});
  const box=(material:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z);group.add(mesh);return mesh;
  };
  // Permanent concrete at either side and the rear high bridge sit beyond the
  // north boundary. The shootable wall itself is environment geometry at z=-99.
  box(concrete,-129,15,-122,162,30,16);
  box(concrete,129,15,-122,162,30,16);
  const intact=box(concrete,0,29,-122,96,2.5,16);
  intact.name="floodgate-intact-gate";
  box(concrete,0,31,-122,424,2,18);
  for(const x of [-72,-24,24,72]){
    const spill=box(water,x,16,-113.85,19,28,.1);
    spill.name="floodgate-purge-spill";spill.visible=false;
    for(const dx of [-6,0,6]){
      const spray=box(foam,x+dx,16,-113.76,.35,26,.06);
      spray.name="floodgate-purge-spray";spray.visible=false;
    }
    box(concrete,x-12,16,-115,3,31,3);
    box(concrete,x+12,16,-115,3,31,3);
  }
  const reservoir=new THREE.Mesh(new THREE.PlaneGeometry(420,110),water);
  reservoir.rotation.x=-Math.PI/2;reservoir.position.set(0,30,-185);group.add(reservoir);
  for(const [x,z,h,radius] of [[-190,-235,108,65],[-60,-254,132,77],[85,-248,113,66],[205,-232,96,56]]){
    const peak=new THREE.Mesh(new THREE.ConeGeometry(radius,h,5),mountain);
    peak.position.set(x,h/2-8,z);peak.rotation.y=x*.013;group.add(peak);
  }
  const torrent=box(water,0,14,-112,112,27,1.2);
  torrent.name="floodgate-torrent";torrent.visible=false;
  // Animate this sheet across actual low ground after breach. It starts with
  // zero length so a delayed join doesn't flash a pre-flooded floor.
  const flooded=box(new THREE.MeshBasicMaterial({color:0x117c9e,transparent:true,opacity:.76,depthWrite:false}),
    0,.13,FLOODGATE_FLOOD_START_Z,2*FLOODGATE_FLOOD_HALF_WIDTH,.18,1);
  flooded.name="floodgate-flooded-spillway";flooded.visible=false;
  const wave=box(new THREE.MeshBasicMaterial({color:0x288ba8,transparent:true,opacity:.87,depthWrite:false}),
    0,.85,FLOODGATE_FLOOD_START_Z,2*FLOODGATE_FLOOD_HALF_WIDTH,1.7,2.7);
  wave.name="floodgate-wave";wave.visible=false;
  const front=box(foam,0,1.65,FLOODGATE_FLOOD_START_Z,2*FLOODGATE_FLOOD_HALF_WIDTH,.22,3.1);
  front.name="floodgate-wave-foam";front.visible=false;
  const spray=box(foam,0,1,-104,110,2,3);
  spray.name="floodgate-breach-foam";spray.visible=false;
  // Reuse fixed mist columns across the FULL northern district, not just
  // the original central channel. No runtime particle allocation.
  for(let i=0;i<25;i++){
    const x=(i-12)*10.5;
    const mist=box(foam,x,1.7,FLOODGATE_FLOOD_START_Z,.55,3.2,1.5);
    mist.name="floodgate-front-mist";mist.visible=false;
    mist.userData.phase=i*.71;
  }
  scene.add(group);return group;
}

/** Visibility is explicitly controlled: no map-state markers or UI text. */
export function setFloodgateBreachVisual(group:THREE.Group,breached:boolean):void {
  for(const child of group.children){
    if(child.name==="floodgate-intact-gate")child.visible=!breached;
    if(child.name==="floodgate-torrent"||child.name==="floodgate-breach-foam")
      child.visible=breached;
    if(!breached&&child.name.startsWith("floodgate-wave"))child.visible=false;
    if(!breached&&child.name==="floodgate-flooded-spillway")child.visible=false;
    if(!breached&&child.name==="floodgate-front-mist")child.visible=false;
  }
}

/** Called every frame with synchronized breach age. Fixed object/material count. */
export function updateFloodgateBreachVisual(group:THREE.Group,age:number|null):void {
  if(age===null){setFloodgateBreachVisual(group,false);return;}
  const frontZ=floodgateSurgeFront(age);
  const extent=Math.max(.15,frontZ-FLOODGATE_FLOOD_START_Z);
  const sheet=group.getObjectByName("floodgate-flooded-spillway");
  if(sheet){
    sheet.visible=true;
    sheet.position.z=FLOODGATE_FLOOD_START_Z+extent/2;
    sheet.scale.z=extent;
  }
  const surging=age<FLOODGATE_SURGE_SECONDS;
  for(const name of ["floodgate-wave","floodgate-wave-foam"]){
    const mesh=group.getObjectByName(name);
    if(!mesh)continue;
    mesh.visible=surging;
    mesh.position.z=frontZ;
    if(name==="floodgate-wave")mesh.position.y=.85+Math.sin(age*8)*.15;
    else mesh.position.y=1.65+Math.sin(age*11)*.18;
  }
  for(const mist of group.children.filter(c=>c.name==="floodgate-front-mist")){
    mist.visible=surging;
    mist.position.z=frontZ+.65*Math.sin(age*2+mist.userData.phase);
    mist.scale.y=.6+.4*Math.abs(Math.sin(age*4+mist.userData.phase));
  }
  // A continuous waterfall remains after the rushing front passes.
  const torrent=group.getObjectByName("floodgate-torrent");
  if(torrent)torrent.visible=true;
  const spray=group.getObjectByName("floodgate-breach-foam");
  if(spray)spray.visible=true;
  const intact=group.getObjectByName("floodgate-intact-gate");
  if(intact)intact.visible=false;
}

/** The old timed steam purge stops when flood water overwhelms the grates. */
export function setFloodgatePurgeVisual(group:THREE.Group,active:boolean):void {
  if(group.userData.purgeActive===active)return;
  group.userData.purgeActive=active;
  for(const child of group.children)
    if(child.name==="floodgate-purge-spill"||child.name==="floodgate-purge-spray")
      child.visible=active;
}
