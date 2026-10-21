/** Shared, deterministic environmental objects for offline and authoritative rooms. */
import type { CoverBox, EnvironmentObject, MapDef, Vec3 } from "./game-protocol";

export function environmentPosition(o: EnvironmentObject, seconds: number): Vec3 {
  if (o.type !== "moving_platform") return [...o.pos];
  const phase = Math.max(0, seconds) / o.period * Math.PI * 2;
  // Zero velocity at endpoints prevents a sudden jerk when changing direction.
  const t = (1 - Math.cos(phase)) * 0.5;
  return o.pos.map((v, i) => v + (o.to[i] - v) * t) as Vec3;
}

export function spikesActive(o: EnvironmentObject, seconds: number): boolean {
  if (o.type !== "spikes") return false;
  const time = ((seconds + (o.offset ?? 0)) % o.period + o.period) % o.period;
  return time < o.activeFor;
}

export function withinEnvironment(o: EnvironmentObject, feet: Vec3, radius = 0.45): boolean {
  return Math.abs(feet[0] - o.pos[0]) < o.size[0] + radius &&
    Math.abs(feet[2] - o.pos[2]) < o.size[2] + radius &&
    feet[1] >= o.pos[1] - 0.45 && feet[1] <= o.pos[1] + o.size[1] + 0.5;
}

export function environmentCover(o: EnvironmentObject): CoverBox | null {
  if (o.type !== "moving_platform" && o.type !== "destructible_wall") return null;
  return { pos: [...o.pos], size: [...o.size], kind: o.type === "moving_platform" ? "platform" : "cover", environmentId: o.id };
}

/** Never mutate the shared MAPS singleton: concurrent rooms need independent wall states. */
export function makeEnvironmentMap(base: MapDef): MapDef {
  const cover = base.cover.map(c => ({ ...c, pos: [...c.pos] as Vec3, size: [...c.size] as Vec3 }));
  for (const o of base.environment ?? []) {
    const box = environmentCover(o);
    if (box) cover.push(box);
  }
  return { ...base, cover };
}

export function moveEnvironmentCover(map: MapDef, o: EnvironmentObject, seconds: number): void {
  if (o.type !== "moving_platform") return;
  const box = map.cover.find(c => c.environmentId === o.id);
  if (box) box.pos = environmentPosition(o, seconds);
}

export function breakEnvironmentWall(map: MapDef, id: string): void {
  const index = map.cover.findIndex(c => c.environmentId === id);
  if (index >= 0) map.cover.splice(index, 1);
}

export function closestCoverHit(cover: CoverBox[], origin: Vec3, dir: Vec3, range: number,
  rayBox: (origin: Vec3, dir: Vec3, center: Vec3, half: Vec3) => number | null
): { box: CoverBox; distance: number } | null {
  let found: { box: CoverBox; distance: number } | null = null;
  for (const box of cover) {
    if (box.kind === "accent") continue;
    const d = rayBox(origin, dir, box.pos, box.size);
    if (d !== null && d >= 0 && d < range && (!found || d < found.distance)) found = { box, distance: d };
  }
  return found;
}
