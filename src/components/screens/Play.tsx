"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { io as ioClient, type Socket } from "socket.io-client";
import { useGame } from "@/lib/game-store";
import {
  MATCH_MODES, RARITY_COLORS, weaponById, WEAPONS,
} from "@/lib/game-data";
import {
  MAP_LIST, TEAM_SIZES, roomCapacity,
  type MapId, type GameMode, type TeamSize, type RoomSummary, type CreateRoomConfig,
  type S2C, type C2S, type BotDifficulty,
} from "@/lib/game-protocol";
import {
  ArrowLeft, Swords, Users, Shield, Skull, Bot, Lock, KeyRound, Plus, ListVideo,
  RefreshCw, Map as MapIcon, Layers, Mountain, Building2, Boxes, ChevronRight,
  Zap, Crosshair, UserCircle, DoorOpen, Globe, Wifi, WifiOff, Radio, Check, Gauge, Loader2,
  Target, Clock, Trophy, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// Bot difficulty options shown in the Create Room tab. "mixed" rolls a random
// difficulty per bot at spawn time. Colors avoid indigo/blue per project rules.
const BOT_DIFFICULTY_OPTIONS: { id: BotDifficulty; label: string; desc: string; color: string }[] = [
  { id: "easy", label: "Easy", desc: "Slow reactions, frequent misses", color: "#22c55e" },
  { id: "normal", label: "Normal", desc: "Balanced — recommended", color: "#facc15" },
  { id: "hard", label: "Hard", desc: "Quick reflexes, tight bursts", color: "#f97316" },
  { id: "veteran", label: "Veteran", desc: "Snap aim, controlled spray", color: "#ef4444" },
  { id: "mixed", label: "Mixed", desc: "Random skill per bot — variety", color: "#a855f7" },
];

// ============================================================================
// useLobby — a lightweight socket that ONLY browses rooms (listRooms/roomList).
// It never joins a match. The engine creates its own socket when "playing"
// starts and sends createRoom/joinRoom there.
// ============================================================================
function useLobby(active: boolean) {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [status, setStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const socketRef = useRef<Socket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) {
      // tear down when tab not active (status is unobserved in this state)
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    const sock = ioClient("/?XTransformPort=3003", {
      path: "/",
      transports: ["polling", "websocket"],
      reconnection: true, reconnectionAttempts: 10, reconnectionDelay: 1200, timeout: 8000,
    });
    socketRef.current = sock;
    // status is updated only via async socket callbacks (React-recommended).
    sock.on("connect", () => {
      setStatus("connected");
      sock.emit("message", { t: "listRooms" } as C2S);
    });
    sock.on("message", (msg: S2C) => {
      if (msg.t === "roomList") setRooms(msg.rooms);
    });
    sock.on("connect_error", () => setStatus("error"));
    sock.on("reconnect_attempt", () => setStatus("connecting"));
    sock.on("disconnect", () => setStatus("connecting"));
    // poll every 4.5s for a fresh list
    pollRef.current = setInterval(() => {
      if (sock.connected) sock.emit("message", { t: "listRooms" } as C2S);
    }, 4500);
    return () => {
      sock.disconnect();
      if (pollRef.current) clearInterval(pollRef.current);
      socketRef.current = null;
      pollRef.current = null;
    };
  }, [active]);

  const refresh = useCallback(() => {
    if (socketRef.current?.connected) socketRef.current.emit("message", { t: "listRooms" } as C2S);
  }, []);

  return { rooms, status, refresh };
}

