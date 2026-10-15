// ============================================================================
// VANGUARD OPS — Game Server (socket.io) on port 3003
// Authoritative match host: player sync, server-side hit detection, bot AI,
// FFA & TDM scoring, respawns, match end. Path is "/" (Caddy gateway rule).
// Started inside the Next.js process via src/instrumentation.ts so it stays
// alive as long as the dev server (the sandbox reaps detached processes).
// ============================================================================
import { createServer, type Server as HttpServer } from "http";
import { Server } from "socket.io";
import type {
  C2S, S2C, PlayerNet, GameMode, MatchConfig, SnapshotPlayer, KillFeedEntry,
  LoadoutWire, Vec3, MapId, MapDef, CoverBox, RoomSummary, CreateRoomConfig, TeamSize,
  BotDifficulty, KillDifficulty,
} from "./game-protocol";
import {
  getMap, rayBox, rayCapsule, PLAYER_RADIUS, PLAYER_HEIGHT, MAX_HEALTH, RESPAWN_DELAY_MS, DEFAULT_CONFIG,
  SURVIVAL_PREP_SEC, SURVIVAL_RESPAWN_MS, survivalWaveBotCount, survivalWaveHealthMul, survivalWaveDamageMul,
  roomCapacity, GUN_GAME_PROGRESSION, GUN_GAME_TYPE_PROGRESSION, GUN_GAME_TYPE_PROGRESSION_FALLBACK,
} from "./game-protocol";
import {
  weaponById, computeEffectiveStats, WEAPONS, type AttachmentSlot,
} from "./game-data";

