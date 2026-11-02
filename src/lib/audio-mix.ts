/** User-facing channel faders (0..100). Master is applied once above all
 * SoundManager buses; WeaponAudio has a separate context and needs both gains.
 */
export interface AudioMixSettings {
  masterVolume: number;
  footstepVolume: number;
  fxVolume: number;
}

/** The procedural game audio reference level is lower than many other apps.
 * Raise quiet cues without changing the player's bus ratios.
 */
export const EFFECTS_OUTPUT_BOOST = 1.45;
/** WeaponAudio previously stopped at 0.32 at full volume. */
export const WEAPON_OUTPUT_SCALE = 0.48;

/** Catch overlapping peaks on each Web Audio context. This is a fast
 * dynamics compressor rather than a brick-wall limiter.
 */
export function createOutputPeakGuard(ctx: AudioContext): DynamicsCompressorNode {
  const guard = ctx.createDynamicsCompressor();
  guard.threshold.value = -5;
  guard.knee.value = 0;
  guard.ratio.value = 16;
  guard.attack.value = 0.003;
  guard.release.value = 0.12;
  return guard;
}

export const DEFAULT_AUDIO_MIX: AudioMixSettings = {
  masterVolume: 80,
  footstepVolume: 85,
  fxVolume: 100,
};

const gain = (percent: number): number =>
  Number.isFinite(percent) ? Math.max(0, Math.min(1, percent / 100)) : 0;

export function audioGainLevels(mix: AudioMixSettings) {
  const master = gain(mix.masterVolume);
  const footsteps = gain(mix.footstepVolume);
  const fx = gain(mix.fxVolume);
  return { master, footsteps, fx, weaponOutputPercent: master * fx * 100 };
}
