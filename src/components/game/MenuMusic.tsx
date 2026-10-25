"use client";

import { useEffect, useRef } from "react";
import { SoundManager } from "@/lib/sound";
import { useSettings, type GameSettings } from "@/lib/settings-store";

/** The menu has no FPSEngine, so it owns a lightweight soundtrack instance.
 * It stays mounted while navigating menu screens; gameplay fades it out and
 * lets FPSEngine own the map/lobby soundtrack. Browsers unlock audio only after
 * a real key, pointer or touch gesture.
 */
export function MenuMusic({ active }: { active: boolean }) {
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const sound = new SoundManager();
    const applyMix = (s: GameSettings) => {
      sound.setMasterVolume(s.masterVolume / 100);
      sound.setMusicVolume(s.musicVolume / 100);
      sound.setFootstepVolume(s.footstepVolume / 100);
      sound.setFxVolume(s.fxVolume / 100);
    };
    // Load persisted settings even if the player never opens Settings.
    if (!useSettings.getState().loaded) useSettings.getState().load();
    applyMix(useSettings.getState().settings);
    const unsubscribe = useSettings.subscribe((state) => applyMix(state.settings));
    const unlock = () => {
      if (activeRef.current) sound.resume();
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock, { passive: true });

    let frame = 0;
    const tick = () => {
      sound.tickAmbientMusic(activeRef.current, "menu");
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
      sound.dispose();
    };
  }, []);

  return null;
}
