import { EFFECTS_OUTPUT_BOOST, createOutputPeakGuard } from "./audio-mix";

// ============================================================================
// VANGUARD OPS — Sound Manager
// ----------------------------------------------------------------------------
// Lightweight Web Audio API-based SFX system. No asset files needed — all
// sounds are synthesized procedurally from oscillators + noise bursts. This
// keeps the bundle tiny and avoids any network latency for sound files.
//
// Usage:
//   const sm = new SoundManager();
//   sm.setMasterVolume(0.8);  // 0..1
//   sm.play("shot_rifle");
//   sm.play("hit_marker");
//   sm.play("kill");
//   sm.play("reload");
//   sm.play("death");
//   sm.play("level_up");
//   sm.playDistantShot("rifle", 25, false, 1.0);  // enemy fire 25u away
//
// The browser requires a user gesture before audio can play. Call `resume()`
// from a click/tap handler (the engine does this on pointer lock / touch start).
// ============================================================================

// Per-weapon-category identifier. Each maps to a distinct synthesis profile
// in SHOT_PROFILES below. Bots/players firing any weapon in a category produce
// the same base sound; distance + suppressor modifiers are layered on top.
export type WeaponShotCategory =
  | "rifle"
  | "smg"
  | "shotgun"
  | "sniper"
  | "pistol"
  | "lmg"
  | "dmr"
  | "launcher";

export type SfxName =
  | "shot_rifle"
  | "shot_smg"
  | "shot_shotgun"
  | "shot_sniper"
  | "shot_pistol"
  | "shot_lmg"
  | "shot_dmr"
  | "shot_launcher"
  | "melee_swing"
  | "melee_hit"
  | "hit_marker"
  | "headshot"
  | "kill"
  | "reload"
  | "revolver_reload"
  | "revolver_close"
  | "death"
  | "level_up"
  | "wave_start"
  | "hit_taken"
  | "footstep"
  | "water_footstep"
  | "empty_click"
  | "swap"
  | "ads_in"
  | "ads_out"
  | "countdown_tick"
  | "match_start"
  | "overtime_start"
  | "match_win"
  | "match_lose"
  | "flag_taken"
  | "flag_scored"
  | "flag_enemy_scored"
  | "flag_returned"
  | "flag_lost";

/** All synthesized cues have one independently controllable sound category.
 * Distant gunfire is routed to Weapons by playDistantShot. */
export type SfxChannel = "weapons" | "footsteps" | "combat" | "ui";
export function soundChannelFor(name: SfxName): SfxChannel {
  if (name === "footstep" || name === "water_footstep") return "footsteps";
  if (name.startsWith("shot_") || name === "melee_swing" || name === "melee_hit" ||
      name === "reload" || name === "revolver_reload" || name === "revolver_close" ||
      name === "empty_click" || name === "swap" || name === "ads_in" || name === "ads_out")
    return "weapons";
  if (name === "hit_marker" || name === "headshot" || name === "kill" ||
      name === "death" || name === "hit_taken") return "combat";
  return "ui"; // Level-up, countdown, match and objective alerts.
}

// Map a weapon id to its shot category. Falls back to "rifle".
// Used by both the local player's own gunshot and by enemy fire synthesis.
export function shotCategoryForWeapon(weaponId: string): WeaponShotCategory {
  if (weaponId.startsWith("smg_") || weaponId === "pistol_machine") return "smg";
  if (weaponId.startsWith("shotgun_")) return "shotgun";
  if (weaponId.startsWith("sniper_")) return "sniper";
  if (weaponId.startsWith("pistol_") || weaponId === "pistol_burst") return "pistol";
  if (weaponId.startsWith("lmg_")) return "lmg";
  if (weaponId.startsWith("dmr_") || weaponId === "dmr_scout") return "dmr";
  if (weaponId === "launcher_rocket") return "launcher";
  // Melee weapons have no shot sound — the engine shouldn't call playShot for them.
  return "rifle";
}

// Map a weapon id to a generic shot sfx name. Falls back to "shot_rifle".
// (Legacy API — kept for any callers that still want the SfxName enum. Internally
// we route through shotCategoryForWeapon + SHOT_PROFILES.)
export function shotSfxForWeapon(weaponId: string): SfxName {
  const cat = shotCategoryForWeapon(weaponId);
  return ("shot_" + cat) as SfxName;
}

// ---- Per-category synthesis profiles ----
// Each category gets a distinct audible signature via:
//   - baseFreq: oscillator fundamental (pitch)
//   - dur: total envelope decay
//   - vol: per-category multiplier on top of the input volume
//   - tail: convolver reverb amount (0..2)
//   - oscType: oscillator waveform shaping the body tone
//   - noiseMix: relative volume of the noise crack (0..1)
//   - filterType + filterFreq: filter shaping the noise component
//   - subBass: optional 60Hz sine thump (shotgun/launcher)
//   - metallicRing: optional harmonic oscillator for sniper "crack ring"
//   - mechClick: optional very-short noise burst at the start (lmg)
interface ShotProfile {
  baseFreq: number;
  dur: number;
  vol: number;
  tail: number;
  oscType: OscillatorType;
  noiseMix: number;
  filterType: BiquadFilterType;
  filterFreq: number;
  subBass?: { freq: number; dur: number; vol: number };
  metallicRing?: { ratio: number; vol: number };
  mechClick?: boolean;
}

