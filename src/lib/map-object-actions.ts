/** Copy original map geometry into editable authored blueprint objects.
 * Deletion keeps immutable source indexes, so old overrides never drift.
 */
import type { CoverBox, EnvironmentObject } from "./game-protocol";
import type { MapFeature, MapHazard } from "./map-blueprints";
import { stairFlightBounds } from "./legacy-stair-flights";

export function legacyCoverToFeature(box:CoverBox,id:string):MapFeature {
  return {
    id,kind:box.kind==="platform"?"platform":"cover",
    x:box.pos[0]+10,z:box.pos[2],y:box.pos[1]-box.size[1],
    w:box.size[0]*2,h:box.size[1]*2,d:box.size[2]*2,
    label:"Copy of built-in "+box.kind,
    ...(box.kind==="platform"?{autoStairs:false}:{}),
  };
}

/** Legacy flight duplicates become native, automatically generated stairs.
 * We place the top tread at its corresponding landing and preserve its
 * forward/downhill direction; unlike old source stairs the copy can grow treads. */
export function legacyFlightToFeature(boxes:readonly CoverBox[],id:string):MapFeature {
  if(boxes.length<2)throw Error("Stair flight must contain at least two steps");
  const bounds=stairFlightBounds(boxes);
  const bottom=boxes[0],highest=boxes[boxes.length-1];
  const dx=bottom.pos[0]-highest.pos[0],dz=bottom.pos[2]-highest.pos[2];
  const axis: "x"|"z"=Math.abs(dx)>Math.abs(dz)?"x":"z";
  const sign=(axis==="x"?dx:dz)>=0?1:-1;
  const w=axis==="z"?bounds.w:bounds.d;
  const d=axis==="z"?bounds.d:bounds.w;
  const startAt=axis==="z"?highest.pos[2]:highest.pos[0];
  const topStepSize=highest.size[axis==="z"?2:0]*2;
  return {
    id,kind:"stairs",
    x:(axis==="x"?startAt-sign*topStepSize/2:bounds.x)+10,
    z:axis==="z"?startAt-sign*topStepSize/2:bounds.z,
    y:bounds.y-bounds.h/2,
    w:Math.max(.3,w),d:Math.max(.3,d),h:Math.max(.3,bounds.h),
    axis,sign:sign as 1|-1,label:"Copy of built-in staircase",
  };
}

export function legacyEnvironmentToHazard(obj:EnvironmentObject,id:string):MapHazard {
  const common={id,type:obj.type,x:obj.pos[0]+10,y:obj.pos[1],z:obj.pos[2],
    w:obj.size[0]*2,h:obj.size[1]*2,d:obj.size[2]*2};
  switch(obj.type){
    case "fire":return {...common,type:"fire",dps:obj.dps};
    case "spikes":return {...common,type:"spikes",damage:obj.damage,period:obj.period,
      activeFor:obj.activeFor,offset:obj.offset,warningFor:obj.warningFor,visual:obj.visual};
    case "jump_pad":return {...common,type:"jump_pad",
      launchX:obj.launch[0],launchY:obj.launch[1],launchZ:obj.launch[2]};
    case "moving_platform":return {...common,type:"moving_platform",
      toX:obj.to[0]+10,toY:obj.to[1],toZ:obj.to[2],period:obj.period};
    case "destructible_wall":return {...common,type:"destructible_wall",hp:obj.hp};
  }
}
export function toggleOriginalIndex(indices:readonly number[]|undefined,index:number,hidden:boolean):number[] {
  const current=new Set(indices??[]);
  if(hidden)current.add(index);else current.delete(index);
  return [...current].sort((a,b)=>a-b);
}
