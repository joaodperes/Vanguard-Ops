/**
 * Shared hitscan cover-penetration rules for the offline FPS and online server.
 * Penetrability is explicit on a collider, NOT inferred from its texture or kind.
 * Untagged geometry, concrete, reinforced walls and destructible barriers stop rounds.
 */
import type { CoverBox, Vec3 } from "./game-protocol";
import { selectBodyPenetrationHits, type BodyPenetration, type BodyRayContact, type PenetratingBodyHit } from "./body-penetration";

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

/** Maintain current body-penetration target limits and shield/spawn immunity. */
export function selectMaterialPenetrationHits<T>(
  contacts:readonly BodyRayContact<T>[],boxes:readonly CoverBox[],
  origin:Vec3,direction:Vec3,maxDistance:number,
  bodyProfile?:BodyPenetration,coverPower=0,
):PenetratingBodyHit<T>[] {
  const trace=traceCoverPenetration(boxes,origin,direction,maxDistance,coverPower);
  return selectBodyPenetrationHits(contacts,maxDistance,trace.blockedAt,bodyProfile)
    .flatMap(hit=>{
      const coverScale=coverDamageScaleAt(trace,hit.t);
      return coverScale>0?[{...hit,damageScale:hit.damageScale*coverScale}]:[];
    });
}
