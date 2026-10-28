"use client";
import { useEffect, useRef, useState } from "react";
import { FPSEngine, type HudState, type MatchEndResult, type LobbyState } from "@/lib/fps-engine";
import type { LoadoutWire, GameMode, MapId, MapDef, BotDifficulty } from "@/lib/game-protocol";
import type { RoomConnect } from "@/lib/game-store";
import type { SurvivalTier } from "@/lib/survival";
import type { PracticeSample } from "@/lib/tutorial";
import { Hud } from "./Hud";
import { displayMapLabel } from "@/lib/display-labels";
import { TouchControls } from "./TouchControls";
import { useSettings } from "@/lib/settings-store";
import { useGame } from "@/lib/game-store";
import { RoomLobby } from "./RoomLobby";
import { Button } from "@/components/ui/button";

interface Props {
  loadout: LoadoutWire;
  mode: GameMode;
  botCount: number;
  botDifficulty: BotDifficulty;  // resolved per-room difficulty (from roomConnect.config or playConfig)
  survivalTier?: SurvivalTier;
  online: boolean;
  firingRange?: boolean;
  tutorial?: boolean;
  previewMap?: MapDef;
  playerName: string;
  playerKey: string;
  scoreLimit: number;
  timeLimitMin: number;
  mapId: MapId;
  roomConnect?: RoomConnect | null;
  onMatchEnd: (r: MatchEndResult) => void;
  onExit: () => void;
  onExitWithStats?: (r: MatchEndResult) => void;  // called when user leaves mid-match (saves progression)
  onPracticeSample?: (sample: PracticeSample) => void;
}

