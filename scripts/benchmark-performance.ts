/** Deterministic CPU/scene-structure benchmark. Run with bun run perf:benchmark.
 * These numbers are not GPU timings or an FPS prediction. */
import * as THREE from "three";
import {MAPS,type MapId,type C2S} from "../src/lib/game-protocol";
import {makeEnvironmentMap} from "../src/lib/dynamic-environment";
import {botGroundHeight} from "../src/lib/bot-physics";
import {mapCoverIndex} from "../src/lib/map-cover-index";
import {batchStaticMapMeshes} from "../src/lib/static-prop-batching";
import {MovementSendBudget} from "../src/lib/movement-send-budget";

function time(fn:()=>number){
  fn(); // Warm the JIT and caches before the five measured query batches.
  const samples:number[]=[];let checksum=0;
  for(let run=0;run<5;run++){
    const start=performance.now();checksum=fn();samples.push(performance.now()-start);
  }
  samples.sort((a,b)=>a-b);
  return {medianMs:Number(samples[2].toFixed(3)),checksum};
}

const maps:{mapId:MapId;coverBoxes:number;averageLocalCandidates:number;
  fullCollision1000:number;indexedCollision1000:number;primitiveMeshesBefore:number;primitiveMeshesAfter:number}[]=[];
for(const id of ["emberhold","floodgate","arena_neon","forest_warfare"] as MapId[]){
  const map=makeEnvironmentMap(MAPS[id]),index=mapCoverIndex(map);
  const points=Array.from({length:1000},(_,i)=>{
    const spawn=map.spawns.ffa[i%map.spawns.ffa.length];
    return [spawn[0]+Math.sin(i*2.399)*2,spawn[1],spawn[2]+Math.cos(i*2.399)*2] as const;
  });
  const full=time(()=>points.reduce((total,p)=>total+botGroundHeight(map.cover,p[0],p[2],p[1]),0));
  const local=time(()=>points.reduce((total,p)=>total+botGroundHeight(index.near(p[0],p[2],3),p[0],p[2],p[1]),0));
  if(Math.abs(full.checksum-local.checksum)>1e-7)throw new Error(id+": collision mismatch");
  const averageCandidates=points.reduce((total,p)=>total+index.near(p[0],p[2],3).length,0)/points.length;
  // Isolate the primitive batching operation from textures, props and the GPU.
  const scene=new THREE.Scene(),material=new THREE.MeshStandardMaterial(),meshes:THREE.Mesh[]=[];
  for(const box of map.cover){
    if(box.environmentId||box.ballisticId)continue;
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(...box.size.map(v=>v*2) as [number,number,number]),material);
    mesh.position.set(...box.pos);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);meshes.push(mesh);
  }
  const saved=batchStaticMapMeshes(scene,meshes);
  maps.push({mapId:id,coverBoxes:map.cover.length,averageLocalCandidates:Number(averageCandidates.toFixed(1)),
    fullCollision1000:full.medianMs,indexedCollision1000:local.medianMs,
    primitiveMeshesBefore:meshes.length,primitiveMeshesAfter:meshes.length-saved});
  const geometries=new Set(meshes.map(mesh=>mesh.geometry));
  scene.traverse(node=>{if(node instanceof THREE.Mesh)geometries.add(node.geometry);});
  for(const geometry of geometries)geometry.dispose();material.dispose();
}

const packets:{renderFps:number;oldMovementPackets10s:number;movementPackets10s:number}[]=[];
for(const fps of [60,144,240]){
  const budget=new MovementSendBudget();let sent=0;
  const state:Extract<C2S,{t:"state"}>={t:"state",pos:[0,0,0],yaw:0,pitch:0,
    aiming:false,firing:false,reloading:false,alive:true,sprinting:false};
  for(let frame=0;frame<fps*10;frame++){
    state.pos[0]=frame/fps;
    if(budget.shouldSend(frame/fps*1000,state))sent++;
  }
  packets.push({renderFps:fps,oldMovementPackets10s:fps*10,movementPackets10s:sent});
}
console.log(JSON.stringify({note:"CPU collision batches and primitive scene counts; not FPS measurements",maps,packets},null,2));
