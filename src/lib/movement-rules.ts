/** Shared traversal tuning for the local player and AI.
 * Speeds are world units/sec, response rates are exponential 1/sec.
 * Prefer changing responsiveness before increasing top speed.
 */
export const MOVEMENT = {
  walk: 8.65,
  sprintMultiplier: 1.95,
  sprintAdsMultiplier: 1.48,
  jumpVelocity: 8.55,
  sprintJumpBoost: 2.35,
  gravity: 22.5,
  botPursuitMultiplier: 1.16,
  groundAcceleration: 23,  // brisk acceleration from rest
  groundBraking: 34,       // let go of a key: stop quickly
  groundReversal: 30,      // rapid left/right direction changes
  airAcceleration: 5,     // steer without instantly overwriting jump momentum
  airBraking: 1.6,        // keep horizontal momentum when controls are released
  jumpBufferMs: 115,     // early jump input just before landing
  coyoteMs: 95,          // late jump just after leaving a ledge
  touchSprintOn: 0.73,   // lower mobile engagement threshold
  touchSprintOff: 0.62,  // hysteresis prevents joystick sprint flicker
  touchSprintForward: 0.45,
} as const;

export const SPRINT_ADS_GRIP = "grip_runner_ads";
export function allowsAdsWhileSprinting(grip?: string | null) {
  return grip === SPRINT_ADS_GRIP;
}

/** Use the same sprint decision for the HUD joystick glow and gameplay. */
export function shouldTouchAutoSprint(magnitude: number, forward: number, wasActive: boolean): boolean {
  return forward > MOVEMENT.touchSprintForward &&
    magnitude >= (wasActive ? MOVEMENT.touchSprintOff : MOVEMENT.touchSprintOn);
}

/** Whether a recent input may launch from the ground or during ledge grace. */
export function canUseBufferedJump(now: number, pressedAt: number, groundedAt: number, grounded: boolean): boolean {
  const pressAge = now - pressedAt;
  const ledgeAge = now - groundedAt;
  return pressAge >= 0 && pressAge <= MOVEMENT.jumpBufferMs &&
    (grounded || (ledgeAge >= 0 && ledgeAge <= MOVEMENT.coyoteMs));
}

/** Frame-rate-independent velocity response; zero input brakes, reversal turns fast. */
export function responsiveHorizontalVelocity(
  vx: number, vz: number, targetX: number, targetZ: number, grounded: boolean, dt: number,
): [number, number] {
  const desired = Math.hypot(targetX, targetZ);
  const opposing = vx * targetX + vz * targetZ < -0.01;
  const response = grounded
    ? desired < 0.001 ? MOVEMENT.groundBraking
      : opposing ? MOVEMENT.groundReversal : MOVEMENT.groundAcceleration
    : desired < 0.001 ? MOVEMENT.airBraking : MOVEMENT.airAcceleration;
  const alpha = 1 - Math.exp(-response * Math.min(0.1, Math.max(0, dt)));
  const x = vx + (targetX - vx) * alpha;
  const z = vz + (targetZ - vz) * alpha;
  return desired < 0.001 && Math.hypot(x, z) < 0.015 ? [0, 0] : [x, z];
}