const SHOT_PROFILES: Record<WeaponShotCategory, ShotProfile> = {
  // Rifle (AR-15/M4): mid-pitched crack with substantial low-end body.
  // Switched highpass 900 → lowpass 3500 (more weight, less tinny) + added
  // sub-bass thump @ 80Hz. ~180ms decay, 1.0 tail. Real AR crack + chest thump.
  rifle:    { baseFreq: 120, dur: 0.18, vol: 1.15, tail: 1.0, oscType: "sawtooth", noiseMix: 0.85, filterType: "lowpass",  filterFreq: 3500, subBass: { freq: 80,  dur: 0.12, vol: 0.5  } },
  // SMG (MP5/Vector): punchy mid-pitch with less low-end than rifle but still
  // substantial. Switched highpass 1400 → lowpass 2800 + added sub-bass @ 100Hz.
  smg:      { baseFreq: 180, dur: 0.12, vol: 1.00, tail: 0.5, oscType: "square",   noiseMix: 0.75, filterType: "lowpass",  filterFreq: 2800, subBass: { freq: 100, dur: 0.08, vol: 0.35 } },
  // Shotgun (12-gauge): DEEP boom + heavy noise, lots of low-end. Sub-bass @ 45Hz,
  // ~300ms decay, 1.5 tail. Real 12-ga is one of the deepest firearm reports.
  shotgun:  { baseFreq: 70,  dur: 0.30, vol: 1.30, tail: 1.5, oscType: "sawtooth", noiseMix: 0.95, filterType: "lowpass",  filterFreq: 1200, subBass: { freq: 45,  dur: 0.30, vol: 0.9  } },
  // Sniper (.308/.50 BMG): loud whip-crack + long tail + chest thump + metallic
  // ring. Keeps highpass 1600 for the sharp crack; sub-bass @ 70Hz adds weight.
  sniper:   { baseFreq: 280, dur: 0.40, vol: 1.40, tail: 2.0, oscType: "sawtooth", noiseMix: 0.80, filterType: "highpass", filterFreq: 1600, subBass: { freq: 70,  dur: 0.25, vol: 0.6  }, metallicRing: { ratio: 2.7, vol: 0.5 } },
  // Pistol (9mm): mid-pitched pop with some low-end. Switched highpass 1100 →
  // lowpass 2500 + added sub-bass @ 90Hz. ~130ms decay.
  pistol:   { baseFreq: 160, dur: 0.13, vol: 0.95, tail: 0.4, oscType: "square",   noiseMix: 0.75, filterType: "lowpass",  filterFreq: 2500, subBass: { freq: 90,  dur: 0.06, vol: 0.3  } },
  // LMG (M240/M60): heavy rattle + deep thump per round. Sub-bass @ 75Hz, ~160ms
  // decay, 1.1 tail. Mechanical chugging click retained for full-auto feel.
  lmg:      { baseFreq: 140, dur: 0.16, vol: 1.20, tail: 1.1, oscType: "sawtooth", noiseMix: 0.85, filterType: "lowpass",  filterFreq: 2000, subBass: { freq: 75,  dur: 0.14, vol: 0.55 }, mechClick: true },
  // DMR (M110/SR-25): punchy semi-auto with substantial low-end. Switched
  // bandpass 1400 → lowpass 3000 (broader, weightier) + sub-bass @ 70Hz.
  dmr:      { baseFreq: 160, dur: 0.22, vol: 1.15, tail: 1.3, oscType: "sawtooth", noiseMix: 0.85, filterType: "lowpass",  filterFreq: 3000, subBass: { freq: 70,  dur: 0.15, vol: 0.5  } },
  // Launcher (RPG/rocket): DEEP explosion + very long tail. Sub-bass @ 35Hz,
  // ~600ms decay, 3.0 tail. Real rocket launch is one of the loudest sounds.
  launcher: { baseFreq: 50,  dur: 0.60, vol: 1.60, tail: 3.0, oscType: "sine",     noiseMix: 1.00, filterType: "lowpass",  filterFreq: 1200, subBass: { freq: 35,  dur: 0.60, vol: 1.2  } },
};

/** Expected loudness of a remote footstep at world-space distance. */
export function footstepVolumeAtDistance(distance: number, sprinting = false, inWater = false): number {
  if (!Number.isFinite(distance) || distance >= 38) return 0;
  const attenuation = Math.pow(Math.max(0, 1 - Math.max(0, distance) / 38), 2);
  return (sprinting ? 0.72 : 0.5) * attenuation * (inWater ? 0.8 : 1);
}

