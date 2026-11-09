import { WEAPON_OUTPUT_SCALE, createOutputPeakGuard } from "./audio-mix";

/**
 * VANGUARD OPS – recorded CC0 firearm reports plus procedural layers.
 * Two near-field gunshot takes per conventional pistol, SMG/PDW and shotgun
 * family, plus two rifle recordings, are bundled locally. Ambient tail,
 * mechanism and bass remain synthetic. Any unavailable assets fall back.
 * Call `unlock()` on a browser gesture: the first shot works immediately and
 * authentic reports begin after background decode completes.
 */

export type WeaponAcousticSpace = "outdoor" | "urban" | "indoor";

/** Cheap map-level acoustic proxy. Position-specific interiors can be added later. */
export function weaponAcousticSpace(mapId: string): WeaponAcousticSpace {
  if (mapId === "bunker") return "indoor";
  if (["compound", "terminal", "arena_neon", "floodgate", "shipyard"].includes(mapId)) return "urban";
  return "outdoor";
}

export type WeaponSoundCategory =
  | "assault" | "smg" | "shotgun" | "dmr" | "sniper" | "lmg" | "pistol" | "pdw" | "melee" | "launcher";

type RecordedShotFamily = "p226" | "mp5" | "sg" | "rifle556" | "rifle762";
const RECORDED_REPORTS: Record<RecordedShotFamily, readonly string[]> = {
  p226: ["/audio/weapons/p226-report-0.wav.b64", "/audio/weapons/p226-report-1.wav.b64"],
  mp5: ["/audio/weapons/mp5-report-0.wav.b64", "/audio/weapons/mp5-report-1.wav.b64"],
  sg: ["/audio/weapons/sg-report-0.wav.b64", "/audio/weapons/sg-report-1.wav.b64"],
  rifle556: ["/audio/weapons/rifle_556.mp3.b64"],
  rifle762: ["/audio/weapons/rifle_762.mp3.b64"],
};

/** Model names are archetype labels, never claims that a given game gun is the recorded firearm. */
export function recordedFamilyFor(category: WeaponSoundCategory, weaponId?: string): RecordedShotFamily | null {
  if (weaponId?.startsWith("wonder_") ||
    ["rifle_electron", "pistol_arc", "crossbow_reclaimer"].includes(weaponId ?? "")) return null;
  if (category === "pistol") return "p226";
  if (category === "smg" || category === "pdw") return "mp5";
  if (category === "shotgun") return "sg";
  if (category === "assault") return weaponId === "rifle_falcon" ? "rifle762" : "rifle556";
  if (category === "dmr" || category === "sniper" || category === "lmg") return "rifle762";
  return null;
}

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
  assault: { bodyHz: 155, bodyEndHz: 63, bodySeconds: 0.135, noiseHz: 2450, noiseQ: 0.65, noiseSeconds: 0.120, bodyLevel: 0.75, noiseLevel: 0.65, bodyType: "triangle", filter: "bandpass" },
  smg:     { bodyHz: 280, bodyEndHz: 125, bodySeconds: 0.073, noiseHz: 3600, noiseQ: 0.65, noiseSeconds: 0.075, bodyLevel: 0.42, noiseLevel: 0.67, bodyType: "square", filter: "highpass" },
  // Keep the primary shotgun blast open and brief. A long 1.5 kHz lowpass
  // used to bury the muzzle report under a soft, suppressed-sounding boom.
  shotgun: { bodyHz: 116, bodyEndHz: 45, bodySeconds: 0.205, noiseHz: 480, noiseQ: 0.50, noiseSeconds: 0.155, bodyLevel: 0.78, noiseLevel: 0.95, bodyType: "sawtooth", filter: "highpass" },
  dmr:     { bodyHz: 173, bodyEndHz: 66, bodySeconds: 0.175, noiseHz: 2650, noiseQ: 1.00, noiseSeconds: 0.245, bodyLevel: 0.86, noiseLevel: 0.75, bodyType: "sawtooth", filter: "bandpass" },
  sniper:  { bodyHz: 82, bodyEndHz: 28, bodySeconds: 0.425, noiseHz: 1850, noiseQ: 0.68, noiseSeconds: 0.380, bodyLevel: 1.08, noiseLevel: 0.98, bodyType: "triangle", filter: "bandpass" },
  lmg:     { bodyHz: 124, bodyEndHz: 45, bodySeconds: 0.205, noiseHz: 2150, noiseQ: 0.65, noiseSeconds: 0.190, bodyLevel: 0.97, noiseLevel: 0.83, bodyType: "sawtooth", filter: "bandpass" },
  pistol: { bodyHz: 325, bodyEndHz: 128, bodySeconds: 0.104, noiseHz: 3900, noiseQ: 0.75, noiseSeconds: 0.090, bodyLevel: 0.50, noiseLevel: 0.77, bodyType: "triangle", filter: "highpass" },
  pdw: { bodyHz: 295, bodyEndHz: 112, bodySeconds: 0.077, noiseHz: 4100, noiseQ: 0.68, noiseSeconds: 0.075, bodyLevel: 0.44, noiseLevel: 0.7, bodyType: "square", filter: "highpass" },
  melee:   { bodyHz: 780, bodyEndHz: 350, bodySeconds: 0.112, noiseHz: 1350, noiseQ: 0.80, noiseSeconds: 0.185, bodyLevel: 0.14, noiseLevel: 0.39, bodyType: "sine", filter: "bandpass" },
  launcher:{ bodyHz: 71, bodyEndHz: 26, bodySeconds: 0.350, noiseHz: 930, noiseQ: 0.65, noiseSeconds: 0.485, bodyLevel: 1.05, noiseLevel: 0.83, bodyType: "sawtooth", filter: "lowpass" },
};

