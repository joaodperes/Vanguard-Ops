/** Author original collision stair flights as a single logical Map Studio object.
 * The map runtime still uses individual stair tread boxes for physics.
 * The input order and indices are stable before authored spatial overrides.
 */
import type { CoverBox } from "./game-protocol";

export interface LegacyStairFlight { start:number; indices:number[] }
export interface FlightBounds { x:number; y:number; z:number; w:number; h:number; d:number }
export interface FlightTransform extends FlightBounds { turns?:number }

const top=(b:CoverBox)=>b.pos[1]+b.size[1];
/** Source stairs are emitted bottom-to-top. A reset in height, a direction
 * change or a large horizontal discontinuity starts the next logical flight.
 * Non-stair boxes always terminate the current flight. */
export function detectLegacyStairFlights(boxes:readonly CoverBox[]):LegacyStairFlight[]{
  const flights:LegacyStairFlight[]=[];
  let current:number[]=[];
  const finish=()=>{
    if(current.length>=2)flights.push({start:current[0],indices:[...current]});
    current=[];
  };
  for(let i=0;i<boxes.length;i++){
    const b=boxes[i];
    if(b.kind!=="stair"){finish();continue;}
    if(current.length){
      const previous=boxes[current[current.length-1]];
      const prevTop=top(previous);
      const dy=top(b)-prevTop;
      const dx=b.pos[0]-previous.pos[0],dz=b.pos[2]-previous.pos[2];
      const stride=Math.hypot(dx,dz);
      const maxStride=Math.max(previous.size[0]+b.size[0],previous.size[2]+b.size[2])*2+.6;
      // An increasing flight may have tiny floating point differences, but
      // can never jump backwards or skip meters between successive steps.
      if(dy<=.025 || dy>.8 || stride>maxStride)finish();
    }
    current.push(i);
  }
  finish();
  return flights;
}

/** Group-space envelope of full collision extents. */
export function stairFlightBounds(boxes:readonly CoverBox[]):FlightBounds {
  if(!boxes.length)return {x:0,y:0,z:0,w:1,h:1,d:1};
  const low:[number,number,number]=[Infinity,Infinity,Infinity];
  const high:[number,number,number]=[-Infinity,-Infinity,-Infinity];
  for(const b of boxes)for(let axis=0;axis<3;axis++){
    low[axis]=Math.min(low[axis],b.pos[axis]-b.size[axis]);
    high[axis]=Math.max(high[axis],b.pos[axis]+b.size[axis]);
  }
  return {x:(low[0]+high[0])/2,y:(low[1]+high[1])/2,z:(low[2]+high[2])/2,
    w:high[0]-low[0],h:high[1]-low[1],d:high[2]-low[2]};
}

/** Compute per-tread overrides for moving/resizing/quarter-turning a flight.
 * Read original/current effective boxes BEFORE applying the batch.
 * This transforms the entire staircase, not one tread at a time. */
export function transformStairFlight(
  boxes:readonly CoverBox[],indices:readonly number[],target:FlightTransform,
):Record<string,FlightBounds>{
  const originals=indices.map(i=>boxes[i]).filter((b):b is CoverBox=>!!b&&b.kind==="stair");
  if(!originals.length)return {};
  const from=stairFlightBounds(originals);
  const turns=((target.turns??0)%4+4)%4;
  const swapped=turns%2===1;
  const sx=(swapped?target.d:target.w)/Math.max(.001,from.w);
  const sy=target.h/Math.max(.001,from.h);
  const sz=(swapped?target.w:target.d)/Math.max(.001,from.d);
  const cosine=[1,0,-1,0][turns],sine=[0,1,0,-1][turns];
  const updates:Record<string,FlightBounds>={};
  for(const index of indices){
    const b=boxes[index];
    if(!b || b.kind!=="stair")continue;
    const dx=(b.pos[0]-from.x)*sx,dz=(b.pos[2]-from.z)*sz;
    const x=target.x+cosine*dx+sine*dz;
    const z=target.z-sine*dx+cosine*dz;
    const y=target.y+(b.pos[1]-from.y)*sy;
    const w=2*(swapped?b.size[2]*sz:b.size[0]*sx);
    const d=2*(swapped?b.size[0]*sx:b.size[2]*sz);
    updates[index]={x,y,z,w,h:2*b.size[1]*sy,d};
  }
  return updates;
}

/** A legacy flight cannot gain new treads through a box override. Limit rise
 * to the safe stepping threshold; add an authored staircase for bigger climbs. */
export function maxLegacyFlightRise(stepCount:number):number {
  return stepCount*.5;
}
