/** Floodgate environmental transformation: upright freight containers become four
 * traversable stairs and upper landing bridges after the dam breaches.
 * Shared by server collisions, offline physics, bot pathfinding and rendering. */
import * as THREE from "three";
import {invalidateMapCoverIndex} from "./map-cover-index";
import type {CoverBox,EnvironmentObject,MapDef} from "./game-protocol";
import {FLOODGATE_FLOOD_START_Z,FLOODGATE_FLOOD_END_Z,FLOODGATE_SURGE_SECONDS} from "./map-battle-events";

export const FLOODGATE_TOPPLE_SECONDS=3.2;
// Contact time is a fraction; adding the duration can round a few ulps short.
// Use one tolerance for collision stage and rendered pose so they cannot desync.
const TOPPLE_TIME_EPSILON=1e-9;
export const FLOODGATE_ROOF_STEPS=18;
export const FLOODGATE_ROOF_HEIGHT=11; // Existing turbine roof: y=10 base + 1-unit slab
// Upper flight and bridge are open metal decking, not concrete-filled prisms.
// Their physical underside must match the visible planks so infantry and shots
// can pass beneath wherever existing buildings leave enough headroom.
export const FLOODGATE_ROOF_TREAD_THICKNESS=.12;
export const FLOODGATE_BRIDGE_THICKNESS=.19;
export const FLOODGATE_FREIGHT=[
  {id:"west-inner",x:-21,z:-74,color:0xda8539},
  {id:"east-inner",x:21,z:-74,color:0x36a6b0},
  {id:"west-outer",x:-88,z:-74,color:0xc65e42},
  {id:"east-outer",x:88,z:-74,color:0xe0a93c},
] as const;
const PREFIX="floodgate-freight:";
export type FreightStage="upright"|"falling"|"fallen";
type Freight = (typeof FLOODGATE_FREIGHT)[number];
const stages=new WeakMap<MapDef,Map<string,FreightStage>>();
/** The upstream face is the first part of a standing pillar touched by water.
 * Each pillar's own Z determines its collapse, not the dam-breach timestamp. */
export function freightContactAge(c:Freight):number {
  return (c.z-1.4-FLOODGATE_FLOOD_START_Z)/
    (FLOODGATE_FLOOD_END_Z-FLOODGATE_FLOOD_START_Z)*FLOODGATE_SURGE_SECONDS;
}
export function freightFallingAge(age:number|null,c:Freight):number|null {
  if(age===null||age<freightContactAge(c))return null;
  return age-freightContactAge(c);
}
export function freightStage(age:number|null,c:Freight=FLOODGATE_FREIGHT[0]):FreightStage {
  const t=freightFallingAge(age,c);
  return t===null?"upright":t<FLOODGATE_TOPPLE_SECONDS-TOPPLE_TIME_EPSILON?"falling":"fallen";
}
export function freightCover(stage:Exclude<FreightStage,"falling">,only?:Freight):CoverBox[]{
  const boxes:CoverBox[]=[];
  for(const c of only?[only]:FLOODGATE_FREIGHT){
    if(stage==="upright"){
      boxes.push({pos:[c.x,11.5,c.z],size:[2.7,11.5,1.4],kind:"cover",environmentId:PREFIX+c.id+":upright"});
    }else{
      // North-to-south freight ramp: eight 0.42-unit risers. These lower
      // risers remain solid: the fallen container body visibly fills the ramp.
      // One shared geometry recipe prevents visible and physical mismatch.
      for(let i=0;i<8;i++){
        const top=(i+1)*.42;
        boxes.push({pos:[c.x,top/2,-84+(i+.5)*2.65],size:[2.7,top/2,1.345],
          kind:"stair",environmentId:PREFIX+c.id+":step-"+i});
      }
      boxes.push({pos:[c.x,3.36-FLOODGATE_BRIDGE_THICKNESS/2,-59.3],
        size:[4.15,FLOODGATE_BRIDGE_THICKNESS/2,4.1],
        kind:"platform",environmentId:PREFIX+c.id+":bridge"});
      // The freight first reaches the 3.4m spillway overlook. A second
      // narrow flight then connects that overlook to the real turbine roof
      // (top y=11 at z=-28), crossing the hall wall above its 8m parapet.
      // These are genuine authored collision treads, not visual-only props.
      for(let i=0;i<FLOODGATE_ROOF_STEPS;i++){
        const top=3.4+(FLOODGATE_ROOF_HEIGHT-3.4)*(i+1)/FLOODGATE_ROOF_STEPS;
        boxes.push({pos:[c.x,top-FLOODGATE_ROOF_TREAD_THICKNESS/2,-46+(i+.5)],
          size:[2.7,FLOODGATE_ROOF_TREAD_THICKNESS/2,.52],
          kind:"stair",environmentId:PREFIX+c.id+":roof-step-"+i});
      }
    }
  }
  return boxes;
}
/** Steam vents cease to be route blockers when the flood disables them. */
export function floodgatePathHazards(map:MapDef,breached:boolean):readonly EnvironmentObject[]{
  if(map.id!=="floodgate"||!breached)return map.environment??[];
  return (map.environment??[]).filter(o=>!(o.type==="spikes"&&o.visual==="steam"));
}
/** Only changes cover owned by the event. This never mutates MAPS singletons;
 * each room/game gets its own makeEnvironmentMap copy. Each pillar updates
 * individually when its water contact time is reached. Returns true if any
 * collider changed, allowing bot routes to be invalidated exactly then. */