// ============================================================================
// Play screen
// ============================================================================
export function Play() {
  const { profile, setScreen, roomConfig, setRoomConfig, setRoomConnect, setPlayConfig } = useGame();
  const [tab, setTab] = useState<"create" | "browse">("create");
  const lobby = useLobby(tab === "browse");
  // Round 20a: Server status indicator. The game server runs on port 3003
  // (started by instrumentation.ts). Connection strategy depends on environment:
  // - Sandbox (Caddy on :81): check via "?XTransformPort=3003" (Caddy routes it)
  // - Local dev (no Caddy): check directly on port 3003
  // - Deploy (no Caddy): check /socket.io/ on same origin (may fail gracefully)
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    const checkServer = async () => {
      const isLocalhost = typeof window !== "undefined"
        && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
      const isSandboxWithCaddy = typeof window !== "undefined"
        && (window.location.port === "81" || window.location.search.includes("XTransformPort"));

      // Helper: check if a fetch response looks like a socket.io engine.io response
      const isSocketIoResponse = (ct: string, text: string) => {
        const isHtml = ct.includes("text/html") || text.startsWith("<!DOCTYPE") || text.startsWith("<html");
        const isSocketIo = ct.includes("text/plain") || text.startsWith("0{") || text.startsWith("0[");
        return isSocketIo && !isHtml;
      };

      try {
        if (isLocalhost && !isSandboxWithCaddy) {
          // Local dev without Caddy: check the game server directly on port 3003.
          const res = await fetch(`http://${window.location.hostname}:3003/?EIO=4&transport=polling`, { method: "GET" });
          if (cancelled) return;
          const ct = res.headers.get("content-type") || "";
          const text = await res.text();
          if (!cancelled) setServerOnline(isSocketIoResponse(ct, text));
        } else {
          // Sandbox (Caddy) or deploy: try the XTransformPort path first.
          const res = await fetch("/?XTransformPort=3003&EIO=4&transport=polling", { method: "GET" });
          if (cancelled) return;
          const ct = res.headers.get("content-type") || "";
          const text = await res.text();
          if (isSocketIoResponse(ct, text)) {
            if (!cancelled) setServerOnline(true);
            return;
          }
          // If XTransformPort returned HTML, try the standard /socket.io/ path.
          try {
            const res2 = await fetch("/socket.io/?EIO=4&transport=polling", { method: "GET" });
            if (cancelled) return;
            const ct2 = res2.headers.get("content-type") || "";
            if (!cancelled) setServerOnline(ct2.includes("text/plain") || (res2.ok && !ct2.includes("text/html")));
          } catch {
            if (!cancelled) setServerOnline(false);
          }
        }
      } catch {
        if (!cancelled) setServerOnline(false);
      }
    };
    checkServer();
    const interval = setInterval(checkServer, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const equipped = profile?.loadout;
  const equippedWeapon = equipped ? weaponById(equipped.weapon.id) : WEAPONS[0];

  // ---- Create Room: launch the match via the engine ----
  const handleCreate = () => {
    const mode = roomConfig.mode;
    const teamSize = roomConfig.teamSize;
    const cfg = MATCH_MODES[mode];
    const cap = roomCapacity(mode, teamSize);
    const config: CreateRoomConfig = {
      mode,
      mapId: roomConfig.mapId,
      teamSize,
      fillWithBots: mode === "survival" ? false : roomConfig.fillWithBots,
      password: roomConfig.password.trim() ? roomConfig.password.trim() : null,
      roomName: roomConfig.roomName.trim() || undefined,
      botDifficulty: roomConfig.botDifficulty,
      // Round 19i: Pass custom limits for FFA/TDM.
      scoreLimit: (mode === "ffa" || mode === "tdm" || mode === "killconfirmed") ? roomConfig.scoreLimit : undefined,
      timeLimit: (mode === "ffa" || mode === "tdm" || mode === "killconfirmed") ? roomConfig.timeLimit : undefined,
    };
    setRoomConnect({ kind: "create", config, roomName: config.roomName || `${profile?.name ?? "Host"}'s Room` });
    setPlayConfig({
      mode,
      mapId: roomConfig.mapId,
      online: true,
      botCount: config.fillWithBots ? Math.max(0, cap - 1) : 0,
      scoreLimit: cfg.defaultScoreLimit,
      timeLimit: cfg.defaultTimeLimit,
      botDifficulty: roomConfig.botDifficulty,
    });
    setScreen("playing");
    toast.success(`Creating room "${config.roomName || `${profile?.name ?? "Host"}'s Room`}"…`);
  };

  // ---- Join Room from the browser ----
  // For team-based rooms, the caller passes the chosen team (red/blue/auto). For FFA /
  // survival, team is undefined (the server assigns automatically).
  const handleJoin = (room: RoomSummary, password: string | null, team?: "red" | "blue" | "auto") => {
    const cfg = MATCH_MODES[room.mode];
    setRoomConnect({ kind: "join", roomId: room.id, password, roomName: room.name, team });
    setPlayConfig({
      mode: room.mode,
      mapId: room.mapId,
      online: true,
      botCount: 0,
      scoreLimit: cfg.defaultScoreLimit,
      timeLimit: cfg.defaultTimeLimit,
      botDifficulty: "normal",  // joiners inherit the room's difficulty (server-authoritative)
    });
    setScreen("playing");
    toast.success(`Joining "${room.name}"…`);
  };

  const cap = roomCapacity(roomConfig.mode, roomConfig.teamSize);

  return (
    <div className="min-h-screen flex flex-col">
      {/* header */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setScreen("menu")} className="text-white/70 hover:text-white hover:bg-white/5">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-900/40">
              <Swords className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-black tracking-[0.18em] text-white text-sm leading-none">DEPLOY</div>
              <div className="text-[10px] tracking-[0.25em] text-amber-400/80 leading-none mt-0.5">ROOM LOBBY</div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-white/40">
            {serverOnline === null ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span className="hidden sm:inline">Checking server…</span>
              </>
            ) : serverOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Server online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline text-rose-400">Server unreachable — offline play only</span>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "create" | "browse")}>
          <TabsList className="bg-black/40 border border-white/10 p-1 h-auto">
            <TabsTrigger value="create" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-200 px-5 py-2 text-sm">
              <Plus className="w-4 h-4 mr-2" /> Create a Room
            </TabsTrigger>
            <TabsTrigger value="browse" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-200 px-5 py-2 text-sm">
              <ListVideo className="w-4 h-4 mr-2" /> Room Browser
              {lobby.rooms.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-cyan-500/30 text-cyan-200 text-[10px] font-bold">
                  {lobby.rooms.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ============== CREATE A ROOM ============== */}
          <TabsContent value="create" className="mt-5">
            <div className="grid lg:grid-cols-[1fr_320px] gap-5">
              <div className="space-y-5">
                {/* Game mode */}
                <Section icon={<Swords className="w-4 h-4 text-amber-400" />} title="Game Mode" hint="Choose the match type">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {(["ffa", "tdm", "killconfirmed", "survival", "gungame"] as GameMode[]).map((m) => (
                      <ModePickCard key={m} mode={m} selected={roomConfig.mode === m} onSelect={(mode) => setRoomConfig({ mode, scoreLimit: MATCH_MODES[mode].defaultScoreLimit, timeLimit: MATCH_MODES[mode].defaultTimeLimit * 60 })} />
                    ))}
                  </div>
                </Section>

                {/* Team size */}
                <Section
                  icon={<Users className="w-4 h-4 text-rose-400" />}
                  title={roomConfig.mode === "ffa" || roomConfig.mode === "gungame" ? "Player Slots" : roomConfig.mode === "survival" ? "Squad Size" : "Team Size"}
                  hint={
                    roomConfig.mode === "ffa" || roomConfig.mode === "gungame"
                      ? "Total combatants in the match (no teams)"
                      : roomConfig.mode === "survival"
                      ? "Survival is co-op — 2 operatives vs endless waves"
                      : "Players per team · red vs blue"
                  }
                >
                  {roomConfig.mode === "survival" ? (
                    <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
                      <Shield className="w-5 h-5 text-amber-400" />
                      <div>
                        <div className="text-white font-semibold text-sm">2-Player Co-op</div>
                        <div className="text-white/50 text-xs">Survival is always 2 humans. Bots spawn per wave.</div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {TEAM_SIZES.map((ts) => {
                        const selected = roomConfig.teamSize === ts;
                        const total = ts * 2;
                        const label = roomConfig.mode === "ffa" || roomConfig.mode === "gungame" ? `${total} players` : `${ts}v${ts}`;
                        return (
                          <button
                            key={ts}
                            onClick={() => setRoomConfig({ teamSize: ts })}
                            className={`relative p-4 rounded-xl border text-center transition-all overflow-hidden ${
                              selected
                                ? "border-rose-400/60 bg-rose-500/10 shadow-lg shadow-rose-500/10"
                                : "border-white/10 bg-zinc-900/50 hover:border-white/25 hover:bg-zinc-900/80"
                            }`}
                          >
                            <div className={`text-2xl font-black ${selected ? "text-rose-200" : "text-white"}`}>{label}</div>
                            <div className="text-[10px] uppercase tracking-wider text-white/40 mt-1">
                              {roomConfig.mode === "ffa" || roomConfig.mode === "gungame" ? "Free-for-all" : `${total} total slots`}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Section>

                {/* Fill with bots */}
                <Section icon={<Bot className="w-4 h-4 text-emerald-400" />} title="Bot Fill" hint="Bots occupy empty slots; humans replace them on join">
                  <div className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                    roomConfig.mode === "survival" ? "border-white/5 bg-black/20 opacity-60" : "border-white/10 bg-zinc-900/50"
                  }`}>
                    <Switch
                      id="fill-bots"
                      checked={roomConfig.mode === "survival" ? false : roomConfig.fillWithBots}
                      onCheckedChange={(v) => setRoomConfig({ fillWithBots: v })}
                      disabled={roomConfig.mode === "survival"}
                    />
                    <div className="flex-1">
                      <Label htmlFor="fill-bots" className="text-white font-medium text-sm cursor-pointer">
                        Fill empty slots with bots
                      </Label>
                      <div className="text-white/50 text-xs mt-0.5">
                        {roomConfig.mode === "survival"
                          ? "Survival uses wave-based bots — this option is disabled."
                          : "When a human joins your team, a bot is removed to make room (team size respected)."}
                      </div>
                    </div>
                    {roomConfig.fillWithBots && roomConfig.mode !== "survival" && (
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-300/80 text-[10px] uppercase">
                        <Bot className="w-3 h-3 mr-1" /> {Math.max(0, cap - 1)} bots ready
                      </Badge>
                    )}
                  </div>
                </Section>

                {/* Bot difficulty (FFA / TDM / Gun Game only — survival scales per wave) */}
                {roomConfig.mode !== "survival" && (
                  <Section icon={<Gauge className="w-4 h-4 text-rose-400" />} title="Bot Difficulty" hint="How skilled enemy bots are. Affects rewards.">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {BOT_DIFFICULTY_OPTIONS.map((d) => {
                        const selected = roomConfig.botDifficulty === d.id;
                        return (
                          <button
                            key={d.id}
                            onClick={() => setRoomConfig({ botDifficulty: d.id })}
                            className={`text-left p-3 rounded-xl border transition-all ${
                              selected ? "border-white/40 bg-white/10" : "border-white/10 bg-black/30 hover:border-white/25"
                            }`}
                            style={selected ? { boxShadow: `0 0 14px ${d.color}40` } : {}}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="w-2 h-2 rounded-full" style={{ background: d.color, boxShadow: `0 0 6px ${d.color}` }} />
                              <span className="text-white font-semibold text-sm">{d.label}</span>
                              {selected && <Check className="w-3 h-3 text-emerald-400 ml-auto" />}
                            </div>
                            <div className="text-white/40 text-xs leading-snug">{d.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-white/50 leading-relaxed">
                      <span className="font-semibold text-white/70">Rewards scale with difficulty:</span> harder bots award more XP/credits per kill (Easy 10/5 → Veteran 30/18). Mixed rolls a random tier per bot.
                    </div>
                  </Section>
                )}

                {/* Round 19i/20b: Match Limits (FFA/TDM only) */}
                {(roomConfig.mode === "ffa" || roomConfig.mode === "tdm" || roomConfig.mode === "killconfirmed") && (
                  <Section icon={<Target className="w-4 h-4 text-rose-400" />} title="Match Limits" hint="Set the score target and/or time limit (at least one required)">
                    <div className="space-y-3">
                      <div>
                        <Label className="text-white/60 text-xs mb-1.5 flex items-center gap-1.5"><Trophy className="w-3 h-3" /> {roomConfig.mode === "killconfirmed" ? "Confirmed Tags Target" : "Kill Target"}</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {[0, 15, 25, 30, 40, 50, 60, 75, 100].map((s) => (
                            <button key={s} onClick={() => setRoomConfig({ scoreLimit: s })}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${roomConfig.scoreLimit === s ? "bg-rose-500/20 text-rose-300 border border-rose-500/40" : "bg-zinc-900/50 text-white/50 border border-white/10 hover:border-white/20"}`}>
                              {s === 0 ? "No limit" : s}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-white/60 text-xs mb-1.5 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Time Limit</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {[0, 180, 300, 360, 480, 600, 900].map((t) => (
                            <button key={t} onClick={() => setRoomConfig({ timeLimit: t })}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${roomConfig.timeLimit === t ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "bg-zinc-900/50 text-white/50 border border-white/10 hover:border-white/20"}`}>
                              {t === 0 ? "No limit" : `${t / 60}m`}
                            </button>
                          ))}
                        </div>
                      </div>
                      {(roomConfig.scoreLimit === 0 && roomConfig.timeLimit === 0) && (
                        <div className="text-rose-400 text-xs font-semibold flex items-center gap-1.5">
                          <AlertTriangle className="w-3 h-3" /> At least one limit must be set for the match to end.
                        </div>
                      )}
                    </div>
                  </Section>
                )}

                {/* Map choice */}
                <Section icon={<MapIcon className="w-4 h-4 text-cyan-400" />} title="Map Choice" hint="Pick the battleground">
                  <div className="grid sm:grid-cols-2 gap-3">
                    {MAP_LIST.map((m) => {
                      const selected = roomConfig.mapId === m.id;
                      const Icon = m.id === "compound" ? Building2 : m.id === "skybridge" ? Mountain : m.id === "shipyard" ? Boxes : m.id === "terminal" ? Building2 : Layers;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setRoomConfig({ mapId: m.id as MapId })}
                          className={`relative text-left p-4 rounded-xl border transition-all overflow-hidden group ${
                            selected
                              ? "border-cyan-400/60 bg-cyan-500/10 shadow-lg shadow-cyan-500/10"
                              : "border-white/10 bg-zinc-900/50 hover:border-white/25 hover:bg-zinc-900/80"
                          }`}
                        >
                          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-30 pointer-events-none" style={{ background: m.accentColor }} />
                          <div className="relative flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${m.accentColor}20`, color: m.accentColor }}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-white font-bold text-sm truncate">{m.name}</span>
                                {selected && (
                                  <span className="ml-auto text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold shrink-0">
                                    Selected
                                  </span>
                                )}
                              </div>
                              <div className="text-white/50 text-[11px] leading-snug mb-1.5 line-clamp-2">{m.description}</div>
                              <div className="flex items-center gap-2 text-[10px] text-white/40">
                                <span className="flex items-center gap-1"><Layers className="w-2.5 h-2.5" /> {m.size * 2}×{m.size * 2}</span>
                                <span className="flex items-center gap-1"><Users className="w-2.5 h-2.5" /> {m.spawns.ffa.length} spawns</span>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Section>

                {/* Room identity: name + password */}
                <Section icon={<KeyRound className="w-4 h-4 text-amber-400" />} title="Room Identity" hint="Optional name & password">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="room-name" className="text-white/60 text-xs uppercase tracking-wider mb-1.5 block">Room Name</Label>
                      <Input
                        id="room-name"
                        value={roomConfig.roomName}
                        onChange={(e) => setRoomConfig({ roomName: e.target.value.slice(0, 32) })}
                        placeholder={`${profile?.name ?? "Host"}'s Room`}
                        className="bg-black/40 border-white/10 text-white placeholder:text-white/30 focus-visible:border-amber-500/50"
                      />
                    </div>
                    <div>
                      <Label htmlFor="room-pass" className="text-white/60 text-xs uppercase tracking-wider mb-1.5 block flex items-center gap-1.5">
                        <Lock className="w-3 h-3" /> Password <span className="text-white/30 normal-case tracking-normal">(optional)</span>
                      </Label>
                      <Input
                        id="room-pass"
                        type="text"
                        value={roomConfig.password}
                        onChange={(e) => setRoomConfig({ password: e.target.value.slice(0, 32) })}
                        placeholder="Leave empty for open room"
                        className="bg-black/40 border-white/10 text-white placeholder:text-white/30 focus-visible:border-amber-500/50"
                      />
                    </div>
                  </div>
                </Section>
              </div>

              {/* ---- Summary sidebar ---- */}
              <aside className="lg:sticky lg:top-20 self-start">
                <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-900/80 to-black p-5 overflow-hidden">
                  <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl opacity-20" style={{ background: MATCH_MODES[roomConfig.mode].accentColor }} />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-4">
                      <DoorOpen className="w-4 h-4 text-amber-400" />
                      <span className="text-white font-bold text-sm uppercase tracking-wider">Room Summary</span>
                    </div>

                    <SummaryRow label="Room Name" value={roomConfig.roomName.trim() || `${profile?.name ?? "Host"}'s Room`} />
                    <SummaryRow label="Host" value={profile?.name ?? "Recruit"} />
                    <SummaryRow label="Mode" value={MATCH_MODES[roomConfig.mode].label} accent={MATCH_MODES[roomConfig.mode].accentColor} />
                    <SummaryRow
                      label={roomConfig.mode === "ffa" || roomConfig.mode === "gungame" ? "Slots" : roomConfig.mode === "survival" ? "Squad" : "Teams"}
                      value={roomConfig.mode === "survival" ? "2 co-op" : roomConfig.mode === "ffa" || roomConfig.mode === "gungame" ? `${cap} players` : `${roomConfig.teamSize}v${roomConfig.teamSize}`}
                    />
                    <SummaryRow label="Map" value={MAP_LIST.find((m) => m.id === roomConfig.mapId)?.name ?? "—"} accent={MAP_LIST.find((m) => m.id === roomConfig.mapId)?.accentColor} />
                    <SummaryRow
                      label="Bots"
                      value={
                        roomConfig.mode === "survival" ? "Per wave"
                        : roomConfig.fillWithBots ? `Fill (${Math.max(0, cap - 1)} ready)`
                        : "Off"
                      }
                      accent={roomConfig.fillWithBots && roomConfig.mode !== "survival" ? "#22c55e" : undefined}
                    />
                    {roomConfig.mode !== "survival" && (
                      <SummaryRow
                        label="Difficulty"
                        value={BOT_DIFFICULTY_OPTIONS.find((d) => d.id === roomConfig.botDifficulty)?.label ?? "Normal"}
                        accent={BOT_DIFFICULTY_OPTIONS.find((d) => d.id === roomConfig.botDifficulty)?.color}
                      />
                    )}
                    {roomConfig.mode === "gungame" && (
                      <SummaryRow label="Score Limit" value={`${MATCH_MODES.gungame.defaultScoreLimit} kills (cycle)`} accent="#a855f7" />
                    )}
                    <SummaryRow label="Password" value={roomConfig.password.trim() ? "Protected" : "Open"} accent={roomConfig.password.trim() ? "#f59e0b" : undefined} />

                    {/* equipped loadout mini */}
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="text-white/40 text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Crosshair className="w-3 h-3" /> Equipped Weapon
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-black/40 border border-white/5">
                        <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: `${RARITY_COLORS[equipped?.weaponSkin.rarity ?? "common"]}20` }}>
                          <Crosshair className="w-4 h-4 text-white/70" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-semibold truncate">{equippedWeapon.name}</div>
                          <div className="text-white/40 text-[10px] uppercase">{equippedWeapon.category}</div>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => setScreen("loadout")} className="text-white/50 hover:text-white h-7 px-2 text-xs">
                          Edit
                        </Button>
                      </div>
                    </div>

                    <Button
                      onClick={handleCreate}
                      disabled={serverOnline === false}
                      className="w-full mt-5 h-11 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-bold tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {serverOnline === false ? (
                        <><WifiOff className="w-4 h-4 mr-1.5" /> Server Unreachable</>
                      ) : serverOnline === null ? (
                        <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Checking…</>
                      ) : (
                        <><Plus className="w-4 h-4 mr-1.5" /> Create Room</>
                      )}
                    </Button>
                    <div className="text-center text-[10px] text-white/40 mt-2">
                      {serverOnline === false
                        ? "Game server is offline — play offline vs bots instead"
                        : "Opens a lobby — deploy when your squad is ready"}
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </TabsContent>

          {/* ============== ROOM BROWSER ============== */}
          <TabsContent value="browse" className="mt-5">
            <RoomBrowser lobby={lobby} onJoin={handleJoin} />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="mt-auto border-t border-white/10 bg-black/40 py-4">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between text-xs text-white/40">
          <span className="flex items-center gap-1.5"><Globe className="w-3 h-3" /> All rooms are live online matches</span>
          <span className="hidden sm:inline">Create a room · invite friends · bots fill the gaps</span>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// Room Browser
// ============================================================================
function RoomBrowser({
  lobby, onJoin,
}: {
  lobby: { rooms: RoomSummary[]; status: string; refresh: () => void };
  onJoin: (room: RoomSummary, password: string | null, team?: "red" | "blue" | "auto") => void;
}) {
  // Pending join flow. For TDM rooms we show a team-selection dialog (and a
  // password field if the room is protected). For FFA/survival we either join
  // immediately (open room) or show just the password dialog (protected room).
  const [pending, setPending] = useState<{ room: RoomSummary; needsTeam: boolean } | null>(null);
  const [pwInput, setPwInput] = useState("");
  const [teamChoice, setTeamChoice] = useState<"red" | "blue" | "auto">("auto");

  const { rooms, status, refresh } = lobby;

  const submitJoin = (room: RoomSummary) => {
    const needsTeam = room.mode === "tdm" || room.mode === "killconfirmed";
    if (room.hasPassword || needsTeam) {
      setPending({ room, needsTeam });
      setPwInput("");
      setTeamChoice("auto");
    } else {
      onJoin(room, null);
    }
  };

  const confirmJoin = () => {
    if (!pending) return;
    const pw = pending.room.hasPassword ? (pwInput || null) : null;
    onJoin(pending.room, pw, pending.needsTeam ? teamChoice : undefined);
    setPending(null);
    setPwInput("");
    setTeamChoice("auto");
  };

  return (
    <div>
      {/* status bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 text-xs">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
            status === "connected" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : status === "connecting" ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
            : "border-rose-500/30 bg-rose-500/10 text-rose-300"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              status === "connected" ? "bg-emerald-400 animate-pulse"
              : status === "connecting" ? "bg-amber-400 animate-pulse"
              : "bg-rose-400"
            }`} />
            {status === "connected" ? "Live" : status === "connecting" ? "Connecting…" : "Offline"}
          </span>
          <span className="text-white/40">{rooms.length} active room{rooms.length === 1 ? "" : "s"}</span>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} className="ml-auto border-white/10 text-white/70 hover:text-white hover:bg-white/5 h-8">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* room list */}
      {rooms.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-zinc-900/30 p-12 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/5 flex items-center justify-center">
            <Radio className="w-6 h-6 text-white/40" />
          </div>
          <div className="text-white font-semibold mb-1">No active rooms right now</div>
          <div className="text-white/50 text-sm mb-4">Be the first — create a room and invite friends to the lobby.</div>
          <div className="text-[10px] text-white/30 uppercase tracking-wider">Switch to the Create tab to start a room</div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {rooms.map((r) => (
            <RoomCard key={r.id} room={r} onJoin={() => submitJoin(r)} />
          ))}
        </div>
      )}

      {/* join dialog: team selection (TDM) + optional password */}
      <Dialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }}>
        <DialogContent className="bg-zinc-950 border-white/15 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {pending?.needsTeam ? <Shield className="w-4 h-4 text-rose-400" /> : <Lock className="w-4 h-4 text-amber-400" />}
              {pending?.needsTeam ? "Choose Your Team" : "Password Required"}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              Joining <span className="text-white font-semibold">{pending?.room.name}</span>
              {pending?.needsTeam ? " — pick a side for Team Deathmatch." : "."}
            </DialogDescription>
          </DialogHeader>

          {pending?.needsTeam && (
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: "red" as const, label: "Red Team", color: "#ef4444", desc: "Crimson squad" },
                { id: "blue" as const, label: "Blue Team", color: "#06b6d4", desc: "Cyan squad" },
                { id: "auto" as const, label: "Auto", color: "#facc15", desc: "Balanced pick" },
              ]).map((t) => {
                const sel = teamChoice === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTeamChoice(t.id)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      sel ? "border-white/40 bg-white/10" : "border-white/10 bg-black/30 hover:border-white/25"
                    }`}
                    style={sel ? { boxShadow: `0 0 14px ${t.color}40` } : {}}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: t.color, boxShadow: `0 0 6px ${t.color}` }} />
                      <span className="text-white font-semibold text-xs">{t.label}</span>
                      {sel && <Check className="w-3 h-3 text-emerald-400 ml-auto" />}
                    </div>
                    <div className="text-white/40 text-[10px] leading-snug">{t.desc}</div>
                  </button>
                );
              })}
            </div>
          )}

          {pending?.room.hasPassword && (
            <div>
              <Label className="text-white/60 text-xs uppercase tracking-wider mb-1.5 block">Room Password</Label>
              <Input
                autoFocus={!pending?.needsTeam}
                type="password"
                value={pwInput}
                onChange={(e) => setPwInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") confirmJoin(); }}
                placeholder="Room password"
                className="bg-black/40 border-white/10 text-white"
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)} className="text-white/60 hover:text-white">Cancel</Button>
            <Button onClick={confirmJoin} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold">
              <KeyRound className="w-4 h-4 mr-1.5" /> Join Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoomCard({ room, onJoin }: { room: RoomSummary; onJoin: () => void }) {
  const cfg = MATCH_MODES[room.mode];
  const mapDef = MAP_LIST.find((m) => m.id === room.mapId);
  const full = room.humans >= room.capacity;
  const Icon = room.mode === "ffa" ? Users : (room.mode === "tdm" || room.mode === "killconfirmed") ? Shield : room.mode === "gungame" ? Swords : Skull;
  const inLobby = room.state === "lobby";

  return (
    <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/80 to-black/60 p-4 overflow-hidden hover:border-white/25 transition-colors">
      <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full blur-3xl opacity-20" style={{ background: cfg.accentColor }} />
      <div className="relative">
        <div className="flex items-start gap-2 mb-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${cfg.accentColor}20`, color: cfg.accentColor }}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-white font-bold text-sm truncate">{room.name}</span>
              {room.hasPassword && <Lock className="w-3 h-3 text-amber-400 shrink-0" />}
            </div>
            <div className="text-white/40 text-[11px] flex items-center gap-1">
              <UserCircle className="w-3 h-3" /> Host: <span className="text-white/60">{room.hostName}</span>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`text-[9px] uppercase shrink-0 ${
              inLobby
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
            }`}
          >
            {inLobby ? "Lobby" : "Live"}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] mb-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/40 border border-white/5 text-white/60">
            <MapIcon className="w-3 h-3" style={{ color: mapDef?.accentColor }} /> {mapDef?.name ?? room.mapId}
          </span>
          {room.mode !== "survival" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/40 border border-white/5 text-white/60">
              <Users className="w-3 h-3" /> {room.mode === "ffa" || room.mode === "gungame" ? `${room.capacity} slots` : `${room.teamSize}v${room.teamSize}`}
            </span>
          )}
          {room.fillWithBots && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300/80">
              <Bot className="w-3 h-3" /> Bots fill
            </span>
          )}
        </div>

        {/* player count bar */}
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-white/40 mb-1">
            <span className="flex items-center gap-1"><Users className="w-2.5 h-2.5" /> Players</span>
            <span className="tabular-nums text-white/70">{room.humans}/{room.capacity}</span>
          </div>
          <div className="h-1.5 bg-black/60 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${full ? "bg-rose-500" : "bg-gradient-to-r from-emerald-500 to-cyan-500"}`}
              style={{ width: `${Math.min(100, (room.humans / room.capacity) * 100)}%` }}
            />
          </div>
        </div>

        <Button
          onClick={onJoin}
          disabled={full}
          className={`w-full h-9 font-semibold ${
            full
              ? "bg-white/5 text-white/40 cursor-not-allowed"
              : "bg-white/10 hover:bg-white/20 text-white border border-white/10"
          }`}
        >
          {full ? (
            <>Room Full</>
          ) : (
            <>{inLobby ? "Join Lobby" : "Join Match"} <ChevronRight className="w-4 h-4 ml-1" /></>
          )}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Small presentational helpers
