import type { C2S } from "./game-protocol";

type MovementState = Extract<C2S, { t: "state" }>;

/** Rendering and local input remain immediate. Only redundant state packets
 * are coalesced; shots and other gameplay events use their existing path. */
export class MovementSendBudget {
  private lastAt = -Infinity;
  private previous: MovementState | null = null;

  reset(): void { this.lastAt = -Infinity; this.previous = null; }

  shouldSend(now: number, state: MovementState): boolean {
    const old = this.previous;
    const transition = old && (old.aiming !== state.aiming || old.firing !== state.firing ||
      old.reloading !== state.reloading || old.alive !== state.alive || old.sprinting !== state.sprinting);
    const elapsed = now - this.lastAt;
    // ADS, shield, sprint and reload transitions must not wait for the next slot.
    if (old && !transition && elapsed + 1e-6 < 1000 / 30) return false;
    const changed = !old || transition || old.pos.some((v, i) => Math.abs(v - state.pos[i]) > .001) ||
      Math.abs(old.yaw - state.yaw) > .0001 || Math.abs(old.pitch - state.pitch) > .0001;
    if (!changed && elapsed < 250) return false;
    this.previous = { ...state, pos: [...state.pos] };
    this.lastAt = now;
    return true;
  }
}
