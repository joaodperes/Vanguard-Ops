/**
 * VANGUARD OPS – lightweight, asset-free weapon sound signatures.
 *
 * Call `unlock()` during a user gesture (pointer/touch/keyboard). Then call
 * `play(category, { weaponId, suppressed })` when a shot is actually fired.
 * All audio is synthesized in the browser with Web Audio; no network downloads.
 */

export type WeaponSoundCategory =
  | "assault" | "smg" | "shotgun" | "dmr" | "sniper" | "lmg" | "pistol" | "pdw" | "melee" | "launcher";

interface SoundProfile {
  bodyHz: number;
  bodyEndHz: number;
  bodySeconds: number;
  noiseHz: number;
  noiseQ: number;
  noiseSeconds: number;
  bodyLevel: number;
  noiseLevel: number;
  bodyType: OscillatorType;
  filter: BiquadFilterType;
}

// Spectral shape and duration, not just volume/pitch, distinguish each class.
const PROFILES: Record<WeaponSoundCategory, SoundProfile> = {
  assault: { bodyHz: 155, bodyEndHz: 63, bodySeconds: 0.135, noiseHz: 1900, noiseQ: 0.85, noiseSeconds: 0.165, bodyLevel: 0.75, noiseLevel: 0.65, bodyType: "triangle", filter: "bandpass" },
  smg:     { bodyHz: 280, bodyEndHz: 125, bodySeconds: 0.073, noiseHz: 3900, noiseQ: 0.65, noiseSeconds: 0.090, bodyLevel: 0.42, noiseLevel: 0.67, bodyType: "square", filter: "highpass" },
  shotgun: { bodyHz: 96, bodyEndHz: 37, bodySeconds: 0.320, noiseHz: 680, noiseQ: 0.55, noiseSeconds: 0.375, bodyLevel: 1.04, noiseLevel: 1.00, bodyType: "triangle", filter: "lowpass" },
  dmr:     { bodyHz: 173, bodyEndHz: 66, bodySeconds: 0.175, noiseHz: 2650, noiseQ: 1.00, noiseSeconds: 0.245, bodyLevel: 0.86, noiseLevel: 0.75, bodyType: "sawtooth", filter: "bandpass" },
  sniper:  { bodyHz: 82, bodyEndHz: 28, bodySeconds: 0.425, noiseHz: 1200, noiseQ: 0.68, noiseSeconds: 0.590, bodyLevel: 1.08, noiseLevel: 0.98, bodyType: "triangle", filter: "bandpass" },
  lmg:     { bodyHz: 124, bodyEndHz: 45, bodySeconds: 0.205, noiseHz: 1080, noiseQ: 0.55, noiseSeconds: 0.270, bodyLevel: 0.97, noiseLevel: 0.83, bodyType: "sawtooth", filter: "lowpass" },
  pistol: { bodyHz: 325, bodyEndHz: 128, bodySeconds: 0.104, noiseHz: 4600, noiseQ: 0.75, noiseSeconds: 0.145, bodyLevel: 0.50, noiseLevel: 0.77, bodyType: "triangle", filter: "highpass" },
  pdw: { bodyHz: 295, bodyEndHz: 112, bodySeconds: 0.077, noiseHz: 4000, noiseQ: 0.68, noiseSeconds: 0.09, bodyLevel: 0.44, noiseLevel: 0.7, bodyType: "square", filter: "highpass" },
  melee:   { bodyHz: 780, bodyEndHz: 350, bodySeconds: 0.112, noiseHz: 1350, noiseQ: 0.80, noiseSeconds: 0.185, bodyLevel: 0.14, noiseLevel: 0.39, bodyType: "sine", filter: "bandpass" },
  launcher:{ bodyHz: 71, bodyEndHz: 26, bodySeconds: 0.350, noiseHz: 930, noiseQ: 0.65, noiseSeconds: 0.485, bodyLevel: 1.05, noiseLevel: 0.83, bodyType: "sawtooth", filter: "lowpass" },
};

