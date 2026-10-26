/** Shared deterministic geometry for the four new Wonder mechanics. */
export type V3 = readonly [number,number,number];
export interface WonderCandidate {id:string;pos:V3;alive:boolean;team:string;protected?:boolean}
export const distance=(a:V3,b:V3)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
export function aimProjection(origin:V3,dir:V3,target:V3){
 const dx=target[0]-origin[0],dy=target[1]-origin[1],dz=target[2]-origin[2];
 const length=Math.hypot(dx,dy,dz)||1,mag=Math.hypot(...dir)||1;
 const forward=(dx*dir[0]+dy*dir[1]+dz*dir[2])/mag;
 return {forward,cosine:forward/length,offset:Math.sqrt(Math.max(0,length*length-forward*forward))};
}
/** Only the most central valid exposed enemy can be smart-tagged. */
export function selectSmartTarget(origin:V3,dir:V3,candidates:WonderCandidate[],team:string,ffa:boolean,range:number,canSee:(p:V3)=>boolean):WonderCandidate|null{
 let best:WonderCandidate|null=null,score=Infinity;
 for(const c of candidates){
  if(!c.alive||c.protected||(!ffa&&c.team===team))continue;
  const target:V3=[c.pos[0],c.pos[1]+1.05,c.pos[2]];
  const aim=aimProjection(origin,dir,target),dist=distance(origin,target);
  if(aim.forward<=0||dist>range||aim.cosine<0.966||!canSee(target))continue;
  const rank=(1-aim.cosine)*50+dist*.003;
  if(rank<score){best=c;score=rank;}
 }
 return best;
}
/** Flame blooms radially outward from a short-range emitter. */
export function inFlameCone(origin:V3,dir:V3,target:V3,range=14):boolean{
 const aim=aimProjection(origin,dir,target);
 return aim.forward>0&&aim.forward<=range&&aim.offset<=0.8+aim.forward*.245;
}
/** Electrical current follows the connecting segment between two anchors. */
export function nearStormLink(a:V3,b:V3,pos:V3,radius=1.4):boolean{
 const dx=b[0]-a[0],dz=b[2]-a[2];
 const t=Math.max(0,Math.min(1,((pos[0]-a[0])*dx+(pos[2]-a[2])*dz)/(dx*dx+dz*dz||1)));
 return Math.hypot(pos[0]-(a[0]+t*dx),pos[2]-(a[2]+t*dz))<=radius;
}
/** Sludge imposes one clear 54% reduction, not a multiplicative stack. */
export function sludgeMovementFactor(pos:V3,team:string,now:number,pools:readonly {pos:V3;radius:number;ownerTeam:string;expiresAt:number;kind:string}[],ffa=false){
 return pools.some(p=>p.kind==="sludge"&&p.expiresAt>now&&(ffa||p.ownerTeam!==team)&&Math.hypot(pos[0]-p.pos[0],pos[2]-p.pos[2])<=p.radius)?0.46:1;
}

/** Deadlock stores up to three persistent exposed target tags per owner. */
export const SMART_MAX_TAGS = 3;
export const SMART_TAG_MS = 4500;
export function selectSmartTargets(
  origin:V3,dir:V3,candidates:WonderCandidate[],team:string,ffa:boolean,
  range:number,canSee:(p:V3)=>boolean,limit=SMART_MAX_TAGS,
):WonderCandidate[]{
  return candidates.filter(c=>{
    if(!c.alive||c.protected||(!ffa&&c.team===team))return false;
    const target:V3=[c.pos[0],c.pos[1]+1.05,c.pos[2]];
    const aim=aimProjection(origin,dir,target);
    return aim.forward>0&&distance(origin,target)<=range&&aim.cosine>=.952&&canSee(target);
  }).sort((a,b)=>{
    const aa=aimProjection(origin,dir,[a.pos[0],a.pos[1]+1.05,a.pos[2]]);
    const bb=aimProjection(origin,dir,[b.pos[0],b.pos[1]+1.05,b.pos[2]]);
    return (1-aa.cosine)*50+distance(origin,a.pos)*.003-
      ((1-bb.cosine)*50+distance(origin,b.pos)*.003);
  }).slice(0,Math.max(0,limit));
}
export const HELLFIRE_BURST_MS = 3000;
export const HELLFIRE_TICK_MS = 125;
export const HELLFIRE_RANGE = 11;
export function hellfireRemainingMs(until:number,now:number):number {
  return Math.max(0,until-now);
}
