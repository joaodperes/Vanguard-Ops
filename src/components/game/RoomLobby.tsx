"use client";
import type { LobbyState } from "@/lib/fps-engine";
import type { GameMode } from "@/lib/game-protocol";
import { displayLabel } from "@/lib/display-labels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, DoorOpen, Play, Users, Shield, Skull, Flag, Radio, Bot as BotIcon, Swords, Wifi, WifiOff, Loader2 } from "lucide-react";

interface Props {
  state: LobbyState;
  mode: GameMode;
  onStart: () => void;
  onLeave: () => void;
  socketConnected?: boolean;  // Round 20a: shows connection status in the lobby
}

// Room lobby overlay — shown over the GameCanvas while the room is in the
// "lobby" state (pre-match). The host can start the match; everyone sees the
// roster and can leave. Renders as a full-screen modal so the underlying 3D
// scene is dimmed but visible.
export function RoomLobby({ state, mode, onStart, onLeave, socketConnected }: Props) {
  const modeLabel = mode === "ctf" ? "Capture the Flag" : mode === "tdm" ? "Team Deathmatch" : mode === "killconfirmed" ? "Kill Confirmed" : mode === "survival" ? "Survival" : mode === "gungame" ? "Gun Game" : "Free-For-All";
  const ModeIcon = mode === "ctf" ? Flag : (mode === "tdm" || mode === "killconfirmed") ? Shield : mode === "survival" ? Skull : mode === "gungame" ? Swords : Users;
  const humans = state.players.filter((p) => !p.isBot);
  // Round 20a: Derive connection status from the prop (no effect needed).
  const connStatus: "connecting" | "connected" | "disconnected" =
    socketConnected === true ? "connected" : socketConnected === false ? "disconnected" : "connecting";

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg mx-4 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-zinc-900 via-zinc-900/95 to-black p-6 shadow-2xl shadow-amber-900/30 overflow-hidden">
        {/* ambient glow */}
        <div className="absolute -top-20 -right-16 w-56 h-56 rounded-full blur-3xl opacity-25" style={{ background: "radial-gradient(circle, #f59e0b, transparent 70%)" }} />
        <div className="absolute -bottom-20 -left-16 w-48 h-48 rounded-full blur-3xl opacity-20" style={{ background: "radial-gradient(circle, #f43f5e, transparent 70%)" }} />

        <div className="relative">
          {/* header */}
          <div className="flex items-start gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-900/40 shrink-0">
              <DoorOpen className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-white font-black text-lg tracking-wide truncate">{state.roomName || "Room Lobby"}</h2>
                <Badge variant="outline" className="border-amber-500/40 text-amber-300/90 text-[9px] uppercase shrink-0">
                  <Radio className="w-2.5 h-2.5 mr-1 animate-pulse" /> Lobby
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 text-white/50 text-xs mt-0.5">
                <ModeIcon className="w-3 h-3" /> {modeLabel}
              </div>
            </div>
          </div>

          {/* waiting banner */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 mb-4 text-center">
            <div className="text-amber-200 text-sm font-semibold flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              {state.isHost ? "Waiting for you to start the match" : "Waiting for the host to start"}
            </div>
            <div className="text-white/40 text-xs mt-1">
              {state.isHost
                ? "Bots will fill empty slots when the match begins. Friends can still join from the Room Browser."
                : "Hang tight — the match starts as soon as the host deploys."}
            </div>
          </div>

          {/* player list */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/60 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Operatives
              </span>
              <span className="text-white/40 text-xs tabular-nums">{humans.length} joined</span>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/40 divide-y divide-white/5 max-h-56 overflow-y-auto">
              {humans.length === 0 ? (
                <div className="p-4 text-center text-white/40 text-xs">No operatives yet…</div>
              ) : (
                humans.map((p) => {
                  const isHost = p.id === state.players[0]?.id; // first player listed is the host
                  const teamColor = p.team === "red" ? "#ef4444" : p.team === "blue" ? "#06b6d4" : "#9ca3af";
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: teamColor, boxShadow: `0 0 6px ${teamColor}` }} />
                      <span className="text-white text-sm font-medium truncate flex-1">{p.name}</span>
                      {isHost && (
                        <Badge variant="outline" className="border-amber-500/40 text-amber-300/90 text-[9px] uppercase shrink-0">
                          <Crown className="w-2.5 h-2.5 mr-1" /> Host
                        </Badge>
                      )}
                      {p.team !== "ffa" && (
                        <Badge variant="outline" className="border-white/15 text-white/60 text-[9px] uppercase shrink-0">
                          {displayLabel(p.team)}
                        </Badge>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            {mode !== "survival" && (
              <div className="flex items-center gap-1.5 mt-2 text-white/40 text-xs">
                <BotIcon className="w-3 h-3" /> Bots spawn when the match starts (filling empty slots).
              </div>
            )}
          </div>

          {/* Round 20a: Connection status indicator */}
          <div className="mb-3 flex items-center justify-center gap-1.5 text-xs">
            {connStatus === "connecting" && (
              <span className="text-amber-300/80 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Connecting to game server…
              </span>
            )}
            {connStatus === "connected" && (
              <span className="text-emerald-300/80 flex items-center gap-1.5">
                <Wifi className="w-3 h-3" /> Connected
              </span>
            )}
            {connStatus === "disconnected" && (
              <span className="text-rose-400 flex items-center gap-1.5">
                <WifiOff className="w-3 h-3" /> Server unreachable — multiplayer unavailable
              </span>
            )}
          </div>

          {/* actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onLeave}
              className="border-white/15 text-white/70 hover:text-white hover:bg-white/5"
            >
              <DoorOpen className="w-4 h-4 mr-1.5" /> Leave
            </Button>
            {state.isHost ? (
              <Button
                onClick={onStart}
                disabled={connStatus !== "connected"}
                className="flex-1 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-bold tracking-wide shadow-lg shadow-amber-900/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {connStatus === "connecting" ? (
                  <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Connecting…</>
                ) : connStatus === "disconnected" ? (
                  <><WifiOff className="w-4 h-4 mr-1.5" /> No Connection</>
                ) : (
                  <><Play className="w-4 h-4 mr-1.5" fill="white" /> Start Match</>
                )}
              </Button>
            ) : (
              <div className="flex-1 text-center text-white/40 text-xs py-2">
                Only the host can start the match.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
