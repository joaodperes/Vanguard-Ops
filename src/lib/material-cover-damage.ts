/**
 * Per-match ballistic-cover integrity. The server owns multiplayer damage;
 * offline play uses the same rules, and clients mirror only confirmed events.
 * Geometry stays intact for the bullet which finally breaks it (no free
 * through-wall hit on the destroying shot).
 */
import type { CoverBox, MapDef, MaterialCoverImpact, Vec3 } from "./game-protocol";
import { traceCoverPenetration, type BallisticMaterial } from "./cover-penetration";

const BREAKABLE: Partial<Record<BallisticMaterial, { hp: number; damage: number }>> = {
  glass: { hp: 45, damage: 1.7 },
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
  const struck: { id: string; material: BallisticMaterial; at: number }[] = [];
  for (const crossed of trace.crossings)
    if (crossed.coverId) struck.push({ id: crossed.coverId, material: crossed.material, at: crossed.entry });
  if (trace.blockedBox?.ballisticId && trace.blockedAt < range)
    struck.push({ id: trace.blockedBox.ballisticId,
      material: trace.blockedBox.material ?? "concrete", at: trace.blockedAt });
  const result: MaterialCoverImpact[] = [];
  const processed = new Set<string>();
  for (const hit of struck) {
    if (hit.at > stopAt + 1e-4 || processed.has(hit.id) || destroyed.has(hit.id)) continue;
    processed.add(hit.id);
    if (hit.material !== "sheet_metal" && !BREAKABLE[hit.material]) continue;
    const rule = BREAKABLE[hit.material];
    const remaining = rule
      ? Math.max(0, (hp.get(hit.id) ?? rule.hp) - bulletDamage * rule.damage)
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

/** Published and editor-authored material cover is always keyed by feature ID. */
export function authoredBallisticCover(boxes: readonly CoverBox[]): CoverBox[] {
  return boxes.filter(b => b.kind === "cover" && !!b.ballisticId &&
    (b.material === "glass" || b.material === "thin_wood" ||
     b.material === "light_cover" || b.material === "sheet_metal"));
}
