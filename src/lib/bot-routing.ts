/**
 * Height-aware bot pathfinding shared by offline and authoritative-server AI.
 *
 * Unlike the old 2D grid, states include support height, so bridges may be
 * crossed below as well as above. Each candidate edge is swept in small
 * increments to prove bots can actually traverse step-by-step geometry.
 * No teleporting, magical climbing or unverified jump links.
 */
import type { CoverBox, Vec3 } from "./game-protocol";
import { botGroundHeight, botMoveBlocked } from "./bot-physics";

type Hazard = { type: string; pos: readonly number[]; size: readonly number[] };
type Node = { x: number; z: number; y: number; g: number; f: number; key: string };
const GRID = 2;
const STEP = 0.36;  // generated stairs are <= 0.5 tall
const MAX_EXPANSIONS = 1000;
const DIRECTIONS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]] as const;

class MinHeap {
  private items: Node[] = [];
  push(n: Node) {
    const q = this.items;
    q.push(n); let i = q.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (q[p].f <= n.f) break; q[i] = q[p]; i = p; }
    q[i] = n;
  }
  pop(): Node | undefined {
    const q = this.items;
    const root = q[0], last = q.pop();
    if (!q.length || !last) return root;
    let i = 0;
    while (i * 2 + 1 < q.length) {
      const a = i * 2 + 1, b = a + 1;
      const c = b < q.length && q[b].f < q[a].f ? b : a;
      if (q[c].f >= last.f) break;
      q[i] = q[c]; i = c;
    }
    q[i] = last;
    return root;
  }
  get length() { return this.items.length; }
}

function hazardAt(x: number, z: number, hazards: readonly Hazard[]): boolean {
  return hazards.some(h => (h.type === "fire" || h.type === "spikes") &&
    Math.abs(x - h.pos[0]) < h.size[0] + 0.7 &&
    Math.abs(z - h.pos[2]) < h.size[2] + 0.7);
}

/**
 * Check each substep against bot collision rules and walkable support.
 * The path may descend a ledge, but never climb more than the same
 * 0.55-unit step enforced by bot physics.
 */
export function botTraversableEdge(
  from: Vec3, x: number, z: number, cover: CoverBox[], hazards: readonly Hazard[] = [],
): number | null {
  const distance = Math.hypot(x - from[0], z - from[2]);
  if (distance < 0.001) return from[1];
  const count = Math.ceil(distance / STEP);
  let previousX = from[0], previousZ = from[2], feet = from[1];
  for (let i = 1; i <= count; i++) {
    const t = i / count, nx = from[0] + (x - from[0]) * t;
    const nz = from[2] + (z - from[2]) * t;
    if (hazardAt(nx, nz, hazards)) return null;
    const origin: Vec3 = [previousX, feet, previousZ];
    const to: Vec3 = [nx, feet, nz];
    if (botMoveBlocked(cover, origin, to, feet)) return null;
    const support = botGroundHeight(cover, nx, nz, feet);
    // Small steps are handled by botGroundHeight. Large drops are one-way
    // transitions; keep those modest so falling AI can recover quickly.
    if (feet - support > 2.5) return null;
    feet = support;
    previousX = nx; previousZ = nz;
  }
  return feet;
}

/**
 * Returns the immediate reachable X/Z waypoint with its expected feet Y.
 * Agents continue to use their existing movement motor and collision checks;
 * this function only chooses a route. Null means use normal obstacle avoidance.
 */
export function botNextWaypoint(
  start: readonly number[], goal: readonly number[], cover: CoverBox[],
  bounds: number, _legacyStep = 3, hazards: readonly Hazard[] = [],
): Vec3 | null {
  const sx = Math.round(start[0] / GRID), sz = Math.round(start[2] / GRID);
  const goalX = Math.round(goal[0] / GRID), goalZ = Math.round(goal[2] / GRID);
  const sy = Math.max(0, start[1]);
  const key = (x: number, z: number, y: number) => `${x},${z},${Math.round(y * 2)}`;
  const heuristic = (x: number, z: number, y: number) =>
    Math.hypot(goalX - x, goalZ - z) + Math.abs(y - goal[1]) * 2.5;
  const startKey = key(sx, sz, sy);
  const heap = new MinHeap();
  heap.push({ x: sx, z: sz, y: sy, g: 0, f: heuristic(sx,sz,sy), key: startKey });
  const bestCost = new Map<string, number>([[startKey, 0]]);
  const parents = new Map<string,string>();
  const nodes = new Map<string,Node>();
  const startNode: Node = { x: sx, z: sz, y: sy, g: 0, f: heuristic(sx,sz,sy), key: startKey };
  nodes.set(startKey, startNode);
  let closest = startNode, destination: Node | null = null;
  let expansions = 0;

  while (heap.length && expansions++ < MAX_EXPANSIONS) {
    const cur = heap.pop()!;
    if (cur.g > (bestCost.get(cur.key) ?? Infinity) + 1e-6) continue;
    if (cur.f - cur.g < closest.f - closest.g) closest = cur;
    if (Math.hypot(cur.x - goalX, cur.z - goalZ) <= 1.1 &&
        Math.abs(cur.y - goal[1]) < 1.25) {
      destination = cur;
      break;
    }

    for (const [dx, dz] of DIRECTIONS) {
      const x = cur.x + dx, z = cur.z + dz, wx = x * GRID, wz = z * GRID;
      if (Math.abs(wx) >= bounds - 2 || Math.abs(wz) >= bounds - 2) continue;
      const from: Vec3 = [cur.x * GRID, cur.y, cur.z * GRID];
      // The first edge begins at the bot's actual location, not the
      // rounded grid centre, avoiding false starts inside adjacent walls.
      if (cur.key === startKey) { from[0] = start[0]; from[2] = start[2]; }
      const nextY = botTraversableEdge(from, wx, wz, cover, hazards);
      if (nextY === null) continue;
      const nextKey = key(x, z, nextY);
      const cost = cur.g + Math.hypot(dx,dz) + Math.abs(nextY - cur.y) * 0.65;
      if (cost >= (bestCost.get(nextKey) ?? Infinity) - 1e-6) continue;
      const h = heuristic(x,z,nextY);
      const next: Node = { x, z, y: nextY, g: cost, f: cost + h, key: nextKey };
      bestCost.set(nextKey, cost);
      nodes.set(nextKey, next);
      parents.set(nextKey, cur.key);
      heap.push(next);
    }
  }

  // Do not return an arbitrary unproved detour if no destination was reached.
  // The existing avoidance/recovery system is a safer fallback in that case.
  const found = destination ?? (closest !== startNode &&
    closest.f - closest.g + 2 < startNode.f ? closest : null);
  if (!found) return null;
  let cursor = found.key;
  while (parents.has(cursor) && parents.get(cursor) !== startKey) {
    cursor = parents.get(cursor)!;
  }
  const next = nodes.get(cursor);
  return next ? [next.x * GRID, next.y, next.z * GRID] : null;
}
