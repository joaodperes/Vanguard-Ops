/** Collision helpers shared by local bots and server-authoritative bots.
 * Coordinates are feet Y and an X/Z cylinder with PLAYER_RADIUS.
 * CoverBox.size contains HALF-extents, not full box dimensions.
 */
import type { CoverBox, Vec3 } from "./game-protocol";
import { PLAYER_RADIUS, PLAYER_HEIGHT } from "./game-protocol";

// Auto-generated stairs are at most 0.5 units tall. A 1.3-unit step allowance
// made chest-high cover effectively intangible while a bot was still climbing it.
export const BOT_STEP_HEIGHT = 0.55;
const EPS = 1e-4;

function blocksAtHeight(c: CoverBox, feetY: number): boolean {
  // Stairs are real solid boxes. Only the *next reachable step* may be crossed.
  // Ignoring all stair boxes let bots walk through tall risers and foundations.
  if (c.kind === "accent") return false;
  const bottom = c.pos[1] - c.size[1];
  const top = c.pos[1] + c.size[1];
  if (feetY >= top - 0.04 || feetY + PLAYER_HEIGHT <= bottom) return false;
  return !(top > feetY && top - feetY <= BOT_STEP_HEIGHT + EPS && bottom <= feetY + BOT_STEP_HEIGHT + EPS);
}

export function botGroundHeight(cover: CoverBox[], x: number, z: number, feetY: number): number {
  let ground = 0;
  for (const c of cover) {
    if (c.kind === "accent") continue;
    const top = c.pos[1] + c.size[1];
    if (top <= ground || top > feetY + BOT_STEP_HEIGHT) continue;
    // Narrow stair treads can be shorter than the bot's capsule radius.
    // Contact with a step begins at the capsule front, before its centre
    // reaches that tread. Recognize stair support at capsule contact so each
    // successive 0.5-high riser is walkable; NEVER inflate normal roofs,
    // crates or platforms, which would allow stepping up outside their edge.
    const reach = c.kind === "stair" ? PLAYER_RADIUS : 0;
    if (Math.abs(x - c.pos[0]) <= c.size[0] + reach + EPS &&
        Math.abs(z - c.pos[2]) <= c.size[2] + reach + EPS) ground = top;
  }
  return ground;
}

/** True if the swept X/Z segment intersects solid, vertically relevant cover. */
export function botMoveBlocked(cover: CoverBox[], from: Vec3, to: Vec3, feetY: number): boolean {
  const dx = to[0] - from[0], dz = to[2] - from[2];
  for (const c of cover) {
    if (!blocksAtHeight(c, feetY)) continue;
    const xMin = c.pos[0] - c.size[0] - PLAYER_RADIUS;
    const xMax = c.pos[0] + c.size[0] + PLAYER_RADIUS;
    const zMin = c.pos[2] - c.size[2] - PLAYER_RADIUS;
    const zMax = c.pos[2] + c.size[2] + PLAYER_RADIUS;
    const insideFrom = from[0] > xMin + EPS && from[0] < xMax - EPS &&
      from[2] > zMin + EPS && from[2] < zMax - EPS;
    if (insideFrom) {
      // Starting from an overlap must not trap the bot permanently: allow only
      // movement that reduces the penetration, never movement deeper inside.
      const depth = (p: Vec3) => Math.min(p[0] - xMin, xMax - p[0], p[2] - zMin, zMax - p[2]);
      if (depth(to) >= depth(from) - EPS) return true;
      continue;
    }
    // Swept AABB slab intersection also works for long navigation probes;
    // checking just from/midpoint/to missed thin walls at diagonals.
    let enter = 0, exit = 1;
    if (Math.abs(dx) < 1e-10) {
      if (from[0] <= xMin + EPS || from[0] >= xMax - EPS) continue;
    } else {
      const a = (xMin - from[0]) / dx, b = (xMax - from[0]) / dx;
      enter = Math.max(enter, Math.min(a, b));
      exit = Math.min(exit, Math.max(a, b));
    }
    if (Math.abs(dz) < 1e-10) {
      if (from[2] <= zMin + EPS || from[2] >= zMax - EPS) continue;
    } else {
      const a = (zMin - from[2]) / dz, b = (zMax - from[2]) / dz;
      enter = Math.max(enter, Math.min(a, b));
      exit = Math.min(exit, Math.max(a, b));
    }
    // Tangential contact is okay for wall-sliding; entering its interior is not.
    if (enter + EPS < exit && exit > EPS && enter < 1 - EPS) return true;
  }
  return false;
}