export class SoundManager {
  private ctx: AudioContext | null = null;
  /** Legacy masterGain name is the FX bus; all existing SFX route through it. */
  private masterGain: GainNode | null = null;
  private outputGain: GainNode | null = null;
  private outputBoost: GainNode | null = null;
  private peakGuard: DynamicsCompressorNode | null = null;
  private footstepGain: GainNode | null = null;
  private masterVolume = 0.8;
  private footstepVolume = 0.85;
  private fxVolume = 1; // Legacy general-effects bus; stays at unity with the new mixer.
  private weaponVolume = 1;
  private combatVolume = 1;
  private uiVolume = 1;
  private muted = false;
  // Throttle: don't play more than N of the same sfx within `windowMs`.
  private lastPlayed: Map<SfxName, number> = new Map();
  // Throttle distant shots per-category (so 5 bots firing smg simultaneously
  // don't slam the audio graph with 5 overlapping synth nodes).
  private lastDistantPlayed: Map<WeaponShotCategory, number> = new Map();
  private lastRemoteFootstepAt=-Infinity;
  // Noise buffer cache (reused for shot/death sounds).
  private noiseBuffer: AudioBuffer | null = null;
  // A small shared convolver for tail/reverb (cheap) — adds body to gunshots.
  private convolver: ConvolverNode | null = null;

  constructor() {
    // Defer AudioContext creation until the first resume() call — browsers
    // require a user gesture before audio can start. Constructing the context
    // here is fine, but we wait to actually create it on first use.
  }

