/**
 * Bound expensive route replanning per simulation tick. Movement, collision,
 * combat and authoritative damage continue to run at their usual tick rates.
 * Unserved bots retry on the next tick instead of blocking the whole frame.
 */
export class BotRouteBudget {
  private remaining = 0;
  private nextWindowAt = -Infinity;

  beginTick(maxSearches: number): void {
    this.remaining = Math.max(0, Math.floor(maxSearches));
  }

  /** Offline replanning has a time budget, independent of monitor refresh.
   * Movement, firing and collision continue on every ordinary engine update. */
  beginWindow(now: number, maxSearches: number): void {
    if (now < this.nextWindowAt) return;
    this.nextWindowAt = now + 50;
    this.beginTick(maxSearches);
  }

  take(): boolean {
    if (this.remaining === 0) return false;
    this.remaining--;
    return true;
  }
}

/** Deterministic dephasing: bots don't all redo A* on the same future tick. */
export function botRouteJitter(id: string, windowMs = 350): number {
  if (windowMs <= 0) return 0;
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++)
    hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return (hash >>> 0) % Math.floor(windowMs);
}
