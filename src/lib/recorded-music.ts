import type { MusicThemeId } from "./music-themes";
import { MUSIC_FOR_THEME, type LicensedMusicTrack } from "./music-recordings";

/** Real music is mixed independently from Web Audio combat effects.
 * HTMLAudioElement intentionally avoids requiring third-party CORS headers.
 * We use local bundled assets by default, falling back to the artist's MP3
 * only if the local file is absent in an older deployment.
 */
interface PlayingTrack {
  audio: HTMLAudioElement;
  track: LicensedMusicTrack;
  startedAt: number;
  from: number;
  to: number;
}

const FADE_MS = 1100;
const BED_GAIN = 0.16; // below footsteps and unsuppressed gunshots
const clamp = (value: number) => Math.min(1, Math.max(0, value));

export class RecordedMusicPlayer {
  private current: PlayingTrack | null = null;
  private outgoing: PlayingTrack | null = null;
  private unlocked = false;
  private active = false;
  private theme: MusicThemeId = "menu";
  // Match SoundManager defaults even before the Settings store initializes.
  private level = 0.8 * 0.65 * BED_GAIN;
  private disposed = false;

  setMix(master: number, music: number, muted: boolean) {
    this.level = muted ? 0 : clamp(master) * clamp(music) * BED_GAIN;
    this.updateVolumes();
  }

  /** Called synchronously from a real click, pointer, or keyboard event. */
  unlock() {
    if (this.disposed) return;
    this.unlocked = true;
    if (this.active) this.startCurrent();
  }

  tick(active: boolean, theme: MusicThemeId, now = Date.now()) {
    if (this.disposed) return;
    this.active = active;
    const next = MUSIC_FOR_THEME[theme];
    if (!this.current || this.current.track.id !== next.id) {
      // A map change replaces the old recording with a different real song.
      this.stopSlot(this.outgoing);
      this.outgoing = this.current;
      if (this.outgoing) {
        this.outgoing.from = this.outgoing.audio.volume;
        this.outgoing.to = 0;
        this.outgoing.startedAt = now;
      }
      this.current = this.makeSlot(next, now);
    }
    this.theme = theme;
    this.updateVolumes(now);
    if (this.unlocked && active && this.level > 0) this.startCurrent();
  }

  /** No oscillator fallback: a missing recording never starts spooky synths. */
  private makeSlot(track: LicensedMusicTrack, now: number): PlayingTrack | null {
    if (typeof Audio === "undefined") return null;
    const audio = new Audio();
    audio.src = track.file;
    audio.loop = true;
    audio.preload = "none";
    audio.volume = 0;
    let attemptedFallback = false;
    audio.onerror = () => {
      if (this.disposed || attemptedFallback) return;
      attemptedFallback = true;
      audio.src = track.originalUrl;
      audio.load();
      if (this.unlocked && this.active && this.level > 0) {
        void audio.play().catch(() => {});
      }
    };
    return { audio, track, startedAt: now, from: 0, to: 1 };
  }

  private startCurrent() {
    if (!this.current || this.current.audio.paused === false || this.level <= 0) return;
    // Repeated calls are benign; browsers coalesce play promises until media
    // becomes ready. Failure must never affect game input or SFX.
    void this.current.audio.play().catch(() => {});
  }

  private updateVolumes(now = Date.now()) {
    if (this.current) {
      const progress = clamp((now - this.current.startedAt) / FADE_MS);
      const envelope = this.current.from + (this.current.to - this.current.from) * progress;
      this.current.audio.volume = clamp(envelope * (this.active ? this.level : 0));
    }
    if (this.outgoing) {
      const progress = clamp((now - this.outgoing.startedAt) / FADE_MS);
      this.outgoing.audio.volume = clamp(this.outgoing.from * (1 - progress));
      if (progress >= 1) {
        this.stopSlot(this.outgoing);
        this.outgoing = null;
      }
    }
    // Music can be disabled independently without interfering with gunfire.
    if (!this.active || this.level === 0) {
      this.current?.audio.pause();
      this.outgoing?.audio.pause();
    }
  }

  private stopSlot(slot: PlayingTrack | null) {
    if (!slot) return;
    slot.audio.onerror = null;
    slot.audio.pause();
    slot.audio.removeAttribute("src");
    slot.audio.load();
  }

  dispose() {
    this.disposed = true;
    this.stopSlot(this.current);
    this.stopSlot(this.outgoing);
    this.current = null;
    this.outgoing = null;
  }
}