  /** Lazily create the AudioContext on first user gesture. */
  resume() {
    if (!this.ctx) {
      try {
        const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
        this.ctx = new AC();
        // Master scales footsteps and effects independently.
        this.outputGain = this.ctx.createGain();
        this.outputGain.gain.value = this.muted ? 0 : this.masterVolume;
        // Apply the loudness adjustment after the master fader, then protect
        // peaks caused by several simultaneous procedural effects.
        this.outputBoost = this.ctx.createGain();
        this.outputBoost.gain.value = EFFECTS_OUTPUT_BOOST;
        this.peakGuard = createOutputPeakGuard(this.ctx);
        this.outputGain.connect(this.outputBoost);
        this.outputBoost.connect(this.peakGuard);
        this.peakGuard.connect(this.ctx.destination);
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.fxVolume;
        this.masterGain.connect(this.outputGain);
        this.footstepGain = this.ctx.createGain();
        this.footstepGain.gain.value = this.footstepVolume;
        this.footstepGain.connect(this.outputGain);
        // Build the noise buffer once.
        this.noiseBuffer = this.makeNoiseBuffer(0.5);
        // Build a short impulse response for the convolver tail.
        this.convolver = this.ctx.createConvolver();
        this.convolver.buffer = this.makeImpulseResponse(0.18, 2.0);
        this.convolver.connect(this.masterGain);
      } catch (e) {
        // Web Audio not available — silently degrade.
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  setMasterVolume(v: number) {
    this.masterVolume = Math.max(0, Math.min(1, v));
    if (this.outputGain && this.ctx) {
      this.outputGain.gain.setTargetAtTime(this.muted ? 0 : this.masterVolume, this.ctx.currentTime, 0.02);
    }
  }

  setFootstepVolume(v: number) {
    this.footstepVolume = Math.max(0, Math.min(1, v));
    if (this.footstepGain && this.ctx) {
      this.footstepGain.gain.setTargetAtTime(this.footstepVolume, this.ctx.currentTime, 0.02);
    }
  }

  /** Apply gains when synthesizing a cue so its reverb follows its channel.
   * Footsteps already have a dedicated Web Audio bus, so are not doubled. */
  setChannelVolumes(levels: { weapons: number; combat: number; ui: number }) {
    this.weaponVolume = Math.max(0, Math.min(1, levels.weapons));
    this.combatVolume = Math.max(0, Math.min(1, levels.combat));
    this.uiVolume = Math.max(0, Math.min(1, levels.ui));
  }

  setFxVolume(v: number) {
    this.fxVolume = Math.max(0, Math.min(1, v));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.fxVolume, this.ctx.currentTime, 0.02);
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.outputGain && this.ctx) {
      this.outputGain.gain.setTargetAtTime(m ? 0 : this.masterVolume, this.ctx.currentTime, 0.02);
    }
  }

  isMuted() { return this.muted; }
  getMasterVolume() { return this.masterVolume; }

  private makeNoiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private makeImpulseResponse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  /** Play a named SFX. Honors master volume + mute. Throttles repeats. */
  play(name: SfxName, opts: { volume?: number; throttleMs?: number } = {}) {
    if (!this.ctx || !this.masterGain || this.muted) return;
    if(this.ctx.state==="suspended")void this.ctx.resume().catch(()=>{});
    const now = this.ctx.currentTime;
    const channel = soundChannelFor(name);
    const channelLevel = channel === "weapons" ? this.weaponVolume
      : channel === "combat" ? this.combatVolume
      : channel === "ui" ? this.uiVolume : 1;
    const vol = (opts.volume ?? 1.0) * channelLevel;
    if (vol <= 0) return;
    const throttle = opts.throttleMs ?? 0;
    if (throttle > 0) {
      const last = this.lastPlayed.get(name) ?? 0;
      if ((now * 1000) - last < throttle) return;
      this.lastPlayed.set(name, now * 1000);
    }
    // Dispatch to the per-sound synthesizer.
    switch (name) {
      case "shot_rifle":    this.synthCategoryShot("rifle",    vol, this.masterGain); break;
      case "shot_smg":      this.synthCategoryShot("smg",      vol, this.masterGain); break;
      case "shot_shotgun":  this.synthCategoryShot("shotgun",  vol, this.masterGain); break;
      case "shot_sniper":   this.synthCategoryShot("sniper",   vol, this.masterGain); break;
      case "shot_pistol":   this.synthCategoryShot("pistol",   vol, this.masterGain); break;
      case "shot_lmg":      this.synthCategoryShot("lmg",      vol, this.masterGain); break;
      case "shot_dmr":      this.synthCategoryShot("dmr",      vol, this.masterGain); break;
      case "shot_launcher": this.synthCategoryShot("launcher", vol, this.masterGain); break;
      case "melee_swing":   this.synthMeleeSwing(vol); break;
      case "melee_hit":     this.synthMeleeHit(vol); break;
      case "hit_marker": this.synthBlip(880, 0.04, vol * 0.5, "square"); break;
      case "headshot": this.synthHeadshot(vol); break;
      case "kill": this.synthKill(vol); break;
      case "reload": this.synthReload(vol); break;
      case "revolver_reload": this.synthRevolverReload(vol); break;
      case "revolver_close": this.synthRevolverClose(vol); break;
      case "death": this.synthDeath(vol); break;
      case "level_up": this.synthLevelUp(vol); break;
      case "wave_start": this.synthWaveStart(vol); break;
      case "hit_taken": this.synthHitTaken(vol); break;
      case "footstep": this.synthFootstep(vol); break;
      case "water_footstep": this.synthWaterFootstep(vol); break;
      case "empty_click": this.synthBlip(1200, 0.02, vol * 0.3, "square"); break;
      case "swap": this.synthSwap(vol); break;
      case "ads_in": this.synthBlip(440, 0.03, vol * 0.25, "sine"); break;
      case "ads_out": this.synthBlip(330, 0.03, vol * 0.25, "sine"); break;
      case "match_win": this.synthMatchWin(vol); break;
      case "match_lose": this.synthMatchLose(vol); break;
      case "countdown_tick": this.synthBlip(740, .075, vol * .7, "sine"); break;
      case "match_start": this.synthMatchStart(vol); break;
      case "overtime_start": this.synthOvertimeStart(vol); break;
      case "flag_taken": this.synthFlagFanfare("pickup", vol); break;
      case "flag_scored": this.synthFlagFanfare("score", vol); break;
      case "flag_enemy_scored": this.synthFlagFanfare("enemy_score", vol); break;
      case "flag_returned": this.synthFlagFanfare("return", vol); break;
      case "flag_lost": this.synthFlagFanfare("loss", vol); break;
    }
  }

  /** Footsteps of other players/bots attenuate by WORLD distance, not screen size. */
  playFootstepAtDistance(distance: number, sprinting = false, inWater = false): void {
    const volume = footstepVolumeAtDistance(distance, sprinting, inWater);
    if (volume < 0.004) return;
    const now=this.ctx?.currentTime??0;
    // Ambient bot traffic should not allocate dozens of overlapping noise
    // graphs and steal audio work from the player's own steps or shots.
    if((now*1000)-this.lastRemoteFootstepAt<95)return;
    this.lastRemoteFootstepAt=now*1000;
    this.play(inWater?"water_footstep":"footstep", { volume });
  }

  // ---- Distant / enemy fire ----
  // Synthesizes a gunshot as heard by the local player when another player/bot
  // fires. Volume falls off STEEPLY with distance so far-away fire is quiet /
  // inaudible (previously linear to 80u which let you hear everything across
  // the map — too noisy). Now uses a squared falloff to 35u: shots within ~10u
  // are loud, ~20u moderate, ~30u faint, beyond 35u inaudible.
  // Suppressed weapons are -60% volume AND low-passed at 500Hz (muffled) — the
  // cutoff was lowered from 800Hz to 500Hz so distant fire carries more low-end
  // (low frequencies travel further through air; this matches the real-world
  // observation that distant gunfire sounds deep + muffled rather than tinny).
  // Reuses the per-category synthesis from synthCategoryShot — just routes it
  // through an optional distance/suppressor filter chain.
  playDistantShot(
    category: WeaponShotCategory,
    distance: number,
    suppressed: boolean,
    volume: number,
  ) {
    if (!this.ctx || !this.masterGain || this.muted) return;
    // Throttle: max ~12 distant shots per category per second (auto weapons can
    // easily exceed this with 3-4 bots in earshot; clamping keeps the audio
    // graph from exploding). 80ms per-category window.
    const nowMs = this.ctx.currentTime * 1000;
    const last = this.lastDistantPlayed.get(category) ?? 0;
    if (nowMs - last < 80) return;
    this.lastDistantPlayed.set(category, nowMs);

    // Distance attenuation: SQUARED falloff, inaudible at 35+ units.
    // Squared (rather than linear) gives a much steeper drop-off so cross-map
    // fire is quiet/inaudible instead of a constant rumble. Normalized so that
    // at distance 0 → 1.0, at 17.5u → 0.25, at 35u → 0.
    const MAX_DIST = 35;
    const norm = Math.max(0, 1 - distance / MAX_DIST);
    const distAtten = norm * norm;
    if (distAtten <= 0.01) return;
    // Suppressor: -60% volume AND low-pass @ 500Hz (muffled, deeper).
    const suppMul = suppressed ? 0.4 : 1.0;
    const finalVol = volume * distAtten * suppMul * this.weaponVolume;
    if (finalVol <= 0.001) return;

    if (suppressed) {
      // Route through a low-pass filter chain: synth → lowpass(500Hz) → masterGain.
      const ctx = this.ctx;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 500;
      lp.Q.value = 0.7;
      lp.connect(this.masterGain);
      this.synthCategoryShot(category, finalVol, lp);
    } else {
      this.synthCategoryShot(category, finalVol, this.masterGain);
    }
  }

  // ---- Synthesizers ----

  /** Per-category gunshot. Routes all generated audio into `outNode` (which
   *  is normally masterGain, but for distant shots may be a low-pass chain). */
  private synthCategoryShot(category: WeaponShotCategory, vol: number, outNode: AudioNode) {
    const ctx = this.ctx!;
    const p = SHOT_PROFILES[category];
    const t = ctx.currentTime;
    const dur = p.dur;
    const v = vol * p.vol;
    // Noise "crack" transient — 1.5× longer than the body decay for a wider,
    // more realistic report. Real gunshots have a sharp onset + a longer noise
    // tail (the "crack" is wider than the body thump). Compensates for the
    // gain reduction below by keeping perceived crack weight high.
    const noiseDur = dur * 1.5;

    // --- Mechanical click (lmg): very-short noise burst at the very start ---
    if (p.mechClick) {
      const click = ctx.createBufferSource();
      click.buffer = this.noiseBuffer;
      const clickFilt = ctx.createBiquadFilter();
      clickFilt.type = "highpass";
      clickFilt.frequency.value = 3000;
      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(v * 0.35, t);
      clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
      click.connect(clickFilt).connect(clickGain).connect(outNode);
      click.start(t); click.stop(t + 0.02);
    }

    // --- Noise crack (shaped per-category by filterType/filterFreq) ---
    // Gain factor reduced 0.7 → 0.5 to leave headroom for the new sub-osc +
    // boosted sub-bass + louder profiles (so the master bus doesn't clip).
    // The 1.5× longer noiseDur keeps the perceived crack weight high.
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = p.filterType;
    noiseFilter.frequency.value = p.filterFreq;
    if (p.filterType === "bandpass") noiseFilter.Q.value = 1;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(v * p.noiseMix * 0.5, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + noiseDur);
    noise.connect(noiseFilter).connect(noiseGain).connect(outNode);

    // --- Body oscillator: pitch drop from baseFreq*2 → baseFreq*0.5 ---
    // Gain reduced 0.6 → 0.45 to make headroom for the new sub-osc + the
    // louder sub-bass. The pitch-drop envelope (2× → 0.5×) is unchanged.
    const osc = ctx.createOscillator();
    osc.type = p.oscType;
    osc.frequency.setValueAtTime(p.baseFreq * 2, t);
    osc.frequency.exponentialRampToValueAtTime(p.baseFreq * 0.5, t + dur);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(v * 0.45, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(oscGain).connect(outNode);

    // --- Sub-oscillator at 0.5× the body fundamental (an octave below the
    //     body's end-point) for richer low-end. Adds chest-thump weight
    //     without raising peak amplitude much (low-frequency energy doesn't
    //     correlate with the higher-frequency noise/osc peaks). ---
    const subOsc = ctx.createOscillator();
    subOsc.type = p.oscType;
    subOsc.frequency.setValueAtTime(p.baseFreq, t);
    subOsc.frequency.exponentialRampToValueAtTime(p.baseFreq * 0.25, t + dur);
    const subOscGain = ctx.createGain();
    subOscGain.gain.setValueAtTime(v * 0.22, t);
    subOscGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    subOsc.connect(subOscGain).connect(outNode);

    // --- Sub-bass thump: low sine for low-end weight (now on most categories).
    //     Gain staging boosted 0.8 → 0.9 for more prominent chest-thump (real
    //     guns have substantial sub-100Hz energy). ---
    if (p.subBass) {
      const sub = ctx.createOscillator();
      sub.type = "sine";
      sub.frequency.setValueAtTime(p.subBass.freq, t);
      sub.frequency.exponentialRampToValueAtTime(p.subBass.freq * 0.5, t + p.subBass.dur);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(v * p.subBass.vol * 0.9, t);
      subGain.gain.exponentialRampToValueAtTime(0.001, t + p.subBass.dur);
      sub.connect(subGain).connect(outNode);
      sub.start(t); sub.stop(t + p.subBass.dur + 0.05);
    }

    // --- Metallic ring (sniper): second sine oscillator at a non-integer
    //     harmonic ratio → bell-like overtone characteristic of a crack. ---
    if (p.metallicRing) {
      const ring = ctx.createOscillator();
      ring.type = "sine";
      ring.frequency.setValueAtTime(p.baseFreq * p.metallicRing.ratio, t);
      const ringGain = ctx.createGain();
      ringGain.gain.setValueAtTime(v * p.metallicRing.vol, t);
      ringGain.gain.exponentialRampToValueAtTime(0.001, t + dur * 1.5);
      ring.connect(ringGain).connect(outNode);
      ring.start(t); ring.stop(t + dur * 1.5 + 0.05);
    }

    // --- Optional convolver tail for bigger weapons (routed through the
    //     shared convolver which already connects to masterGain). Tail length
    //     now scales with the profile's tail amount so bigger weapons (sniper,
    //     launcher) get a noticeably longer reverb tail. ---
    if (this.convolver && p.tail > 0.7) {
      const tailEnd = dur + 0.2 + p.tail * 0.3;  // longer tail for bigger weapons
      const tailGain = ctx.createGain();
      tailGain.gain.setValueAtTime(v * p.tail * 0.25, t + dur * 0.3);
      tailGain.gain.exponentialRampToValueAtTime(0.001, t + tailEnd);
      noise.connect(tailGain).connect(this.convolver);
    }

    // Start + stop the noise + body + sub-osc (the sub-bass/ring/click nodes
    // start themselves above).
    noise.start(t); noise.stop(t + noiseDur + 0.05);
    osc.start(t); osc.stop(t + dur + 0.05);
    subOsc.start(t); subOsc.stop(t + dur + 0.05);
  }

  /** A short tonal blip. */
  private synthBlip(freq: number, dur: number, vol: number, type: OscillatorType = "sine") {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.masterGain!);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  /** Hit marker: a high pitched ding-ding (two quick blips). */
  private synthHeadshot(vol: number) {
    this.synthBlip(1320, 0.05, vol * 0.6, "triangle");
    setTimeout(() => this.synthBlip(1760, 0.06, vol * 0.5, "triangle"), 60);
  }

  /** Kill confirmation: a rising arpeggio. */
  private synthKill(vol: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const freqs = [523, 659, 784];  // C-E-G major triad
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = f;
      const g = ctx.createGain();
      const start = t + i * 0.06;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(vol * 0.4, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      osc.connect(g).connect(this.masterGain!);
      osc.start(start); osc.stop(start + 0.2);
    });
  }

  /** Reload: three mechanical clicks + a soft slide. The third click is a
   *  charging-handle slap — added for a more mechanical, less synthetic feel
   *  (real reloads have a distinctive "mag in → charge" double-clack). */
  private synthReload(vol: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    // Click 1 (mag out)
    this.clickAt(t, vol * 0.5);
    // Slide noise
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass"; filt.frequency.value = 1200; filt.Q.value = 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t + 0.15);
    g.gain.linearRampToValueAtTime(vol * 0.15, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    noise.connect(filt).connect(g).connect(this.masterGain!);
    noise.start(t + 0.15); noise.stop(t + 0.5);
    // Click 2 (mag in)
    this.clickAt(t + 0.5, vol * 0.6);
    // Click 3 (charging handle slap) — ~100ms after the mag-in click, shorter
    // and at a slightly higher pitch (3200Hz vs 2500Hz) for a distinct metal-
    // on-metal "clack" that separates it from the mag-in click.
    this.clickAt(t + 0.6, vol * 0.45, 3200, 0.025);
  }

  /** Cylinder unlock, empty-case rattle and speedloader seating, not a pistol slide. */
  private synthRevolverReload(vol: number) {
    const t = this.ctx!.currentTime;
    this.clickAt(t, vol * .66, 1250, .070);
    this.clickAt(t + .20, vol * .40, 3400, .026);
    for (let i=0;i<4;i++) this.clickAt(t + .37 + i*.060, vol*.24, 2600+i*270, .020);
  }
  private synthRevolverClose(vol: number) {
    const t=this.ctx!.currentTime;
    this.clickAt(t,vol*.75,1450,.055);
    this.clickAt(t+.037,vol*.37,3500,.018);
  }

  /** Short filtered-noise mechanical click. `freq` controls the highpass cutoff
   *  (higher = tinnier/sharper clack); `decay` controls the envelope length. */
  private clickAt(t: number, vol: number, freq = 2500, decay = 0.04) {
    const ctx = this.ctx!;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filt = ctx.createBiquadFilter();
    filt.type = "highpass"; filt.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + decay);
    noise.connect(filt).connect(g).connect(this.masterGain!);
    noise.start(t); noise.stop(t + decay + 0.01);
  }

  /** Death: a low descending tone + soft noise wash. */
  private synthDeath(vol: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    osc.connect(g).connect(this.masterGain!);
    osc.start(t); osc.stop(t + 0.75);
  }

  /** Level up: triumphant rising arpeggio with a bell tone. */
  private synthLevelUp(vol: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const freqs = [523, 659, 784, 1046];  // C-E-G-C major
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const g = ctx.createGain();
      const start = t + i * 0.08;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(vol * 0.45, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      osc.connect(g).connect(this.masterGain!);
      osc.start(start); osc.stop(start + 0.45);
    });
  }

