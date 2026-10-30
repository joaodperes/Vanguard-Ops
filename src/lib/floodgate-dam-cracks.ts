/** Low-draw-call structural fracturing on all five linked dam faces.
 * 4 progressively visible layers, each a single reusable low-poly mesh. */
import * as THREE from "three";

export const FLOODGATE_CRACK_THRESHOLDS=[.8,.6,.4,.2] as const;
export function damCrackTier(hp:number,maxHp:number):number{
  if(!Number.isFinite(hp)||!Number.isFinite(maxHp)||maxHp<=0||hp<=0)return 0;
  return FLOODGATE_CRACK_THRESHOLDS.filter(t=>hp/maxHp<=t).length;
}
/** Mount in a destructible wall group at its front surface, just past paint. */
export function buildFloodgateDamCracks(parent:THREE.Group,halfW:number,halfH:number,frontZ:number,seed:number):void{
  for(let tier=1;tier<=4;tier++){
    const xyz:number[]=[];
    // Jagged fracture paths with deterministic branching and no allocations
    // in the per-frame update. All panels share the same damage progression.
    for(let branch=0;branch<3+tier;branch++){
      const phase=seed*.81+tier*1.73+branch*2.19;
      let x=Math.sin(phase)*halfW*.78;
      let y=Math.cos(phase*1.29)*halfH*.7;
      for(let seg=0;seg<4;seg++){
        const endX=Math.max(-halfW*.95,Math.min(halfW*.95,x+Math.cos(phase+seg*.87)*(.45+tier*.22)));
        const endY=Math.max(-halfH*.92,Math.min(halfH*.92,y+Math.sin(phase*.88+seg*1.1)*(.48+tier*.23)));
        // Fixed-width world-space strips rather than WebGL 1px lines:
        // fractures stay readable from normal rifle / DMR sight distances.
        const dx=endX-x,dy=endY-y,len=Math.hypot(dx,dy)||1;
        const halfThickness=(.10+tier*.042)/2;
        const nx=-dy/len*halfThickness,ny=dx/len*halfThickness;
        xyz.push(
          x+nx,y+ny,frontZ,x-nx,y-ny,frontZ,endX+nx,endY+ny,frontZ,
          endX+nx,endY+ny,frontZ,x-nx,y-ny,frontZ,endX-nx,endY-ny,frontZ,
        );
        x=endX;y=endY;
      }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute("position",new THREE.Float32BufferAttribute(xyz,3));
    const cracks=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({
      color:tier>=3?0x120d13:0x1d2429,depthTest:true,depthWrite:false,side:THREE.DoubleSide,
    }));
    cracks.name="floodgate-cracks-"+tier;
    cracks.userData.floodgateCrackTier=tier;
    cracks.visible=false;
    cracks.renderOrder=2;
    parent.add(cracks);
  }
}
export function updateFloodgateDamCracks(parent:THREE.Group,hp:number,maxHp:number):void{
  const level=damCrackTier(hp,maxHp);
  for(const child of parent.children){
    const tier=child.userData.floodgateCrackTier as number|undefined;
    if(tier!==undefined)child.visible=tier<=level;
  }
}
