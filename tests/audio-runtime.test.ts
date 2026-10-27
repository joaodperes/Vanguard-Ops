import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { SoundManager } from "../src/lib/sound";

/** Minimal Web Audio graph spy: checks actual SoundManager routing and
 * scheduling without claiming to reproduce loudspeakers or browser acoustics.
 */
class FakeParam {
  value: number;
  targets: number[] = [];
  constructor(initial: number) { this.value = initial; }
  setTargetAtTime(value: number) { this.value = value; this.targets.push(value); }
  setValueAtTime(value: number) { this.value = value; }
  linearRampToValueAtTime(value: number) { this.value = value; }
  exponentialRampToValueAtTime(value: number) { this.value = value; }
}
class FakeNode {
  connections: FakeNode[] = [];
  connect(destination: FakeNode): FakeNode { this.connections.push(destination); return destination; }
  disconnect(): void { this.connections = []; }
}
class FakeGain extends FakeNode { gain = new FakeParam(1); }
class FakeOscillator extends FakeNode {
  type = "sine";
  frequency = new FakeParam(440);
  onended: (() => void) | null = null;
  startedAt: number | null = null;
  stoppedAt: number | null = null;
  start(at: number): void { this.startedAt = at; }
  stop(at: number): void { this.stoppedAt = at; }
}
class FakeSource extends FakeNode {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  start(): void {}
  stop(): void {}
}
class FakeFilter extends FakeNode {
  type = "lowpass";
  frequency = new FakeParam(350);
  Q = new FakeParam(1);
}
class FakeConvolver extends FakeNode { buffer: unknown = null; }
class FakeBuffer {
  private channels: Float32Array[];
  constructor(count: number, length: number) {
    this.channels = Array.from({ length: count }, () => new Float32Array(length));
  }
  getChannelData(channel: number): Float32Array { return this.channels[channel]; }
}
class FakeAudioContext {
  static last: FakeAudioContext | null = null;
  currentTime = 1;
  sampleRate = 100;
  state = "running";
  destination = new FakeNode();
  oscillators: FakeOscillator[] = [];
  constructor() { FakeAudioContext.last = this; }
  createGain(): FakeGain { return new FakeGain(); }
  createBuffer(channels: number, length: number): FakeBuffer { return new FakeBuffer(channels, length); }
  createConvolver(): FakeConvolver { return new FakeConvolver(); }
  createOscillator(): FakeOscillator {
    const osc = new FakeOscillator(); this.oscillators.push(osc); return osc;
  }
  createBufferSource(): FakeSource { return new FakeSource(); }
  createBiquadFilter(): FakeFilter { return new FakeFilter(); }
  async resume(): Promise<void> { this.state = "running"; }
  async close(): Promise<void> { this.state = "closed"; }
}

/** Recorded music now uses independent HTML audio elements, not a WebAudio
 * oscillator or ambient gain node. The fake spies on actual media playback. */
class FakeHtmlAudio {
  static instances: FakeHtmlAudio[] = [];
  src = "";
  volume = 0;
  loop = false;
  preload = "";
  paused = true;
  onerror: (() => void) | null = null;
  playCount = 0;
  constructor(){ FakeHtmlAudio.instances.push(this); }
  play(): Promise<void> { this.playCount++; this.paused = false; return Promise.resolve(); }
  pause(): void { this.paused = true; }
  load(): void {}
  removeAttribute(name:string): void { if(name==="src")this.src=""; }
}
interface FakeMusicSlot { audio: FakeHtmlAudio; track:{id:string}; startedAt:number; from:number; to:number }
interface AudioInternals {
  outputGain: FakeGain;
  masterGain: FakeGain;
  footstepGain: FakeGain;
  recordedMusic: {
    current: FakeMusicSlot | null;
    outgoing: FakeMusicSlot | null;
    tick(active:boolean,theme:string,now:number):void;
  };
}
const previousWindow = (globalThis as any).window;
const previousAudio = (globalThis as any).Audio;
beforeEach(() => {
  (globalThis as any).window = { AudioContext: FakeAudioContext };
  (globalThis as any).Audio = FakeHtmlAudio;
  FakeAudioContext.last = null;
  FakeHtmlAudio.instances = [];
});
afterEach(() => {
  if (previousWindow === undefined) delete (globalThis as any).window;
  else (globalThis as any).window = previousWindow;
  if (previousAudio === undefined) delete (globalThis as any).Audio;
  else (globalThis as any).Audio = previousAudio;
});