  /** Wave start: a menacing low horn. */
  private synthWaveStart(vol: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.linearRampToValueAtTime(140, t + 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol * 0.35, t + 0.1);
    g.gain.linearRampToValueAtTime(vol * 0.35, t + 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass"; filt.frequency.value = 600;
    osc.connect(filt).connect(g).connect(this.masterGain!);
    osc.start(t); osc.stop(t + 1.05);
  }

  /**
   * Team-wide CTF cues. Layered, short brass-like motifs rather than ping
   * oscillators: friendly scoring is a major fanfare; an enemy capture is a
   * descending minor fanfare. Each client plays the same event locally, so
   * there is no dependence on voice chat or spatial hearing distance.
   */
  private synthFlagFanfare(kind: "pickup" | "score" | "enemy_score" | "return" | "loss", vol: number) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const notes: Record<typeof kind, number[]> = {
      pickup: [392, 523.25, 659.25],
      score: [523.25, 659.25, 783.99, 1046.5],
      enemy_score: [440, 369.99, 311.13, 220],
      return: [523.25, 659.25, 783.99],
      loss: [392, 329.63, 261.63],
    };
    const isScore = kind === "score" || kind === "enemy_score";
    const step = isScore ? .125 : .10;
    const peak = vol * (isScore ? .29 : .22);
    notes[kind].forEach((freq, i) => {
      const at = t0 + i * step;
      // Richer harmonics provide a recognizable stinger even on small speakers.
      const osc = ctx.createOscillator();
      osc.type = kind === "enemy_score" || kind === "loss" ? "sawtooth" : "triangle";
      osc.frequency.setValueAtTime(freq, at);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(kind === "enemy_score" ? 1250 : 2400, at);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(.0001, at);
      gain.gain.exponentialRampToValueAtTime(Math.max(.0001, peak), at + .014);
      gain.gain.exponentialRampToValueAtTime(.0001, at + (isScore ? .32 : .25));
      osc.connect(filter).connect(gain).connect(this.masterGain!);
      osc.start(at);
      osc.stop(at + (isScore ? .34 : .27));
      osc.onended = () => { osc.disconnect(); filter.disconnect(); gain.disconnect(); };
    });
    if (isScore) {
      // Final resolution distinguishes a true team objective from a pickup.
      const at = t0 + notes[kind].length * step;
      const chord = kind === "score" ? [523.25, 783.99, 1046.5] : [220, 261.63, 311.13];
      chord.forEach(freq => {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(.0001, at);
        gain.gain.exponentialRampToValueAtTime(vol * .13, at + .025);
        gain.gain.exponentialRampToValueAtTime(.0001, at + .34);
        osc.connect(gain).connect(this.masterGain!);
        osc.start(at); osc.stop(at + .36);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      });
    }
  }