// Dedicated spectral signatures for experimental mechanisms. `play` already
// receives weaponId for local, remote player and bot shots, so no new events are
// needed. These profiles deliberately differ from their conventional classes.
const SPECIAL_PROFILES: Record<string, SoundProfile> = {
  rifle_electron: {
    bodyHz: 1070, bodyEndHz: 215, bodySeconds: .165,
    noiseHz: 4500, noiseQ: 1.8, noiseSeconds: .105,
    bodyLevel: .36, noiseLevel: .24, bodyType: "sawtooth", filter: "bandpass",
  },
  crossbow_reclaimer: {
    bodyHz: 480, bodyEndHz: 85, bodySeconds: .19,
    noiseHz: 1950, noiseQ: 2.1, noiseSeconds: .055,
    bodyLevel: .22, noiseLevel: .18, bodyType: "triangle", filter: "bandpass",
  },
  pistol_arc: {
    bodyHz: 1750, bodyEndHz: 145, bodySeconds: .115,
    noiseHz: 6200, noiseQ: 1.8, noiseSeconds: .14,
    bodyLevel: .43, noiseLevel: .31, bodyType: "sawtooth", filter: "highpass",
  },
};

// Small stable offset means individual weapons in the same class still have
// slightly different timbres without randomising their identity each shot.
function weaponPitch(weaponId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < weaponId.length; i++) {
    hash ^= weaponId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return 0.94 + ((hash >>> 0) % 121) / 1000; // 0.940 ... 1.060
}

export class WeaponAudio {
  private ctx: AudioContext | null = null;
  private output: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private volume: number;
  private activeVoices = 0;
  private readonly maxVoices = 32; // prevent Web Audio overload during bot-heavy firefights
  private disposed = false;

  constructor(masterVolume = 70) {
    this.volume = Math.min(100, Math.max(0, masterVolume));
  }

  setVolume(masterVolume: number): void {
    this.volume = Math.min(100, Math.max(0, masterVolume));
    if (this.ctx && this.output) {
      this.output.gain.setTargetAtTime((this.volume / 100) * 0.27, this.ctx.currentTime, 0.012);
    }
  }

