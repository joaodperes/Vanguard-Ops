/** Geometry-focused editor warnings. These are hints, not a substitute for
 * in-game traversal and sightline testing. Pure functions shared by 2D/3D UI. */
import type { Vec3 } from "./game-protocol";
import {insideRegions,type MapBlueprint,type MapFeature} from "./map-blueprints";
import {cityBuildingBoxes,type MapProp} from "./map-visuals";

export interface StudioMapIssue {
  code:string;message:string;x:number;z:number;severity:"error"|"warning";
}
const overlap=(a:MapProp,b:MapProp,padding=2.5)=>
  Math.abs(a.x-b.x)<((a.w??20)+(b.w??20))/2+padding &&
  Math.abs(a.z-b.z)<((a.d??20)+(b.d??20))/2+padding &&
  (a.y??0)<(b.y??0)+(b.h??6)-.05 && (b.y??0)<(a.y??0)+(a.h??6)-.05;
const intersectsSpawn=(box:ReturnType<typeof cityBuildingBoxes>[number],spawn:Vec3)=>
  spawn[1]<box.pos[1]+box.size[1]+.3 && spawn[1]+1.8>box.pos[1]-box.size[1] &&
  Math.abs(spawn[0]-box.pos[0])<box.size[0]+1.3 &&
  Math.abs(spawn[2]-box.pos[2])<box.size[2]+1.3;

/** Rejects visibly invalid authored buildings BEFORE stamping them. */
export function studioBuildingPlacementIssues(
  candidate:MapProp,plan:MapBlueprint,allProps:readonly MapProp[],spawns:readonly Vec3[],
):StudioMapIssue[]{
  if(candidate.kind!=="building")return [];
  const issues:StudioMapIssue[]=[];
  const add=(code:string,message:string):void=>{issues.push({code,message,x:candidate.x,z:candidate.z,severity:"error"});};
  const w=candidate.w??20,d=candidate.d??20;
  if(!Number.isFinite(candidate.x)||!Number.isFinite(candidate.z)||w<6||d<6||(candidate.h??6)<=2)
    add("dimensions","Building position or dimensions are invalid.");
  else if(!insideRegions(candidate.x,candidate.z,plan.regions,Math.max(w,d)/2+1.5))
    add("bounds","Building would extend beyond the walkable map.");
  if(plan.regions.length>3 && Math.abs(candidate.x)<w/2+44&&Math.abs(candidate.z)<d/2+44)
    add("park","Building obstructs the central park and its paths.");
  if(allProps.some(p=>p!==candidate&&p.kind==="building"&&overlap(candidate,p)))
    add("overlap","Building overlaps another building or its access space.");
  if(spawns.some(s=>s[1]<((candidate.y??0)+(candidate.h??6))+1.5 &&
      s[1]+1.8>(candidate.y??0)-.3 &&
      Math.abs(s[0]-candidate.x)<w/2+2 &&
      Math.abs(s[2]-candidate.z)<d/2+2) ||
      cityBuildingBoxes(candidate).some(c=>spawns.some(s=>intersectsSpawn(c,s))))
    add("spawn","Building footprint, walls or stairs obstruct a spawn point.");
  const colliders=cityBuildingBoxes(candidate);
  for(const f of plan.features){
    if(f.kind==="accent")continue;
    const clearance=f.kind==="stairs"?1.5:0.4;
    if((candidate.y??0)<(f.y??0)+f.h-.05 && (f.y??0)<(candidate.y??0)+(candidate.h??6)-.05 &&
       Math.abs(candidate.x-f.x)<w/2+f.w/2+clearance&&
       Math.abs(candidate.z-f.z)<d/2+f.d/2+clearance)
      {add("feature","Building intersects authored cover, stairs or a platform.");break;}
  }
  if(candidate.roofAccess && !colliders.some(c=>c.kind==="stair"))
    add("roof","Roof access is enabled but has no physical staircase.");
  return issues;
}

function intersectsFeature(f:MapFeature,spawn:Vec3):boolean{
  const y=f.y??0;
  return f.kind!=="accent"&&f.kind!=="stairs"&&
    Math.abs(spawn[0]-f.x)<f.w/2+1 &&
    Math.abs(spawn[2]-f.z)<f.d/2+1 &&
    spawn[1]<y+f.h&&spawn[1]+1.8>y;
}

