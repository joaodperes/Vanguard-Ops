/** Lightweight wind-driven snow field localized to the camera.
 * Single Points mesh and reused vertex buffer; never spawns per-frame particles. */
import * as THREE from "three";
const COUNT=360;
const RANGE=55;
export function buildWhiteoutSnow(scene:THREE.Scene):THREE.Points {
  const geometry=new THREE.BufferGeometry();
  const positions=new Float32Array(COUNT*3);
  for(let i=0;i<COUNT;i++){
    // Deterministic scatter so overlapping visual states do not flicker.
    const seed=(i*9301+49297)%233280;
    positions[i*3]=(seed/233280-.5)*RANGE*2;
    positions[i*3+1]=((i*37)%163)/163*18-3;
    positions[i*3+2]=(((i*7193+2917)%17777)/17777-.5)*RANGE*2;
  }
  geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
  const material=new THREE.PointsMaterial({color:0xf0f8ff,size:.32,transparent:true,opacity:0,
    depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true});
  const snow=new THREE.Points(geometry,material);
  snow.frustumCulled=false;
  scene.add(snow);
  return snow;
}
export function updateWhiteoutSnow(snow:THREE.Points,intensity:number,seconds:number,x:number,y:number,z:number):void {
  snow.visible=intensity>.025;
  if(!snow.visible)return;
  snow.position.set(x,y,z);
  const material=snow.material as THREE.PointsMaterial;
  material.opacity=Math.min(.72,intensity*.68);
  const buffer=snow.geometry.getAttribute("position") as THREE.BufferAttribute;
  const p=buffer.array as Float32Array;
  const drift=seconds*9,fall=seconds*4.8;
  for(let i=0;i<COUNT;i++){
    const seed=(i*9301+49297)%233280;
    p[i*3]=(((seed/233280*RANGE*2+drift+i*.21)%(RANGE*2))-RANGE);
    p[i*3+1]=((((i*37)%163)/163*18-fall)%18+18)%18-3;
    p[i*3+2]=(((i*7193+2917)%17777)/17777-.5)*RANGE*2;
  }
  buffer.needsUpdate=true;
}
