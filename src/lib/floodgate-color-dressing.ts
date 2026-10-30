/** Lightweight non-colliding paint and floor identity for the hydroelectric map.
 * Paint is anchored to real map cover so visual trims never introduce fake walls.
 * These are static MeshBasicMaterial surfaces: no particles or per-frame work. */
import * as THREE from "three";
import type {MapDef} from "./game-protocol";

const TURBINE=0x22c4c6;
const SPILLWAY=0x69cce0;
const SERVICE=0xffb34c;
const SAFETY=0xf4d15e;

export function buildFloodgateColorDressing(scene:THREE.Scene,map:MapDef):THREE.Group{
  const group=new THREE.Group();
  group.name="Floodgate sector paint";
  const palette={
    turbine:new THREE.MeshBasicMaterial({color:TURBINE,transparent:true,opacity:.75,depthWrite:false,side:THREE.DoubleSide}),
    spillway:new THREE.MeshBasicMaterial({color:SPILLWAY,transparent:true,opacity:.72,depthWrite:false,side:THREE.DoubleSide}),
    service:new THREE.MeshBasicMaterial({color:SERVICE,transparent:true,opacity:.74,depthWrite:false,side:THREE.DoubleSide}),
    safety:new THREE.MeshBasicMaterial({color:SAFETY,transparent:true,opacity:.78,depthWrite:false,side:THREE.DoubleSide}),
  };
  const ground=(x:number,z:number,w:number,d:number,mat:THREE.Material)=>{
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat);
    mesh.rotation.x=-Math.PI/2;
    mesh.position.set(x,.065,z);
    mesh.renderOrder=2;
    group.add(mesh);
  };
  // Three sectors read at ground level even when combatants are below gantries.
  // Use slim directional floor bands rather than covering the combat map in
  // brightly painted platforms that falsely suggest new collision geometry.
  for(const x of [-100,-50,0,50,100]){
    ground(x,-18,16,.9,palette.turbine);
    ground(x,-26,9,.45,palette.turbine);
    ground(x,50,15,.9,palette.service);
    ground(x,57,9,.45,palette.service);
    ground(x,-88,14,.8,palette.spillway);
  }
  // Hazard grates get matching painted approach bars, not extra hitboxes.
  for(const x of [-72,-24,24,72]){
    for(const z of [-68,-84]){
      ground(x,z,13,.6,palette.safety);
    }
  }
  // Paint actual concrete sidewalls with color-coded banding. The selected
  // cover already exists in the authoritative map and stays physically intact.
  let stripes=0;
  for(const c of map.cover){
    if(c.environmentId||c.kind==="stair"||c.kind==="accent"||
      c.size[1]<2.2||c.size[0]<4||c.size[2]>4.5)continue;
    if(Math.abs(c.pos[0])>122||c.pos[2]<-103||c.pos[2]>101)continue;
    if(stripes>=22)break;
    const mat=c.pos[2]<-42?palette.spillway:c.pos[2]>40?palette.service:palette.turbine;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(c.size[0]*1.8,18),.67),mat);
    mesh.position.set(c.pos[0],Math.max(.85,Math.min(c.pos[1]+c.size[1]-.42,5.2)),c.pos[2]+c.size[2]+.045);
    mesh.renderOrder=2;
    group.add(mesh);
    stripes++;
  }
  scene.add(group);
  return group;
}
