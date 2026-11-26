import { MOVEMENT } from "./movement-rules";

/** Inputs to the shared bot pursuit-speed calculation (world units/second). */
export interface BotPursuitSpeedInput {
  moveSpeed: number;
  carryingFlag: boolean;
  flagSpeedMultiplier: number;
  sprinting: boolean;
  perkSpeedMultiplier: number;
  perkBaseSpeedMultiplier: number;
  weaponMoveSpeedMultiplier: number;
  orbitalMultiplier?: number;
  environmentMultiplier?: number;
}

/**
 * Resolve the common bot locomotion speed used by both simulations.
 * Map hazards and mode-specific effects are calculated by the caller, then
 * supplied as environmentMultiplier; the movement/perk/weapon composition
 * itself has one source of truth.
 */
export function resolveBotPursuitSpeed(input: BotPursuitSpeedInput): number {
  const perkRatio = input.perkBaseSpeedMultiplier > 0
    ? input.perkSpeedMultiplier / input.perkBaseSpeedMultiplier
    : 1;
  return (input.carryingFlag ? input.flagSpeedMultiplier : 1) *
    input.moveSpeed * 6 * MOVEMENT.botPursuitMultiplier *
    (input.sprinting ? 1.25 : 1) * perkRatio *
    input.weaponMoveSpeedMultiplier * (input.orbitalMultiplier ?? 1) *
    (input.environmentMultiplier ?? 1);
}