export function botPositionEmbedded(cover: CoverBox[], p: Vec3, feetY = p[1]): boolean {
  return cover.some(c => blocksAtHeight(c, feetY) &&
    Math.abs(p[0] - c.pos[0]) < c.size[0] + PLAYER_RADIUS - EPS &&
    Math.abs(p[2] - c.pos[2]) < c.size[2] + PLAYER_RADIUS - EPS);
}

/** Recover an embedded bot by pushing to a real exit surface (never sign(0)). */
export function resolveBotOverlap(cover: CoverBox[], pos: Vec3, feetY: number): Vec3 {
  const out: Vec3 = [...pos];
  for (let pass = 0; pass < 14; pass++) {
    let moved = false;
    for (const c of cover) {
      if (!blocksAtHeight(c, feetY)) continue;
      const dx = out[0] - c.pos[0], dz = out[2] - c.pos[2];
      const overlapX = c.size[0] + PLAYER_RADIUS - Math.abs(dx);
      const overlapZ = c.size[2] + PLAYER_RADIUS - Math.abs(dz);
      if (overlapX <= 0 || overlapZ <= 0) continue;
      if (overlapX <= overlapZ) {
        out[0] = c.pos[0] + (dx >= 0 ? 1 : -1) * (c.size[0] + PLAYER_RADIUS + EPS);
      } else {
        out[2] = c.pos[2] + (dz >= 0 ? 1 : -1) * (c.size[2] + PLAYER_RADIUS + EPS);
      }
      moved = true;
    }
    if (!moved) break;
  }
  if (!botPositionEmbedded(cover, out, feetY)) return out;

  // In narrow gaps a minimal-axis iterative push can oscillate between adjacent
  // blocks forever. Search exits over the box faces (including the other axis)
  // and pick the *nearest actually free* position instead of returning embedded.
  const queue: Vec3[] = [[...pos]];
  const seen = new Set<string>();
  const keyOf = (p: Vec3) => `${Math.round(p[0] * 1000)},${Math.round(p[2] * 1000)}`;
  const score = (p: Vec3) => (p[0]-pos[0]) ** 2 + (p[2]-pos[2]) ** 2;
  for (let attempt = 0; queue.length && attempt < 100; attempt++) {
    queue.sort((a,b) => score(a)-score(b));
    const p = queue.shift()!;
    const key = keyOf(p);
    if (seen.has(key)) continue;
    seen.add(key);
    const hit = cover.find(c => blocksAtHeight(c, feetY) &&
      Math.abs(p[0]-c.pos[0]) < c.size[0]+PLAYER_RADIUS-EPS &&
      Math.abs(p[2]-c.pos[2]) < c.size[2]+PLAYER_RADIUS-EPS);
    if (!hit) return p;
    const hx=hit.size[0]+PLAYER_RADIUS+EPS*2;
    const hz=hit.size[2]+PLAYER_RADIUS+EPS*2;
    const options: Vec3[] = [
      [hit.pos[0]-hx, p[1], p[2]],
      [hit.pos[0]+hx, p[1], p[2]],
      [p[0], p[1], hit.pos[2]-hz],
      [p[0], p[1], hit.pos[2]+hz],
    ];
    for (const candidate of options) {
      if (!seen.has(keyOf(candidate)) && Number.isFinite(score(candidate))) queue.push(candidate);
    }
  }
  // Explicit last resort: do not silently claim an invalid position is safe.
  // The caller can choose a new spawn location if densely overlapping solids
  // leave no nearby navigable footprint.
  return out;
}

