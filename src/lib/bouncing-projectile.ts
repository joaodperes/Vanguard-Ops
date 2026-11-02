/** Deterministic, fuse-timed ordnance physics shared by client and server.
 * Geometry is the solid collision set at launch, never decorative render meshes.
 */
import type { CoverBox, Vec3 } from "./game-protocol";
import type { CoverSpatialIndex } from "./cover-spatial-index";
import type { ThrowPath } from "./throw-trajectory";

export interface ProjectileBounce { timeMs: number; point: Vec3; normal: Vec3 }
export interface TimedProjectilePath extends ThrowPath {
  /** Collision points have their actual timestamps, not uniformly spaced indices. */
  timesMs?: number[];
  bounces?: ProjectileBounce[];
}
interface SurfaceHit { distance: number; normal: Vec3; penetration?: number }
export interface BouncingProjectileRules {
  gravity: number;
  radius: number;
  fuseMs: number;
  restitution?: number;
  friction?: number;
}
const EPS=.002;
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];

/** Swept radius against a solid AABB, returning the actual struck face.
 * Inflated slabs also protect thin walls and the grenade's outside edge.
 */
function hitBox(from:Vec3,dir:Vec3,distance:number,box:CoverBox,radius:number):SurfaceHit|null {
  const lo=box.pos.map((v,i)=>v-box.size[i]-radius), hi=box.pos.map((v,i)=>v+box.size[i]+radius);
  let inside=true;
  for(let i=0;i<3;i++){
    if(from[i]<lo[i]-1e-8||from[i]>hi[i]+1e-8)inside=false;
    const to=from[i]+dir[i]*distance;
    if(Math.max(from[i],to)<lo[i]||Math.min(from[i],to)>hi[i])return null;
  }
  if(inside){
    let depth=Infinity, normal:Vec3=[0,1,0];
    for(let i=0;i<3;i++)for(const sign of [-1,1]){
      const d=sign<0?from[i]-lo[i]:hi[i]-from[i];
      if(d<depth){depth=d;normal=[0,0,0];normal[i]=sign;}
    }
    // At a face and moving away/tangent: allow the outgoing ricochet.
    if(depth<1e-7&&dot(dir,normal)>=0)return null;
    return {distance:0,normal,penetration:Math.max(0,depth)};
  }
  let enter=0,exit=distance,normal:Vec3=[0,0,0];
  for(let i=0;i<3;i++){
    if(Math.abs(dir[i])<1e-9){if(from[i]<lo[i]||from[i]>hi[i])return null;continue;}
    const a=(lo[i]-from[i])/dir[i], b=(hi[i]-from[i])/dir[i];
    const near=Math.min(a,b), far=Math.max(a,b);
    if(near>=enter){enter=near;normal=[0,0,0];normal[i]=dir[i]>0?-1:1;}
    exit=Math.min(exit,far);if(enter>exit)return null;
  }
  return enter>=0&&enter<=distance&&dot(dir,normal)<0?{distance:enter,normal}:null;
}

export function bounceVelocity(velocity:Vec3,normal:Vec3,restitution=.5,friction=.78):Vec3 {
  const incoming=dot(velocity,normal);
  if(incoming>=0)return [...velocity];
  const rebound=-incoming*restitution;
  const normalSpeed=rebound<.8?0:rebound; // settle instead of buzzing on a floor
  return velocity.map((v,i)=>(v-normal[i]*incoming)*friction+normal[i]*normalSpeed) as Vec3;
}

export function bouncingProjectilePath(origin:Vec3,launch:Vec3,cover:readonly CoverBox[],rules:BouncingProjectileRules,index?:CoverSpatialIndex):TimedProjectilePath {
  const {gravity,radius}=rules, fuseMs=Math.max(25,rules.fuseMs);
  let pos:Vec3=[origin[0],Math.max(radius+EPS,origin[1]),origin[2]], velocity:Vec3=[...launch];
  const points:Vec3[]=[[...pos]], timesMs=[0], bounces:ProjectileBounce[]=[];
  const append=(at:number)=>{
    if(Math.abs(timesMs[timesMs.length-1]-at)<1e-6){points[points.length-1]=[...pos];return;}
    points.push([...pos]);timesMs.push(at);
  };
  // Fixed 25 ms integration; each step can resolve several wall/floor contacts.
  for(let elapsed=0;elapsed<fuseMs;){
    const step=Math.min(25,fuseMs-elapsed)/1000;
    velocity[1]-=gravity*step/2;
    let remaining=step, used=0;
    for(let contact=0;remaining>1e-7&&contact<6;contact++){
      const speed=Math.hypot(...velocity);
      if(speed<1e-8)break;
      const dir=velocity.map(v=>v/speed) as Vec3, length=speed*remaining;
      let hit:SurfaceHit|null=null;
      if(dir[1]<-1e-9){
        const d=(radius-pos[1])/dir[1];
        if(d>=0&&d<=length)hit={distance:d,normal:[0,1,0]};
      }
      const candidates=index?.along(pos[0],pos[2],pos[0]+velocity[0]*remaining,pos[2]+velocity[2]*remaining,radius+EPS)??cover;
      for(const box of candidates){
        if(box.kind==="accent")continue;
        const candidate=hitBox(pos,dir,hit?.distance??length,box,radius);
        if(candidate&&(!hit||candidate.distance<hit.distance))hit=candidate;
      }
      if(!hit){pos=pos.map((v,i)=>v+velocity[i]*remaining) as Vec3;used+=remaining;remaining=0;break;}
      const travel=hit.distance/speed;
      pos=pos.map((v,i)=>v+dir[i]*hit!.distance+hit!.normal[i]*((hit!.penetration??0)+EPS)) as Vec3;
      used+=travel;remaining-=travel;
      const at=elapsed+used*1000;
      append(at);
      if(dot(velocity,hit.normal)<-.8)bounces.push({timeMs:at,point:[...pos],normal:[...hit.normal]});
      velocity=bounceVelocity(velocity,hit.normal,rules.restitution,rules.friction);
    }
    velocity[1]-=gravity*step/2;
    elapsed=Math.min(fuseMs,elapsed+step*1000);
    append(elapsed);
  }
  return {points,timesMs,bounces,impact:[...pos],flightMs:fuseMs};
}

/** Timestamp-aware interpolation keeps the rendered ricochet on its physics path.
 * Old active-volley snapshots without timestamps keep their original interpolation.
 */
export function projectilePositionAt(path:TimedProjectilePath,ageMs:number):Vec3 {
  if(path.points.length<2)return [...path.impact];
  const age=Math.max(0,Math.min(path.flightMs,ageMs));
  if(!path.timesMs||path.timesMs.length!==path.points.length){
    const t=age/path.flightMs*(path.points.length-1),i=Math.min(path.points.length-2,Math.floor(t)),f=t-i;
    return path.points[i].map((v,n)=>v+(path.points[i+1][n]-v)*f) as Vec3;
  }
  const times=path.timesMs;
  let lo=0,hi=times.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(times[mid]<=age)lo=mid;else hi=mid;}
  const f=Math.max(0,Math.min(1,(age-times[lo])/Math.max(1e-6,times[hi]-times[lo])));
  return path.points[lo].map((v,n)=>v+(path.points[hi][n]-v)*f) as Vec3;
}
