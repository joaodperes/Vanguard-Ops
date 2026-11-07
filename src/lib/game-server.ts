import {reactorObjective,objectiveDistance} from "./map-objectives";
import {chooseSpawn} from "./spawn-selection";
import {botOperativeSkinId, BOT_OPERATIVE_SKINS, SURVIVAL_BOSS_SKIN_ID, bossShockwaveCharge} from "./bot-appearances";
import {applyLinkedWallDamage,floodgateDamageTarget,FLOODGATE_CORE_ID,floodgateWaterEffect,floodgateRouteNeedsDetour,whiteoutVisibility} from "./map-battle-events";
import {setFloodgateFreightStage,floodgatePathHazards} from "./floodgate-topple";
import { clusterShots, clusterDamage, clusterLifetime, CLUSTER_ID, CLUSTER_MAX_DAMAGE, type ClusterVolley } from "./cluster-grenades";
import { RIOT_SHIELD_ID, RIOT_SHIELD_HP, RIOT_SHIELD_RECHARGE_MS, rayRiotShield, damageRiotShield, shieldBlocksFire, hitRiotShield, tickRiotShield, accelerateRiotShield, riotBashProfile, RIOT_BASH_KNOCKBACK } from "./riot-shield";
import { usesWonderCharges } from "./game-data";
import { resolveMatchLoadout } from "./match-loadout";
import { cosmeticShopOwnership } from "./cosmetics";
import { db } from "./db";
import {ORBITAL_REAPER_ID,orbitalRecordKill,orbitalCanClaim,orbitalGravity,orbitalBotShouldContest,orbitalBotDeckGoal,ORBITAL_RULES_VERSION,ORBITAL_PULSE_DAMAGE,ORBITAL_PULSE_RADIUS,orbitalPulseTargets,orbitalReaperEquipped,ORBITAL_REAPER_SPEED_MULTIPLIER} from "./orbital-reactor";
import { advanceMatchElapsed } from "./match-clock";
import { drainedWonderCharges, spendWonderCharge, spendHellfireFuelOnShot, accelerateWonderCharge, type WonderChargeState } from "./wonder-charge";
import { selectSmartTarget, selectSmartTargets, SMART_MAX_TAGS, SMART_TAG_MS, HELLFIRE_FUEL_STEP_MS, inFlameCone, sludgeMovementFactor } from "./wonder-tech";
import { corrosionImpactDamage, corrosionTickDamage, corrosionImpactDistance, CORROSION_DURATION_MS, CORROSION_TICK_MS } from "./corrosion-damage";
import { stormPelletDirections, traceStormPellet, stormMinePosition, stormMineInReach, stormEnemy, stormTargetPoint, nextStormChainTarget, STORM_MINE_ARM_MS, STORM_MINE_LIFETIME_MS, STORM_MINE_TARGET_COOLDOWN_MS, STORM_MAX_MINES_PER_OWNER, STORM_MAX_DIRECT_HITS_PER_TARGET, STORM_DIRECT_DAMAGE, STORM_MINE_DAMAGE, STORM_CHAIN_JUMPS, STORM_MINE_JUMPS, STORM_CHAIN_DECAY, STORM_MINE_CHAIN_RADIUS, type StormVictim } from "./stormweaver";
// ============================================================================
// VANGUARD OPS — Game Server (socket.io) on port 3003
// Authoritative match host: player sync, server-side hit detection, bot AI,
// FFA & TDM scoring, respawns, match end. Path is "/" (Caddy gateway rule).
// Started inside the Next.js process via src/instrumentation.ts so it stays
// alive as long as the dev server (the sandbox reaps detached processes).
// ============================================================================
import { canHearGunshot, friendlyOnRadar, radarExpiresAt, radarDurationMs } from "./radar";
import { equipmentById } from "./equipment";
import { botTacticalForArchetype, botTacticalCanUse, planBotTacticalThrow } from "./bot-tactical";
import { tacticalGrenadePath } from "./tactical-grenades";
import type { TimedProjectilePath } from "./bouncing-projectile";
import { shouldCreateScavengerDrop, canCollectScavengerDrop } from "./scavenger-pickups";
import { chooseQuickMeleeTarget, quickMeleeProfile } from "./quick-melee";
import { THROWING_KNIVES_ID, THROWING_KNIFE_RANGE, fullThrowingKnives, isThrowingKnife, spendThrowingKnife, tickThrowingKnives, throwingKnifeRemainingMs, type ThrowingKnifeCharges } from "./throwing-knives";
import { rayCombatantHit } from "./combat-hitboxes";
import { type BodyRayContact } from "./body-penetration";
import { selectMaterialPenetrationHits } from "./cover-penetration";
import { damageBallisticCoverOnShot } from "./material-cover-damage";
import { launcherSplashFactor } from "./launcher-effects";
import { automaticBloom, autoSpreadRadians } from "./automatic-spread";
import { botCombatDecision, botPatrolSprint, botShotSpread } from "./bot-combat-posture";
import { shotgunPelletDirection } from "./shotgun-pattern";
import { botRememberSighting, botInvestigation, botCanHearNoise, botRememberNoise, botRememberHit, botAlertInvestigation, type BotNoise, type BotAlert, type BotSighting } from "./bot-awareness";
import { botArchetypeForSlot, botArchetypeForCategory, botArchetypeWeapon, botArchetypeWeapons, BOT_ELIGIBLE_WEAPONS, botPersonality, botArchetypeHighGroundChance, type BotArchetype } from "./bot-archetypes";
import { botTactics, botDetectionRange, botWantsCombatJump, botCornerScan } from "./bot-difficulty";
import { botHasJumpClearance } from "./bot-physics";
import { botMoveMultiplier, botTurnLerp, botDecisionDelay, botReactionDelay, botAimDriftMultiplier } from "./bot-difficulty";
import { survivalEnemyCount, regenDelayMs, SCAVENGER_DROP_LIFETIME_MS, SCAVENGER_PICKUP_RADIUS, SCAVENGER_PICKUP_ARM_MS } from "./perks";
import { EXPLO_FUSE_MS, explonandoDamage, explonandoCanHit } from "./explonando";
import { calculateThrowPath } from "./throw-trajectory";
import { buildGunGameWeapons, normalizeGunGameConfig, canCompleteGunGame } from "./gun-game";
import { canStartWeaponReload } from "./weapon-mechanics";
import { chooseBotPatrolPoint, botPatrolDistance } from "./bot-patrol";
import { botNextWaypoint, botHighGroundWaypoint, botEntersHazard, botMapRouteGoal } from "./bot-routing";
import {CoverSpatialIndex} from "./cover-spatial-index";
import {cityHighGroundGoals,chooseCityHighGroundGoal,cityHighGroundStep,type HighGroundGoal} from "./city-high-ground";
import { turretCanTrack, turretCanAttack, turretDeployPosition, TURRET_DAMAGE, TURRET_INTERVAL_MS, TURRET_LIFETIME_MS, TURRET_MUZZLE_HEIGHT, TURRET_HP } from "./turret-rules";
import { MOVEMENT } from "./movement-rules";
import { createCtfFlags, ctfDrop, ctfTouch, ctfReturnExpired, ctfBotIntent, ctfStairWaypoint, ctfDefenderScanYaw, ctfEngageThreat, ctfResetMs, ctfBase, ctfHome, flagAtHome, otherFlag, CTF_SPEED_MULTIPLIER, ctfCarrierWeaponSpeed, type CtfFlags, type FlagTeam } from "./ctf-rules";
import { gravityTravelMs, gravityPullOffset, gravityBlastDamage, gravityImpact, gravityTargetDistance, GRAVITY_WELL_DURATION_MS } from "./gravity-well";
import { countEligibleAssists, type Contribution } from "./combat-assists";
import { isFlagDefenseKill } from "./match-bonus-tracking";
import { createServer, type Server as HttpServer } from "http";
import { getSurvivalProgress, getOrCreatePlayer } from "./player-service";
import { normalizeSurvivalTier, survivalUnlocked, survivalWaveMutators, survivalWavesCleared, survivalBotDifficulty } from "./survival";
import { chooseSurvivalUpgrade, generateSurvivalUpgradeChoices, survivalUpgradeDue, survivalIncomingMultiplier, survivalOutgoingMultiplier, survivalKillReward, survivalWaveHealing, survivalRegenDelayMultiplier, survivalRegenRateMultiplier, survivalReloadMultiplier, SURVIVAL_UPGRADE_PREP_SEC, type SurvivalUpgradeOffer, type SurvivalUpgradeRanks, type SurvivalUpgradeId } from "./survival-upgrades";
import { coolHeat, addHeat, freshHeat, nextArcTarget, burstShotIntervalMs, type HeatState, type ArcCandidate } from "./weapon-mechanics";
import { Server } from "socket.io";
import type {
  C2S, S2C, PlayerNet, GameMode, MatchConfig, SnapshotPlayer, KillFeedEntry,
  LoadoutWire, Vec3, MapId, MapDef, RoomSummary, CreateRoomConfig, TeamSize,
  BotDifficulty, KillDifficulty, KillConfirmedTag,
} from "./game-protocol";
import {
  getMap, rayBox, rayCapsule, PLAYER_RADIUS, PLAYER_HEIGHT, EYE_HEIGHT, MAX_HEALTH, RESPAWN_DELAY_MS, DEFAULT_CONFIG,
  SURVIVAL_PREP_SEC, SURVIVAL_RESPAWN_MS, survivalWaveBotCount, survivalWaveHealthMul, survivalWaveDamageMul,
  roomCapacity, mapAllowedForMode, teamSizeAllowed, teamSizesForMap, KC_PICKUP_RADIUS, killConfirmedPickupPoints, GUN_GAME_PROGRESSION, GUN_GAME_TYPE_PROGRESSION, GUN_GAME_TYPE_PROGRESSION_FALLBACK,
} from "./game-protocol";
import {
  weaponById, computeEffectiveStats, effectiveHeatConfig, damageAtRange, maxWeaponHitRange, projectileSplashRadius, WEAPONS, isPrimaryWeaponCategory, type AttachmentSlot, type WeaponStats,
} from "./game-data";
import {
  makeEnvironmentMap, moveEnvironmentCover, breakEnvironmentWall,
  environmentPosition, withinEnvironment, spikesActive, closestCoverHit, withinLava, lavaAt, LAVA_DEATH_SOURCE,
} from "./dynamic-environment";
import {
  botGroundHeight, botMoveBlocked as blocksBotMotion,
  resolveBotOverlap, botNextFeetY,
} from "./bot-physics";

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
  lastSighting?: BotSighting | null;
  lastAlert?: BotAlert | null;
  nextHearingAt?: number;
  lastNoiseStepAt?: number;
  investigationLookAt?: Vec3 | null;
  wanderTarget: Vec3;
  nextShotAt: number;
  nextDecisionAt: number;
  ammoInMag: number;
  reloadingUntil: number;
  strafeDir: number;
  moveSpeed: number;
  sprinting?: boolean;
  aiming?: boolean;
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
  archetype: BotArchetype;
  ctfGuarding?: boolean;
  idleLookYaw?: number;
  boss?: {phase:number;nextPhaseAt:number;nextSkillAt:number};
  // ---- Stuck detection / recovery (mirrors the offline engine) ----
  // Tracks when the bot started being stuck (ms timestamp). 0 = not stuck.
  // Each tick we measure how far the bot moved since lastPosX/lastPosZ; if it
  // barely moved (< 0.05 units) despite having a movement intent, we mark it
  // stuck. If still stuck after 1.2s, force a recovery (new wander target +
  // sideways nudge) so bots never jam forever against a wall/corner.
  stuckSince: number;
  nextRouteAt?: number;
  routeWaypoint?: Vec3 | null;
  wantsHighGround?:boolean;
  highGroundPatrol?:HighGroundGoal|null;
  highGroundExpiresAt?:number;
  lastPosX: number;
  lastPosZ: number;
  nextCombatJumpAt?:number;
  cornerUntil?:number;
  nextCornerAt?:number;
  envJumpVelocityY?: number;
  envLaunchX?: number;
  envLaunchZ?: number;
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
  pendingLoadouts: Map<string, LoadoutWire>; // applied only on the next respawn/recovery
  playerKeys: Map<string, string>; // stable key from authenticated join request
  assists: Map<string, number>;        // playerId -> successful team assists
  damageContributions: Map<string, Map<string, Contribution>>; // victimId -> allies recently damaging victim
  scores: Map<string, number>;         // playerId -> kills
  teamScores: { red: number; blue: number };
  flags: CtfFlags;
  overtime: boolean;
  orbitalCharge:number;
  orbitalHolders:Set<string>;
  tags: Map<string, KillConfirmedTag>; // Kill Confirmed, one collectible per enemy death
  tagConfirmations: Map<string, number>; // individual enemy tag pickups
  tagDenials: Map<string, number>;       // individual friendly tag pickups
  startTime: number;
  timeLeft: number;
  elapsedSeconds?: number;
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
  downed: Set<string>;
  survivalRanks: Map<string, SurvivalUpgradeRanks>;
  survivalOffers: Map<string, SurvivalUpgradeOffer>;
  survivalRerolls: Map<string, number>;
  survivalLastKillAt: Map<string, number>;
  survivalLastHeadshotKillAt: Map<string, number>;
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
  gungamePreset: "all" | "cqc" | "long_range";
  gungameMultiplier: number;
  sprintState: Map<string, boolean>;
  // ---- Pre-match countdown (server-side) ----
  // When > 0, the match is in a "get ready" phase. Bots are frozen (no AI, no
  // shooting). Human players can still move and look around. The countdown
  // ticks down in the tickRoom loop; when it hits 0, normal gameplay resumes.
  preMatchCountdown: number;
  environmentTime: number;             // seconds since the fight became active
  floodgateBreachAt: number|null;      // authoritative environment clock at dam failure
  environmentWalls: Map<string, number>;
  /** Per-room cover state; never mutate shared compiled map geometry. */
  materialCoverHp: Map<string, number>;
  materialCoverDestroyed: Set<string>;
  environmentCooldown: Map<string, number>;
  specialHeat: Map<string, HeatState & { updatedAt: number; ventUntil: number }>;
  wonderCharges: Map<string, WonderChargeState>;
  clusterVolleys: Map<string, ClusterVolley & { done: Set<number>; dealt: Map<string,number> }>;
  adsStartedAt: Map<string, number>;
  lastMotionAt: Map<string, number>;
  /** Persistent energy mines created only by missed Stormweaver pellets. */
  stormMines: Map<string, {id:string; ownerId:string; ownerTeam:string; pos:Vec3; armedAt:number; expiresAt:number}>;
  stormMineCooldown: Map<string, number>;
  smartTags: Map<string, { id:string; expiresAt:number }[]>;
  hellfireUntil: Map<string, number>;
  wonderFields: Map<string, { id: string; ownerId: string; ownerTeam: string; weaponId: string; kind: "flame" | "sludge"; pos: Vec3; radius: number; expiresAt: number; tickAt: number }>;
  deathBombs: Map<string, { ownerId: string; ownerTeam: string; pos: Vec3; explodesAt: number }>;
  turrets: Map<string, { ownerId: string; ownerTeam: string; pos: Vec3; yaw: number; expiresAt: number; nextShotAt: number; hp: number }>;
  gravityWells: Map<string, { ownerId: string; ownerTeam: string; weaponId: string; pos: Vec3; radius: number; damage: number; activatesAt: number; expiresAt: number }>;
  boltReadyAt: Map<string, number>;
  boltCharges: Map<string, number>;
  droppedBolts: Map<string, { id: string; ownerId: string; pos: Vec3; expiresAt: number }>;
  poison: Map<string, { attackerId: string; weaponId: string; expiresAt: number; tickAt: number; damagePerTick?: number }>;
  burning: Map<string, number>; // transient flame-hit visual only; no fire DoT
  equipmentCharges: Map<string, number>;
  equipmentLastAt: Map<string, number>;
  equipmentBotNextAt: Map<string, number>;
  equipmentMines: Map<string, { pos: Vec3; ownerId: string; expiresAt: number }>;
  equipmentStun: Map<string, number>;
  quickMeleeAt: Map<string, number>;
  throwingKnives: Map<string, ThrowingKnifeCharges>;
  /** Track accepted reload attempts for combat effects. */
  reloadingPlayers: Map<string, number>;
  autoBloom: Map<string, { weaponId:string; value:number; at:number }>;
  lastDamagedAt: Map<string, number>;
  scavengerDrops: Map<string, { id: string; pos: Vec3; expiresAt: number; ownerTeam: string; ownerId: string }>;

  // Per-player allowance for fast intra-burst shots; never accept unlimited
  // packets at burst cadence or a remote player could bypass fire-rate limits.
  burstState: Map<string, { weaponId: string; shotsRemaining: number; nextAt: number; until: number }>;
}

const rooms = new Map<string, Room>();
const socketToRoom = new Map<string, string>();
const botNoiseByRoom = new WeakMap<Room, BotNoise[]>();
const playerStepByRoom = new WeakMap<Room, Map<string, number>>();
function publishBotNoise(room:Room, noise:BotNoise):void {
  let events=botNoiseByRoom.get(room);
  if(!events){events=[];botNoiseByRoom.set(room,events);}
  events.push({...noise,pos:[...noise.pos] as Vec3});
  if(events.length>64)events.splice(0,events.length-64);
}
function hearBotNoise(room:Room,bot:PlayerNet & {ai:BotAI},now:number):void {
  const ai=bot.ai;
  if(now<(ai.nextHearingAt??0))return;
  ai.nextHearingAt=now+180;
  const events=botNoiseByRoom.get(room)??[];
  for(let i=events.length-1;i>=0;i--){
    const noise=events[i];
    if(noise.at<=(ai.lastAlert?.at??0) || now-noise.at>1500)break;
    if(noise.sourceId===bot.id)continue;
    const source=room.players.get(noise.sourceId)??room.bots.get(noise.sourceId);
    if(!source?.alive || (room.mode!=="ffa"&&room.mode!=="gungame"&&source.team===bot.team))continue;
    if(Math.hypot(noise.pos[0]-bot.pos[0],noise.pos[2]-bot.pos[2])>105)continue;
    const occluded=!hasLineOfSight(room,
      [bot.pos[0],bot.pos[1]+PLAYER_HEIGHT/2,bot.pos[2]],
      [noise.pos[0],noise.pos[1]+PLAYER_HEIGHT/2,noise.pos[2]]);
    if(!botCanHearNoise(bot.pos,noise,now,ai.difficulty,occluded))continue;
    ai.lastAlert=botRememberNoise(noise);
    ai.nextDecisionAt=0;
    break;
  }
}

function genId(prefix: string) {
  return prefix + "_" + Math.random().toString(36).slice(2, 8);
}

// ---- Gun Game: resolve the per-match weapon list ----
// For each TYPE in GUN_GAME_TYPE_PROGRESSION, pick a random weapon of that
// category from the catalog. This way the progression STRUCTURE is fixed
// (pistol → smg → shotgun → ... → melee) but the SPECIFIC weapons vary per
// match. Only ONE melee slot exists (the last tier — a kill with it wins).
// We also avoid repeating the same weapon within a match where possible.
function resolveGungameWeapons(preset?: string, multiplier?: number): string[] {
  return buildGunGameWeapons(preset, multiplier);
}

function pickSpawn(team: string, room: Room): Vec3 {
  return chooseSpawn(room,room.map,team,[...room.players.values(),...room.bots.values()].filter(p=>p.alive));
}

