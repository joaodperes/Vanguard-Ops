/**
 * Shared hitscan cover-penetration rules for the offline FPS and online server.
 * Penetrability is explicit on a collider, NOT inferred from its texture or kind.
 * Untagged geometry, concrete, reinforced walls and destructible barriers stop rounds.
 */
import type { CoverBox, Vec3 } from "./game-protocol";
import { type BodyPenetration, type BodyRayContact, type PenetratingBodyHit } from "./body-penetration";

export const BALLISTIC_MATERIALS = ["concrete", "reinforced", "thin_wood", "sheet_metal", "glass", "light_cover"] as const;
export type BallisticMaterial = typeof BALLISTIC_MATERIALS[number];

const SOFT: Partial<Record<BallisticMaterial, { resistance: number; retention: number }>> = {
  glass:       { resistance: 0.22, retention: 0.87 },
  thin_wood:   { resistance: 0.72, retention: 0.72 },
  light_cover: { resistance: 0.58, retention: 0.70 },
  sheet_metal: { resistance: 1.42, retention: 0.60 },
};
export const MAX_PENETRATED_SURFACES = 2;
const EPS = 1e-5;

export interface CoverCrossing {
  entry: number;
  exit: number;
  material: BallisticMaterial;
  /** Stable authored feature ID for damage and network replication. */
  coverId?: string;
  damageRetention: number;
}
export interface CoverPenetrationTrace {
  blockedAt: number;
  /** Object hit at blockedAt, including a thin panel the shot cannot pierce. */
  blockedBox?: CoverBox;
  crossings: CoverCrossing[];
}

/** Three-axis slab test, preserving BOTH faces for oblique/thickness costs. */
function boxInterval(origin: Vec3, direction: Vec3, box: CoverBox): {entry:number;exit:number}|null {
  let entry=-Infinity, exit=Infinity;
  for(let axis=0;axis<3;axis++){
    const delta=origin[axis]-box.pos[axis], half=box.size[axis], d=direction[axis];
    if(!Number.isFinite(delta)||!Number.isFinite(half)||half<=0||!Number.isFinite(d))return null;
    if(Math.abs(d)<1e-9){if(Math.abs(delta)>half)return null;continue;}
    const near=(-half-delta)/d,far=(half-delta)/d;
    entry=Math.max(entry,Math.min(near,far));
    exit=Math.min(exit,Math.max(near,far));
    if(exit<entry)return null;
  }
  return exit>EPS?{entry,exit}:null;
}

/** Calculate materials crossed before the first indestructible/too-thick barrier. */
export function traceCoverPenetration(
  boxes:readonly CoverBox[],origin:Vec3,direction:Vec3,maxDistance:number,penetrationPower=0,
):CoverPenetrationTrace {
  const intersections:{box:CoverBox;entry:number;exit:number}[]=[];
  for(const box of boxes){
    const hit=boxInterval(origin,direction,box);
    if(hit&&hit.entry<maxDistance&&hit.exit>0)intersections.push({box,...hit});
  }
  intersections.sort((a,b)=>a.entry-b.entry||a.exit-b.exit);
  const crossings:CoverCrossing[]=[];
  let power=Number.isFinite(penetrationPower)?Math.max(0,penetrationPower):0;
  for(const hit of intersections){
    const entry=Math.max(0,hit.entry);
    const material=hit.box.material??"concrete";
    const settings=hit.box.kind==="cover"&&!hit.box.environmentId?SOFT[material]:undefined;
    const depth=hit.exit-entry;
    if(hit.entry < -EPS || !settings || crossings.length>=MAX_PENETRATED_SURFACES ||
       hit.exit>maxDistance+EPS || power+EPS<depth*settings.resistance)
      return {blockedAt:entry,blockedBox:hit.box,crossings};
    const cost=depth*settings.resistance;
    power-=cost;
    crossings.push({entry,exit:hit.exit,material,coverId:hit.box.ballisticId,
      damageRetention:settings.retention*Math.max(0.55,1-0.08*cost)});
  }
  return {blockedAt:Infinity,crossings};
}

export function coverDamageScaleAt(trace:CoverPenetrationTrace,distance:number):number {
  if(distance>=trace.blockedAt-EPS)return 0;
  let multiplier=1;
  for(const crossing of trace.crossings){
    if(distance>crossing.entry+EPS&&distance<crossing.exit-EPS)return 0;
    if(distance>=crossing.exit-EPS)multiplier*=crossing.damageRetention;
  }
  return multiplier;
}

