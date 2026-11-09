/**
 * Per-match ballistic-cover integrity. The server owns multiplayer damage;
 * offline play uses the same rules, and clients mirror only confirmed events.
 * Geometry stays intact for the bullet which finally breaks it (no free
 * through-wall hit on the destroying shot).
 */
import type { CoverBox, MapDef, MaterialCoverImpact, Vec3 } from "./game-protocol";
import { traceCoverPenetration, type BallisticMaterial } from "./cover-penetration";

const BREAKABLE: Partial<Record<BallisticMaterial, { hp: number; damage: number }>> = {
  glass: { hp: 75, damage: 1.3 },
  thin_wood: { hp: 115, damage: 1 },
  light_cover: { hp: 140, damage: .85 },
};

export function coverMaxIntegrity(material: BallisticMaterial | undefined): number | null {
  return material ? (BREAKABLE[material]?.hp ?? null) : null;
}

/** In-place removal invalidates collision/line-of-sight for EVERY game system. */
export function removeBrokenBallisticCover(map: MapDef, id: string): boolean {
  const index = map.cover.findIndex(box => box.ballisticId === id);
  if (index < 0) return false;
  map.cover = map.cover.filter(box => box.ballisticId !== id);
  return true;
}

export function applyConfirmedCoverImpact(
  map: MapDef, hp: Map<string, number>, destroyed: Set<string>, impact: MaterialCoverImpact,
): boolean {
  if (destroyed.has(impact.coverId)) return false;
  if (impact.hp !== null) hp.set(impact.coverId, impact.hp);
  if (!impact.destroyed) return false;
  destroyed.add(impact.coverId);
  removeBrokenBallisticCover(map, impact.coverId);
  return true;
}

/** A late joiner receives a complete state, not just transient impact packets. */
export function reconcileBallisticCover(
  map: MapDef, hp: Map<string, number>, destroyed: Set<string>,
  canonicalDestroyed: readonly string[], canonicalHp: Readonly<Record<string, number>>,
): string[] {
  for (const [id, value] of Object.entries(canonicalHp))
    if (Number.isFinite(value)) hp.set(id, Math.max(0, value));
  const newlyDestroyed: string[] = [];
  for (const id of canonicalDestroyed) {
    if (destroyed.has(id)) continue;
    destroyed.add(id);
    hp.set(id, 0);
    if (removeBrokenBallisticCover(map, id)) newlyDestroyed.push(id);
  }
  return newlyDestroyed;
}

/** Apply the impact AFTER combatant hit resolution for the same bullet.
 * stopAt optionally prevents marking cover behind the first absorbing body. */
export function damageBallisticCoverOnShot(
  map: MapDef, hp: Map<string, number>, destroyed: Set<string>,
  origin: Vec3, direction: Vec3, range: number, penetrationPower: number,
  bulletDamage: number, stopAt = Infinity,
): MaterialCoverImpact[] {
  if (!(bulletDamage > 0) || !Number.isFinite(bulletDamage)) return [];
  const trace = traceCoverPenetration(map.cover, origin, direction, range, penetrationPower);
  const struck: { id: string; material: BallisticMaterial; at: number; retained: number }[] = [];
  let retained=1;
  for (const crossed of trace.crossings){
    if (crossed.coverId) struck.push({id:crossed.coverId,material:crossed.material,
      at:crossed.entry,retained});
    retained*=crossed.damageRetention;
  }
  if (trace.blockedBox?.ballisticId && trace.blockedBox.kind==="cover" &&
      !trace.blockedBox.environmentId && trace.blockedAt < range)
    struck.push({ id: trace.blockedBox.ballisticId,
      material: trace.blockedBox.material ?? "concrete", at: trace.blockedAt,retained });
  const result: MaterialCoverImpact[] = [];
  const processed = new Set<string>();
  for (const hit of struck) {
    if (hit.at > stopAt + 1e-4 || processed.has(hit.id) || destroyed.has(hit.id)) continue;
    processed.add(hit.id);
    if (hit.material !== "sheet_metal" && !BREAKABLE[hit.material]) continue;
    const rule = BREAKABLE[hit.material];
    const remaining = rule
      ? Math.max(0, (hp.get(hit.id) ?? rule.hp) - bulletDamage * rule.damage * hit.retained)
      : null;
    const impact: MaterialCoverImpact = {
      coverId: hit.id, material: hit.material,
      point: [origin[0] + direction[0] * hit.at,
        origin[1] + direction[1] * hit.at,
        origin[2] + direction[2] * hit.at],
      hp: remaining, destroyed: remaining !== null && remaining <= 0,
    };
    // All intersections for this bullet came from the PRE-destruction geometry.
    // Apply after collecting, so a breaking bullet is never allowed through.
    result.push(impact);
  }
  for (const event of result) applyConfirmedCoverImpact(map, hp, destroyed, event);
  return result;
}