export function setFloodgateFreightStage(map:MapDef,age:number|null):boolean{
  if(map.id!=="floodgate")return false;
  const previous=stages.get(map)??new Map<string,FreightStage>();
  let changed=false;
  for(const c of FLOODGATE_FREIGHT){
    const stage=freightStage(age,c);
    if(previous.get(c.id)===stage)continue;
    const prefix=PREFIX+c.id+":";
    for(let i=map.cover.length-1;i>=0;i--)
      if(map.cover[i].environmentId?.startsWith(prefix))map.cover.splice(i,1);
    if(stage!=="falling")map.cover.push(...freightCover(stage,c));
    previous.set(c.id,stage);
    changed=true;
  }
  stages.set(map,previous);
  if(changed)invalidateMapCoverIndex(map);
  return changed;
}
export function initializeFloodgateFreight(map:MapDef):void{
  setFloodgateFreightStage(map,null);
}
export function buildFloodgateFreight(scene:THREE.Scene):THREE.Group{
  const group=new THREE.Group();group.name="floodgate-freight";
  const trim=new THREE.MeshStandardMaterial({color:0x2e4548,metalness:.68,roughness:.4});
  const decking=new THREE.MeshStandardMaterial({color:0x778b88,metalness:.55,roughness:.6});
  for(const c of FLOODGATE_FREIGHT){
    const pivot=new THREE.Group();
    pivot.name=PREFIX+c.id;
    const body=new THREE.Mesh(new THREE.BoxGeometry(5.1,1.0,23),new THREE.MeshStandardMaterial({
      color:c.color,metalness:.45,roughness:.64,
    }));
    body.castShadow=true;body.receiveShadow=true;pivot.add(body);
    for(const offset of [-2.1,0,2.1]){
      const rib=new THREE.Mesh(new THREE.BoxGeometry(.13,1.1,22.8),trim);
      rib.position.x=offset;pivot.add(rib);
    }
    group.add(pivot);
    const steps=new THREE.Group();steps.name=PREFIX+c.id+":stairs";
    for(const box of freightCover("fallen",c).filter(b=>b.kind==="stair")){
      const plank=new THREE.Mesh(new THREE.BoxGeometry(box.size[0]*2,.12,box.size[2]*2),decking);
      // Align the rendered deck and the authoritative physical top surface.
      plank.position.set(box.pos[0],box.pos[1]+box.size[1]-.06,box.pos[2]);
      plank.receiveShadow=true;steps.add(plank);
    }
    const bridge=new THREE.Mesh(new THREE.BoxGeometry(8.3,.19,8.2),decking);
    bridge.position.set(c.x,3.36-FLOODGATE_BRIDGE_THICKNESS/2,-59.3);steps.add(bridge);
    steps.visible=false;group.add(steps);
  }
  scene.add(group);
  updateFloodgateFreight(group,null);
  return group;
}
export function updateFloodgateFreight(group:THREE.Group,age:number|null):void{
  // Derive every pose from the shared hydraulic front for late joiners.
  for(const c of FLOODGATE_FREIGHT){
    const fallingAge=freightFallingAge(age,c);
    const t=fallingAge===null?0:fallingAge>=FLOODGATE_TOPPLE_SECONDS-TOPPLE_TIME_EPSILON
      ?1:Math.max(0,fallingAge/FLOODGATE_TOPPLE_SECONDS);
    const ease=t*t*(3-2*t);
    const mesh=group.getObjectByName(PREFIX+c.id);
    if(mesh){
      mesh.position.set(c.x,11.5+(1.68-11.5)*ease,c.z+(-72.2-c.z)*ease);
      // In THREE a NEGATIVE X rotation raises the +Z (southern) end. The
      // former positive slope put the container opposite its stair colliders.
      mesh.rotation.x=-Math.PI/2+(Math.PI/2-Math.atan2(3.36,23))*ease;
    }
    const stairs=group.getObjectByName(PREFIX+c.id+":stairs");
    if(stairs)stairs.visible=t>=1;
  }
}