/**
 * A conventional round has ONE initial penetration-energy budget. Traversing a
 * thin panel or passing through a body spends that same budget, in ray order.
 * The resulting damage multiplier independently falls for each material/body.
 * This gives ordinary weapons some material penetration while leaving hard
 * structure, shields and protected players fully protective.
 */
export const BODY_PENETRATION_ENERGY_COST = 1.15;
export const MAX_PENETRATED_BODIES = 3;

export interface UnifiedPenetrationResult<T> {
  hits: PenetratingBodyHit<T>[];
  /** First absorbing surface/body, used to prevent impacts beyond that point. */
  stoppedAt: number;
}

export function resolveMaterialPenetrationShot<T>(
  contacts:readonly BodyRayContact<T>[],boxes:readonly CoverBox[],
  origin:Vec3,direction:Vec3,maxDistance:number,
  bodyProfile?:BodyPenetration,penetrationPower=0,
): UnifiedPenetrationResult<T> {
  const energyStart=Number.isFinite(penetrationPower)?Math.max(0,penetrationPower):0;
  let energy=energyStart;
  const bodyLimit=Math.max(1,Math.min(MAX_PENETRATED_BODIES,
    bodyProfile?.maxTargets??(energyStart>=3.4?3:energyStart>=BODY_PENETRATION_ENERGY_COST?2:1)));
  const bodyRetention=bodyProfile
    ? Math.max(0,Math.min(1,bodyProfile.damageRetention))
    : Math.min(.65,Math.max(.3,.29+energyStart*.09));
  type CoverEvent={type:"cover";entry:number;exit:number;box:CoverBox};
  type BodyEvent={type:"body";entry:number;contact:BodyRayContact<T>};
  const covers:CoverEvent[]=boxes.flatMap(box=>{
    const interval=boxInterval(origin,direction,box);
    return interval&&interval.entry<maxDistance&&interval.exit>0
      ?[{type:"cover" as const,entry:interval.entry,exit:interval.exit,box}]:[];
  });
  const bodies:BodyEvent[]=contacts.filter(c=>Number.isFinite(c.t)&&c.t>=0&&c.t<=maxDistance)
    .map(contact=>({type:"body" as const,entry:contact.t,contact}));
  const events:(CoverEvent|BodyEvent)[]=[...covers,...bodies];
  events.sort((a,b)=>a.entry-b.entry || (a.type==="cover"?-1:1));
  const hits:PenetratingBodyHit<T>[]=[];
  let coverCount=0,damageScale=1,stoppedAt=Infinity;
  for(const event of events){
    const at=Math.max(0,event.entry);
    if(at>maxDistance)break;
    if(event.type==="cover"){
      const material=event.box.material??"concrete";
      const properties=event.box.kind==="cover"&&!event.box.environmentId?SOFT[material]:undefined;
      const depth=event.exit-at;
      const cost=properties?depth*properties.resistance:Infinity;
      if(event.entry < -EPS||!properties||
          coverCount>=MAX_PENETRATED_SURFACES||event.exit>maxDistance+EPS||energy+EPS<cost){
        stoppedAt=at;
        break;
      }
      energy-=cost;
      damageScale*=properties.retention*Math.max(.55,1-.08*cost);
      coverCount++;
      continue;
    }
    // A contact embedded inside solid cover is not a valid body hit.
    if(covers.some(c=>c.entry+EPS<event.entry && c.exit>event.entry+EPS))continue;
    const body=event.contact;
    hits.push({...body,damageScale});
    if(body.shield||body.protected||hits.length>=bodyLimit||
       energy+EPS<BODY_PENETRATION_ENERGY_COST){
      stoppedAt=at;
      break;
    }
    energy-=BODY_PENETRATION_ENERGY_COST;
    damageScale*=bodyRetention;
  }
  return {hits,stoppedAt};
}

/** Return only the body contacts; all callers share one energy calculation. */
export function selectMaterialPenetrationHits<T>(
  contacts:readonly BodyRayContact<T>[],boxes:readonly CoverBox[],
  origin:Vec3,direction:Vec3,maxDistance:number,
  bodyProfile?:BodyPenetration,coverPower=0,
):PenetratingBodyHit<T>[] {
  return resolveMaterialPenetrationShot(contacts,boxes,origin,direction,maxDistance,
    bodyProfile,coverPower).hits;
}