/** Material resistance to a blast is deliberately independent from player TTK.
 * RL-7 and frags are panel breakers at close range; Swarm's micro-rockets
 * instead chip away at integrity over several hits. A frag's material-breaking
 * radius is tighter than its player-damage/fragmentation radius.
 */
export function materialCoverBlastProfile(
  sourceId: string, damage: number, radius: number,
): {damage: number; radius: number} {
  switch(sourceId){
    case "frag":
      return {damage:damage*1.4,radius:Math.min(radius,6)};
    case "launcher_rocket":
      return {damage:damage*1.3,radius};
    case "launcher_breach":
      return {damage:damage*1.1,radius};
    case "launcher_swarm":
      return {damage,radius:Math.min(radius,8)};
    case "mine":
      return {damage:damage*.8,radius};
    case "perk_explonando":
      return {damage:damage*.95,radius};
    default:
      return {damage,radius};
  }
}

/** Resolve a blast against the nearest face of each breakable panel.
 * All contacts use pre-explosion geometry; structural objects and sheet metal
 * block pressure, but thin destructible panels do not. Both client (offline)
 * and server use this one HP model, including partial impacts.
 */
export function damageBallisticCoverFromExplosion(
  map: MapDef, hp: Map<string,number>, destroyed: Set<string>,
  origin: Vec3, radius: number, peakDamage: number, sourceId = "",
): MaterialCoverImpact[] {
  if(!Number.isFinite(radius)||radius<=0||!Number.isFinite(peakDamage)||peakDamage<=0)return [];
  const blast=materialCoverBlastProfile(sourceId,peakDamage,radius);
  const cover=[...map.cover];
  const multipliers:Partial<Record<BallisticMaterial,number>>={
    glass:1.6,thin_wood:1.15,light_cover:.9,
  };
  const blocked=(target:CoverBox,point:Vec3):boolean=>{
    const delta:Vec3=[point[0]-origin[0],point[1]-origin[1],point[2]-origin[2]];
    if(Math.hypot(...delta)<1e-6)return false;
    return cover.some(box=>{
      if(box===target||box.kind==="accent")return false;
      // Fragile, breakable panels pass the shockwave; hard cover does not.
      if(box.kind==="cover"&&!box.environmentId&&coverMaxIntegrity(box.material)!==null)return false;
      let entry=0,exit=1;
      for(let axis=0;axis<3;axis++){
        const lo=box.pos[axis]-box.size[axis],hi=box.pos[axis]+box.size[axis];
        if(Math.abs(delta[axis])<1e-8){
          if(origin[axis]<lo||origin[axis]>hi)return false;
          continue;
        }
        const a=(lo-origin[axis])/delta[axis],b=(hi-origin[axis])/delta[axis];
        entry=Math.max(entry,Math.min(a,b));
        exit=Math.min(exit,Math.max(a,b));
        if(entry>exit)return false;
      }
      return exit>1e-4&&entry<1-1e-4;
    });
  };
  const impacts:MaterialCoverImpact[]=[];
  for(const box of cover){
    const material=box.material,id=box.ballisticId;
    if(box.kind!=="cover"||!id||box.environmentId||!material||
       destroyed.has(id)||!BREAKABLE[material])continue;
    const point=box.pos.map((v,i)=>Math.max(v-box.size[i],
      Math.min(origin[i],v+box.size[i]))) as Vec3;
    const distance=Math.hypot(point[0]-origin[0],point[1]-origin[1],point[2]-origin[2]);
    if(distance>blast.radius||blocked(box,point))continue;
    const remaining=Math.max(0,(hp.get(id)??BREAKABLE[material].hp)-
      blast.damage*(multipliers[material]??1)*(1-(distance/blast.radius)**2));
    impacts.push({coverId:id,material,point,hp:remaining,destroyed:remaining<=0});
  }
  for(const impact of impacts)applyConfirmedCoverImpact(map,hp,destroyed,impact);
  return impacts;
}

/** Published and editor-authored material cover is always keyed by feature ID. */
export function authoredBallisticCover(boxes: readonly CoverBox[]): CoverBox[] {
  return boxes.filter(b => b.kind === "cover" && !!b.ballisticId &&
    (b.material === "glass" || b.material === "thin_wood" ||
     b.material === "light_cover" || b.material === "sheet_metal"));
}
