/** Geometry-only, deterministic structure snapping for 2D and 3D Map Studio.
 * Map coordinates use centered X/Z footprints and bottom elevation Y. */
export interface StudioFootprint {x:number;z:number;w:number;d:number;y?:number;h?:number}
export interface StudioSnapTarget extends StudioFootprint {
  key:string;kind:"building"|"platform"|"cover"|"stairs"|"other";
}
export interface StudioSnapResult extends StudioFootprint {
  snappedX?:number;snappedZ?:number;surface?:string;
  hints:string[];
}
export const STUDIO_STOREY_HEIGHT=5;
export const STUDIO_STRUCTURE_GAP=3;
export const STUDIO_MAGNET_RADIUS=3.25;
const finite=(n:number)=>Number.isFinite(n)&&n>0;
const gridRound=(n:number,grid:number)=>grid>0?Math.round(n/grid)*grid:n;

/** Snap adjacent faces, matching edges and centers, retaining the closest
 * candidate per axis. No invisible long-distance teleporting. */
export function snapStudioFootprint(
  candidate:StudioFootprint,targets:readonly StudioSnapTarget[],
  options:{grid?:number;smart?:boolean;surface?:boolean;ignoreKey?:string;gap?:number;radius?:number}={}
):StudioSnapResult {
  const grid=options.grid??0,smart=options.smart!==false;
  const result:StudioSnapResult={...candidate,x:gridRound(candidate.x,grid),
    z:gridRound(candidate.z,grid),hints:[]};
  if(!smart&&!options.surface)return result;
  const radius=options.radius??STUDIO_MAGNET_RADIUS,gap=options.gap??STUDIO_STRUCTURE_GAP;
  const nearby=targets.filter(t=>t.key!==options.ignoreKey&&finite(t.w)&&finite(t.d));
  if(smart)for(const axis of ["x","z"] as const){
    const cross=axis==="x"?"z":"x",size=axis==="x"?"w":"d",otherSize=axis==="x"?"d":"w";
    let best:{value:number;distance:number;priority:number;key:string}|undefined;
    for(const t of nearby){
      // Edges need to share a relevant span on the opposite axis.
      const crossRange=(candidate[otherSize]+t[otherSize])/2+radius+gap;
      if(Math.abs(result[cross]-t[cross])>crossRange)continue;
      const side=(candidate[size]+t[size])/2+gap;
      const align=[
        {value:t[axis]-side,priority:0},{value:t[axis]+side,priority:0},
        {value:t[axis],priority:2},
        {value:t[axis]-(t[size]-candidate[size])/2,priority:1},
        {value:t[axis]+(t[size]-candidate[size])/2,priority:1},
        {value:t[axis]-(t[size]+candidate[size])/2,priority:1},
        {value:t[axis]+(t[size]+candidate[size])/2,priority:1},
      ];
      for(const a of align){
        const distance=Math.abs(result[axis]-a.value);
        if(distance>radius)continue;
        if(!best||distance<best.distance-1e-6||
          (Math.abs(distance-best.distance)<1e-6&&a.priority<best.priority))
          best={value:a.value,distance,priority:a.priority,key:t.key};
      }
    }
    if(best){result[axis]=best.value;
      if(axis==="x")result.snappedX=best.value;else result.snappedZ=best.value;
      result.hints.push(axis.toUpperCase()+" aligned to "+best.key);
    }
  }
  if(options.surface){
    const support=nearby.filter(t=>(t.kind==="platform"||t.kind==="building")&&
      // A placement must fit entirely on top, not merely clip its edge.
      Math.abs(result.x-t.x)+candidate.w/2<=t.w/2+.01&&
      Math.abs(result.z-t.z)+candidate.d/2<=t.d/2+.01&&
      (t.y??0)+(t.h??0)>=0.1&&Number.isFinite(t.h??0))
      .sort((a,b)=>((b.y??0)+(b.h??0))-((a.y??0)+(a.h??0)))[0];
    if(support){
      result.y=(support.y??0)+(support.h??0);
      result.surface=support.key;
      result.hints.push("On "+support.key+" at Y "+result.y);
    }
  }
  return result;
}
/** Vertical gizmo: prefer a nearby real roof/deck, then standard storey levels.
 * Only pull within the stated radius; otherwise preserve freehand Y. */
export function snapStudioElevation(y:number,footprint:StudioFootprint,
  targets:readonly StudioSnapTarget[],radius=1.25):number{
  const candidates=[0];
  for(let floor=1;floor<=12;floor++)candidates.push(floor*STUDIO_STOREY_HEIGHT);
  for(const t of targets){
    if((t.kind==="platform"||t.kind==="building")&&
      Math.abs(footprint.x-t.x)+footprint.w/2<=t.w/2+.01&&
      Math.abs(footprint.z-t.z)+footprint.d/2<=t.d/2+.01)
      candidates.push((t.y??0)+(t.h??0));
  }
  let closest=y,distance=radius;
  for(const n of candidates){const d=Math.abs(y-n);if(d<=distance){closest=n;distance=d;}}
  return closest;
}