/** Keep bots grounded on steps without moving their feet *through* raised cover. */
export function botNextFeetY(cover: CoverBox[], pos: Vec3, dt: number): number {
  const support = botGroundHeight(cover, pos[0], pos[2], pos[1]);
  return support > pos[1] ? support : Math.max(support, pos[1] - 11 * dt);
}

/** Advance an airborne bot without letting its head penetrate an overhead
 * platform. Horizontal motion is swept to catch sideways launch pads too.
 * Grounded stair climbing keeps using its own step-up collision. */
export function botAirStep(
  cover:readonly CoverBox[],from:Vec3,dx:number,dy:number,dz:number,
):{pos:Vec3;hitCeiling:boolean}{
  // Airborne movement must respect the same swept wall collision as grounded
  // movement. Previously lateral impulse/launch velocities moved through walls
  // without ever calling botMoveBlocked (both server and offline paths).
  const target:Vec3=[from[0]+dx,from[1],from[2]+dz];
  if(botMoveBlocked(cover as CoverBox[],from,target,from[1])){
    const alongX:Vec3=[target[0],from[1],from[2]];
    const alongZ:Vec3=[from[0],from[1],target[2]];
    if(!botMoveBlocked(cover as CoverBox[],from,alongX,from[1]))target[2]=from[2];
    else if(!botMoveBlocked(cover as CoverBox[],from,alongZ,from[1]))target[0]=from[0];
    else {target[0]=from[0];target[2]=from[2];}
  }
  const next:Vec3=[target[0],from[1]+dy,target[2]];
  let hitCeiling=false;
  for(const c of cover){
    if(c.kind==="accent")continue;
    const underside=c.pos[1]-c.size[1],top=c.pos[1]+c.size[1];
    const minX=c.pos[0]-c.size[0]-PLAYER_RADIUS,maxX=c.pos[0]+c.size[0]+PLAYER_RADIUS;
    const minZ=c.pos[2]-c.size[2]-PLAYER_RADIUS,maxZ=c.pos[2]+c.size[2]+PLAYER_RADIUS;
    // Swept contact (not just endpoint) catches sideways jumps at the edge.
    if(Math.max(from[0],next[0])<=minX||Math.min(from[0],next[0])>=maxX||
       Math.max(from[2],next[2])<=minZ||Math.min(from[2],next[2])>=maxZ)continue;
    if(dy>0){
      // A bot that started just a little embedded in an underside must also be
      // corrected. The old 'from head already crossed' early-exit let it rise
      // straight through a castle ceiling once a single frame overlapped.
      if(from[1]<underside-EPS && next[1]+PLAYER_HEIGHT>underside+EPS){
        next[1]=Math.min(next[1],underside-PLAYER_HEIGHT-.001);
        hitCeiling=true;
      }
    }else if(dy<0){
      // Descending bots land on a platform instead of tunnelling through thin
      // roof slabs on one long gravity step.
      if(from[1]>=top-EPS && next[1]<top)next[1]=Math.max(next[1],top);
    }
  }
  return {pos:next,hitCeiling};
}

/** Ordinary tactical jumps must not hit low ceilings or start while airborne. */
export function botHasJumpClearance(cover:CoverBox[],pos:Vec3):boolean {
  if(Math.abs(botGroundHeight(cover,pos[0],pos[2],pos[1])-pos[1])>.08)return false;
  return !cover.some(c=>c.kind!=="accent"&&Math.abs(pos[0]-c.pos[0])<c.size[0]+PLAYER_RADIUS&&
    Math.abs(pos[2]-c.pos[2])<c.size[2]+PLAYER_RADIUS&&
    c.pos[1]-c.size[1]>pos[1]+.1&&c.pos[1]-c.size[1]<pos[1]+PLAYER_HEIGHT+3.15);
}
