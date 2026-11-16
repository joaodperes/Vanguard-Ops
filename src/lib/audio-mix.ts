/** User-facing 0..100 audio category faders. Each context receives master once. */
export interface AudioMixSettings {
  masterVolume: number;
  weaponVolume: number;
  footstepVolume: number;
  combatVolume: number;
  uiVolume: number;
}

/** Raise procedural cues without changing their relative loudness. */
export const EFFECTS_OUTPUT_BOOST = 1.45;
export const WEAPON_OUTPUT_SCALE = 0.58;

/** Protect overlapping peaks in either Web Audio context. */
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
  weaponVolume: 100,
  footstepVolume: 85,
  combatVolume: 100,
  uiVolume: 100,
};

const gain = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value / 100)) : 0;

function validPercent(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : undefined;
}

/** Older players used one fxVolume slider for weapons, hit cues and UI.
 * Copy that preference only into faders that do not already have a value.
 * Zero must stay zero; a new preference always takes precedence.
 */
export function migrateLegacyAudioMix(saved: Record<string, unknown>):
  Pick<AudioMixSettings, "weaponVolume" | "combatVolume" | "uiVolume"> {
  const oldFx = validPercent(saved.fxVolume);
  return {
    weaponVolume: validPercent(saved.weaponVolume) ?? oldFx ?? DEFAULT_AUDIO_MIX.weaponVolume,
    combatVolume: validPercent(saved.combatVolume) ?? oldFx ?? DEFAULT_AUDIO_MIX.combatVolume,
    uiVolume: validPercent(saved.uiVolume) ?? oldFx ?? DEFAULT_AUDIO_MIX.uiVolume,
  };
}

export function audioGainLevels(mix: AudioMixSettings) {
  const master = gain(mix.masterVolume);
  const footsteps = gain(mix.footstepVolume);
  const weapons = gain(mix.weaponVolume);
  const combat = gain(mix.combatVolume);
  const ui = gain(mix.uiVolume);
  return {
    master, footsteps, weapons, combat, ui,
    weaponOutputPercent: master * weapons * 100,
    combatOutputPercent: master * combat * 100,
  };
}