  /** Match win: ascending triumphant arpeggio (C-E-G-C major chord roll). */
  private synthMatchWin(vol: number) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    // Major triad arpeggio: C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.5)
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const t = t0 + i * 0.12;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * 0.45, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.connect(g).connect(this.masterGain!);
      osc.start(t); osc.stop(t + 0.55);
    });
    // Final sustained chord (all 4 notes held together)
    const tChord = t0 + 0.5;
    notes.forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, tChord);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, tChord);
      g.gain.linearRampToValueAtTime(vol * 0.18, tChord + 0.05);
      g.gain.linearRampToValueAtTime(vol * 0.18, tChord + 0.8);
      g.gain.exponentialRampToValueAtTime(0.001, tChord + 1.4);
      const filt = ctx.createBiquadFilter();
      filt.type = "lowpass"; filt.frequency.value = 2400;
      osc.connect(filt).connect(g).connect(this.masterGain!);
      osc.start(tChord); osc.stop(tChord + 1.5);
    });
  }

  /** Match lose: descending mournful tone (minor-key droop). */
  private synthMatchLose(vol: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    // Drop from E4 (329.6) down to A3 (220) — a descending minor sixth.
    osc.frequency.setValueAtTime(329.6, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 1.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol * 0.32, t + 0.08);
    g.gain.linearRampToValueAtTime(vol * 0.28, t + 0.9);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass"; filt.frequency.value = 900;
    osc.connect(filt).connect(g).connect(this.masterGain!);
    osc.start(t); osc.stop(t + 1.7);
    // Layer a soft noise wash underneath for "fade to black" feel.
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.4), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const nFilt = ctx.createBiquadFilter();
    nFilt.type = "lowpass"; nFilt.frequency.value = 400;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0, t);
    nGain.gain.linearRampToValueAtTime(vol * 0.12, t + 0.2);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    noise.connect(nFilt).connect(nGain).connect(this.masterGain!);
    noise.start(t); noise.stop(t + 1.5);
  }

  /** Match start "GO!" cue: a bright rising triad stab (C5-E5-G5) — energetic
   *  and unmistakable. Played when the pre-match countdown reaches 0. */
  private synthMatchStart(vol: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(f, t);
      const g = ctx.createGain();
      const start = t + i * 0.04;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(vol * 0.26, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      osc.connect(g).connect(this.masterGain!);
      osc.start(start); osc.stop(start + 0.55);
    });
  }

  /** Urgent two-tone warning with a final rising sting: distinct from the
   * opening GO cue and score fanfares, without an external audio asset. */
  private synthOvertimeStart(vol: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const notes = [392, 523.25, 392, 659.25];
    notes.forEach((freq, i) => {
      const start = t + i * .18;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, start);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1800;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.linearRampToValueAtTime(Math.max(.0001,vol * .23), start + .018);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .16);
      osc.connect(filter).connect(gain).connect(this.masterGain!);
      osc.start(start); osc.stop(start + .17);
    });
    const low = ctx.createOscillator();
    low.type = "triangle";
    low.frequency.setValueAtTime(196,t);
    low.frequency.exponentialRampToValueAtTime(293.66,t + .85);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(.0001,t);
    gain.gain.linearRampToValueAtTime(Math.max(.0001,vol * .12),t + .12);
    gain.gain.exponentialRampToValueAtTime(.0001,t + .95);
    low.connect(gain).connect(this.masterGain!);
    low.start(t); low.stop(t + .96);
  }

  /** Player took damage: a sharp low thud. */
  private synthHitTaken(vol: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(g).connect(this.masterGain!);
    osc.start(t); osc.stop(t + 0.22);
  }

  /** Bootfall: soft gravel noise + short low-frequency heel thump. */
  private synthFootstep(vol: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass"; filt.frequency.value = 680;
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0001, vol * 0.26), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.095);
    noise.connect(filt).connect(g).connect(this.footstepGain!);
    noise.start(t); noise.stop(t + 0.1);
    noise.onended = () => { noise.disconnect(); filt.disconnect(); g.disconnect(); };
    const thump = ctx.createOscillator(), tg = ctx.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(110, t);
    thump.frequency.exponentialRampToValueAtTime(65, t + 0.085);
    tg.gain.setValueAtTime(Math.max(0.0001, vol * 0.14), t);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
    thump.connect(tg).connect(this.footstepGain!);
    thump.start(t); thump.stop(t + 0.095);
    thump.onended = () => { thump.disconnect(); tg.disconnect(); };
  }

  /** Splashy wet bootfall, mixed through the existing footstep-volume bus. */
  private synthWaterFootstep(vol:number){
    const ctx=this.ctx!;
    const t=ctx.currentTime;
    const splash=ctx.createBufferSource();
    splash.buffer=this.noiseBuffer;
    const band=ctx.createBiquadFilter();
    // Lower the piercing splash pitch while keeping it recognizably wet.
    band.type="bandpass";band.frequency.value=950;band.Q.value=.7;
    const gain=ctx.createGain();
    gain.gain.setValueAtTime(Math.max(.0001,vol*.40),t);
    gain.gain.exponentialRampToValueAtTime(.0001,t+.19);
    splash.connect(band).connect(gain).connect(this.footstepGain!);
    splash.start(t);splash.stop(t+.20);
    splash.onended=()=>{splash.disconnect();band.disconnect();gain.disconnect();};
    const thump=ctx.createOscillator(),thumpGain=ctx.createGain();
    thump.type="sine";
    thump.frequency.setValueAtTime(95,t);
    thump.frequency.exponentialRampToValueAtTime(48,t+.13);
    thumpGain.gain.setValueAtTime(Math.max(.0001,vol*.15),t);
    thumpGain.gain.exponentialRampToValueAtTime(.0001,t+.14);
    thump.connect(thumpGain).connect(this.footstepGain!);
    thump.start(t);thump.stop(t+.15);
    thump.onended=()=>{thump.disconnect();thumpGain.disconnect();};
  }

  /** Weapon swap: a quick swoosh + click. */
  private synthSwap(vol: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass"; filt.frequency.setValueAtTime(800, t); filt.frequency.linearRampToValueAtTime(2400, t + 0.1); filt.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol * 0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    noise.connect(filt).connect(g).connect(this.masterGain!);
    noise.start(t); noise.stop(t + 0.16);
    this.clickAt(t + 0.12, vol * 0.4);
  }

  /** Melee swing: a filtered noise sweep (whoosh) — bandpass that rises from
   *  low to high frequency over ~200ms to simulate blade/club air displacement. */
  private synthMeleeSwing(vol: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.setValueAtTime(400, t);
    filt.frequency.linearRampToValueAtTime(2400, t + 0.18);
    filt.Q.value = 1.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol * 0.35, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    noise.connect(filt).connect(g).connect(this.masterGain!);
    noise.start(t); noise.stop(t + 0.24);
  }

  /** Melee hit: meatier thwack — low sine thump (impact body) + low-passed
   *  noise burst (the "smack"). Shorter and weightier than a gunshot. */
  private synthMeleeHit(vol: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    // Low sine thump (impact body).
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.12);
    const og = ctx.createGain();
    og.gain.setValueAtTime(vol * 0.6, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(og).connect(this.masterGain!);
    osc.start(t); osc.stop(t + 0.18);
    // Noise impact burst (the "thwack").
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 800;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.5, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    noise.connect(filt).connect(ng).connect(this.masterGain!);
    noise.start(t); noise.stop(t + 0.1);
  }

  dispose() {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.masterGain = null;
      this.outputGain = null;
      this.footstepGain = null;
      this.noiseBuffer = null;
      this.convolver = null;
    }
  }
}