export function GameCanvas({ loadout, mode, botCount, botDifficulty, survivalTier = "default", online, firingRange = false, tutorial = false, previewMap, playerName, playerKey, scoreLimit, timeLimitMin, mapId, roomConnect, onMatchEnd, onExit, onExitWithStats, onPracticeSample }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<FPSEngine | null>(null);
  const [engineInstance, setEngineInstance] = useState<FPSEngine | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [ready, setReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [touchStarted, setTouchStarted] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [matchOutro, setMatchOutro] = useState<MatchEndResult | null>(null);
  const outroTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);  // Round 20a: track socket state for lobby UI
  const endedRef = useRef(false);
  const settings = useSettings((s) => s.settings);
  const practiceObserver = useRef(onPracticeSample);
  useEffect(() => { practiceObserver.current = onPracticeSample; }, [onPracticeSample]);

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    let engine: FPSEngine;
    try {
      engine = new FPSEngine(containerRef.current, {
      mode, botCount, online, firingRange, previewMap, loadout, playerName, playerKey, team: "ffa", socketPort: 3003,
      mapId,
      gungamePreset: roomConnect?.config?.gungamePreset,
      gungameMultiplier: roomConnect?.config?.gungameMultiplier,
      sensitivity: settings.sensitivity,
      fov: settings.fov,
      autoAdsOnFire: settings.autoAdsOnFire,
      invertY: settings.invertY,
      botDifficulty,
      survivalTier,
      masterVolume: settings.masterVolume,
      footstepVolume: settings.footstepVolume,
      fxVolume: settings.fxVolume,
      scoreLimit,
      timeLimitSec: timeLimitMin * 60,
      roomConnect: roomConnect ?? undefined,
      startedAt: performance.now(),
      onHud: (h) => {
        setHud(h);
        if (firingRange && h.radar) practiceObserver.current?.({
          x: h.radar.playerX, z: h.radar.playerZ, aiming: h.aiming,
          kills: h.kills, ammo: h.ammo, reloading: h.reloading, weaponId: h.weaponId,
        });
      },
      onKillFeed: () => {},
      onMatchEnd: (r) => {
        if (firingRange) return; // No match-complete API / credits / progression for trials.
        if (endedRef.current) return;
        endedRef.current = true;
        if (mode === "gungame") {
          // Leave the arena visible for a brief match-complete sequence instead
          // of immediately tearing down the canvas for the results screen.
          setMatchOutro(r);
          outroTimer.current = setTimeout(() => onMatchEnd(r), 2500);
        } else onMatchEnd(r);
      },
      onRoomError: (message) => {
        // Server rejected the create/join (wrong password, full room, etc.).
        import("sonner").then(({ toast }) => toast.error(`Could not join room: ${message}`));
        onExit();
      },
      onSocketError: () => {
        // Round 20a: Socket can't connect (deploy without game server).
        // Show a helpful message and exit to the menu.
        import("sonner").then(({ toast }) => toast.error(
          "Multiplayer unavailable — the game server isn't reachable from this deployment.",
          { description: "Offline play (vs bots) still works. For online play, ensure the game server (port 3003) is accessible." }
        ));
        onExit();
      },
      onLobbyState: (s) => setLobby(s),
      onReady: () => setReady(true),
      });
    } catch (error) {
      queueMicrotask(() => {
        if (!disposed) setStartupError(error instanceof Error ? error.message : String(error));
      });
      return () => { disposed = true; };
    }
    engineRef.current = engine;
    // Publish the external engine after setup; ignore the notification if this
    // screen has already unmounted (including a failed/aborted startup).
    queueMicrotask(() => {
      if (disposed) return;
      setStartupError(null);
      setEngineInstance(engine);
      setIsTouch(engine.isTouchMode());
    });
    // A user has already selected a match, so try unlocking lobby audio now.
    // If autoplay policy defers it, the next lobby pointer gesture retries it.
    engine.unlockAudio();
    // Round 20a: Poll socket connection state for the lobby UI.
    const socketPoll = setInterval(() => {
      setSocketConnected(!!engine.getSocketConnected());
    }, 500);
    return () => {
      disposed = true;
      clearInterval(socketPoll);
      if (outroTimer.current) clearTimeout(outroTimer.current);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Settings are mutable during a match (e.g. via a future pause menu).
  // Subscribe without rebuilding the engine or resetting the match.
  useEffect(() => {
    const apply = (s: typeof settings) => engineRef.current?.setAudioMix(s);
    apply(useSettings.getState().settings);
    return useSettings.subscribe((state) => apply(state.settings));
  }, []);

  const showStartOverlay = ready && isTouch && !touchStarted;
  const lobbyActive = !!lobby?.active;

  // Centralized exit handler: if the user leaves mid-match (not from the lobby),
  // capture the live match stats and forward them via onExitWithStats so the
  // caller can POST to /api/match/complete — otherwise the player's kills/XP/
  // credits from this match would be lost. If we're still in the lobby (match
  // hasn't started) or the match already ended, just exit cleanly.
  const handleExit = () => {
    if (firingRange) {
      engineInstance?.sendLeaveRoom();
      onExit();
      return;
    }
    if (lobbyActive) {
      engineInstance?.sendLeaveRoom();
      onExit();
      return;
    }
    if (onExitWithStats && engineInstance) {
      const stats = engineInstance.getLiveMatchStats();
      if (stats && (stats.durationSec ?? 0) > 3) {
        // Mark the match as ended locally so the engine doesn't also fire onMatchEnd.
        engineInstance.sendLeaveRoom();
        onExitWithStats(stats);
        return;
      }
    }
    engineInstance?.sendLeaveRoom();
    onExit();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black"
      onPointerDownCapture={() => engineRef.current?.unlockAudio()}
      onTouchStartCapture={() => engineRef.current?.unlockAudio()}>
      <div ref={containerRef} className="absolute inset-0" />
      {startupError && (
        <div role="alert" className="absolute inset-0 z-[80] flex items-center justify-center bg-black p-6 text-white">
          <div className="max-w-lg rounded-xl border border-amber-500/30 bg-zinc-900 p-6 text-center">
            <h2 className="mb-3 text-xl font-bold text-amber-300">Unable to start 3D graphics</h2>
            <p className="mb-3 text-sm text-white/70">
              Your browser could not create a WebGL context. Check graphics acceleration,
              update your GPU driver, and restart the browser.
            </p>
            <p className="mb-5 break-words font-mono text-xs text-white/40">{startupError}</p>
            <Button onClick={onExit}>Return to lobby</Button>
          </div>
        </div>
      )}
      {hud && !lobbyActive && <Hud hud={hud} onExit={handleExit} mode={mode} crosshairColor={settings.crosshairColor} crosshairSize={settings.crosshairSize} reticleStyle={hud.weaponSlot==="secondary" ? loadout.secondaryReticleId??"classic" : loadout.primaryReticleId??"classic"} showPing={settings.showPing} isTouch={isTouch && touchStarted} scopeOverlay={settings.scopeOverlay} />}
      {/* Mobile touch controls (hidden while in lobby) */}
      {isTouch && touchStarted && !lobbyActive && <TouchControls engine={engineInstance} />}
      {/* Desktop "click to play" (pointer lock) — hidden while lobby overlay is up */}
      {ready && !isTouch && !hud?.pointerLocked && !lobbyActive && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 backdrop-blur-sm border border-white/10 rounded-xl px-8 py-6 text-center pointer-events-none">
            <div className="text-2xl font-bold tracking-widest text-white mb-1">{tutorial ? "FIELD TRAINING · CLICK TO START" : firingRange ? "FIRING RANGE · CLICK TO TEST" : "CLICK TO PLAY"}</div>
            <div className="text-sm text-white/60">WASD move · Mouse aim · L-Click fire · R-Click ADS · R reload · Shift sprint · Space jump</div>
            <div className="text-xs text-white/50 mt-2">1/2/3 swap weapon · F quick melee · Q quick-swap · Tab scoreboard</div>
            <div className="text-xs text-amber-300/70 mt-2">{tutorial ? "Press Escape to use the tutorial controls" : firingRange ? "Press Escape to reopen the trial loadout menu" : "A 5-second countdown will start once you enter the match."}</div>
          </div>
        </div>
      )}
      {/* Mobile "tap to play" — hidden while lobby overlay is up */}
      {showStartOverlay && !lobbyActive && (
        <button
          className="absolute inset-0 flex items-center justify-center z-50 bg-black/60"
          onClick={() => setTouchStarted(true)}
        >
          <div className="bg-black/70 backdrop-blur-sm border border-amber-500/30 rounded-xl px-8 py-6 text-center">
            <div className="text-2xl font-bold tracking-widest text-amber-300 mb-1">{tutorial ? "TAP TO TRAIN" : firingRange ? "TAP TO TEST" : "TAP TO PLAY"}</div>
            <div className="text-sm text-white/60">Left stick to move (push far = sprint) · Drag right to look</div>
            <div className="text-xs text-white/40 mt-1">Left: Jump + weapon swap · Right: Fire + ADS + Reload + Quick Melee</div>
            <div className="text-xs text-white/40 mt-2">{mode === "survival" ? "Survival" : mode === "ctf" ? "Capture the Flag" : mode === "tdm" ? "Team Deathmatch" : mode === "killconfirmed" ? "Kill Confirmed" : mode === "gungame" ? "Gun Game" : "Free-For-All"} · {hud?.mapName ? displayMapLabel(hud.mapName) : ""}</div>
          </div>
        </button>
      )}
      {/* Room lobby overlay (pre-match). Shown when the engine reports the room
          is in the "lobby" state. The host sees a "Start Match" button; everyone
          sees the player list + a "Leave" button. */}
      {lobbyActive && lobby && (
        <RoomLobby
          state={lobby}
          mode={mode}
          onStart={() => engineInstance?.sendStartMatch()}
          onLeave={handleExit}
          socketConnected={socketConnected}
        />
      )}
      {matchOutro && (
        <div className="absolute inset-0 z-[70] bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center text-white pointer-events-auto">
          <div className="text-4xl font-black tracking-widest text-amber-300">{matchOutro.won ? "VICTORY" : "MATCH COMPLETE"}</div>
          <p className="mt-3 text-white/80 uppercase tracking-widest">Gun Game · {matchOutro.kills} kills</p>
          <p className="mt-4 text-sm text-white/50 animate-pulse">Finalizing results…</p>
        </div>
      )}
      {/* Failsafe exit button while lobby overlay is somehow missing but the
          engine is still in lobby (e.g. before the first lobbySnapshot arrives). */}
      {lobbyActive && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExit}
          className="absolute top-3 right-3 z-[60] text-white/60 hover:text-white hover:bg-white/5"
        >
          Leave
        </Button>
      )}
    </div>
  );
}
