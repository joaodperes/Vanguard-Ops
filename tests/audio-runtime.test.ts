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

interface AudioInternals {
  outputGain: FakeGain;
  masterGain: FakeGain;
  footstepGain: FakeGain;
  ambientGain: FakeGain;
  musicLayer: FakeGain;
  retiredMusicLayers: { node: FakeGain; removeAt: number }[];
  ambientTheme: string;
}
const previousWindow = (globalThis as any).window;
beforeEach(() => {
  (globalThis as any).window = { AudioContext: FakeAudioContext };
  FakeAudioContext.last = null;
});
afterEach(() => {
  if (previousWindow === undefined) delete (globalThis as any).window;
  else (globalThis as any).window = previousWindow;
});

describe("SoundManager browser audio graph", () => {
  test("uses separate routed buses, keeping master volume above all channels", () => {
    const sm = new SoundManager();
    sm.setMasterVolume(0.75);
    sm.setMusicVolume(0.3);
    sm.setFootstepVolume(0.5);
    sm.setFxVolume(0.2);
    sm.resume();
    const a = sm as unknown as AudioInternals;
    const ctx = FakeAudioContext.last!;
    expect(a.outputGain.connections).toContain(ctx.destination);
    expect(a.masterGain.connections).toContain(a.outputGain);
    expect(a.footstepGain.connections).toContain(a.outputGain);
    expect(a.ambientGain.connections).toContain(a.outputGain);
    expect(a.musicLayer.connections).toContain(a.ambientGain);
    expect(a.outputGain.gain.value).toBe(0.75);
    expect(a.masterGain.gain.value).toBe(0.2);
    expect(a.footstepGain.gain.value).toBe(0.5);
    expect(a.ambientGain.gain.value).toBe(0);
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

  test("starts the menu track and crossfades to a distinct lobby/map arrangement", () => {
    const sm = new SoundManager(); sm.resume();
    const a = sm as unknown as AudioInternals;
    const ctx = FakeAudioContext.last!;
    sm.tickAmbientMusic(true, "menu");
    const firstLayer = a.musicLayer;
    const menuNote = ctx.oscillators.find(o => o.type === "sine" && o.startedAt !== null);
    expect(menuNote).toBeDefined();
    expect(a.ambientTheme).toBe("menu");
    // Music is intentionally a quiet bed under gunfire and footsteps.
    expect(a.ambientGain.gain.value).toBeCloseTo(0.65 * 0.115);
    const afterMenu = ctx.oscillators.length;

    ctx.currentTime = 1.7;
    sm.tickAmbientMusic(true, "lobby");
    expect(a.ambientTheme).toBe("lobby");
    expect(a.musicLayer).not.toBe(firstLayer);
    expect(a.retiredMusicLayers.some(x => x.node === firstLayer)).toBe(true);
    expect(firstLayer.gain.targets).toContain(0);
    expect(ctx.oscillators.length).toBeGreaterThan(afterMenu);

    ctx.currentTime = 2.4;
    sm.tickAmbientMusic(true, "bunker");
    expect(a.ambientTheme).toBe("bunker");
    expect(a.musicLayer.connections).toContain(a.ambientGain);
    sm.tickAmbientMusic(false, "bunker");
    expect(a.ambientGain.gain.value).toBe(0);
    sm.dispose();
  });

  test("music at zero stops scheduling notes but leaves the other buses audible", () => {
    const sm = new SoundManager(); sm.resume();
    const a = sm as unknown as AudioInternals;
    const ctx = FakeAudioContext.last!;
    sm.setMusicVolume(0);
    sm.tickAmbientMusic(true, "shipyard");
    expect(ctx.oscillators.length).toBe(0);
    expect(a.ambientGain.gain.value).toBe(0);
    expect(a.footstepGain.gain.value).toBe(0.85);
    expect(a.masterGain.gain.value).toBe(1);
    sm.setMusicVolume(0.5);
    sm.tickAmbientMusic(true, "shipyard");
    expect(ctx.oscillators.length).toBeGreaterThan(0);
    sm.dispose();
  });
});