const httpServer: HttpServer = createServer();
const io = new Server(httpServer, {
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ---- Room / match state -----------------------------------------------------
interface BotAI {
  targetId: string | null;
  wanderTarget: Vec3;
  nextShotAt: number;
  nextDecisionAt: number;
  ammoInMag: number;
  reloadingUntil: number;
  strafeDir: number;
  moveSpeed: number;
  // ---- Humanization (mirrors the offline engine) ----
  acquiredTargetAt: number;
  skill: number;
  burstShotsLeft: number;
  burstEndsAt: number;
  sprayDriftYaw: number;
  sprayDriftPitch: number;
  lastFiredAt: number;
  aimErrorYaw: number;
  aimErrorPitch: number;
  nextAimErrorAt: number;
  // The resolved difficulty for this bot (never "mixed" — that's rolled at
  // spawn time into one of easy/normal/hard/veteran). Used for rewards scaling.
  difficulty: Exclude<BotDifficulty, "mixed">;
  // ---- Stuck detection / recovery (mirrors the offline engine) ----
  // Tracks when the bot started being stuck (ms timestamp). 0 = not stuck.
  // Each tick we measure how far the bot moved since lastPosX/lastPosZ; if it
  // barely moved (< 0.05 units) despite having a movement intent, we mark it
  // stuck. If still stuck after 1.2s, force a recovery (new wander target +
  // sideways nudge) so bots never jam forever against a wall/corner.
  stuckSince: number;
  lastPosX: number;
  lastPosZ: number;
}

interface Room {
  id: string;
  mode: GameMode;
  config: MatchConfig;
  map: MapDef;
  players: Map<string, PlayerNet>;     // human (keyed by socket id)
  sockets: Map<string, string>;        // socketId -> playerId (same for humans)
  bots: Map<string, PlayerNet & { ai: BotAI; loadout: LoadoutWire }>;
  loadouts: Map<string, LoadoutWire>;  // playerId -> loadout
  scores: Map<string, number>;         // playerId -> kills
  teamScores: { red: number; blue: number };
  startTime: number;
  timeLeft: number;
  ended: boolean;
  // Lobby state machine: "lobby" = host waiting to start (no tick, no bots);
  // "playing" = match in progress (tick running, bots active); "ended" = cleaned up.
  state: "lobby" | "playing" | "ended";
  tick: NodeJS.Timeout | null;
  respawnTimers: Map<string, number>;
  chat: { name: string; text: string; team: string; at: number }[];
  // survival mode state
  wave: number;
  waveActive: boolean;
  prepLeft: number;
  reinforcements: number;
  reinforcementsMax: number;
  // ---- Room lobby metadata ----
  name: string;            // display name
  hostName: string;        // host's player name
  hostSocketId: string;    // socket id of the host (for transfer / permissions)
  teamSize: TeamSize;      // per-team size (3/5/7). FFA: total = teamSize*2.
  fillWithBots: boolean;   // bots occupy empty slots; replaced on human join
  password: string | null; // null = open room
  capacity: number;        // total combatant slots (humans + bots)
  botDifficulty: BotDifficulty;  // per-room bot skill ("mixed" rolls per bot at spawn)
  // ---- Gun Game progression (gungame mode only) ----
  // Per-player current tier index into the match's gun game progression.
  // Reset to 0 at match start; incremented on each kill (clamped to length-1).
  // The player's PlayerNet.weaponId is kept in sync with the progression.
  gungameProgress: Map<string, number>;
  // The per-match weapon list (resolved at match start from the TYPE-based
  // progression). Each slot is a specific weapon ID. This way, even if the
  // TYPE list is fixed (e.g. slot 4 is always "sniper"), the specific sniper
  // is randomly chosen when the match starts — so each match feels different.
  gungameWeapons: string[];
  // ---- Pre-match countdown (server-side) ----
  // When > 0, the match is in a "get ready" phase. Bots are frozen (no AI, no
  // shooting). Human players can still move and look around. The countdown
  // ticks down in the tickRoom loop; when it hits 0, normal gameplay resumes.
  preMatchCountdown: number;
}

const rooms = new Map<string, Room>();
const socketToRoom = new Map<string, string>();

function genId(prefix: string) {
  return prefix + "_" + Math.random().toString(36).slice(2, 8);
}

// ---- Gun Game: resolve the per-match weapon list ----
// For each TYPE in GUN_GAME_TYPE_PROGRESSION, pick a random weapon of that
// category from the catalog. This way the progression STRUCTURE is fixed
// (pistol → smg → shotgun → ... → melee) but the SPECIFIC weapons vary per
// match. Only ONE melee slot exists (the last tier — a kill with it wins).
// We also avoid repeating the same weapon within a match where possible.
function resolveGungameWeapons(): string[] {
  const used = new Set<string>();
  const result: string[] = [];
  for (let ti = 0; ti < GUN_GAME_TYPE_PROGRESSION.length; ti++) {
    const type = GUN_GAME_TYPE_PROGRESSION[ti];
    // Round 20: Exclude launcher_rocket from early sidearm tiers — it's too
    // powerful as a starting weapon. Only allow it in the "heavy sidearm"
    // tier (index 12, the second-to-last before melee).
    const isHeavySidearmTier = ti === 12; // the "heavy sidearm" slot before melee
    const candidates = WEAPONS.filter((w) => {
      if (w.category !== type) return false;
      // Exclude launcher from non-heavy tiers (it's too strong as a starter).
      if (w.id === "launcher_rocket" && !isHeavySidearmTier) return false;
      return true;
    });
    if (candidates.length === 0) {
      // Fallback: use the old flat progression's weapon for this index.
      result.push(GUN_GAME_TYPE_PROGRESSION_FALLBACK[result.length] ?? "pistol_side");
      continue;
    }
    // For the heavy sidearm tier, PREFER magnum/launcher (the "heavy" sidearms).
    let pool = candidates.filter((w) => !used.has(w.id));
    if (pool.length === 0) pool = candidates;
    if (isHeavySidearmTier) {
      // Prefer the heaviest sidearms (magnum, launcher) for this tier.
      const heavy = pool.filter((w) => w.id === "launcher_rocket" || w.id === "pistol_magnum");
      if (heavy.length > 0) pool = heavy;
    }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    result.push(pick.id);
    used.add(pick.id);
  }
  return result;
}

// Vertical ground-height helper: returns the highest walkable surface at (x,z)
// that is at or below feetY + stepTolerance.
function groundHeightAt(cover: CoverBox[], x: number, z: number, feetY: number, radius: number): number {
  let ground = 0;
  for (const cov of cover) {
    const cx = cov.pos[0], cz = cov.pos[2];
    const hx = cov.size[0], hz = cov.size[2];
    const topY = cov.pos[1] + cov.size[1];
    if (topY > feetY + 0.6) continue;
    if (topY <= ground) continue;
    if (Math.abs(x - cx) < hx + radius * 0.5 && Math.abs(z - cz) < hz + radius * 0.5) {
      ground = topY;
    }
  }
  return ground;
}

function pickSpawn(team: string, room: Room): Vec3 {
  const list = team === "red" ? room.map.spawns.red : team === "blue" ? room.map.spawns.blue : room.map.spawns.ffa;
  // ---- Spawn safety filter: skip spawn points whose XZ is INSIDE a cover box ----
  // (Some maps — notably Neon Plaza — have spawns inside the central tower or
  // corner platforms. Without this filter, the player spawns embedded in a wall
  // and can't move.)
  const safeList = list.filter((sp) => {
    for (const cov of room.map.cover) {
      const cx = cov.pos[0], cz = cov.pos[2];
      const hx = cov.size[0], hz = cov.size[2];
      const minY = cov.pos[1] - cov.size[1];
      const maxY = cov.pos[1] + cov.size[1];
      if (Math.abs(sp[0] - cx) < hx + PLAYER_RADIUS && Math.abs(sp[2] - cz) < hz + PLAYER_RADIUS) {
        if (maxY > sp[1] + 0.5 && minY < sp[1] + PLAYER_HEIGHT) {
          return false;  // unsafe — skip
        }
      }
    }
    return true;
  });
  const candidateList = safeList.length > 0 ? safeList : list;
  // pick spawn farthest from ALL living players (enemies AND allies — avoid spawning on anyone)
  const others = [...room.players.values(), ...room.bots.values()].filter((p) => p.alive);
  const scored = candidateList.map((sp) => {
    let minD = Infinity;
    for (const e of others) {
      const d = Math.hypot(e.pos[0] - sp[0], e.pos[2] - sp[2]);
      if (d < minD) minD = d;
    }
    // tiny random jitter to break ties so different respawns don't always pick the same point
    return { sp, score: minD + Math.random() * 2 };
  });
  scored.sort((a, b) => b.score - a.score);
  // Round 20: Enforce minimum spawn separation. Never spawn within 8 units
  // of another living player if avoidable. If ALL spawn points are within 8
  // units (small map / many players), pick the farthest one.
  const MIN_SPAWN_DIST = 8;
  const farScored = scored.filter((p) => p.score >= MIN_SPAWN_DIST);
  const chosen = (farScored.length > 0 ? farScored : scored)[0].sp;
  // Snap Y to ground level at that XZ (so elevated spawns sit on top of platforms)
  const groundY = groundHeightAt(room.map.cover, chosen[0], chosen[2], 50, PLAYER_RADIUS);
  return [chosen[0], Math.max(chosen[1], groundY), chosen[2]];
}

function assignTeam(mode: GameMode, room: Room, requested?: "red" | "blue" | "auto"): string {
  if (mode === "ffa" || mode === "gungame") return "ffa";
  if (mode === "survival") return "blue"; // all humans on the same side
  // TDM: honor an explicit red/blue request if that team isn't full.
  if (requested === "red" || requested === "blue") {
    if (!teamIsFull(room, requested)) return requested;
    // requested team is full — fall through to auto-balance
  }
  const red = [...room.players.values(), ...room.bots.values()].filter((p) => p.team === "red").length;
  const blue = [...room.players.values(), ...room.bots.values()].filter((p) => p.team === "blue").length;
  return red <= blue ? "red" : "blue";
}

// Resolve a per-bot difficulty from the room's setting. "mixed" rolls a random
// difficulty for each bot; otherwise the room's fixed difficulty is used.
function resolveBotDifficulty(room: Room): Exclude<BotDifficulty, "mixed"> {
  if (room.botDifficulty === "mixed") {
    const opts: Exclude<BotDifficulty, "mixed">[] = ["easy", "normal", "hard", "veteran"];
    return opts[Math.floor(Math.random() * opts.length)];
  }
  return room.botDifficulty;
}

// Skill range per difficulty tier. Higher skill = faster reaction, tighter aim.
const SKILL_RANGE: Record<Exclude<BotDifficulty, "mixed">, [number, number]> = {
  easy: [0.28, 0.45],
  normal: [0.45, 0.65],
  hard: [0.65, 0.80],
  veteran: [0.80, 0.95],
};

function botLoadout(): LoadoutWire {
  const pool = ["rifle_ar", "smg_kp", "rifle_dm", "rifle_ar", "smg_kp"];
  const wid = pool[Math.floor(Math.random() * pool.length)];
  return {
    weaponId: wid,
    weaponSkinId: "default",
    playerSkinId: ["default", "red", "blue", "green"][Math.floor(Math.random() * 4)],
    attachments: { sight: null, barrel: null, grip: null, magazine: null },
  };
}

function spawnBots(room: Room) {
  // Survival rooms spawn bots per-wave, not up front.
  if (room.mode === "survival") return;
  // Target bot count: for lobby rooms with fillWithBots, fill to capacity.
  // For legacy rooms, use config.botCount.
  const target = room.fillWithBots
    ? Math.max(0, room.capacity - room.players.size)
    : room.config.botCount;
  while (room.bots.size < target) {
    const id = genId("bot");
    const team = assignTeam(room.mode, room);
    const sp = pickSpawn(team, room);
    const loadout = botLoadout();
    const difficulty = resolveBotDifficulty(room);
    const ai = makeBotAI(sp, loadout.weaponId, difficulty, 0);
    // In gungame, every combatant (including bots) starts on the first
    // progression weapon and advances on each kill. Their loadout's
    // weaponId is overridden to the first tier of the per-match weapon list.
    const gungameWeaponId = room.mode === "gungame" ? (room.gungameWeapons[0] ?? GUN_GAME_TYPE_PROGRESSION_FALLBACK[0]) : loadout.weaponId;
    const bot: PlayerNet & { ai: BotAI; loadout: LoadoutWire } = {
      id, name: "Bot-" + id.slice(4, 8).toUpperCase(), team: team as any, isBot: true,
      pos: sp, yaw: 0, pitch: 0, health: MAX_HEALTH, alive: true,
      weaponId: gungameWeaponId, weaponSkinId: loadout.weaponSkinId, playerSkinId: loadout.playerSkinId,
      kills: 0, deaths: 0, lastShotAt: 0,
      ai, loadout,
    };
    room.bots.set(id, bot);
    room.loadouts.set(id, loadout);
    if (room.mode === "gungame") room.gungameProgress.set(id, 0);
  }
}

// Construct a fresh BotAI with humanization fields. The skill range is set by
// the bot's resolved difficulty (easy/normal/hard/veteran). `skillBoost` is an
// optional additive bump used by survival waves so late waves feel harder.
function makeBotAI(sp: Vec3, _weaponId: string, difficulty: Exclude<BotDifficulty, "mixed">, skillBoost = 0): BotAI {
  const [lo0, hi0] = SKILL_RANGE[difficulty];
  const lo = Math.min(0.95, lo0 + skillBoost * 0.05);
  const hi = Math.min(0.97, hi0 + skillBoost * 0.05);
  const skill = Math.min(0.95, lo + Math.random() * (hi - lo));
  return {
    targetId: null,
    wanderTarget: sp,
    nextShotAt: 0,
    nextDecisionAt: 0,
    ammoInMag: 30,
    reloadingUntil: 0,
    strafeDir: Math.random() < 0.5 ? 1 : -1,
    moveSpeed: 0.55 + Math.random() * 0.3,
    acquiredTargetAt: 0,
    skill,
    burstShotsLeft: 0,
    burstEndsAt: 0,
    sprayDriftYaw: 0,
    sprayDriftPitch: 0,
    lastFiredAt: 0,
    aimErrorYaw: 0,
    aimErrorPitch: 0,
    nextAimErrorAt: 0,
    difficulty,
    stuckSince: 0,
    lastPosX: sp[0],
    lastPosZ: sp[2],
  };
}

function createRoom(mode: GameMode, botCount: number, mapId: MapId): Room {
  const id = genId("match");
  const config = DEFAULT_CONFIG(mode, botCount);
  const map = getMap(mapId);
  const isSurvival = mode === "survival";
  const isGungame = mode === "gungame";
  // Gun Game: the score limit IS the progression length — first player to
  // cycle through every weapon (and get a kill with the knife) wins.
  if (isGungame) config.scoreLimit = GUN_GAME_PROGRESSION.length;
  // Legacy quick-match rooms: derive lobby metadata from botCount.
  const teamSize: TeamSize = (botCount <= 3 ? 3 : botCount <= 5 ? 5 : 7);
  const capacity = roomCapacity(mode, teamSize);
  const room: Room = {
    id, mode, config, map,
    players: new Map(), sockets: new Map(), bots: new Map(), loadouts: new Map(),
    scores: new Map(), teamScores: { red: 0, blue: 0 },
    startTime: Date.now(), timeLeft: config.timeLimit, ended: false,
    state: "playing",
    tick: null, respawnTimers: new Map(), chat: [],
    wave: 0, waveActive: false, prepLeft: isSurvival ? 5 : 0,
    reinforcements: isSurvival ? 5 : 0, reinforcementsMax: isSurvival ? 5 : 0,
    name: "Quick Match", hostName: "Server", hostSocketId: "",
    teamSize, fillWithBots: true, password: null, capacity,
    botDifficulty: "normal",
    gungameProgress: new Map(),
    gungameWeapons: [],
    preMatchCountdown: 5,
  };
  rooms.set(id, room);
  // ---- Gun Game: resolve the per-match weapon list BEFORE spawning bots ----
  // (so bots spawn with the correct first-tier weapon).
  if (isGungame) {
    room.gungameWeapons = resolveGungameWeapons();
    room.config.scoreLimit = room.gungameWeapons.length;
  }
  if (!isSurvival) spawnBots(room);
  room.tick = setInterval(() => tickRoom(room), 1000 / 20);
  return room;
}

function findOpenRoom(mode: GameMode, mapId: MapId): Room | null {
  for (const r of rooms.values()) {
    // Quick-match only joins rooms already in the "playing" state (lobby rooms
    // are joined explicitly via joinRoom).
    if (r.mode === mode && r.map.id === mapId && !r.ended && r.state === "playing") {
      // survival caps at 2 humans; others at 7
      const cap = mode === "survival" ? 2 : 7;
      if (r.players.size < cap) return r;
    }
  }
  return null;
}

// ---- Room lobby system -------------------------------------------------------
// Builds a public RoomSummary for the browser. Omits the password.
function roomSummary(r: Room): RoomSummary {
  return {
    id: r.id,
    name: r.name,
    hostName: r.hostName,
    mode: r.mode,
    mapId: r.map.id,
    mapName: r.map.name,
    teamSize: r.teamSize,
    fillWithBots: r.fillWithBots,
    hasPassword: r.password !== null && r.password !== "",
    humans: r.players.size,
    capacity: r.capacity,
    state: r.state === "ended" ? "lobby" : r.state,
    hasStarted: r.state === "playing",
    createdAt: r.startTime,
  };
}

// Count humans + bots on a given team.
function teamCount(room: Room, team: string): number {
  let n = 0;
  for (const p of room.players.values()) if (p.team === team) n++;
  for (const b of room.bots.values()) if (b.team === team) n++;
  return n;
}

// Is the given team at its per-team size limit?
function teamIsFull(room: Room, team: string): boolean {
  if (room.mode === "ffa" || room.mode === "gungame") return room.players.size + room.bots.size >= room.capacity;
  if (room.mode === "survival") return room.players.size >= room.capacity;
  return teamCount(room, team) >= room.teamSize;
}

// Remove one bot from the given team (used when a human replaces a bot).
function replaceBotOnTeam(room: Room, team: string): boolean {
  for (const [bid, b] of room.bots) {
    if (b.team === team) {
      room.bots.delete(bid);
      room.loadouts.delete(bid);
      room.scores.delete(bid);
      return true;
    }
  }
  return false;
}

// Add a human player to a room, replacing a bot on their team if the room is
// bot-filled and at capacity. Returns the assigned team. `requested` lets the
// joining player pick red/blue/auto for TDM.
function addHumanToRoom(room: Room, socketId: string, p: PlayerNet, loadout: LoadoutWire, requested?: "red" | "blue" | "auto"): string {
  const team = assignTeam(room.mode, room, requested);
  p.team = team as any;
  // If the room is bot-filled and this team is full, replace a bot with the human.
  if (room.fillWithBots && teamIsFull(room, team)) {
    replaceBotOnTeam(room, team);
  }
  room.players.set(socketId, p);
  room.sockets.set(socketId, socketId);
  room.scores.set(socketId, 0);
  room.loadouts.set(socketId, loadout);
  return team;
}

// Build the player list (humans + bots) as SnapshotPlayer[] for a lobby snapshot.
function lobbyPlayers(room: Room): SnapshotPlayer[] {
  return [...room.players.values(), ...room.bots.values()].map(toSnap);
}

// Broadcast a lobby snapshot to every socket in the room. Sent whenever the
// player list changes during the lobby state (join/leave/transfer).
function broadcastLobbySnapshot(room: Room) {
  const msg: S2C = {
    t: "lobbySnapshot",
    players: lobbyPlayers(room),
    hostSocketId: room.hostSocketId,
    state: "lobby",
  };
  io.to(room.id).emit("message", msg);
}

// Create a brand-new lobby room from the host's config. The room enters the
// "lobby" state: no bots are spawned and no tick runs until the host sends
// `startMatch`. The host is added as the first player.
function createLobbyRoom(
  socketId: string, name: string, loadout: LoadoutWire, cfg: CreateRoomConfig
): Room {
  const id = genId("match");
  const mode = cfg.mode;
  const map = getMap(cfg.mapId);
  const teamSize = cfg.teamSize;
  const capacity = roomCapacity(mode, teamSize);
  const config = DEFAULT_CONFIG(mode, mode === "survival" ? 0 : Math.max(0, capacity - 1));
  const isSurvival = mode === "survival";
  const isGungame = mode === "gungame";
  // Round 19i: Apply custom match limits from the host's room config (FFA/TDM only).
  // Survival and Gun Game ignore custom limits (survival is endless; gungame uses
  // the progression length as the score limit).
  if (!isSurvival && !isGungame) {
    if (typeof cfg.scoreLimit === "number" && cfg.scoreLimit > 0) config.scoreLimit = cfg.scoreLimit;
    if (typeof cfg.timeLimit === "number" && cfg.timeLimit >= 0) config.timeLimit = cfg.timeLimit;
  }
  // Gun Game: score limit will be set when the match starts (gungameWeapons resolved).
  // Use a placeholder for now; startMatchInRoom overwrites it.
  const room: Room = {
    id, mode, config, map,
    players: new Map(), sockets: new Map(), bots: new Map(), loadouts: new Map(),
    scores: new Map(), teamScores: { red: 0, blue: 0 },
    startTime: Date.now(), timeLeft: config.timeLimit, ended: false,
    state: "lobby",
    tick: null, respawnTimers: new Map(), chat: [],
    wave: 0, waveActive: false, prepLeft: isSurvival ? 5 : 0,
    reinforcements: isSurvival ? 5 : 0, reinforcementsMax: isSurvival ? 5 : 0,
    name: cfg.roomName?.trim() || `${name}'s Room`,
    hostName: name, hostSocketId: socketId,
    teamSize, fillWithBots: cfg.fillWithBots, password: cfg.password || null,
    capacity,
    botDifficulty: cfg.botDifficulty || "normal",
    gungameProgress: new Map(),
    gungameWeapons: [],
    preMatchCountdown: 0,  // lobby rooms set this when startMatch fires
  };
  rooms.set(id, room);
  // Add the host as the first player. Host picks red team in TDM by default.
  const team = assignTeam(mode, room, mode === "tdm" ? "red" : undefined);
  const sp = pickSpawn(team, room);
  // In gungame, the host's initial weaponId is a placeholder — startMatchInRoom
  // resolves the per-match weapon list and resets everyone's weaponId. For the
  // lobby display, use the first catalog weapon of the first type (sidearm).
  const hostWeaponId = isGungame ? "pistol_side" : loadout.weaponId;
  const host: PlayerNet = {
    id: socketId, name: name.slice(0, 20) || "Host", team: team as any, isBot: false,
    pos: sp, yaw: 0, pitch: 0, health: MAX_HEALTH, alive: true,
    weaponId: hostWeaponId, weaponSkinId: loadout.weaponSkinId, playerSkinId: loadout.playerSkinId,
    kills: 0, deaths: 0, lastShotAt: 0,
    spawnProtectedUntil: Date.now() + 3000,
  };
  room.players.set(socketId, host);
  room.sockets.set(socketId, socketId);
  room.scores.set(socketId, 0);
  room.loadouts.set(socketId, loadout);
  if (isGungame) room.gungameProgress.set(socketId, 0);
  // NOTE: do NOT spawn bots or start the tick here — the room waits in lobby
  // state until the host sends `startMatch`. Bots (if fillWithBots) spawn then.
  return room;
}

// Transition a lobby room into the "playing" state. Only the host may start.
// Spawns bots (if fillWithBots), resets the match clock, and starts the tick.
// Returns true on success, false on rejection (not host / wrong state).
function startMatchInRoom(room: Room, socketId: string): boolean {
  if (room.ended) return false;
  if (room.state !== "lobby") return false;  // already playing or ended
  if (room.hostSocketId !== socketId) return false;  // only the host can start
  room.state = "playing";
  room.startTime = Date.now();
  room.timeLeft = room.config.timeLimit;
  // Reset scores/teamScores in case the lobby had any stale state.
  room.teamScores = { red: 0, blue: 0 };
  for (const id of room.scores.keys()) room.scores.set(id, 0);
  // ---- Gun Game: resolve the per-match weapon list from the TYPE progression ----
  // GUN_GAME_TYPE_PROGRESSION is a fixed list of weapon CATEGORIES (e.g.
  // ["sidearm","smg","shotgun",...,"melee"]). For each type slot, we randomly
  // pick one weapon of that category from the catalog. This way:
  //   - The progression STRUCTURE is always the same (pistol start, melee end).
  //   - The SPECIFIC weapons vary per match (different sniper each time, etc.).
  //   - Only ONE melee slot exists (always the last tier).
  if (room.mode === "gungame") {
    room.gungameWeapons = resolveGungameWeapons();
    room.config.scoreLimit = room.gungameWeapons.length;
  }
  for (const p of room.players.values()) {
    p.kills = 0; p.deaths = 0; p.health = MAX_HEALTH; p.alive = true;
    // Reset gungame progress + weaponId for everyone (in case of restart).
    if (room.mode === "gungame") {
      room.gungameProgress.set(p.id, 0);
      p.weaponId = room.gungameWeapons[0];
    }
  }
  // Spawn bots to fill empty slots (survival spawns per-wave instead).
  if (room.fillWithBots && room.mode !== "survival") spawnBots(room);
  // ---- Start the pre-match countdown so bots don't shoot immediately ----
  room.preMatchCountdown = 5;
  // Broadcast the transition so clients hide the lobby overlay and start
  // processing snapshots. The tick interval begins emitting snapshots right away.
  // Include the resolved gungameWeapons list so ALL clients use the SAME per-match
  // weapon progression (previously each client generated its own local list,
  // causing tier mismatches between players).
  io.to(room.id).emit("message", {
    t: "matchStarted", config: room.config,
    ...(room.mode === "gungame" ? { gungameWeapons: room.gungameWeapons } : {}),
  } as S2C);
  room.tick = setInterval(() => tickRoom(room), 1000 / 20);
  return true;
}

// Join an existing lobby room by id + password. Returns the room or null on
// rejection (with an out-param error message). `requested` lets the joining
// player pick red/blue/auto for TDM (ignored for FFA/survival).
function joinLobbyRoom(
  socketId: string, name: string, loadout: LoadoutWire,
  roomId: string, password: string | null, requested?: "red" | "blue" | "auto"
): { room: Room | null; error: string | null } {
  const room = rooms.get(roomId);
  if (!room || room.ended) return { room: null, error: "Room no longer exists." };
  if (room.players.size >= room.capacity) {
    // If bot-filled, a human can replace a bot — but only if there's a bot to replace.
    if (room.fillWithBots && room.bots.size > 0) {
      // proceed — replacement happens in addHumanToRoom
    } else {
      return { room: null, error: "Room is full." };
    }
  }
  if (room.password && room.password !== "" && room.password !== (password ?? "")) {
    return { room: null, error: "Incorrect password." };
  }
  const team = assignTeam(room.mode, room, requested);
  const sp = pickSpawn(team, room);
  // In gungame, joining players get the first resolved weapon (or a placeholder
  // if the match hasn't started yet — startMatchInRoom will sync them).
  const joinWeaponId = room.mode === "gungame" ? (room.gungameWeapons[0] ?? "pistol_side") : loadout.weaponId;
  const p: PlayerNet = {
    id: socketId, name: name.slice(0, 20) || "Recruit", team: team as any, isBot: false,
    pos: sp, yaw: 0, pitch: 0, health: MAX_HEALTH, alive: true,
    weaponId: joinWeaponId, weaponSkinId: loadout.weaponSkinId, playerSkinId: loadout.playerSkinId,
    kills: 0, deaths: 0, lastShotAt: 0,
    spawnProtectedUntil: Date.now() + 3000,
  };
  addHumanToRoom(room, socketId, p, loadout, requested);
  if (room.mode === "gungame") room.gungameProgress.set(socketId, 0);
  return { room, error: null };
}

function snapshot(room: Room): S2C {
  const players: SnapshotPlayer[] = [];
  for (const p of room.players.values()) {
    players.push(toSnap(p));
  }
  for (const b of room.bots.values()) {
    players.push(toSnap(b));
  }
  const scores: Record<string, number> = {};
  for (const [id, k] of room.scores) scores[id] = k;
  const base: S2C = { t: "snapshot", players, scores, teamScores: room.teamScores, timeLeft: Math.max(0, Math.ceil(room.timeLeft)) };
  if (room.mode === "survival") {
    const enemiesLeft = [...room.bots.values()].filter((b) => b.alive).length;
    (base as any).wave = room.wave;
    (base as any).enemiesLeft = enemiesLeft;
    (base as any).reinforcements = room.reinforcements;
    (base as any).prepLeft = Math.max(0, Math.ceil(room.prepLeft));
  }
  // Include the pre-match countdown so the client can render the big "GET READY"
  // overlay + freeze local gameplay during the countdown.
  if (room.preMatchCountdown > 0) {
    (base as any).preMatchCountdown = Math.max(0, Math.ceil(room.preMatchCountdown));
  }
  // Include the resolved gungameWeapons list so late-joining clients (and any
  // client that missed the matchStarted broadcast) sync to the shared per-match
  // progression. This guarantees ALL players see the same weapon tiers.
  if (room.mode === "gungame" && room.gungameWeapons.length > 0) {
    (base as any).gungameWeapons = room.gungameWeapons;
  }
  return base;
}

function toSnap(p: PlayerNet): SnapshotPlayer {
  return {
    id: p.id, name: p.name, team: p.team, isBot: p.isBot,
    pos: p.pos, yaw: p.yaw, pitch: p.pitch, health: p.health, alive: p.alive,
    weaponId: p.weaponId, weaponSkinId: p.weaponSkinId, playerSkinId: p.playerSkinId,
    kills: p.kills, deaths: p.deaths, aiming: false, reloading: false,
  };
}

function allCombatants(room: Room): PlayerNet[] {
  return [...room.players.values(), ...room.bots.values()];
}

// ---- LOS & hit detection ----------------------------------------------------
function losBlocked(room: Room, origin: Vec3, dir: Vec3, maxT: number): boolean {
  for (const c of room.map.cover) {
    const t = rayBox(origin, dir, c.pos, c.size);
    if (t !== null && t < maxT) return true;
  }
  return false;
}

// Damage falloff: at distance <= range, full damage. Beyond range, damage falls linearly
// to 60% at range*1.6, then stays at 60%.
function damageAtRange(base: number, dist: number, range: number): number {
  if (dist <= range) return base;
  const fallEnd = range * 1.6;
  if (dist >= fallEnd) return base * 0.6;
  const t = (dist - range) / (fallEnd - range);
  return base * (1 - 0.4 * t);
}

function fireRay(room: Room, attackerId: string, origin: Vec3, dir: Vec3, weaponId: string, range: number): { victim: PlayerNet; t: number; head: boolean } | null {
  const attacker = room.players.get(attackerId) ?? room.bots.get(attackerId);
  const attackerTeam = attacker?.team;
  let nearest: { victim: PlayerNet; t: number; head: boolean } | null = null;
  for (const p of allCombatants(room)) {
    if (p.id === attackerId) continue;
    if (!p.alive) continue;
    if (room.config.friendlyFire === false && p.team === attackerTeam && room.mode !== "ffa" && room.mode !== "gungame") continue;
    const center: Vec3 = [p.pos[0], p.pos[1] + PLAYER_HEIGHT / 2, p.pos[2]];
    const hit = rayCapsule(origin, dir, center, PLAYER_RADIUS, PLAYER_HEIGHT);
    if (hit && hit.t >= 0 && hit.t <= range * 1.6) {
      if (!nearest || hit.t < nearest.t) nearest = { victim: p, t: hit.t, head: hit.head };
    }
  }
  if (!nearest) return null;
  if (losBlocked(room, origin, dir, nearest.t)) return null;
  return nearest;
}

// Determine the victim's "kill difficulty" for rewards scaling. Bot victims
// use their AI's resolved difficulty; human victims are treated as "veteran"
// (the top tier — PvP kills are the most valuable).
function victimKillDifficulty(victim: PlayerNet): KillDifficulty {
  const bot = victim as PlayerNet & { ai?: BotAI };
  if (victim.isBot && bot.ai) return bot.ai.difficulty;
  return "enemy_player";
}

function applyDamage(room: Room, attackerId: string, victim: PlayerNet, damage: number, head: boolean, weaponId: string) {
  if (!victim.alive) return;
  // Spawn protection: skip damage entirely if the victim is within their grace period.
  // This prevents bots from killing a freshly-spawned player before they can react.
  if (victim.spawnProtectedUntil && victim.spawnProtectedUntil > Date.now()) return;
  let dmg = damage;
  const attacker = room.players.get(attackerId) ?? room.bots.get(attackerId);
  // Survival: bots hit harder as waves progress, BUT base damage is reduced
  // by 35% for player survivability (Round 18-b balance fix).
  if (room.mode === "survival" && attacker?.isBot) dmg *= 0.65 * survivalWaveDamageMul(room.wave);
  victim.health -= dmg;
  const killed = victim.health <= 0;
  // For rewards scaling: attach the victim's difficulty to the hit event when
  // it's a kill. Non-killing hits don't need it (only kills earn rewards).
  const killDiff: KillDifficulty | undefined = killed ? victimKillDifficulty(victim) : undefined;
  io.to(room.id).emit("message", {
    t: "hit", attackerId, victimId: victim.id, damage: Math.round(dmg),
    headshot: head, killed, weaponId,
    ...(killDiff ? { botDifficulty: killDiff } : {}),
  } as S2C);
  if (killed) {
    victim.alive = false;
    victim.deaths += 1;
    if (attacker) {
      attacker.kills += 1;
      room.scores.set(attackerId, (room.scores.get(attackerId) ?? 0) + 1);
      if (room.mode === "tdm") {
        room.teamScores[attacker.team as "red" | "blue"] += 1;
      }
    }
    const entry: KillFeedEntry = {
      killer: attacker?.name ?? "World", victim: victim.name, weapon: weaponId, headshot: head,
      killerTeam: attacker?.team ?? "ffa", victimTeam: victim.team,
      botDifficulty: killDiff,
    };
    io.to(room.id).emit("message", { t: "kill", entry } as S2C);
    if (room.mode === "survival") {
      if (victim.isBot) {
        // dead bots stay dead until the next wave resets them — no respawn
      } else {
        // human death: consume a reinforcement; game over when the pool is empty
        room.reinforcements = Math.max(0, room.reinforcements - 1);
        if (room.reinforcements <= 0) {
          endMatch(room);
        } else {
          scheduleRespawn(room, victim);
        }
      }
    } else if (room.mode === "gungame") {
      // Gun Game: the attacker advances their tier on each kill. If they were
      // already on the FINAL weapon (the last melee tier), this kill wins the match.
      if (attacker) {
        const idx = room.gungameProgress.get(attackerId) ?? 0;
        const last = room.gungameWeapons.length - 1;
        if (idx >= last) {
          // Final-weapon kill — match ends now.
          endMatch(room);
        } else {
          const newIdx = Math.min(last, idx + 1);
          room.gungameProgress.set(attackerId, newIdx);
          const newWeaponId = room.gungameWeapons[newIdx];
          attacker.weaponId = newWeaponId;
          io.to(room.id).emit("message", {
            t: "gungameProgress", playerId: attackerId, weaponIndex: newIdx, weaponId: newWeaponId,
          } as S2C);
        }
      }
      if (!room.ended) scheduleRespawn(room, victim);
    } else {
      scheduleRespawn(room, victim);
    }
    checkWin(room);
  }
}

function scheduleRespawn(room: Room, p: PlayerNet) {
  if (room.respawnTimers.has(p.id)) return;
  const delay = room.mode === "survival" ? SURVIVAL_RESPAWN_MS : RESPAWN_DELAY_MS;
  const timer = setTimeout(() => {
    const sp = pickSpawn(p.team, room);
    p.pos = sp;
    p.health = MAX_HEALTH;
    p.alive = true;
    // Spawn protection: 2.5s grace period after respawn so the player can orient
    // before bots start shooting them. Bots also skip spawn-protected targets.
    p.spawnProtectedUntil = Date.now() + 2500;
    room.respawnTimers.delete(p.id);
    io.to(room.id).emit("message", { t: "respawn", playerId: p.id, pos: sp, health: MAX_HEALTH } as S2C);
  }, delay) as unknown as number;
  room.respawnTimers.set(p.id, timer);
}

function checkWin(room: Room) {
  if (room.ended) return;
  if (room.mode === "survival") return; // endless — game over handled on reinforcement depletion
  if (room.mode === "ffa" || room.mode === "gungame") {
    for (const [, k] of room.scores) if (k >= room.config.scoreLimit) return endMatch(room);
  } else {
    if (room.teamScores.red >= room.config.scoreLimit || room.teamScores.blue >= room.config.scoreLimit) return endMatch(room);
  }
}

function endMatch(room: Room) {
  if (room.ended) return;
  room.ended = true;
  room.state = "ended";
  if (room.tick) clearInterval(room.tick);
  room.tick = null;
  const standings = allCombatants(room).map((p) => ({
    id: p.id, name: p.name, team: p.team, kills: p.kills, deaths: p.deaths,
    score: room.mode === "survival" ? (p.isBot ? p.kills : room.wave) : (room.scores.get(p.id) ?? 0), isBot: p.isBot,
  })).sort((a, b) => b.score - a.score || b.kills - a.kills);
  let winnerTeam: string | null = null;
  if (room.mode === "tdm") winnerTeam = room.teamScores.red > room.teamScores.blue ? "red" : room.teamScores.blue > room.teamScores.red ? "blue" : null;
  else if (room.mode === "survival") winnerTeam = null;
  else winnerTeam = standings[0] ? standings[0].team : null;
  io.to(room.id).emit("message", { t: "matchEnd", standings, winnerTeam } as S2C);
  // cleanup room after a delay
  setTimeout(() => {
    for (const t of room.respawnTimers.values()) clearTimeout(t as unknown as ReturnType<typeof setTimeout>);
    rooms.delete(room.id);
  }, 15000);
}

// ---- Survival wave spawning ----
// Difficulty scales with wave: early waves are easy, late waves are veteran.
// This affects both bot skill (via makeBotAI) and per-kill rewards.
function survivalWaveDifficulty(wave: number): Exclude<BotDifficulty, "mixed"> {
  if (wave <= 3) return "easy";
  if (wave <= 6) return "normal";
  if (wave <= 9) return "hard";
  return "veteran";
}

function startSurvivalWave(room: Room) {
  room.wave += 1;
  room.waveActive = true;
  // cleanup any leftover dead bots from the previous wave
  for (const [id, b] of room.bots) {
    if (!b.alive) room.bots.delete(id);
  }
  const count = survivalWaveBotCount(room.wave);
  const hpMul = survivalWaveHealthMul(room.wave);
  // ---- Round 18-b: expanded random weapon pool ----
  // Use ALL primary + secondary weapons (excluding melee and launcher) for
  // maximum gameplay variety. Each bot gets a truly random weapon.
  const pool = [
    "rifle_ar", "rifle_burst", "rifle_heavy",       // assault
    "smg_kp", "smg_vector", "smg_compact",            // smg
    "shotgun_br", "shotgun_auto", "shotgun_combat",   // shotgun
    "rifle_dm", "dmr_scout", "dmr_heavy",             // dmr
    "sniper_scout", "sniper_lr", "sniper_heavy",      // sniper
    "lmg_hv", "lmg_light", "lmg_heavy",               // lmg
    "pistol_side", "pistol_burst", "pistol_machine", "pistol_magnum", // sidearms
  ];
  const skins = ["red", "orange", "purple", "default", "red", "blue", "green", "phantom"];
  const waveDiff = survivalWaveDifficulty(room.wave);
  for (let n = 0; n < count; n++) {
    const id = genId("svbot");
    // ---- Round 18-b: spread out spawns ----
    // Use FFA spawn list (spread across the whole map) instead of red-team-only
    // spawns (one side only). This prevents all bots from swarming from one
    // direction.
    const sp = pickSpawn("ffa", room);
    const loadout = botLoadout();
    loadout.weaponId = pool[Math.floor(Math.random() * pool.length)];
    loadout.playerSkinId = skins[n % skins.length];
    const ai = makeBotAI(sp, loadout.weaponId, waveDiff, room.wave);
    ai.ammoInMag = weaponById(loadout.weaponId).stats.magSize;
    const bot: PlayerNet & { ai: BotAI; loadout: LoadoutWire } = {
      id, name: `W${room.wave}·${n + 1}`, team: "red", isBot: true,
      pos: sp, yaw: 0, pitch: 0, health: Math.round(MAX_HEALTH * hpMul), alive: true,
      weaponId: loadout.weaponId, weaponSkinId: "default", playerSkinId: loadout.playerSkinId,
      kills: 0, deaths: 0, lastShotAt: 0,
      ai, loadout,
    };
    room.bots.set(id, bot);
    room.loadouts.set(id, loadout);
  }
}

// ---- Bot AI -----------------------------------------------------------------
function tickRoom(room: Room) {
  if (room.ended) return;
  // ---- Pre-match countdown: decrement FIRST for ALL modes (including survival) ----
  // Previously the survival branch returned early, so `preMatchCountdown` never
  // decremented for survival rooms — the client's "GET READY 5" overlay stuck
  // at 5 forever and gameplay never began. Now we decrement it up here (before
  // the mode-specific branches) so every mode's countdown ticks down uniformly.
  if (room.preMatchCountdown > 0) {
    room.preMatchCountdown -= 1 / 20;
    if (room.preMatchCountdown < 0) room.preMatchCountdown = 0;
  }
  if (room.mode === "survival") {
    // Survival: no time limit. Run wave state machine.
    // Only tick the wave prep/wave-active logic once the pre-match countdown
    // has finished — otherwise the wave-1 prep (prepLeft=5) counts down in
    // parallel with the pre-match countdown, spawning bots before the player
    // can even move.
    if (room.preMatchCountdown <= 0) {
      if (room.prepLeft > 0) {
        room.prepLeft -= 1 / 20;
        if (room.prepLeft <= 0) {
          room.prepLeft = 0;
          if (!room.waveActive) startSurvivalWave(room);
        }
      } else if (room.waveActive) {
        const aliveBots = [...room.bots.values()].filter((b) => b.alive).length;
        if (aliveBots === 0) {
          room.waveActive = false;
          room.prepLeft = SURVIVAL_PREP_SEC;
        }
      }
    }
    const now = Date.now();
    // Only run bot AI once the pre-match countdown is over (bots freeze during
    // "GET READY" so the player has a moment to orient).
    if (room.preMatchCountdown <= 0) {
      for (const bot of room.bots.values()) {
        if (!bot.alive) continue;
        updateBotAI(room, bot, now);
      }
    }
    io.to(room.id).emit("message", snapshot(room));
    return;
  }
  // Round 20: Only tick the timer if there IS a time limit (timeLeft > 0).
  // timeLeft = 0 means "no limit" — the match runs until the kill target
  // is reached. Previously, a 0 timeLimit caused the match to end instantly.
  if (room.timeLeft > 0) {
    room.timeLeft -= 1 / 20;
    if (room.timeLeft <= 0) return endMatch(room);
  }
  const now = Date.now();
  // Only run bot AI when the pre-match countdown is over.
  if (room.preMatchCountdown <= 0) {
    for (const bot of room.bots.values()) {
      if (!bot.alive) continue;
      updateBotAI(room, bot, now);
    }
  }
  // broadcast ~ every tick (20Hz). Could throttle to 15Hz to save bandwidth but fine.
  io.to(room.id).emit("message", snapshot(room));
}

function nearestEnemy(room: Room, p: PlayerNet): PlayerNet | null {
  let best: PlayerNet | null = null;
  let bestD = Infinity;
  // Bots require LINE OF SIGHT to acquire a target (they're no longer omniscient).
  // If no visible enemy exists, the bot falls back to wandering. This makes bots
  // feel less psychic — you can break LoS to escape them.
  for (const e of allCombatants(room)) {
    if (e.id === p.id || !e.alive) continue;
    if (e.team === p.team && room.mode !== "ffa" && room.mode !== "gungame") continue;
    const d = Math.hypot(e.pos[0] - p.pos[0], e.pos[2] - p.pos[2]);
    if (d >= bestD) continue;
    // Only acquire targets within the bot's engagement range AND with clear LoS.
    if (d > 55) continue;
    const fromY = p.pos[1] + PLAYER_HEIGHT / 2;
    const toY = e.pos[1] + PLAYER_HEIGHT / 2;
    if (!hasLineOfSight(room, [p.pos[0], fromY, p.pos[2]], [e.pos[0], toY, e.pos[2]])) continue;
    bestD = d;
    best = e;
  }
  return best;
}

function updateBotAI(room: Room, bot: PlayerNet & { ai: BotAI; loadout: LoadoutWire }, now: number) {
  const ai = bot.ai;
  const weapon = weaponById(bot.weaponId);
  const eff = computeEffectiveStats(weapon, bot.loadout.attachments as Record<AttachmentSlot, string | null>);

  if (now > ai.nextDecisionAt) {
    ai.nextDecisionAt = now + 400 + Math.random() * 600;
    const enemy = nearestEnemy(room, bot);
    const prevTarget = ai.targetId;
    ai.targetId = enemy ? enemy.id : null;
    // Record when a NEW target is acquired so we can enforce a human-like reaction delay.
    if (ai.targetId && ai.targetId !== prevTarget) {
      ai.acquiredTargetAt = now;
    }
    if (!enemy) {
      // wander
      const list = bot.team === "red" ? room.map.spawns.red : bot.team === "blue" ? room.map.spawns.blue : room.map.spawns.ffa;
      ai.wanderTarget = list[Math.floor(Math.random() * list.length)];
    }
    if (Math.random() < 0.4) ai.strafeDir = -ai.strafeDir;
  }

  const target = ai.targetId ? (room.players.get(ai.targetId) ?? room.bots.get(ai.targetId)) : null;
  if (target && target.alive) {
    const dx = target.pos[0] - bot.pos[0];
    const dz = target.pos[2] - bot.pos[2];
    const dist = Math.hypot(dx, dz);
    const dy = (target.pos[1] + 1.5) - (bot.pos[1] + 1.5);
    const desiredYaw = Math.atan2(dx, dz);
    // Skill-scaled turn speed + slow-varying aim error (mirrors the offline engine).
    const turnLerp = 0.08 + ai.skill * 0.18;
    if (now > ai.nextAimErrorAt) {
      ai.nextAimErrorAt = now + 350 + Math.random() * 400;
      const errMag = (1 - ai.skill) * 0.18 + 0.02;
      ai.aimErrorYaw = (Math.random() - 0.5) * errMag * 2;
      ai.aimErrorPitch = (Math.random() - 0.5) * errMag * 2;
    }
    bot.yaw = lerpAngle(bot.yaw, desiredYaw + ai.aimErrorYaw, turnLerp);
    bot.pitch = lerpAngle(bot.pitch, Math.atan2(dy, Math.hypot(dx, dz)) * 0.6 + ai.aimErrorPitch, turnLerp);

    // Spray drift accumulation/decay
    const sinceFired = now - ai.lastFiredAt;
    if (sinceFired > 200) {
      ai.sprayDriftYaw *= 0.92;
      ai.sprayDriftPitch *= 0.92;
    }

    const moveSpeed = ai.moveSpeed * 6 * eff.moveSpeed; // units per second-ish scaled by tick
    const ideal = 14;
    let mvx = 0, mvz = 0;
    if (dist > ideal + 3) {
      mvx = Math.sin(bot.yaw) * moveSpeed / 20;
      mvz = Math.cos(bot.yaw) * moveSpeed / 20;
    } else if (dist < ideal - 3) {
      mvx = -Math.sin(bot.yaw) * moveSpeed / 20;
      mvz = -Math.cos(bot.yaw) * moveSpeed / 20;
    } else {
      // strafe
      mvx = Math.cos(bot.yaw) * ai.strafeDir * moveSpeed / 20 * 0.7;
      mvz = -Math.sin(bot.yaw) * ai.strafeDir * moveSpeed / 20 * 0.7;
    }
    // Substepped movement with wall collision (ported from the offline engine).
    // Without this, online bots teleport through walls/cover to reach the player.
    // Task 16-a: SUBSTEP tightened from 0.20 to 0.15 so the upcoming thin cover
    // boxes (half-extent 0.3-0.4) in Task 16-b have more headroom. Added a 45°
    // diagonal slide nudge after X-only/Z-only fail (same as the offline engine).
    const moveLen = Math.hypot(mvx, mvz);
    const SUBSTEP = 0.15;
    const steps = Math.max(1, Math.ceil(moveLen / SUBSTEP));
    const sx = mvx / steps, sz = mvz / steps;
    for (let s = 0; s < steps; s++) {
      const from: Vec3 = [bot.pos[0], bot.pos[1], bot.pos[2]];
      const nextX = bot.pos[0] + sx, nextZ = bot.pos[2] + sz;
      const to: Vec3 = [nextX, bot.pos[1], nextZ];
      if (!botMoveBlocked(room, from, to, bot.pos[1])) {
        bot.pos[0] = nextX; bot.pos[2] = nextZ;
      } else {
        // Try sliding along X only.
        const toX: Vec3 = [nextX, bot.pos[1], bot.pos[2]];
        if (!botMoveBlocked(room, from, toX, bot.pos[1])) { bot.pos[0] = nextX; continue; }
        // Try sliding along Z only.
        const toZ: Vec3 = [bot.pos[0], bot.pos[1], nextZ];
        if (!botMoveBlocked(room, from, toZ, bot.pos[1])) { bot.pos[2] = nextZ; continue; }
        // Task 16-a: 45° diagonal nudge — slide diagonally along the wall.
        // Rotates the intended direction (sx, sz) by 45° (CW) and tries that.
        // Helps bots slide around concave corners instead of jamming.
        const diagX = (sx + sz) * 0.5;
        const diagZ = (sz - sx) * 0.5;
        const toDiag: Vec3 = [bot.pos[0] + diagX, bot.pos[1], bot.pos[2] + diagZ];
        if (!botMoveBlocked(room, from, toDiag, bot.pos[1])) { bot.pos[0] = toDiag[0]; bot.pos[2] = toDiag[2]; continue; }
        break; // fully blocked
      }
    }
    // Final iterative push-out (handles residual overlap from edge cases).
    bot.pos = collideBots(room, bot.pos, bot.pos[1]);
    // Task 16-a: soft bot-vs-bot (and bot-vs-player) separation. Push the bot
    // away from any other combatant that's too close on XZ. Runs AFTER the
    // cover push-out and BEFORE the ground snap so the snap uses the
    // separated XZ position.
    separateBots(room, bot, bot.pos[1]);
    // Vertical: snap bot to ground height at new XZ so they climb stairs naturally.
    // NOTE: pass feetY directly (NOT +1) — the +1 gave bots ~1.6 units of vertical
    // "reach", letting them climb 1.5-high walls and appear to phase through solid
    // objects. With feetY as-is, the step threshold (1.3) is the only reach.
    const gh = groundHeightAt(room.map.cover, bot.pos[0], bot.pos[2], bot.pos[1], PLAYER_RADIUS);
    bot.pos[1] += (gh - bot.pos[1]) * 0.4;
    bot.pos = clampToArena(room, bot.pos);

    // ---- Reaction delay (skill-scaled) ----
    const REACTION_MS = (1 - ai.skill) * 650 + 120 + Math.random() * 130;
    const reacted = now - ai.acquiredTargetAt >= REACTION_MS;

    // ---- Burst fire for auto weapons ----
    const isAuto = weapon.stats.auto;
    const burstPaused = isAuto && now < ai.burstEndsAt;
    if (isAuto && ai.burstShotsLeft <= 0 && now >= ai.burstEndsAt && reacted) {
      ai.burstShotsLeft = Math.max(2, Math.round(3 + ai.skill * 4 + (Math.random() - 0.5) * 2));
    }

    // ---- Intentional miss chance ----
    const missChance = (1 - ai.skill) * 0.45 + 0.03;
    const missThisShot = Math.random() < missChance;
    const missSpread = missThisShot ? eff.spread * 8 + 0.04 : 0;
    const distSpread = dist > 25 ? (dist - 25) * 0.0015 : 0;

    // shooting
    if (reacted && now > ai.nextShotAt && ai.ammoInMag > 0 && now > ai.reloadingUntil && !burstPaused) {
      const aimYaw = bot.yaw + ai.sprayDriftYaw + (Math.random() - 0.5) * (eff.spread * 2 + distSpread + missSpread);
      const aimPitch = bot.pitch + ai.sprayDriftPitch + (Math.random() - 0.5) * (eff.spread * 2 + distSpread + missSpread);
      const dir = dirFromYawPitch(aimYaw, aimPitch);
      const origin: Vec3 = [bot.pos[0], bot.pos[1] + 1.5, bot.pos[2]];
      const pellets = weapon.stats.pellets ?? 1;
      let didHit = false;
      for (let i = 0; i < pellets; i++) {
        const pdir = pellets > 1 ? normalize(add(dir, randSpread(eff.spread))) : dir;
        const hit = fireRay(room, bot.id, origin, pdir, bot.weaponId, eff.range);
        if (hit) {
          const baseDmg = eff.damage * (hit.head ? weapon.stats.headshotMult : 1);
          const dmg = damageAtRange(baseDmg, hit.t, eff.range);
          applyDamage(room, bot.id, hit.victim, dmg, hit.head, bot.weaponId);
          didHit = true;
        }
      }
      io.to(room.id).emit("message", { t: "shotFx", origin, dir, weaponId: bot.weaponId, attackerId: bot.id, skinId: bot.weaponSkinId, suppressed: bot.loadout.attachments.barrel === "barrel_suppressor" } as S2C);
      ai.ammoInMag--;
      ai.lastFiredAt = now;
      // Accumulate spray drift from this shot.
      const driftKick = eff.recoil * 0.0024 * (1 - ai.skill * 0.5);
      ai.sprayDriftPitch += driftKick;
      ai.sprayDriftYaw += (Math.random() - 0.5) * driftKick * 0.8;
      ai.sprayDriftYaw = Math.max(-0.18, Math.min(0.18, ai.sprayDriftYaw));
      ai.sprayDriftPitch = Math.max(0, Math.min(0.18, ai.sprayDriftPitch));
      // Compute next-shot timing (burst cadence for autos, tap cadence for semi).
      if (isAuto) {
        ai.burstShotsLeft -= 1;
        if (ai.burstShotsLeft <= 0) {
          const pauseMs = 200 + (1 - ai.skill) * 350 + Math.random() * 200;
          ai.burstEndsAt = now + pauseMs;
          ai.nextShotAt = now + pauseMs;
        } else {
          ai.nextShotAt = now + 1000 / Math.max(1, eff.fireRate) * (1.0 + (1 - ai.skill) * 0.4) + Math.random() * 30;
        }
      } else {
        ai.nextShotAt = now + 1000 / Math.max(1, eff.fireRate) * (1.4 + (1 - ai.skill) * 0.6) + Math.random() * 200;
      }
      if (!didHit && Math.random() < 0.15) ai.nextShotAt += 200; // miss hesitation
    }
    // ---- Reload decisions (smart: reload early when safe) ----
    const enemyVisible = dist < 35;
    const lowAmmo = ai.ammoInMag <= Math.max(1, Math.floor(eff.magSize * 0.3));
    const wantSmartReload = lowAmmo && !enemyVisible && ai.skill > 0.4 && Math.random() < 0.02;
    if ((ai.ammoInMag <= 0 || wantSmartReload) && now > ai.reloadingUntil) {
      ai.reloadingUntil = now + eff.reloadTime * 1000;
      ai.ammoInMag = eff.magSize;
      ai.burstShotsLeft = 0;
      ai.burstEndsAt = now + eff.reloadTime * 1000;
      io.to(room.id).emit("message", { t: "reloadFx", playerId: bot.id } as S2C);
    }
  } else {
    // wander toward wanderTarget (with wall collision so bots don't clip through cover)
    const dx = ai.wanderTarget[0] - bot.pos[0];
    const dz = ai.wanderTarget[2] - bot.pos[2];
    const d = Math.hypot(dx, dz);
    if (d > 1.5) {
      // Task 16-a: wall-ahead lookahead. Probe 2 units forward in the movement
      // direction. If blocked, rotate the movement direction by ±35° (sign
      // from ai.strafeDir) so the bot angles around the obstacle instead of
      // headbutting it. The yaw is set to the rotated direction so the bot
      // faces where it's going.
      let fx = dx / d, fz = dz / d;
      const probeFrom: Vec3 = [bot.pos[0], bot.pos[1], bot.pos[2]];
      const probeTo: Vec3 = [bot.pos[0] + fx * 2, bot.pos[1], bot.pos[2] + fz * 2];
      if (botMoveBlocked(room, probeFrom, probeTo, bot.pos[1])) {
        const turn = ai.strafeDir * (35 * Math.PI / 180);
        const cosT = Math.cos(turn), sinT = Math.sin(turn);
        const rfx = fx * cosT - fz * sinT;
        const rfz = fx * sinT + fz * cosT;
        fx = rfx; fz = rfz;
        bot.yaw = Math.atan2(fx, fz);
      } else {
        bot.yaw = lerpAngle(bot.yaw, Math.atan2(dx, dz), 0.15);
      }
      const mvx = fx * ai.moveSpeed * 5 / 20;
      const mvz = fz * ai.moveSpeed * 5 / 20;
      // Substepped collision-aware movement (same as the chase path).
      // Task 16-a: SUBSTEP=0.15 (was 0.2), with slide-along-wall + 45° diagonal.
      const moveLen = Math.hypot(mvx, mvz);
      const SUBSTEP = 0.15;
      const steps = Math.max(1, Math.ceil(moveLen / SUBSTEP));
      const sx = mvx / steps, sz = mvz / steps;
      for (let s = 0; s < steps; s++) {
        const from: Vec3 = [bot.pos[0], bot.pos[1], bot.pos[2]];
        const nextX = bot.pos[0] + sx, nextZ = bot.pos[2] + sz;
        const to: Vec3 = [nextX, bot.pos[1], nextZ];
        if (!botMoveBlocked(room, from, to, bot.pos[1])) {
          bot.pos[0] = nextX; bot.pos[2] = nextZ;
        } else {
          const toX: Vec3 = [nextX, bot.pos[1], bot.pos[2]];
          if (!botMoveBlocked(room, from, toX, bot.pos[1])) { bot.pos[0] = nextX; continue; }
          const toZ: Vec3 = [bot.pos[0], bot.pos[1], nextZ];
          if (!botMoveBlocked(room, from, toZ, bot.pos[1])) { bot.pos[2] = nextZ; continue; }
          // 45° diagonal nudge (same as the engage path).
          const diagX = (sx + sz) * 0.5;
          const diagZ = (sz - sx) * 0.5;
          const toDiag: Vec3 = [bot.pos[0] + diagX, bot.pos[1], bot.pos[2] + diagZ];
          if (!botMoveBlocked(room, from, toDiag, bot.pos[1])) { bot.pos[0] = toDiag[0]; bot.pos[2] = toDiag[2]; continue; }
          break;
        }
      }
      bot.pos = collideBots(room, bot.pos, bot.pos[1]);
      // Task 16-a: soft bot-vs-bot separation (same as engage path).
      separateBots(room, bot, bot.pos[1]);
      // Wander path: same ground-height snap (no +1 reach — see engage path above).
      const gh = groundHeightAt(room.map.cover, bot.pos[0], bot.pos[2], bot.pos[1], PLAYER_RADIUS);
      bot.pos[1] += (gh - bot.pos[1]) * 0.4;
      bot.pos = clampToArena(room, bot.pos);
    }
  }
  // ---- Task 16-a: stuck detection & recovery (mirrors the offline engine) ----
  // Measure how far the bot moved THIS tick (vs the position recorded at the
  // end of the previous tick). If the bot has a movement intent (target
  // acquired OR wander target > 1.5 away) but barely moved (< 0.05 units),
  // it's stuck — mark the start time. If still stuck after 1.2s, force a
  // recovery: new random wander target, clear the target (so it wanders),
  // flip strafe dir, nudge sideways, re-run collideBots.
  {
    const wanderDist = Math.hypot(ai.wanderTarget[0] - bot.pos[0], ai.wanderTarget[2] - bot.pos[2]);
    const hasIntent = ai.targetId !== null || wanderDist > 1.5;
    const moved = Math.hypot(bot.pos[0] - ai.lastPosX, bot.pos[2] - ai.lastPosZ);
    if (hasIntent && moved < 0.05) {
      if (ai.stuckSince === 0) ai.stuckSince = now;
    } else {
      ai.stuckSince = 0;
    }
    if (ai.stuckSince > 0 && now - ai.stuckSince > 1200) {
      // Recovery: pick a new random spawn point as the wander target.
      const list = bot.team === "red" ? room.map.spawns.red : bot.team === "blue" ? room.map.spawns.blue : room.map.spawns.ffa;
      ai.wanderTarget = list[Math.floor(Math.random() * list.length)];
      ai.targetId = null;        // wander instead of engaging
      ai.strafeDir = -ai.strafeDir;
      ai.stuckSince = 0;
      // Nudge sideways so the bot has a chance to unstick from the corner.
      bot.pos[0] += (Math.random() - 0.5) * 0.6;
      bot.pos[2] += (Math.random() - 0.5) * 0.6;
      // Re-run the cover push-out so the nudge doesn't embed the bot in a wall.
      bot.pos = collideBots(room, bot.pos, bot.pos[1]);
    }
  }
  // Record this tick's position for next tick's stuck measurement.
  ai.lastPosX = bot.pos[0];
  ai.lastPosZ = bot.pos[2];
}

function clampToArena(room: Room, pos: Vec3): Vec3 {
  const lim = room.map.size - 1;
  return [Math.max(-lim, Math.min(lim, pos[0])), Math.max(0, pos[1]), Math.max(-lim, Math.min(lim, pos[2]))];
}
function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
function dirFromYawPitch(yaw: number, pitch: number): Vec3 {
  const cp = Math.cos(pitch);
  return [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
}
function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function add(a: Vec3, b: Vec3): Vec3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function randSpread(s: number): Vec3 {
  return [(Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s];
}

// ---- Bot wall collision (ported from the offline engine) ----
// These helpers prevent bots from walking through walls/cover. Without them,
// online bots teleport through obstacles to reach their target. The logic
// mirrors fps-engine.ts `collideBots()` + `botMoveBlocked()`.

// Pre-movement probe: returns true if moving from `from` to `to` (XZ only)
// would put the bot inside any blocking cover box. Uses 3 samples (from, to,
// midpoint) so thin walls can't be tunneled.
function botMoveBlocked(room: Room, from: Vec3, to: Vec3, currentY: number): boolean {
  const r = PLAYER_RADIUS;
  for (const cov of room.map.cover) {
    // Skip accent (decorative) and stair (walkable ramp) boxes — they don't block.
    if (cov.kind === "accent" || cov.kind === "stair") continue;
    const cx = cov.pos[0], cz = cov.pos[2];
    const hx = cov.size[0], hz = cov.size[2];
    const minY = cov.pos[1] - cov.size[1], maxY = cov.pos[1] + cov.size[1];
    // If the bot can step onto this box (top within step reach), don't block.
    if (maxY - currentY < 1.3 && maxY > currentY) continue;
    // Skip if bot is above the box top (standing on it) or below the bottom.
    if (currentY >= maxY - 0.05) continue;
    if (currentY + PLAYER_HEIGHT < minY) continue;
    const samples: Vec3[] = [from, to, [(from[0] + to[0]) * 0.5, from[1], (from[2] + to[2]) * 0.5]];
    for (const s of samples) {
      if (Math.abs(s[0] - cx) < hx + r && Math.abs(s[2] - cz) < hz + r) return true;
    }
  }
  return false;
}

// Iterative push-out: resolves overlap with blocking cover boxes by pushing
// the bot out along the least-overlapping axis. 6 passes handle corners +
// adjacent walls + dense cover clusters (Task 16-a — bumped from 3 to 6 in
// preparation for the density increase in Task 16-b which creates clusters of
// adjacent boxes where 3 passes could leave residual overlap).
//
// TUNNELING DEFENSE-IN-DEPTH: if a bot tunneled THROUGH a thin wall during a
// fast frame (despite the tightened SUBSTEP=0.15 + botMoveBlocked probe), the
// `Math.sign(out[0] - b.cx)` push-out could point to the WRONG side (the far
// side), embedding the bot past the box edge. As a safety net, clamp the
// result so the bot never ends up more than `b.hx + r + 0.1` from the box
// center on the pushed axis — bounds the worst case so a wrong sign can't
// fling the bot deep into another wall. The primary tunneling defence is the
// substep + botMoveBlocked (which we've tightened); this clamp is just
// insurance for the rare edge case where multiple boxes interact.
function collideBots(room: Room, pos: Vec3, currentY: number): Vec3 {
  const r = PLAYER_RADIUS;
  const out: Vec3 = [pos[0], pos[1], pos[2]];
  const blocking: { cx: number; cz: number; hx: number; hz: number }[] = [];
  for (const cov of room.map.cover) {
    if (cov.kind === "accent" || cov.kind === "stair") continue;
    const cx = cov.pos[0], cz = cov.pos[2];
    const hx = cov.size[0], hz = cov.size[2];
    const minY = cov.pos[1] - cov.size[1], maxY = cov.pos[1] + cov.size[1];
    if (maxY - currentY < 1.3 && maxY > currentY) continue;
    if (currentY >= maxY - 0.05) continue;
    if (currentY + PLAYER_HEIGHT < minY) continue;
    blocking.push({ cx, cz, hx, hz });
  }
  for (let pass = 0; pass < 6; pass++) {
    let any = false;
    for (const b of blocking) {
      if (Math.abs(out[0] - b.cx) < b.hx + r && Math.abs(out[2] - b.cz) < b.hz + r) {
        const overlapX = b.hx + r - Math.abs(out[0] - b.cx);
        const overlapZ = b.hz + r - Math.abs(out[2] - b.cz);
        if (overlapX < overlapZ) {
          out[0] = b.cx + Math.sign(out[0] - b.cx) * (b.hx + r);
          // Tunneling defense-in-depth: clamp so the bot never ends up more than
          // b.hx + r + 0.1 from the box center on the pushed axis. The push-out
          // above sets it to exactly b.hx + r (so this is a no-op normally), but
          // if a wrong sign (from tunneling through a thin wall) or a multi-box
          // interaction pushed it further, this clamp bounds the overshoot.
          const maxDistX = b.hx + r + 0.1;
          if (Math.abs(out[0] - b.cx) > maxDistX) out[0] = b.cx + Math.sign(out[0] - b.cx) * maxDistX;
        } else {
          out[2] = b.cz + Math.sign(out[2] - b.cz) * (b.hz + r);
          const maxDistZ = b.hz + r + 0.1;
          if (Math.abs(out[2] - b.cz) > maxDistZ) out[2] = b.cz + Math.sign(out[2] - b.cz) * maxDistZ;
        }
        any = true;
      }
    }
    if (!any) break;
  }
  return out;
}

// Soft bot-vs-bot (and bot-vs-player) separation. After the cover push-out,
// nudge the bot away from any other combatant that's too close on the XZ plane.
// Uses a gentle lerp (* 0.5) so the push is soft — over successive frames, two
// stacked bots move apart smoothly instead of snapping. This prevents doorway
// jams and the ugly "two bots occupying the same point" stack.
//
// "Other combatants" = all other `room.bots` PLUS all `room.players` (alive).
// Dead combatants and combatants on a different Y level (different floor —
// `|dY| > PLAYER_HEIGHT * 0.8`) are skipped. Players are pushed ONLY on the
// bot's side — we don't mutate the player's pos (the player's own client-side
// collision handles their side; the server echoes the player's authoritative
// pos in snapshots).
function separateBots(room: Room, bot: PlayerNet & { ai: BotAI }, currentY: number): void {
  const minDist = 2 * PLAYER_RADIUS + 0.2;
  const minDistSq = minDist * minDist;
  const yTol = PLAYER_HEIGHT * 0.8;
  const others: { pos: Vec3; alive: boolean }[] = [];
  for (const b of room.bots.values()) {
    if (b.id === bot.id) continue;
    others.push({ pos: b.pos, alive: b.alive });
  }
  for (const p of room.players.values()) {
    others.push({ pos: p.pos, alive: p.alive });
  }
  for (const o of others) {
    if (!o.alive) continue;
    if (Math.abs(o.pos[1] - currentY) > yTol) continue;
    const ddx = bot.pos[0] - o.pos[0];
    const ddz = bot.pos[2] - o.pos[2];
    const dsq = ddx * ddx + ddz * ddz;
    if (dsq >= minDistSq || dsq < 1e-6) continue;
    const dist = Math.sqrt(dsq);
    const overlap = minDist - dist;
    // Push the BOT away by half the overlap (the other side handles its own
    // half — symmetric separation over successive frames). Soft lerp (0.5)
    // so it's a gentle nudge, not a snap.
    const push = overlap * 0.5 * 0.5;
    bot.pos[0] += (ddx / dist) * push;
    bot.pos[2] += (ddz / dist) * push;
  }
}

// Line-of-sight check: returns true if there is a clear line of sight from
// `from` to `to` (no blocking cover boxes in between). Used by the bot AI to
// make bots require LoS before acquiring a target (instead of being omniscient).
function hasLineOfSight(room: Room, from: Vec3, to: Vec3): boolean {
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.01) return true;
  const dir: Vec3 = [dx / len, dy / len, dz / len];
  for (const cov of room.map.cover) {
    if (cov.kind === "accent" || cov.kind === "stair") continue;
    const t = rayBox(from, dir, cov.pos, cov.size);
    if (t !== null && t < len) return false;
  }
  return true;
}

// ---- Connection handling ----------------------------------------------------
io.on("connection", (socket) => {
  console.log(`[VANGUARD] socket connected: ${socket.id}`);
  socket.on("message", (msg: C2S) => {
    try {
      handle(socket, msg);
    } catch (e) {
      console.error("msg error", e);
    }
  });
  socket.on("disconnect", () => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (room) {
      room.players.delete(socket.id);
      room.sockets.delete(socket.id);
      room.scores.delete(socket.id);
      room.loadouts.delete(socket.id);
      socket.leave(roomId);
      // If host leaves, transfer host to the next human (if any).
      if (room.hostSocketId === socket.id && room.players.size > 0) {
        const next = room.players.values().next().value;
        if (next) { room.hostSocketId = next.id; room.hostName = next.name; }
      }
      if (room.state === "lobby") {
        // In lobby: refresh the player list for the remaining players. If the
        // room is now empty, clean it up. No bot top-up in lobby (bots haven't
        // spawned yet).
        if (room.players.size === 0) {
          endMatch(room);
        } else {
          broadcastLobbySnapshot(room);
        }
      } else if (room.state === "playing") {
        // Bot-filled rooms: top the bots back up so the match stays populated.
        if (room.fillWithBots && !room.ended && room.mode !== "survival") {
          spawnBots(room);
        }
        if (room.players.size === 0 && !room.ended) {
          // end room when empty
          endMatch(room);
        }
      }
    }
    socketToRoom.delete(socket.id);
  });
});

function handle(socket: any, msg: C2S) {
  switch (msg.t) {
    case "joinMatch": {
      console.log(`[VANGUARD] joinMatch from ${socket.id}: mode=${msg.mode} bots=${msg.botCount} name=${msg.name} map=${msg.mapId ?? "compound"}`);
      const mapId: MapId = (msg.mapId ?? "compound") as MapId;
      let room = findOpenRoom(msg.mode, mapId);
      if (!room) room = createRoom(msg.mode, Math.min(7, Math.max(1, msg.botCount)), mapId);
      socketToRoom.set(socket.id, room.id);
      socket.join(room.id);
      const team = assignTeam(room.mode, room) as any;
      const sp = pickSpawn(team, room);
      // In gungame, joining players start on the first progression weapon.
      const joinWeaponId = room.mode === "gungame" ? (room.gungameWeapons[0] ?? "pistol_side") : msg.loadout.weaponId;
      const p: PlayerNet = {
        id: socket.id, name: msg.name?.slice(0, 20) || "Recruit", team, isBot: false,
        pos: sp, yaw: 0, pitch: 0, health: MAX_HEALTH, alive: true,
        weaponId: joinWeaponId, weaponSkinId: msg.loadout.weaponSkinId, playerSkinId: msg.loadout.playerSkinId,
        kills: 0, deaths: 0, lastShotAt: 0,
        spawnProtectedUntil: Date.now() + 3000,
      };
      room.players.set(socket.id, p);
      room.sockets.set(socket.id, socket.id);
      room.scores.set(socket.id, 0);
      room.loadouts.set(socket.id, msg.loadout);
      if (room.mode === "gungame") room.gungameProgress.set(socket.id, 0);
      // ensure bots count matches (in case room was reused)
      spawnBots(room);
      const joined: S2C = {
        t: "joined", matchId: room.id, selfId: socket.id, mode: room.mode, team,
        config: room.config, mapId: room.map.id, players: [...room.players.values(), ...room.bots.values()].map(toSnap),
      };
      socket.emit("message", joined);
      socket.emit("message", snapshot(room));
      break;
    }
    case "leaveMatch": {
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (room) {
        room.players.delete(socket.id);
        room.scores.delete(socket.id);
        socket.leave(roomId);
        if (room.players.size === 0 && !room.ended) endMatch(room);
      }
      socketToRoom.delete(socket.id);
      break;
    }
    case "state": {
      const room = rooms.get(socketToRoom.get(socket.id) ?? "");
      if (!room) return;
      // Ignore movement updates while the room is in lobby state (no match running).
      if (room.state !== "playing") return;
      const p = room.players.get(socket.id);
      if (!p || !p.alive) return;
      p.pos = clampToArena(room, msg.pos);
      p.yaw = msg.yaw;
      p.pitch = msg.pitch;
      break;
    }
    case "shot": {
      const room = rooms.get(socketToRoom.get(socket.id) ?? "");
      if (!room) return;
      // No shooting in lobby state.
      if (room.state !== "playing") return;
      // No shooting during the pre-match countdown (bots are frozen, but
      // humans shouldn't be able to shoot either — prevents pre-countdown kills).
      if (room.preMatchCountdown > 0) return;
      const p = room.players.get(socket.id);
      if (!p || !p.alive) return;
      const weapon = weaponById(msg.weaponId);
      if (weapon.id !== p.weaponId) return;
      const now = Date.now();
      const minGap = 1000 / Math.max(1, weapon.stats.fireRate) * 0.8;
      if (now - p.lastShotAt < minGap) return;
      p.lastShotAt = now;
      const loadout = room.loadouts.get(socket.id);
      // Pick the correct attachment map for the player's CURRENT slot — the
      // server validates shots against the same effective stats the client sees.
      // p.weaponId tells us which slot is active (primary / secondary / melee).
      let attsForShot: Record<string, string | null> | undefined = loadout?.attachments as Record<string, string | null> | undefined;
      if (loadout) {
        if (p.weaponId === loadout.secondaryWeaponId && loadout.secondaryAttachments) {
          attsForShot = loadout.secondaryAttachments as Record<string, string | null>;
        } else if (p.weaponId === loadout.meleeWeaponId && loadout.meleeAttachments) {
          attsForShot = loadout.meleeAttachments as Record<string, string | null>;
        }
      }
      const eff = loadout && attsForShot ? computeEffectiveStats(weapon, attsForShot as Record<AttachmentSlot, string | null>) : weapon.stats;
      // Rocket launcher: SPLASH damage (AoE). Instead of a single hitscan ray,
      // compute the impact point (first cover or combatant hit along the ray)
      // and apply area-of-effect damage to all enemies within the splash radius.
      // Damage uses a quadratic falloff (full at center, ~10% at edge) + a direct-hit
      // bonus (within 1.5 units = full damage + 20% bonus).
      if (msg.weaponId === "launcher_rocket") {
        // Normalize the direction vector so the raycast math is stable.
        const dlen = Math.hypot(msg.dir[0], msg.dir[1], msg.dir[2]) || 1;
        const dir: Vec3 = [msg.dir[0] / dlen, msg.dir[1] / dlen, msg.dir[2] / dlen];
        // Compute the impact point: nearest cover box OR combatant along the ray.
        let impactT = eff.range;
        for (const cov of room.map.cover) {
          const t = rayBox(msg.origin, dir, cov.pos, cov.size);
          if (t !== null && t < impactT) impactT = t;
        }
        for (const e of allCombatants(room)) {
          if (e.id === socket.id || !e.alive) continue;
          if (room.config.friendlyFire === false && e.team === p.team && room.mode !== "ffa" && room.mode !== "gungame") continue;
          const center: Vec3 = [e.pos[0], e.pos[1] + PLAYER_HEIGHT / 2, e.pos[2]];
          const hit = rayCapsule(msg.origin, dir, center, PLAYER_RADIUS, PLAYER_HEIGHT);
          if (hit && hit.t >= 0 && hit.t < impactT) impactT = hit.t;
        }
        const impact: Vec3 = [msg.origin[0] + dir[0] * impactT, msg.origin[1] + dir[1] * impactT, msg.origin[2] + dir[2] * impactT];
        const splashRadius = 8;
        // CRITICAL FIX: splash damage is computed against the rocket's FULL
        // TRAJECTORY LINE SEGMENT (origin → impact), NOT just the impact point.
        // A near-miss (rocket flies past an enemy and hits a far wall) still
        // deals splash damage based on the closest approach distance. Previously
        // only enemies within splashRadius of the IMPACT point took damage, so a
        // rocket that narrowly missed an enemy but hit a wall behind them dealt
        // ZERO damage. Now we project each enemy onto the trajectory segment and
        // use the closest-point distance — near-misses deal partial damage.
        const segDx = impact[0] - msg.origin[0];
        const segDy = impact[1] - msg.origin[1];
        const segDz = impact[2] - msg.origin[2];
        const segLenSq = segDx * segDx + segDy * segDy + segDz * segDz || 1e-9;
        for (const e of allCombatants(room)) {
          if (e.id === socket.id || !e.alive) continue;
          if (room.config.friendlyFire === false && e.team === p.team && room.mode !== "ffa" && room.mode !== "gungame") continue;
          const cx = e.pos[0], cy = e.pos[1] + PLAYER_HEIGHT / 2, cz = e.pos[2];
          // Project the combatant's center onto the trajectory segment.
          const apx = cx - msg.origin[0], apy = cy - msg.origin[1], apz = cz - msg.origin[2];
          let tt = (apx * segDx + apy * segDy + apz * segDz) / segLenSq;
          tt = Math.max(0, Math.min(1, tt));
          const closestX = msg.origin[0] + segDx * tt;
          const closestY = msg.origin[1] + segDy * tt;
          const closestZ = msg.origin[2] + segDz * tt;
          const dx = cx - closestX, dy = cy - closestY, dz = cz - closestZ;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d <= splashRadius) {
            // Quadratic falloff + direct-hit bonus (matches the offline engine).
            const norm = d / splashRadius;
            const falloff = d <= 1.5 ? 1.2 : (1 - norm * norm) * 0.9 + 0.1;
            const splashDmg = eff.damage * falloff;
            applyDamage(room, socket.id, e, splashDmg, false, msg.weaponId);
          }
        }
      } else {
        const pellets = weapon.stats.pellets ?? 1;
        for (let i = 0; i < pellets; i++) {
          const dir = pellets > 1 ? normalize(add(msg.dir, randSpread(eff.spread))) : msg.dir;
          const hit = fireRay(room, socket.id, msg.origin, dir, msg.weaponId, eff.range);
          if (hit) {
            const baseDmg = eff.damage * (hit.head ? weapon.stats.headshotMult : 1);
            const dmg = damageAtRange(baseDmg, hit.t, eff.range);
            applyDamage(room, socket.id, hit.victim, dmg, hit.head, msg.weaponId);
          }
        }
      }
      io.to(room.id).emit("message", { t: "shotFx", origin: msg.origin, dir: msg.dir, weaponId: msg.weaponId, attackerId: socket.id, skinId: msg.skinId, suppressed: attsForShot?.barrel === "barrel_suppressor" } as S2C);
      break;
    }
    case "reload": {
      const room = rooms.get(socketToRoom.get(socket.id) ?? "");
      if (!room) return;
      if (room.state !== "playing") return;
      io.to(room.id).emit("message", { t: "reloadFx", playerId: socket.id } as S2C);
      break;
    }
    case "weaponSwap": {
      // Player switched weapon slots (1=primary, 2=secondary, 3=melee).
      // Update their equipped weaponId so the server validates shots against
      // the new weapon's stats. Other players see the swap via the snapshot.
      const room = rooms.get(socketToRoom.get(socket.id) ?? "");
      if (!room) return;
      if (room.state !== "playing") return;
      // Gun Game ignores manual swaps — weapon is driven by progression.
      if (room.mode === "gungame") return;
      const p = room.players.get(socket.id);
      if (!p || !p.alive) return;
      const loadout = room.loadouts.get(socket.id);
      if (!loadout) return;
      let newWeaponId = p.weaponId;
      if (msg.slot === "primary") newWeaponId = loadout.weaponId;
      else if (msg.slot === "secondary") newWeaponId = loadout.secondaryWeaponId ?? "pistol_side";
      else if (msg.slot === "melee") newWeaponId = loadout.meleeWeaponId ?? "knife_tactical";
      // Validate the weapon exists.
      const w = weaponById(newWeaponId);
      if (!w) return;
      p.weaponId = newWeaponId;
      // No broadcast here — the next snapshot (20Hz) carries the new weaponId.
      break;
    }
    case "chat": {
      const room = rooms.get(socketToRoom.get(socket.id) ?? "");
      if (!room) return;
      const p = room.players.get(socket.id);
      if (!p) return;
      const text = (msg.text || "").slice(0, 120);
      io.to(room.id).emit("message", { t: "chat", name: p.name, text, team: p.team } as S2C);
      break;
    }
    // ---- Room lobby system ----
    case "listRooms": {
      const list: RoomSummary[] = [];
      for (const r of rooms.values()) {
        if (r.ended) continue;
        // Show both lobby and playing rooms in the browser. A room is "open" if
        // there's a human slot (or a bot to replace in a bot-filled room).
        const open = r.players.size < r.capacity || (r.fillWithBots && r.bots.size > 0);
        if (open) list.push(roomSummary(r));
      }
      // Most recently created first.
      list.sort((a, b) => b.createdAt - a.createdAt);
      socket.emit("message", { t: "roomList", rooms: list } as S2C);
      break;
    }
    case "createRoom": {
      const cfg = msg.config;
      console.log(`[VANGUARD] createRoom from ${socket.id}: mode=${cfg.mode} map=${cfg.mapId} teamSize=${cfg.teamSize} fillBots=${cfg.fillWithBots} diff=${cfg.botDifficulty} pw=${cfg.password ? "yes" : "no"}`);
      const room = createLobbyRoom(socket.id, msg.name, msg.loadout, cfg);
      socketToRoom.set(socket.id, room.id);
      socket.join(room.id);
      const host = room.players.get(socket.id)!;
      const joined: S2C = {
        t: "roomJoined", matchId: room.id, selfId: socket.id, mode: room.mode,
        team: host.team, config: room.config, mapId: room.map.id,
        players: lobbyPlayers(room), roomName: room.name,
        state: "lobby", isHost: true,
      };
      socket.emit("message", joined);
      // Send a lobby snapshot so the host's client can render the lobby overlay.
      socket.emit("message", { t: "lobbySnapshot", players: lobbyPlayers(room), hostSocketId: room.hostSocketId, state: "lobby" } as S2C);
      break;
    }
    case "joinRoom": {
      console.log(`[VANGUARD] joinRoom from ${socket.id}: roomId=${msg.roomId} name=${msg.name} team=${msg.team ?? "auto"}`);
      const { room, error } = joinLobbyRoom(socket.id, msg.name, msg.loadout, msg.roomId, msg.password ?? null, msg.team);
      if (!room || error) {
        socket.emit("message", { t: "roomError", message: error ?? "Could not join room." } as S2C);
        return;
      }
      socketToRoom.set(socket.id, room.id);
      socket.join(room.id);
      const me = room.players.get(socket.id)!;
      const joined: S2C = {
        t: "roomJoined", matchId: room.id, selfId: socket.id, mode: room.mode,
        team: me.team, config: room.config, mapId: room.map.id,
        players: lobbyPlayers(room), roomName: room.name,
        state: room.state === "playing" ? "playing" : "lobby",
        isHost: room.hostSocketId === socket.id,
      };
      socket.emit("message", joined);
      if (room.state === "lobby") {
        // Broadcast the updated player list to everyone in the lobby.
        broadcastLobbySnapshot(room);
      } else {
        // Match already in progress — send a live snapshot so the joiner sees
        // current positions/scores immediately, and tell others about the new
        // player so they render the joiner's avatar.
        socket.emit("message", snapshot(room));
        socket.to(room.id).emit("message", { t: "respawn", playerId: socket.id, pos: me.pos, health: me.health } as S2C);
      }
      break;
    }
    case "startMatch": {
      const room = rooms.get(socketToRoom.get(socket.id) ?? "");
      if (!room) return;
      const ok = startMatchInRoom(room, socket.id);
      if (!ok) {
        // Only the host can start, and only from the lobby state. Surface a
        // roomError so the client can react (e.g. disable the button).
        const reason = room.state !== "lobby"
          ? "Match has already started."
          : room.hostSocketId !== socket.id
          ? "Only the host can start the match."
          : "Could not start the match.";
        socket.emit("message", { t: "roomError", message: reason } as S2C);
      }
      break;
    }
    case "leaveRoom": {
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (room) {
        room.players.delete(socket.id);
        room.sockets.delete(socket.id);
        room.scores.delete(socket.id);
        room.loadouts.delete(socket.id);
        socket.leave(roomId);
        // Transfer host if the leaving player was the host.
        if (room.hostSocketId === socket.id && room.players.size > 0) {
          const next = room.players.values().next().value;
          if (next) { room.hostSocketId = next.id; room.hostName = next.name; }
        }
        if (room.state === "lobby") {
          if (room.players.size === 0) endMatch(room);
          else broadcastLobbySnapshot(room);
        } else if (room.state === "playing") {
          if (room.fillWithBots && !room.ended && room.mode !== "survival") spawnBots(room);
          if (room.players.size === 0 && !room.ended) endMatch(room);
        }
      }
      socketToRoom.delete(socket.id);
      break;
    }
  }
}

const globalAny = globalThis as unknown as { __vanguardGameServerStarted?: boolean };

export function startGameServer(port = 3003) {
  if (globalAny.__vanguardGameServerStarted) {
    console.log("[VANGUARD] Game server already started, skipping");
    return;
  }
  globalAny.__vanguardGameServerStarted = true;

  // Install global safety nets so that NO single unexpected async error can
  // take down the whole Next.js process. These MUST be inside this function
  // (which is only called at runtime, not during build) so the Edge Runtime
  // static analyzer never sees `process.on` and flags the build.
  try {
    process.on("uncaughtException", (err) => {
      console.error("[VANGUARD] Uncaught exception (suppressed to keep server alive):", err);
    });
    process.on("unhandledRejection", (reason) => {
      console.error("[VANGUARD] Unhandled rejection (suppressed to keep server alive):", reason);
    });
  } catch {
    // process.on may not be available in some environments — ignore.
  }

  // CRITICAL: Attach an error listener BEFORE calling listen().
  // Without this, an EADDRINUSE / EACCES error (e.g. on deployment platforms
  // that only permit a single bound port) becomes an uncaught exception that
  // crashes the entire Next.js process — which manifests as "deployment failed"
  // on the publish step even though `next build` succeeds. The game server is
  // an OPTIONAL enhancement; the web UI (menu, armory, profile, offline play)
  // must remain functional without it.
  httpServer.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE" || err.code === "EACCES") {
      console.warn(
        `[VANGUARD] Game server could not bind port ${port} (${err.code}). ` +
        `Multiplayer/online features will be unavailable, but the web UI ` +
        `and offline play continue to work.`
      );
    } else {
      console.error(`[VANGUARD] Game server error:`, err);
    }
    // Do NOT re-throw — swallowing here keeps the Next.js process alive.
  });

  httpServer.listen(port, () => {
    console.log(`[VANGUARD] Game server listening on port ${port} (path /)`);
  });
  process.on("SIGTERM", () => httpServer.close(() => process.exit(0)));
  process.on("SIGINT", () => httpServer.close(() => process.exit(0)));
}
