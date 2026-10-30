/** Distant dam/reservoir dressing stays completely outside playable collision. */
import * as THREE from "three";

export function buildFloodgateBackdrop(scene:THREE.Scene):THREE.Group {
  const group=new THREE.Group();group.name="Floodgate distant spillway";
  const concrete=new THREE.MeshStandardMaterial({color:0x536973,roughness:.94});
  const water=new THREE.MeshBasicMaterial({color:0x537e94,transparent:true,opacity:.8,depthWrite:false});
  const foam=new THREE.MeshBasicMaterial({color:0xc0d8de,transparent:true,opacity:.5,depthWrite:false});
  const mountain=new THREE.MeshBasicMaterial({color:0x344e5e});
  const box=(material:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z);group.add(mesh);return mesh;
  };
  // A permanent failure removes the central gate, revealing the reservoir.
  box(concrete,-129,15,-122,162,30,16);
  box(concrete,129,15,-122,162,30,16);
  const intact=box(concrete,0,15,-122,96,30,16);
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
  const torrent=box(water,0,14,-121,96,27,5);
  torrent.name="floodgate-torrent";torrent.visible=false;
  const flood=box(new THREE.MeshBasicMaterial({color:0x348cb0,transparent:true,opacity:.48,depthWrite:false}),0,.15,-83,168,.12,43);
  flood.name="floodgate-flooded-spillway";flood.visible=false;
  const spray=box(foam,0,1,-104,100,2,3);
  spray.name="floodgate-breach-foam";spray.visible=false;
  scene.add(group);return group;
}

/** One-time material/mesh switch. No fluid particles or expensive physics. */
export function setFloodgateBreachVisual(group:THREE.Group,breached:boolean):void {
  for(const child of group.children){
    if(child.name==="floodgate-intact-gate")child.visible=!breached;
    if(child.name==="floodgate-torrent"||child.name==="floodgate-flooded-spillway"||child.name==="floodgate-breach-foam")
      child.visible=breached;
  }
}

/** Distant spillway water pulses only during the SAME authoritative steam
 * damage phase as its four warning grates. A broken dam has its own torrent. */
export function setFloodgatePurgeVisual(group:THREE.Group,active:boolean):void {
  if(group.userData.purgeActive===active)return;
  group.userData.purgeActive=active;
  for(const child of group.children){
    if(child.name==="floodgate-purge-spill"||child.name==="floodgate-purge-spray")
      child.visible=active;
  }
}
