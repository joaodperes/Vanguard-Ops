/** Geometry-focused editor warnings. These are hints, not a substitute for
 * in-game traversal and sightline testing. Pure functions shared by 2D/3D UI. */
import type { Vec3,CoverBox } from "./game-protocol";
import {insideRegions,featureBoxes,featureFootprint,resolveStairAttachments,type MapBlueprint,type MapFeature} from "./map-blueprints";
import {botTraversableEdge} from "./bot-routing";
import {detectLegacyStairFlights} from "./legacy-stair-flights";
import {legacyFlightToFeature} from "./map-object-actions";
import {cityBuildingBoxes,type MapProp} from "./map-visuals";

export interface StudioMapIssue {
  code:string;message:string;x:number;z:number;severity:"error"|"warning";
  featureId?:string;relatedFeatureId?:string;canJoin?:boolean;
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
    const footprint=featureFootprint(f);
    if((candidate.y??0)<(f.y??0)+f.h-.05 && (f.y??0)<(candidate.y??0)+(candidate.h??6)-.05 &&
       Math.abs(candidate.x-footprint.x)<w/2+footprint.w/2+clearance&&
       Math.abs(candidate.z-footprint.z)<d/2+footprint.d/2+clearance)
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
  plan:MapBlueprint,props:readonly MapProp[],extraSpawns:readonly Vec3[]=[],inherited:readonly CoverBox[]=[],
):StudioMapIssue[]{
  plan={...plan,features:resolveStairAttachments(plan.features)};
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
    if(f.kind==="stairs"){
      const fp=featureFootprint(f);
      if([-1,1].some(x=>[-1,1].some(z=>!insideRegions(fp.x+x*fp.w/2,fp.z+z*fp.d/2,plan.regions))))
        issues.push({code:"outside-stair-approach:"+f.id,message:"Part of the stair approach leaves playable ground.",x:fp.x,z:fp.z,severity:"error",featureId:f.id});
    }
  }
  issues.push(...studioConnectionIssues(plan.features,inherited));
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

/** Measure contacts and traverse the actual compiled boxes, including headroom. */
export function studioConnectionIssues(source:readonly MapFeature[],inherited:readonly CoverBox[]=[]):StudioMapIssue[]{
  const features=resolveStairAttachments(source),issues:StudioMapIssue[]=[];
  const legacyFlights=detectLegacyStairFlights(inherited).map(f=>legacyFlightToFeature(f.indices.map(i=>inherited[i]),"inherited_stairs_"+f.start));
  const legacyIds=new Set(legacyFlights.map(f=>f.id));
  const platforms=[...features.filter(f=>f.kind==="platform"),...inherited.filter(b=>b.kind!=="stair"&&b.kind!=="accent").map((b,i)=>({
    id:"inherited_"+i,kind:"platform" as const,x:b.pos[0],z:b.pos[2],w:b.size[0]*2,d:b.size[2]*2,h:b.size[1]*2,y:b.pos[1]-b.size[1]}))];
  const boxes=[...inherited,...features.flatMap(featureBoxes)];
  for(const f of [...features,...legacyFlights]){
    if(f.kind!=="stairs")continue;
    const add=(code:string,message:string,severity:"warning"|"error"="error")=>issues.push({code:code+":"+f.id,
      message:(legacyIds.has(f.id)?"Inherited stairs: ":"")+message,x:f.x,z:f.z,severity,featureId:legacyIds.has(f.id)?undefined:f.id});
    if(f.attachment&&!features.some(p=>p.id===f.attachment!.platformId&&p.kind==="platform")){
      add("missing-platform","Connected stairs reference a missing platform. Reattach or detach them.");continue;
    }
    const axis=f.axis??"z",sign=f.sign??1,top=(f.y??0)+f.h;
    const along=axis==="z"?"z":"x",cross=axis==="z"?"x":"z",span=axis==="z"?"d":"w",width=axis==="z"?"w":"d";
    const contacts=platforms.filter(p=>Math.abs(f[along]-(p[along]+sign*p[span]/2))<=.06 &&
      Math.min(f[cross]+f.w/2,p[cross]+p[width]/2)-Math.max(f[cross]-f.w/2,p[cross]-p[width]/2)>=1.2);
    const landing=contacts.find(p=>Math.abs((p.y??0)+p.h-top)<=.06);
    if(platforms.some(p=>Math.abs(f.x-p.x)<p.w/2-.06&&Math.abs(f.z-p.z)<p.d/2-.06&&top<(p.y??0)+p.h-.06&&top>(p.y??0))){
      add("buried-stairs","Stair landing is inside a platform below its top surface.");continue;
    }
    if(!landing){
      if(contacts.length)add("landing-height","Stair landing height differs from the platform top by "+Math.min(...contacts.map(p=>Math.abs((p.y??0)+p.h-top))).toFixed(2)+"u.");
      else add("orphan-stairs","Stair landing does not meet a platform edge. Attach it to a platform.","warning");
      continue;
    }
    const treads=featureBoxes(f),last=treads[treads.length-1];
    const into:{x:number;z:number}={x:f.x,z:f.z};into[along]-=sign*.9;
    const reached=botTraversableEdge([last.pos[0],top,last.pos[2]],into.x,into.z,boxes);
    const toe:{x:number;z:number}={x:f.x,z:f.z};toe[along]+=sign*(f.d+.8);
    const climb=botTraversableEdge([toe.x,f.y??0,toe.z],into.x,into.z,boxes);
    if(reached===null||Math.abs(reached-top)>.1||climb===null||Math.abs(climb-top)>.1)
      add("blocked-stairs","Stair route or landing is blocked, lacks headroom, or exceeds the shared traversal rules.");
  }
  const walls=features.filter(f=>f.kind==="cover");
  for(let i=0;i<walls.length;i++)for(let j=i+1;j<walls.length;j++){
    const a=walls[i],b=walls[j];
    if((a.y??0)>= (b.y??0)+b.h-.05||(b.y??0)>=(a.y??0)+a.h-.05)continue;
    for(const axis of ["x","z"] as const){
      const cross=axis==="x"?"z":"x",size=axis==="x"?"w":"d",other=axis==="x"?"d":"w";
      const overlap=(a[other]+b[other])/2-Math.abs(a[cross]-b[cross]);
      const gap=Math.abs(a[axis]-b[axis])-(a[size]+b[size])/2;
      if(overlap>.1&&gap>.0001&&gap<=.25)issues.push({code:"wall-gap:"+a.id+":"+b.id,
        message:"Wall faces fall short by "+gap.toFixed(3)+"u.",x:(a.x+b.x)/2,z:(a.z+b.z)/2,
        severity:"warning",featureId:a.id,relatedFeatureId:b.id,canJoin:true});
    }
  }
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