// ============================================================================
function Section({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-white font-bold text-sm uppercase tracking-wider">{title}</h3>
        {hint && <span className="ml-auto text-[11px] text-white/40">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <span className="text-white/40 text-xs">{label}</span>
      <span className="text-sm font-medium truncate ml-2 max-w-[60%] text-right" style={{ color: accent ?? "rgba(255,255,255,0.85)" }}>{value}</span>
    </div>
  );
}

function ModePickCard({ mode, selected, onSelect }: { mode: GameMode; selected: boolean; onSelect: (m: GameMode) => void }) {
  const cfg = MATCH_MODES[mode];
  const Icon = mode === "ffa" ? Users : mode === "tdm" ? Shield : mode === "killconfirmed" ? Target : mode === "survival" ? Skull : Swords;
  return (
    <button
      onClick={() => onSelect(mode)}
      className={`relative text-left p-4 rounded-xl border transition-all overflow-hidden ${
        selected
          ? "bg-zinc-900/80 shadow-lg"
          : "border-white/10 bg-zinc-900/50 hover:border-white/25 hover:bg-zinc-900/80"
      }`}
      style={selected ? { borderColor: `${cfg.accentColor}80`, boxShadow: `0 0 20px ${cfg.accentColor}25`, background: `linear-gradient(135deg, ${cfg.accentColor}15, transparent 60%)` } : {}}
    >
      <div className="absolute -top-8 -right-8 w-20 h-20 rounded-full blur-2xl opacity-25" style={{ background: cfg.accentColor }} />
      <div className="relative">
        <div className="flex items-center gap-2 mb-1">
          <span style={{ color: cfg.accentColor }}><Icon className="w-5 h-5" /></span>
          <span className="text-white font-bold text-sm">{cfg.label}</span>
          {selected && (
            <span className="ml-auto text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold border" style={{ color: cfg.accentColor, borderColor: `${cfg.accentColor}50`, background: `${cfg.accentColor}20` }}>
              On
            </span>
          )}
        </div>
        <div className="text-white/50 text-[11px] leading-snug">{cfg.description}</div>
      </div>
    </button>
  );
}
