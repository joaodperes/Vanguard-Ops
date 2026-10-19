"use client";
import { useEffect, useRef, useState } from "react";
import { FPSEngine, type HudState, type MatchEndResult, type LobbyState } from "@/lib/fps-engine";
import type { LoadoutWire, GameMode, MapId, BotDifficulty } from "@/lib/game-protocol";
import type { RoomConnect } from "@/lib/game-store";
import { Hud } from "./Hud";
import { TouchControls } from "./TouchControls";
import { useSettings } from "@/lib/settings-store";
import { RoomLobby } from "./RoomLobby";
import { Button } from "@/components/ui/button";

interface Props {
  loadout: LoadoutWire;
  mode: GameMode;
  botCount: number;
  botDifficulty: BotDifficulty;  // resolved per-room difficulty (from roomConnect.config or playConfig)
  online: boolean;
  playerName: string;
  playerKey: string;
  scoreLimit: number;
  timeLimitMin: number;
  mapId: MapId;
  roomConnect?: RoomConnect | null;
  onMatchEnd: (r: MatchEndResult) => void;
  onExit: () => void;
  onExitWithStats?: (r: MatchEndResult) => void;  // called when user leaves mid-match (saves progression)
}

export function GameCanvas({ loadout, mode, botCount, botDifficulty, online, playerName, playerKey, scoreLimit, timeLimitMin, mapId, roomConnect, onMatchEnd, onExit, onExitWithStats }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<FPSEngine | null>(null);
  const [engineInstance, setEngineInstance] = useState<FPSEngine | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [ready, setReady] = useState(false);
  const [touchStarted, setTouchStarted] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);  // Round 20a: track socket state for lobby UI
  const endedRef = useRef(false);
  const settings = useSettings((s) => s.settings);

  useEffect(() => {
    if (!containerRef.current) return;
    const engine = new FPSEngine(containerRef.current, {
      mode, botCount, online, loadout, playerName, playerKey, team: "ffa", socketPort: 3003,
      mapId,
      sensitivity: settings.sensitivity,
      fov: settings.fov,
      autoAdsOnFire: settings.autoAdsOnFire,
      invertY: settings.invertY,
      botDifficulty,
      masterVolume: settings.masterVolume,
      scoreLimit,
      timeLimitSec: timeLimitMin * 60,
      roomConnect: roomConnect ?? undefined,
      startedAt: performance.now(),
      onHud: (h) => setHud(h),
      onKillFeed: () => {},
      onMatchEnd: (r) => {
        if (endedRef.current) return;
        endedRef.current = true;
        onMatchEnd(r);
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
    engineRef.current = engine;
    setEngineInstance(engine);
    setIsTouch(engine.isTouchMode());
    // Round 20a: Poll socket connection state for the lobby UI.
    const socketPoll = setInterval(() => {
      setSocketConnected(!!engine.getSocketConnected());
    }, 500);
    return () => {
      clearInterval(socketPoll);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const showStartOverlay = ready && isTouch && !touchStarted;
  const lobbyActive = !!lobby?.active;

  // Centralized exit handler: if the user leaves mid-match (not from the lobby),
  // capture the live match stats and forward them via onExitWithStats so the
  // caller can POST to /api/match/complete — otherwise the player's kills/XP/
  // credits from this match would be lost. If we're still in the lobby (match
  // hasn't started) or the match already ended, just exit cleanly.
  const handleExit = () => {
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
    <div className="fixed inset-0 z-50 bg-black">
      <div ref={containerRef} className="absolute inset-0" />
      {hud && !lobbyActive && <Hud hud={hud} onExit={handleExit} mode={mode} crosshairColor={settings.crosshairColor} crosshairSize={settings.crosshairSize} showPing={settings.showPing} isTouch={isTouch && touchStarted} scopeOverlay={settings.scopeOverlay} />}
      {/* Mobile touch controls (hidden while in lobby) */}
      {isTouch && touchStarted && !lobbyActive && <TouchControls engine={engineInstance} />}
      {/* Desktop "click to play" (pointer lock) — hidden while lobby overlay is up */}
      {ready && !isTouch && !hud?.pointerLocked && !lobbyActive && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 backdrop-blur-sm border border-white/10 rounded-xl px-8 py-6 text-center pointer-events-none">
            <div className="text-2xl font-bold tracking-widest text-white mb-1">CLICK TO PLAY</div>
            <div className="text-sm text-white/60">WASD move · Mouse aim · L-Click fire · R-Click ADS · R reload · Shift sprint · Space jump</div>
            <div className="text-xs text-white/50 mt-2">1/2/3 swap weapon · Q quick-swap · Tab scoreboard</div>
            <div className="text-xs text-amber-300/70 mt-2">A 5-second countdown will start once you enter the match.</div>
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
            <div className="text-2xl font-bold tracking-widest text-amber-300 mb-1">TAP TO PLAY</div>
            <div className="text-sm text-white/60">Left stick to move (push far = sprint) · Drag right to look</div>
            <div className="text-xs text-white/40 mt-1">Left: Jump + weapon swap · Right: Fire + ADS + Reload</div>
            <div className="text-xs text-white/40 mt-2">{mode === "survival" ? "Endless Survival" : mode === "tdm" ? "Team Deathmatch" : mode === "killconfirmed" ? "Kill Confirmed" : mode === "gungame" ? "Gun Game" : "Free-For-All"} · {hud?.mapName ?? ""}</div>
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