describe("SoundManager browser audio graph", () => {
  test("routes FX and footsteps through WebAudio while licensed music is independent", () => {
    const sm=new SoundManager();
    sm.setMasterVolume(.75); sm.setMusicVolume(.3);
    sm.setFootstepVolume(.5); sm.setFxVolume(.2);
    sm.resume();
    const a=sm as unknown as AudioInternals;
    const ctx=FakeAudioContext.last!;
    expect(a.outputGain.connections).toContain(ctx.destination);
    expect(a.masterGain.connections).toContain(a.outputGain);
    expect(a.footstepGain.connections).toContain(a.outputGain);
    expect(a.outputGain.gain.value).toBe(.75);
    expect(a.masterGain.gain.value).toBe(.2);
    expect(a.footstepGain.gain.value).toBe(.5);
    sm.tickAmbientMusic(true,"menu");
    expect(a.recordedMusic.current?.audio).toBeDefined();
    expect(a.recordedMusic.current?.audio.playCount).toBeGreaterThan(0);
    sm.dispose();
  });

  test("changing footstep and FX sliders does not change either other bus", () => {
    const sm = new SoundManager(); sm.resume();
    const a = sm as unknown as AudioInternals;
    sm.setFxVolume(0);
    expect(a.masterGain.gain.value).toBe(0);
    expect(a.footstepGain.gain.value).toBe(0.85);
    sm.setFootstepVolume(0);
    expect(a.footstepGain.gain.value).toBe(0);
    expect(a.masterGain.gain.value).toBe(0);
    sm.setFxVolume(1);
    expect(a.masterGain.gain.value).toBe(1);
    expect(a.footstepGain.gain.value).toBe(0);
    sm.dispose();
  });

  test("mute overrides master; unmute restores the selected master setting", () => {
    const sm = new SoundManager(); sm.resume();
    const a = sm as unknown as AudioInternals;
    sm.setMasterVolume(0.42);
    sm.setMuted(true);
    expect(a.outputGain.gain.value).toBe(0);
    sm.setMuted(false);
    expect(a.outputGain.gain.value).toBe(0.42);
    sm.dispose();
  });

  test("crossfades between distinct licensed recordings instead of oscillator themes", () => {
    const sm=new SoundManager(); sm.resume();
    const a=sm as unknown as AudioInternals;
    const player=a.recordedMusic;
    player.tick(true,"menu",1000);
    const first=player.current!;
    expect(first.audio.src).toBeTruthy();
    expect(first.audio.playCount).toBeGreaterThan(0);
    player.tick(true,"menu",2300);
    expect(first.audio.volume).toBeGreaterThan(0);
    player.tick(true,"lobby",2400);
    expect(player.current).not.toBe(first);
    expect(player.current?.track.id).not.toBe(first.track.id);
    expect(player.outgoing).toBe(first);
    player.tick(true,"lobby",2800);
    expect(first.audio.volume).toBeLessThan(.65*.8*.16);
    player.tick(true,"bunker",3000);
    expect(player.current?.track.id).not.toBe(first.track.id);
    player.tick(false,"bunker",4300);
    expect(player.current?.audio.paused).toBe(true);
    sm.dispose();
  });

  test("zero music volume mutes recorded playback, not weapon or footstep buses", () => {
    const sm=new SoundManager(); sm.resume();
    const a=sm as unknown as AudioInternals;
    const ctx=FakeAudioContext.last!;
    sm.setMusicVolume(0);
    sm.tickAmbientMusic(true,"shipyard");
    expect(ctx.oscillators.length).toBe(0);
    expect(a.recordedMusic.current?.audio.paused).toBe(true);
    expect(a.footstepGain.gain.value).toBe(.85);
    expect(a.masterGain.gain.value).toBe(1);
    sm.setMusicVolume(.5);
    sm.tickAmbientMusic(true,"shipyard");
    expect(a.recordedMusic.current?.audio.playCount).toBeGreaterThan(0);
    expect(ctx.oscillators.length).toBe(0); // music is now a recording
    sm.dispose();
  });

});