  /** Invoke from a genuine browser user interaction to permit Web Audio output. */
  unlock(): void {
    if (this.disposed || typeof window === "undefined") return;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        const compressor = this.ctx.createDynamicsCompressor();
        compressor.threshold.value = -19;
        compressor.knee.value = 8;
        compressor.ratio.value = 5;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.120;
        compressor.connect(this.ctx.destination);
        this.output = this.ctx.createGain();
        this.output.gain.value = (this.volume / 100) * 0.27;
        this.output.connect(compressor);

        // Shared white-noise buffer is created once, not for every shot.
        const length = Math.ceil(this.ctx.sampleRate * 0.72);
        this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const samples = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      } catch {
        this.ctx = null; // Audio not supported or blocked; gameplay must continue.
        this.output = null;
        this.noiseBuffer = null;
        return;
      }
    }
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
  }

  play(category: WeaponSoundCategory, options: {
    weaponId?: string;
    suppressed?: boolean;
    /** World distance to the sound source in game units; omit for local shots. */
    distance?: number;
    /** -1 left, +1 right (relative to camera direction). */
    pan?: number;
    /** Local per-event mix multiplier, typically 0.5..1. */
    volume?: number;
  } = {}): void {
    // Reserve several voices for the player when the arena is extremely busy.
    const voiceLimit = options.distance === undefined ? this.maxVoices + 8 : this.maxVoices;
    if (this.volume === 0 || this.disposed || this.activeVoices >= voiceLimit) return;
    if (!this.ctx) this.unlock();
    const ctx = this.ctx;
    const out = this.output;
    if (!ctx || !out || !this.noiseBuffer) return;
    const profile = SPECIAL_PROFILES[options.weaponId ?? ""] ?? PROFILES[category];
    if (!profile) return;

    const now = ctx.currentTime;
    const suppressed = !!options.suppressed && category !== "melee";
    const pitch = weaponPitch(options.weaponId ?? category);
    const distance = Math.max(0, options.distance ?? 0);
    if (distance >= 90) return;
    // Low/mid bands carry further than the muzzle crack. Attenuate both volume
    // and high-frequency energy, leaving far-off shots recognizable but unobtrusive.
    const attenuation = Math.pow(1 / (1 + distance * 0.046), 1.35)
      * Math.max(0, 1 - Math.pow(distance / 90, 3));
    const level = (suppressed ? 0.48 : 1)
      * attenuation * Math.min(1.2, Math.max(0, options.volume ?? 1));
    if (level < 0.006) return;
    const spatialPan = options.pan === undefined ? null : ctx.createStereoPanner();
    if (spatialPan) {
      spatialPan.pan.value = Math.max(-1, Math.min(1, options.pan!));
      spatialPan.connect(out);
    }
    const tonalFilter = suppressed || distance > 7 ? ctx.createBiquadFilter() : null;
    if (tonalFilter) {
      tonalFilter.type = "lowpass";
      tonalFilter.frequency.value = suppressed ? Math.max(320, 680 - distance * 4)
        : Math.max(1150, 7500 - distance * 88);
      tonalFilter.Q.value = 0.55;
      tonalFilter.connect(spatialPan ?? out);
    }
    const destination = tonalFilter ?? spatialPan ?? out;
    const bodyTime = profile.bodySeconds * (suppressed ? 0.72 : 1);
    const noiseTime = profile.noiseSeconds * (suppressed ? 0.55 : 1);
    this.activeVoices++;

    // Weight / boom: a short, diving pitch envelope. Shotguns and snipers have
    // a much longer bass tail; SMGs and pistols are tight and high-frequency.
    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = profile.bodyType;
    body.frequency.setValueAtTime(profile.bodyHz * pitch, now);
    body.frequency.exponentialRampToValueAtTime(Math.max(22, profile.bodyEndHz * pitch), now + bodyTime);
    bodyGain.gain.setValueAtTime(0.0001, now);
    bodyGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, profile.bodyLevel * level), now + 0.0025);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + bodyTime);
    body.connect(bodyGain).connect(destination);
    body.start(now);
    body.stop(now + bodyTime + 0.008);

    // Muzzle crack / mechanical swish. Filter choice distinguishes the short
    // SMG snap, broad shotgun blast, metallic DMR crack and long sniper report.
    const burst = ctx.createBufferSource();
    burst.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = profile.filter;
    filter.Q.value = profile.noiseQ;
    filter.frequency.setValueAtTime(profile.noiseHz * pitch, now);
    if (category === "melee") {
      filter.frequency.exponentialRampToValueAtTime(440 * pitch, now + noiseTime);
    } else if (category === "sniper") {
      filter.frequency.exponentialRampToValueAtTime(300 * pitch, now + noiseTime);
    }
    const burstGain = ctx.createGain();
    burstGain.gain.setValueAtTime(0.0001, now);
    burstGain.gain.exponentialRampToValueAtTime(profile.noiseLevel * level, now + (category === "melee" ? 0.037 : 0.0018));
    burstGain.gain.exponentialRampToValueAtTime(0.0001, now + noiseTime);
    burst.connect(filter).connect(burstGain).connect(destination);
    burst.start(now, Math.random() * 0.09);
    burst.stop(now + noiseTime + 0.008);

    // Disconnect nodes only after both branches finish to prevent graph leaks.
    let finished = 0;
    const finish = () => {
      finished++;
      if (finished === 2) {
        this.activeVoices = Math.max(0, this.activeVoices - 1);
        tonalFilter?.disconnect();
        spatialPan?.disconnect();
      }
    };
    body.onended = () => { body.disconnect(); bodyGain.disconnect(); finish(); };
    burst.onended = () => {
      burst.disconnect(); filter.disconnect(); burstGain.disconnect(); finish();
    };
  }

  /** Distinct two-note elimination chime. Invoked only for a confirmed local kill. */
  playElimination(headshot = false): void {
    if (this.disposed || this.volume <= 0) return;
    if (!this.ctx) this.unlock();
    const ctx = this.ctx;
    if (!ctx || !this.output || ctx.state === "closed") return;
    const t = ctx.currentTime;
    const notes = headshot ? [880, 1318] : [660, 990];
    notes.forEach((hz, index) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(hz, t + index * 0.085);
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.0001, t + index * 0.085);
      amp.gain.exponentialRampToValueAtTime(0.23, t + index * 0.085 + 0.012);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + index * 0.085 + 0.17);
      osc.connect(amp).connect(this.output!);
      osc.start(t + index * 0.085);
      osc.stop(t + index * 0.085 + 0.18);
      osc.onended = () => { osc.disconnect(); amp.disconnect(); };
    });
  }

  dispose(): void {
    this.disposed = true;
    if (this.ctx) void this.ctx.close().catch(() => {});
    this.ctx = null;
    this.output = null;
    this.noiseBuffer = null;
  }
}
