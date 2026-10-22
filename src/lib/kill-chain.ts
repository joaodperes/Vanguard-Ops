/** A new elimination grants another five seconds to secure the next kill. */
export const KILL_CHAIN_GRACE_MS = 5000;
export interface KillChainState { count: number; lastKillAt: number }
export function advanceKillChain(state: KillChainState, now: number, graceMs = KILL_CHAIN_GRACE_MS): KillChainState {
  return { count: now - state.lastKillAt <= graceMs ? state.count + 1 : 1, lastKillAt: now };
}
