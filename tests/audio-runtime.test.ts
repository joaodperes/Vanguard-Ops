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

interface AudioInternals { outputGain: FakeGain; masterGain: FakeGain; footstepGain: FakeGain; }
let musicAudioInstances = 0;
class FakeHtmlAudio { constructor() { musicAudioInstances++; } }
const previousWindow = (globalThis as any).window;
const previousAudio = (globalThis as any).Audio;
beforeEach(() => {
  (globalThis as any).window = { AudioContext: FakeAudioContext };
  (globalThis as any).Audio = FakeHtmlAudio;
  FakeAudioContext.last = null; musicAudioInstances = 0;
});
afterEach(() => {
  if (previousWindow === undefined) delete (globalThis as any).window;
  else (globalThis as any).window = previousWindow;
  if (previousAudio === undefined) delete (globalThis as any).Audio;
  else (globalThis as any).Audio = previousAudio;
});
describe("SoundManager browser audio graph", () => {
  test("routes FX and footsteps through WebAudio without music", () => {
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

  test("no HTML audio element is ever constructed for background music", () => {
    const sm = new SoundManager(); sm.resume();
    sm.play("swap", { volume: 0.3 });
    expect(musicAudioInstances).toBe(0);
    sm.dispose();
    expect(musicAudioInstances).toBe(0);
  });
});