export function studioMapIssues(
  plan:MapBlueprint,props:readonly MapProp[],extraSpawns:readonly Vec3[]=[],
):StudioMapIssue[]{
  const issues:StudioMapIssue[]=[];
  const allSpawns=[...plan.spawns.ffa,...plan.spawns.red,...plan.spawns.blue,...extraSpawns];
  const authored=props.filter(p=>p.kind==="building");
  for(const p of authored){
    // These are the actual authored props, including promoted city buildings.
    // Generated structures are already filtered by the city's safe-lot grammar.
    const problems=studioBuildingPlacementIssues(p,plan,authored.filter(q=>q!==p),allSpawns);
    for(const error of problems)issues.push({...error,code:error.code+":"+p.x+":"+p.z});
  }
  for(const [team,points] of Object.entries(plan.spawns) as [string,Vec3[]][]){
    for(const [index,point] of points.entries()){
      if(!insideRegions(point[0],point[2],plan.regions,1.1))
        issues.push({code:"outside-spawn:"+team+":"+index,message:team.toUpperCase()+" spawn outside playable region",x:point[0],z:point[2],severity:"error"});
      if(plan.features.some(f=>intersectsFeature(f,point)))
        issues.push({code:"blocked-spawn:"+team+":"+index,message:team.toUpperCase()+" spawn overlaps solid cover",x:point[0],z:point[2],severity:"error"});
    }
  }
  for(const [index,f] of plan.features.entries()){
    if(!insideRegions(f.x,f.z,plan.regions,0))
      issues.push({code:"outside-feature:"+index,message:"Feature is outside the playable map",x:f.x,z:f.z,severity:"warning"});
    if(f.kind==="stairs" && !plan.features.some(p=>p.kind==="platform"&&
      Math.abs(f.x-p.x)<(f.w+p.w)/2+8&&Math.abs(f.z-p.z)<(f.d+p.d)/2+10))
      issues.push({code:"orphan-stairs:"+index,message:"Stairs have no nearby authored platform; check their landing",x:f.x,z:f.z,severity:"warning"});
  }
  for(let i=1;i<plan.regions.length;i++){
    const r=plan.regions[i];
    if(!plan.regions.some((q,j)=>i!==j&&Math.abs(q.x-r.x)<(q.w+r.w)/2-.2&&
      Math.abs(q.z-r.z)<(q.d+r.d)/2-.2))
      issues.push({code:"disconnected:"+i,message:"Region "+(i+1)+" has no overlapping connection",x:r.x,z:r.z,severity:"error"});
  }
  const colliderCount=props.filter(p=>p.kind==="building").reduce((sum,p)=>sum+cityBuildingBoxes(p).length,0);
  if(colliderCount>5500)issues.push({code:"complexity",message:"Dense city collision geometry ("+colliderCount+" boxes) may affect performance",x:0,z:0,severity:"warning"});
  return issues;
}

/** Coarse connectivity overlay between intersecting playable regions.
 * This is not a bot pathfinding trace; it visualizes district adjacency. */
export interface StudioRegionLink {
  from:number;to:number;ax:number;az:number;bx:number;bz:number;px:number;pz:number;
}
export function studioRegionLinks(plan:MapBlueprint):StudioRegionLink[]{
  const links:StudioRegionLink[]=[];
  for(let i=0;i<plan.regions.length;i++)for(let j=i+1;j<plan.regions.length;j++){
    const a=plan.regions[i],b=plan.regions[j];
    const left=Math.max(a.x-a.w/2,b.x-b.w/2);
    const right=Math.min(a.x+a.w/2,b.x+b.w/2);
    const top=Math.max(a.z-a.d/2,b.z-b.d/2);
    const bottom=Math.min(a.z+a.d/2,b.z+b.d/2);
    if(right-left<2||bottom-top<2)continue;
    links.push({from:i,to:j,ax:a.x,az:a.z,bx:b.x,bz:b.z,
      px:(left+right)/2,pz:(top+bottom)/2});
  }
  return links;
}
