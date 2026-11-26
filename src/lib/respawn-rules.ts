/** Shared respawn policy and fresh-life state transition for local and authoritative simulations. */
export type RespawnPosition = readonly [number, number, number];

export interface RespawnTransitionInput {
  position: RespawnPosition;
  maxHealth: number;
  now: number;
  spawnProtectionMs?: number;
}

export interface RespawnTransition {
  position: [number, number, number];
  health: number;
  alive: true;
  spawnProtectedUntil: number;
}

/**
 * Returns the delay for a death-triggered respawn. Search & Destroy is
 * round-elimination based and deliberately has no individual respawn timer.
 */
export function respawnDelayForMode(
  mode: string,
  standardDelayMs: number,
  survivalDelayMs: number,
): number | null {
  if (mode === "searchdestroy") return null;
  const delay = mode === "survival" ? survivalDelayMs : standardDelayMs;
  return Number.isFinite(delay) ? Math.max(0, delay) : 0;
}

/** Canonical state transition applied whenever an actor receives a fresh life. */
export function resolveRespawnState(input: RespawnTransitionInput): RespawnTransition {
  const maxHealth = Number.isFinite(input.maxHealth) ? Math.max(1, input.maxHealth) : 1;
  const now = Number.isFinite(input.now) ? input.now : 0;
  const protectionMs = Number.isFinite(input.spawnProtectionMs)
    ? Math.max(0, input.spawnProtectionMs ?? 0) : 0;
  return {
    position: [...input.position] as [number, number, number],
    health: maxHealth,
    alive: true,
    spawnProtectedUntil: now + protectionMs,
  };
}