// Dedicated spectral signatures for experimental mechanisms. `play` already
// receives weaponId for local, remote player and bot shots, so no new events are
// needed. These profiles deliberately differ from their conventional classes.
const SPECIAL_PROFILES: Record<string, SoundProfile> = {
  // Mauler CS: fast, hard semi-auto action rather than the longer pump blast.
  shotgun_combat: {
    bodyHz: 148, bodyEndHz: 62, bodySeconds: .155,
    noiseHz: 570, noiseQ: .48, noiseSeconds: .125,
    bodyLevel: .68, noiseLevel: 1.08, bodyType: "sawtooth", filter: "highpass",
  },
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
  pistol_bastion: {
    bodyHz: 184, bodyEndHz: 63, bodySeconds: .178,
    noiseHz: 2750, noiseQ: .62, noiseSeconds: .135,
    bodyLevel: .76, noiseLevel: .84, bodyType: "sawtooth", filter: "highpass",
  },
  pistol_arc: {
    bodyHz: 1750, bodyEndHz: 145, bodySeconds: .115,
    noiseHz: 6200, noiseQ: 1.8, noiseSeconds: .14,
    bodyLevel: .43, noiseLevel: .31, bodyType: "sawtooth", filter: "highpass",
  },
  wonder_hellfire: {
    // Long, overlapping pressurized combustion wash. No tonal firearm
    // body or muzzle transient; the gradual noise envelope sounds like fire.
    bodyHz: 100, bodyEndHz: 100, bodySeconds:.48,noiseHz:1050,
    noiseQ:.48,noiseSeconds:.56,bodyLevel:0,noiseLevel:.38,
    bodyType:"sine",filter:"lowpass",
  },
};


/**
 * An unsuppressed gun needs a separate, very fast broadband muzzle crack and
 * a short low-frequency pressure pulse. The older band-limited noise/body
 * pair alone made even bare muzzles resemble suppressed shots.
 *
 * Keep these separate from the tonal signatures: the impact is quick and dry,
 * while the existing profile controls the caliber / mechanical tail.
 */
interface ImpactProfile {
  crackHz: number;
  crackSeconds: number;
  crackLevel: number;
  punchHz: number;
  punchSeconds: number;
  punchLevel: number;
}