function assignTeam(mode: GameMode, room: Room, requested?: "red" | "blue" | "auto"): string {
  if (mode === "ffa" || mode === "gungame") return "ffa";
  if (mode === "survival") return "blue"; // all humans on the same side
  const occupants=[...room.players.values(),...room.bots.values()];
  // A full bot-filled room assigns joining humans by HUMAN counts, otherwise
  // equal total teams repeatedly replace red bots until red has no bot left.
  const replacingBot=room.fillWithBots && occupants.length>=room.capacity;
  // Honor an explicit side when there is an open or replaceable bot slot.
  if (requested === "red" || requested === "blue") {
    if (!teamIsFull(room, requested) || (replacingBot && [...room.bots.values()].some(b=>b.team===requested))) return requested;
    // requested team is full — fall through to auto-balance
  }
  const balance=replacingBot?[...room.players.values()]:occupants;
  const red = balance.filter((p) => p.team === "red").length;
  const blue = balance.filter((p) => p.team === "blue").length;
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

function botLoadout(archetype?: BotArchetype, variant=0): LoadoutWire {
  const pool = BOT_ELIGIBLE_WEAPONS;
  const wid = archetype ? botArchetypeWeapon(archetype,variant) : pool[Math.floor(Math.random() * pool.length)].id;
  return {
    weaponId: wid,
    equipmentId: botTacticalForArchetype(archetype ?? "rifleman", variant),
    weaponSkinId: "default",
    playerSkinId: botOperativeSkinId(Math.floor(Math.random()*BOT_OPERATIVE_SKINS.length)),
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
  const skinRotation = Math.floor(Math.random()*BOT_OPERATIVE_SKINS.length);
  while (room.bots.size < target) {
    const id = genId("bot");
    const team = assignTeam(room.mode, room);
    const sp = pickSpawn(team, room);
    const teamSlot = [...room.bots.values()].filter(b => b.team === team).length;
    const archetype = botArchetypeForSlot(teamSlot);
    const loadout = botLoadout(archetype,Math.floor(Math.random()*botArchetypeWeapons(archetype).length));
    loadout.playerSkinId = botOperativeSkinId(room.bots.size, skinRotation);
    const difficulty = resolveBotDifficulty(room);
    const ai = makeBotAI(sp, loadout.weaponId, difficulty, 0, archetype);
    // In gungame, every combatant (including bots) starts on the first
    // progression weapon and advances on each kill. Their loadout's
    // weaponId is overridden to the first tier of the per-match weapon list.
    const gungameWeaponId = room.mode === "gungame" ? (room.gungameWeapons[0] ?? GUN_GAME_TYPE_PROGRESSION_FALLBACK[0]) : loadout.weaponId;
    ai.ammoInMag = weaponById(gungameWeaponId).stats.magSize;
    const bot: PlayerNet & { ai: BotAI; loadout: LoadoutWire } = {
      id, name: "Bot-" + id.slice(4, 8).toUpperCase(), team: team as any, isBot: true,
      pos: sp, yaw: 0, pitch: 0, health: MAX_HEALTH, alive: true,
      weaponId: gungameWeaponId, weaponSkinId: room.mode === "gungame" ? "default" : loadout.weaponSkinId, playerSkinId: loadout.playerSkinId,
    charmId:room.mode==="gungame"?"none":loadout.primaryCharmId??"none",nameplateId:loadout.nameplateId??"standard",
      kills: 0, deaths: 0, lastShotAt: 0,
      spawnProtectedUntil: Date.now() + 3000,
      ai, loadout,
    };
    room.bots.set(id, bot);
    room.loadouts.set(id, loadout);
    room.equipmentBotNextAt.set(id,Date.now()+3500+Math.random()*3000);
    if (room.mode === "gungame") room.gungameProgress.set(id, 0);
  }
}

// Construct a fresh BotAI with humanization fields. The skill range is set by
// the bot's resolved difficulty (easy/normal/hard/veteran). `skillBoost` is an
// optional additive bump used by survival waves so late waves feel harder.
function makeBotAI(sp: Vec3, _weaponId: string, difficulty: Exclude<BotDifficulty, "mixed">, skillBoost = 0, archetype: BotArchetype = "rifleman"): BotAI {
  const [lo0, hi0] = SKILL_RANGE[difficulty];
  const lo = Math.min(0.95, lo0 + skillBoost * 0.05);
  const hi = Math.min(0.97, hi0 + skillBoost * 0.05);
  const skill = Math.min(0.95, lo + Math.random() * (hi - lo));
  return {
    targetId: null,
    lastSighting: null,
    lastAlert: null,
    investigationLookAt: null,
    wanderTarget: sp,
    nextShotAt: 0,
    nextDecisionAt: 0,
    ammoInMag: 30,
    reloadingUntil: 0,
    strafeDir: Math.random() < 0.5 ? 1 : -1,
    moveSpeed: (0.55 + Math.random() * 0.3) * botMoveMultiplier(difficulty) * botPersonality(archetype).moveScale,
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
    archetype,
    stuckSince: 0,
    lastPosX: sp[0],
    lastPosZ: sp[2],
  };
}

function createRoom(mode: GameMode, botCount: number, mapId: MapId): Room {
  const id = genId("match");
  const config = DEFAULT_CONFIG(mode, botCount);
  const map = makeEnvironmentMap(getMap(mapAllowedForMode(mode,mapId)?mapId:mode==="ctf"?"forest_warfare":"compound",mode));
  const isSurvival = mode === "survival";
  const isGungame = mode === "gungame";
  // Gun Game: the score limit IS the progression length — first player to
  // cycle through every weapon (and get a kill with the knife) wins.
  if (isGungame) { config.scoreLimit = 0; config.timeLimit = 0; }
  // Legacy quick-match rooms: derive lobby metadata from botCount.
  const teamSize: TeamSize = teamSizesForMap(map.id,mode).find(n=>n>=Math.min(botCount,teamSizesForMap(map.id,mode).at(-1)!))!;
  const capacity = roomCapacity(mode, teamSize);
  const room: Room = {
    id, mode, config, map,
    players: new Map(), sockets: new Map(), bots: new Map(), loadouts: new Map(), pendingLoadouts: new Map(), playerKeys: new Map(),
    assists: new Map(), damageContributions: new Map(), scores: new Map(), teamScores: { red: 0, blue: 0 }, flags: createCtfFlags(map), overtime: false, orbitalCharge:0, orbitalHolders:new Set<string>(), tags: new Map(), tagConfirmations: new Map(), tagDenials: new Map(),
    startTime: Date.now(), timeLeft: config.timeLimit, ended: false,
    state: "playing",
    tick: null, respawnTimers: new Map(), chat: [],
    wave: 0, waveActive: false, prepLeft: isSurvival ? 5 : 0,
    reinforcements: 0, reinforcementsMax: 0, downed: new Set(),
    survivalRanks:new Map(), survivalOffers:new Map(), survivalRerolls:new Map(), survivalLastKillAt:new Map(), survivalLastHeadshotKillAt:new Map(),
    name: "Quick Match", hostName: "Server", hostSocketId: "",
    teamSize, fillWithBots: true, password: null, capacity,
    botDifficulty: "normal",
    gungameProgress: new Map(),
    gungameWeapons: [],
    gungamePreset: "all", gungameMultiplier: 1, sprintState: new Map(),
    preMatchCountdown: 5,
    environmentTime: 0,
    floodgateBreachAt:null,
    environmentWalls: new Map((map.environment ?? []).filter(o => o.type === "destructible_wall").map(o => [o.id, o.type === "destructible_wall" ? o.hp : 0])),
    materialCoverHp: new Map(), materialCoverDestroyed: new Set(),
    environmentCooldown: new Map(),
    specialHeat: new Map(), wonderCharges: new Map(), clusterVolleys: new Map(), adsStartedAt: new Map(), lastMotionAt: new Map(), stormMines: new Map(), stormMineCooldown: new Map(), smartTags: new Map(), hellfireUntil: new Map(), wonderFields: new Map(), deathBombs: new Map(), turrets: new Map(), gravityWells: new Map(), boltReadyAt: new Map(), boltCharges: new Map(), droppedBolts: new Map(), poison: new Map(), burning: new Map(), equipmentCharges: new Map(), equipmentLastAt: new Map(), equipmentBotNextAt: new Map(), equipmentMines: new Map(), equipmentStun: new Map(), quickMeleeAt: new Map(), throwingKnives: new Map(), reloadingPlayers: new Map(), autoBloom: new Map(), lastDamagedAt: new Map(), scavengerDrops: new Map(),
    burstState: new Map(),
  };
  rooms.set(id, room);
  // ---- Gun Game: resolve the per-match weapon list BEFORE spawning bots ----
  // (so bots spawn with the correct first-tier weapon).
  if (isGungame) {
    room.gungameWeapons = resolveGungameWeapons(room.gungamePreset, room.gungameMultiplier);
    room.config.scoreLimit = 0; // progression, never raw kill count
    room.timeLeft = 0;
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
      const cap = mode === "survival" ? 2 : r.capacity;
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
    survivalTier: r.config.survivalTier,
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
      room.equipmentBotNextAt.delete(bid);
      room.equipmentCharges.delete(bid);
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
  // Remove the replaced occupant before scoring the new human spawn.
  p.pos = pickSpawn(team,room);
  room.players.set(socketId, p);
  room.sockets.set(socketId, socketId);
  room.scores.set(socketId, 0);
  room.loadouts.set(socketId, loadout);
  return team;
}

// Build the player list (humans + bots) as SnapshotPlayer[] for a lobby snapshot.
function lobbyPlayers(room: Room): SnapshotPlayer[] {
  return [...room.players.values(), ...room.bots.values()].map(p => toSnap(p,room.loadouts.get(p.id)));
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
  const map = makeEnvironmentMap(getMap(mapAllowedForMode(mode,cfg.mapId)?cfg.mapId:mode==="ctf"?"forest_warfare":"compound",mode));
  const teamSize = cfg.teamSize;
  const capacity = roomCapacity(mode, teamSize, cfg.survivalPlayers === 2 ? 2 : 1);
  const config = DEFAULT_CONFIG(mode, mode === "survival" ? 0 : Math.max(0, capacity - 1));
  const isSurvival = mode === "survival";
  const isGungame = mode === "gungame";
  config.survivalTier = isSurvival ? normalizeSurvivalTier(cfg.survivalTier) : undefined;
  // Round 19i: Apply custom match limits from the host's room config (FFA/TDM only).
  // Survival and Gun Game ignore custom limits (survival is endless; gungame uses
  // the progression length as the score limit).
  if (!isSurvival && !isGungame) {
    if (typeof cfg.scoreLimit === "number" && cfg.scoreLimit >= 0) config.scoreLimit = cfg.scoreLimit;
    if (typeof cfg.timeLimit === "number" && cfg.timeLimit >= 0) config.timeLimit = cfg.timeLimit;
    if (mode === "killconfirmed" && [10000, 15000, 25000, 30000, 45000].includes(cfg.tagLifetimeMs ?? -1)) config.tagLifetimeMs = cfg.tagLifetimeMs!;
    if (mode === "killconfirmed") config.denialScoreEnabled = cfg.denialScoreEnabled === true;
    if (mode === "ctf") config.ctfFlagResetMs = ctfResetMs(cfg.ctfFlagResetMs);
  }
  // Gun Game: score limit will be set when the match starts (gungameWeapons resolved).
  // Use a placeholder for now; startMatchInRoom overwrites it.
  const room: Room = {
    id, mode, config, map,
    players: new Map(), sockets: new Map(), bots: new Map(), loadouts: new Map(), pendingLoadouts: new Map(), playerKeys: new Map(),
    assists: new Map(), damageContributions: new Map(), scores: new Map(), teamScores: { red: 0, blue: 0 }, flags: createCtfFlags(map), overtime: false, orbitalCharge:0, orbitalHolders:new Set<string>(), tags: new Map(), tagConfirmations: new Map(), tagDenials: new Map(),
    startTime: Date.now(), timeLeft: config.timeLimit, ended: false,
    state: "lobby",
    tick: null, respawnTimers: new Map(), chat: [],
    wave: 0, waveActive: false, prepLeft: isSurvival ? 5 : 0,
    reinforcements: 0, reinforcementsMax: 0, downed: new Set(),
    survivalRanks:new Map(), survivalOffers:new Map(), survivalRerolls:new Map(), survivalLastKillAt:new Map(), survivalLastHeadshotKillAt:new Map(),
    name: cfg.roomName?.trim() || `${name}'s Room`,
    hostName: name, hostSocketId: socketId,
    teamSize, fillWithBots: cfg.fillWithBots, password: cfg.password || null,
    capacity,
    botDifficulty: cfg.botDifficulty || "normal",
    gungameProgress: new Map(),
    gungameWeapons: [],
    gungamePreset: normalizeGunGameConfig(cfg.gungamePreset, cfg.gungameMultiplier).preset,
    gungameMultiplier: normalizeGunGameConfig(cfg.gungamePreset, cfg.gungameMultiplier).multiplier,
    sprintState: new Map(),
    preMatchCountdown: 0,  // lobby rooms set this when startMatch fires
    environmentTime: 0,
    floodgateBreachAt:null,
    environmentWalls: new Map((map.environment ?? []).filter(o => o.type === "destructible_wall").map(o => [o.id, o.type === "destructible_wall" ? o.hp : 0])),
    materialCoverHp: new Map(), materialCoverDestroyed: new Set(),
    environmentCooldown: new Map(),
    specialHeat: new Map(), wonderCharges: new Map(), clusterVolleys: new Map(), adsStartedAt: new Map(), lastMotionAt: new Map(), stormMines: new Map(), stormMineCooldown: new Map(), smartTags: new Map(), hellfireUntil: new Map(), wonderFields: new Map(), deathBombs: new Map(), turrets: new Map(), gravityWells: new Map(), boltReadyAt: new Map(), boltCharges: new Map(), droppedBolts: new Map(), poison: new Map(), burning: new Map(), equipmentCharges: new Map(), equipmentLastAt: new Map(), equipmentBotNextAt: new Map(), equipmentMines: new Map(), equipmentStun: new Map(), quickMeleeAt: new Map(), throwingKnives: new Map(), reloadingPlayers: new Map(), autoBloom: new Map(), lastDamagedAt: new Map(), scavengerDrops: new Map(),
    burstState: new Map(),
  };
  rooms.set(id, room);
  // Add the host as the first player. Host picks red team in TDM by default.
  const team = assignTeam(mode, room, (mode === "tdm" || mode === "killconfirmed" || mode === "ctf") ? "red" : undefined);
  const sp = pickSpawn(team, room);
  // In gungame, the host's initial weaponId is a placeholder — startMatchInRoom
  // resolves the per-match weapon list and resets everyone's weaponId. For the
  // lobby display, use the first catalog weapon of the first type (sidearm).
  const hostWeaponId = isGungame ? "pistol_side" : loadout.weaponId;
  const host: PlayerNet = {
    id: socketId, name: name.slice(0, 52) || "Host", team: team as any, isBot: false,
    pos: sp, yaw: 0, pitch: 0, health: MAX_HEALTH, alive: true,
    weaponId: hostWeaponId, weaponSkinId: room.mode === "gungame" ? "default" : loadout.weaponSkinId, playerSkinId: room.mode === "gungame" ? "default" : loadout.playerSkinId,
    charmId:room.mode==="gungame"?"none":loadout.primaryCharmId??"none",nameplateId:loadout.nameplateId??"standard",
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
  room.environmentTime = 0;
  room.floodgateBreachAt=null;
  if(room.map.id==="floodgate")setFloodgateFreightStage(room.map,null);
  room.environmentCooldown.clear();
  room.timeLeft = room.config.timeLimit;
  room.elapsedSeconds = 0;
  // Reset scores/teamScores in case the lobby had any stale state.
  room.teamScores = { red: 0, blue: 0 };
  room.flags = createCtfFlags(room.map);
  room.overtime = false;
  room.orbitalCharge=0;room.orbitalHolders.clear();
  room.tags.clear();
  room.tagConfirmations.clear();
  room.tagDenials.clear();
  room.clusterVolleys.clear();
  room.wonderCharges.clear(); // Fresh match: Wonders start empty and must earn their first charge.
  room.adsStartedAt.clear(); room.lastMotionAt.clear(); room.stormMines.clear(); room.stormMineCooldown.clear(); room.smartTags.clear(); room.hellfireUntil.clear(); room.wonderFields.clear();
  room.downed.clear();
  room.survivalRanks.clear();room.survivalOffers.clear();room.survivalRerolls.clear();room.survivalLastKillAt.clear();room.survivalLastHeadshotKillAt.clear();
  room.deathBombs.clear();
  room.turrets.clear();
  room.gravityWells.clear();
  room.assists.clear(); room.damageContributions.clear();
  for (const id of room.scores.keys()) room.scores.set(id, 0);
  // ---- Gun Game: resolve the per-match weapon list from the TYPE progression ----
  // GUN_GAME_TYPE_PROGRESSION is a fixed list of weapon CATEGORIES (e.g.
  // ["sidearm","smg","shotgun",...,"melee"]). For each type slot, we randomly
  // pick one weapon of that category from the catalog. This way:
  //   - The progression STRUCTURE is always the same (pistol start, melee end).
  //   - The SPECIFIC weapons vary per match (different sniper each time, etc.).
  //   - Only ONE melee slot exists (always the last tier).
  if (room.mode === "gungame") {
    room.gungameWeapons = resolveGungameWeapons(room.gungamePreset, room.gungameMultiplier);
    room.config.scoreLimit = 0; // final-tier kill is the only victory trigger
    room.config.timeLimit = 0;
    room.timeLeft = 0;
  }
  for (const p of room.players.values()) {
    p.kills = 0; p.deaths = 0; p.riotShieldHp=RIOT_SHIELD_HP;p.riotShieldRaised=false;p.riotShieldReadyAt=0; p.health = MAX_HEALTH; p.alive = true;
    const kit=room.loadouts.get(p.id);
    const wonder=kit?.perkId==="wonder_weapon" ? WEAPONS.find(w=>w.id===kit.wonderWeaponId&&!w.disabled) : undefined;
    if(wonder?.wonder){
      if(usesWonderCharges(wonder))
        room.wonderCharges.set(p.id+":"+wonder.id,drainedWonderCharges(wonder.wonder,room.startTime));
      if(wonder.id===RIOT_SHIELD_ID){
        p.riotShieldHp=0;
        p.riotShieldReadyAt=room.startTime+RIOT_SHIELD_RECHARGE_MS;
      }
    }
    room.burstState.delete(p.id);
    room.throwingKnives.clear();
    // Reset gungame progress + weaponId for everyone (in case of restart).
    if (room.mode === "gungame") {
      room.gungameProgress.set(p.id, 0);
      p.weaponId = room.gungameWeapons[0];
      p.weaponSkinId = "default";
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
  // In gungame, joining players get the first resolved weapon (or a placeholder
  // if the match hasn't started yet — startMatchInRoom will sync them).
  const joinWeaponId = room.mode === "gungame" ? (room.gungameWeapons[0] ?? "pistol_side") : loadout.weaponId;
  const p: PlayerNet = {
    id: socketId, name: name.slice(0, 52) || "Recruit", team: team as any, isBot: false,
    pos: [0,0,0], yaw: 0, pitch: 0, health: MAX_HEALTH, alive: true,
    weaponId: joinWeaponId, weaponSkinId: room.mode === "gungame" ? "default" : loadout.weaponSkinId, playerSkinId: room.mode === "gungame" ? "default" : loadout.playerSkinId,
    charmId:room.mode==="gungame"?"none":loadout.primaryCharmId??"none",nameplateId:loadout.nameplateId??"standard",
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
    players.push({ ...toSnap(p,room.loadouts.get(p.id)), perkId: room.loadouts.get(p.id)?.perkId });
  }
  for (const b of room.bots.values()) {
    players.push(toSnap(b,room.loadouts.get(b.id)));
  }
  const scores: Record<string, number> = {};
  for (const [id, k] of room.scores) scores[id] = k;
  const base: S2C = {
    t: "snapshot", serverNow:Date.now(), players, scores, teamScores: room.teamScores,
    timeLeft: Math.max(0, Math.ceil(room.timeLeft)),
    elapsedSeconds: Math.floor(room.elapsedSeconds ?? 0),
    clusterVolleys: [...room.clusterVolleys.values()].map(({done,dealt,...v})=>v),
    environmentTime: room.environmentTime,
    floodgateBreachAt:room.floodgateBreachAt,
    environmentWalls: Object.fromEntries(room.environmentWalls),
    materialCoverHp: Object.fromEntries(room.materialCoverHp),
    materialCoverDestroyed: [...room.materialCoverDestroyed],
    ...(room.map.id==="floodgate"?{floodgateRulesVersion:5}:{}),
    turrets: [...room.turrets.entries()].map(([id,t]) => ({ id, ownerId: t.ownerId, pos: t.pos, yaw: t.yaw, expiresAt: t.expiresAt })),
    gravityWells: [...room.gravityWells.entries()].map(([id,w]) => ({ id, ownerId: w.ownerId, ownerTeam: w.ownerTeam, pos: w.pos, radius: w.radius, activatesAt: w.activatesAt, expiresAt: w.expiresAt })),
    poisoned: [...room.poison.entries()].filter(([id, dot]) => dot.expiresAt > Date.now() && (room.players.get(id)?.alive || room.bots.get(id)?.alive)).map(([id, dot]) => ({ id, expiresAt: dot.expiresAt })),
    burning: [...room.burning.entries()].filter(([id, until]) => until > Date.now() &&
      (room.players.get(id)?.alive || room.bots.get(id)?.alive)).map(([id, expiresAt]) => ({id,expiresAt})),
    wonderFields: [...room.wonderFields.values()].map(({id,ownerId,ownerTeam,weaponId,kind,pos,radius,expiresAt})=>({id,ownerId,ownerTeam,weaponId,kind,pos,radius,expiresAt})),
    stormMines: [...room.stormMines.values()].map(({id,pos,expiresAt})=>({id,pos,expiresAt})),
    ...(room.mode === "ctf" ? { ctfFlags: room.flags, ctfOvertime: room.overtime,
      ctfBases: {red:ctfBase("red",room.map),blue:ctfBase("blue",room.map)}, ctfRulesVersion: 2 } : {}),
    ...(reactorObjective(room.map)?{
      orbitalCharge:room.orbitalCharge,
      orbitalHolders:[...room.orbitalHolders],orbitalRulesVersion:ORBITAL_RULES_VERSION,
    }:{}),
    // Scavenger boxes are private to the killer; they must never be broadcast in shared snapshots.
    ...(room.mode === "killconfirmed" ? {
      tags: [...room.tags.values()],
      tagStats: Object.fromEntries([...room.scores.keys()].map(id => [id, {
        confirmations: room.tagConfirmations.get(id) ?? 0,
        denials: room.tagDenials.get(id) ?? 0,
      }])),
    } : {}),
  };
  if (room.mode === "survival") {
    const enemiesLeft = [...room.bots.values()].filter((b) => b.alive).length;
    (base as any).wave = room.wave;
    (base as any).survivalTier = room.config.survivalTier;
    (base as any).waveActive = room.waveActive;
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

function toSnap(p: PlayerNet,loadout?:LoadoutWire): SnapshotPlayer {
  // Advance authoritative recharge even while the shield is holstered.
  const shield=tickRiotShield(p.riotShieldHp??RIOT_SHIELD_HP,p.riotShieldReadyAt??0,Date.now());
  p.riotShieldHp=shield.hp;p.riotShieldReadyAt=shield.readyAt;
  const currentCharm=loadout && p.weaponId===loadout.weaponId ? loadout.primaryCharmId :
    loadout && p.weaponId===loadout.secondaryWeaponId ? loadout.secondaryCharmId :
    loadout && p.weaponId===loadout.meleeWeaponId ? loadout.meleeCharmId : "none";
  const boss = (p as PlayerNet & {ai?:BotAI}).ai?.boss;
  return {
    id: p.id, name: p.name, team: p.team, isBot: p.isBot,
    pos: p.pos, yaw: p.yaw, pitch: p.pitch, health: p.health, alive: p.alive,
    weaponId: p.weaponId, weaponSkinId: p.weaponSkinId, playerSkinId: p.playerSkinId,
    charmId:currentCharm??"none",nameplateId:p.nameplateId,
    bossMaxHealth:p.bossMaxHealth,
    bossCharge:boss?bossShockwaveCharge(boss.nextSkillAt,Date.now()):undefined,
    riotShieldHp:p.riotShieldHp??RIOT_SHIELD_HP,riotShieldRaised:p.riotShieldRaised??false,riotShieldReadyAt:p.riotShieldReadyAt??0,
    kills: p.kills, deaths: p.deaths, aiming: (p as PlayerNet & { ai?: BotAI }).ai?.aiming ?? false, reloading: false,
    spawnProtectedUntil: p.spawnProtectedUntil && p.spawnProtectedUntil > Date.now() ? p.spawnProtectedUntil : 0,
  };
}

function allCombatants(room: Room): PlayerNet[] {
  return [...room.players.values(), ...room.bots.values()];
}

// Shared limb-inclusive humanoid ray collision (see combat-hitboxes.ts).

// ---- LOS & hit detection ----------------------------------------------------
function losBlocked(room: Room, origin: Vec3, dir: Vec3, maxT: number): boolean {
  for (const c of room.map.cover) {
    const t = rayBox(origin, dir, c.pos, c.size);
    if (t !== null && t < maxT) return true;
  }
  return false;
}

/** Broadcast gunfire reveal only to nearby enemy clients; suppressors shrink its radius. */
function broadcastRadarPing(room: Room, shooter: PlayerNet, suppressed: boolean) {
  const now = Date.now();
  for (const viewer of room.players.values()) {
    if (!viewer.alive || viewer.id === shooter.id || friendlyOnRadar(room.mode, viewer.team, shooter.team)) continue;
    if (!canHearGunshot({ x: viewer.pos[0], z: viewer.pos[2] }, { x: shooter.pos[0], z: shooter.pos[2] }, suppressed)) continue;
    const viewerPerk = room.loadouts.get(viewer.id)?.perkId;
    io.to(viewer.id).emit("message", { t: "radarPing", attackerId: shooter.id, pos: shooter.pos, expiresAt: radarExpiresAt(now, viewerPerk), durationMs: radarDurationMs(viewerPerk) } as S2C);
  }
}
/** Immediately clear third-person shield before the next snapshot. */
function clearSpawnProtection(room: Room, combatant: PlayerNet) {
  if (!combatant.spawnProtectedUntil) return;
  combatant.spawnProtectedUntil = 0;
  io.to(room.id).emit("message", { t: "protectionEnded", playerId: combatant.id } as S2C);
}

function fireRay(room: Room, attackerId: string, origin: Vec3, dir: Vec3, weaponId: string, range: number, falloffEndMultiplier = 1.6): { victim: PlayerNet; t: number; head: boolean; shield?: boolean } | null {
  const attacker = room.players.get(attackerId) ?? room.bots.get(attackerId);
  const attackerTeam = attacker?.team;
  let nearest: { victim: PlayerNet; t: number; head: boolean; shield?: boolean } | null = null;
  for (const p of allCombatants(room)) {
    if (p.id === attackerId) continue;
    if (!p.alive) continue;
    if (room.config.friendlyFire === false && p.team === attackerTeam && room.mode !== "ffa" && room.mode !== "gungame") continue;
    const panel=rayRiotShield(origin,dir,p);
    if(panel!==null&&panel<=range*falloffEndMultiplier&&(!nearest||panel<nearest.t))nearest={victim:p,t:panel,head:false,shield:true};
    const hit = rayCombatantHit(origin, dir, p.pos);
    if (hit && hit.t <= range * falloffEndMultiplier) {
      if (!nearest || hit.t < nearest.t) nearest = { victim: p, t: hit.t, head: hit.head };
    }
  }
  if (!nearest) return null;
  if (losBlocked(room, origin, dir, nearest.t)) return null;
  return nearest;
}

/** Damage and broadcast cover impacts after target selection for the current pellet.
 * The fatal pellet still sees the pre-break collision, while the NEXT pellet/shot
 * sees the newly opened passage. Never use client-reported cover damage. */
function hitMaterialCover(room: Room, origin: Vec3, dir: Vec3, eff: WeaponStats,
  bodyHits: readonly {t:number}[]): void {
  const stopAt = bodyHits.length && !eff.bodyPenetration ? bodyHits[0].t : Infinity;
  for (const impact of damageBallisticCoverOnShot(room.map,room.materialCoverHp,room.materialCoverDestroyed,
    origin,dir,maxWeaponHitRange(eff.range,eff),eff.coverPenetration ?? 0,eff.damage,stopAt)) {
    io.to(room.id).emit("message",{t:"materialCoverImpact",impact} as S2C);
  }
}

/** Conventional hitscan rounds can cross explicitly tagged thin cover.
 * Structural cover, Bulwark shields and protected spawns still absorb shots. */
function firePenetratingRay(room: Room, attackerId: string, origin: Vec3, dir: Vec3,
  range: number, eff: WeaponStats): { victim: PlayerNet; t: number; head: boolean; shield?: boolean; damageScale: number }[] {
  if (!eff.bodyPenetration && !(eff.coverPenetration ?? 0)) {
    const first = fireRay(room, attackerId, origin, dir, "", range, eff.falloffEndMultiplier);
    return first ? [{ ...first, damageScale: 1 }] : [];
  }
  const attacker = room.players.get(attackerId) ?? room.bots.get(attackerId);
  const maxDistance = maxWeaponHitRange(range, eff);
  const contacts: BodyRayContact<PlayerNet>[] = [];
  for (const target of allCombatants(room)) {
    if (!target.alive || target.id === attackerId) continue;
    if (room.config.friendlyFire === false && target.team === attacker?.team &&
        room.mode !== "ffa" && room.mode !== "gungame") continue;
    const panel = rayRiotShield(origin, dir, target);
    const body = rayCombatantHit(origin, dir, target.pos);
    const shieldFirst = panel !== null && panel >= 0 && (!body || panel < body.t);
    const t = shieldFirst ? panel! : body?.t;
    if (t === undefined) continue;
    contacts.push({ target, t, head: shieldFirst ? false : !!body?.head,
      shield: shieldFirst,
      protected: (target.spawnProtectedUntil ?? 0) > Date.now() });
  }
  return selectMaterialPenetrationHits(contacts,room.map.cover,origin,dir,maxDistance,
      eff.bodyPenetration,eff.coverPenetration)
    .map(({ target, t, head, shield, damageScale }) => ({ victim: target, t, head, shield, damageScale }));
}

// Determine the victim's "kill difficulty" for rewards scaling. Bot victims
// use their AI's resolved difficulty; human victims are treated as "veteran"
// (the top tier — PvP kills are the most valuable).
function victimKillDifficulty(victim: PlayerNet): KillDifficulty {
  const bot = victim as PlayerNet & { ai?: BotAI };
  if (victim.isBot && bot.ai) return bot.ai.difficulty;
  return "enemy_player";
}

// ---- Special weapons: shared authoritative server state ----
function allowHeatShot(room: Room, playerId: string, special: Extract<NonNullable<ReturnType<typeof weaponById>["special"]>, {kind:"heat"}>, now: number): boolean {
  const key = playerId;
  const old = room.specialHeat.get(key) ?? { ...freshHeat(), updatedAt: now, ventUntil: 0 };
  if (old.ventUntil > now) return false;
  if (old.ventUntil && old.ventUntil <= now) { old.heat = 0; old.locked = false; old.ventUntil = 0; }
  const state = coolHeat(old, special, (now - old.updatedAt) / 1000, now);
  const shot = addHeat(state, special, now);
  room.specialHeat.set(key, { ...(shot ?? state), updatedAt: now, ventUntil: 0 });
  return shot !== null;
}

function canChainThroughCover(room: Room, from: ArcCandidate, to: ArcCandidate): boolean {
  const o: Vec3 = [from.pos[0], from.pos[1] + 1.1, from.pos[2]];
  const delta: Vec3 = [to.pos[0] - from.pos[0], to.pos[1] - from.pos[1], to.pos[2] - from.pos[2]];
  const distance = Math.hypot(...delta) || 1;
  const dir: Vec3 = [delta[0] / distance, delta[1] / distance, delta[2] / distance];
  return !room.map.cover.some(box => { const t = rayBox(o, dir, box.pos, box.size); return t !== null && t >= 0 && t < distance; });
}

function applyArcChains(room: Room, attacker: PlayerNet, first: PlayerNet, baseDamage: number, special: Extract<NonNullable<ReturnType<typeof weaponById>["special"]>, {kind:"arc"}>) {
  let from: ArcCandidate = { id: first.id, pos: first.pos, team: first.team, alive: true };
  const visited = new Set([first.id]);
  for (let jump = 1; jump <= special.jumps && !room.ended; jump++) {
    const candidates: ArcCandidate[] = allCombatants(room)
      .filter(c => c.id !== attacker.id && (room.mode === "ffa" || room.mode === "gungame" || c.team !== attacker.team))
      .map(c => ({ id: c.id, pos: c.pos, team: c.team, alive: c.alive, protected: !!c.spawnProtectedUntil && c.spawnProtectedUntil > Date.now() }));
    const next = nextArcTarget(from, candidates, visited, special.radius, true, (a, b) => canChainThroughCover(room, a, b));
    if (!next) break;
    visited.add(next.id);
    const fromPoint: Vec3 = [from.pos[0], from.pos[1] + 1.1, from.pos[2]];
    const toPoint: Vec3 = [next.pos[0], next.pos[1] + 1.1, next.pos[2]];
    io.to(room.id).emit("message", { t: "arcFx", from: fromPoint, to: toPoint } as S2C);
    const victim = allCombatants(room).find(c => c.id === next.id);
    if (victim?.alive) applyDamage(room, attacker.id, victim, baseDamage * Math.pow(special.decay, jump), false, "pistol_arc");
    from = next;
  }
}

function serverBoltLanding(room: Room, attackerId: string, origin: Vec3, dir: Vec3, range: number): Vec3 {
  const d = Math.hypot(...dir) || 1;
  const nd: Vec3 = [dir[0] / d, dir[1] / d, dir[2] / d];
  let distance = range;
  const cover = closestCoverHit(room.map.cover, origin, nd, distance, rayBox);
  if (cover) distance = Math.max(0, cover.distance);
  for (const c of allCombatants(room)) {
    if (c.id === attackerId || !c.alive) continue;
    const hit = rayCapsule(origin, nd, [c.pos[0], c.pos[1] + PLAYER_HEIGHT / 2, c.pos[2]], PLAYER_RADIUS, PLAYER_HEIGHT);
    if (hit && hit.t >= 0 && hit.t < distance) distance = hit.t;
  }
  // Bolts are collectible on the floor, including bolts that hit walls/players.
  return [origin[0] + nd[0] * distance, 0.4, origin[2] + nd[2] * distance];
}

/** Only the server chooses the item and explosion; client submits no position,
 * damage, victim list or equipment ID. */
function serverUseEquipment(room: Room, playerId: string): number | null {
  if (room.state !== "playing" || room.ended || room.preMatchCountdown > 0 || room.mode === "gungame") return null;
  const player=room.players.get(playerId) ?? room.bots.get(playerId);
  if (!player?.alive || room.downed.has(playerId) || (room.equipmentStun.get(playerId) ?? 0)>Date.now()) return null;
  const def=equipmentById(room.loadouts.get(playerId)?.equipmentId);
  const left=room.equipmentCharges.get(playerId) ?? def.charges;
  const now=Date.now();
  if (!left || now-(room.equipmentLastAt.get(playerId)??0)<def.cooldownMs) return null;
  room.equipmentLastAt.set(playerId,now);
  room.equipmentCharges.set(playerId,left-1);
  const cp=Math.cos(player.pitch);
  const dir: Vec3=[Math.sin(player.yaw)*cp,Math.sin(player.pitch),Math.cos(player.yaw)*cp];
  const from: Vec3=[player.pos[0],player.pos[1]+EYE_HEIGHT*.86,player.pos[2]];
  const path: TimedProjectilePath=def.id==="frag" || def.id==="flashbang"
    ? tacticalGrenadePath(from,dir,room.map.cover,room.map.id)
    : calculateThrowPath(from,dir,def.id, (at,vector,distance)=> {
      const collision=closestCoverHit(room.map.cover,at,vector,distance,rayBox);
      return collision?.distance ?? null;
    },player.pos[1]+.12);
  const impact=path.impact;
  if(def.type==="mine") {
    const mineId=genId("mine");
    room.equipmentMines.set(mineId,{ownerId:playerId,pos:impact,expiresAt:now+45000});
    io.to(room.id).emit("message",{t:"equipmentFx",equipmentId:def.id,position:impact,ownerId:playerId,mineId,mineState:"placed"} as S2C);
  } else {
    // Clients reconstruct the full throw from sampled positions. This first
    // event is visual only; impact damage is applied after the flight time.
    // Flight timestamps are necessary to render wall/floor ricochets correctly.
    const indices=path.points.map((_,i)=>i).filter(i=>i%3===0||i===path.points.length-1||
      path.timesMs?.some((time,j)=>j===i&&path.bounces?.some(b=>Math.abs(b.timeMs-time)<.001)));
    const sampled=indices.map(i=>path.points[i]);
    const pathTimesMs=path.timesMs && indices.map(i=>path.timesMs![i]);
    io.to(room.id).emit("message",{t:"equipmentFx",equipmentId:def.id,position:impact,ownerId:playerId,path:sampled,pathTimesMs,flightMs:path.flightMs} as S2C);
    setTimeout(()=>{
      if(room.ended || room.state!=="playing")return;
      if(def.type==="knife" || def.type==="poison" || def.type==="taser") {
        // Segment-based projectile collision: the first unprotected enemy near
        // the actual flight path is hit, rather than a hitscan shot at button-down.
        let closest:{victim:PlayerNet;distance:number}|null=null;
        for(const victim of allCombatants(room)) {
          if(!victim.alive || victim.id===playerId || room.mode!=="ffa" && victim.team===player.team ||
              victim.spawnProtectedUntil && victim.spawnProtectedUntil>Date.now())continue;
          const center: Vec3=[victim.pos[0],victim.pos[1]+1.0,victim.pos[2]];
          for(let i=1;i<path.points.length;i++){
            const a=path.points[i-1],b=path.points[i];
            const vx=b[0]-a[0],vy=b[1]-a[1],vz=b[2]-a[2];
            const sq=vx*vx+vy*vy+vz*vz || 1;
            const t=Math.max(0,Math.min(1,((center[0]-a[0])*vx+(center[1]-a[1])*vy+(center[2]-a[2])*vz)/sq));
            const d=Math.hypot(center[0]-a[0]-vx*t,center[1]-a[1]-vy*t,center[2]-a[2]-vz*t);
            if(d<.82 && (!closest || i+t<closest.distance))closest={victim,distance:i+t};
          }
        }
        if(closest){const target:PlayerNet=closest.victim;
          applyDamage(room,playerId,target,def.damage,false,`equipment_${def.id}`);
          if(target.alive && def.type==="poison")room.poison.set(target.id,{attackerId:playerId,weaponId:`equipment_${def.id}`,expiresAt:Date.now()+4500,tickAt:Date.now()+500});
          if(target.alive && def.type==="taser"){
            room.equipmentStun.set(target.id,Date.now()+1700);
            if(!target.isBot)io.to(target.id).emit("message",{t:"equipmentStatus",effect:"stun",durationMs:1700} as S2C);
          }
        }
      } else {
        if (def.type === "blast") destroyTurretsNear(room, impact, def.radius);
        // Blast occurs at landing, not at release. Flash affects the thrower
        // too when caught in line of sight, with stronger exposure nearby.
        for(const victim of allCombatants(room)) {
          if(!victim.alive || def.type!=="flash" && (victim.id===playerId || room.mode!=="ffa" && victim.team===player.team))continue;
          if(victim.spawnProtectedUntil && victim.spawnProtectedUntil>Date.now())continue;
          const dst=Math.hypot(victim.pos[0]-impact[0],victim.pos[2]-impact[2]);
          if(dst>def.radius || !hasLineOfSight(room,[impact[0],impact[1]+.3,impact[2]],[victim.pos[0],victim.pos[1]+1,victim.pos[2]]))continue;
          if(def.type==="blast")applyDamage(room,playerId,victim,Math.max(12,def.damage*(1-dst/def.radius)),false,`equipment_${def.id}`);
          if(def.type==="flash"){
            const duration=Math.round(1100+1800*(1-dst/def.radius));
            room.equipmentStun.set(victim.id,Date.now()+duration);
            if(!victim.isBot)io.to(victim.id).emit("message",{t:"equipmentStatus",effect:"flash",durationMs:duration} as S2C);
          }
        }
      }
    },path.flightMs);
  }
  return left-1;
}

/** Explosive and melee hits destroy Bullet Spitter immediately. */
function destroyTurretsNear(room: Room, pos: Vec3, radius: number, onlyOwner?: string) {
  for (const [id, turret] of room.turrets) {
    if (onlyOwner && turret.ownerId !== onlyOwner) continue;
    if (Math.hypot(turret.pos[0] - pos[0], turret.pos[2] - pos[2]) > radius) continue;
    room.turrets.delete(id);
    io.to(room.id).emit("message", { t: "turretRemoved", id } as S2C);
  }
}

/** Melee must actually reach and face the turret, unlike a radial blast. */
function destroyTurretsHitByMelee(room: Room, player: PlayerNet, range: number) {
  for (const [id,turret] of room.turrets) {
    const distance = Math.hypot(turret.pos[0]-player.pos[0],turret.pos[2]-player.pos[2]);
    if (distance > range || !turretCanTrack(player.pos,player.yaw,turret.pos,range)) continue;
    if (!hasLineOfSight(room,[player.pos[0],player.pos[1]+1,player.pos[2]],
      [turret.pos[0],turret.pos[1]+.7,turret.pos[2]])) continue;
    room.turrets.delete(id);
    io.to(room.id).emit("message",{t:"turretRemoved",id} as S2C);
  }
}

/** One authoritative ammo reserve shared by slot-3 throws and F quick throws.
 * Both inputs pass through this short, cover-blocked ray with zero penetration. */
function syncThrowingKnifeAmmo(room:Room,p:PlayerNet,now:number){
  if(p.isBot)return;
  const state=room.throwingKnives.get(p.id)??fullThrowingKnives();
  io.to(p.id).emit("message",{t:"knifeAmmo",charges:state.charges,
    rechargeMs:throwingKnifeRemainingMs(state,now,room.mode==="gungame")} as S2C);
}
function throwKnifeFrom(room:Room,p:PlayerNet,origin:Vec3,dir:Vec3,now:number,skinId="default"):boolean{
  if(![...origin,...dir].every(Number.isFinite)||
     Math.abs(Math.hypot(...dir)-1)>.2||
     Math.hypot(origin[0]-p.pos[0],origin[1]-p.pos[1],origin[2]-p.pos[2])>3)return false;
  const state=room.throwingKnives.get(p.id)??fullThrowingKnives();
  const spent=spendThrowingKnife(state,now,room.mode==="gungame");
  if(!spent){syncThrowingKnifeAmmo(room,p,now);return false;}
  room.throwingKnives.set(p.id,spent);
  const bot=room.bots.get(p.id);
  if(bot)bot.ai.ammoInMag=spent.charges;
  p.lastShotAt=now;
  clearSpawnProtection(room,p);
  syncThrowingKnifeAmmo(room,p,now);
  const weapon=weaponById(THROWING_KNIVES_ID);
  const hit=firePenetratingRay(room,p.id,origin,dir,THROWING_KNIFE_RANGE,weapon.stats)
    .find(h=>h.t<=THROWING_KNIFE_RANGE);
  if(hit)applyDamage(room,p.id,hit.victim,weapon.stats.damage*
    (hit.head?weapon.stats.headshotMult:1),hit.head,THROWING_KNIVES_ID,hit.shield);
  io.to(room.id).emit("message",{t:"shotFx",origin,dir,weaponId:THROWING_KNIVES_ID,
    attackerId:p.id,skinId,suppressed:true} as S2C);
  return true;
}
function tickThrowingKnifeRecovery(room:Room,now:number){
  if(room.mode!=="gungame")return;
  for(const [id,state] of room.throwingKnives){
    const next=tickThrowingKnives(state,now,true);
    if(next===state)continue;
    room.throwingKnives.set(id,next);
    const p=room.players.get(id)??room.bots.get(id);
    if(!p)continue;
    const bot=room.bots.get(id);if(bot)bot.ai.ammoInMag=next.charges;
    syncThrowingKnifeAmmo(room,p,now);
  }
}

/** Identical authoritative melee selection for equipped slot-3 swings and F.
 * Throwing knives use a dedicated limited-ammunition projectile, not this arc.
 */
function applyMeleeStrike(room:Room,attacker:PlayerNet,weaponId:string,now:number){
  const weapon=weaponById(weaponId),attack=weaponId===RIOT_SHIELD_ID
    ? riotBashProfile() : quickMeleeProfile(weapon.stats,weaponId);
  destroyTurretsHitByMelee(room,attacker,attack.reach);
  const target=chooseQuickMeleeTarget(attacker.pos,attacker.yaw,
    allCombatants(room).filter(c=>c.id!==attacker.id).map(c=>({
      id:c.id,pos:c.pos,alive:c.alive,
      protected:(c.spawnProtectedUntil??0)>now,
      friendly:room.config.friendlyFire===false&&room.mode!=="ffa"&&room.mode!=="gungame"&&c.team===attacker.team,
    })),
    (c,dist)=>{
      const eye:Vec3=[attacker.pos[0],attacker.pos[1]+1.1,attacker.pos[2]];
      const dir:Vec3=[(c.pos[0]-attacker.pos[0])/dist,0,(c.pos[2]-attacker.pos[2])/dist];
      return !losBlocked(room,eye,dir,Math.max(.01,dist-.15));
    },attack.reach,attack.halfArcDegrees);
  const victim=target?(room.players.get(target.id)??room.bots.get(target.id)):null;
  const hitIds:string[]=[];
  if(victim){
    hitIds.push(victim.id);
    applyDamage(room,attacker.id,victim,attack.damage,false,weaponId);
    if(weaponId===RIOT_SHIELD_ID && victim.alive){
      const dx=victim.pos[0]-attacker.pos[0],dz=victim.pos[2]-attacker.pos[2];
      const dist=Math.hypot(dx,dz)||1;
      const pushed:Vec3=[victim.pos[0]+dx/dist*RIOT_BASH_KNOCKBACK,
        victim.pos[1],victim.pos[2]+dz/dist*RIOT_BASH_KNOCKBACK];
      if(!blocksBotMotion(room.map.cover,victim.pos,pushed,victim.pos[1])){
        victim.pos=clampToArena(room,pushed);
        if(!victim.isBot)io.to(victim.id).emit("message",
          {t:"shieldBashPush",victimId:victim.id,pos:victim.pos} as S2C);
      }
    }
  }
  // The Reaper pulse is a separate 360-degree area strike on EVERY swing,
  // including a swing that misses the primary frontal target.
  if(weaponId===ORBITAL_REAPER_ID){
    const eligible=allCombatants(room).filter(c=>c.id!==attacker.id);
    const pulseIds=orbitalPulseTargets(attacker.pos,eligible.map(c=>({
      id:c.id,pos:c.pos,alive:c.alive,
      protected:(c.spawnProtectedUntil??0)>now,
      friendly:room.config.friendlyFire===false&&room.mode!=="ffa"&&room.mode!=="gungame"&&c.team===attacker.team,
    })),pos=>{
      const dist=Math.hypot(pos[0]-attacker.pos[0],pos[2]-attacker.pos[2]);
      if(dist<.001)return false;
      return losBlocked(room,[attacker.pos[0],attacker.pos[1]+1.1,attacker.pos[2]],
        [(pos[0]-attacker.pos[0])/dist,0,(pos[2]-attacker.pos[2])/dist],Math.max(.01,dist-.15));
    },hitIds);
    for(const id of pulseIds){
      const enemy=room.players.get(id)??room.bots.get(id);
      if(enemy)applyDamage(room,attacker.id,enemy,ORBITAL_PULSE_DAMAGE,false,weaponId);
    }
    io.to(room.id).emit("message",{t:"orbitalPulse",playerId:attacker.id,
      pos:[...attacker.pos] as Vec3} as S2C);
  }
}

/** Plant a genuine world entity. Also used by the legacy "shot" path. */
function placePlayerTurret(room: Room, player: PlayerNet, ownerId: string, now: number) {
  for (const [id, existing] of room.turrets) if (existing.ownerId === ownerId) {
    room.turrets.delete(id);
    io.to(room.id).emit("message", { t: "turretRemoved", id } as S2C);
  }
  const id = genId("spitter");
  const candidate = turretDeployPosition(player.pos, player.yaw, room.map.cover, room.map.size);
  const pos: Vec3 = [candidate[0],
    botGroundHeight(room.map.cover, candidate[0], candidate[2], candidate[1]),
    candidate[2]];
  const expiresAt = now + TURRET_LIFETIME_MS;
  room.turrets.set(id, {
    ownerId, ownerTeam: player.team, pos, yaw: player.yaw,
    expiresAt, nextShotAt: now + 300, hp: TURRET_HP,
  });
  io.to(room.id).emit("message", {
    t: "turretPlaced", id, ownerId, pos, yaw: player.yaw, expiresAt,
  } as S2C);
}

/** Server-authoritative tracking, damage, and 140° forward arc.
 * The arc applies horizontally; a target can be high above/below the turret.
 */
function tickBulletSpitters(room: Room, now: number) {
  for (const [id, turret] of room.turrets) {
    if (now >= turret.expiresAt || !room.players.has(turret.ownerId)) {
      room.turrets.delete(id);
      io.to(room.id).emit("message", { t: "turretRemoved", id } as S2C);
      continue;
    }
    if (now < turret.nextShotAt || room.preMatchCountdown > 0) continue;
    const target = allCombatants(room).filter(p =>
      p.id !== turret.ownerId && p.alive &&
      !(room.mode === "survival" && room.downed.has(p.id)) &&
      turretCanAttack(room.mode, turret.ownerTeam, p.team, p.id === turret.ownerId) &&
      turretCanTrack(turret.pos, turret.yaw, p.pos) &&
      hasLineOfSight(room, [turret.pos[0], turret.pos[1] + TURRET_MUZZLE_HEIGHT, turret.pos[2]],
        [p.pos[0], p.pos[1] + PLAYER_HEIGHT / 2, p.pos[2]])
    ).sort((a,b) =>
      Math.hypot(a.pos[0]-turret.pos[0],a.pos[2]-turret.pos[2]) -
      Math.hypot(b.pos[0]-turret.pos[0],b.pos[2]-turret.pos[2]))[0];
    if (!target) continue;
    turret.nextShotAt = now + TURRET_INTERVAL_MS;
    io.to(room.id).emit("message", { t: "turretFired", id,
      target: [target.pos[0],target.pos[1]+PLAYER_HEIGHT/2,target.pos[2]] } as S2C);
    const turretOrigin:Vec3=[turret.pos[0],turret.pos[1]+TURRET_MUZZLE_HEIGHT,turret.pos[2]];
    const turretDir=normalize([target.pos[0]-turretOrigin[0],target.pos[1]+PLAYER_HEIGHT/2-turretOrigin[1],target.pos[2]-turretOrigin[2]]);
    applyDamage(room, turret.ownerId, target, TURRET_DAMAGE, false, "wonder_turret",rayRiotShield(turretOrigin,turretDir,target)!==null);
    if (room.ended) return;
  }
}

/** Server-authoritative Event Horizon: pull bots each tick, then detonate.
 * Human movement stays client-authoritative: the client applies the same pull
 * to its own motion, with cover collision.
 */
function tickGravityWells(room: Room, now: number) {
  for (const [id, well] of room.gravityWells) {
    if (now < well.activatesAt) continue;
    if (now >= well.expiresAt) {
      room.gravityWells.delete(id);
      io.to(room.id).emit("message", { t: "gravityDetonate", id, pos: well.pos, radius: well.radius } as S2C);
      destroyTurretsNear(room, well.pos, well.radius);
      for (const target of allCombatants(room)) {
        if (!target.alive || target.id === well.ownerId ||
            (room.mode !== "ffa" && room.mode !== "gungame" && target.team === well.ownerTeam)) continue;
        const dx = target.pos[0] - well.pos[0], dz = target.pos[2] - well.pos[2];
        const dy = target.pos[1] + PLAYER_HEIGHT / 2 - well.pos[1];
        const distance = Math.hypot(dx, dy, dz);
        const damage = gravityBlastDamage(distance, well.radius, well.damage);
        if (!damage || !hasLineOfSight(room, well.pos, [target.pos[0], target.pos[1] + PLAYER_HEIGHT / 2, target.pos[2]])) continue;
        applyDamage(room, well.ownerId, target, damage, false, well.weaponId);
        if (room.ended) return;
      }
      continue;
    }
    for (const bot of room.bots.values()) {
      if (!bot.alive || (room.mode !== "ffa" && room.mode !== "gungame" && bot.team === well.ownerTeam) ||
          (bot.spawnProtectedUntil && bot.spawnProtectedUntil > now)) continue;
      const [dx, dz] = gravityPullOffset(well.pos, bot.pos, well.radius, 1 / 20);
      if (dx === 0 && dz === 0) continue;
      if (!hasLineOfSight(room, well.pos, [bot.pos[0], bot.pos[1] + 1, bot.pos[2]])) continue;
      const next: Vec3 = [bot.pos[0] + dx, bot.pos[1], bot.pos[2] + dz];
      if (!botMoveBlocked(room, bot.pos, next, bot.pos[1])) bot.pos = next;
    }
  }
}

/** Server owns world-effect lifetimes and periodic damage. */
function tickWonderFields(room:Room,now:number){
 for(const [id,field] of room.wonderFields){
  if(now>=field.expiresAt){room.wonderFields.delete(id);continue;}
  if(now<field.tickAt)continue;
  field.tickAt=now+500;
  for(const victim of allCombatants(room)){
   if(!victim.alive||victim.id===field.ownerId||(room.mode!=="ffa"&&room.mode!=="gungame"&&!room.config.friendlyFire&&victim.team===field.ownerTeam))continue;
   if(Math.hypot(victim.pos[0]-field.pos[0],victim.pos[2]-field.pos[2])>field.radius)continue;
   if(!hasLineOfSight(room,[field.pos[0],field.pos[1]+.35,field.pos[2]],[victim.pos[0],victim.pos[1]+.9,victim.pos[2]]))continue;
   applyDamage(room,field.ownerId,victim,field.kind==="flame"?7:5,false,field.weaponId);
   if(room.ended)return;
  }
 }
 // Stormweaver mines are proximity-triggered separately from old field DoTs.
}
function placeWonderField(room:Room,owner:PlayerNet,weaponId:string,kind:"flame"|"sludge",pos:Vec3,radius:number,now:number,durationMs:number){
 const id=genId("wonderfield");
 const field={id,ownerId:owner.id,ownerTeam:owner.team,weaponId,kind,pos,radius,expiresAt:now+durationMs,tickAt:now+500};
 room.wonderFields.set(id,field);
 io.to(room.id).emit("message",{t:"wonderField",...field} as S2C);
}
/** Independent Stormweaver pellet chains and floor mines.
 * Damage and targeting always resolve on the authoritative match server.
 */
function stormCandidates(room:Room,ownerId:string,ownerTeam:string,now:number):StormVictim[]{
  const allowFriendly=room.config.friendlyFire===true||room.mode==="ffa"||room.mode==="gungame";
  return allCombatants(room).map(c=>({
    id:c.id,pos:c.pos,alive:c.alive,team:c.team,
    protected:!!c.spawnProtectedUntil&&c.spawnProtectedUntil>now,
  })).filter(c=>stormEnemy(c,ownerId,ownerTeam,allowFriendly));
}
function serverStormChain(room:Room,ownerId:string,ownerTeam:string,first:PlayerNet,
  baseDamage:number,maxJumps:number,now:number,hitCounts?:Map<string,number>){
  const allowFriendly=room.config.friendlyFire===true||room.mode==="ffa"||room.mode==="gungame";
  const visited=new Set([first.id]);
  let from:Vec3=[first.pos[0],first.pos[1]+1.05,first.pos[2]];
  for(let jump=1;jump<=maxJumps&&!room.ended;jump++){
    const target=nextStormChainTarget(from,stormCandidates(room,ownerId,ownerTeam,now),
      visited,ownerId,ownerTeam,allowFriendly,STORM_MINE_CHAIN_RADIUS,
      (a,b)=>hasLineOfSight(room,a,b));
    if(!target)break;
    visited.add(target.id);
    const to=stormTargetPoint(target);
    io.to(room.id).emit("message",{t:"wonderBeam",from,to,kind:"storm"} as S2C);
    const victim=allCombatants(room).find(c=>c.id===target.id);
    if(victim?.alive){
      const previous=hitCounts?.get(victim.id)??0;
      if(previous<2){
        applyDamage(room,ownerId,victim,baseDamage*Math.pow(STORM_CHAIN_DECAY,jump),false,"wonder_stormweaver");
        hitCounts?.set(victim.id,previous+1);
      }
    }
    from=to;
  }
}
function serverPlaceStormMine(room:Room,ownerId:string,ownerTeam:string,pos:Vec3,now:number){
  // Per-owner bound keeps multiplayer snapshots/particles under control.
  const own=[...room.stormMines.values()].filter(m=>m.ownerId===ownerId);
  if(own.length>=STORM_MAX_MINES_PER_OWNER){
    const oldest=own[0];
    room.stormMines.delete(oldest.id);
    io.to(room.id).emit("message",{t:"stormMineRemoved",id:oldest.id,triggered:false,pos:oldest.pos} as S2C);
  }
  const mine={id:genId("stormmine"),ownerId,ownerTeam,pos,
    armedAt:now+STORM_MINE_ARM_MS,expiresAt:now+STORM_MINE_LIFETIME_MS};
  room.stormMines.set(mine.id,mine);
  io.to(room.id).emit("message",{t:"stormMinePlaced",id:mine.id,pos,expiresAt:mine.expiresAt} as S2C);
}
function tickStormMines(room:Room,now:number){
  const allowFriendly=room.config.friendlyFire===true||room.mode==="ffa"||room.mode==="gungame";
  for(const [id,mine] of room.stormMines){
    if(now>=mine.expiresAt){
      room.stormMines.delete(id);
      io.to(room.id).emit("message",{t:"stormMineRemoved",id,triggered:false,pos:mine.pos} as S2C);
      continue;
    }
    if(now<mine.armedAt)continue;
    const target=stormCandidates(room,mine.ownerId,mine.ownerTeam,now).find(c=>{
      const nextAt=room.stormMineCooldown.get(mine.ownerId+":"+c.id)??0;
      return nextAt<=now&&stormMineInReach(mine.pos,c.pos)&&
        hasLineOfSight(room,mine.pos,stormTargetPoint(c));
    });
    if(!target)continue;
    room.stormMines.delete(id); // consumed once and never ticks damage again
    room.stormMineCooldown.set(mine.ownerId+":"+target.id,now+STORM_MINE_TARGET_COOLDOWN_MS);
    io.to(room.id).emit("message",{t:"stormMineRemoved",id,triggered:true,pos:mine.pos} as S2C);
    const victim=allCombatants(room).find(c=>c.id===target.id);
    if(!victim?.alive)continue;
    io.to(room.id).emit("message",{t:"wonderBeam",from:mine.pos,
      to:stormTargetPoint(target),kind:"storm"} as S2C);
    applyDamage(room,mine.ownerId,victim,STORM_MINE_DAMAGE,false,"wonder_stormweaver");
    if(room.ended)return;
    serverStormChain(room,mine.ownerId,mine.ownerTeam,victim,STORM_MINE_DAMAGE,
      STORM_MINE_JUMPS,now);
    if(room.ended)return;
  }
}
function tickClusters(room:Room,now:number){
 for(const [id,volley] of room.clusterVolleys){
  volley.shots.forEach((shot,index)=>{
   if(volley.done.has(index)||now<volley.launchedAt+shot.delayMs+shot.path.flightMs)return;
   volley.done.add(index);
   const point=shot.path.impact;
   destroyTurretsNear(room,point,shot.radius);
   for(const target of allCombatants(room)){
    if(room.ended||!target.alive||target.id===volley.ownerId)continue;
    if(room.config.friendlyFire===false&&target.team===volley.ownerTeam&&room.mode!=="ffa"&&room.mode!=="gungame")continue;
    const center:Vec3=[target.pos[0],target.pos[1]+.85,target.pos[2]];
    const dmg=Math.min(clusterDamage(Math.hypot(center[0]-point[0],center[1]-point[1],center[2]-point[2]),shot),CLUSTER_MAX_DAMAGE-(volley.dealt.get(target.id)??0));
    if(dmg<=0||!hasLineOfSight(room,point,center))continue;
    volley.dealt.set(target.id,(volley.dealt.get(target.id)??0)+dmg);
    applyDamage(room,volley.ownerId,target,dmg,false,CLUSTER_ID);
   }
  });
  if(now>=volley.launchedAt+clusterLifetime(volley.shots))room.clusterVolleys.delete(id);
 }
}
function tickSpecialEffects(room: Room, now: number) {
 tickClusters(room,now);
 tickWonderFields(room,now);
 tickStormMines(room,now);
  tickBulletSpitters(room, now);
  if (room.ended) return;
  tickGravityWells(room, now);
  for (const [id, bomb] of room.deathBombs) {
    if (now < bomb.explodesAt) continue;
    room.deathBombs.delete(id); // disarm first: no repeat detonations
    io.to(room.id).emit("message", { t: "deathBombExplode", id, pos: bomb.pos } as S2C);
    destroyTurretsNear(room, bomb.pos, 5);
    for (const target of allCombatants(room)) {
      if (!target.alive || !explonandoCanHit(room.mode, target.team, bomb.ownerTeam, target.id, bomb.ownerId)) continue;
      const distance = Math.hypot(target.pos[0]-bomb.pos[0], target.pos[2]-bomb.pos[2]);
      const damage = explonandoDamage(distance);
      if (!damage) continue;
      if (!hasLineOfSight(room, [bomb.pos[0], bomb.pos[1]+.5, bomb.pos[2]], [target.pos[0], target.pos[1]+1, target.pos[2]])) continue;
      applyDamage(room, bomb.ownerId, target, damage, false, "perk_explonando");
    }
    if (room.ended) return;
  }
  for (const [id,mine] of room.equipmentMines) {
    if (now > mine.expiresAt) {
      room.equipmentMines.delete(id);
      io.to(room.id).emit("message",{t:"equipmentMineRemoved",mineId:id} as S2C);
      continue;
    }
    const owner = room.players.get(mine.ownerId) ?? room.bots.get(mine.ownerId);
    if (!owner) {
      room.equipmentMines.delete(id);
      io.to(room.id).emit("message",{t:"equipmentMineRemoved",mineId:id} as S2C);
      continue;
    }
    const enemies = allCombatants(room).filter(c => c.alive && c.id !== mine.ownerId &&
      (room.mode === "ffa" || c.team !== owner.team) &&
      !(c.spawnProtectedUntil && c.spawnProtectedUntil > now));
    if (!enemies.some(c => Math.hypot(c.pos[0]-mine.pos[0],c.pos[2]-mine.pos[2]) < 2.5)) continue;
    room.equipmentMines.delete(id); // exactly one activation
    io.to(room.id).emit("message",{t:"equipmentFx",equipmentId:"mine",position:mine.pos,ownerId:mine.ownerId,mineId:id,mineState:"triggered"} as S2C);
    destroyTurretsNear(room, mine.pos, 3.3);
    for (const c of enemies) {
      const dist = Math.hypot(c.pos[0]-mine.pos[0],c.pos[2]-mine.pos[2]);
      if (dist > 3.3) continue;
      if (!hasLineOfSight(room,[mine.pos[0],mine.pos[1]+.2,mine.pos[2]],[c.pos[0],c.pos[1]+1,c.pos[2]])) continue;
      applyDamage(room,mine.ownerId,c,Math.max(12,100*(1-dist/3.3)),false,"equipment_mine");
    }
    if (room.ended) return;
  }
  for (const [id, drop] of room.droppedBolts) {
    if (now >= drop.expiresAt) {
      room.droppedBolts.delete(id);
      io.to(room.id).emit("message", { t: "boltRemoved", id } as S2C);
    }
  }
  for (const [id, dot] of room.poison) {
    const victim = allCombatants(room).find(c => c.id === id);
    if (!victim?.alive || now >= dot.expiresAt) { room.poison.delete(id); continue; }
    if (now >= dot.tickAt) {
      dot.tickAt = now + 500;
      applyDamage(room, dot.attackerId, victim, dot.damagePerTick ?? 2, false, dot.weaponId);
      if (room.ended) break;
    }
  }
}

function applyDamage(room: Room, attackerId: string, victim: PlayerNet, damage: number, head: boolean, weaponId: string, shieldHit=false) {
  if (!victim.alive) return;
  const fellInLava = attackerId === "world" && weaponId === LAVA_DEATH_SOURCE;
  // Spawn protection: skip damage entirely if the victim is within their grace period.
  // This prevents bots from killing a freshly-spawned player before they can react.
  if (room.mode === "survival" && room.downed.has(victim.id)) return;
  if (!fellInLava && victim.spawnProtectedUntil && victim.spawnProtectedUntil > Date.now()) return;
  if(shieldHit){
    const state=hitRiotShield(victim.riotShieldHp??RIOT_SHIELD_HP,victim.riotShieldReadyAt??0,damage,Date.now());
    victim.riotShieldHp=state.hp;victim.riotShieldReadyAt=state.readyAt;
    if(!state.hp)victim.riotShieldRaised=false;
    return; // shield impact absorbs shot, no health hit event
  }
  let dmg = damage;
  const attacker = room.players.get(attackerId) ?? room.bots.get(attackerId);
  // Survival: bots hit harder as waves progress, BUT base damage is reduced
  // by 35% for player survivability (Round 18-b balance fix).
  if (room.mode === "survival" && attacker?.isBot) {
    const mutators=survivalWaveMutators(room.config.survivalTier ?? "default",room.wave);
    dmg *= 0.65 * survivalWaveDamageMul(room.wave) * mutators.damageMul;
  }
  // Boss armor: prevents burst weapons from trivializing boss encounters.
  if (fellInLava) dmg = victim.health;
  else if (room.mode === "survival" && room.bots.get(victim.id)?.ai.boss) dmg *= 0.80;
  if(room.mode==="survival"&&!fellInLava){
    if(attacker&&!attacker.isBot&&victim.isBot){
      const now=Date.now();
      dmg*=survivalOutgoingMultiplier(room.survivalRanks.get(attackerId)??{}, {
        headshot:head,distance:Math.hypot(attacker.pos[0]-victim.pos[0],attacker.pos[2]-victim.pos[2]),
        boss:!!room.bots.get(victim.id)?.ai.boss,aiming:room.adsStartedAt.has(attackerId),
        healthFraction:attacker.health/MAX_HEALTH,
        sinceKillMs:now-(room.survivalLastKillAt.get(attackerId)??-Infinity),
        sinceHeadshotKillMs:now-(room.survivalLastHeadshotKillAt.get(attackerId)??-Infinity),
      });
    } else if(attacker?.isBot&&!victim.isBot){
      dmg*=survivalIncomingMultiplier(room.survivalRanks.get(victim.id)??{}, {
        healthFraction:victim.health/MAX_HEALTH,
        explosive:!!weaponById(weaponId).explosive,
        sprinting:room.sprintState.get(victim.id)??false,
      });
    }
  }
  room.lastDamagedAt.set(victim.id, Date.now());
  const hitSource=room.players.get(attackerId)??room.bots.get(attackerId);
  const hurtBot=room.bots.get(victim.id);
  if(hurtBot?.ai && hitSource?.alive && hitSource.id!==victim.id &&
      (room.mode==="ffa"||room.mode==="gungame"||hitSource.team!==victim.team)){
    hurtBot.ai.lastAlert=botRememberHit(hitSource.id,hitSource.pos,Date.now());
    hurtBot.ai.nextDecisionAt=0;
  }
  // Only count actual opponent damage. Contributions are cleared at death, so
  // an assist cannot leak into the next respawn of the same victim.
  if (attacker && attacker.id !== victim.id && attacker.team !== victim.team &&
    (room.mode==="tdm"||room.mode==="killconfirmed"||room.mode==="survival")) {
    const contributions=room.damageContributions.get(victim.id)??new Map<string,Contribution>();
    const previous=contributions.get(attackerId);
    contributions.set(attackerId,{
      damage:(previous && Date.now()-previous.at<10000 ? previous.damage:0)+Math.min(dmg,Math.max(0,victim.health)),
      at:Date.now(),team:attacker.team,
    });
    room.damageContributions.set(victim.id,contributions);
  }
  victim.health -= dmg;
  if(weaponId === "wonder_hellfire" && dmg > 0) room.burning.set(victim.id,Date.now()+1100);
  const killed = victim.health <= 0;
  // For rewards scaling: attach the victim's difficulty to the hit event when
  // it's a kill. Non-killing hits don't need it (only kills earn rewards).
  const killDiff: KillDifficulty | undefined = killed ? victimKillDifficulty(victim) : undefined;
  const defendedFlag = killed && room.mode === "ctf" && attacker &&
    (attacker.team === "red" || attacker.team === "blue") && victim.team !== attacker.team &&
    isFlagDefenseKill(flagAtHome(room.flags[attacker.team]), victim.pos, ctfHome(attacker.team, room.map.id));
  io.to(room.id).emit("message", {
    t: "hit", attackerId, victimId: victim.id, damage: Math.round(dmg),
    headshot: head, killed, weaponId,
    ...(killDiff ? { botDifficulty: killDiff } : {}),
    ...(defendedFlag ? { defendedFlag: true } : {}),
  } as S2C);
  if (killed) {
    const contributions=room.damageContributions.get(victim.id);
    if (contributions && attacker) for(const id of countEligibleAssists(contributions,attackerId,attacker.team,Date.now()))
      { room.assists.set(id,(room.assists.get(id)??0)+1);
        // In objective modes, score is exclusively captures (CTF) or tags
        // (Kill Confirmed). Assists remain stats, never counterfeit objective
        // points in the HUD / standings.
        if (room.mode !== "ctf" && room.mode !== "killconfirmed")
          room.scores.set(id,(room.scores.get(id)??0)+1); }
    room.damageContributions.delete(victim.id);
    // Every elimination (including the Bulwark P-9) reduces an active
    // shield-rebuild clock. Do not accelerate from deaths with no attacker.
    if(attacker && weaponId!=="perk_explonando" && (attacker.riotShieldReadyAt??0)>0){
      const next=accelerateRiotShield(attacker.riotShieldHp??RIOT_SHIELD_HP,
        attacker.riotShieldReadyAt??0,Date.now());
      attacker.riotShieldHp=next.hp;attacker.riotShieldReadyAt=next.readyAt;
    }
    if (attacker && weaponId !== "perk_explonando" && !weaponById(weaponId).wonder) {
      // Only ordinary kills reduce Wonder recharge; its own blast and poison cannot.
      for (const [key, state] of room.wonderCharges) {
        if (!key.startsWith(attackerId + ":")) continue;
        const wid = key.slice(attackerId.length + 1);
        const rules = weaponById(wid).wonder;
        if (rules) room.wonderCharges.set(key, accelerateWonderCharge(state, rules, Date.now()));
      }
    }
    victim.alive = false;
    victim.deaths += 1;
    if(room.orbitalHolders.delete(victim.id)){
      if(victim.weaponId===ORBITAL_REAPER_ID){
        const deadBot=room.bots.get(victim.id);
        victim.weaponId=deadBot?.loadout.weaponId??room.loadouts.get(victim.id)?.meleeWeaponId??"knife_tactical";
        if(deadBot)deadBot.ai.ammoInMag=weaponById(victim.weaponId).stats.magSize;
      }
      io.to(room.id).emit("message",{t:"orbitalReward",playerId:victim.id,active:false} as S2C);
    }
    if(attacker && attacker.id!==victim.id && (room.mode==="ffa"||room.mode==="gungame"||attacker.team!==victim.team) && reactorObjective(room.map)){
      // Either the attacker OR the defeated combatant can be in the central
      // charge zone; the server validates opponent ownership before counting.
      const charge=orbitalRecordKill(room.orbitalCharge,victim.pos,room.map,attacker.pos);
      if(charge!==room.orbitalCharge){
        room.orbitalCharge=charge;
        io.to(room.id).emit("message",{t:"orbitalAbsorb",pos:[...victim.pos] as Vec3} as S2C);
        io.to(room.id).emit("message",{t:"orbitalReactor",charge} as S2C);
      }
    }
    if (room.mode === "ctf") dropCarriedFlag(room, victim.id, [...victim.pos] as Vec3);
    // Server places exactly one death charge on a legitimate elimination.
    // The victim never chooses the position/timing; fuse survives respawn.
    if (!victim.isBot && room.loadouts.get(victim.id)?.perkId === "explonando" && !room.ended) {
      const id = genId("explonando");
      const pos: Vec3 = [...victim.pos] as Vec3;
      const explodesAt = Date.now() + EXPLO_FUSE_MS;
      room.deathBombs.set(id, { ownerId: victim.id, ownerTeam: victim.team, pos, explodesAt });
      io.to(room.id).emit("message", { t: "deathBomb", id, ownerId: victim.id, pos, explodesAt } as S2C);
    }
    const killerPerk = attacker ? room.loadouts.get(attacker.id)?.perkId : null;
    if (attacker && !attacker.isBot && shouldCreateScavengerDrop(attacker.id, victim.id, killerPerk)) {
      // Owner-only pack: never share the payload with other players' sockets.
      const id = genId("ammo");
      const pos: Vec3 = [victim.pos[0], victim.pos[1] + 0.16, victim.pos[2]];
      const expiresAt = Date.now() + SCAVENGER_DROP_LIFETIME_MS;
      room.scavengerDrops.set(id, { id, pos, expiresAt, ownerTeam: victim.team, ownerId: attacker.id });
      io.to(attacker.id).emit("message", { t: "scavengerDrop", id, pos, expiresAt } as S2C);
    }
    if (attacker) {
      if(room.mode==="survival"&&!attacker.isBot&&victim.isBot){
        const now=Date.now();
        const reward=survivalKillReward(room.survivalRanks.get(attackerId)??{},head);
        attacker.health=Math.min(MAX_HEALTH,attacker.health+reward.health);
        room.survivalLastKillAt.set(attackerId,now);
        if(head)room.survivalLastHeadshotKillAt.set(attackerId,now);
      }
      attacker.kills += 1;
      // Kill Confirmed awards score only when the dropped tag is collected.
      if (room.mode !== "killconfirmed" && room.mode !== "ctf") room.scores.set(attackerId, (room.scores.get(attackerId) ?? 0) + 1);
      if (room.mode === "tdm") {
        room.teamScores[attacker.team as "red" | "blue"] += 1;
      }
    }
    if (room.mode === "killconfirmed" && attacker && attacker.team !== victim.team && (victim.team === "red" || victim.team === "blue")) {
      const tag: KillConfirmedTag = { id: genId("tag"), victimId: victim.id, victimTeam: victim.team, pos: [...victim.pos] as Vec3, expiresAt: Date.now() + room.config.tagLifetimeMs };
      room.tags.set(tag.id, tag);
    }
    const entry: KillFeedEntry = {
      killer: attacker?.name ?? (fellInLava ? "Environment" : "World"), victim: victim.name, weapon: weaponId, headshot: head,
      killerTeam: attacker?.team ?? "ffa", victimTeam: victim.team,
      botDifficulty: killDiff,
      attachments:(()=>{
        const kit=room.loadouts.get(attackerId);
        const sel=kit && weaponId===kit.weaponId ? kit.attachments
          :kit && weaponId===kit.secondaryWeaponId ? kit.secondaryAttachments
          :kit && weaponId===kit.meleeWeaponId ? kit.meleeAttachments : undefined;
        return sel?Object.values(sel).filter((x):x is string=>!!x):[];
      })(),
    };
    io.to(room.id).emit("message", { t: "kill", entry } as S2C);
    if (room.mode === "survival") {
      if (!victim.isBot) {
        // Solo runs end on death rather than showing a co-op rescue state.
        const hasRescuer=[...room.players.values()].some(p=>
          p.id!==victim.id&&!p.isBot&&p.alive&&!room.downed.has(p.id));
        if(!hasRescuer){endMatch(room);return;}
        room.downed.add(victim.id);
        // A fallen player stays eliminated until the partner clears the wave.
        if (fellInLava) return;
        // Downed players can only shoot the secondary, cannot move or
        // take further damage; every-operative-downed ends the match.
        victim.health = 1;
        victim.alive = true;
        victim.weaponId = room.loadouts.get(victim.id)?.secondaryWeaponId ?? "pistol_side";
        victim.spawnProtectedUntil = 0;
        io.to(room.id).emit("message", { t: "survivalDowned", playerId: victim.id, weaponId: victim.weaponId } as S2C);
        if (![...room.players.values()].some(p => p.alive && !room.downed.has(p.id))) endMatch(room);
      }
    } else if (room.mode === "gungame") {
      // Gun Game: the attacker advances their tier on each kill. If they were
      // already on the FINAL weapon (the last melee tier), this kill wins the match.
      if (attacker && weaponId !== "perk_explonando") {
        const idx = room.gungameProgress.get(attackerId) ?? 0;
        const last = room.gungameWeapons.length - 1;
        if (canCompleteGunGame(idx, room.gungameWeapons, attacker.weaponId)) {
          // Only a validated final-tier melee kill may finish Gun Game.
          endMatch(room, "gungame_victory");
        } else if (idx < last) {
          const newIdx = Math.min(last, idx + 1);
          room.gungameProgress.set(attackerId, newIdx);
          const newWeaponId = room.gungameWeapons[newIdx];
          attacker.weaponId = newWeaponId;
          if(isThrowingKnife(newWeaponId)){
            room.throwingKnives.set(attackerId,fullThrowingKnives());
            syncThrowingKnifeAmmo(room,attacker,Date.now());
          }
          if (attacker.isBot && room.bots.has(attacker.id)) { const botAI = room.bots.get(attacker.id)!.ai; botAI.ammoInMag = weaponById(newWeaponId).stats.magSize; botAI.reloadingUntil = 0; }
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

/** A weapon/perk swap is committed at spawn, never while the player is alive. */
function applyQueuedLoadout(room: Room, p: PlayerNet) {
  const queued = room.pendingLoadouts.get(p.id);
  if (!queued || p.isBot) return;
  room.pendingLoadouts.delete(p.id);
  room.loadouts.set(p.id, queued);
  p.weaponId = queued.weaponId;
  p.weaponSkinId = queued.weaponSkinId;
  p.playerSkinId = queued.playerSkinId;
  p.charmId = queued.primaryCharmId ?? "none";
  p.nameplateId = queued.nameplateId ?? "standard";
  p.riotShieldRaised = false;
  room.smartTags.delete(p.id);
  // Every newly applied kit drains its Wonder to prevent cooldown bypasses.
  for(const key of room.wonderCharges.keys())
    if(key.startsWith(p.id+":"))room.wonderCharges.delete(key);
  const selected=WEAPONS.find(w=>w.id===queued.wonderWeaponId);
  if(queued.perkId==="wonder_weapon" && selected?.wonder && !selected.disabled){
    room.wonderCharges.set(p.id+":"+selected.id,drainedWonderCharges(selected.wonder,Date.now()));
    if(selected.id===RIOT_SHIELD_ID){
      p.riotShieldHp=0;p.riotShieldReadyAt=Date.now()+RIOT_SHIELD_RECHARGE_MS;
    }
  }
}

/** Spawning never changes Wonder charges or their recharge deadlines.
 * A queued kit is drained independently by applyQueuedLoadout. */
function refillPlayerWonderAmmo(room: Room, p: PlayerNet) {
  room.hellfireUntil.delete(p.id);
}

function scheduleRespawn(room: Room, p: PlayerNet) {
  room.burstState.delete(p.id);
  room.poison.delete(p.id);
  room.specialHeat.delete(p.id);
  room.boltReadyAt.delete(p.id);
  room.boltCharges.delete(p.id);
  if (room.respawnTimers.has(p.id)) return;
  const delay = room.mode === "survival" ? SURVIVAL_RESPAWN_MS : RESPAWN_DELAY_MS;
  const timer = setTimeout(() => {
    const sp = pickSpawn(p.team, room);
    p.pos = sp;
    p.health=MAX_HEALTH;p.riotShieldRaised=false;
    const currentKit=room.loadouts.get(p.id);
    // Bulwark is also a Wonder: keep broken-shield cooldown across death.
    if(currentKit?.perkId!=="wonder_weapon" || currentKit.wonderWeaponId!==RIOT_SHIELD_ID){
      p.riotShieldHp=RIOT_SHIELD_HP;p.riotShieldReadyAt=0;
    }
    room.lastDamagedAt.delete(p.id);
    p.alive = true;
    applyQueuedLoadout(room, p);
    refillPlayerWonderAmmo(room, p);
    // Death restores normal-mode knives, but never shortcuts Gun Game's recharge.
    if(room.mode!=="gungame"){
      room.throwingKnives.set(p.id,fullThrowingKnives());
      syncThrowingKnifeAmmo(room,p,Date.now());
    }
    // Fresh life: no target memory may survive the bot's death.
    const revivedBot=room.bots.get(p.id);
    if(revivedBot){revivedBot.ai.lastSighting=null;revivedBot.ai.lastAlert=null;revivedBot.ai.investigationLookAt=null;revivedBot.ai.targetId=null;room.equipmentBotNextAt.set(p.id,Date.now()+3000+Math.random()*2000);}
    room.orbitalHolders.delete(p.id);
    const reserve = equipmentById(room.loadouts.get(p.id)?.equipmentId).charges;
    room.equipmentCharges.set(p.id,reserve);
    if (!p.isBot) io.to(p.id).emit("message",{t:"equipmentState",remaining:reserve} as S2C);
    // Spawn protection: 2.5s grace period after respawn so the player can orient
    // before bots start shooting them. Bots also skip spawn-protected targets.
    p.spawnProtectedUntil = Date.now() + 2500;
    room.respawnTimers.delete(p.id);
    io.to(room.id).emit("message", { t: "respawn", playerId: p.id, pos: sp, health: MAX_HEALTH } as S2C);
  }, delay) as unknown as number;
  room.respawnTimers.set(p.id, timer);
}

// Collect Kill Confirmed dogtags within 2.25m of a living player or bot.
// Server alone decides captures, so two players can never score the same tag.
function tickKillConfirmedTags(room: Room, now: number) {
  for (const [id, tag] of room.tags) {
    if (tag.expiresAt <= now) { room.tags.delete(id); continue; }
    for (const player of allCombatants(room)) {
      if (!player.alive) continue;
      const d = Math.hypot(player.pos[0] - tag.pos[0], player.pos[2] - tag.pos[2]);
      const heightDiff = Math.abs(player.pos[1] - tag.pos[1]);
      if (d > KC_PICKUP_RADIUS || heightDiff > 2.6) continue;
      room.tags.delete(id);
      const action = player.team === tag.victimTeam ? "deny" : "confirm";
      const totals = action === "confirm" ? room.tagConfirmations : room.tagDenials;
      totals.set(player.id, (totals.get(player.id) ?? 0) + 1);
      const earnsPoint = killConfirmedPickupPoints(action, room.config.denialScoreEnabled) === 1;
      if (earnsPoint) {
        room.scores.set(player.id, (room.scores.get(player.id) ?? 0) + 1);
        room.teamScores[player.team as "red" | "blue"] += 1;
      }
      io.to(room.id).emit("message", { t: "tagCollected", tagId: id, collectorId: player.id, action } as S2C);
      if (earnsPoint) checkWin(room);
      break;
    }
    if (room.ended) return;
  }
}

// A drop is not a capture. Notify everyone at the authoritative mutation site,
// including disconnects and bot deaths, so clients never have to guess from snapshots.
function dropCarriedFlag(room: Room, carrierId: string, pos: Vec3): void {
  const flag = ctfDrop(room.flags, carrierId, pos);
  if (flag) io.to(room.id).emit("message",
    { t: "ctfEvent", action: "drop", flag, playerId: carrierId } as S2C);
}

// Flag contacts are resolved once by the server on its 20 Hz simulation tick.
function tickCaptureTheFlag(room: Room, now = Date.now()): void {
  for (const flag of ctfReturnExpired(room.flags, now, room.config.ctfFlagResetMs, room.map)) {
    io.to(room.id).emit("message",
      { t: "ctfEvent", action: "auto_return", flag, playerId: "server" } as S2C);
  }
  for (const player of allCombatants(room)) {
    if (!player.alive || (player.team !== "red" && player.team !== "blue")) continue;
    const event = ctfTouch(room.flags, { id: player.id, team: player.team as FlagTeam, pos: player.pos },room.map);
    if (!event) continue;
    io.to(room.id).emit("message", {t:"ctfEvent",action:event.kind,flag:event.flag,playerId:player.id} as S2C);
    if (event.kind === "capture") {
      room.teamScores[player.team as FlagTeam]++;
      room.scores.set(player.id, (room.scores.get(player.id) ?? 0) + 1);
      if (room.overtime) { endMatch(room); return; }
      checkWin(room);
      if (room.ended) return;
    }
  }
}

function checkWin(room: Room) {
  if (room.ended) return;
  if (room.mode === "survival") return; // endless — game over handled on reinforcement depletion
  if (room.mode === "gungame") return; // ONLY the final melee-tier kill ends Gun Game (applyDamage).
  if (room.config.scoreLimit <= 0) return; // zero disables score target
  if (room.mode === "ffa") {
    for (const [, k] of room.scores) if (k >= room.config.scoreLimit) return endMatch(room);
  } else {
    if (room.teamScores.red >= room.config.scoreLimit || room.teamScores.blue >= room.config.scoreLimit) return endMatch(room);
  }
}

function endMatch(room: Room, reason: "other" | "gungame_victory" = "other") {
  // Prevent stale kill-count or timer handlers ending an active Gun Game.
  // A room with no humans may still be cleaned up normally.
  if (room.mode === "gungame" && room.players.size > 0 && reason !== "gungame_victory") return;
  if (room.ended) return;
  room.ended = true;
  room.state = "ended";
  if (room.tick) clearInterval(room.tick);
  room.tick = null;
  // No late respawn events while players watch the match-end sequence.
  for (const timer of room.respawnTimers.values()) {
    clearTimeout(timer as unknown as ReturnType<typeof setTimeout>);
  }
  room.respawnTimers.clear();
  const standings = allCombatants(room).map((p) => ({
    id: p.id, name: p.name, team: p.team, kills: p.kills, deaths: p.deaths,
    assists: room.assists.get(p.id) ?? 0,
    score: room.mode === "survival" ? (p.isBot ? p.kills : room.wave) : (room.scores.get(p.id) ?? 0), isBot: p.isBot,
  })).sort((a, b) => b.score - a.score || b.kills - a.kills);
  let winnerTeam: string | null = null;
  if (room.mode === "tdm" || room.mode === "killconfirmed" || room.mode === "ctf") winnerTeam = room.teamScores.red > room.teamScores.blue ? "red" : room.teamScores.blue > room.teamScores.red ? "blue" : null;
  else if (room.mode === "survival") winnerTeam =
    room.config.survivalTier === "default" && survivalWavesCleared(room.wave,room.waveActive) >= 30 ? "blue" : null;
  else winnerTeam = standings[0] ? standings[0].team : null;
  // Decisive scores can end the server's 20Hz tick before its next snapshot.
  // Deliver one final authoritative state, then the verdict in socket order.
  io.to(room.id).emit("message", snapshot(room));
  io.to(room.id).emit("message", { t: "matchEnd", standings, winnerTeam,
    teamScores: { ...room.teamScores } } as S2C);
  // cleanup room after a delay
  setTimeout(() => {
    for (const t of room.respawnTimers.values()) clearTimeout(t as unknown as ReturnType<typeof setTimeout>);
    rooms.delete(room.id);
  }, 15000);
}

// ---- Run-only Survival upgrades. Offers are private and server-authoritative.
// Each player has their own build; neither upgrade picks nor ranks are capped.
function sendSurvivalOffer(room:Room, playerId:string) {
  const offer=room.survivalOffers.get(playerId);
  if(!offer)return;
  io.to(playerId).emit("message",{t:"survivalUpgradeOffer",offer,
    ranks:{...(room.survivalRanks.get(playerId)??{})}} as S2C);
}
function awardSurvivalUpgrade(room:Room,playerId:string,id:SurvivalUpgradeId) {
  const offer=room.survivalOffers.get(playerId);
  if(!offer||!offer.choices.includes(id))return false;
  const ranks=chooseSurvivalUpgrade(room.survivalRanks.get(playerId)??{},id);
  room.survivalRanks.set(playerId,ranks);
  room.survivalOffers.delete(playerId);
  io.to(playerId).emit("message",{t:"survivalUpgradeChosen",upgradeId:id,ranks} as S2C);
  return true;
}
function offerSurvivalUpgrades(room:Room) {
  for(const player of room.players.values()) {
    const ranks=room.survivalRanks.get(player.id)??{};
    room.survivalRanks.set(player.id,ranks);
    const offer:SurvivalUpgradeOffer={wave:room.wave,
      choices:generateSurvivalUpgradeChoices(ranks),
      rerollsRemaining:room.survivalRerolls.get(player.id)??1};
    room.survivalOffers.set(player.id,offer);
    sendSurvivalOffer(room,player.id);
  }
}
// ---- Survival wave spawning ----
// Survival mode tier fully determines bot aim and wave modifiers.

function startSurvivalWave(room: Room) {
  // If a player was AFK during the break, award one of their offered picks.
  for(const [playerId,offer] of room.survivalOffers)
    awardSurvivalUpgrade(room,playerId,offer.choices[0]);
  for(const player of room.players.values()) {
    if(player.alive&&!room.downed.has(player.id))player.health=Math.min(MAX_HEALTH,
      player.health+survivalWaveHealing(room.survivalRanks.get(player.id)??{}));
  }
  room.wave += 1;
  room.waveActive = true;
  // cleanup any leftover dead bots from the previous wave
  for (const [id, b] of room.bots) {
    if (!b.alive) room.bots.delete(id);
  }
  const mutators=survivalWaveMutators(room.config.survivalTier ?? "default",room.wave);
  const baseCount=survivalEnemyCount(room.wave, room.players.size, survivalWaveBotCount);
  const count = Math.min(40,Math.ceil(baseCount*mutators.spawnMul))+(mutators.boss ? 1 : 0);
  const hpMul = survivalWaveHealthMul(room.wave)*mutators.healthMul;
  // Match archetypes to any eligible standard weapon, not a legacy fixed list.
  const pool = BOT_ELIGIBLE_WEAPONS.map(w=>w.id);
  const skinRotation = Math.floor(Math.random()*BOT_OPERATIVE_SKINS.length);
  const waveDiff = survivalBotDifficulty(room.config.survivalTier ?? "default",room.wave);
  for (let n = 0; n < count; n++) {
    const id = genId("svbot");
    // ---- Round 18-b: spread out spawns ----
    // Use FFA spawn list (spread across the whole map) instead of red-team-only
    // spawns (one side only). This prevents all bots from swarming from one
    // direction.
    const sp = pickSpawn("ffa", room);
    const loadout = botLoadout();
    loadout.weaponId = pool[Math.floor(Math.random() * pool.length)];
    const boss = mutators.boss && n === count-1;
    loadout.playerSkinId = boss ? SURVIVAL_BOSS_SKIN_ID : botOperativeSkinId(n,skinRotation);
    if (boss) loadout.weaponId = "lmg_hv";
    const tacticalRole=botArchetypeForCategory(weaponById(loadout.weaponId).category);
    loadout.equipmentId=botTacticalForArchetype(tacticalRole,n);
    const ai = makeBotAI(sp, loadout.weaponId, waveDiff, 0,tacticalRole);
    ai.moveSpeed *= mutators.speedMul * (boss ? 1.3 : 1);
    ai.skill = Math.min(0.98,ai.skill + mutators.skillBoost);
    if (mutators.skillBoost > 0) ai.difficulty = "veteran";
    if (boss) ai.boss={phase:0,nextPhaseAt:Date.now()+5000,nextSkillAt:Date.now()+8500};
    ai.ammoInMag = weaponById(loadout.weaponId).stats.magSize;
    const bot: PlayerNet & { ai: BotAI; loadout: LoadoutWire } = {
      id, name: boss ? `BOSS · W${room.wave}` : `W${room.wave}·${n + 1}`, team: "red", isBot: true,
      pos: sp, yaw: 0, pitch: 0, health: Math.round(MAX_HEALTH * hpMul * (boss ? 6 : 1)), alive: true,
      bossMaxHealth:boss?Math.round(MAX_HEALTH*hpMul*6):undefined,
      weaponId: loadout.weaponId, weaponSkinId: "default", playerSkinId: loadout.playerSkinId,
    charmId:room.mode==="gungame"?"none":loadout.primaryCharmId??"none",nameplateId:loadout.nameplateId??"standard",
      kills: 0, deaths: 0, lastShotAt: 0,
      spawnProtectedUntil: 0,
      ai, loadout,
    };
    room.bots.set(id, bot);
    room.loadouts.set(id, loadout);
    room.equipmentBotNextAt.set(id,Date.now()+4000+Math.random()*2500);
  }
}

function recoverSurvivalPlayers(room: Room) {
  for (const playerId of room.downed) {
    const p = room.players.get(playerId);
    if (!p) continue;
    const pos = pickSpawn(p.team, room);
    p.pos = pos; p.health = MAX_HEALTH; p.alive = true;
    applyQueuedLoadout(room, p);
    p.weaponId = room.loadouts.get(p.id)?.weaponId ?? "rifle_ar";
    refillPlayerWonderAmmo(room, p);
    p.spawnProtectedUntil = 0;
    room.lastDamagedAt.delete(p.id);
    room.throwingKnives.set(p.id,fullThrowingKnives());
    syncThrowingKnifeAmmo(room,p,Date.now());
    io.to(room.id).emit("message", { t: "survivalRecovered", playerId: p.id, pos, health: MAX_HEALTH } as S2C);
  }
  room.downed.clear();
}

// ---- Bot AI -----------------------------------------------------------------
/** Authoritative map-object damage. Player shots cannot request a wall's new HP. */
function damageEnvironmentWall(room: Room, id: string, damage: number): void {
  const result=applyLinkedWallDamage(room.environmentWalls,id,damage);
  if(!result)return;
  if(result.hp<=0){
    if(room.map.id==="floodgate"&&floodgateDamageTarget(id)===FLOODGATE_CORE_ID&&
      room.floodgateBreachAt===null){
      room.floodgateBreachAt=room.environmentTime;
      // The hydraulic front will topple each pillar when it reaches it.
      // A destroyed wall still invalidates existing waypoints.
      for(const bot of room.bots.values()){bot.ai.routeWaypoint=null;bot.ai.nextRouteAt=0;}
    }
    // The wall disappears physically on the server in the same shot that
    // depleted the shared structural pool; a future ray cannot hit a ghost wall.
    for(const wallId of result.ids)breakEnvironmentWall(room.map,wallId);
  }
}

function tickEnvironment(room: Room, dt: number): void {
  const beforeTime = room.environmentTime;
  room.environmentTime += dt;
  if(room.map.id==="floodgate"){
    const age=room.floodgateBreachAt===null?null:room.environmentTime-room.floodgateBreachAt;
    if(setFloodgateFreightStage(room.map,age)){
      // Every falling/landing pillar changes the traversable geometry.
      for(const bot of room.bots.values()){bot.ai.routeWaypoint=null;bot.ai.nextRouteAt=0;}
    }
  }
  const now = Date.now();
  for (const o of room.map.environment ?? []) {
    if (o.type === "moving_platform") {
      const oldPos = environmentPosition(o, beforeTime);
      const newPos = environmentPosition(o, room.environmentTime);
      // Only bots are moved here. Human riding is client-predicted via the same curve.
      for (const b of room.bots.values()) {
        if (!b.alive) continue;
        const top = oldPos[1] + o.size[1];
        if (Math.abs(b.pos[1] - top) < 0.30 &&
            Math.abs(b.pos[0] - oldPos[0]) <= o.size[0] &&
            Math.abs(b.pos[2] - oldPos[2]) <= o.size[2]) {
          b.pos = [b.pos[0] + newPos[0] - oldPos[0], b.pos[1] + newPos[1] - oldPos[1], b.pos[2] + newPos[2] - oldPos[2]];
        }
      }
      moveEnvironmentCover(room.map, o, room.environmentTime);
      continue;
    }
    if (o.type === "jump_pad") {
      for (const bot of room.bots.values()) {
        if (!bot.alive || bot.ai.envJumpVelocityY !== undefined || !withinEnvironment(o, bot.pos)) continue;
        const key = `${bot.id}|${o.id}|jump`;
        if (now < (room.environmentCooldown.get(key) ?? 0)) continue;
        room.environmentCooldown.set(key, now + 900);
        bot.ai.envJumpVelocityY = o.launch[1];
        bot.ai.envLaunchX = o.launch[0];
        bot.ai.envLaunchZ = o.launch[2];
        bot.pos[1] += 0.12;
      }
      continue;
    }
    if (o.type === "lava") {
      for (const player of allCombatants(room)) {
        if (!player.alive || !withinLava(o, ...player.pos)) continue;
        applyDamage(room, "world", player, player.health, false, LAVA_DEATH_SOURCE);
        if (room.ended) return;
      }
      continue;
    }
    if (o.type !== "fire" && o.type !== "spikes") continue;
    // Rushing water drowns the timed steam vents permanently.
    if (room.floodgateBreachAt!==null&&o.type==="spikes"&&o.visual==="steam")continue;
    if (o.type === "spikes" && !spikesActive(o, room.environmentTime)) continue;
    for (const player of allCombatants(room)) {
      if (!player.alive || !withinEnvironment(o, player.pos)) continue;
      if (player.spawnProtectedUntil && player.spawnProtectedUntil > now) continue;
      const key = `${player.id}|${o.id}`;
      const interval = o.type === "fire" ? 250 : 900;
      if (now < (room.environmentCooldown.get(key) ?? 0)) continue;
      room.environmentCooldown.set(key, now + interval);
      applyDamage(room, "world", player, o.type === "fire" ? o.dps * interval / 1000 : o.damage, false, o.type === "fire" ? "env_fire" : "env_spikes");
      if (room.ended) return;
    }
  }
  // Dam breach is an actual environmental event, not a blue floor decal.
  // The hydraulic front strikes ground-level occupants once per 900ms; shallow
  // flood water then keeps pushing/slowing the northern lane for the match.
  if(room.map.id==="floodgate"&&room.floodgateBreachAt!==null){
    const age=room.environmentTime-room.floodgateBreachAt;
    for(const player of allCombatants(room)){
      if(!player.alive)continue;
      const water=floodgateWaterEffect(player.pos[0],player.pos[1],player.pos[2],age,room.map.cover);
      if(water.flooded&&player.isBot){
        // Bots are server simulated; clients predict the identical current for
        // human movement. Resolve solid cover after the current is applied.
        const displaced:[number,number,number]=[player.pos[0],player.pos[1],player.pos[2]+water.pushZ*dt];
        if(!botMoveBlocked(room,player.pos,displaced,player.pos[1]))
          player.pos=clampToArena(room,collideBots(room,displaced,displaced[1]));
      }
      if(!water.surge||(player.spawnProtectedUntil??0)>now)continue;
      const key=player.id+"|floodgate-surge";
      if(now<(room.environmentCooldown.get(key)??0))continue;
      room.environmentCooldown.set(key,now+900);
      applyDamage(room,"world",player,28,false,"env_floodgate_surge");
      if(room.ended)return;
    }
  }
}

function tickRoom(room: Room) {
  if (room.ended) return;
  // ---- Pre-match countdown: decrement FIRST for ALL modes (including survival) ----
  // Previously the survival branch returned early, so `preMatchCountdown` never
  // decremented for survival rooms — the client's "GET READY 5" overlay stuck
  // at 5 forever and gameplay never began. Now we decrement it up here (before
  // the mode-specific branches) so every mode's countdown ticks down uniformly.
  if (room.preMatchCountdown > 0) {
    room.preMatchCountdown -= 1 / 20;
    if (room.preMatchCountdown <= 0) {
      room.preMatchCountdown = 0;
      // Protection starts after the countdown, not during the lobby/countdown.
      const until = Date.now() + 2500;
      for (const p of allCombatants(room)) if (p.alive && (room.mode !== "survival" || !p.isBot)) p.spawnProtectedUntil = until;
    }
  }
  if (room.preMatchCountdown <= 0) {
    if(reactorObjective(room.map)&&room.orbitalCharge>=(reactorObjective(room.map)?.killsRequired??Infinity)){
      // Authoritative single pickup: first eligible combatant occupying the
      // deck wins. Equal-tick ties are resolved by proximity, not player type.
      const contenders=allCombatants(room).filter(p=>
        !room.orbitalHolders.has(p.id)&&
        orbitalCanClaim(room.orbitalCharge,p.pos,room.map,p.alive))
        .sort((a,b)=>objectiveDistance(room.map,a.pos)-objectiveDistance(room.map,b.pos)||
          a.id.localeCompare(b.id));
      const winner=contenders[0];
      if(winner){
        room.orbitalHolders.add(winner.id);
        room.orbitalCharge=0;
        const bot=room.bots.get(winner.id);
        if(bot){
          bot.weaponId=ORBITAL_REAPER_ID;
          bot.ai.ammoInMag=1;
          bot.ai.reloadingUntil=0;
          bot.ai.burstShotsLeft=0;
          bot.ai.nextDecisionAt=0;
        }
        io.to(room.id).emit("message",{t:"orbitalReactor",charge:0} as S2C);
        io.to(room.id).emit("message",{t:"orbitalReward",playerId:winner.id,active:true} as S2C);
      }
    }
    tickEnvironment(room, 1 / 20);
    if (!room.ended) {
      const gameNow = Date.now();
      tickSpecialEffects(room, gameNow);
      tickThrowingKnifeRecovery(room,gameNow);
      // Server-authoritative regen; never heal during an active damage window.
      for (const c of allCombatants(room)) {
        const ranks=room.mode==="survival"?room.survivalRanks.get(c.id)??{}:{};
        if (c.alive && !room.downed.has(c.id) && c.health < MAX_HEALTH && gameNow - (room.lastDamagedAt.get(c.id) ?? 0) > regenDelayMs(room.loadouts.get(c.id)?.perkId)*survivalRegenDelayMultiplier(ranks))
          c.health = Math.min(MAX_HEALTH, c.health + 26 / 20*survivalRegenRateMultiplier(ranks));
      }
    }
  }
  if (room.ended) return;
  // All modes (including endless Survival and Gun Game) advance the same
  // match clock once the pre-match countdown ends. Previously this lived
  // below the Survival early return, freezing its online HUD at 00:00.
  room.elapsedSeconds = advanceMatchElapsed(room.elapsedSeconds, 1 / 20, room.preMatchCountdown <= 0);
  if (room.mode === "survival") {
    if (room.downed.size > 0 && ![...room.players.values()].some(p => p.alive && !room.downed.has(p.id))) {
      endMatch(room);
      return;
    }
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
          if (room.config.survivalTier === "default" && room.wave >= 30) {
            endMatch(room);
            return;
          }
          room.prepLeft = survivalUpgradeDue(room.wave) ? SURVIVAL_UPGRADE_PREP_SEC : SURVIVAL_PREP_SEC;
          recoverSurvivalPlayers(room);
          // Boss waves are 10/20/...; upgrade picks are 4/9/14/...
          // Award rerolls at boss clear, not only when a pick is available.
          if(survivalWaveMutators(room.config.survivalTier??"default",room.wave).boss)
            for(const p of room.players.values())room.survivalRerolls.set(p.id,(room.survivalRerolls.get(p.id)??1)+1);
          if(survivalUpgradeDue(room.wave))offerSurvivalUpgrades(room);
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
    tickScavengerDrops(room, now);
    io.to(room.id).emit("message", snapshot(room));
    return;
  }
  // Round 20: Only tick the timer if there IS a time limit (timeLeft > 0).
  // timeLeft = 0 means "no limit" — the match runs until the kill target
  // is reached. Previously, a 0 timeLimit caused the match to end instantly.
  if (room.preMatchCountdown <= 0 && room.timeLeft > 0) {
    room.timeLeft -= 1 / 20;
    if (room.timeLeft <= 0) {
      room.timeLeft = 0;
      // Capture the Flag: a tied regulation score enters sudden-death
      // overtime with no clock. The next successful capture wins.
      if (room.mode === "ctf" && room.teamScores.red === room.teamScores.blue) {
        room.overtime = true;
      } else {
        return endMatch(room);
      }
    }
  }
  const now = Date.now();
  tickThrowingKnifeRecovery(room,now);
  // Only run bot AI when the pre-match countdown is over.
  if (room.preMatchCountdown <= 0) {
    for (const bot of room.bots.values()) {
      if (!bot.alive) continue;
      updateBotAI(room, bot, now);
    }
  }
  tickScavengerDrops(room, now);
  if (room.mode === "killconfirmed" && room.preMatchCountdown <= 0) {
    tickKillConfirmedTags(room, now);
    if (room.ended) return;
  }
  if (room.mode === "ctf" && room.preMatchCountdown <= 0) {
    tickCaptureTheFlag(room, now);
    if (room.ended) return;
  }
  // broadcast ~ every tick (20Hz). Could throttle to 15Hz to save bandwidth but fine.
  io.to(room.id).emit("message", snapshot(room));
}

function tickScavengerDrops(room: Room, now: number): void {
  for (const [id, drop] of room.scavengerDrops) {
    if (now >= drop.expiresAt) {
      room.scavengerDrops.delete(id);
      io.to(drop.ownerId).emit("message", { t: "scavengerRemove", id } as S2C);
      continue;
    }
    for (const player of room.players.values()) {
      if (!canCollectScavengerDrop({
        now, expiresAt: drop.expiresAt,
        distance: Math.hypot(player.pos[0] - drop.pos[0], player.pos[2] - drop.pos[2]),
        alive: player.alive, perkId: room.loadouts.get(player.id)?.perkId,
        collectorId: player.id, ownerId: drop.ownerId,
        mode: room.mode, collectorTeam: player.team, defeatedTeam: drop.ownerTeam,
      })) continue;
      room.scavengerDrops.delete(id);
      io.to(drop.ownerId).emit("message", { t: "scavengerRemove", id } as S2C);
      io.to(player.id).emit("message", { t: "scavengerCollected", id } as S2C);
      break;
    }
  }
}

function nearestEnemy(room: Room, p: PlayerNet): PlayerNet | null {
  let best: PlayerNet | null = null;
  let bestD = Infinity;
  // Bots require LINE OF SIGHT to acquire a target (they're no longer omniscient).
  // If no visible enemy exists, the bot falls back to wandering. This makes bots
  // feel less psychic — you can break LoS to escape them.
  for (const e of allCombatants(room)) {
    if (e.id === p.id || !e.alive || (room.mode === "survival" && (e.isBot || room.downed.has(e.id)))) continue;
    if (e.team === p.team && room.mode !== "ffa" && room.mode !== "gungame") continue;
    const d = Math.hypot(e.pos[0] - p.pos[0], e.pos[2] - p.pos[2]);
    if (d >= bestD) continue;
    // Only acquire targets within the bot's engagement range AND with clear LoS.
    if (d > Math.min(botDetectionRange(room.bots.get(p.id)?.ai.difficulty??"normal",weaponById(p.weaponId).category),
      room.map.id==="whiteout_depot"?whiteoutVisibility(room.environmentTime,p.pos):Infinity)) continue;
    const fromY = p.pos[1] + PLAYER_HEIGHT / 2;
    const toY = e.pos[1] + PLAYER_HEIGHT / 2;
    if (!hasLineOfSight(room, [p.pos[0], fromY, p.pos[2]], [e.pos[0], toY, e.pos[2]])) continue;
    bestD = d;
    best = e;
  }
  return best;
}

/** Short-range static collision and elevated city goals are cached per MapDef.
 * Dynamic hazards use the original movement checks; Afterlight itself has no
 * moving cover and is safe to index once per room map. */
const cityCoverIndexes=new WeakMap<MapDef,CoverSpatialIndex>();
const cityHighGoals=new WeakMap<MapDef,HighGroundGoal[]>();
function cityIndex(room:Room):CoverSpatialIndex|undefined{
  if(room.map.biome!=="city"&&room.map.biome!=="city_day"&&room.map.biome!=="forest_warfare")return undefined;
  let index=cityCoverIndexes.get(room.map);
  if(!index){index=new CoverSpatialIndex(room.map.cover);cityCoverIndexes.set(room.map,index);}
  return index;
}
function cityCoverNear(room:Room,x:number,z:number,pad=3){
  return cityIndex(room)?.near(x,z,pad)??room.map.cover;
}
function cityCoverAlong(room:Room,a:Vec3,b:Vec3,pad=2){
  return cityIndex(room)?.along(a[0],a[2],b[0],b[2],pad)??room.map.cover;
}
function roomHighGroundGoals(room:Room):HighGroundGoal[]{
  if(room.map.biome!=="city"&&room.map.biome!=="city_day")return [];
  let goals=cityHighGoals.get(room.map);
  if(!goals){goals=cityHighGroundGoals(room.map.props??[]);cityHighGoals.set(room.map,goals);}
  return goals;
}

function updateBotAI(room: Room, bot: PlayerNet & { ai: BotAI; loadout: LoadoutWire }, now: number) {
  if ((room.equipmentStun.get(bot.id) ?? 0) > now) return;
  const ai = bot.ai;
  hearBotNoise(room,bot,now);
  const floodAge=room.map.id==="floodgate"&&room.floodgateBreachAt!==null
    ?room.environmentTime-room.floodgateBreachAt:null;
  if (ai.boss) {
    if (now >= ai.boss.nextPhaseAt) {
      ai.boss.phase=(ai.boss.phase+1)%3;
      bot.weaponId=["lmg_hv","shotgun_auto","rifle_heavy"][ai.boss.phase];
      bot.loadout.weaponId=bot.weaponId;
      ai.ammoInMag=weaponById(bot.weaponId).stats.magSize;
      ai.burstEndsAt=0;
      ai.burstShotsLeft=0;
      ai.boss.nextPhaseAt=now+5500;
    }
    // Shockwave: periodic boss skill separate from gunfire. Nearby operatives
    // take a capped hit, so cover, distance and mobility still matter.
    if (now >= ai.boss.nextSkillAt) {
      ai.boss.nextSkillAt=now+12500;
      for (const p of room.players.values()) {
        if (!p.alive) continue;
        const d=Math.hypot(p.pos[0]-bot.pos[0],p.pos[2]-bot.pos[2]);
        if (d < 11) applyDamage(room,bot.id,p,Math.round(28*(1-d/15)),false,bot.weaponId);
      }
    }
  }
  const weapon = weaponById(bot.weaponId);
  if(isThrowingKnife(bot.weaponId)){
    const state=tickThrowingKnives(room.throwingKnives.get(bot.id)??fullThrowingKnives(),now,room.mode==="gungame");
    room.throwingKnives.set(bot.id,state);
    bot.ai.ammoInMag=state.charges;
  }
  const eff = computeEffectiveStats(weapon, room.mode === "gungame" ? { sight:null, barrel:null, grip:null, magazine:null } : bot.loadout.attachments as Record<AttachmentSlot, string | null>);
  bot.pos = clampToArena(room, collideBots(room, bot.pos, bot.pos[1]));
  const rival = nearestEnemy(room,bot);
  const hostiles=[...room.turrets.entries()].filter(([,t])=>
    t.ownerId!==bot.id && turretCanAttack(room.mode,bot.team,t.ownerTeam,false) &&
    Math.hypot(bot.pos[0]-t.pos[0],bot.pos[2]-t.pos[2])<25 &&
    hasLineOfSight(room,[bot.pos[0],bot.pos[1]+1.45,bot.pos[2]],[t.pos[0],t.pos[1]+TURRET_MUZZLE_HEIGHT,t.pos[2]]))
    .sort((a,b)=>Math.hypot(a[1].pos[0]-bot.pos[0],a[1].pos[2]-bot.pos[2])-
      Math.hypot(b[1].pos[0]-bot.pos[0],b[1].pos[2]-bot.pos[2]));
  if(hostiles.length && (!rival || Math.hypot(rival.pos[0]-bot.pos[0],rival.pos[2]-bot.pos[2])>17) &&
    now>=ai.nextShotAt && now>ai.reloadingUntil && ai.ammoInMag>0) {
    const [id,t]=hostiles[0],origin:Vec3=[bot.pos[0],bot.pos[1]+1.45,bot.pos[2]];
    const diff:Vec3=[t.pos[0]-origin[0],t.pos[1]+TURRET_MUZZLE_HEIGHT-origin[1],t.pos[2]-origin[2]];
    const len=Math.hypot(...diff)||1;
    t.hp-=Math.max(5,eff.damage*.55);
    ai.ammoInMag--;ai.lastFiredAt=now;ai.nextShotAt=now+1000/Math.max(.5,eff.fireRate);
    io.to(room.id).emit("message",{t:"shotFx",origin,dir:[diff[0]/len,diff[1]/len,diff[2]/len],
      weaponId:bot.weaponId,attackerId:bot.id,skinId:bot.weaponSkinId,suppressed:false} as S2C);
    if(t.hp<=0){room.turrets.delete(id);io.to(room.id).emit("message",{t:"turretRemoved",id} as S2C);}
  }

  if (now > ai.nextDecisionAt) {
    ai.nextDecisionAt = now + botDecisionDelay(ai.difficulty, Math.random());
    const enemy = nearestEnemy(room, bot);
    // Memory stores only a genuinely visible enemy position, never live
    // coordinates through a wall.
    if(enemy)ai.lastSighting=botRememberSighting(enemy.id,enemy.pos,now);
    const remembered=ai.lastSighting;
    const rememberedEnemy=remembered
      ? room.players.get(remembered.targetId)??room.bots.get(remembered.targetId)
      : null;
    const alert=ai.lastAlert;
    const alertSource=alert?room.players.get(alert.sourceId)??room.bots.get(alert.sourceId):null;
    const audioInvestigation=!enemy?botAlertInvestigation(alert,bot.pos,now,ai.difficulty,
      ai.archetype,!!alertSource?.alive &&
      (room.mode==="ffa"||room.mode==="gungame"||alertSource.team!==bot.team)):null;
    if(alert&&!audioInvestigation&&!enemy)ai.lastAlert=null;
    if(enemy)ai.lastAlert=null;
    const investigation=!enemy ? botInvestigation(remembered,bot.pos,now,
      ai.difficulty,ai.archetype,!!rememberedEnemy?.alive &&
      (room.mode==="ffa"||room.mode==="gungame"||rememberedEnemy.team!==bot.team),
      bot.id) : null;
    if(remembered&&!investigation&&!enemy)ai.lastSighting=null;
    // In Kill Confirmed, bots pursue nearby tags (enemy confirms or friendly
    // denials), unless an opponent poses an immediate close-range threat.
    const nearestTag = room.mode === "killconfirmed"
      ? [...room.tags.values()].filter(tag => tag.expiresAt > Date.now())
          .sort((a, b) => Math.hypot(a.pos[0] - bot.pos[0], a.pos[2] - bot.pos[2]) -
            Math.hypot(b.pos[0] - bot.pos[0], b.pos[2] - bot.pos[2]))[0]
      : undefined;
    const tagDistance = nearestTag
      ? Math.hypot(nearestTag.pos[0] - bot.pos[0], nearestTag.pos[2] - bot.pos[2]) : Infinity;
    const threatDistance = enemy
      ? Math.hypot(enemy.pos[0] - bot.pos[0], enemy.pos[2] - bot.pos[2]) : Infinity;
    const pursueTag = !!nearestTag && tagDistance < 20 && threatDistance > 12;
    const roster=[...room.bots.values()].map(b=>({
      id:b.id,team:b.team,pos:b.pos,alive:b.alive,
      carryingFlag:room.flags.red.carrierId===b.id||room.flags.blue.carrierId===b.id,
      hasReward:room.orbitalHolders.has(b.id),
    }));
    const orbitalObjective=orbitalBotShouldContest(room.map,room.orbitalCharge,
      roster.find(c=>c.id===bot.id)!,roster,threatDistance)
      ?orbitalBotDeckGoal(bot.pos,bot.team,room.map):null;
    const ctfIntent = !orbitalObjective && room.mode === "ctf" && (bot.team === "red" || bot.team === "blue") && !ctfEngageThreat(threatDistance, bot.weaponId)
      ? ctfBotIntent(room.flags,bot.team,bot.id,bot.pos,bot.weaponId,
          [...room.bots.values()].filter(b=>b.team===bot.team).map(b=>b.id),
          Object.fromEntries(allCombatants(room).filter(p=>p.alive).map(p=>[p.id,p.pos])),room.map)
      : null;
    const ctfObjective = ctfIntent ? ctfStairWaypoint(ctfIntent.goal,bot.pos,room.map) : null;
    ai.ctfGuarding=!!ctfIntent && ctfIntent.role.startsWith("defend");
    // Critical objectives retain priority. Defenders do not abandon their base
    // to chase memories of distant attackers.
    const ctfCritical=ctfIntent?.role==="recover"||ctfIntent?.role==="escort";
    const base=bot.team==="red"||bot.team==="blue"?ctfBase(bot.team,room.map.id):null;
    // Prefer the freshest audible threat near the flag, but retain objective priority.
    const stimulus=audioInvestigation &&
      (!investigation || (ai.lastAlert?.at??0) >= (remembered?.seenAt??0))
      ? audioInvestigation : investigation;
    const nearBase=!!stimulus&&!!base&&Math.hypot(
      stimulus.lookAt[0]-base[0],stimulus.lookAt[2]-base[2])<34;
    const investigate=stimulus&&!pursueTag&&!orbitalObjective&&!ctfCritical &&
      (!ctfIntent||!ctfIntent.role.startsWith("defend")||nearBase) ? stimulus : null;
    ai.investigationLookAt=investigate?[...investigate.lookAt] as Vec3:null;
    const prevTarget = ai.targetId;
    ai.targetId = pursueTag || orbitalObjective || investigate || ctfObjective ? null : (enemy ? enemy.id : null);
    if (pursueTag && nearestTag) ai.wanderTarget = [...nearestTag.pos] as Vec3;
    else if (orbitalObjective) ai.wanderTarget = [...orbitalObjective] as Vec3;
    else if (investigate) ai.wanderTarget = [...investigate.goal] as Vec3;
    else if (ctfObjective) ai.wanderTarget = [...ctfObjective] as Vec3;
    // Record when a NEW target is acquired so we can enforce a human-like reaction delay.
    if (ai.targetId && ai.targetId !== prevTarget) {
      ai.acquiredTargetAt = now;
    }
    if(!ai.targetId){
      if(orbitalObjective||investigate||ctfObjective||(pursueTag&&nearestTag)){
        ai.highGroundPatrol=null;
        ai.wanderTarget=[...(orbitalObjective??investigate?.goal??ctfObjective??nearestTag!.pos)] as Vec3;
      }else{
        if(ai.highGroundPatrol&&(now>(ai.highGroundExpiresAt??0)||
          bot.pos[1]>=ai.highGroundPatrol.roof[1]-.8))ai.highGroundPatrol=null;
        if(!ai.highGroundPatrol && ai.wantsHighGround === undefined)
          ai.wantsHighGround=Math.random()<botArchetypeHighGroundChance(ai.archetype,botTactics(ai.difficulty).highGround);
        if(!ai.highGroundPatrol&&ai.wantsHighGround&&Math.random()<.55){
          const variation=bot.id.split("").reduce((n,ch)=>n+ch.charCodeAt(0),0);
          const goal=chooseCityHighGroundGoal(bot.pos,roomHighGroundGoals(room),variation);
          if(goal){
            ai.highGroundPatrol=goal;ai.highGroundExpiresAt=now+20000;
            ai.routeWaypoint=null;ai.nextRouteAt=0;
          }
        }
        if(ai.highGroundPatrol)ai.wanderTarget=[...ai.highGroundPatrol.roof] as Vec3;
        else if(botPatrolDistance(bot.pos,ai.wanderTarget)<2.5)
          ai.wanderTarget=chooseBotPatrolPoint(bot.team,room.mode,bot.pos,
            room.map.spawns.red,room.map.spawns.blue,room.map.spawns.ffa,Math.random,room.map.id);
      }
    }
    if (Math.random() < 0.4) ai.strafeDir = -ai.strafeDir;
  }

  const candidate = ai.targetId ? (room.players.get(ai.targetId) ?? room.bots.get(ai.targetId)) : null;
  // Never track/fight an opponent behind cover even before the next AI
  // decision. Only refreshed visible positions can enter the memory.
  const candidateDist=candidate?Math.hypot(candidate.pos[0]-bot.pos[0],candidate.pos[2]-bot.pos[2]):Infinity;
  const target=candidate?.alive &&
    candidateDist<=Math.min(botDetectionRange(ai.difficulty,weapon.category),
      room.map.id==="whiteout_depot"?whiteoutVisibility(room.environmentTime,bot.pos):Infinity) &&
    hasLineOfSight(room,[bot.pos[0],bot.pos[1]+PLAYER_HEIGHT/2,bot.pos[2]],
      [candidate.pos[0],candidate.pos[1]+PLAYER_HEIGHT/2,candidate.pos[2]])
      ? candidate : null;
  if(target)ai.lastSighting=botRememberSighting(target.id,target.pos,now);
  else if(ai.targetId){ai.targetId=null;ai.nextDecisionAt=0;}
  // Tactical use follows actual target acquisition and ballistics; normal gun
  // aim and movement remain in the existing AI pipeline below.
  if(target && !ai.boss && room.mode!=="gungame" &&
      now >= (room.equipmentBotNextAt.get(bot.id)??Infinity)){
    const def=equipmentById(bot.loadout.equipmentId);
    const dist=Math.hypot(target.pos[0]-bot.pos[0],target.pos[2]-bot.pos[2]);
    const friendlyNearTarget=allCombatants(room).some(p=>p.alive && p.id!==bot.id &&
      room.mode!=="ffa" && p.team===bot.team &&
      Math.hypot(p.pos[0]-target.pos[0],p.pos[2]-target.pos[2])<def.radius+1);
    const friendlyDanger=(def.id==="frag"||def.id==="flashbang")&&friendlyNearTarget;
    const allowed=botTacticalCanUse({equipmentId:def.id,distance:dist,visible:true,
      targetProtected:(target.spawnProtectedUntil??0)>now,friendlyAtImpact:friendlyDanger,
      charges:room.equipmentCharges.get(bot.id)??def.charges,now,
      readyAt:room.equipmentBotNextAt.get(bot.id)??now+1,
      targetAgeMs:now-ai.acquiredTargetAt,guarding:!!ai.ctfGuarding,
      lowHealth:bot.health<=45});
    room.equipmentBotNextAt.set(bot.id,now+650);
    if(allowed){
      const plan=planBotTacticalThrow(bot.pos,target.pos,def.id,room.map.cover,room.map.id);
      const allyAtLanding=plan && room.mode!=="ffa" && (def.id==="frag"||def.id==="flashbang") &&
        allCombatants(room).some(p=>p.alive && p.id!==bot.id && p.team===bot.team &&
          Math.hypot(p.pos[0]-plan.path.impact[0],p.pos[2]-plan.path.impact[2])<def.radius+1);
      if(plan&&!allyAtLanding){
        bot.yaw=plan.yaw;bot.pitch=plan.pitch;
        if(serverUseEquipment(room,bot.id)!==null){
          room.equipmentBotNextAt.set(bot.id,now+7300+Math.random()*3200);
          ai.nextShotAt=Math.max(ai.nextShotAt,now+560);
          bot.spawnProtectedUntil=0;
        }
      }
    }
  }
  // Shell-fed shotguns and bolt-action rifles refill one round at a time.
  if (weapon.stats.reloadStyle === "incremental" &&
      ai.reloadingUntil > 0 && now >= ai.reloadingUntil && ai.ammoInMag < eff.magSize) {
    ai.ammoInMag++;
    const stepMs = Math.max(300, (weapon.stats.reloadPerRound ?? eff.reloadTime / eff.magSize) *
      eff.reloadTime / Math.max(0.01, weapon.stats.reloadTime) * 1000);
    ai.reloadingUntil = ai.ammoInMag >= eff.magSize || ai.targetId ? 0 : now + stepMs;
  }
  if (target && target.alive) {
    const dx = target.pos[0] - bot.pos[0];
    const dz = target.pos[2] - bot.pos[2];
    const dist = Math.hypot(dx, dz);
    const dy = (target.pos[1] + 1.5) - (bot.pos[1] + 1.5);
    const desiredYaw = Math.atan2(dx, dz);
    // Skill-scaled turn speed + slow-varying aim error (mirrors the offline engine).
    const turnLerp = botTurnLerp(ai.difficulty, ai.skill);
    if (now > ai.nextAimErrorAt) {
      ai.nextAimErrorAt = now + 350 + Math.random() * 400;
      const errMag = ((1 - ai.skill) * 0.18 + 0.02) * botAimDriftMultiplier(ai.difficulty);
      ai.aimErrorYaw = (Math.random() - 0.5) * errMag * 2;
      ai.aimErrorPitch = (Math.random() - 0.5) * errMag * 2;
    }
    bot.yaw = lerpAngle(bot.yaw, desiredYaw + ai.aimErrorYaw, turnLerp);
    bot.pitch = lerpAngle(bot.pitch, Math.atan2(dy, Math.hypot(dx, dz)) + ai.aimErrorPitch, turnLerp);

    // Spray drift accumulation/decay
    const sinceFired = now - ai.lastFiredAt;
    if (sinceFired > 200) {
      ai.sprayDriftYaw *= 0.92;
      ai.sprayDriftPitch *= 0.92;
    }

    const clearShot=hasLineOfSight(room,
      [bot.pos[0],bot.pos[1]+1.45,bot.pos[2]],
      [target.pos[0],target.pos[1]+1.45,target.pos[2]]);
    const reactionReady=now-ai.acquiredTargetAt>=botReactionDelay(ai.difficulty);
    const aimSettled=now-ai.acquiredTargetAt>=
      botReactionDelay(ai.difficulty)+eff.adsTime*750;
    const stance=botCombatDecision(weapon.category,dist,clearShot,
      reactionReady,aimSettled,ai.ammoInMag>0,now<ai.reloadingUntil,ai.difficulty,ai.archetype);
    ai.sprinting=stance.sprinting;
    ai.aiming=stance.aiming;
    if(now>=(ai.nextCombatJumpAt??0)&&botWantsCombatJump(ai.difficulty,weapon.category,dist,clearShot,
      ai.envJumpVelocityY===undefined&&botHasJumpClearance(cityCoverNear(room,bot.pos[0],bot.pos[2],2.5),bot.pos),now,ai.nextCombatJumpAt??0,Math.random())){
      ai.envJumpVelocityY=MOVEMENT.jumpVelocity;ai.envLaunchX=0;ai.envLaunchZ=0;ai.nextCombatJumpAt=now+botTactics(ai.difficulty).jumpCooldown;
    }
    const botCarryingFlag=room.mode==="ctf"&&(room.flags.red.carrierId===bot.id||room.flags.blue.carrierId===bot.id);
    const moveSpeed = (botCarryingFlag ? CTF_SPEED_MULTIPLIER : 1) * ai.moveSpeed * 6 * MOVEMENT.botPursuitMultiplier * (ai.sprinting ? 1.25 : 1) * ctfCarrierWeaponSpeed(eff.moveSpeed,botCarryingFlag) * (orbitalReaperEquipped(room.map,bot.weaponId)&&!botCarryingFlag?ORBITAL_REAPER_SPEED_MULTIPLIER:1) * sludgeMovementFactor(bot.pos,bot.team,now,[...room.wonderFields.values()],room.mode==="ffa"||room.mode==="gungame") * floodgateWaterEffect(bot.pos[0],bot.pos[1],bot.pos[2],floodAge,room.map.cover).speedMultiplier;
    const ideal = weapon.category==="melee" ? Math.max(.7,weapon.stats.range-.15) : stance.idealDistance;
    // Melee bots must close to the actual weapon's reach, not stop 3m short.
    const chaseThreshold=weapon.category==="melee" ? ideal : ideal+3;
    let mvx = 0, mvz = 0;
    if (dist > chaseThreshold) {
      mvx = Math.sin(bot.yaw) * moveSpeed / 20;
      mvz = Math.cos(bot.yaw) * moveSpeed / 20;
    } else if (dist < ideal - 3) {
      mvx = -Math.sin(bot.yaw) * moveSpeed / 20;
      mvz = -Math.cos(bot.yaw) * moveSpeed / 20;
    } else {
      // strafe
      mvx = Math.cos(bot.yaw) * ai.strafeDir * moveSpeed / 20 * stance.strafe;
      mvz = -Math.sin(bot.yaw) * ai.strafeDir * moveSpeed / 20 * stance.strafe;
    }
    // Bunker centre is a maze of tall blocks. Navigate toward a clear A*
    // waypoint when the direct chase lane is obstructed; keep weapon aim on target.
    if ((dist > chaseThreshold || Math.abs(target.pos[1] - bot.pos[1]) > 1.3) &&
      (Math.abs(target.pos[1] - bot.pos[1]) > 1.3 || room.map.id==="bunker" ||
      botMoveBlocked(room,bot.pos,[bot.pos[0]+mvx*6,bot.pos[1],bot.pos[2]+mvz*6],bot.pos[1]) ||
      floodgateRouteNeedsDetour(bot.pos,target.pos,floodAge,room.map.cover))) {
      if(now>(ai.nextRouteAt??0)||!ai.routeWaypoint){
        const index=cityIndex(room);
        ai.routeWaypoint=botNextWaypoint(bot.pos,botMapRouteGoal(room.map.id,bot.pos,target.pos),room.map.cover,room.map.size,3,
          floodgatePathHazards(room.map,room.floodgateBreachAt!==null),room.map.regions,index,index?280:1000,floodAge) ??
          botHighGroundWaypoint(bot.pos,target.pos,room.map.cover);
        ai.nextRouteAt=now+850;
      }
      const waypoint=ai.routeWaypoint;
      if(waypoint){const wx=waypoint[0]-bot.pos[0],wz=waypoint[2]-bot.pos[2],len=Math.hypot(wx,wz);
        if(len>.25){mvx=wx/len*moveSpeed/20;mvz=wz/len*moveSpeed/20;}else ai.nextRouteAt=0;
      }
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
        bot.pos=collideBots(room,bot.pos,bot.pos[1]);
    // ---- Reaction delay (skill-scaled) ----
    const REACTION_MS = botReactionDelay(ai.difficulty);
    const reacted = now - ai.acquiredTargetAt >= REACTION_MS;

    // ---- Burst fire for auto weapons ----
    const isAuto = weapon.stats.auto;
    const burstPaused = isAuto && now < ai.burstEndsAt;
    if (isAuto && ai.burstShotsLeft <= 0 && now >= ai.burstEndsAt && reacted) {
      ai.burstShotsLeft = Math.max(2, Math.round(3 + ai.skill * 4 + (Math.random() - 0.5) * 2 + botPersonality(ai.archetype).extraBurstShots));
    }

    // ---- Intentional miss chance ----
    const missChance = (1 - ai.skill) * 0.45 + 0.03;
    const missThisShot = Math.random() < missChance;
    const missSpread = missThisShot ? eff.spread * 8 + 0.04 : 0;
    const distSpread = dist > 25 ? (dist - 25) * 0.0015 : 0;
    const mechanicalSpread=botShotSpread(eff,!!ai.aiming);
    const botShotgun = weapon.category === "shotgun" && !weapon.wonder && (eff.pellets ?? 1) > 1;
    const baseAimJitter = botShotgun ? 0 : mechanicalSpread * 2;

    // shooting
    if (!ai.sprinting && clearShot && reacted && now > ai.nextShotAt && ai.ammoInMag > 0 && now > ai.reloadingUntil && !burstPaused && (weapon.id!==ORBITAL_REAPER_ID||dist<=ORBITAL_PULSE_RADIUS)) {
      const aimYaw = bot.yaw + ai.sprayDriftYaw + (Math.random() - 0.5) * (baseAimJitter + distSpread + missSpread);
      const aimPitch = bot.pitch + ai.sprayDriftPitch + (Math.random() - 0.5) * (baseAimJitter + distSpread + missSpread);
      const dir = dirFromYawPitch(aimYaw, aimPitch);
      const origin: Vec3 = [bot.pos[0], bot.pos[1] + 1.5, bot.pos[2]];
      const pellets = eff.pellets ?? 1;
      let didHit = false;
      if(isThrowingKnife(weapon.id)){
        didHit=throwKnifeFrom(room,bot,origin,dir,now);
      }else if(weapon.category==="melee"){
        // Ordinary melee bots use the shared frontal arc.
        applyMeleeStrike(room,bot,weapon.id,now);
        didHit=true;
      }else for (let i = 0; i < pellets; i++) {
        const pdir = botShotgun
          ? shotgunPelletDirection(dir, eff, !!ai.aiming)
          : pellets > 1 ? normalize(add(dir, randSpread(mechanicalSpread))) : dir;
        const rayHits = firePenetratingRay(room, bot.id, origin, pdir, eff.range, eff);
        hitMaterialCover(room,origin,pdir,eff,rayHits);
        for (const hit of rayHits) {
          const baseDmg = eff.damage * (hit.head ? weapon.stats.headshotMult : 1);
          const dmg = damageAtRange(baseDmg, hit.t, eff.range, eff) * hit.damageScale;
          applyDamage(room, bot.id, hit.victim, dmg, hit.head, bot.weaponId,hit.shield);
          didHit = true;
          if (room.ended) break;
        }
      }
      // Reaper has its own purple pulse FX. It must not generate a gunshot
      // tracer or gunfire audio on other clients.
      if(weapon.category!=="melee"){
        io.to(room.id).emit("message", { t: "shotFx", origin, dir, weaponId: bot.weaponId, attackerId: bot.id, skinId: bot.weaponSkinId, suppressed: room.mode !== "gungame" && bot.loadout.attachments.barrel === "barrel_suppressor" } as S2C);
        broadcastRadarPing(room, bot, room.mode !== "gungame" && bot.loadout.attachments.barrel === "barrel_suppressor");
        publishBotNoise(room,{sourceId:bot.id,pos:bot.pos,at:now,kind:"gunshot",
          suppressed:room.mode!=="gungame"&&bot.loadout.attachments.barrel==="barrel_suppressor"});
      }
      if(weapon.category!=="melee")ai.ammoInMag--;
      clearSpawnProtection(room, bot); // bot firing also cancels its protective shield
      ai.lastFiredAt = now;
      // Accumulate spray drift from this shot.
      const driftKick = eff.recoil * 0.0042 * (1 - ai.skill * 0.5);
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
    const wantSmartReload = lowAmmo && !enemyVisible && ai.skill > 0.4 &&
      canStartWeaponReload(weapon.stats, ai.ammoInMag) && Math.random() < 0.02;
    if (!isThrowingKnife(weapon.id) && !ai.sprinting && (ai.ammoInMag <= 0 || wantSmartReload) && now > ai.reloadingUntil) {
      const durationMs = weapon.stats.reloadStyle === "incremental"
        ? Math.max(300, (weapon.stats.reloadPerRound ?? eff.reloadTime / eff.magSize) *
            eff.reloadTime / Math.max(0.01, weapon.stats.reloadTime) * 1000)
        : eff.reloadTime * 1000;
      ai.reloadingUntil = now + durationMs;
      if (weapon.stats.reloadStyle !== "incremental") ai.ammoInMag = eff.magSize;
      ai.burstShotsLeft = 0;
      ai.burstEndsAt = now + durationMs;
      io.to(room.id).emit("message", { t: "reloadFx", playerId: bot.id } as S2C);
    }
  } else {
    // wander toward wanderTarget (with wall collision so bots don't clip through cover)
    const patrolGoal=ai.highGroundPatrol;
    const patrolPoint=patrolGoal?cityHighGroundStep(bot.pos,patrolGoal,
      cityCoverNear(room,bot.pos[0],bot.pos[2],35)):ai.wanderTarget;
    const navPoint=botMapRouteGoal(room.map.id,bot.pos,patrolPoint);
    const dx=navPoint[0]-bot.pos[0],dz=navPoint[2]-bot.pos[2];
    const d=Math.hypot(dx,dz);
    const floorMismatch=Math.abs(navPoint[1]-bot.pos[1])>1.15;
    ai.aiming = ai.archetype === "marksman" && d <= 2.5;
    ai.sprinting=botPatrolSprint(d,ai.difficulty,ai.archetype);
    if(d<=1.5&&!floorMismatch){
      if(ai.investigationLookAt){
        const last=ai.investigationLookAt;
        const dx=last[0]-bot.pos[0],dz=last[2]-bot.pos[2];
        const angle=Math.hypot(dx,dz)>0.4?Math.atan2(dx,dz):bot.yaw;
        bot.yaw=lerpAngle(bot.yaw,angle+Math.sin(now/850+bot.id.length)*.38,.15);
      }else if(ai.ctfGuarding && (bot.team==="red"||bot.team==="blue")){
        bot.yaw=lerpAngle(bot.yaw,ctfDefenderScanYaw(bot.team,bot.pos,bot.id,room.map.id),.12);
      }else if(ai.archetype==="marksman"){
        if(ai.idleLookYaw===undefined)ai.idleLookYaw=bot.yaw;
        bot.yaw=lerpAngle(bot.yaw,ai.idleLookYaw+Math.sin(now/2300+bot.id.length)*.5,.1);
      }
    }else ai.idleLookYaw=undefined;
    if(d>(patrolGoal?.38:1.5)||floorMismatch){
      // Task 16-a: wall-ahead lookahead. Probe 2 units forward in the movement
      // direction. If blocked, rotate the movement direction by ±35° (sign
      // from ai.strafeDir) so the bot angles around the obstacle instead of
      // headbutting it. The yaw is set to the rotated direction so the bot
      // faces where it's going.
      let fx = d>.001?dx/d:0, fz = d>.001?dz/d:0;
      const patrolBlocked = botMoveBlocked(room, bot.pos, [bot.pos[0]+fx*4, bot.pos[1], bot.pos[2]+fz*4], bot.pos[1]);
      if((patrolBlocked||(patrolGoal&&d>5)||
          floorMismatch||room.map.id==="bunker" ||
          floodgateRouteNeedsDetour(bot.pos,patrolPoint,floodAge,room.map.cover)) &&
          (!patrolGoal||d>4.5)){
        if(now>(ai.nextRouteAt??0)||!ai.routeWaypoint){
          const index=cityIndex(room);
          ai.routeWaypoint=botNextWaypoint(bot.pos,navPoint,room.map.cover,room.map.size,3,
            floodgatePathHazards(room.map,room.floodgateBreachAt!==null),room.map.regions,index,index?280:1000,floodAge);
          ai.nextRouteAt=now+(index?1500:850);
        }
        const waypoint=ai.routeWaypoint;
        if(waypoint){const wx=waypoint[0]-bot.pos[0],wz=waypoint[2]-bot.pos[2],wd=Math.hypot(wx,wz);
          if(wd>.25){fx=wx/wd;fz=wz/wd;}else ai.nextRouteAt=0;
        }
      }
      const probeFrom: Vec3 = [bot.pos[0], bot.pos[1], bot.pos[2]];
      const probeTo: Vec3 = [bot.pos[0] + fx * 2, bot.pos[1], bot.pos[2] + fz * 2];
      if (botMoveBlocked(room, probeFrom, probeTo, bot.pos[1])) {
        // Scan alternate headings, instead of repeatedly steering 35° into
        // the same wall. Favor the previous strafe direction for smooth motion.
        const baseX = fx, baseZ = fz;
        const turns = [35, -35, 70, -70, 105, -105, 145, -145, 180];
        let clear = false;
        for (const angle of turns) {
          const theta = angle * ai.strafeDir * Math.PI / 180;
          const hx = baseX*Math.cos(theta)-baseZ*Math.sin(theta);
          const hz = baseX*Math.sin(theta)+baseZ*Math.cos(theta);
          if (!botMoveBlocked(room, probeFrom, [bot.pos[0]+hx*1.5,bot.pos[1],bot.pos[2]+hz*1.5],bot.pos[1])) {
            fx=hx; fz=hz; clear=true; break;
          }
        }
        if (!clear) ai.strafeDir = -ai.strafeDir;
        bot.yaw = Math.atan2(fx, fz);
      } else {
        bot.yaw = lerpAngle(bot.yaw, Math.atan2(dx, dz), 0.15);
      }
      const scan=botCornerScan(ai.difficulty,patrolBlocked,now,ai);
      if((ai.cornerUntil??0)>now){ai.sprinting=false;bot.yaw=lerpAngle(bot.yaw,Math.atan2(fx,fz)+scan,.28);}
      const cornerSpeed=(ai.cornerUntil??0)>now?.35:1;
      const mvx = cornerSpeed * fx * ai.moveSpeed * (room.mode === "ctf" && (room.flags.red.carrierId === bot.id || room.flags.blue.carrierId === bot.id) ? CTF_SPEED_MULTIPLIER : 1) * 5 * MOVEMENT.botPursuitMultiplier * (ai.sprinting ? 1.25 : 1) / 20;
      const mvz = cornerSpeed * fz * ai.moveSpeed * (room.mode === "ctf" && (room.flags.red.carrierId === bot.id || room.flags.blue.carrierId === bot.id) ? CTF_SPEED_MULTIPLIER : 1) * 5 * MOVEMENT.botPursuitMultiplier * (ai.sprinting ? 1.25 : 1) / 20;
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
        bot.pos=collideBots(room,bot.pos,bot.pos[1]);

    }
  }
  // Apply the same vertical/collision resolution to chasing, wandering AND
  // stationary bots. A stationary bot must still descend from a ledge.
  bot.pos = clampToArena(room, collideBots(room, bot.pos, bot.pos[1]));
  if (bot.ai.envJumpVelocityY !== undefined) {
    const dy = bot.ai.envJumpVelocityY;
    bot.pos = [bot.pos[0] + (bot.ai.envLaunchX ?? 0) / 20,
      bot.pos[1] + dy / 20,
      bot.pos[2] + (bot.ai.envLaunchZ ?? 0) / 20];
    bot.ai.envJumpVelocityY = dy - 22 * orbitalGravity(room.map,bot.weaponId) / 20;
    const ground = botGroundHeight(cityCoverNear(room,bot.pos[0],bot.pos[2],2.5), bot.pos[0], bot.pos[2], bot.pos[1]);
    if (bot.ai.envJumpVelocityY <= 0 && bot.pos[1] <= ground) {
      bot.pos[1] = ground;
      bot.ai.envJumpVelocityY = undefined;
    }
  } else {
    bot.pos[1] = botNextFeetY(cityCoverNear(room,bot.pos[0],bot.pos[2],2.5), bot.pos, 1 / 20);
  }
  bot.pos = clampToArena(room, collideBots(room, bot.pos, bot.pos[1]));
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
      // Recovery: change patrol objective (prefer enemy territory in TDM).
      ai.wanderTarget=chooseBotPatrolPoint(bot.team,room.mode,bot.pos,
        room.map.spawns.red,room.map.spawns.blue,room.map.spawns.ffa,Math.random,room.map.id);
      ai.highGroundPatrol=null;ai.highGroundExpiresAt=now+4500;
      ai.targetId=null;        // wander instead of engaging
      ai.lastSighting=null;ai.investigationLookAt=null;
      ai.routeWaypoint=null;ai.nextRouteAt=0;
      ai.strafeDir = -ai.strafeDir;
      ai.stuckSince = 0;
      // Nudge sideways so the bot has a chance to unstick from the corner.
      const before: Vec3 = [...bot.pos];
      const tryPos: Vec3 = [before[0] + (Math.random() - 0.5) * 0.6, before[1], before[2] + (Math.random() - 0.5) * 0.6];
      if (!botMoveBlocked(room, before, tryPos, before[1])) bot.pos = tryPos;
      bot.pos = clampToArena(room, collideBots(room, bot.pos, bot.pos[1]));
    }
  }
  // Record this tick's position for next tick's stuck measurement.
  const stepDistance=Math.hypot(bot.pos[0]-ai.lastPosX,bot.pos[2]-ai.lastPosZ);
  if(stepDistance>.08 && now-(ai.lastNoiseStepAt??0)>(ai.sprinting?280:390)){
    ai.lastNoiseStepAt=now;
    publishBotNoise(room,{sourceId:bot.id,pos:bot.pos,at:now,kind:"footstep",sprinting:!!ai.sprinting});
  }
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
  const cover = cityCoverAlong(room, from, to, 2);
  return blocksBotMotion(cover, from, to, currentY) ||
    botEntersHazard(cover, room.map.environment, from, to, room.environmentTime);
}

function collideBots(room: Room, pos: Vec3, currentY: number): Vec3 {
  return resolveBotOverlap(cityCoverNear(room,pos[0],pos[2],3), pos, currentY);
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
  const minDist = room.mode === "ctf" ? 3.1 : 2 * PLAYER_RADIUS + 0.2;
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
    const before: Vec3 = [...bot.pos];
    const after: Vec3 = [before[0] + (ddx / dist) * push, before[1], before[2] + (ddz / dist) * push];
    if (!blocksBotMotion(cityCoverAlong(room,before,after,2), before, after, currentY)) bot.pos = after;
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
  for (const cov of cityCoverAlong(room,from,to,2)) {
    if (cov.kind === "accent" || cov.kind === "stair") continue;
    const t = rayBox(from, dir, cov.pos, cov.size);
    if (t !== null && t < len) return false;
  }
  return true;
}

// ---- Connection handling ----------------------------------------------------
io.on("connection", (socket) => {
  socket.on("message", async (msg: C2S) => {
    try {
      await handle(socket, msg);
    } catch (e) {
      console.error("msg error", e);
    }
  });
  socket.on("disconnect", () => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (room) {
      if (room.mode === "ctf") dropCarriedFlag(room, socket.id, [...(room.players.get(socket.id)?.pos ?? [0,0,0])] as Vec3);
      room.players.delete(socket.id);
       room.orbitalHolders.delete(socket.id);
      room.downed.delete(socket.id);
      room.sockets.delete(socket.id);
      room.scores.delete(socket.id);
      room.loadouts.delete(socket.id);
        room.pendingLoadouts.delete(socket.id);
        room.playerKeys.delete(socket.id);
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

/** Multiplayer progression guard. Socket packets are not proof that a level
 * was earned or that Well Prepared is selected in a saved loadout.
 */
async function validatedMatchLoadout(playerKey: string, requested: LoadoutWire): Promise<LoadoutWire> {
  const player = await getOrCreatePlayer(playerKey);
  const wonderUnlocks=await db.wonderUnlock.findMany({where:{playerId:player.id},select:{weaponId:true}});
  const resolved = resolveMatchLoadout({...player,wonderUnlocks}, requested);
  const purchases = await db.careerShopPurchase.findMany({where:{playerId:player.id},select:{itemKey:true}});
  const owned = cosmeticShopOwnership(purchases.map(p=>p.itemKey));
  // Match sockets cannot supply cosmetic IDs they did not purchase.
  return {
    ...resolved,
    primaryReticleId:owned.includes(resolved.primaryReticleId??"classic")?resolved.primaryReticleId:"classic",
    secondaryReticleId:owned.includes(resolved.secondaryReticleId??"classic")?resolved.secondaryReticleId:"classic",
    primaryCharmId:owned.includes(resolved.primaryCharmId??"none")&&!weaponById(resolved.weaponId).wonder?resolved.primaryCharmId:"none",
    secondaryCharmId:owned.includes(resolved.secondaryCharmId??"none")&&!weaponById(resolved.secondaryWeaponId??"pistol_side").wonder?resolved.secondaryCharmId:"none",
    meleeCharmId:"none",
  };
}

async function handle(socket: any, msg: C2S) {
  switch (msg.t) {
    case "joinMatch": {
      const loadout = await validatedMatchLoadout(msg.playerKey, msg.loadout);
      const mapId: MapId = (msg.mapId ?? "compound") as MapId;
      let room = findOpenRoom(msg.mode, mapId);
      if (!room) room = createRoom(msg.mode, Math.min(7, Math.max(1, msg.botCount)), mapId);
      room.playerKeys.set(socket.id, msg.playerKey);
      socketToRoom.set(socket.id, room.id);
      socket.join(room.id);
      const team = assignTeam(room.mode, room) as any;
      const sp = pickSpawn(team, room);
      // In gungame, joining players start on the first progression weapon.
      const joinWeaponId = room.mode === "gungame" ? (room.gungameWeapons[0] ?? "pistol_side") : loadout.weaponId;
      const p: PlayerNet = {
        id: socket.id, name: msg.name?.slice(0, 52) || "Recruit", team, isBot: false,
        pos: sp, yaw: 0, pitch: 0, health: MAX_HEALTH, alive: true,
        weaponId: joinWeaponId, weaponSkinId: room.mode === "gungame" ? "default" : loadout.weaponSkinId, playerSkinId: room.mode === "gungame" ? "default" : loadout.playerSkinId,
    charmId:room.mode==="gungame"?"none":loadout.primaryCharmId??"none",nameplateId:loadout.nameplateId??"standard",
        kills: 0, deaths: 0, lastShotAt: 0,
        spawnProtectedUntil: Date.now() + 3000,
      };
      room.players.set(socket.id, p);
      room.sockets.set(socket.id, socket.id);
      room.scores.set(socket.id, 0);
      room.loadouts.set(socket.id, loadout);
      // Late joiners start their own cooldown on entry, never with a ready Wonder.
      if(room.state==="playing" && loadout.perkId==="wonder_weapon"){
        const selected=WEAPONS.find(w=>w.id===loadout.wonderWeaponId&&!w.disabled);
        const now=Date.now();
        if(selected?.wonder && usesWonderCharges(selected))
          room.wonderCharges.set(socket.id+":"+selected.id,drainedWonderCharges(selected.wonder,now));
        if(selected?.id===RIOT_SHIELD_ID){
          p.riotShieldHp=0;p.riotShieldReadyAt=now+RIOT_SHIELD_RECHARGE_MS;
        }
      }
      if (room.mode === "gungame") room.gungameProgress.set(socket.id, 0);
      // ensure bots count matches (in case room was reused)
      spawnBots(room);
      const joined: S2C = {
        t: "joined", matchId: room.id, selfId: socket.id, mode: room.mode, team,
        config: room.config, mapId: room.map.id, players: [...room.players.values(), ...room.bots.values()].map(p => toSnap(p,room.loadouts.get(p.id))),
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
        if (room.mode === "ctf") dropCarriedFlag(room, socket.id, [...(room.players.get(socket.id)?.pos ?? [0,0,0])] as Vec3);
        room.players.delete(socket.id);
       room.orbitalHolders.delete(socket.id);
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
      const moveNow=Date.now();
      if(!room.downed.has(socket.id)&&(room.equipmentStun.get(socket.id)??0)<=moveNow){
       let next=clampToArena(room,msg.pos);
       const factor=sludgeMovementFactor(p.pos,p.team,moveNow,[...room.wonderFields.values()],room.mode==="ffa"||room.mode==="gungame");
       if(factor<1){
        const elapsed=Math.min(250,Math.max(16,moveNow-(room.lastMotionAt.get(socket.id)??moveNow-50)));
        const maxTravel=elapsed*.0035+.15;
        const dx=next[0]-p.pos[0],dz=next[2]-p.pos[2],distance=Math.hypot(dx,dz);
        if(distance>maxTravel){const t=maxTravel/distance;next=[p.pos[0]+dx*t,next[1],p.pos[2]+dz*t];}
       }
       const moved=Math.hypot(next[0]-p.pos[0],next[2]-p.pos[2]);
       p.pos=next;
       if (!room.ended && room.preMatchCountdown <= 0 && lavaAt(room.map.environment, next)) {
         applyDamage(room, "world", p, p.health, false, LAVA_DEATH_SOURCE);
         break;
       }
       if(moved>.08 && !room.downed.has(socket.id) &&
           room.loadouts.get(socket.id)?.perkId!=="silent_steps"){
         let steps=playerStepByRoom.get(room);
         if(!steps){steps=new Map();playerStepByRoom.set(room,steps);}
         if(moveNow-(steps.get(socket.id)??0)>(msg.sprinting?280:390)){
           steps.set(socket.id,moveNow);
           publishBotNoise(room,{sourceId:p.id,pos:p.pos,at:moveNow,kind:"footstep",sprinting:!!msg.sprinting});
         }
       }
      }
      room.lastMotionAt.set(socket.id,moveNow);
      if(msg.aiming){if(!room.adsStartedAt.has(socket.id))room.adsStartedAt.set(socket.id,moveNow);}else room.adsStartedAt.delete(socket.id);
      room.sprintState.set(socket.id, !room.downed.has(socket.id) && !!msg.sprinting);
      p.riotShieldRaised=p.weaponId===RIOT_SHIELD_ID && !!msg.aiming && !msg.reloading && !msg.sprinting && (p.riotShieldHp??RIOT_SHIELD_HP)>0 && moveNow-(room.quickMeleeAt.get(socket.id)??0)>=riotBashProfile().swingMs;
      p.yaw = msg.yaw;
      p.pitch = msg.pitch;
      // Server-owned Deadlock tags: ADS continuously acquires up to three
      // exposed opponents; markers survive releasing ADS for 4.5 seconds.
      if(p.weaponId==="wonder_deadlock"){
        const prev=(room.smartTags.get(socket.id)??[]).filter(t=>t.expiresAt>moveNow);
        if(msg.aiming && moveNow-(room.adsStartedAt.get(socket.id)??moveNow)>=250){
          const cp=Math.cos(p.pitch);
          const dir:Vec3=[Math.sin(p.yaw)*cp,Math.sin(p.pitch),Math.cos(p.yaw)*cp];
          const origin:Vec3=[p.pos[0],p.pos[1]+EYE_HEIGHT,p.pos[2]];
          const options=allCombatants(room).filter(x=>x.id!==socket.id)
            .map(x=>({id:x.id,pos:x.pos,alive:x.alive,team:x.team,
              protected:!!x.spawnProtectedUntil&&x.spawnProtectedUntil>moveNow}));
          for(const target of selectSmartTargets(origin,dir,options,p.team,
            room.mode==="ffa"||room.mode==="gungame"||room.config.friendlyFire===true,
            weaponById(p.weaponId).stats.range,
            point=>hasLineOfSight(room,origin,[...point] as Vec3))){
            const existing=prev.findIndex(t=>t.id===target.id);
            if(existing>=0)prev[existing].expiresAt=moveNow+SMART_TAG_MS;
            else if(prev.length<SMART_MAX_TAGS)prev.push({id:target.id,expiresAt:moveNow+SMART_TAG_MS});
          }
        }
        room.smartTags.set(socket.id,prev);
      }else room.smartTags.delete(socket.id);
      break;
    }
    case "collectScavenger": {
      const room = rooms.get(socketToRoom.get(socket.id) ?? "");
      if (!room || room.state !== "playing") return;
      const p = room.players.get(socket.id);
      const drop = room.scavengerDrops.get(msg.id);
      if (!p || !drop || !canCollectScavengerDrop({
        now: Date.now(), expiresAt: drop.expiresAt,
        distance: Math.hypot(p.pos[0] - drop.pos[0], p.pos[2] - drop.pos[2]),
        alive: p.alive, perkId: room.loadouts.get(p.id)?.perkId,
        collectorId: p.id, ownerId: drop.ownerId,
        mode: room.mode, collectorTeam: p.team, defeatedTeam: drop.ownerTeam,
      })) return;
      room.scavengerDrops.delete(msg.id);
      io.to(drop.ownerId).emit("message", { t: "scavengerRemove", id: msg.id } as S2C);
      io.to(socket.id).emit("message", { t: "scavengerCollected", id: msg.id } as S2C);
      break;
    }
    case "useEquipment": {
      const room = rooms.get(socketToRoom.get(socket.id) ?? "");
      if (!room || !room.players.has(socket.id)) return;
      const left = serverUseEquipment(room, socket.id);
      // A rejected intent also corrects the client's predicted ammo count.
      const remaining = left ?? (room.equipmentCharges.get(socket.id) ??
        equipmentById(room.loadouts.get(socket.id)?.equipmentId).charges);
      socket.emit("message", { t: "equipmentState", remaining } as S2C);
      break;
    }
    case "quickMelee": {
      const room = rooms.get(socketToRoom.get(socket.id) ?? "");
      if (!room || room.state !== "playing" || room.ended || room.preMatchCountdown > 0 || room.mode === "gungame") return;
      const p = room.players.get(socket.id);
      if (!p?.alive || room.downed.has(socket.id)) return;
      const requestedMelee=room.loadouts.get(socket.id)?.meleeWeaponId;
      const shieldBash=p.weaponId===RIOT_SHIELD_ID && (p.riotShieldHp??RIOT_SHIELD_HP)>0;
      const meleeId=shieldBash?RIOT_SHIELD_ID:room.orbitalHolders.has(socket.id)?ORBITAL_REAPER_ID:(requestedMelee===ORBITAL_REAPER_ID?"knife_tactical":requestedMelee??"knife_tactical");
      const weapon=weaponById(meleeId);
      if(weapon.category!=="melee" && !shieldBash)return;
      const attack=shieldBash?riotBashProfile():quickMeleeProfile(weapon.stats,meleeId);
      const now = Date.now();
      if(isThrowingKnife(meleeId)&&!shieldBash){
        if(now-(room.quickMeleeAt.get(socket.id)??0)<attack.cooldownMs||
           now-p.lastShotAt<attack.cooldownMs)return;
        const dir=dirFromYawPitch(p.yaw,p.pitch);
        if(!throwKnifeFrom(room,p,[p.pos[0],p.pos[1]+EYE_HEIGHT,p.pos[2]],dir,now))return;
        room.quickMeleeAt.set(socket.id,now);
        break;
      }
      if (now - (room.quickMeleeAt.get(socket.id) ?? 0) < attack.cooldownMs ||
          (p.weaponId===meleeId && now - p.lastShotAt < attack.cooldownMs)) return;
      room.quickMeleeAt.set(socket.id, now);
      if(shieldBash)p.riotShieldRaised=false;
      if(p.weaponId===meleeId)p.lastShotAt=now;
      clearSpawnProtection(room, p);
      applyMeleeStrike(room,p,meleeId,now);
      break;
    }
    case "deployTurret": {
      const room = rooms.get(socketToRoom.get(socket.id) ?? "");
      const player = room?.players.get(socket.id);
      const denied = (reason: string) =>
        io.to(socket.id).emit("message", { t: "turretRejected", reason } as S2C);
      if (!room || room.state !== "playing" || room.ended || room.preMatchCountdown > 0 ||
          !player?.alive || room.downed.has(socket.id)) {
        denied("Deployment is unavailable right now");
        break;
      }
      if (player.weaponId !== "wonder_turret") {
        denied("Bullet Spitter is not currently equipped");
        break;
      }
      const now = Date.now();
      const weapon = weaponById(player.weaponId);
      const key = socket.id + ":" + weapon.id;
      // If a room is recovered without state, initialize it empty, not ready.
      const state = room.wonderCharges.get(key) ?? drainedWonderCharges(weapon.wonder!,now);
      room.wonderCharges.set(key,state);
      const charged = spendWonderCharge(state, weapon.wonder!, now);
      if (!charged) {
        denied("Bullet Spitter has not recharged");
        break;
      }
      room.wonderCharges.set(key, charged);
      player.lastShotAt = now;
      clearSpawnProtection(room, player);
      placePlayerTurret(room, player, socket.id, now);
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
      if (!p || !p.alive || (room.equipmentStun.get(socket.id) ?? 0) > Date.now()) return;
      // Sprinting players must lower their weapon before shooting.
      if (room.sprintState.get(socket.id)) return;
      const weapon = weaponById(msg.weaponId);
      if (weapon.disabled || (weapon.id===ORBITAL_REAPER_ID&&!room.orbitalHolders.has(socket.id)) || weapon.id !== p.weaponId || (room.downed.has(socket.id) && msg.weaponId !== (room.loadouts.get(socket.id)?.secondaryWeaponId ?? "pistol_side"))) return;
      // Melee collision is resolved by the shared server-owned frontal arc.
      const now = Date.now();
      // Quiver mode truly fires automatically; server honours its faster
      // cadence rather than retaining the single-bolt recovery interval.
      const equippedLoadout=room.loadouts.get(socket.id);
      const crossbowMag=equippedLoadout?.secondaryWeaponId===p.weaponId
        ? equippedLoadout?.secondaryAttachments?.magazine
        : equippedLoadout?.attachments?.magazine;
      const quiver=weapon.id==="crossbow_reclaimer"&&crossbowMag==="mag_bolt_quiver";
      const heavy=weapon.id==="crossbow_reclaimer"&&crossbowMag==="mag_bolt_heavy";
      // Match the client cadence after shell and attachment fire-rate modifiers.
      // In particular, beanbags must not be throttled to the base weapon rate.
      const cadenceLoadout = room.loadouts.get(socket.id);
      const cadenceAtts = cadenceLoadout?.secondaryWeaponId === p.weaponId
        ? cadenceLoadout.secondaryAttachments : cadenceLoadout?.attachments;
      const cadenceEff = cadenceLoadout && cadenceAtts
        ? computeEffectiveStats(weapon, room.mode === "gungame"
          ? { sight:null, barrel:null, grip:null, magazine:null }
          : cadenceAtts)
        : weapon.stats;
      const interval = 1000 / Math.max(.1, quiver ? weapon.stats.fireRate * 3.5 : cadenceEff.fireRate);
      if(weapon.category==="melee" &&
        now-(room.quickMeleeAt.get(socket.id)??0)<interval) return;
      const burstSize = weapon.stats.burst ?? 1;
      if (burstSize > 1) {
        const burstCadenceMs = burstShotIntervalMs(cadenceEff.fireRate, weapon.category);
        const previous = room.burstState.get(socket.id);
        if (previous?.weaponId === weapon.id && previous.shotsRemaining > 0 && now <= previous.until) {
          // Accept modest network jitter, but enforce the shared weapon-specific
          // burst cadence; client and server must not disagree on fast bursts.
          if (now < previous.nextAt) return;
          previous.shotsRemaining--;
          previous.nextAt = now + burstCadenceMs * 0.85;
          if (previous.shotsRemaining === 0) previous.until = now + interval * 0.9;
        } else {
          // Begin a new burst only after the previous burst's cooldown.
          if (previous?.weaponId === weapon.id && now < previous.until) return;
          room.burstState.set(socket.id, {
            weaponId: weapon.id, shotsRemaining: burstSize - 1,
            nextAt: now + burstCadenceMs * 0.85,
            until: now + 1500, // abandoned bursts expire; never remain infinite
          });
        }
      } else if (now - p.lastShotAt < interval * (weapon.category === "melee" ? 1 : .8)) return;
      // Validate the muzzle origin for new special weapons before doing any effects.
      if (weapon.special || weapon.wonder) {
        if (![...msg.origin, ...msg.dir].every(Number.isFinite)) return;
        if (Math.hypot(msg.origin[0] - p.pos[0], msg.origin[1] - p.pos[1], msg.origin[2] - p.pos[2]) > 3) return;
        if (Math.abs(Math.hypot(...msg.dir) - 1) > 0.2) return;
      }
      if (shieldBlocksFire(p.weaponId,!!p.riotShieldRaised,p.riotShieldHp??RIOT_SHIELD_HP)) return;
      if (usesWonderCharges(weapon) && weapon.wonder) {
        const key = socket.id + ":" + weapon.id;
        const state = room.wonderCharges.get(key) ?? drainedWonderCharges(weapon.wonder,now);
        room.wonderCharges.set(key,state);
        if(weapon.wonder.kind==="flame"){
          const paid=spendHellfireFuelOnShot(state,weapon.wonder,now,
            room.hellfireUntil.get(socket.id)??0,HELLFIRE_FUEL_STEP_MS);
          if(!paid)return;
          room.wonderCharges.set(key,paid.state);
          room.hellfireUntil.set(socket.id,paid.paidThrough);
        }else{
          const next=spendWonderCharge(state,weapon.wonder,now);
          if(!next)return;
          room.wonderCharges.set(key,next);
        }
      }
      const heatAtts = equippedLoadout?.secondaryWeaponId === p.weaponId
        ? equippedLoadout.secondaryAttachments : equippedLoadout?.attachments;
      const heat = effectiveHeatConfig(weapon,room.mode==="gungame"
        ? {sight:null,barrel:null,grip:null,magazine:null}
        : (heatAtts ?? {sight:null,barrel:null,grip:null,magazine:null}));
      if (heat && !allowHeatShot(room, socket.id, heat, now)) return;
      if(isThrowingKnife(weapon.id)){
        // Don't enter the infinite-ammo melee arc or the firearm reload path.
        throwKnifeFrom(room,p,msg.origin,msg.dir,now,room.mode==="gungame"?"default":msg.skinId);
        break;
      }
      if (weapon.special?.kind === "bolt" && now < (room.boltReadyAt.get(socket.id) ?? 0)) return;
      if(heavy && (room.boltCharges.get(socket.id)??2)<=0) return;
      if (weapon.special?.kind === "bolt") {
        const charges = room.boltCharges.get(socket.id) ?? (heavy?2:0);
        if(heavy){
          room.boltCharges.set(socket.id,charges-1);
          room.boltReadyAt.set(socket.id,now+Math.max(interval,200));
        }else if(quiver){
          // No retrieval window and no collectible bolt drops.
          room.boltReadyAt.set(socket.id,now+interval*.85);
        }else{
          if(charges>0)room.boltCharges.set(socket.id,charges-1);
          room.boltReadyAt.set(socket.id,now+(charges>0?
            weapon.special.quickReloadSeconds*1000:
            crossbowMag==="mag_extended"?interval:weapon.stats.reloadTime*1000));
        }
      }
      p.lastShotAt = now;
      clearSpawnProtection(room, p); // accepted shot immediately removes visual shield + immunity
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
      if (room.mode === "gungame") attsForShot = { sight: null, barrel: null, grip: null, magazine: null };
      const eff = loadout && attsForShot ? computeEffectiveStats(weapon, attsForShot as Record<AttachmentSlot, string | null>) : weapon.stats;
      if(weapon.category!=="melee" && weapon.wonder?.kind!=="flame" && weapon.wonder?.kind!=="turret")
        publishBotNoise(room,{sourceId:p.id,pos:p.pos,at:now,kind:"gunshot",
          suppressed:attsForShot?.barrel==="barrel_suppressor"});
      let shotDir:Vec3=msg.dir;
      if(weapon.stats.auto && !(weapon.category === "shotgun" && !weapon.wonder && (eff.pellets ?? 1) > 1) && !weapon.wonder){
        const previous=room.autoBloom.get(socket.id);
        const bloom=automaticBloom(previous?.weaponId===weapon.id?previous.value:0,
          eff.fireRate,now-(previous?.at??0));
        room.autoBloom.set(socket.id,{weaponId:weapon.id,value:bloom,at:now});
        const scatter=autoSpreadRadians(eff.spread,bloom);
        shotDir=normalize([msg.dir[0]+(Math.random()-.5)*scatter,
          msg.dir[1]+(Math.random()-.5)*scatter,msg.dir[2]+(Math.random()-.5)*scatter]);
      }
      if(weapon.category==="melee"){
        applyMeleeStrike(room,p,weapon.id,now);
        io.to(room.id).emit("message",{t:"shotFx",origin:msg.origin,dir:msg.dir,
          weaponId:weapon.id,attackerId:socket.id,skinId:msg.skinId,suppressed:false} as S2C);
        break;
      }
      const boltImpact = weapon.special?.kind === "bolt" ? serverBoltLanding(room, socket.id, msg.origin, shotDir, eff.range) : null;
      // Backwards compatible with older clients that still use the generic
      // shot packet to deploy their Wonder Weapon.
      if (weapon.wonder?.kind === "turret") {
        placePlayerTurret(room, p, socket.id, now);
        break;
      }

      if(weapon.wonder?.kind==="cluster"){
        const volley:ClusterVolley={id:genId("cluster"),ownerId:p.id,ownerTeam:p.team,launchedAt:now,
          shots:clusterShots(msg.origin,shotDir,room.map.cover,room.map)};
        room.clusterVolleys.set(volley.id,{...volley,done:new Set(),dealt:new Map()});
        io.to(room.id).emit("message",{t:"clusterVolley",volley,serverNow:now} as S2C);
        io.to(room.id).emit("message",{t:"shotFx",origin:msg.origin,dir:shotDir,weaponId:weapon.id,attackerId:p.id,skinId:msg.skinId,suppressed:false} as S2C);
        break;
      }
      // Each new Wonder kind is a dedicated authoritative action rather than rocket splash.
      if(weapon.wonder?.kind==="smart"){
        // One smart shot strikes every marked exposed target (up to three).
        // Cover, teams and spawn protection are checked authoritatively.
        const marks=(room.smartTags.get(socket.id)??[]).filter(t=>t.expiresAt>now);
        const victims=marks.map(t=>allCombatants(room).find(c=>c.id===t.id))
          .filter((c):c is PlayerNet=>!!c&&c.alive&&
            (!c.spawnProtectedUntil||c.spawnProtectedUntil<=now)&&
            (room.config.friendlyFire||room.mode==="ffa"||room.mode==="gungame"||c.team!==p.team)&&
            Math.hypot(c.pos[0]-msg.origin[0],c.pos[2]-msg.origin[2])<=eff.range&&
            hasLineOfSight(room,msg.origin,[c.pos[0],c.pos[1]+1.05,c.pos[2]]))
          .slice(0,SMART_MAX_TAGS);
        if(victims.length){
          for(const victim of victims){
            io.to(room.id).emit("message",{t:"wonderBeam",from:msg.origin,
              to:[victim.pos[0],victim.pos[1]+1.05,victim.pos[2]],kind:"smart"} as S2C);
            const to:Vec3=[victim.pos[0],victim.pos[1]+1.05,victim.pos[2]];
            const path=normalize([to[0]-msg.origin[0],to[1]-msg.origin[1],to[2]-msg.origin[2]]);
            applyDamage(room,socket.id,victim,eff.damage,false,weapon.id,rayRiotShield(msg.origin,path,victim)!==null);
            if(room.ended)break;
          }
        }else{
          const hit=fireRay(room,socket.id,msg.origin,shotDir,weapon.id,eff.range);
          if(hit)applyDamage(room,socket.id,hit.victim,damageAtRange(eff.damage,hit.t,eff.range,eff),hit.head,weapon.id,hit.shield);
        }
        io.to(room.id).emit("message",{t:"shotFx",origin:msg.origin,dir:shotDir,
          weaponId:weapon.id,attackerId:socket.id,skinId:msg.skinId,suppressed:false} as S2C);
        break;
      }
      if(weapon.wonder?.kind==="flame"){
        const len=Math.hypot(...shotDir)||1,dir:Vec3=[shotDir[0]/len,shotDir[1]/len,shotDir[2]/len];
        for(const victim of allCombatants(room)){
          if(victim.id===socket.id||!victim.alive||(!room.config.friendlyFire&&room.mode!=="ffa"&&room.mode!=="gungame"&&victim.team===p.team))continue;
          const target:Vec3=[victim.pos[0],victim.pos[1]+1,victim.pos[2]];
          if(inFlameCone(msg.origin,dir,target,eff.range)&&hasLineOfSight(room,msg.origin,target))
            applyDamage(room,socket.id,victim,eff.damage,false,weapon.id);
        }
        // Flames remain airborne: no persistent ground fire or floor damage.
        io.to(room.id).emit("message",{t:"shotFx",origin:msg.origin,dir:shotDir,weaponId:weapon.id,attackerId:socket.id,skinId:msg.skinId,suppressed:false} as S2C);
        break;
      }
      if(weapon.wonder?.kind==="sludge"){
        const impact=serverBoltLanding(room,socket.id,msg.origin,shotDir,eff.range);
        const point:Vec3=[impact[0],p.pos[1]+.12,impact[2]];
        placeWonderField(room,p,weapon.id,"sludge",point,weapon.wonder.radius,now,8500);
        for(const victim of allCombatants(room)){
          if(victim.id===socket.id||!victim.alive||(!room.config.friendlyFire&&room.mode!=="ffa"&&room.mode!=="gungame"&&victim.team===p.team))continue;
          if(Math.hypot(victim.pos[0]-point[0],victim.pos[2]-point[2])<=weapon.wonder.radius&&
            hasLineOfSight(room,[point[0],point[1]+.5,point[2]],[victim.pos[0],victim.pos[1]+1,victim.pos[2]]))
              applyDamage(room,socket.id,victim,eff.damage,false,weapon.id);
        }
        io.to(room.id).emit("message",{t:"shotFx",origin:msg.origin,dir:shotDir,weaponId:weapon.id,attackerId:socket.id,skinId:msg.skinId,suppressed:false} as S2C);
        break;
      }
      if(weapon.wonder?.kind==="storm"){
        // One shot, seven independent electrical pellets. Every hit starts
        // its own two-jump chain; every true miss leaves a proximity mine.
        const hits=new Map<string,number>(),chains=new Map<string,number>();
        for(const pelletDir of stormPelletDirections(shotDir)){
          const contacts=stormCandidates(room,socket.id,p.team,now);
          const impact=traceStormPellet(msg.origin,pelletDir,eff.range,room.map.cover,contacts);
          // Lightning is only emitted by serverStormChain from the impact victim
          // to the next target, never as a bogus arc from the firing muzzle.
          if(impact.victim){
            const victim=allCombatants(room).find(c=>c.id===impact.victim!.id);
            if(victim?.alive){
              const count=hits.get(victim.id)??0;
              if(count<STORM_MAX_DIRECT_HITS_PER_TARGET){
                applyDamage(room,socket.id,victim,STORM_DIRECT_DAMAGE,false,weapon.id);
                hits.set(victim.id,count+1);
              }
              if(!room.ended)serverStormChain(room,socket.id,p.team,victim,
                STORM_DIRECT_DAMAGE,STORM_CHAIN_JUMPS,now,chains);
            }
          }else{
            serverPlaceStormMine(room,socket.id,p.team,
              stormMinePosition(impact.point,room.map.cover),now);
          }
          if(room.ended)break;
        }
        io.to(room.id).emit("message",{t:"shotFx",origin:msg.origin,dir:shotDir,
          weaponId:weapon.id,attackerId:socket.id,skinId:msg.skinId,
          suppressed:false} as S2C);
        break;
      }
      // Rocket launcher: SPLASH damage (AoE). Instead of a single hitscan ray,
      // compute the impact point (first cover or combatant hit along the ray)
      // and apply area-of-effect damage to all enemies within the splash radius.
      // Damage uses a quadratic falloff (full at center, ~10% at edge) + a direct-hit
      // bonus (within 1.5 units = full damage + 20% bonus).
      if (weapon.explosive || usesWonderCharges(weapon)) {
        // Normalize the direction vector so the raycast math is stable.
        const dlen = Math.hypot(shotDir[0], shotDir[1], shotDir[2]) || 1;
        const dir: Vec3 = [shotDir[0] / dlen, shotDir[1] / dlen, shotDir[2] / dlen];
        // Compute the impact point: nearest cover box OR combatant along the ray.
        let impactT = eff.range;
        const coverImpact = closestCoverHit(room.map.cover, msg.origin, dir, impactT, rayBox);
        if (coverImpact) impactT = coverImpact.distance;
        for (const e of allCombatants(room)) {
          if (e.id === socket.id || !e.alive) continue;
          if (room.config.friendlyFire === false && e.team === p.team && room.mode !== "ffa" && room.mode !== "gungame") continue;
          const center: Vec3 = [e.pos[0], e.pos[1] + PLAYER_HEIGHT / 2, e.pos[2]];
          const hit = rayCapsule(msg.origin, dir, center, PLAYER_RADIUS, PLAYER_HEIGHT);
          if (hit && hit.t >= 0 && hit.t < impactT) impactT = hit.t;
        }
        // A gravity projectile should bloom beside an enemy near the crosshair,
        // not keep flying to the distant back wall on a slight aim miss.
        if (weapon.wonder?.kind === "singularity") {
          const candidates = allCombatants(room).filter(e => e.id !== socket.id && e.alive &&
            (room.mode === "ffa" || room.mode === "gungame" || e.team !== p.team))
            .map(e => [e.pos[0], e.pos[1] + PLAYER_HEIGHT / 2, e.pos[2]] as Vec3);
          const targetT = gravityTargetDistance(msg.origin, dir, candidates, impactT);
          if (targetT !== null) impactT = Math.min(impactT, targetT);
        }
        if (weapon.wonder?.kind !== "singularity" && coverImpact?.box.environmentId && room.environmentWalls.has(coverImpact.box.environmentId) &&
            impactT >= coverImpact.distance - 1e-5) {
          damageEnvironmentWall(room, coverImpact.box.environmentId, eff.damage);
        }
        const impact: Vec3 = weapon.wonder?.kind === "singularity"
          ? gravityImpact(msg.origin, dir, impactT)
          : [msg.origin[0] + dir[0] * impactT, msg.origin[1] + dir[1] * impactT, msg.origin[2] + dir[2] * impactT];
        if (weapon.wonder?.kind === "singularity") {
          // Resolve travel from the actual floor-safe point, not the unbounded ray distance.
          const id = genId("gravity");
          const activatesAt = now + gravityTravelMs(Math.hypot(impact[0] - msg.origin[0], impact[1] - msg.origin[1], impact[2] - msg.origin[2]));
          const radius = weapon.wonder.radius;
          const expiresAt = activatesAt + GRAVITY_WELL_DURATION_MS;
          room.gravityWells.set(id, {
            ownerId: socket.id, ownerTeam: p.team, weaponId: weapon.id, pos: impact,
            radius, damage: eff.damage, activatesAt, expiresAt,
          });
          io.to(room.id).emit("message", {
            t: "gravityWell", id, ownerId: socket.id, ownerTeam: p.team,
            pos: impact, radius, activatesAt, expiresAt, serverNow:now,
          } as S2C);
        } else {
        destroyTurretsNear(room, impact, projectileSplashRadius(weapon));
        const splashRadius = projectileSplashRadius(weapon);
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
          const corrosion = weapon.wonder?.kind === "corrosion";
          // Poison only enemies near Plagueheart's detonation. Other launchers
          // deliberately preserve their flight-path splash mechanic.
          const d = corrosion
            ? corrosionImpactDistance(impact,[cx,cy,cz])
            : Math.hypot(cx-closestX,cy-closestY,cz-closestZ);
          if (d <= splashRadius) {
            const falloff = launcherSplashFactor(weapon.id,d,splashRadius);
            const splashDmg = corrosion ? corrosionImpactDamage(eff.damage, falloff) : eff.damage * falloff;
            applyDamage(room, socket.id, e, splashDmg, false, msg.weaponId);
            if (corrosion && e.alive) {
              // The impact is deliberately weak; poison does the meaningful work.
              room.poison.set(e.id, { attackerId: socket.id, weaponId: weapon.id,
                expiresAt: now + CORROSION_DURATION_MS, tickAt: now + CORROSION_TICK_MS,
                damagePerTick: corrosionTickDamage(eff.damage) });
            }
          }
        }
        } // Other explosives retain their immediate splash behavior.
      } else {
        const incendiary = weapon.category === "shotgun" && attsForShot?.magazine === "mag_dragons_breath";
        const pellets = eff.pellets ?? 1;
        const multiPelletShotgun = weapon.category === "shotgun" && !weapon.wonder && pellets > 1;
        const shotgunAds = msg.aiming ?? room.adsStartedAt.has(socket.id);
        for (let i = 0; i < pellets; i++) {
          const dir = multiPelletShotgun
            ? shotgunPelletDirection(shotDir, eff, shotgunAds)
            : pellets > 1 ? normalize(add(shotDir, randSpread(eff.spread))) : shotDir;
          // A bullet first intersects cover. Damage destructible walls instead of
          // allowing it to continue through the wall in the same pellet.
          const coverHit = closestCoverHit(room.map.cover, msg.origin, dir, maxWeaponHitRange(eff.range, eff), rayBox);
          const hits = firePenetratingRay(room, socket.id, msg.origin, dir, eff.range, eff);
          hitMaterialCover(room,msg.origin,dir,eff,hits);
          if (coverHit?.box.environmentId && room.environmentWalls.has(coverHit.box.environmentId) &&
              hits.length === 0) {
            damageEnvironmentWall(room, coverHit.box.environmentId, eff.damage);
            continue;
          }
          for (const hit of hits) {
            const baseDmg = eff.damage * (hit.head ? weapon.stats.headshotMult : 1);
            const dmg = damageAtRange(baseDmg, hit.t, eff.range, eff) * hit.damageScale;
            applyDamage(room, socket.id, hit.victim, dmg, hit.head, msg.weaponId,hit.shield);
            if (!hit.shield && incendiary && hit.victim.alive)
              room.poison.set(hit.victim.id, { attackerId:socket.id, weaponId:msg.weaponId,
                expiresAt:now+3000, tickAt:now+500, damagePerTick:2 });
            if (!hit.shield && weapon.special?.kind === "arc" && !room.ended) applyArcChains(room, p, hit.victim, eff.damage, weapon.special);
            if (!hit.shield && weapon.special?.kind === "bolt" && !room.ended && attsForShot?.barrel === "barrel_poison" && hit.victim.alive) {
              room.poison.set(hit.victim.id, { attackerId: socket.id, weaponId: msg.weaponId, expiresAt: now + 4000, tickAt: now + 500 });
            }
            if (room.ended) break;
          }
        }
      }
      if (weapon.special?.kind === "bolt" && !quiver) {
        const pos = boltImpact!;
        const id = genId("bolt");
        const expiresAt = now + weapon.special.lifetimeMs;
        room.droppedBolts.set(id, { id, ownerId: socket.id, pos, expiresAt });
        io.to(room.id).emit("message", { t: "boltDrop", id, ownerId: socket.id, pos, expiresAt } as S2C);
      }
      io.to(room.id).emit("message", { t: "shotFx", origin: msg.origin, dir: shotDir, weaponId: msg.weaponId, attackerId: socket.id, skinId: room.mode === "gungame" ? "default" : msg.skinId, suppressed: attsForShot?.barrel === "barrel_suppressor" } as S2C);
      broadcastRadarPing(room, p, attsForShot?.barrel === "barrel_suppressor");
      break;
    }
    case "chooseSurvivalUpgrade": {
      const room=rooms.get(socketToRoom.get(socket.id)??"");
      if(room?.mode!=="survival"||room.state!=="playing"||room.ended||room.waveActive||room.prepLeft<=0)return;
      if(!room.players.has(socket.id))return;
      awardSurvivalUpgrade(room,socket.id,msg.upgradeId);
      break;
    }
    case "rerollSurvivalUpgrade": {
      const room=rooms.get(socketToRoom.get(socket.id)??"");
      if(room?.mode!=="survival"||room.state!=="playing"||room.ended||room.waveActive||room.prepLeft<=0)return;
      const offer=room.survivalOffers.get(socket.id);
      if(!offer||offer.rerollsRemaining<=0)return;
      const ranks=room.survivalRanks.get(socket.id)??{};
      const choices=generateSurvivalUpgradeChoices(ranks,Math.random,offer.choices);
      const remaining=offer.rerollsRemaining-1;
      room.survivalRerolls.set(socket.id,remaining);
      room.survivalOffers.set(socket.id,{...offer,choices,rerollsRemaining:remaining});
      sendSurvivalOffer(room,socket.id);
      break;
    }
    case "reload": {
      const room = rooms.get(socketToRoom.get(socket.id) ?? "");
      if (!room) return;
      if (room.state !== "playing") return;
      const player = room.players.get(socket.id);
      if (!player?.alive) return;
      const loadout = room.loadouts.get(socket.id);
      const magazine = loadout?.secondaryWeaponId === player.weaponId
        ? loadout.secondaryAttachments?.magazine : loadout?.attachments?.magazine;
      if (room.sprintState.get(socket.id) && loadout?.perkId !== "field_loader") return;
      if (usesWonderCharges(weaponById(player.weaponId)) || isThrowingKnife(player.weaponId)) return; // Never manually reload knives or Wonders.
      if(player.weaponId==="crossbow_reclaimer"&&magazine==="mag_bolt_heavy")
        return; // heavy bolts are never replenished by standard reload
      const special = weaponById(player.weaponId).special;
      if (special?.kind === "heat") {
        const now = Date.now();
        const old = room.specialHeat.get(socket.id) ?? { ...freshHeat(), updatedAt: now, ventUntil: 0 };
        if (old.ventUntil > now) return;
        if (old.heat <= 0) return;
        const equippedAtts = loadout?.secondaryWeaponId === player.weaponId
          ? loadout.secondaryAttachments : loadout?.attachments;
        const effective = effectiveHeatConfig(weaponById(player.weaponId),equippedAtts ?? {sight:null,barrel:null,grip:null,magazine:null}) ?? special;
        room.specialHeat.set(socket.id, { ...old, ventUntil: now + effective.ventSeconds * (loadout?.perkId === "quickdraw" ? 0.8 : 1) * 1000 });
      }
      const reloadAtts = loadout?.secondaryWeaponId === player.weaponId ? loadout.secondaryAttachments : loadout?.attachments;
      const reloadStats = computeEffectiveStats(weaponById(player.weaponId),reloadAtts ?? {sight:null,barrel:null,grip:null,magazine:null});
      const reloadMul=room.mode==="survival" ? survivalReloadMultiplier(room.survivalRanks.get(socket.id)??{},Date.now()-(room.survivalLastKillAt.get(socket.id)??-Infinity)):1;
      room.reloadingPlayers.set(socket.id,Date.now()+Math.max(0,reloadStats.reloadTime*1000*reloadMul));
      io.to(room.id).emit("message", { t: "reloadFx", playerId: socket.id } as S2C);
      break;
    }
    case "recoverBolt": {
      const room = rooms.get(socketToRoom.get(socket.id) ?? "");
      if (!room || room.state !== "playing") return;
      const player = room.players.get(socket.id);
      const bolt = room.droppedBolts.get(msg.boltId);
      if (!player?.alive || !bolt || bolt.ownerId !== socket.id || Date.now() >= bolt.expiresAt) return;
      const special = weaponById("crossbow_reclaimer").special;
      if (special?.kind !== "bolt") return;
      const equipped=room.loadouts.get(socket.id);
      const arrowMag=equipped?.secondaryWeaponId==="crossbow_reclaimer"
        ? equipped?.secondaryAttachments?.magazine
        : equipped?.attachments?.magazine;
      if(arrowMag==="mag_bolt_quiver")return;
      if (Math.hypot(player.pos[0] - bolt.pos[0], player.pos[2] - bolt.pos[2]) > special.pickupRadius) return;
      room.droppedBolts.delete(bolt.id);
      const now = Date.now();
      if(arrowMag==="mag_bolt_heavy"){
        // The only source of additional heavy arrows is a retrieved arrow.
        room.boltCharges.set(socket.id,Math.min(2,(room.boltCharges.get(socket.id)??0)+1));
      }else if(now<(room.boltReadyAt.get(socket.id)??0)){
        room.boltReadyAt.set(socket.id,Math.min(room.boltReadyAt.get(socket.id)!,now+special.quickReloadSeconds*1000));
      }else{
        room.boltCharges.set(socket.id,Math.min(3,(room.boltCharges.get(socket.id)??0)+1));
      }
      io.to(room.id).emit("message", { t: "boltRecovered", id: bolt.id, ownerId: socket.id } as S2C);
      break;
    }
    case "queueLoadout": {
      const room = rooms.get(socketToRoom.get(socket.id) ?? "");
      if (!room || room.state !== "playing" || room.ended || room.mode === "gungame") return;
      const playerKey = room.playerKeys.get(socket.id);
      if (!room.players.has(socket.id) || !playerKey) return;
      // The packet is untrusted: check ownership, perks, skins and attachments
      // against the same authoritative validation as match joining.
      const loadout = await validatedMatchLoadout(playerKey, msg.loadout);
      if (!room.players.has(socket.id) || room.ended) return;
      room.pendingLoadouts.set(socket.id, loadout);
      socket.emit("message", { t: "loadoutQueued", loadout } as S2C);
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
      if (!p || !p.alive || room.downed.has(socket.id)) return;
      const loadout = room.loadouts.get(socket.id);
      if (!loadout) return;
      let newWeaponId = p.weaponId;
      if (msg.slot === "primary") newWeaponId = loadout.weaponId;
      else if (msg.slot === "secondary") {
        newWeaponId = loadout.secondaryWeaponId ?? "pistol_side";
        const selected = WEAPONS.find(w => w.id === newWeaponId);
        if (!selected) return;
        if (isPrimaryWeaponCategory(selected.category) &&
            (loadout.perkId !== "well_prepared" || selected.wonder || newWeaponId === loadout.weaponId)) return;
      }
      else if (msg.slot === "melee") newWeaponId = room.orbitalHolders.has(socket.id)?ORBITAL_REAPER_ID:(loadout.meleeWeaponId===ORBITAL_REAPER_ID?"knife_tactical":loadout.meleeWeaponId??"knife_tactical");
      else if (msg.slot === "wonder") {
        if(loadout.perkId!=="wonder_weapon" || !loadout.wonderWeaponId)return;
        const selected=WEAPONS.find(w=>w.id===loadout.wonderWeaponId);
        if(!selected?.wonder || selected.disabled)return;
        newWeaponId=selected.id;
      }
      // Validate the weapon exists.
      const w = weaponById(newWeaponId);
      if (!w) return;
      p.weaponId = newWeaponId;
      p.riotShieldRaised=false;
      room.smartTags.delete(socket.id);
      room.hellfireUntil.delete(socket.id);
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
      const loadout = await validatedMatchLoadout(msg.playerKey, msg.loadout);
      const cfg = msg.config;
      if (!teamSizeAllowed(cfg.mapId, cfg.teamSize,cfg.mode)) {
        socket.emit("message", { t: "roomError",
          message: "Choose a player count supported by this map and mode." } as S2C);
        break;
      }
      if (!mapAllowedForMode(cfg.mode, cfg.mapId)) {
        socket.emit("message", { t: "roomError", message: "This map is not available in the selected mode." } as S2C);
        break;
      }
      if (cfg.mode === "ctf" &&
          (cfg.scoreLimit ?? DEFAULT_CONFIG("ctf",0).scoreLimit) === 0 &&
          (cfg.timeLimit ?? DEFAULT_CONFIG("ctf",0).timeLimit) === 0) {
        socket.emit("message", { t: "roomError", message: "CTF needs a capture limit or a time limit." } as S2C);
        break;
      }
      if (cfg.mode === "survival") {
        const tier=normalizeSurvivalTier(cfg.survivalTier);
        if (tier !== "default") {
          try {
            const progress=await getSurvivalProgress(msg.playerKey);
            if (!survivalUnlocked(tier,progress)) {
              socket.emit("message",{t:"roomError",message:"Clear the preceding Survival milestone to unlock this tier."} as S2C);
              break;
            }
          } catch {
            socket.emit("message",{t:"roomError",message:"Unable to verify your Survival unlocks."} as S2C);
            break;
          }
        }
      }
      const room = createLobbyRoom(socket.id, msg.name, loadout, cfg);
      room.playerKeys.set(socket.id, msg.playerKey);
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
      const loadout = await validatedMatchLoadout(msg.playerKey, msg.loadout);
      const targetRoom=rooms.get(msg.roomId);
      if (targetRoom?.mode==="survival") {
        const tier=normalizeSurvivalTier(targetRoom.config.survivalTier);
        if(tier!=="default") {
          try {
            if(!survivalUnlocked(tier,await getSurvivalProgress(msg.playerKey))) {
              socket.emit("message",{t:"roomError",message:"Unlock this Survival tier before joining this room."} as S2C);
              break;
            }
          } catch {
            socket.emit("message",{t:"roomError",message:"Could not verify Survival progression."} as S2C);
            break;
          }
        }
      }
      const { room, error } = joinLobbyRoom(socket.id, msg.name, loadout, msg.roomId, msg.password ?? null, msg.team);
      if (!room || error) {
        socket.emit("message", { t: "roomError", message: error ?? "Could not join room." } as S2C);
        return;
      }
      room.playerKeys.set(socket.id, msg.playerKey);
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
        if (room.mode === "ctf") dropCarriedFlag(room, socket.id, [...(room.players.get(socket.id)?.pos ?? [0,0,0])] as Vec3);
        room.players.delete(socket.id);
       room.orbitalHolders.delete(socket.id);
        room.sockets.delete(socket.id);
        room.scores.delete(socket.id);
        room.loadouts.delete(socket.id);
        room.pendingLoadouts.delete(socket.id);
        room.playerKeys.delete(socket.id);
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
    console.info(`[VANGUARD] Game server listening on port ${port}`);
  });
  process.on("SIGTERM", () => httpServer.close(() => process.exit(0)));
  process.on("SIGINT", () => httpServer.close(() => process.exit(0)));
}
