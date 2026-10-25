/** User-facing channel faders (0..100). Master is applied once above all
 * SoundManager buses; WeaponAudio has a separate context and needs both gains.
 */
export interface AudioMixSettings {
  masterVolume: number;
  musicVolume: number;
  footstepVolume: number;
  fxVolume: number;
}

export const DEFAULT_AUDIO_MIX: AudioMixSettings = {
  masterVolume: 80,
  musicVolume: 65,
  footstepVolume: 85,
  fxVolume: 100,
};

const gain = (percent: number): number =>
  Number.isFinite(percent) ? Math.max(0, Math.min(1, percent / 100)) : 0;

export function audioGainLevels(mix: AudioMixSettings) {
  const master = gain(mix.masterVolume);
  const music = gain(mix.musicVolume);
  const footsteps = gain(mix.footstepVolume);
  const fx = gain(mix.fxVolume);
  return { master, music, footsteps, fx, weaponOutputPercent: master * fx * 100 };
}