const IMPACTS: Record<WeaponSoundCategory, ImpactProfile> = {
  assault:  { crackHz: 1650, crackSeconds: .019, crackLevel: 1.00, punchHz: 76, punchSeconds: .095, punchLevel: .52 },
  smg:      { crackHz: 2300, crackSeconds: .013, crackLevel: .94, punchHz: 106, punchSeconds: .055, punchLevel: .32 },
  shotgun:  { crackHz: 1580, crackSeconds: .020, crackLevel: 1.38, punchHz: 63, punchSeconds: .145, punchLevel: .72 },
  dmr:      { crackHz: 1700, crackSeconds: .025, crackLevel: 1.16, punchHz: 72, punchSeconds: .125, punchLevel: .66 },
  sniper:   { crackHz: 1150, crackSeconds: .039, crackLevel: 1.36, punchHz: 54, punchSeconds: .240, punchLevel: 1.00 },
  lmg:      { crackHz: 1550, crackSeconds: .019, crackLevel: 1.04, punchHz: 70, punchSeconds: .115, punchLevel: .68 },
  pistol:   { crackHz: 2150, crackSeconds: .017, crackLevel: 1.00, punchHz: 94, punchSeconds: .065, punchLevel: .35 },
  pdw:      { crackHz: 2550, crackSeconds: .012, crackLevel: .98, punchHz: 108, punchSeconds: .052, punchLevel: .30 },
  melee:    { crackHz: 1900, crackSeconds: .010, crackLevel: 0, punchHz: 120, punchSeconds: .050, punchLevel: 0 },
  launcher: { crackHz: 950, crackSeconds: .028, crackLevel: .60, punchHz: 46, punchSeconds: .245, punchLevel: 1.00 },
};

// Preserve the synthetic identity of sci-fi weapons and the quiet crossbow;
// they should not inherit a conventional firearm's sharp muzzle report.
const SPECIAL_IMPACTS: Record<string, ImpactProfile> = {
  shotgun_combat:    { crackHz: 1800, crackSeconds: .014, crackLevel: 1.78, punchHz: 82, punchSeconds: .098, punchLevel: .62 },
  rifle_electron:     { crackHz: 3500, crackSeconds: .017, crackLevel: .32, punchHz: 115, punchSeconds: .080, punchLevel: .18 },
  crossbow_reclaimer: { crackHz: 2600, crackSeconds: .009, crackLevel: .12, punchHz: 105, punchSeconds: .045, punchLevel: .10 },
  pistol_bastion:    { crackHz: 2050, crackSeconds: .024, crackLevel: 1.23, punchHz: 78, punchSeconds: .123, punchLevel: .62 },
  pistol_arc:        { crackHz: 4100, crackSeconds: .016, crackLevel: .44, punchHz: 125, punchSeconds: .055, punchLevel: .15 },
  wonder_hellfire:   { crackHz: 140, crackSeconds: .005, crackLevel: 0, punchHz: 80, punchSeconds: .005, punchLevel: 0 },
};

/** Open, broadband combustion blast that follows the first muzzle snap.
 * A separate short report is necessary: tonal bass and band-limited hiss alone
 * still sound like an oversized suppressor, particularly on the Mauler CS.
 */
interface BlastProfile {
  highpassHz: number;
  lowpassHz: number;
  seconds: number;
  level: number;
}
const SHOTGUN_BLAST: BlastProfile = { highpassHz: 255, lowpassHz: 10500, seconds: .128, level: .94 };
const MAULER_BLAST: BlastProfile = { highpassHz: 310, lowpassHz: 11500, seconds: .094, level: 1.32 };

/** Pure acoustic calculations, also used by regression tests. */
export function resolveShotAcoustics(
  category: WeaponSoundCategory,
  options: { weaponId?: string; suppressed?: boolean; distance?: number; volume?: number; aiming?: boolean; environment?: WeaponAcousticSpace } = {},
) {
  const impact = SPECIAL_IMPACTS[options.weaponId ?? ""] ?? IMPACTS[category];
  const blast = options.weaponId === "shotgun_combat" ? MAULER_BLAST
    : category === "shotgun" && !options.weaponId?.startsWith("wonder_") ? SHOTGUN_BLAST : null;
  const suppressed = !!options.suppressed && category !== "melee";
  const distance = Math.max(0, options.distance ?? 0);
  const attenuation = distance >= 90 ? 0 : Math.pow(1 / (1 + distance * .046), 1.35)
    * Math.max(0, 1 - Math.pow(distance / 90, 3));
  const level = (suppressed ? .48 : 1) * attenuation
    * Math.min(1.2, Math.max(0, options.volume ?? 1));
  // Conventional bare muzzles have both a heavier pressure kick and a
  // brighter transient. Keep these boosts OUT of suppressed and experimental
  // electronic/quiet weapons so the silencer remains meaningfully muffled.
  const conventional = category !== "melee" &&
    !["rifle_electron", "crossbow_reclaimer", "pistol_arc", "wonder_hellfire"].includes(options.weaponId ?? "");
  const bassBoost = conventional && !suppressed ? 1.9 : 1;
  const trebleBoost = conventional && !suppressed ? 1.26 : 1;
  const space = options.environment ?? "outdoor";
  // Dry report and weapon action supply the missing midrange texture. The
  // mechanism is deliberately audible on a suppressor, not loud broadband fire.
  const reportSize: Partial<Record<WeaponSoundCategory, number>> = {
    assault: .65, smg: .47, shotgun: .9, dmr: .77, sniper: .88,
    lmg: .8, pistol: .49, pdw: .45, launcher: .65,
  };
  const mechanicalSize: Partial<Record<WeaponSoundCategory, number>> = {
    assault: .23, smg: .2, shotgun: .34, dmr: .28, sniper: .39,
    lmg: .32, pistol: .22, pdw: .20, launcher: .12,
  };
  const nonBallistic = category === "melee" ||
    ["rifle_electron", "pistol_arc", "wonder_hellfire", "crossbow_reclaimer"].includes(options.weaponId ?? "") ||
    !!options.weaponId?.startsWith("wonder_");
  const tailGain = space === "indoor" ? .32 : space === "urban" ? .21 : .11;
  return {
    level,
    suppressed,
    // Close unsuppressed shots stay OPEN; only suppressors and distance roll off highs.
    cutoffHz: suppressed ? Math.max(650, 1400 - distance * 9)
      : distance > 7 ? Math.max(1700, 8500 - distance * 85) : null,
    crackHz: impact.crackHz,
    crackSeconds: impact.crackSeconds,
    crackLevel: impact.crackLevel * level * (suppressed ? .06 : trebleBoost),
    punchHz: impact.punchHz,
    punchSeconds: impact.punchSeconds,
    punchLevel: impact.punchLevel * level * (suppressed ? .55 : bassBoost),
    blastHighpassHz: blast?.highpassHz ?? 0,
    blastLowpassHz: blast?.lowpassHz ?? 0,
    blastSeconds: blast?.seconds ?? 0,
    blastLevel: (blast?.level ?? 0) * level * (suppressed ? .09 : 1.12),
    // Keep the report distinct from the thin broadband transient.
    reportLevel: (nonBallistic ? 0 : reportSize[category] ?? 0) * level * (suppressed ? .045 : 1),
    reportSeconds: category === "sniper" || category === "shotgun" ? .078 : .051,
    mechanicalLevel: (nonBallistic ? (options.weaponId === "crossbow_reclaimer" ? .13 : 0) : mechanicalSize[category] ?? 0)
      * level * (suppressed ? 1.45 : 1),
    mechanicalHz: category === "shotgun" ? 2450 : category === "sniper" ? 1770 : category === "lmg" ? 1330 : 3200,
    mechanicalDelay: category === "shotgun" ? .115 : category === "sniper" ? .086 : .022,
    tailLevel: (nonBallistic ? 0 : tailGain) * level * (suppressed ? .18 : 1),
    tailDelay: space === "indoor" ? .029 : space === "urban" ? .074 : .105,
    tailSeconds: space === "indoor" ? .19 : space === "urban" ? .26 : .35,
    tailHz: space === "indoor" ? 2950 : space === "urban" ? 1950 : 1100,
  };
}

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
  private readonly maxVoices = 32;
  private lastFlameHissAt = -Infinity; // prevent Web Audio overload during bot-heavy firefights
  private lastLocalTailAt = -Infinity; // first-person reflections outrank remote volleys
  private lastRemoteTailAt = -Infinity;
  private recordingLoadStarted = false;
  private recordings: Partial<Record<RecordedShotFamily, AudioBuffer[]>> = {};
  private disposed = false;

  constructor(masterVolume = 70) {
    this.volume = Math.min(100, Math.max(0, masterVolume));
  }

  setVolume(masterVolume: number): void {
    this.volume = Math.min(100, Math.max(0, masterVolume));
    if (this.ctx && this.output) {
      this.output.gain.setTargetAtTime((this.volume / 100) * WEAPON_OUTPUT_SCALE, this.ctx.currentTime, 0.012);
    }
  }

  /** Decode tiny, locally served CC0 reports exactly once per active sound context.
   * No shot ever blocks on fetch/decode; failed files transparently use synthesis. */
  private async loadRecordings(ctx: AudioContext): Promise<void> {
    await Promise.all((Object.entries(RECORDED_REPORTS) as [RecordedShotFamily, readonly string[]][])
      .map(async ([family, paths]) => {
        const buffers = await Promise.all(paths.map(async (path): Promise<AudioBuffer | null> => {
          try {
            const response = await fetch(path, { cache: "force-cache" });
            if (!response.ok) return null;
            const encoded = (await response.text()).replace(/\s/g, "");
            // The repository stores these as ASCII base64 WAVs, keeping the original
            // CC0 samples lossless without relying on binary GitHub connector writes.
            const raw = atob(encoded);
            const bytes = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
            return await ctx.decodeAudioData(bytes.buffer);
          } catch {
            return null;
          }
        }));
        if (!this.disposed && this.ctx === ctx) {
          this.recordings[family] = buffers.filter((buffer): buffer is AudioBuffer => buffer !== null);
        }
      }));
  }

  /** Invoke from a genuine browser user interaction to permit Web Audio output. */
  unlock(): void {
    if (this.disposed || typeof window === "undefined") return;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        const compressor = this.ctx.createDynamicsCompressor();
        // Let the first 8 ms of the muzzle snap through before controlling
        // the louder blast/tail. Fast 1.5 ms compression erased the impact.
        compressor.threshold.value = -10;
        compressor.knee.value = 7;
        compressor.ratio.value = 2;
        compressor.attack.value = 0.012;
        compressor.release.value = 0.085;
        // Preserve the shot transient and tame concurrent-fire peaks.
        const peakGuard = createOutputPeakGuard(this.ctx);
        compressor.connect(peakGuard);
        peakGuard.connect(this.ctx.destination);
        this.output = this.ctx.createGain();
        this.output.gain.value = (this.volume / 100) * WEAPON_OUTPUT_SCALE;
        this.output.connect(compressor);

        // Shared white-noise buffer is created once, not for every shot.
        const length = Math.ceil(this.ctx.sampleRate * 0.72);
        this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const samples = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
        if (!this.recordingLoadStarted) {
          this.recordingLoadStarted = true;
          void this.loadRecordings(this.ctx);
        }
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
    /** ADS is accepted for regression coverage; it never changes shot acoustics. */
    aiming?: boolean;
    environment?: WeaponAcousticSpace;
    /** World distance to the sound source in game units; omit for local shots. */
    distance?: number;
    /** -1 left, +1 right (relative to camera direction). */
    pan?: number;
    /** Local per-event mix multiplier, typically 0.5..1. */
    volume?: number;
  } = {}): void {
    // Reserve several voices for the player when the arena is extremely busy.
    // Remote firefights must not exhaust voices reserved for the local gun.
    const voiceLimit = options.distance === undefined ? this.maxVoices + 8 : Math.max(4,this.maxVoices - 6);
    if (this.volume === 0 || this.disposed || this.activeVoices >= voiceLimit) return;
    this.unlock(); // Recover a suspended context on every real shot, including scoped ADS.
    const ctx = this.ctx;
    const out = this.output;
    if (!ctx || !out || !this.noiseBuffer) return;
    const isFlame = options.weaponId === "wonder_hellfire";
    if (isFlame) {
      // Continuous flamethrower sound: one overlapping wash every ~430ms,
      // never eight distinct gunshot transients per second.
      const at = ctx.currentTime;
      if (at - this.lastFlameHissAt < .43) return;
      this.lastFlameHissAt = at;
    }
    const profile = SPECIAL_PROFILES[options.weaponId ?? ""] ?? PROFILES[category];
    if (!profile) return;

    if (ctx.state === "closed") return;
    const acoustics = resolveShotAcoustics(category, options);
    if (acoustics.level < .006) return;
    const now = ctx.currentTime;
    // Tiny per-shot variance prevents machine-like repetition without changing
    // the weapon's consistent class- and model-specific identity.
    const pitch = weaponPitch(options.weaponId ?? category) * (.983 + Math.random() * .034);
    const { level, suppressed } = acoustics;

    const spatialPan = options.pan === undefined ? null : ctx.createStereoPanner();
    if (spatialPan) {
      spatialPan.pan.value = Math.max(-1, Math.min(1, options.pan!));
      spatialPan.connect(out);
    }
    const tonalFilter = acoustics.cutoffHz === null ? null : ctx.createBiquadFilter();
    if (tonalFilter) {
      tonalFilter.type = "lowpass";
      tonalFilter.frequency.value = acoustics.cutoffHz!;
      tonalFilter.Q.value = .55;
      tonalFilter.connect(spatialPan ?? out);
    }
    const destination = tonalFilter ?? spatialPan ?? out;
    const bodyTime = profile.bodySeconds * (suppressed ? .72 : 1);
    const noiseTime = profile.noiseSeconds * (suppressed ? .55 : 1);
    this.activeVoices++;

    // A shot counts as ONE voice even though it uses several short layers.
    // Track every ended node so high-rate automatic fire cannot leak graphs.
    let remaining = 0;
    const track = (source: AudioScheduledSourceNode, nodes: AudioNode[]) => {
      remaining++;
      source.onended = () => {
        for (const node of nodes) node.disconnect();
        remaining--;
        if (remaining === 0) {
          this.activeVoices = Math.max(0, this.activeVoices - 1);
          tonalFilter?.disconnect();
          spatialPan?.disconnect();
        }
      };
    };
    const shape = (gain: GainNode, peak: number, attack: number, length: number, start = now) => {
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(.0001, peak), start + attack);
      gain.gain.exponentialRampToValueAtTime(.0001, start + length);
    };

    // A sampled near-field report carries the complex real muzzle transient.
    // Lower the old synthetic transient/report rather than piling two blasts
    // together. Mechanism, weight, and spatial reflection remain distinct.
    const family = recordedFamilyFor(category, options.weaponId);
    const takes = family && !suppressed && (options.distance === undefined || options.distance < 45)
      ? this.recordings[family] : undefined;
    const recorded = takes?.length ? takes[Math.floor(Math.random() * takes.length)] : null;
    const proceduralBlend = recorded ? .28 : 1;
    if (recorded) {
      const sample = ctx.createBufferSource();
      sample.buffer = recorded;
      sample.playbackRate.value = pitch * (.99 + Math.random() * .02);
      const sampleGain = ctx.createGain();
      sampleGain.gain.value = level * .78;
      sample.connect(sampleGain).connect(destination);
      track(sample, [sample, sampleGain]);
      sample.start(now);
      sample.stop(now + Math.min(.48, recorded.duration / sample.playbackRate.value));
    }

    // Caliber body: audible mid/low sweep rather than just a sine-like bass tone.
    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = profile.bodyType;
    body.frequency.setValueAtTime(profile.bodyHz * pitch, now);
    body.frequency.exponentialRampToValueAtTime(Math.max(22, profile.bodyEndHz * pitch), now + bodyTime);
    shape(bodyGain, profile.bodyLevel * level * .80 * (recorded ? .62 : 1), .0015, bodyTime);
    body.connect(bodyGain).connect(destination);
    track(body, [body, bodyGain]);
    body.start(now);
    body.stop(now + bodyTime + .008);

    // Textured midrange report, separate from the initial muzzle transient.
    const burst = ctx.createBufferSource();
    burst.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = profile.filter;
    filter.Q.value = profile.noiseQ;
    filter.frequency.setValueAtTime(profile.noiseHz * pitch, now);
    if (category === "melee") filter.frequency.exponentialRampToValueAtTime(440 * pitch, now + noiseTime);
    else if (category === "sniper") filter.frequency.exponentialRampToValueAtTime(650 * pitch, now + noiseTime);
    const burstGain = ctx.createGain();
    shape(burstGain, profile.noiseLevel * level * .75 * proceduralBlend,
      isFlame ? .09 : category === "melee" ? .037 : .0013, noiseTime);
    burst.connect(filter).connect(burstGain).connect(destination);
    track(burst, [burst, filter, burstGain]);
    burst.start(now, Math.random() * .09);
    burst.stop(now + noiseTime + .008);

    // Open shotgun report: a short, wide-spectrum pressure burst. It is NOT
    // routed through the legacy lowpass noise filter; the Mauler's main noise
    // already sounds like a sharp bang rather than a suppressed "whump".
    if (!isFlame && acoustics.blastLevel > .01) {
      const blast = ctx.createBufferSource();
      blast.buffer = this.noiseBuffer;
      const blastHigh = ctx.createBiquadFilter();
      blastHigh.type = "highpass";
      blastHigh.frequency.value = acoustics.blastHighpassHz * pitch;
      blastHigh.Q.value = .55;
      const blastLow = ctx.createBiquadFilter();
      blastLow.type = "lowpass";
      blastLow.frequency.value = Math.min(acoustics.blastLowpassHz, ctx.sampleRate * .43);
      blastLow.Q.value = .55;
      const blastGain = ctx.createGain();
      shape(blastGain, acoustics.blastLevel * .72 * proceduralBlend, .00035, acoustics.blastSeconds);
      blast.connect(blastHigh).connect(blastLow).connect(blastGain).connect(destination);
      track(blast, [blast, blastHigh, blastLow, blastGain]);
      blast.start(now, Math.random() * .11);
      blast.stop(now + acoustics.blastSeconds + .006);
    }

    // Dry muzzle crack: broadband 1.2–9k transient lasting only 10–40ms.
    // This is intentionally absent from a genuinely suppressed shot.
    if (!isFlame && acoustics.crackLevel > .02) {
      const crack = ctx.createBufferSource();
      crack.buffer = this.noiseBuffer;
      const crackHigh = ctx.createBiquadFilter();
      crackHigh.type = "highpass";
      crackHigh.frequency.value = acoustics.crackHz * pitch;
      const crackLow = ctx.createBiquadFilter();
      crackLow.type = "lowpass";
      crackLow.frequency.value = Math.min(12000, ctx.sampleRate * .43);
      const crackGain = ctx.createGain();
      shape(crackGain, acoustics.crackLevel * .85 * proceduralBlend, .0007, acoustics.crackSeconds);
      crack.connect(crackHigh).connect(crackLow).connect(crackGain).connect(destination);
      track(crack, [crack, crackHigh, crackLow, crackGain]);
      crack.start(now, Math.random() * .07);
      crack.stop(now + acoustics.crackSeconds + .006);
    }

    // Pressure pulse: fast, pitched-down low-frequency impact instead of
    // prolonged muffled rumble. Heavy guns get a lower, longer thump.
    if (!isFlame && acoustics.punchLevel > .01) {
      const punch = ctx.createOscillator();
      punch.type = "sine";
      const punchGain = ctx.createGain();
      punch.frequency.setValueAtTime(acoustics.punchHz * pitch * 1.30, now);
      punch.frequency.exponentialRampToValueAtTime(acoustics.punchHz * pitch * .72, now + acoustics.punchSeconds);
      shape(punchGain, acoustics.punchLevel * .72 * (recorded ? .58 : 1), .002, acoustics.punchSeconds);
      punch.connect(punchGain).connect(destination);
      const bodyPunch=ctx.createOscillator(), bodyPunchGain=ctx.createGain();
      bodyPunch.type="triangle";
      bodyPunch.frequency.setValueAtTime(acoustics.punchHz*pitch*2.4,now);
      bodyPunch.frequency.exponentialRampToValueAtTime(acoustics.punchHz*pitch*1.4,now+acoustics.punchSeconds);
      shape(bodyPunchGain,acoustics.punchLevel*.26*(recorded ? .58 : 1),.001,acoustics.punchSeconds*.8);
      bodyPunch.connect(bodyPunchGain).connect(destination);
      track(bodyPunch,[bodyPunch,bodyPunchGain]);
      bodyPunch.start(now);bodyPunch.stop(now+acoustics.punchSeconds+.008);
      track(punch, [punch, punchGain]);
      punch.start(now);
      punch.stop(now + acoustics.punchSeconds + .008);
    }

    // The old filtered-noise body had almost no 300 Hz–8 kHz energy after the
    // muzzle tick, creating the perception of a muted gun. Give conventional
    // shots a separate short, full-bodied pressure report. No added boom to
    // electronic / bow / flame Wonder Weapons.
    if (acoustics.reportLevel > .01) {
      const report = ctx.createBufferSource();
      report.buffer = this.noiseBuffer;
      const reportHigh = ctx.createBiquadFilter();
      reportHigh.type = "highpass";
      reportHigh.frequency.value = (category === "shotgun" || category === "sniper" ? 220 : 360) * pitch;
      const reportGain = ctx.createGain();
      shape(reportGain, acoustics.reportLevel * .47 * proceduralBlend, .0006, acoustics.reportSeconds);
      report.connect(reportHigh).connect(reportGain).connect(destination);
      track(report, [report, reportHigh, reportGain]);
      report.start(now, Math.random() * .14);
      report.stop(now + acoustics.reportSeconds + .006);
    }

    // Receiver / bolt / pump action: metallic short clack just AFTER the shot.
    // Suppressors remove the muzzle report, but don't silence the mechanism.
    if (acoustics.mechanicalLevel > .01) {
      const action = ctx.createBufferSource();
      action.buffer = this.noiseBuffer;
      const actionFilter = ctx.createBiquadFilter();
      actionFilter.type = "bandpass";
      actionFilter.frequency.value = acoustics.mechanicalHz * pitch;
      actionFilter.Q.value = 2.4;
      const actionGain = ctx.createGain();
      const actionStart = now + acoustics.mechanicalDelay;
      shape(actionGain, acoustics.mechanicalLevel * .40, .001, .034, actionStart);
      action.connect(actionFilter).connect(actionGain).connect(destination);
      track(action, [action, actionFilter, actionGain]);
      action.start(actionStart, Math.random() * .16);
      action.stop(actionStart + .041);
    }

    // Location gives a gun report a sense of scale. A low-level, delayed and
    // filtered reflection (not another dry shot) makes exteriors feel open and
    // an enclosed bunker punch back quickly. Cap tails under automatic fire
    // and on dense multiplayer servers; never let reflections mask footsteps.
    const localShot = options.distance === undefined;
    const lastTail = localShot ? this.lastLocalTailAt : this.lastRemoteTailAt;
    if (acoustics.tailLevel > .01 && (localShot || (options.distance! < 50 && this.activeVoices < 24))
        && now - lastTail > (localShot ? .14 : .23)) {
      if (localShot) this.lastLocalTailAt = now;
      else this.lastRemoteTailAt = now;
      const tail = ctx.createBufferSource();
      tail.buffer = this.noiseBuffer;
      const tailFilter = ctx.createBiquadFilter();
      tailFilter.type = "bandpass";
      tailFilter.frequency.value = acoustics.tailHz * pitch;
      tailFilter.Q.value = .58;
      const tailGain = ctx.createGain();
      const tailStart = now + acoustics.tailDelay;
      shape(tailGain, acoustics.tailLevel * .36, .014, acoustics.tailSeconds, tailStart);
      tail.connect(tailFilter).connect(tailGain).connect(destination);
      track(tail, [tail, tailFilter, tailGain]);
      tail.start(tailStart, Math.random() * .09);
      tail.stop(tailStart + acoustics.tailSeconds + .008);
    }
  }

  /** Distinct two-note elimination chime. Invoked only for a confirmed local kill. */
  playElimination(headshot = false): void {
    if (this.disposed || this.volume <= 0) return;
    this.unlock(); // Recover a suspended context on every real shot, including scoped ADS.
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
    this.recordings = {};
  }
}
