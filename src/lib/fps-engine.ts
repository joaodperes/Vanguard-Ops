import {addOperativeSkinDetails} from "./operative-appearance";
import { captureThirdPersonDeathPose, applyThirdPersonDeathPose, resetThirdPersonDeathPose, type ThirdPersonDeathPoseStart } from "./third-person-death-pose";
import { MATCH_FINALE_DURATION_MS, MATCH_FINALE_RECENT_DEATH_MS, MATCH_FINALE_PLAYBACK_RATE, finaleDeathProgress, finalTeamScores } from "./match-finale";
import {reactorObjective,teamObjective,objectiveDistance} from "./map-objectives";
import {chooseSpawn} from "./spawn-selection";
import {botOperativeSkinId, BOT_OPERATIVE_SKINS, SURVIVAL_BOSS_SKIN_ID, bossShockwaveCharge, isSurvivalBoss} from "./bot-appearances";
import {addSurvivalBossArmor, updateSurvivalBossArmor, type SurvivalBossVisual} from "./survival-boss-visuals";
import {FLOODGATE_CORE_ID,floodgateBreached,floodgateBreachTargets,floodgateDamageTarget,floodgateWaterEffect,floodgateRouteNeedsDetour,whiteoutIntensity,whiteoutVisibility,whiteoutExposure} from "./map-battle-events";
import {buildWhiteoutSnow,updateWhiteoutSnow} from "./whiteout-weather";
// ============================================================================
// VANGUARD OPS — Three.js FPS engine (vanilla, no R3F)
// Supports OFFLINE (local bots, client-authoritative) and ONLINE (socket.io,
// server-authoritative) modes. Renders arena, weapons, other players, HUD data.
// ============================================================================
import { clusterShots, clusterPositionAt, clusterDamage, clusterLifetime, CLUSTER_ID, CLUSTER_MAX_DAMAGE, type ClusterVolley } from "./cluster-grenades";
import { RIOT_SHIELD_ID, RIOT_SHIELD_HP, RIOT_SHIELD_RECHARGE_MS, rayRiotShield, damageRiotShield, shieldBlocksFire, hitRiotShield, tickRiotShield, accelerateRiotShield, riotShieldCooldownMs, riotBashProfile, RIOT_BASH_KNOCKBACK } from "./riot-shield";
import { usesWonderCharges } from "./game-data";
import { createRiotShieldModel, applyRiotShieldDamageVisual } from "./riot-shield-model";
import { shieldPanel } from "./riot-shield";
import * as THREE from "three";
import { ExplosionEffects } from "./explosion-effects";
import { regionRectangles } from "./map-blueprints";
import { cityInteriorFixtures, CITY_USE_FACADE_COLORS, CITY_FACADE_TINTS } from "./map-visuals";
import { containerSideStripes } from "./container-details";
import {buildFactoryMachinery,isFactoryMachineKind} from "./factory-machinery";
import {buildSteamVent,updateSteamVent} from "./steam-vent-visuals";
import {whiteoutWeatherStatus,type MapEventStatus} from "./map-event-status";
import {ctfDeliveryMarker} from "./ctf-map-visuals";
import {buildFloodgateBackdrop,setFloodgateBreachVisual,setFloodgatePurgeVisual,updateFloodgateBreachVisual} from "./floodgate-scenery";
import {buildFloodgateColorDressing} from "./floodgate-color-dressing";
import {buildFloodgateFreight,updateFloodgateFreight,setFloodgateFreightStage,floodgatePathHazards} from "./floodgate-topple";
import {buildFloodgateDamCracks,updateFloodgateDamCracks} from "./floodgate-dam-cracks";
import { createMapSurfaceMaterials, createPatternedMaterial, mapBoxUV, mapFloorUV, type MapSurfaceMaterials } from "./map-materials";
import { coolHeat, addHeat, freshHeat, nextArcTarget, burstShotIntervalMs, type HeatState, type ArcCandidate } from "@/lib/weapon-mechanics";
import { io as ioClient } from "socket.io-client";
import { resolveGameServerConnection } from "@/lib/game-network";
import { equipmentById } from "@/lib/equipment"; // legacy equipment models remain unused
import { friendlyOnRadar, canHearGunshot, shouldRevealGunshot, radarExpiresAt, radarDurationMs, radarToPercent, trackedRadarPosition } from "@/lib/radar";
import { quickSwapTarget } from "./quick-swap";
import { explonandoDamage, explonandoCanHit, EXPLO_FUSE_MS } from "./explonando";
import { canCollectScavengerDrop, shouldCreateScavengerDrop } from "./scavenger-pickups";
import { chooseQuickMeleeTarget, quickMeleeProfile } from "./quick-melee";
import { THROWING_KNIFE_RANGE, THROWING_KNIFE_SPEED, fullThrowingKnives, isThrowingKnife, spendThrowingKnife, tickThrowingKnives, throwingKnifeRemainingMs, type ThrowingKnifeCharges } from "./throwing-knives";
import { rayCombatantHit } from "./combat-hitboxes";
import { selectBodyPenetrationHits, type BodyRayContact } from "./body-penetration";
import { launcherSplashFactor } from "./launcher-effects";
import { meleeSwingPose } from "./melee-styles";
import { adsClearance } from "./viewmodel-clearance";
import { buildMeleeWeaponParts } from "./melee-model";
import { automaticBloom } from "./automatic-spread";
import { fullWonderCharges, drainedWonderCharges, tickWonderCharges, spendWonderCharge, spendHellfireFuelOnShot, accelerateWonderCharge, wonderCooldownMs, type WonderChargeRules, type WonderChargeState } from "./wonder-charge";
import { selectSmartTarget, selectSmartTargets, SMART_MAX_TAGS, SMART_TAG_MS, HELLFIRE_FUEL_STEP_MS, HELLFIRE_RANGE, inFlameCone, sludgeMovementFactor } from "./wonder-tech";
import { botTactics, botDetectionRange, botWantsCombatJump, botCornerScan } from "./bot-difficulty";
import { botHasJumpClearance } from "./bot-physics";
import { botMoveMultiplier, botDecisionDelay, botReactionDelay, botTurnLerp, botAimDriftMultiplier } from "./bot-difficulty";
import { perkById, reloadDurationMultiplier, regenDelayMs, sprintDrainMultiplier, recoilMultiplier, swayMultiplier, scavengerAmmoAmount, SCAVENGER_PICKUP_RADIUS, SCAVENGER_DROP_LIFETIME_MS, SCAVENGER_PICKUP_ARM_MS } from "@/lib/perks";
import { calculateThrowPath, type ThrowPath } from "@/lib/throw-trajectory";
import { sampleReloadMotion, sampleDeployMotion, sampleWeaponSwapMotion, sampleRiotShieldSwapMotion, WEAPON_SWAP_VISUAL_MS, WEAPON_SWAP_HANDOFF, reloadMotionFor, equipmentMotionFor, deployDurationMs, supportHandRestMode, supportActionWeight, usesCompactSupportArm, supportElbowPosition, supportArmFraming, SUPPORT_UPPER_ARM_LENGTH, SUPPORT_FOREARM_LENGTH, SUPPORT_SIDEARM_UPPER_LENGTH, SUPPORT_SIDEARM_FOREARM_LENGTH, type DeployMotion, type ReloadMotion, type ActionPose } from "@/lib/first-person-animation";
import { buildGunGameWeapons, canCompleteGunGame, gunGameMeleeShortcutWeapon } from "@/lib/gun-game";
import { chooseBotPatrolPoint } from "@/lib/bot-patrol";
import { botNextWaypoint, botHighGroundWaypoint, botEntersHazard } from "@/lib/bot-routing";
import { CoverSpatialIndex } from "@/lib/cover-spatial-index";
import {cityHighGroundGoals,chooseCityHighGroundGoal,cityHighGroundStep,type HighGroundGoal} from "@/lib/city-high-ground";
import { cityCoverKey, hiddenCityColliderKeys } from "./city-render-colliders";
import { turretCanTrack, turretCanAttack, turretDeployPosition, TURRET_DAMAGE, TURRET_INTERVAL_MS, TURRET_LIFETIME_MS, TURRET_MUZZLE_HEIGHT, TURRET_HP } from "./turret-rules";
import { buildBulletSpitterModel } from "./bullet-spitter-model";
import { createFiringRangeMap, RANGE_TARGETS, RANGE_MOVING_TARGETS, movingRangeTargetPosition } from "./firing-range";
import { gravityTravelMs, gravityPullOffset, gravityBlastDamage, gravityImpact, gravityTargetDistance, gravityClientTime, GRAVITY_WELL_DURATION_MS, GRAVITY_WELL_RADIUS } from "./gravity-well";
import { corrosionImpactDamage, corrosionTickDamage, corrosionImpactDistance, CORROSION_DURATION_MS, CORROSION_TICK_MS } from "./corrosion-damage";
import { stormPelletDirections, traceStormPellet, stormMinePosition, stormMineInReach, stormEnemy, stormTargetPoint, nextStormChainTarget, STORM_MINE_ARM_MS, STORM_MINE_LIFETIME_MS, STORM_MAX_MINES_PER_OWNER, STORM_MINE_TARGET_COOLDOWN_MS, STORM_MAX_DIRECT_HITS_PER_TARGET, STORM_DIRECT_DAMAGE, STORM_MINE_DAMAGE, STORM_CHAIN_JUMPS, STORM_MINE_JUMPS, STORM_CHAIN_DECAY, STORM_MINE_CHAIN_RADIUS, type StormVictim } from "./stormweaver";
import { advanceKillChain, type KillChainState } from "./kill-chain";
import { isFlagDefenseKill, largestScoreDeficit } from "./match-bonus-tracking";
import { advanceIncrementalReload } from "./incremental-reload";
import { shotSpread, shotBloomIncrease, recoilKickRadians } from "./weapon-accuracy";
import { shotgunPelletDirection, shotgunConeRadians } from "./shotgun-pattern";
import { normalizeSurvivalTier, survivalWaveMutators, survivalWavesCleared, survivalBotDifficulty, type SurvivalTier } from "./survival";
import { botCombatDecision, botPatrolSprint, botShotSpread } from "./bot-combat-posture";
import { botRememberSighting, botInvestigation, botCanHearNoise, botRememberNoise, botRememberHit, botAlertInvestigation, type BotNoise, type BotAlert, type BotSighting } from "./bot-awareness";
import { botArchetypeForSlot, botArchetypeForCategory, botArchetypeWeapon, botArchetypeWeapons, BOT_ELIGIBLE_WEAPONS, botPersonality, botArchetypeHighGroundChance, type BotArchetype } from "./bot-archetypes";
import { MOVEMENT, allowsAdsWhileSprinting, shouldTouchAutoSprint, responsiveHorizontalVelocity, canUseBufferedJump, runJumpTakeoffVelocity } from "@/lib/movement-rules";
import { FOREST_OBJECTS, FOREST_PERIMETER, FOREST_BASE_COVER, FOREST_TREE_PARAPETS } from "./forest-warfare";
import { advanceMatchElapsed } from "./match-clock";
import {ORBITAL_REAPER_ID,orbitalRecordKill,orbitalCanClaim,orbitalGravity,orbitalBotShouldContest,orbitalBotDeckGoal,orbitalServerWarning,orbitalPulseTargets,ORBITAL_PULSE_DAMAGE,ORBITAL_PULSE_RADIUS,ORBITAL_REAPER_SPEED_MULTIPLIER,ORBITAL_REAPER_STAMINA_DRAIN_MULTIPLIER,ORBITAL_REAPER_JUMP_MOMENTUM_MULTIPLIER,orbitalReaperEquipped} from "./orbital-reactor";
import { CTF_SPEED_MULTIPLIER, ctfCarrierWeaponSpeed, createCtfFlags, ctfDrop, ctfTouch, ctfReturnExpired, ctfBotIntent, ctfStairWaypoint, ctfDefenderScanYaw, ctfEngageThreat, ctfResetMs, ctfBase, ctfHome, ctfWithin, flagAtHome, otherFlag, type CtfFlags, type FlagTeam } from "./ctf-rules";
import {
  getMap, MAP_LIST, rayBox, rayCapsule, PLAYER_RADIUS, PLAYER_HEIGHT, EYE_HEIGHT, MAX_HEALTH, RESPAWN_DELAY_MS,
  SURVIVAL_PREP_SEC, SURVIVAL_RESPAWN_MS, survivalWaveBotCount, survivalWaveHealthMul, survivalWaveDamageMul,
  GUN_GAME_PROGRESSION, GUN_GAME_TYPE_PROGRESSION, KC_TAG_LIFETIME_MS, KC_PICKUP_RADIUS, killConfirmedPickupPoints,
  type Vec3, type LoadoutWire, type GameMode, type MapId, type MapDef, type SnapshotPlayer, type S2C, type KillFeedEntry, type CoverBox, type BotDifficulty, type KillDifficulty, type KillConfirmedTag,
} from "@/lib/game-protocol";
import {
  weaponById, weaponSkinById, playerSkinById, computeEffectiveStats, effectiveHeatConfig, damageAtRange, maxWeaponHitRange, projectileSplashRadius,
  SIGHT_DEFS, sightDefForType, hasMountedSight, adsFieldOfView, weaponSlot, WEAPONS, weaponAttachmentSlots,
  type AttachmentSlot, type EffectiveStats, type SightType, type SightDef,
  type WeaponSlot, type WeaponDef, type WeaponCategory, type WeaponConditionMetric,
} from "@/lib/game-data";
import { SoundManager } from "@/lib/sound";
import { ctfFeedback, type CtfAction } from "./ctf-feedback";
import { WeaponAudio, type WeaponSoundCategory } from "@/lib/weapon-audio";
import { audioGainLevels, DEFAULT_AUDIO_MIX } from "./audio-mix";
import { buildFirstPersonWeapon, weaponHoldPoints, firstPersonSupportGrip, WEAPON_VISUALS } from "@/lib/weapon-models";
import { createWeaponCharm, swingWeaponCharm, weaponCharmMountPoint } from "@/lib/weapon-charms";
import { canStartWeaponReload } from "@/lib/weapon-mechanics";
import { cosmeticById } from "@/lib/cosmetics";
import { coatsAllWeaponParts } from "@/lib/weapon-finish";
import {
  makeEnvironmentMap, moveEnvironmentCover, breakEnvironmentWall, environmentPosition,
  withinEnvironment, spikesActive, periodicHazardPhase, closestCoverHit, lavaAt, LAVA_DEATH_SOURCE,
} from "@/lib/dynamic-environment";
import { buildLavaSurface } from "./lava-surface";
import {
  BOT_STEP_HEIGHT, botGroundHeight, botMoveBlocked as blocksBotMotion,
  resolveBotOverlap, botNextFeetY,
} from "@/lib/bot-physics";

export interface LobbyState {
  active: boolean;        // true while the room is in the "lobby" phase (pre-match)
  isHost: boolean;        // whether the local player is the room host (can start)
  players: SnapshotPlayer[];  // current lobby roster (humans only — no bots in lobby)
  roomName: string;
}

export interface EngineOptions {
  mode: GameMode;
  gungamePreset?: "all" | "cqc" | "long_range";
  gungameMultiplier?: number;
  botCount: number;
  online: boolean;
  /** Offline-only, non-rewarding equipment preview with stationary targets. */
  firingRange?: boolean;
  /** Unsaved offline Map Studio scene. Never accepted for online matches. */
  previewMap?: MapDef;
  loadout: LoadoutWire;
  playerName: string;
  playerKey: string;
  team: "red" | "blue" | "ffa";
  socketPort: number;
  mapId: MapId;
  onHud: (hud: HudState) => void;
  onKillFeed: (e: KillFeedEntry) => void;
  onMatchEnd: (r: MatchEndResult) => void;
  onReady: () => void;
  onRoomError?: (message: string) => void;   // fired when the server rejects a createRoom/joinRoom
  onLobbyState?: (state: LobbyState) => void; // fired when the lobby overlay should show/hide/update
  onSocketError?: () => void;   // Round 20a: fired when the socket can't connect (deploy without game server)
  // optional user-tunable settings
  sensitivity?: number;        // multiplier on base sensitivity, default 1.0
  fov?: number;                // 70..110, default 75
  scoreLimit?: number;         // kills to win, default 30 (ffa) / 60 (tdm)
  timeLimitSec?: number;       // default 360
  denialScoreEnabled?: boolean; // award +1 point for denying a friendly tag in offline play
  startedAt?: number;          // performance.now() at match start
  autoAdsOnFire?: boolean;     // automatically ADS when firing (default false)
  invertY?: boolean;           // invert vertical look (default false)
  survivalTier?: SurvivalTier;
  botDifficulty?: BotDifficulty;  // scales bot skill ("mixed" rolls per bot), default "normal"
  masterVolume?: number;       // 0..100, default 80. Scales every audio bus.
  footstepVolume?: number;     // 0..100, relative to master
  fxVolume?: number;           // 0..100, relative to master (including WeaponAudio)
  // Room lobby: when set, the engine sends createRoom/joinRoom instead of joinMatch.
  roomConnect?: {
    kind: "create" | "join";
    config?: import("./game-protocol").CreateRoomConfig;
    roomId?: string;
    password?: string | null;
    roomName?: string;
    team?: "red" | "blue" | "auto";  // requested team for joinRoom (TDM only)
  };
}

export interface HudState {
  health: number;
  maxHealth: number;
  ammo: number;
  magSize: number;
  reloading: boolean;
  heat?: number;
  overheated?: boolean;
  boltCharges?: number;
  knifeRechargeMs?: number;
  perkName?: string;
  scavengerFeedbackAt?: number;
  scavengerAmmoGained?: number;
  scavengerPacksNearby?: number;
  matchEnding?: string;
  quickMeleeAt?: number;
  equipmentName?: string;
  equipmentCharges?: number;
  flashRemainingMs?: number;
  weaponName: string;
  weaponId: string;
  alive: boolean;
  respawnIn: number;
  kills: number;
  deaths: number;
  score: number;
  teamScores: { red: number; blue: number };
  playerTeam?: string; // authoritative viewer team, also available before scoreboard synchronization
  ctfFlags?: CtfFlags;
  orbitalCharge?: number;
  orbitalKillsRequired?:number;
  orbitalReaper?: boolean;
  orbitalWarning?: string;
  mapEvent?: MapEventStatus;
  ctfCarrying?: boolean;
  ctfOvertime?: boolean;
  ctfFlagResetMs?: number;
  ctfNotice?: { label: string; at: number };
  ctfZoneError?: string;
  scoreLimit?: number;  // Kill target (or confirmed tags for Kill Confirmed)
  timeLimitSec?: number; // Room's configured duration (not the countdown)
  confirmations?: number;
  denials?: number;
  denialScoreEnabled?: boolean;
  tagNotice?: { action: "confirm" | "deny"; at: number };
  timeLeft: number;
  unlimitedTime: boolean;
  elapsedSeconds: number;
  scoreboard: ScoreRow[];
  killFeed: KillFeedEntry[];
  lastDeath?: { killer:string; weaponId:string; attachments:string[] };
  lastElimination?: { at: number; victim: string; headshot: boolean };
  hitMarker: number;     // timestamp of last hit
  headshotMarker?: number;  // Round 20g: timestamp of last headshot hit (distinct visual)
  damageFlash: number;   // timestamp of last damage taken
  riotShieldHitFlash?: number; // softer impact cue when Bulwark absorbs a bullet
  pointerLocked: boolean;
  ping: number;
  // killstreak callout (timestamp + label) — set when player achieves multi-kill
  killstreak?: { at: number; label: string; color: string; icon: string };
  // damage direction indicator (radians, 0 = front)
  damageDir?: number;
  damageDirAt?: number;
  // map info for HUD
  mapName: string;
  aiming: boolean;
  // equipped sight type (lets the HUD render the right reticle/scope overlay)
  sightType: SightType;
  // ADS progress 0..1 (lets HUD fade in the scope overlay smoothly)
  adsProgress: number;
  // True ONLY when the local player is meaningfully ADS-ing with a sniper-class
  // weapon (adsProgress past the scope-in threshold). Drives the dedicated
  // sniper-scope HUD overlay (black vignette + crosshair). Decoupled from
  // `sightType` so it triggers for any sniper regardless of equipped sight.
  scoped: boolean;
  // Round 20h: Local player spawn protection (for first-person shield overlay).
  selfSpawnProtected?: boolean;
  radar?: { size: number; playerX: number; playerZ: number; yaw: number; regions?: { x: number; z: number; w: number; h: number }[]; lava?: { x: number; z: number; w: number; h: number }[]; cover: { x: number; z: number; w: number; h: number }[]; markers: { id: string; x: number; z: number; kind: "ally" | "fire" }[] };
  // Dynamic crosshair spread: 0 = tight, 1 = max bloom. Driven by movement,
  // sprinting, jumping, firing — the HUD uses this to size the crosshair gap.
  spreadFactor: number;
  // Whether the player is currently sprinting (drives HUD sprint indicator +
  // weapon-sway visual on the viewmodel).
  sprinting: boolean;
  // Health-regen cooldown: ms since the player last took damage. Regen only
  // starts after REGEN_DELAY (5s). The HUD shows a "regen in Xs" ring while
  // waiting, and a healing pulse when regen is active.
  regenCooldownMs: number;   // 0 when regen is active, > 0 while waiting
  // Sprint stamina (0..100). Drains while sprinting, regens after a short delay
  // when not sprinting (like health regen, but faster). At 0 stamina, sprint is
  // blocked until stamina regens above a small threshold.
  stamina: number;
  staminaCooldownMs: number;  // 0 when regen is active, > 0 while waiting
  // Equipped weapon slot. Drives the HUD's weapon-slot indicator (1/2/3).
  weaponSlot: WeaponSlot;
  // Per-slot weapon names (so the HUD can show all three slots' weapons).
  primaryName: string;
  secondaryName: string;
  meleeName: string;
  wonderName?: string;
  // Per-slot weapon IDs (so the HUD can show a category-color dot per slot).
  primaryWeaponId: string;
  secondaryWeaponId: string;
  meleeWeaponId: string;
  wonderWeaponId?: string;
  wonderCharges?: number;
  wonderChargeMax?: number;
  wonderSlotCooldownMs?: number;
  wonderShieldHp?: number;
  wonderShieldRechargeMs?: number;
  riotShieldHp?: number;
  riotShieldRaised?: boolean;
  riotShieldRechargeMs?: number;
  wonderRechargeMs?: number;
  turretDeployPending?: boolean;
  turretDeployFailed?: boolean;
  // survival mode info (undefined for FFA/TDM)
  survivalWave?: number;
  survivalTier?: SurvivalTier;
  survivalModifierNames?: string[];
  survivalBossWave?: boolean;
  survivalEnemiesLeft?: number;
  survivalReinforcements?: number;
  survivalMaxReinforcements?: number;
  survivalDowned?: boolean;
  survivalWaitingForWave?: boolean;
  survivalPrepLeft?: number;
  survivalWaveActive?: boolean;
  // Round 18-b: wave banner — timestamp (ms) when the current wave started.
  // The HUD shows a "WAVE N — X enemies incoming" banner for ~3.5s after this.
  survivalWaveBannerAt?: number;
  // Gun Game progression (gungame mode only). Undefined for non-gungame modes.
  // `gungameIndex` is 0-based (the tier the local player is currently on);
  // `gungameTotal` is the progression length (number of weapons to cycle).
  // `gungameWeapons` is the actual per-match weapon ID list (so the HUD can
  // render the exact tier strip — different matches have different lists).
  gungameIndex?: number;
  gungameTotal?: number;
  gungameWeapons?: string[];
  // ---- Pre-match countdown ----
  // When > 0, the match is in a "get ready" phase before gameplay begins.
  // The HUD renders a big centered countdown (5..4..3..2..1..GO!) and the
  // engine suppresses player input, bot AI, firing, and the match timer.
  // Set to 5 on match start (offline constructor / online matchStarted).
  preMatchCountdown?: number;
}

export interface ScoreRow {
  id: string; name: string; team: string; kills: number; deaths: number; score: number; isBot: boolean; isSelf: boolean;
}

export interface MatchEndResult {
  kills: number; deaths: number; headshots: number; assists?: number; won: boolean; score: number; mode: GameMode;
  standings: { id: string; name: string; team: string; kills: number; deaths: number; score: number; assists?: number; isBot: boolean }[];
  durationSec?: number;
  completed?: boolean; // natural finish or early exit
  placement?: number;
  multikills?: number;
  // Highest chain with at most five seconds between consecutive kills.
  // Drives the player's lifetime bestKillstreak stat
  // (Triple Threat / Killstreak King / Untouchable Force achievements).
  bestStreak?: number;
  maxNoDeathStreak?: number;
  defenseKills?: number;
  flagReturns?: number;
  maxScoreDeficit?: number;
  participants?: number;
  weaponId?: string;
  survivalWaves?: number;
  survivalTier?: SurvivalTier;
  // Per-kill difficulty breakdown (one entry per kill). Used by the rewards API
  // to scale XP/credits by victim difficulty. Values: easy|normal|hard|veteran|enemy_player.
  killDifficulties?: string[];
  // Per-weapon kill/headshot tallies for the match. In Gun Game the player cycles
  // through every weapon in GUN_GAME_PROGRESSION, so we attribute each kill to the
  // weapon actually held when the kill was scored (instead of attributing all
  // kills to the match-start weapon). The rewards API uses this map to evaluate
  // per-weapon skin challenges for EVERY weapon the player used — so the
  // Breacher's "Close Quarters" challenge progresses on gungame shotgun kills.
  // Undefined for non-gungame modes (legacy callers); the API falls back to
  // attributing all kills to `weaponId`.
  perWeaponKills?: Record<string, { kills: number; headshots: number }>;
  perWeaponActions?: Record<string, Partial<Record<WeaponConditionMetric, number>>>;
  confirmations?: number;
  denials?: number;
}

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
  attachments: Record<AttachmentSlot, string | null>;
  // vertical navigation: try to climb to high ground when target is above
  wantsHighGround: boolean;
  highGroundPatrol?:HighGroundGoal|null;
  highGroundExpiresAt?:number;
  // reaction delay before first shot at a newly-acquired target (ms timestamp)
  acquiredTargetAt: number;
  // ---- Humanization fields ----
  // Per-bot skill (0..1). Lower = more missed shots, slower reaction, worse tracking.
  skill: number;
  // Burst fire: for auto weapons, fire N rounds then pause. Tracks remaining burst shots
  // and the timestamp when the next burst may start.
  burstShotsLeft: number;
  burstEndsAt: number;
  // Spray drift: accumulates while firing (simulating uncompensated recoil). Decays
  // when not firing. Applied as extra yaw/pitch offset on each shot.
  sprayDriftYaw: number;
  sprayDriftPitch: number;
  // Last fired timestamp — used to detect sustained fire for drift accumulation.
  lastFiredAt: number;
  // Aim error: a slow-varying random offset added to the bot's aim. Simulates the
  // imprecision of a human tracking a moving target.
  aimErrorYaw: number;
  aimErrorPitch: number;
  nextAimErrorAt: number;
  // Reload intent: bots reload earlier than empty when safe.
  wantsReload: boolean;
  // The resolved difficulty for this bot (never "mixed" — that's rolled at
  // spawn time into one of easy/normal/hard/veteran). Used for rewards scaling.
  difficulty: Exclude<BotDifficulty, "mixed">;
  archetype: BotArchetype;
  ctfGuarding?: boolean;
  idleLookYaw?: number;
  // ---- Stuck detection / recovery ----
  // Tracks when the bot started being stuck (ms timestamp). 0 = not stuck.
  // Each tick we measure how far the bot moved since lastPosX/lastPosZ; if it
  // barely moved (< 0.05 units) despite having a movement intent, we mark it
  // stuck. If still stuck after 1.2s, force a recovery (new wander target +
  // sideways nudge) so bots never jam forever against a wall/corner.
  stuckSince: number;
  nextRouteAt?: number;
  routeWaypoint?: Vec3 | null;
  lastPosX: number;
  lastPosZ: number;
  nextCombatJumpAt?:number;
  cornerUntil?:number;
  nextCornerAt?:number;
  envJumpVelocityY?: number;
  envLaunchX?: number;
  envLaunchZ?: number;
}

interface Combatant {
  id: string;
  name: string;
  team: string;
  isBot: boolean;
  isSelf: boolean;
  perkId?: string;
  pos: Vec3;
  yaw: number;
  pitch: number;
  health: number;
  alive: boolean;
  weaponId: string;
  weaponSkinId: string;
  playerSkinId: string;
  charmId?: string;
  nameplateId?: string;
  kills: number;
  deaths: number;
  score: number;
  // local (offline bots) AI fields
  ai?: BotAI;
  group?: THREE.Group;
  nameSprite?: THREE.Sprite;
  healthBar?: THREE.Mesh;
  healthBarBg?: THREE.Mesh;
  bossMaxHealth?: number;
  bossCharge?: number;
  bossVisual?: SurvivalBossVisual;
  skinMaterial?: THREE.MeshStandardMaterial;
  thermalOverlays?: THREE.Mesh[];
  // humanoid animation parts
  parts?: HumanoidParts;
  walkPhase?: number;
  lastFireRecoil?: number;
  // team ring at feet
  teamRing?: THREE.Mesh;
  // Friendly chevron: a floating diamond above the head for teammates (TDM).
  // Helps players distinguish friendlies from enemies at a glance, even at range.
  friendlyMarker?: THREE.Mesh;
  // Death animation: timestamp when the combatant died (mesh still visible
  // while the fall animation plays out). 0 = not dead / no anim playing.
  deathAnimAt?: number;
  deathAnimDur?: number;   // total duration of the fall animation (ms)
  deathPoseStart?: ThirdPersonDeathPoseStart; // held weapon/arm pose captured at the instant of death
  // Gun Game progression (offline gungame only) — 0-based tier index into
  // GUN_GAME_PROGRESSION. Undefined for non-gungame matches.
  gungameIndex?: number;
  // Round 19e: Spawn protection — timestamp (ms, Date.now()) until which this
  // combatant is immune to damage. Set by the server on spawn/respawn. The
  // client reads it from snapshots and shows a shield aura while active.
  spawnProtectedUntil?: number;
  // Shield mesh for spawn protection visual (created in addCombatantMesh,
  // toggled in updateCombatantMeshes).
  riotShieldHp?: number;
  riotShieldRaised?: boolean;
  riotShieldReadyAt?: number;
  riotShieldModel?: THREE.Group;
  shieldMesh?: THREE.Mesh;
}

interface HumanoidParts {
  root: THREE.Group;       // same as c.group
  torso: THREE.Object3D;
  head: THREE.Object3D;
  upperArmL: THREE.Object3D;
  upperArmR: THREE.Object3D;
  lowerArmL: THREE.Object3D;
  lowerArmR: THREE.Object3D;
  upperLegL: THREE.Object3D;
  upperLegR: THREE.Object3D;
  lowerLegL: THREE.Object3D;
  lowerLegR: THREE.Object3D;
  weaponStub: THREE.Object3D;
  /** Weapon-relative hand targets. Both arms are solved against these each frame. */
  weaponHoldRight: THREE.Vector3;
  weaponHoldLeft: THREE.Vector3;
  weaponBase: THREE.Vector3;
  weaponMat: THREE.MeshStandardMaterial;
  bodyMat: THREE.MeshStandardMaterial;
}

// The character is 1.8m tall. Two slightly articulated 42cm segments reach
// the handgun grip and the rear handguards of even the longest weapons.
const BOT_UPPER_ARM_LENGTH = 0.42;
const BOT_FOREARM_LENGTH = 0.42;
const BOT_WEAPON_VISUAL_SCALE = 0.72;

/**
 * Solve a two-segment arm in character-local space. The shoulder pivot has
 * a child at local (0, -upperLength, 0) for the elbow, and the glove at local
 * (0, -forearmLength, 0). Both meshes therefore follow the same IK target.
 *
 * An outward/backward elbow preference avoids the elbows passing through the
 * chest, while preserving a plausible elbow bend during weapon recoil.
 */
function poseBotArm(
  shoulder: THREE.Object3D,
  forearm: THREE.Object3D,
  target: THREE.Vector3,
  side: 1 | -1,
): void {
  const origin = shoulder.position;
  const toTarget = target.clone().sub(origin);
  const distance = Math.max(0.001, toTarget.length());
  const dir = toTarget.multiplyScalar(1 / distance);
  const reach = Math.min(distance, BOT_UPPER_ARM_LENGTH + BOT_FOREARM_LENGTH - 0.001);

  // Bend the elbow to the outside of the body and slightly rearward/down.
  const outward = new THREE.Vector3(side * 0.85, -0.60, -0.45);
  outward.addScaledVector(dir, -outward.dot(dir));
  if (outward.lengthSq() < 0.00001) outward.set(side, 0, 0);
  outward.normalize();

  const toward = (reach * reach + BOT_UPPER_ARM_LENGTH ** 2 - BOT_FOREARM_LENGTH ** 2) / (2 * reach);
  const sideways = Math.sqrt(Math.max(0, BOT_UPPER_ARM_LENGTH ** 2 - toward * toward));
  const elbow = origin.clone().addScaledVector(dir, toward).addScaledVector(outward, sideways);
  const upperDir = elbow.sub(origin).normalize();
  const boneDown = new THREE.Vector3(0, -1, 0);
  shoulder.quaternion.setFromUnitVectors(boneDown, upperDir);

  // For an unreachable target, point the wrist at the closest reachable point.
  const reachableHand = origin.clone().addScaledVector(dir, reach);
  const elbowPosition = origin.clone().addScaledVector(upperDir, BOT_UPPER_ARM_LENGTH);
  const lowerDir = reachableHand.sub(elbowPosition).normalize();
  lowerDir.applyQuaternion(shoulder.quaternion.clone().invert());
  forearm.quaternion.setFromUnitVectors(boneDown, lowerDir);
}

// Shared limb-inclusive humanoid ray collision (see combat-hitboxes.ts).

// ---- Vertical collision helpers -------------------------------------------
// Returns the highest walkable surface at (x,z) that is at or below feetY + stepTolerance.
function groundHeightAt(cover: CoverBox[], x: number, z: number, feetY: number, radius: number): number {
  let ground = 0; // arena floor
  for (const cov of cover) {
    const cx = cov.pos[0], cz = cov.pos[2];
    const hx = cov.size[0], hz = cov.size[2];
    const topY = cov.pos[1] + cov.size[1];
    // Only consider surfaces the player can stand on (top of box), within step reach
    if (topY > feetY + BOT_STEP_HEIGHT) continue; // same step capability as server/local bots
    if (topY <= ground) continue;
    if (Math.abs(x - cx) < hx + radius * 0.5 && Math.abs(z - cz) < hz + radius * 0.5) {
      ground = topY;
    }
  }
  return ground;
}

export class FPSEngine {
  private container: HTMLElement;
  private opts: EngineOptions;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  // Timer replaces deprecated THREE.Clock. Advance it once per animation frame.
  private timer = new THREE.Timer();
  private raf = 0;
  private disposed = false;

  // current map
  private map: MapDef;
  private staticCoverIndex: {source:CoverBox[];index:CoverSpatialIndex}|null=null;
  private highGroundCache:{source:MapDef["props"];goals:HighGroundGoal[]}|null=null;
  // Decorative interior detail is distance-culled; collision never is.
  private cityInteriorDetailGroups:{node:THREE.Group;x:number;z:number}[]=[];
  private nextCityDetailUpdate=0;
  private cityFrameMs=16.7;
  private nextCityQualityCheck=0;
  private cityResolutionScale=1.35;
  private updateCityRenderBudget(now:number,elapsedMs:number){
    if(this.map.biome!=="city"&&this.map.biome!=="city_day")return;
    // Exclude parked tabs and abnormal tab-switch catch-up times.
    if(elapsedMs<=0||elapsedMs>=120)return;
    this.cityFrameMs=this.cityFrameMs*.94+elapsedMs*.06;
    if(now<this.nextCityQualityCheck)return;
    this.nextCityQualityCheck=now+1800;
    const next=this.cityFrameMs>28?Math.max(.75,this.cityResolutionScale-.15):
      this.cityFrameMs<18?Math.min(1.35,this.cityResolutionScale+.10):this.cityResolutionScale;
    if(Math.abs(next-this.cityResolutionScale)>.005){
      this.cityResolutionScale=next;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,next));
    }
  }
  private updateCityDetailVisibility(now:number){
    if(now<this.nextCityDetailUpdate)return;
    this.nextCityDetailUpdate=now+350;
    const x=this.camera.position.x,z=this.camera.position.z;
    for(const item of this.cityInteriorDetailGroups)
      item.node.visible=Math.abs(item.x-x)<52&&Math.abs(item.z-z)<52;
  }
  private highGroundGoals():HighGroundGoal[]{
    if(this.map.biome!=="city"&&this.map.biome!=="city_day")return [];
    if(this.highGroundCache?.source!==this.map.props)
      this.highGroundCache={source:this.map.props,goals:cityHighGroundGoals(this.map.props??[])};
    return this.highGroundCache!.goals;
  }
  /** Reuse immutable broadphase for city movement and AI, never for dynamic cover. */
  private coverIndex():CoverSpatialIndex|null{
    if(this.map.biome!=="city"&&this.map.biome!=="city_day")return null;
    if(this.staticCoverIndex?.source!==this.map.cover)
      this.staticCoverIndex={source:this.map.cover,index:new CoverSpatialIndex(this.map.cover)};
    return this.staticCoverIndex!.index;
  }
  private coverNear(x:number,z:number,pad=3):CoverBox[]{
    return this.coverIndex()?.near(x,z,pad)??this.map.cover;
  }
  private coverAlong(a:Vec3,b:Vec3,pad=2):CoverBox[]{
    return this.coverIndex()?.along(a[0],a[2],b[0],b[2],pad)??this.map.cover;
  }
  private surfaceMaterials: MapSurfaceMaterials | null = null;
  private gardenMaterial: THREE.MeshStandardMaterial | null = null;
  private environmentTime = 0;
  private environmentWalls = new Map<string, number>();
  private floodgateBackdrop:THREE.Group|null=null;
  private floodgateFreight:THREE.Group|null=null;
  private floodgateBreachAt:number|null=null;
  private whiteoutSnow:THREE.Points|null=null;
  private environmentMeshes = new Map<string, THREE.Group>();
  private lavaTime = { value: 0 };
  private environmentCooldown = new Map<string, number>();


  // player
  private pos = new THREE.Vector3(0, 0, 0);
  private vel = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;
  private health = MAX_HEALTH;
  private alive = true;
  private respawnAt = 0;
  private onGround = true;
  private cameraFeetY: number | null = null;
  private lastGroundedAt = -Infinity;
  private lastJumpPressedAt = -Infinity;
  private wasJumpHeld = false;
  private touchAutoSprintActive = false;

  // weapon
  private weaponId: string;
  private eff: EffectiveStats;
  private ammoInMag = 30;
  // ---- Round 19o: Per-slot ammo tracking ----
  // Previously, swapping weapons reset ammo to full (this.ammoInMag = this.eff.magSize).
  // This meant reloading the primary also "reloaded" the secondary — the player could
  // swap to a full mag without actually reloading. Now we track ammo per-slot and
  // preserve it across swaps. Each slot's ammo is only refilled by an explicit reload
  // of THAT slot, or on respawn.
  private primaryAmmoInMag = 30;
  private secondaryAmmoInMag = 12;
  private meleeAmmoInMag = 1;
  private throwingKnifeState: ThrowingKnifeCharges = fullThrowingKnives();
  private lastThrowingKnifeAt = -10000;
  // Bulwark's built-in P-9 has its own magazine, even when holstered.
  private wonderAmmoInMag = 12;
  private riotShieldHp=RIOT_SHIELD_HP;
  private riotShieldReadyAt=0;
  private riotShieldHitFlashAt=0;
  private riotShieldModel:THREE.Group|null=null;
  private lastCountdownSecond=0;
  private clusterVolleys=new Map<string,ClusterVolley & {offline:boolean;done:Set<number>;dealt:Map<string,number>;meshes:Map<number,THREE.Mesh>}>();
  private wonderStates = new Map<string, WonderChargeState>();
  // Online deployment is NOT charged locally until server confirms placement.
  // This prevents rejected network/weapon-state packets from starting a
  // recharge timer while no turret exists in the match.
  private turretDeployPending = false;
  private turretDeployRequestedAt = 0;
  private turretDeployFailedAt = 0;
  private lastPlayerRespawnAt = -Infinity;
  private reloading = false;
  private reloadEndsAt = 0;
  private reloadStartedAt = 0;
  private reloadDurationMs = 0;
  // One credit per insert animation. Retained rounds survive sprint, swap and
  // firing interruptions; cancelling mid-cycle cannot undo prior inserts.
  private reloadRoundInserted = false;
  // Equipment commits when the hand releases the device, not on key-down.
  // The server remains authoritative for damage, charges and cooldowns.
  private equipmentAction: { id: string; startedAt: number; kind: DeployMotion; duration: number; committed: boolean } | null = null;
  // Resources are per-weapon rather than per-slot so swapping cannot reset them.
  private heatStates = new Map<string, HeatState>();
  private boltCharges = 0;
  private boltPickups = new Map<string, { mesh: THREE.Object3D; ownerId: string; pos: Vec3; expiresAt: number; retryAt: number }>();
  private localBoltSequence = 0;
  private boltFlights = new Map<string, { start: THREE.Vector3; end: THREE.Vector3; born: number; duration: number }>();
  private poisonByVictim = new Map<string, { expiresAt: number; tickAt: number; weaponId: string; damagePerTick?: number }>();
  private onlinePoisoned = new Map<string, number>();
  private poisonBubbles = new Map<string, THREE.Group>();
  private wonderFields = new Map<string, { mesh: THREE.Mesh; offline: boolean; ownerId: string; ownerTeam: string; weaponId: string; kind: "flame" | "sludge"; pos: Vec3; radius: number; expiresAt: number; tickAt: number }>();
  private stormMines = new Map<string,{mesh:THREE.Group; pos:Vec3;expiresAt:number;armedAt:number;offline:boolean;ownerId:string;ownerTeam:string}>();
  private stormMineCooldown = new Map<string,number>();
  private smartTags = new Map<string,number>();
  // End of the current ONE-second fuel slice. A released trigger never burns
  // another charge, and unused fuel remains in wonderStates.
  private hellfireActiveUntil = 0;
  private localBurning = new Map<string, number>();
  private onlineBurning = new Map<string, number>();
  private flamePlumes: {mesh:THREE.Mesh;born:number;life:number}[] = [];
  private stormArcMeshes: {mesh:THREE.Mesh;born:number;life:number}[] = [];
  private localWonderSequence = 0;
  private lastShotAt = 0;
  // Burst-fire state: when a burst weapon's trigger is pulled, burstShotsLeft is
  // set to the burst count; the update loop drains it one shot per intra-burst
  // interval. burstEndsAt gates the NEXT allowed burst (between-burst delay).
  private burstShotsLeft = 0;
  private burstNextAt = 0;
  private burstEndsAt = 0;
  // Melee swing animation timestamp (set when a melee attack fires; positionViewmodel
  // reads this to drive a sweep animation across the swing duration).
  private meleeSwingAt = 0;
  private meleeSwingDur = 380;  // ms
  private aiming = false;
  private adsProgress = 0;

  // viewmodel
  private viewmodel!: THREE.Group;
  private weaponMat!: THREE.MeshStandardMaterial;
  private prestigeTexture: THREE.CanvasTexture | null = null;
  private muzzleFlash!: THREE.Mesh;
  private muzzleLight!: THREE.PointLight;
  private muzzleFlashUntil = 0;
  private sightMesh: THREE.Object3D | null = null;
  // The viewmodel's local offset (hip/ADS position) in camera space. Synced to the
  // camera's world transform each frame to position the weapon in front of the camera.
  private vmOffset = new THREE.Vector3(0.20, -0.18, -0.45);
  // Transient viewmodel recoil (decays each frame) — a kick back + up on the weapon.
  private vmRecoilZ = 0;
  private vmRecoilPitch = 0;
  // Camera-local viewmodel parts. Save each part's immutable rest pose so
  // animation always starts from the same geometry and never accumulates drift.
  // Both positions and orientations get the SAME rigid-body quaternion.
  private vmParts: {
    obj: THREE.Object3D;
    base: THREE.Vector3;
    baseQuat: THREE.Quaternion;
    baseScale: THREE.Vector3;
  }[] = [];
  private vmScale = 1.20;
  // Visual model can lag the active gameplay weapon until the holster handoff.
  private viewmodelWeaponId = "";
  private swapViewmodelPending = false;
  // Camera-local rest grip: the same contact point and rigid weapon transform
  // used by every mesh in vmParts. Reused each frame without allocations.
  private fpSupportGrip = new THREE.Vector3();
  private fpRestHand = new THREE.Vector3();
  private fpActionHand: THREE.Group | null = null;
  private fpSupportArm: { root: THREE.Group; upper: THREE.Mesh; forearm: THREE.Mesh; elbow: THREE.Mesh; shoulder: THREE.Mesh } | null = null;
  // The shoulder stays under the viewmodel, independent of the gun.
  // Its elbow is allowed to drop below the camera edge, as natural FPS arms do.
  private readonly fpShoulder = new THREE.Vector3(-.30, -.45, -.25);
  private readonly fpWrist = new THREE.Vector3();
  private readonly fpElbow = new THREE.Vector3();
  private readonly fpArmDirection = new THREE.Vector3();
  private readonly fpArmUp = new THREE.Vector3(0, 1, 0);
  private fpActionProp: THREE.Group | null = null;
  private fpActionPropId = "";
  private fpHandMat = new THREE.MeshBasicMaterial({color:0x384c58});
  private fpCuffMat = new THREE.MeshBasicMaterial({color:0x1b242b});
  // Round 19g: Reusable temp objects for quaternion-based viewmodel rotation
  // (avoids allocating new Quaternion/Euler objects every frame for every part).
  private _vmTotalQuat = new THREE.Quaternion();
  private _vmTotalEuler = new THREE.Euler();

  // ---- Sight system ----
  // Effective sight for the player's loadout (iron if no sight equipped).
  private sightDef: SightDef = SIGHT_DEFS.iron;
  // Visible laser beam (THREE.Line) — shown when a laser sight is equipped.
  private laserBeam: THREE.Line | null = null;
  private laserDot: THREE.Mesh | null = null;
  // Thermal/NVG overlay: brighten the scene lights when ADS with NVG, dim for thermal contrast.
  private hemiLight!: THREE.HemisphereLight;
  private dirLight!: THREE.DirectionalLight;

  // input
  private keys: Record<string, boolean> = {};
  private mouseDown = false;
  private mousePressedThisFrame = false;  // for semi-auto / burst: fires only on the press edge
  private pointerLocked = false;
  private inputSuspended = false;
  private showHealthBars = true;
  private pendingLoadout: LoadoutWire | null = null;

  // touch input (mobile)
  private touchMode = false;
  private touchMoveX = 0;
  private touchMoveY = 0;
  private touchFiring = false;
  private touchPressedThisFrame = false;  // for semi-auto / burst on touch
  private touchAiming = false;
  private touchJumpQueued = false;
  private touchSprint = false;  // mobile sprint toggle (held)

  // combatants
  private combatants = new Map<string, Combatant>();
  private selfId = "self";
  private ctfFlags: CtfFlags = createCtfFlags();
  private ctfFlagMeshes: Record<FlagTeam, THREE.Group> | null = null;
  private ctfNotice: { label: string; at: number } | undefined;
  private ctfCaptures = 0;
  private ctfResetDurationMs = 30000;
  private ctfOvertime = false;
  private orbitalCharge=0;
  private orbitalServerVersion:number|undefined;
  private orbitalSnapshotSeen=false;
  private orbitalWeaponActive=false;
  private orbitalBotHolders=new Map<string,string>();
  private orbitalCore:THREE.Mesh|undefined;
  private orbitalRings:THREE.Mesh[]=[];
  private orbitalMotes:{mesh:THREE.Mesh;origin:Vec3;start:number}[]=[];
  private orbitalPulseRings:{mesh:THREE.Mesh;at:number}[]=[];
  private ctfMarkers: Partial<Record<FlagTeam, THREE.Mesh>> = {};
  private ctfBases: Record<FlagTeam, Vec3> = {red:ctfBase("red"),blue:ctfBase("blue")};
  private ctfRulesVerified = false;
  private floodgateServerRulesVersion:number|undefined;

  // tracers
  private tracers: { line: THREE.Line; born: number; life: number }[] = [];
  private thrownKnives: { mesh: THREE.Group; start: THREE.Vector3; dir: THREE.Vector3; distance: number; born: number; travelMs: number; rotation: THREE.Quaternion }[] = [];
  // Rocket projectiles (visual only — damage is hitscan). Each entry tracks the
  // mesh, its start position, end position (impact point), birth time, and travel
  // duration. The projectile animates from start to end over `travelMs`, then
  // spawns an explosion at the impact point.
  private projectiles: { mesh: THREE.Object3D; start: THREE.Vector3; end: THREE.Vector3; born: number; travelMs: number; damage: number; splashRadius: number; weaponId: string; applyLocalSplash: boolean }[] = [];
  // Explosion effects: expanding sphere + point light flash at an impact point.
  private explosionEffects!: ExplosionEffects;
  private deathBombs = new Map<string, { pos: Vec3; explodesAt: number; mesh: THREE.Group; local: boolean }>();
  private gravityWells = new Map<string, { pos: Vec3; ownerId: string; ownerTeam: string; weaponId: string; radius: number; activatesAt: number; expiresAt: number; offline: boolean; mesh: THREE.Group; light: THREE.PointLight }>();
  private bulletSpitters = new Map<string, { ownerId: string; pos: Vec3; yaw: number; expiresAt: number; nextShotAt: number; lastFiredAt: number; hp: number; mesh: THREE.Group; yawPivot: THREE.Group; barrelPivot: THREE.Group; offline: boolean }>();

  // scoring
  private kills = 0;
  private deaths = 0;
  private headshots = 0;
  private assists = 0;
  private offlineAssistDamage = new Map<string, {damage:number; at:number}>();
  private teamScores = { red: 0, blue: 0 };
  // Kill Confirmed collectibles and per-player objectives (separate from kills).
  private kcTags = new Map<string, { tag: KillConfirmedTag; mesh: THREE.Group }>();
  private kcNextTagId = 0;
  private confirmations = 0;
  private denials = 0;
  private denialScoreEnabled = false;
  private tagNotice: { action: "confirm" | "deny"; at: number } | undefined;
  private timeLeft = 360;
  private configuredTimeLimitSec = 360;
  private hasTimeLimit = true;
  private elapsedSeconds = 0;
  private matchEnded = false;
  private matchFinishingLabel: string | null = null;
  private finaleStartedAt = 0;
  private finaleDeathAges = new Map<string, number>();
  private finaleTimer: ReturnType<typeof setTimeout> | null = null;
  private quickMeleeLastAt = -10000;
  private quickMeleeFeedbackAt = 0;
  private quickMeleeModel: THREE.Group | null = null;
  private swapReadyAt = 0;
  // Only current, audible gunshots appear as enemy pings; teammates are always shown.
  private radarPings = new Map<string, { expiresAt: number }>();
  private killFeed: KillFeedEntry[] = [];

  // killstreak / multikill tracking
  private recentKills: number[] = [];
  private multikillsCount = 0;
  private currentNoDeathStreak = 0;
  private maxNoDeathStreak = 0;
  private defenseKills = 0;
  private flagReturns = 0;
  private maxScoreDeficit = 0;
  private trackScoreDeficit(): void {
    if (this.opts.mode !== "tdm" && this.opts.mode !== "ctf" && this.opts.mode !== "killconfirmed") return;
    const team = this.opts.team;
    if (team !== "red" && team !== "blue") return;
    this.maxScoreDeficit = largestScoreDeficit(this.maxScoreDeficit,
      this.teamScores[team], this.teamScores[team === "red" ? "blue" : "red"]);
  }
  private killChain: KillChainState = { count: 0, lastKillAt: -Infinity };
  // Highest chain with up to five seconds between each consecutive kill.
  // Reset on match start. Forwarded in MatchEndResult so the rewards API can update the
  // player's lifetime bestKillstreak (used by the Triple Threat / Killstreak
  // King / Untouchable Force achievements).
  private bestStreak = 0;
  private lastKillstreak: { at: number; label: string; color: string; icon: string } | null = null;

  // damage direction indicator
  private lastDamageDir: number | null = null;
  private lastDamageDirAt = 0;

  // health regen: after REGEN_DELAY ms without taking damage, regen REGEN_RATE HP/sec
  private lastDamageAt = 0;
  private static readonly REGEN_RATE = 26;    // faster healing between encounters
  // Tracks the last health value received from the server snapshot. Used by the
  // online health-sync logic to distinguish "server says new damage" (server
  // health DROPPED) from "server health is stale" (server hasn't run regen, so
  // its value is frozen at the last damage — client is regenerating ahead of
  // it). Without this, the client's regen to 100 gets snapped back to the stale
  // server value every snapshot (the "reaches 100 then returns to pre-regen
  // value" bug).
  private lastServerHealth = MAX_HEALTH;

  // Sprint stamina: drains while sprinting, regens after a short delay when not.
  // At 0 stamina, sprint is blocked until stamina regens above the resume threshold.
  private stamina = 100;            // 0..100
  private lastSprintAt = 0;         // performance.now() of last sprint frame
  private static readonly STAMINA_DRAIN = 22;    // per second while sprinting (full bar drains in ~4.5s)
  private static readonly STAMINA_REGEN = 35;    // per second when not sprinting (full regen in ~3s)
  private static readonly STAMINA_DELAY = 1200;  // ms after stopping sprint before regen begins
  private static readonly STAMINA_RESUME = 25;   // must regen above this to resume sprint after exhaustion

  // ---- Weapon slot system (primary / secondary / melee) ----
  // The local player's currently equipped slot. weaponId always reflects the
  // active weapon; the slot is tracked separately so the HUD can show 1/2/3.
  private currentSlot: WeaponSlot = "primary";
  private equipmentCharges = 0;
  private equipmentLastAt = -10000;
  private equipmentFlashUntil = 0;
  private equipmentPreviewLine: THREE.Line | null = null;
  private touchEquipmentAiming = false;
  private equipmentStunUntil = 0;
  private offlineMines: { pos: Vec3; expiresAt: number; mesh: THREE.Group }[] = [];
  private remoteEquipmentMines = new Map<string, THREE.Group>();
  private primaryWeaponId: string;
  private secondaryWeaponId: string;
  private meleeWeaponId: string;
  private wonderWeaponId: string;
  // Per-slot effective stats (precomputed on swap to avoid recompute each shot).
  private primaryEff: EffectiveStats;
  private secondaryEff: EffectiveStats;
  private meleeEff: EffectiveStats;
  private wonderEff: EffectiveStats;
  private primarySight: SightDef;
  private secondarySight: SightDef;
  private meleeSight: SightDef;
  private wonderSight: SightDef;
  // Cosmetic swap timestamp; does not affect readiness, ammo, or network timing.
  private swapAnimAt = 0;
  // Last slot before switching (for quick-swap with Q)
  private lastSlot: WeaponSlot = "secondary"; // Q works on first press: primary -> secondary

  // ---- Sprint + dynamic spread ----
  // Sprinting is triggered by Shift + forward movement. While sprinting, the
  // viewmodel sways side-to-side, the crosshair opens up (higher spread), and
  // the player can't fire (must release sprint or ADS first).
  private sprinting = false;
  private sprintPhase = 0;       // accumulator for the sway sine
  private currentSpread = 0;     // 0..1 dynamic spread factor (drives HUD crosshair)
  private shotBloom = 0; // additional inaccuracy from repeated fire; decays on pause
  private lastBloomShotAt = -10000;
  private lastFootstepAt = 0;    // throttle footstep SFX
  // Bounded, physics-sourced audio stimulus journal (no per-frame sound raycasts).
  private botNoises:BotNoise[]=[];
  private publishBotNoise(noise:BotNoise):void {
    this.botNoises.push({...noise,pos:[...noise.pos] as Vec3});
    if(this.botNoises.length>64)this.botNoises.splice(0,this.botNoises.length-64);
  }
  private hearBotNoise(bot:Combatant,now:number):void {
    const ai=bot.ai!;
    if(now<(ai.nextHearingAt??0))return;
    ai.nextHearingAt=now+180;
    for(let i=this.botNoises.length-1;i>=0;i--){
      const noise=this.botNoises[i];
      if(noise.at<=(ai.lastAlert?.at??0)||now-noise.at>1500)break;
      if(noise.sourceId===bot.id)continue;
      const source=noise.sourceId===this.selfId
        ? {alive:this.alive,team:this.opts.team} : this.combatants.get(noise.sourceId);
      if(!source?.alive||(this.opts.mode!=="ffa"&&this.opts.mode!=="gungame"&&source.team===bot.team))continue;
      if(Math.hypot(bot.pos[0]-noise.pos[0],bot.pos[2]-noise.pos[2])>105)continue;
      const occluded=!this.hasLineOfSight(
        [bot.pos[0],bot.pos[1]+PLAYER_HEIGHT/2,bot.pos[2]],
        [noise.pos[0],noise.pos[1]+PLAYER_HEIGHT/2,noise.pos[2]]);
      if(!botCanHearNoise(bot.pos,noise,now,ai.difficulty,occluded))continue;
      ai.lastAlert=botRememberNoise(noise);
      ai.nextDecisionAt=0;
      break;
    }
  }
  private remoteFootsteps = new Map<string, { pos: Vec3; at: number }>();

  // ---- Sound ----
  private sound: SoundManager;
  // Engine-owned weapon audio: one sound per confirmed shot, including opponents.
  private weaponAudio: WeaponAudio;
  private lastHitSoundAt = 0;    // throttle hit-marker SFX

  // ---- Death animation ----
  // When a combatant dies, we play a fall animation (rotate forward 90°, sink
  // slightly) over ~900ms before hiding the mesh. The combatant.alive flag is
  // false during this animation; c.deathAnimAt is the timestamp death started.
  // c.deathAnimDur is the total animation duration (slight randomization for
  // variety). After it completes, the mesh is hidden as before.

  // survival mode (offline)
  private survivalWave = 0;
  private survivalTier: SurvivalTier = "default";
  private survivalBossTimers = new Map<string,{phase:number;nextPhaseAt:number;nextSkillAt:number}>();
  private getSurvivalClearedWaves() { return survivalWavesCleared(this.survivalWave,this.survivalWaveActive); }
  private survivalEnemiesLeft = 0;
  private survivalReinforcements = 0;
  private survivalMaxReinforcements = 0;
  private survivalDowned = false;
  private lastDeath: HudState["lastDeath"];
  private survivalPrepLeft = 0;
  private survivalWaveActive = false;
  // Round 18-b: wave banner — set to performance.now() when a wave starts.
  // The HUD shows a "WAVE N — X enemies incoming" banner for ~3.5s after this.
  private survivalWaveBannerAt = 0;

  // settings
  private sensitivityMul = 1.0;
  private baseFov = 75;
  private scoreLimit = 30;
  private matchStartedAt = 0;
  private autoAdsOnFire = false;
  private invertY = false;
  // tracks whether the player is manually holding ADS (RMB / ADS button) so auto-ADS
  // doesn't release aim when the player explicitly wants to stay scoped.
  private manualAiming = false;
  // Bot difficulty scales bot skill (reaction time, miss chance, burst cadence).
  // "mixed" rolls a random difficulty per bot at spawn time.
  private botDifficulty: BotDifficulty = "normal";

  // ---- Room lobby state (online only) ----
  // While lobbyActive is true, the engine suppresses shooting/movement input
  // and the GameCanvas shows a Lobby overlay. The host can send `startMatch`
  // to transition the room to "playing", which triggers a `matchStarted` S2C
  // message that clears lobbyActive.
  private lobbyActive = false;
  private lobbyIsHost = false;
  private lobbyPlayers: SnapshotPlayer[] = [];
  private lobbyRoomName = "";

  // ---- Pre-match countdown ----
  // Seconds remaining before the match actually begins. While > 0, the update
  // loop renders the scene at the player's spawn but suppresses all gameplay
  // (movement, firing, bot AI, timer). Set to PRE_MATCH_COUNTDOWN_SEC on
  // offline match construction and on online `matchStarted`. The HUD shows a
  // big centered number; when it hits 0, a brief "GO!" flash plays and the
  // match timer starts ticking. This gives players time to orient themselves,
  // read the map/mode, and prepare before the action starts.
  private preMatchCountdown = 0;
  private rangeTimeSec = 0;
  private static readonly PRE_MATCH_COUNTDOWN_SEC = 5;

  // ---- Per-kill difficulty tracking (for rewards scaling) ----
  // One entry per kill the local player earns. Pushed in applyDamageLocal
  // (offline) and onServerMessage hit-with-killed (online). Sent in MatchEndResult.
  private killDifficulties: string[] = [];

  // ---- Per-weapon kill/headshot tracking (for Gun Game challenge attribution) ----
  // Keyed by weaponId; incremented on every local-player kill (offline + online).
  // In Gun Game the player cycles through every weapon in GUN_GAME_PROGRESSION,
  // so this map captures the per-weapon breakdown the rewards API needs to
  // progress per-weapon skin challenges (Breacher, Longshot, etc.) — instead of
  // attributing all kills to the match-start weapon. Sent in MatchEndResult.
  private perWeaponKills: Map<string, { kills: number; headshots: number }> = new Map();
  private perWeaponActions: Map<string, Partial<Record<WeaponConditionMetric, number>>> = new Map();

  // ---- Gun Game progression (gungame mode only) ----
  // The local player's current tier index. Set to 0 at match start; advanced by
  // advanceGungameTier() on each kill (offline) or via the gungameProgress S2C (online).
  private gungameIndex = 0;
  // The per-match weapon list (resolved from the TYPE-based progression). In
  // online mode, this is synced from the server via the gungameProgress message
  // (which includes the weaponId). In offline mode, it's resolved locally at
  // match start via resolveGungameWeaponsLocal().
  private gungameWeapons: string[] = GUN_GAME_PROGRESSION;

  // socket
  private socket: any = null;
  private ping = 0;
  private lastPingAt = 0;

  // hud throttle
  private lastHudAt = 0;
  private hitMarkerAt = 0;
  // Round 20g: Headshot hit marker — separate timestamp so the HUD can show
  // a distinct (red/larger) headshot marker vs the normal white hit marker.
  private headshotMarkerAt = 0;
  private lastElimination: { at: number; victim: string; headshot: boolean } | undefined;
  private damageFlashAt = 0;
  // Round 20h: Local player spawn protection (offline). Set to Date.now()+3000
  // on respawn. While active, bots can't damage the player. The HUD shows a
  // shield vignette overlay.
  private selfSpawnProtectedUntil = 0;
  // Scavenger packs are rendered in the world and collected server-side online.
  private scavengerPickups = new Map<string, { pos: Vec3; expiresAt: number; mesh: THREE.Group; nextRequestAt: number }>();
  private scavengerFeedbackAt = 0;
  private scavengerAmmoGained = 0;
  private get activePerkId(): string | null {
    return this.opts.loadout.perkId ?? null;
  }


  constructor(container: HTMLElement, opts: EngineOptions) {
    this.container = container;
    this.opts = opts;
    this.map = makeEnvironmentMap(opts.firingRange ? createFiringRangeMap() : !opts.online && opts.previewMap ? opts.previewMap : getMap(opts.mapId,opts.mode));
    this.ctfFlags = createCtfFlags(this.map);
    this.ctfBases = {red:ctfBase("red",this.map),blue:ctfBase("blue",this.map)};
    for (const o of this.map.environment ?? []) {
      if (o.type === "destructible_wall") this.environmentWalls.set(o.id, o.hp);
    }
    // ---- Weapon slot setup ----
    // Primary comes from loadout.weaponId. Secondary/melee fall back to defaults.
    this.primaryWeaponId = weaponById(opts.loadout.weaponId).disabled ? "rifle_ar" : opts.loadout.weaponId;
    this.secondaryWeaponId = weaponById(opts.loadout.secondaryWeaponId ?? "pistol_side").disabled
      ? "pistol_side" : (opts.loadout.secondaryWeaponId ?? "pistol_side");
    this.meleeWeaponId = opts.loadout.meleeWeaponId ?? "knife_tactical";
    this.wonderWeaponId = opts.mode !== "gungame" && opts.loadout.perkId === "wonder_weapon" && !!WEAPONS.find(w=>w.id===opts.loadout.wonderWeaponId && w.wonder&&!w.disabled) ? opts.loadout.wonderWeaponId! : "";
    this.weaponId = this.primaryWeaponId;
    // Gun Game: the local player starts on the FIRST progression weapon,
    // regardless of their equipped loadout. Effective stats + viewmodel are
    // rebuilt from the progression weapon (so the HUD shows the right mag
    // size, fire rate, etc.).
    if (opts.mode === "gungame") {
      // Resolve the per-match weapon list from the TYPE progression. In online
      // mode, the server does this and we sync via gungameProgress — but we
      // also resolve locally so the initial weaponId is correct before the
      // first server message arrives.
      this.gungameWeapons = this.resolveGungameWeaponsLocal();
      this.weaponId = this.gungameWeapons[0];
      this.gungameIndex = 0;
    }
    // Precompute effective stats + sights for all three slots. The primary's
    // attachments come from loadout.attachments; the secondary's come from
    // loadout.secondaryAttachments (sidearms now support attachments too).
    // Melee uses empty attachments (melee weapons don't take attachments).
    const primW = weaponById(this.primaryWeaponId);
    const secW = weaponById(this.secondaryWeaponId);
    const melW = weaponById(this.meleeWeaponId);
    this.primaryEff = computeEffectiveStats(primW, opts.loadout.attachments);
    const emptyAtts = { sight: null, barrel: null, grip: null, magazine: null } as Record<AttachmentSlot, string | null>;
    // Sidearms support attachments — use the secondary's attachment map if provided.
    const secAtts: Record<AttachmentSlot, string | null> = opts.loadout.secondaryAttachments
      ? {
          sight: opts.loadout.secondaryAttachments.sight ?? null,
          barrel: opts.loadout.secondaryAttachments.barrel ?? null,
          grip: opts.loadout.secondaryAttachments.grip ?? null,
          magazine: opts.loadout.secondaryAttachments.magazine ?? null,
        }
      : emptyAtts;
    this.secondaryEff = computeEffectiveStats(secW, secAtts);
    this.meleeEff = computeEffectiveStats(melW, emptyAtts);
    this.wonderEff = computeEffectiveStats(weaponById(this.wonderWeaponId || "rifle_ar"), emptyAtts);
    this.primarySight = sightDefForType(this.primaryEff.sightType);
    this.secondarySight = sightDefForType(this.secondaryEff.sightType);
    this.meleeSight = sightDefForType(this.meleeEff.sightType);
    this.wonderSight=sightDefForType(this.wonderEff.sightType);
    this.wonderSight = sightDefForType(this.wonderEff.sightType);
    this.equipmentCharges = equipmentById(opts.loadout.equipmentId).charges;
    // Active slot = primary by default (gun game overrides weaponId but keeps slot=primary).
    if (opts.mode === "gungame") {
      // For gungame, recompute eff from the progression weapon (treat as primary).
      const ggW = weaponById(this.weaponId);
      this.eff = computeEffectiveStats(ggW, emptyAtts);
      this.sightDef = sightDefForType(this.eff.sightType);
    } else {
      this.eff = this.primaryEff;
      this.sightDef = this.primarySight;
    }
    this.ammoInMag = this.eff.magSize;
    // New offline matches are protected after the pre-match countdown completes.
    // The authoritative online server supplies its own timestamp.
    // Initialize per-slot ammo (Round 19o: per-slot ammo tracking).
    const initialWonder=WEAPONS.find(w=>w.id===this.wonderWeaponId);
    if(initialWonder?.wonder){
      const now=performance.now();
      if(usesWonderCharges(initialWonder))
        this.wonderStates.set(initialWonder.id,this.opts.firingRange
          ? fullWonderCharges(initialWonder.wonder)
          : drainedWonderCharges(initialWonder.wonder,now));
      if(initialWonder.id===RIOT_SHIELD_ID && !this.opts.firingRange){
        this.riotShieldHp=0;
        this.riotShieldReadyAt=now+RIOT_SHIELD_RECHARGE_MS;
      }
    }
    this.primaryAmmoInMag = this.primaryEff.magSize;
    this.secondaryAmmoInMag = this.secondaryEff.magSize;
    this.meleeAmmoInMag = this.meleeEff.magSize;
    this.wonderAmmoInMag = this.wonderEff.magSize;
    if (this.weaponId === this.primaryWeaponId) this.ammoInMag = this.primaryAmmoInMag;
    // ---- Sound manager ----
    this.sound = new SoundManager();
    this.weaponAudio = new WeaponAudio(80);
    this.setAudioMix({
      masterVolume: opts.masterVolume ?? DEFAULT_AUDIO_MIX.masterVolume,
      footstepVolume: opts.footstepVolume ?? DEFAULT_AUDIO_MIX.footstepVolume,
      fxVolume: opts.fxVolume ?? DEFAULT_AUDIO_MIX.fxVolume,
    });
    this.sensitivityMul = opts.sensitivity && opts.sensitivity > 0 ? opts.sensitivity : 1.0;
    this.baseFov = opts.fov ? Math.max(60, Math.min(110, opts.fov)) : 75;
    this.scoreLimit = opts.scoreLimit ?? (opts.mode === "ctf" ? 3 : opts.mode === "ffa" ? 30 : opts.mode === "killconfirmed" ? 40 : opts.mode === "gungame" ? this.gungameWeapons.length : 60);
    this.denialScoreEnabled = opts.denialScoreEnabled === true || opts.roomConnect?.config?.denialScoreEnabled === true;
    this.timeLeft = opts.mode === "gungame" ? 0 : (opts.timeLimitSec ?? 360);
    this.configuredTimeLimitSec = opts.mode === "gungame" || opts.mode === "survival" ? 0 : this.timeLeft;
    this.ctfResetDurationMs = ctfResetMs(opts.roomConnect?.config?.ctfFlagResetMs);
    this.ctfRulesVerified = !opts.online;
    this.hasTimeLimit = opts.mode !== "survival" && opts.mode !== "gungame" && this.timeLeft > 0;
    this.matchStartedAt = opts.startedAt ?? performance.now();
    this.autoAdsOnFire = opts.autoAdsOnFire ?? false;
    this.invertY = opts.invertY ?? false;
    this.botDifficulty = opts.botDifficulty ?? "normal";
    this.survivalTier = normalizeSurvivalTier(opts.survivalTier);
    // If we're creating a room, we know upfront that we're the host entering a
    // lobby. The server will confirm via roomJoined, but setting this early
    // lets the GameCanvas render the lobby overlay before the socket connects.
    if (opts.online && opts.roomConnect?.kind === "create") {
      this.lobbyActive = true;
      this.lobbyIsHost = true;
      this.lobbyRoomName = opts.roomConnect.roomName ?? "";
    }
    try {
      this.initThree();
    } catch (error) {
      // The constructor never returns if WebGL fails. Release resources
      // already allocated before renderer initialization.
      try { this.renderer?.dispose(); this.renderer?.forceContextLoss(); } catch {}
      try { this.explosionEffects?.dispose(); } catch {}
      try { this.sound.dispose(); } catch {}
      try { this.weaponAudio.dispose(); } catch {}
      throw error;
    }
    this.buildArena();
    this.buildMapProps();
    if (this.opts.mode === "ctf") this.buildCtfFlagModels();
    this.buildEnvironment();
    this.buildViewmodel();
    this.createQuickMeleeModel();
    this.setupInput();
    if (opts.online) this.connectSocket();
    else if (opts.mode === "survival") this.setupSurvival();
    else if (opts.firingRange) this.setupFiringRangeTargets();
    else this.setupOfflineBots();
    this.respawnSelf();
    // ---- Start the pre-match countdown for offline matches ----
    // Online matches start the countdown when the server transitions the room
    // from lobby → playing (the `matchStarted` S2C handler). Offline matches
    // start immediately, so we kick off the countdown here. While
    // preMatchCountdown > 0, the update loop suppresses all gameplay so the
    // player has a few seconds to read the map/mode and get oriented before
    // the bots start shooting.
    if (!opts.online) {
      this.preMatchCountdown = opts.firingRange ? 0 : FPSEngine.PRE_MATCH_COUNTDOWN_SEC;
      this.matchStartedAt = performance.now() + this.preMatchCountdown * 1000;
      // 19a+19b: Explicit per-match reset for offline matches. The engine is
      // freshly constructed per offline match so the field defaults are already
      // 0, but setting them here keeps the offline path symmetric with the
      // online `matchStarted` handler resets and is defensively correct if a
      // future change ever reuses an engine instance across matches.
      this.multikillsCount = 0;
      this.currentNoDeathStreak = 0;
      this.maxNoDeathStreak = 0;
      this.defenseKills = 0;
      this.flagReturns = 0;
      this.maxScoreDeficit = 0;
      this.bestStreak = 0;
      this.recentKills = [];
      this.killChain = { count: 0, lastKillAt: -Infinity };
      this.shotBloom = 0;
      this.lastKillstreak = null;
    }
    // Emit the initial lobby state so the GameCanvas can render the Lobby
    // overlay immediately for hosts (before the socket even connects).
    this.emitLobbyState();
    this.opts.onReady();
    // Respect tab visibility when measuring frame time (avoids an enormous dt on return).
    this.timer.connect(document);
    this.loop();
  }

  // ---- Three.js setup ----
  private initThree() {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "default" });
    // Dense city maps need a stable pixel budget; never render them at 2x DPI.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.map.biome==="city"||this.map.biome==="city_day"?1.35:2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    // Thousands of city interior and stair boxes would otherwise issue an
    // additional expensive shadow pass every frame. Keep shadows elsewhere.
    this.renderer.shadowMap.enabled = this.map.biome!=="city"&&this.map.biome!=="city_day";
    // Nearest comparison avoids implementation-defined LINEAR depth texture
    // filtering in WebGL browsers (and the resulting console warnings).
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.container.appendChild(this.renderer.domElement);

    const theme = this.map.theme;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(theme.sky);
    this.scene.fog = new THREE.Fog(theme.fog, theme.fogNear, theme.fogFar);
    this.explosionEffects=new ExplosionEffects(this.scene);

    this.camera = new THREE.PerspectiveCamera(this.baseFov, this.container.clientWidth / this.container.clientHeight, 0.05, Math.max(500, this.map.size * 3));

    // The daylight edition reuses every building and collision surface but
    // receives a warmer, stronger sun instead of nighttime city illumination.
    const cityDay = this.map.biome === "city_day";
    const hemi = new THREE.HemisphereLight(cityDay ? 0xe9f2ff : 0x9db4c0, cityDay ? 0x887b65 : 0x202830, (cityDay ? 1.05 : 0.9) * theme.ambient);
    this.hemiLight = hemi;
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(cityDay ? 0xffedcf : 0xffffff, cityDay ? 2.0 : 1.4);
    this.dirLight = dir;
    dir.position.set(30, 50, 20);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    const shadowExtent = Math.min(230, Math.max(65, this.map.size));
    dir.shadow.camera.left = -shadowExtent; dir.shadow.camera.right = shadowExtent;
    dir.shadow.camera.top = shadowExtent; dir.shadow.camera.bottom = -shadowExtent;
    dir.shadow.camera.far = 120;
    if (this.map.biome === "volcanic_castle") dir.shadow.bias = -.00035;
    this.scene.add(dir);
    const fill = new THREE.DirectionalLight(cityDay ? 0xaad9ee : 0x4a6080, cityDay ? 0.65 : 0.4);
    fill.position.set(-20, 20, -20);
    this.scene.add(fill);
  }

  private buildArena() {
    const theme = this.map.theme;
    // World-scaled, themed materials generated once for this match from JSON.
    this.surfaceMaterials=createMapSurfaceMaterials(this.map);
    const {floor:floorMat,wall:wallMat,cover:coverMat,stair:stairMat,platform:platformMat}=this.surfaceMaterials;
    const floorTileSize=this.map.surfaces?.floor.tileSize??7;
        // The visible ground follows the union of authored regions, not a square.
    // Shared area overlaps are coplanar; polygon-union cells avoid Z fighting.
    const regions = this.map.regions?.length?regionRectangles(this.map.regions):undefined;
    if (regions?.length) {
      const xs = [...new Set(regions.flatMap(r => [r.x-r.w/2,r.x+r.w/2]))].sort((a,b)=>a-b);
      const zs = [...new Set(regions.flatMap(r => [r.z-r.d/2,r.z+r.d/2]))].sort((a,b)=>a-b);
      for (let i=0;i<xs.length-1;i++) for(let j=0;j<zs.length-1;j++) {
        const x=(xs[i]+xs[i+1])/2, z=(zs[j]+zs[j+1])/2;
        if (!regions.some(r=>Math.abs(x-r.x)<r.w/2 && Math.abs(z-r.z)<r.d/2)) continue;
        const groundGeo=new THREE.PlaneGeometry(xs[i+1]-xs[i],zs[j+1]-zs[j]);
        mapFloorUV(groundGeo,x,z,floorTileSize);
        const tile = new THREE.Mesh(groundGeo,floorMat);
        tile.rotation.x=-Math.PI/2; tile.position.set(x,0,z); tile.receiveShadow=true;
        this.scene.add(tile);
      }
    } else {
      const floorGeo=new THREE.PlaneGeometry(this.map.size*2,this.map.size*2);
      mapFloorUV(floorGeo,0,0,floorTileSize);
      const floor = new THREE.Mesh(floorGeo,floorMat);
      floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; this.scene.add(floor);
      const grid=new THREE.GridHelper(this.map.size*2,64,theme.gridColor,theme.gridColor);
      (grid.material as THREE.Material).opacity=0.4;
      (grid.material as THREE.Material).transparent=true;
      grid.position.y=0.02; if (this.map.id !== "forest_warfare") this.scene.add(grid);
    }

    // Ridgefall is an indoor factory. Render a ceiling over each connected
    // production bay so the map reads as an interior rather than an outdoor arena.
    // These are decorative overhead panels: the boundary and authored machinery
    // below still own authoritative ground and combat collision.
    if (this.map.biome === "factory_interior" && this.map.regions?.length) {
      const steel = new THREE.MeshStandardMaterial({
        color:0x343f48,metalness:.55,roughness:.77,side:THREE.DoubleSide,
      });
      const girder = new THREE.MeshStandardMaterial({
        color:0x657780,metalness:.7,roughness:.62,
      });
      const luminaire = new THREE.MeshStandardMaterial({
        color:0xffd09a,emissive:0xffaf60,emissiveIntensity:1.8,
      });
      const roofY = 17.9;
      this.map.regions.forEach((r,i)=>{
        const ceiling=new THREE.Mesh(new THREE.BoxGeometry(r.w,.45,r.d),steel);
        ceiling.position.set(r.x,roofY+i*.012,r.z);
        ceiling.receiveShadow=true;
        this.scene.add(ceiling);
        // Long girders and recessed light strips establish the factory roof.
        const beam=new THREE.Mesh(new THREE.BoxGeometry(r.w,.65,.8),girder);
        beam.position.set(r.x,roofY-1.0,r.z);
        this.scene.add(beam);
        const lamp=new THREE.Mesh(new THREE.BoxGeometry(Math.min(26,r.w*.55),.18,.52),luminaire);
        lamp.position.set(r.x,roofY-1.52,r.z);
        this.scene.add(lamp);
      });
      for (const [x,z] of [[0,0],[-91,0],[91,0],[0,-86],[0,89]]) {
        const fixture=new THREE.PointLight(0xffc68d,2.4,82,1.7);
        fixture.position.set(x,15.4,z);
        this.scene.add(fixture);
      }
    }

    // walls
    const wallH = this.map.wallHeight;
    const t = 1;
    const s = this.map.size;
    const walls = this.map.regions?.length ? [] : [
      { pos: [0, wallH / 2, -s], size: [s * 2, wallH, t] },
      { pos: [0, wallH / 2, s], size: [s * 2, wallH, t] },
      { pos: [-s, wallH / 2, 0], size: [t, wallH, s * 2] },
      { pos: [s, wallH / 2, 0], size: [t, wallH, s * 2] },
    ] as const;
    for (const w of walls) {
      const geo = new THREE.BoxGeometry(w.size[0], w.size[1], w.size[2]);
      mapBoxUV(geo,w.pos[0],w.pos[2],this.map.surfaces?.wall.tileSize??6);
      const m = new THREE.Mesh(geo, wallMat);
      m.position.set(w.pos[0], w.pos[1], w.pos[2]);
      m.castShadow = true; m.receiveShadow = true;
      this.scene.add(m);
    }

    // cover / platforms / stairs
    const accentMat = new THREE.MeshStandardMaterial({ color: theme.coverAccent, roughness: 0.5, metalness: 0.3, emissive: theme.coverAccent, emissiveIntensity: 0.25 });
    // The city once submitted one Mesh + draw call for EVERY wall section,
    // furniture AABB and step, and then rendered them a second time for
    // shadows. Instance equal-material solids; physics still reads every
    // individual CoverBox from this.map.cover unchanged.
    const cityBatch=this.map.biome==="city"||this.map.biome==="city_day";
    if(cityBatch){
      // Keep all physics colliders, but don't ALSO draw a coplanar proxy for
      // fully detailed city furniture, bandstand columns or shop exteriors.
      const hiddenCityBoxes = hiddenCityColliderKeys(this.map.props ?? []);
      const materials:Record<string,THREE.Material>={
        accent:accentMat,solid:wallMat,stair:stairMat,platform:platformMat,cover:coverMat,
      };
      const buckets=new Map<string,typeof this.map.cover>();
      for(const c of this.map.cover){
        if(c.environmentId || hiddenCityBoxes.has(cityCoverKey(c)))continue;
        const kind=c.kind??"cover";
        const key=kind in materials?kind:"cover";
        const list=buckets.get(key)??[];
        list.push(c);buckets.set(key,list);
      }
      const transform=new THREE.Object3D();
      const unit=new THREE.BoxGeometry(1,1,1);
      for(const [kind,boxes] of buckets){
        if(!boxes.length)continue;
        const instanced=new THREE.InstancedMesh(unit,materials[kind],boxes.length);
        instanced.frustumCulled=false; // instance bounding volume spans the whole map
        instanced.castShadow=false;instanced.receiveShadow=true;
        for(let i=0;i<boxes.length;i++){
          const c=boxes[i];
          transform.position.set(c.pos[0],c.pos[1],c.pos[2]);
          transform.scale.set(c.size[0]*2,c.size[1]*2,c.size[2]*2);
          transform.updateMatrix();
          instanced.setMatrixAt(i,transform.matrix);
        }
        instanced.instanceMatrix.needsUpdate=true;
        this.scene.add(instanced);
      }
    }else for(const c of this.map.cover) {
      if (c.environmentId) continue;
      const kind = c.kind ?? "cover";
      if (this.map.id === "forest_warfare" && kind !== "stair") continue;
      const mat = kind === "accent" ? accentMat : kind === "solid" ? wallMat : kind === "stair" ? stairMat : kind === "platform" ? platformMat : coverMat;
      const geo = new THREE.BoxGeometry(c.size[0] * 2, c.size[1] * 2, c.size[2] * 2);
      if(kind !== "accent"){
        const slot=kind==="solid"?"wall":kind==="stair"?"stair":kind==="platform"?"platform":"cover";
        mapBoxUV(geo,c.pos[0],c.pos[2],this.map.surfaces?.[slot]?.tileSize??4);
      }
      const m = new THREE.Mesh(geo, mat);
      m.position.set(c.pos[0], c.pos[1], c.pos[2]);
      m.castShadow = true; m.receiveShadow = true;
      this.scene.add(m);
      if (kind === "platform" && c.size[1] >= 1.5) {
        const stripeGeo = new THREE.BoxGeometry(c.size[0] * 2 + 0.05, 0.08, c.size[2] * 2 + 0.05);
        const stripe = new THREE.Mesh(stripeGeo, accentMat);
        stripe.position.set(c.pos[0], c.pos[1] + c.size[1], c.pos[2]);
        this.scene.add(stripe);
      }
    }

    // ---- Spawn points: NO visible markers (players complained about colored
    // circles lying around the map — they were left-over debug visuals).
    // Spawn points are purely logical; the player never needs to see them. ----

    // ---- Per-map accent lights (colored point lights) ----
    // Each map's `lights` array places themed colored lights at key positions to give
    // the arena art direction: orange industrial lights in Shipyard, blue accent lights
    // in Terminal, warm yellow ceiling lights in Rats, etc.
    // NOTE: We previously added a small emissive sphere "bulb" marker at each light
    // position so the source was visible. Players reported these as mysterious
    // "floating balls" that didn't seem to do anything. They've been removed — the
    // PointLight alone is enough; maps already have visible cover/platforms that
    // the light reflects off of, giving the lighting visual presence without a
    // floating geometry marker.
    if (this.map.lights) {
      for (const L of this.map.lights) {
        const pl = new THREE.PointLight(L.color, L.intensity, L.distance);
        pl.position.set(L.pos[0], L.pos[1], L.pos[2]);
        this.scene.add(pl);
      }
    }
  }

  /**
   * Landmarks, vegetation and city architecture are lightweight primitive
   * meshes driven by one authored JSON theme per map. These decorations are
   * visually distinct but never create a corridor wall; the world colliders
   * for solid props are generated separately on client AND server.
   */
  // Decorative geometry uses the same positions as the shared authoritative cover.
  // Meshes do not generate independent collision, so visuals and hitboxes stay aligned.
  private buildForestWarfare() {
    const bark = new THREE.MeshStandardMaterial({ color: 0x68462a, roughness: 1 });
    const barkLight = new THREE.MeshStandardMaterial({ color: 0x92663b, roughness: 1 });
    const leafA = new THREE.MeshStandardMaterial({ color: 0x387b3e, roughness: 1 });
    const leafB = new THREE.MeshStandardMaterial({ color: 0x5d9947, roughness: 1 });
    const leafC = new THREE.MeshStandardMaterial({ color: 0x244f32, roughness: 1 });
    const stone = new THREE.MeshStandardMaterial({ color: 0x727a72, roughness: 0.95 });
    const cliff = new THREE.MeshStandardMaterial({ color: 0x5c6e5b, roughness: 1 });
    const moss = new THREE.MeshStandardMaterial({ color: 0x436d3b, roughness: 1 });
    const place = (mesh: THREE.Mesh,x:number,y:number,z:number) => {
      mesh.position.set(x,y,z);
      mesh.castShadow=true; mesh.receiveShadow=true; this.scene.add(mesh);
      return mesh;
    };
    // Exact visual counterpart of every outside-edge collision slab: no
    // invisible cliffs and no unrendered collidable border walls.
    for (const wall of FOREST_PERIMETER) {
      const [x,y,z]=wall.pos, [hx,hy,hz]=wall.size;
      place(new THREE.Mesh(new THREE.BoxGeometry(hx*2,hy*2,hz*2),cliff),x,y,z);
      const cap=new THREE.Mesh(new THREE.BoxGeometry(hx*2+.16,.18,hz*2+.16),moss);
      cap.position.set(x,y+hy+.08,z);cap.receiveShadow=true;this.scene.add(cap);
    }
    // Every new low barrier has the same rendered box and physics AABB.
    for (const cover of FOREST_BASE_COVER) {
      const rock=new THREE.Mesh(new THREE.BoxGeometry(cover.size[0]*2,cover.size[1]*2,cover.size[2]*2),stone);
      rock.rotation.y=0;place(rock,...cover.pos);
      const lichen=new THREE.Mesh(new THREE.BoxGeometry(cover.size[0]*2+.06,.08,cover.size[2]*2+.06),moss);
      place(lichen,cover.pos[0],cover.pos[1]+cover.size[1]+.03,cover.pos[2]);
    }
    for (const cover of FOREST_TREE_PARAPETS) {
      const rail=new THREE.Mesh(new THREE.BoxGeometry(cover.size[0]*2,cover.size[1]*2,cover.size[2]*2),barkLight);
      place(rail,...cover.pos);
    }
    for (const prop of FOREST_OBJECTS) {
      const {x,z,w,d,h,kind}=prop;
      if(kind==="tree") {
        place(new THREE.Mesh(new THREE.CylinderGeometry(w*.85,w,5.3,8),bark),x,2.65,z);
        for(let i=0;i<3;i++){
          const foliage=new THREE.Mesh(new THREE.ConeGeometry(3.0-i*.33,4.6,8),[leafC,leafA,leafB][i]);
          place(foliage,x,h*.52+i*1.5,z);
        }
      } else if(kind==="bush") {
        for(const [ox,oz,scale] of [[0,0,1],[-.9,.28,.68],[.8,-.45,.62]]){
          const shrub=new THREE.Mesh(new THREE.IcosahedronGeometry(1.5*scale,1),scale===1?leafA:leafB);
          shrub.scale.y=.6;place(shrub,x+ox,.8*scale,z+oz);
        }
      } else if(kind==="rock") {
        const boulder=new THREE.Mesh(new THREE.DodecahedronGeometry(1,1),stone);
        boulder.scale.set(w*1.07,h*.88,d*1.08);
        boulder.rotation.y=(x+z)*.14;place(boulder,x,h*.76,z);
      } else {
        const log=new THREE.Mesh(new THREE.CylinderGeometry(.88,.95,w*2,10),barkLight);
        log.rotation.z=Math.PI/2;place(log,x,.95,z);
        const ring=new THREE.Mesh(new THREE.CylinderGeometry(.90,.90,.13,10),bark);
        ring.rotation.z=Math.PI/2;place(ring,x+w,.95,z);
      }
    }
    // Landmark trees are intentionally MUCH taller and broader than ordinary
    // woodland trees. Crown leaves sit above the players' eye lines when
    // fighting on the accessible, 24m-wide circular treetop clearing.
    for(const [team,sign] of [["red",-1],["blue",1]] as const){
      const x=94*sign;
      place(new THREE.Mesh(new THREE.CylinderGeometry(2.65,3.1,11.8,16),bark),x,5.9,0);
      const deck=new THREE.Mesh(new THREE.CylinderGeometry(13,13,.48,48),barkLight);
      place(deck,x,11.76,0); // top face exactly y=12, same as shared collision
      const ring=new THREE.Mesh(new THREE.TorusGeometry(12.7,.25,8,48),bark);
      ring.rotation.x=Math.PI/2;place(ring,x,12.08,0);
      // Large high boughs frame the platform but never occlude a
      // standing defender's view across the treetop.
      for(let i=0;i<14;i++) {
        const angle=i*2*Math.PI/14;
        const canopy=new THREE.Mesh(new THREE.IcosahedronGeometry(4.1+(i%3)*.4,1),i%2?leafB:leafA);
        place(canopy,x+Math.cos(angle)*16.2,24.5+(i%3)*.6,Math.sin(angle)*16.2);
      }
      // Heavy branches physically meet the high canopy clusters. Kept above
      // player head height so the open flag deck remains a clear combat space.
      for(const branchIndex of [1,4,8,12]){
        const angle=branchIndex*2*Math.PI/14;
        const x2=x+Math.cos(angle)*16.2,z2=Math.sin(angle)*16.2;
        const start=new THREE.Vector3(x,18,0),end=new THREE.Vector3(x2,24.5+(branchIndex%3)*.6,z2);
        const direction=end.clone().sub(start);
        const branch=new THREE.Mesh(new THREE.CylinderGeometry(.45,1.05,direction.length(),10),bark);
        branch.position.copy(start.add(end).multiplyScalar(.5));
        branch.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
        branch.castShadow=true;this.scene.add(branch);
      }
      const crown=new THREE.Mesh(new THREE.ConeGeometry(9.4,9,11),leafC);
      place(crown,x,28.5,0);
    }
  }


  /** Orbital Nexus spectacle, separate from server-authoritative collision. */
  private buildOrbitalScenery() {
    const luminous=(color:number,opacity=1)=>new THREE.MeshBasicMaterial({
      color,transparent:opacity<1,opacity,depthWrite:false,side:THREE.DoubleSide,
    });
    if(this.map.id==="orbital_nexus"){
    // Gas giant looming behind the station and a deterministic star field.
    const planet=new THREE.Mesh(new THREE.SphereGeometry(57,36,24),
      new THREE.MeshBasicMaterial({color:0x59418e,fog:false}));
    planet.position.set(8,69,-205);this.scene.add(planet);
    const atmosphere=new THREE.Mesh(new THREE.TorusGeometry(67,1.2,8,84),luminous(0xab7dfb,.58));
    atmosphere.position.copy(planet.position);atmosphere.rotation.set(.24,.35,.2);this.scene.add(atmosphere);
    const vertices:number[]=[];
    for(let i=0;i<150;i++){const a=i*2.3999632,r=135+(i%17)*5;
      vertices.push(Math.cos(a)*r,45+(i*37%115),Math.sin(a)*r);}
    const sky=new THREE.BufferGeometry();
    sky.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
    this.scene.add(new THREE.Points(sky,new THREE.PointsMaterial({color:0xc6ddff,size:.85,fog:false})));
    }
    const reactor=reactorObjective(this.map);if(!reactor)return;
    const [rx,ry,rz]=reactor.pos;
    // Containment rings float safely above the open command deck.
    const coreMat=new THREE.MeshStandardMaterial({
      color:0x7859cd,emissive:0x9654e9,emissiveIntensity:1.2,metalness:.45,roughness:.24,
    });
    const core=new THREE.Mesh(new THREE.IcosahedronGeometry(3.4,2),coreMat);
    core.position.set(rx,ry+7.8,rz);this.scene.add(core);this.orbitalCore=core;
    for(const [radius,height,rotation,color] of [
      [6,11,.27,0x61e7ff],[8,11,1.13,0xd484ff],[5,13,.72,0x4ee9e5]
    ] as const){
      const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.17,10,64),luminous(color,.9));
      ring.position.set(rx,ry+height-3.2,rz);ring.rotation.set(rotation,.45,rotation*.5);this.scene.add(ring);this.orbitalRings.push(ring);
    }
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.35,.85,10,14),luminous(0x5ac5ff,.22));
    beam.position.set(rx,ry+4.8,rz);this.scene.add(beam);
  }


  private spawnOrbitalMote(pos:Vec3) {
    if(!reactorObjective(this.map)||this.orbitalMotes.length>=12)return;
    const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(.32,1),
      new THREE.MeshBasicMaterial({color:0x93e7ff,transparent:true,opacity:.92,
        blending:THREE.AdditiveBlending,depthWrite:false}));
    mesh.position.set(pos[0],pos[1]+1.1,pos[2]);
    this.scene.add(mesh);
    this.orbitalMotes.push({mesh,origin:[...pos],start:performance.now()});
  }
  private showOrbitalPulse(pos:Vec3) {
    if(!reactorObjective(this.map))return;
    const ring=new THREE.Mesh(new THREE.RingGeometry(.45,1,56),
      new THREE.MeshBasicMaterial({color:0xb26bff,transparent:true,opacity:.92,
        blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
    ring.rotation.x=-Math.PI/2;
    ring.position.set(pos[0],pos[1]+.22,pos[2]);
    this.scene.add(ring);
    this.orbitalPulseRings.push({mesh:ring,at:performance.now()});
  }
  private animateOrbitalReactor(now:number) {
    if(!reactorObjective(this.map)||!this.orbitalCore)return;
    this.orbitalPulseRings=this.orbitalPulseRings.filter(p=>{
      const t=(now-p.at)/580;
      if(t>=1){
        this.scene.remove(p.mesh);p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();return false;
      }
      p.mesh.scale.setScalar(.2+ORBITAL_PULSE_RADIUS*t);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity=.92*(1-t);
      return true;
    });
    this.orbitalMotes=this.orbitalMotes.filter(m=>{
      const t=Math.max(0,(now-m.start)/1050);
      if(t>=1){
        this.scene.remove(m.mesh);m.mesh.geometry.dispose();
        (m.mesh.material as THREE.Material).dispose();
        return false;
      }
      const eased=t*t*(3-2*t),inv=1-eased;
      const target=this.orbitalCore!.position;
      m.mesh.position.set(m.origin[0]*inv+target.x*eased,
        (m.origin[1]+1.1)*inv+target.y*eased+Math.sin(t*Math.PI)*2,
        m.origin[2]*inv+target.z*eased);
      m.mesh.scale.setScalar(.5+(1-t)*.9);
      (m.mesh.material as THREE.MeshBasicMaterial).opacity=.92*(1-t);
      return true;
    });
    const progress=this.orbitalCharge/(reactorObjective(this.map)?.killsRequired??10);
    const ready=this.orbitalCharge>=(reactorObjective(this.map)?.killsRequired??Infinity);
    const color=new THREE.Color(0x53dbff).lerp(new THREE.Color(0xa247ff),progress);
    const material=this.orbitalCore.material as THREE.MeshStandardMaterial;
    material.color.copy(color);material.emissive.copy(color);material.emissiveIntensity=.85+progress*.95;
    this.orbitalCore.scale.setScalar(1+progress*.38+(ready?.1*Math.sin(now*.009):0));
    this.orbitalRings.forEach((ring,i)=>{
      if(ready){ring.rotation.x+=.027*(i+1);ring.rotation.y+=.021*(i%2?-1:1);}
      const mat=ring.material as THREE.MeshBasicMaterial;
      mat.opacity=ready?.4+.6*Math.abs(Math.sin(now*.014+i*1.7)):.55+progress*.25;
      mat.color.copy(color);
    });
  }
  /** Match-only melee override, never saved to the player's loadout. */
  private grantOrbitalReaper(active:boolean){
    if(this.orbitalWeaponActive===active)return;
    this.orbitalWeaponActive=active;
    this.meleeWeaponId=active?ORBITAL_REAPER_ID:(this.opts.loadout.meleeWeaponId??"knife_tactical");
    this.meleeEff=computeEffectiveStats(weaponById(this.meleeWeaponId),
      {sight:null,barrel:null,grip:null,magazine:null});
    this.meleeSight=sightDefForType(this.meleeEff.sightType);
    this.meleeAmmoInMag=isThrowingKnife(this.meleeWeaponId)?this.throwingKnifeState.charges:this.meleeEff.magSize;
    if(this.currentSlot==="melee"){
      this.weaponId=this.meleeWeaponId;
      this.eff=this.meleeEff;
      this.sightDef=this.meleeSight;
      this.ammoInMag=this.meleeAmmoInMag;
      this.buildViewmodel();
      if(this.opts.online && this.alive && active && this.socket?.connected)
        this.socket.emit("message",{t:"weaponSwap",slot:"melee"});
    }
    if(this.quickMeleeModel){
      this.camera.remove(this.quickMeleeModel);
      this.quickMeleeModel.traverse(child=>{
        if(child instanceof THREE.Mesh){
          child.geometry.dispose();
          if(Array.isArray(child.material))child.material.forEach(m=>m.dispose());
          else child.material.dispose();
        }
      });
      this.quickMeleeModel=null;
    }
    this.createQuickMeleeModel();
    // The weapon model is the pickup cue; no charged/claim pop-up.
  }
  /** Local kill scoring mirrors the multiplayer server's killer-or-victim
   * zone rule. Always pass the actual attacker position for credited kills.
   */
  private recordOrbitalKill(victimPos:Vec3,killerPos?:Vec3){
    if(this.opts.online||!reactorObjective(this.map))return;
    const prev=this.orbitalCharge;
    this.orbitalCharge=orbitalRecordKill(prev,victimPos,this.map,killerPos);
    if(this.orbitalCharge===prev)return;
    this.spawnOrbitalMote(victimPos);
    // Reactor progression is visible in the HUD; no charged/claim banners.
  }
  /** Every Reaper swing emits a 360° purple shockwave, including complete
   * blade misses. Only one damage instance per victim per swing is permitted.
   * Applies to offline player and bots; multiplayer uses server hit results.
   */
  private offlineOrbitalStrikeDamage(
    targetId:string,damage:number,attacker:Combatant|null,
  ) {
    if(targetId===this.selfId){
      if(attacker){
        const aliveBefore=this.alive;
        this.takeDamage(damage,attacker.name,attacker.team,false,
          ORBITAL_REAPER_ID,attacker.pos);
        if(aliveBefore&&!this.alive)attacker.kills++;
      }
      return;
    }
    const victim=this.combatants.get(targetId);
    if(!victim?.alive)return;
    if(!attacker){
      this.applyDamageLocal(victim,damage,false,ORBITAL_REAPER_ID);
      return;
    }
    if((victim.spawnProtectedUntil??0)>Date.now())return;
    victim.health-=damage;
    if(victim.health>0)return;
    victim.alive=false;victim.deaths++;
    victim.deathAnimAt=performance.now();victim.deathAnimDur=900;
    attacker.kills++;
    this.recordOrbitalKill(victim.pos,attacker.pos);
    this.releaseOrbitalBotWeapon(victim);
    if(this.opts.mode==="ctf")this.dropOfflineCtfCarrier(victim.id,[...victim.pos] as Vec3);
    const entry:KillFeedEntry={
      killer:attacker.name,victim:victim.name,weapon:ORBITAL_REAPER_ID,
      headshot:false,killerTeam:attacker.team,victimTeam:victim.team,
    };
    this.killFeed.unshift(entry);
    if(this.killFeed.length>6)this.killFeed.pop();
    this.opts.onKillFeed(entry);
    this.scheduleRespawn(victim);
    this.checkWin();
  }
  private offlineOrbitalPulse(
    origin:Vec3,team:string,attacker:Combatant|null,excluded:string[]=[],
  ) {
    this.showOrbitalPulse(origin);
    const candidates=[...this.combatants.values()].map(c=>({
      id:c.id,pos:c.pos as readonly number[],alive:c.alive,
      protected:(c.spawnProtectedUntil??0)>Date.now(),friendly:this.opts.mode!=="ffa"&&this.opts.mode!=="gungame"&&c.team===team,
    }));
    if(attacker)candidates.push({
      id:this.selfId,pos:[this.pos.x,this.pos.y,this.pos.z],
      alive:this.alive,protected:this.selfSpawnProtectedUntil>Date.now(),
      friendly:this.opts.mode!=="ffa"&&this.opts.mode!=="gungame"&&this.opts.team===team,
    });
    const targets=orbitalPulseTargets(origin,candidates,pos=>{
      const dist=Math.hypot(pos[0]-origin[0],pos[2]-origin[2]);
      if(dist<.001)return false;
      const eye:Vec3=[origin[0],origin[1]+1.1,origin[2]];
      const dir:Vec3=[(pos[0]-origin[0])/dist,0,(pos[2]-origin[2])/dist];
      return this.map.cover.some(box=>{
        const hit=rayBox(eye,dir,box.pos,box.size);
        return hit!==null&&hit>.08&&hit<dist-.15;
      });
    },excluded);
    for(const id of targets)this.offlineOrbitalStrikeDamage(id,ORBITAL_PULSE_DAMAGE,attacker);
  }
  /** Gun Game's final tier uses the normal melee arc and cover rules, even for
   * AI opponents. Ordinary bot weapon pools never contain melee equipment. */
  private offlineBotMeleeSwing(attacker:Combatant,weaponId:string){
    const profile=quickMeleeProfile(weaponById(weaponId).stats,weaponId);
    const candidates=[...this.combatants.values()].filter(c=>c.id!==attacker.id)
      .map(c=>({id:c.id,pos:c.pos,alive:c.alive,
        protected:(c.spawnProtectedUntil??0)>Date.now(),
        friendly:this.opts.mode!=="ffa"&&this.opts.mode!=="gungame"&&c.team===attacker.team}));
    candidates.push({id:this.selfId,pos:[this.pos.x,this.pos.y,this.pos.z],
      alive:this.alive,protected:this.selfSpawnProtectedUntil>Date.now(),
      friendly:this.opts.mode!=="ffa"&&this.opts.mode!=="gungame"&&this.opts.team===attacker.team});
    const target=chooseQuickMeleeTarget(attacker.pos,attacker.yaw,candidates,
      (victim,dist)=>{
        const eye:Vec3=[attacker.pos[0],attacker.pos[1]+1.1,attacker.pos[2]];
        const dir:Vec3=[(victim.pos[0]-attacker.pos[0])/dist,0,
          (victim.pos[2]-attacker.pos[2])/dist];
        return !this.map.cover.some(box=>{
          const hit=rayBox(eye,dir,box.pos,box.size);
          return hit!==null&&hit>.08&&hit<dist-.15;
        });
      },profile.reach,profile.halfArcDegrees);
    if(!target)return;
    if(target.id===this.selfId){
      // A bot's kill must advance THE BOT in Gun Game, never the local player.
      const lethal=this.health-profile.damage<=0;
      const won=lethal&&this.opts.mode==="gungame"
        ?this.advanceCombatantGungameTier(attacker):false;
      this.takeDamage(profile.damage,attacker.name,attacker.team,false,weaponId,attacker.pos);
      if(won)this.finalizeMatchLocal();
      return;
    }
    const victim=this.combatants.get(target.id);
    if(!victim||!victim.alive)return;
    victim.health-=profile.damage;
    if(victim.health>0)return;
    const recent=this.offlineAssistDamage.get(victim.id);
    if(attacker.team===this.opts.team&&victim.team!==this.opts.team&&
      (this.opts.mode==="tdm"||this.opts.mode==="killconfirmed"||this.opts.mode==="ctf")&&
      recent&&recent.damage>=15&&performance.now()-recent.at<=10000)this.assists++;
    this.offlineAssistDamage.delete(victim.id);
    victim.alive=false;victim.deaths+=1;
    victim.deathAnimAt=performance.now();victim.deathAnimDur=900;
    if(attacker.team!==victim.team)this.recordOrbitalKill(victim.pos,attacker.pos);
    this.releaseOrbitalBotWeapon(victim);
    if(this.opts.mode==="ctf")this.dropOfflineCtfCarrier(victim.id,[...victim.pos] as Vec3);
    if(this.opts.mode!=="killconfirmed"&&this.opts.mode!=="ctf")victim.score=victim.kills;
    attacker.kills+=1;
    if(this.opts.mode!=="killconfirmed"&&this.opts.mode!=="ctf")attacker.score=attacker.kills;
    if(this.opts.mode==="killconfirmed")this.dropLocalKillConfirmedTag(victim.id,victim.team,victim.pos);
    if(this.opts.mode==="tdm")this.teamScores[attacker.team as "red"|"blue"]+=1;
    const entry:KillFeedEntry={killer:attacker.name,victim:victim.name,weapon:weaponId,
      headshot:false,killerTeam:attacker.team,victimTeam:victim.team};
    this.killFeed.unshift(entry);if(this.killFeed.length>6)this.killFeed.pop();
    this.opts.onKillFeed(entry);
    if(this.opts.mode==="gungame"&&this.advanceCombatantGungameTier(attacker)){
      this.finalizeMatchLocal();return;
    }
    this.scheduleRespawn(victim);
    this.checkWin();
  }

  private offlineOrbitalBotSwing(attacker:Combatant){
    const candidates=[...this.combatants.values()].filter(c=>c.id!==attacker.id)
      .map(c=>({id:c.id,pos:c.pos,alive:c.alive,
        protected:(c.spawnProtectedUntil??0)>Date.now(),friendly:this.opts.mode!=="ffa"&&this.opts.mode!=="gungame"&&c.team===attacker.team}));
    candidates.push({id:this.selfId,
      pos:[this.pos.x,this.pos.y,this.pos.z],alive:this.alive,
      protected:this.selfSpawnProtectedUntil>Date.now(),friendly:this.opts.mode!=="ffa"&&this.opts.mode!=="gungame"&&this.opts.team===attacker.team});
    const profile=quickMeleeProfile(weaponById(ORBITAL_REAPER_ID).stats,ORBITAL_REAPER_ID);
    const target=chooseQuickMeleeTarget(attacker.pos,attacker.yaw,candidates,
      (candidate,dist)=>{
        const eye:Vec3=[attacker.pos[0],attacker.pos[1]+1.1,attacker.pos[2]];
        const dir:Vec3=[(candidate.pos[0]-attacker.pos[0])/dist,0,
          (candidate.pos[2]-attacker.pos[2])/dist];
        return !this.map.cover.some(box=>{
          const hit=rayBox(eye,dir,box.pos,box.size);
          return hit!==null&&hit>.08&&hit<dist-.15;
        });
      },profile.reach,profile.halfArcDegrees);
    if(target)this.offlineOrbitalStrikeDamage(target.id,profile.damage,attacker);
    this.offlineOrbitalPulse(attacker.pos,attacker.team,attacker,target?[target.id]:[]);
  }
  private refreshOfflineOrbitalBotModel(bot:Combatant){
    if(!bot.group||this.opts.online)return;
    this.scene.remove(bot.group);
    bot.group.traverse(child=>{
      if(child instanceof THREE.Mesh){
        child.geometry.dispose();
        const mat=child.material;
        if(Array.isArray(mat))mat.forEach(m=>m.dispose());
        else mat.dispose();
      }else if(child instanceof THREE.Sprite){
        const mat=child.material as THREE.SpriteMaterial;
        mat.map?.dispose();mat.dispose();
      }
    });
    bot.group=undefined;
    bot.parts=undefined;
    this.addCombatantMesh(bot);
  }
  private releaseOrbitalBotWeapon(bot:Combatant){
    const original=this.orbitalBotHolders.get(bot.id);
    if(!original)return;
    this.orbitalBotHolders.delete(bot.id);
    bot.weaponId=original;
    if(bot.ai){bot.ai.ammoInMag=weaponById(original).stats.magSize;bot.ai.nextDecisionAt=0;}
    this.refreshOfflineOrbitalBotModel(bot);
  }
  private tickOrbitalPickup(){
    if(this.opts.online||this.preMatchCountdown>0||
      this.orbitalCharge<(reactorObjective(this.map)?.killsRequired??Infinity)||!reactorObjective(this.map))return;
    const contenders:{id:string;pos:Vec3;self:boolean;bot?:Combatant}[]=[];
    if(!this.orbitalWeaponActive&&this.alive){
      const pos:Vec3=[this.pos.x,this.pos.y,this.pos.z];
      if(orbitalCanClaim(this.orbitalCharge,pos,this.map,true))
        contenders.push({id:this.selfId,pos,self:true});
    }
    for(const bot of this.combatants.values()){
      if(!bot.ai||this.orbitalBotHolders.has(bot.id)||!orbitalCanClaim(
        this.orbitalCharge,bot.pos,this.map,bot.alive))continue;
      contenders.push({id:bot.id,pos:bot.pos,self:false,bot});
    }
    contenders.sort((a,b)=>objectiveDistance(this.map,a.pos)-objectiveDistance(this.map,b.pos)||
      a.id.localeCompare(b.id));
    const winner=contenders[0];if(!winner)return;
    this.orbitalCharge=0;
    if(winner.self)this.grantOrbitalReaper(true);
    else if(winner.bot){
      const bot=winner.bot;
      this.orbitalBotHolders.set(bot.id,bot.weaponId);
      bot.weaponId=ORBITAL_REAPER_ID;
      bot.ai!.ammoInMag=1;
      bot.ai!.reloadingUntil=0;
      bot.ai!.nextDecisionAt=0;
      this.refreshOfflineOrbitalBotModel(bot);
      // No claim announcement; the glowing weapon model indicates ownership.
    }
  }

  private buildCtfFlagModels() {
    const create=(color:number):THREE.Group=>{
      const group=new THREE.Group();
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(.075,.09,2.3,8),
        new THREE.MeshStandardMaterial({color:0xddddc7,metalness:.5,roughness:.4}));
      pole.position.y=1.15;pole.castShadow=true;group.add(pole);
      const cloth=new THREE.Mesh(new THREE.PlaneGeometry(1.35,.75),
        new THREE.MeshStandardMaterial({color,side:THREE.DoubleSide,roughness:.86,emissive:color,emissiveIntensity:.12}));
      cloth.position.set(.65,1.85,0);cloth.castShadow=true;group.add(cloth);
      const tip=new THREE.Mesh(new THREE.SphereGeometry(.16,9,8),
        new THREE.MeshStandardMaterial({color:0xf4e8b3}));
      tip.position.y=2.33;group.add(tip);
      this.scene.add(group);
      return group;
    };
    this.ctfFlagMeshes={red:create(0xef4444),blue:create(0x22baf5)};
    // Bespoke forest/orbital scenery supplies its own rings. Authored CTF maps
    // still need a visible delivery destination at the shared scoring position.
    for(const team of ["red","blue"] as const){
      if(this.ctfMarkers[team])continue;
      const marker=ctfDeliveryMarker(team,ctfBase(team,this.map));
      this.scene.add(marker);this.ctfMarkers[team]=marker;
    }
  }

  private updateCtfFlagsVisuals() {
    if(!this.ctfFlagMeshes)return;
    for(const team of ["red","blue"] as const){
      const flag=this.ctfFlags[team],mesh=this.ctfFlagMeshes[team];
      let pos:Vec3=flag.pos;
      if(flag.carrierId){
        if(flag.carrierId===this.selfId)pos=[this.pos.x,this.pos.y+1.25,this.pos.z];
        else{
          const carrier=this.combatants.get(flag.carrierId);
          if(!carrier){mesh.visible=false;continue;}
          pos=[carrier.pos[0],carrier.pos[1]+1.25,carrier.pos[2]];
        }
      }
      // A carrier never sees their own attached flag model/pole obstructing ADS.
      mesh.visible=flag.carrierId!==this.selfId;
      mesh.position.set(pos[0],pos[1],pos[2]);
    }
  }

  /** Map explicit CTF actions to feedback for the listener's team. */
  private announceCtfEvent(action: CtfAction, flag: FlagTeam, playerId: string): void {
    if (this.opts.team !== "red" && this.opts.team !== "blue") return;
    const feedback = ctfFeedback(action, flag, playerId, this.selfId, this.opts.team);
    this.ctfNotice = { label: feedback.label, at: performance.now() };
    if (feedback.sound) this.sound.play(feedback.sound, {
      volume: action === "capture" ? .88 : .7,
      throttleMs: 220,
    });
  }

  private dropOfflineCtfCarrier(id: string, pos: Vec3): void {
    const flag = ctfDrop(this.ctfFlags, id, pos);
    if (flag) this.announceCtfEvent("drop", flag, id);
  }

  private tickOfflineCtf() {
    if (this.opts.mode!=="ctf"||this.matchEnded)return;
    for (const flag of ctfReturnExpired(this.ctfFlags, Date.now(), this.ctfResetDurationMs, this.map))
      this.announceCtfEvent("auto_return", flag, "server");
    const actors:{id:string;team:FlagTeam;pos:Vec3;self:boolean;bot?:Combatant}[]=[];
    if(this.alive && (this.opts.team==="red"||this.opts.team==="blue"))
      actors.push({id:this.selfId,team:this.opts.team,pos:[this.pos.x,this.pos.y,this.pos.z],self:true});
    for(const bot of this.combatants.values())
      if(bot.alive&&(bot.team==="red"||bot.team==="blue"))
        actors.push({id:bot.id,team:bot.team,pos:bot.pos,self:false,bot});
    for(const actor of actors){
      const event=ctfTouch(this.ctfFlags,actor,this.map);
      if(!event)continue;
      this.announceCtfEvent(event.kind, event.flag, actor.id);
      if(event.kind==="return" && actor.self)this.flagReturns++;
      if(event.kind==="capture"){
        this.teamScores[actor.team]++;
        if(actor.self)this.ctfCaptures++;
        else if(actor.bot)actor.bot.score++;
        if (this.ctfOvertime) this.finalizeMatchLocal();
        else this.checkWin();
        if(this.matchEnded)return;
      }
    }
  }

  private buildObjectiveMarkers(){
    if(this.opts.mode!=="ctf")return;
    for(const team of ["red","blue"] as const){
      const zone=teamObjective(this.map,"capture_zone",team);if(!zone)continue;
      const marker=new THREE.Mesh(new THREE.RingGeometry(zone.radius*.65,zone.radius,48),
        new THREE.MeshBasicMaterial({color:team==="red"?0xff5959:0x55c8ff,side:THREE.DoubleSide,transparent:true,opacity:.8}));
      marker.rotation.x=-Math.PI/2;marker.position.set(zone.pos[0],zone.pos[1]+.07,zone.pos[2]);
      this.scene.add(marker);this.ctfMarkers[team]=marker;
      const flag=teamObjective(this.map,"flag",team);
      if(this.map.biome==="orbital"&&flag){
        const color=team==="red"?0xff5479:0x52ddff;
        const halo=new THREE.Mesh(new THREE.TorusGeometry(3.2,.15,8,40),
          new THREE.MeshBasicMaterial({color,transparent:true,opacity:.72,depthWrite:false,side:THREE.DoubleSide}));
        halo.position.set(flag.pos[0],flag.pos[1]+3.8,flag.pos[2]);halo.rotation.x=Math.PI/2;this.scene.add(halo);
        const beacon=new THREE.Mesh(new THREE.CylinderGeometry(.11,.18,5,8),
          new THREE.MeshBasicMaterial({color,transparent:true,opacity:.68,depthWrite:false}));
        beacon.position.set(flag.pos[0],flag.pos[1]+6.4,flag.pos[2]);this.scene.add(beacon);
      }
    }
  }
  private buildMapProps() {
    this.buildObjectiveMarkers();
    if(this.map.id==="orbital_nexus"||reactorObjective(this.map))this.buildOrbitalScenery();
    this.cityInteriorDetailGroups=[];
    if(this.map.id==="forest_warfare"){this.buildForestWarfare();return;}
    if(this.map.id==="floodgate"){
      this.floodgateBackdrop=buildFloodgateBackdrop(this.scene);
      this.floodgateFreight=buildFloodgateFreight(this.scene);
      buildFloodgateColorDressing(this.scene,this.map);
    }
    if(this.map.id==="whiteout_depot")this.whiteoutSnow=buildWhiteoutSnow(this.scene);
    const biome = this.map.biome ?? "industrial";
    const palette = this.map.theme;
    const stone = this.surfaceMaterials?.cover ?? new THREE.MeshStandardMaterial({color:palette.cover,roughness:.93});
    const masonry = this.surfaceMaterials?.wall ?? new THREE.MeshStandardMaterial({color:palette.wall,roughness:.8});
    const trim = new THREE.MeshStandardMaterial({color:palette.coverAccent,roughness:.48,metalness:.2});
    const trunk = new THREE.MeshStandardMaterial({color:biome==="jungle"?0x66523d:0x615448,roughness:1});
    const leaf = new THREE.MeshStandardMaterial({color:biome==="highlands"?0x326158:0x4a874e,roughness:1,side:THREE.DoubleSide});
    const leafDark = new THREE.MeshStandardMaterial({color:biome==="jungle"?0x315e37:0x3d6f5b,roughness:1});
    const moss = new THREE.MeshStandardMaterial({color:0x63834b,roughness:1});
    const glass = new THREE.MeshStandardMaterial({color:biome==="city"?0xffd7ac:0x8cdae7,
      metalness:.16,roughness:.3,emissive:biome==="city"?0xaa5d4b:0x317487,emissiveIntensity:.32});
    const asphalt = new THREE.MeshStandardMaterial({color:0x404858,roughness:.9});
    const scene = this.scene;
    if(biome==="city"||biome==="city_day"){
      this.gardenMaterial=createPatternedMaterial(biome==="city_day"?0x6e9f5b:0x408458,
        {pattern:"grass",tileSize:5,roughness:1});
    }
    const cube=(parent:THREE.Object3D,mat:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>{
      const geo=new THREE.BoxGeometry(w,h,d);
      if(mat instanceof THREE.MeshStandardMaterial && mat.map?.wrapS===THREE.RepeatWrapping){
        const slot=mat===this.surfaceMaterials?.wall?"wall":"cover";
        mapBoxUV(geo,parent.position.x+x,parent.position.z+z,this.map.surfaces?.[slot]?.tileSize??4);
      }
      const m=new THREE.Mesh(geo,mat);
      m.position.set(x,y,z);m.castShadow=h>=1;m.receiveShadow=true;parent.add(m);return m;
    };
    // Show moss/lichen on the upper faces of existing solid ruins, not as a
    // separate wall or a volumetric obstruction players can get trapped in.
    if(biome==="jungle") {
      let planted=0;
      for(const c of this.map.cover){
        if(planted>=90)break;
        if(c.kind==="stair"||c.kind==="solid"||c.kind==="accent"||c.environmentId)continue;
        if(c.size[0]<1.5||c.size[2]<1.3||c.size[1]<.6)continue;
        if(Math.abs(c.pos[0])+Math.abs(c.pos[2])>320)continue;
        const patch=new THREE.Mesh(new THREE.PlaneGeometry(c.size[0]*2*.8,c.size[2]*2*.74),moss);
        patch.rotation.x=-Math.PI/2;patch.position.set(c.pos[0],c.pos[1]+c.size[1]+.03,c.pos[2]);
        scene.add(patch);planted++;
      }
    }

    let floodgateLampIndex=0;
    for(const p of this.map.props ?? []){
      const group=new THREE.Group();
      group.position.set(p.x,p.y??0,p.z);
      const quarter=(((p.turns??0)%4)+4)%4;
      // Authored extents remain world-aligned for server collision, while
      // local geometry and door orientation preserve the saved quarter-turn.
      group.rotation.y=quarter*Math.PI/2;
      const worldW=p.w??8,worldD=p.d??7;
      const h=p.h??(p.kind==="shop"?8:4);
      const w=quarter%2?worldD:worldW,d=quarter%2?worldW:worldD;
      if(isFactoryMachineKind(p.kind)){
        // Machine meshes dress pre-existing blueprint solids; collision remains
        // authoritative in those features instead of being duplicated here.
        buildFactoryMachinery(group,p.kind,w,d,h,this.map.id==="floodgate"?p.color:undefined);
      }else if(p.kind==="tree"){
        const bole=new THREE.Mesh(new THREE.CylinderGeometry(.45,.55,h*.42,6),trunk);
        bole.position.y=h*.21;bole.castShadow=true;group.add(bole);
        for(let i=0;i<3;i++){
          const canopy=new THREE.Mesh(new THREE.ConeGeometry(h*(.22-i*.025),h*.37,7),i===1?leafDark:leaf);
          canopy.position.y=h*(.43+i*.19);canopy.castShadow=i===0;group.add(canopy);
        }
      }else if(p.kind==="bush"){
        const bush=new THREE.Mesh(new THREE.IcosahedronGeometry(Math.max(.7,h*.6),0),leaf);
        bush.scale.set(1.25,.65,1);bush.position.y=h*.4;group.add(bush);
        const other=new THREE.Mesh(new THREE.IcosahedronGeometry(h*.4,0),leafDark);
        other.position.set(.8,h*.35,.3);group.add(other);
      }else if(p.kind==="rock"){
        const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(1,0),stone);
        rock.scale.set(w*.48,h*.56,d*.5);rock.position.y=h*.48;rock.rotation.y=p.x*.07;rock.castShadow=true;group.add(rock);
        if(biome==="jungle"){
          const carpet=new THREE.Mesh(new THREE.IcosahedronGeometry(1,0),moss);
          carpet.scale.set(w*.35,h*.14,d*.31);carpet.position.y=h*.87;group.add(carpet);
        }else if(biome==="highlands"){
          const snow=new THREE.Mesh(new THREE.ConeGeometry(w*.33,h*.25,6),
            new THREE.MeshStandardMaterial({color:0xe2edf0,roughness:1}));
          snow.position.y=h*.82;group.add(snow);
        }

      }else if(p.kind==="garden"){
        // Large, accessible grass square; there is no solid collision volume.
        const parkGeo=new THREE.PlaneGeometry(w,d);
        mapFloorUV(parkGeo,p.x,p.z,5);
        const park=new THREE.Mesh(parkGeo,
          this.gardenMaterial??new THREE.MeshStandardMaterial({color:0x63965b,roughness:1}));
        park.rotation.x=-Math.PI/2;park.position.y=.035;park.receiveShadow=true;group.add(park);
        for(const side of [-1,1]){
          cube(group,stone,side*w*.49,.11,0,.45,.22,d);
          cube(group,stone,0,.11,side*d*.49,w,.22,.45);
        }
      }else if(p.kind==="bench"){
        const wood=new THREE.MeshStandardMaterial({color:0xa8835c,roughness:.85});
        cube(group,wood,0,.78,0,2.5,.22,.9);
        cube(group,wood,0,1.3,-.43,2.5,1.1,.18);
        for(const x of [-.9,.9])cube(group,masonry,x,.36,0,.18,.65,.75);
      }else if(p.kind==="bandstand"){
        // Accessible sniper lookout: the shared physical roof + two full
        // stair flights are emitted by propColliders and drawn by buildArena.
        const columns=new THREE.MeshStandardMaterial({color:biome==="city_day"?0xf0d7ad:0xaec7d8,roughness:.72});
        for(const x of [-w*.42,w*.42])for(const z of [-d*.42,d*.42])
          cube(group,columns,x,(h+5.2)/2,z,.72,h+5.2,.72);
        const cap=new THREE.Mesh(new THREE.ConeGeometry(w*.63,2.4,8),trim);
        cap.position.y=h+6.1;cap.rotation.y=Math.PI/8;cap.castShadow=true;group.add(cap);
        cube(group,stone,0,.22,0,w*.88,.45,d*.88);
        for(const z of [-d*.42,d*.42])cube(group,columns,0,h+5.05,z,w*.82,.35,.45);
      }else if(p.kind==="building"){
        // The arena already renders cityBuildingBoxes via shared map.cover,
        // including polygonal/rectangular walls, stair treads and roof hatches.
        // Add architectural identity and themed, collision-matched furniture
        // WITHOUT placing an unrelated solid box over an enterable doorway.
        const daylight=biome==="city_day";
        const use=p.use??"house";
        const isRound=p.shape==="round";
        const facadeColor=new THREE.Color(CITY_USE_FACADE_COLORS[use]??0x9f8f87);
        facadeColor.lerp(new THREE.Color(CITY_FACADE_TINTS[p.facade??"brick"]),.39);
        const tint=new THREE.MeshStandardMaterial({
          color:facadeColor,roughness:daylight?.82:.7,
          metalness:use==="office"||p.facade==="industrial"?.22:.04,
        });
        const wood=new THREE.MeshStandardMaterial({color:daylight?0xa77855:0x70513f,roughness:.86});
        const seating=new THREE.MeshStandardMaterial({color:use==="cafe"?0x8b5347:0x54786f,roughness:.8});
        const metal=new THREE.MeshStandardMaterial({color:0x859397,roughness:.45,metalness:.55});
        const display=new THREE.MeshStandardMaterial({color:daylight?0xe1b887:0xf0a6b1,roughness:.45,emissive:daylight?0x161109:0x632638,emissiveIntensity:.24});
        const fabric=new THREE.MeshStandardMaterial({color:use==="clinic"?0xc9dbde:0xc2b5a4,roughness:.93});
        const wallPaint=new THREE.MeshStandardMaterial({color:daylight?0xc6b8a2:0x86808e,roughness:.94});
        const detailFirstChild=group.children.length;
        // Individual interiors have distinct floor materials, shop displays,
        // wall treatments and purpose-specific visual props. All SOLID items
        // come from cityInteriorFixtures and share collision with the server.
        const interiorFloor=new THREE.MeshStandardMaterial({color:
          ["cafe","bakery","diner"].includes(use)?0x8d715b:
          ["house","apartments","hotel"].includes(use)?0x746655:
          ["clinic","gym"].includes(use)?0x91a1a2:
          ["florist","gallery"].includes(use)?0x777a66:
          ["workshop","supermarket"].includes(use)?0x54585a:0x69727b,
          roughness:["clinic","supermarket"].includes(use)?.52:.88});
        cube(group,interiorFloor,0,.035,0,w-.9,.07,d-.9);
        if(["house","apartments","hotel","library"].includes(use)){
          cube(group,fabric,-w*.23,.08,-d*.35,Math.min(4.6,w*.33),.045,Math.min(3.6,d*.27));
        }
        // Wall-mounted identity cues never obstruct doorways or walking lanes.
        const accentMat=new THREE.MeshStandardMaterial({color:
          ["clinic","office"].includes(use)?0x76c6c9:
          ["bakery","cafe","diner"].includes(use)?0xdfac73:
          ["gym","workshop"].includes(use)?0xdbb24f:
          ["gallery","florist"].includes(use)?0xb4b985:0xc6a48c,
          roughness:.72,emissive:daylight?0x070706:0x16100a,emissiveIntensity:.20});
        for(const side of [-1,1]){
          cube(group,accentMat,side*w*.29,Math.min(3.3,h*.64),-d/2+.53,
            Math.min(2.9,w*.20),.85,.12);
        }
        if(["supermarket","library","office","gym","clinic"].includes(use)){
          for(const side of [-1,1]){
            cube(group,accentMat,side*w*.40,.10,-d*.02,.10,.06,d*.66);
          }
        }
        // All large pieces use the exact collision footprint from map-visuals.
        // The decorative subdivisions remain inside the fixture's AABB.
        for(const item of cityInteriorFixtures({...p,w,d})){
          const {x,z,w:fw,d:fd,h:fh,style}=item;
          const part=(mat:THREE.Material,px:number,py:number,pz:number,pw:number,ph:number,pd:number)=>
            cube(group,mat,x+px,py,z+pz,pw,ph,pd);
          if(style==="partition"){
            part(wallPaint,0,fh/2,0,fw,fh,fd);
            part(wood,0,.09,0,fw,.16,fd+.09);
            part(wood,0,fh-.09,0,fw,.16,fd+.09);
          }else if(style==="bed"){
            part(wood,0,.18,0,fw,.36,fd);
            part(fabric,0,.44,0,fw*.92,.25,fd*.87);
            part(display,0,.59,-fd*.31,fw*.72,.09,fd*.21);
            part(wood,0,fh*.58,-fd*.45,fw,.70,.13);
          }else if(style==="sofa"||style==="bench"){
            part(seating,0,.41,0,fw,.39,fd*.73);
            part(seating,0,fh*.52,-fd*.40,fw,fh*.9,fd*.20);
            for(const side of [-1,1])
              part(wood,side*(fw/2-.13),fh*.31,0,.25,fh*.5,fd*.9);
            if(style==="sofa")
              for(const side of [-1,1])part(fabric,side*fw*.21,.67,fd*.12,fw*.34,.13,fd*.40);
          }else if(style==="table"||style==="desk"||style==="workbench"){
            part(style==="workbench"?metal:wood,0,fh*.83,0,fw,.17,fd);
            for(const side of [-1,1])
              part(wood,side*fw*.40,fh*.40,0,.18,fh*.76,fd*.67);
            if(style==="desk"){
              part(metal,0,fh*.69,-fd*.18,fw*.30,.34,.13);
              part(display,0,fh*.75,-fd*.10,fw*.29,.14,.08);
            }else if(style==="workbench"){
              part(metal,0,fh*.49,-fd*.18,fw*.65,.16,fd*.28);
            }
          }else if(style==="shelf"||style==="cabinet"||style==="locker"){
            for(const side of [-1,1])
              part(metal,side*(fw/2-.08),fh/2,0,.15,fh,fd);
            for(let i=0;i<(style==="shelf"?4:3);i++){
              const y=.16+i*(fh-.26)/(style==="shelf"?3:2);
              part(style==="cabinet"?wood:metal,0,y,0,fw,.1,fd);
            }
            if(style==="locker")part(display,0,fh*.7,fd*.5,fw*.65,.04,.05);
          }else if(style==="counter"||style==="reception"){
            part(wood,0,fh*.41,0,fw,fh*.82,fd*.74);
            part(style==="reception"?display:metal,0,fh*.89,0,fw,.14,fd);
            part(display,-fw*.24,fh*.99,-fd*.13,fw*.20,.13,fd*.18);
          }else if(style==="display"){
            part(wood,0,fh*.27,0,fw,fh*.54,fd);
            part(display,0,fh*.60,0,fw*.8,fh*.14,fd*.78);
            part(metal,0,fh*.8,0,fw*.68,fh*.34,fd*.67);
          }else if(style==="plant"){
            part(wood,0,.3,0,fw*.65,.60,fd*.65);
            const leaves=new THREE.Mesh(new THREE.IcosahedronGeometry(.52,1),leaf);
            leaves.position.set(x,fh*.71,z);
            leaves.scale.set(.8,1.1,.8);group.add(leaves);
          }else if(style==="espresso"){
            part(metal,0,.28,0,fw*.94,.54,fd*.94);
            part(wood,0,.63,0,fw,.14,fd);
            part(display,-fw*.20,.97,0,fw*.28,.61,fd*.45);
            part(metal,fw*.25,.84,0,.19,.34,.24);
            part(seating,fw*.18,1.05,fd*.13,.28,.15,.22);
          }else if(style==="oven"){
            part(asphalt,0,fh*.42,0,fw,fh*.84,fd);
            part(metal,0,fh*.84,0,fw,.16,fd);
            part(display,0,fh*.43,fd/2+.015,fw*.76,fh*.48,.08);
            for(const side of [-1,1])part(wood,side*fw*.3,fh*.83,fd*.28,.22,.08,.21);
          }else if(style==="checkout"){
            part(wood,0,fh*.40,0,fw,fh*.8,fd);
            part(metal,0,fh*.89,0,fw,.17,fd);
            part(display,-fw*.22,fh*1.03,-fd*.15,fw*.25,.28,.16);
            part(asphalt,fw*.30,fh*.95,0,.19,.28,fd*.45);
          }else if(style==="treadmill"){
            part(asphalt,0,.13,0,fw,.24,fd);
            part(asphalt,0,.28,0,fw*.81,.07,fd*.83);
            for(const side of [-1,1])part(metal,side*fw*.44,fh*.52,-fd*.42,.13,fh*.82,.14);
            part(display,0,fh*.89,-fd*.44,fw*.71,.18,.15);
          }else if(style==="exam_bed"){
            part(metal,0,.26,0,fw*.93,.48,fd*.91);
            part(fabric,0,.62,0,fw,.22,fd);
            part(display,0,.80,-fd*.32,fw*.82,.12,fd*.20);
            part(metal,0,fh*.59,fd*.44,fw*.89,.55,.11);
          }else if(style==="sculpture"){
            part(wood,0,.23,0,fw*.92,.44,fd*.92);
            const sculpture=new THREE.Mesh(new THREE.IcosahedronGeometry(Math.min(fw,fd)*.40,1),display);
            sculpture.scale.set(.9,1.3,.8);sculpture.position.set(x,fh*.60,z);group.add(sculpture);
          }else if(style==="server_rack"){
            part(asphalt,0,fh*.48,0,fw,fh*.96,fd);
            for(let i=0;i<6;i++){
              part(metal,0,fh*(.15+i*.11),fd/2+.02,fw*.85,.12,.09);
              part(display,-fw*.30,fh*(.16+i*.11),fd/2+.08,.10,.06,.035);
            }
          }else if(style==="television"){
            part(wood,0,.25,0,fw*.87,.49,fd);
            part(asphalt,0,fh*.73,0,fw*.88,fh*.45,.22);
            part(display,0,fh*.75,fd*.12,fw*.74,fh*.32,.06);
          }
        }
        if(this.map.biome==="city"||this.map.biome==="city_day"){
          const details=new THREE.Group();
          for(const obj of group.children.slice(detailFirstChild))details.add(obj);
          group.add(details);
          this.cityInteriorDetailGroups.push({node:details,x:p.x,z:p.z});
        }
        const faceZ=d/2+.48;
        const doorWidth=Math.min(5,w*.31);
        // Slim external cladding sits flush on the collision-backed masonry.
        // Leave the real south entrance unpainted and avoid inventing square
        // facade faces around the rounded/stepped footprints.
        if(isRound){
          const shoulderX=w*.32,shoulderZ=d*.32;
          cube(group,tint,0,h/2,-d/2-.46,shoulderX*2-.15,h-.1,.055);
          for(const side of [-1,1]){
            cube(group,tint,side*(w/2+.46),h/2,0,.055,h-.1,shoulderZ*2-.12);
            const span=shoulderX-doorWidth/2;
            cube(group,tint,side*(shoulderX+doorWidth/2)/2,h/2,d/2+.46,span-.1,h-.1,.055);
          }
        }else{
          const segment=(w-doorWidth)/2;
          cube(group,tint,0,h/2,-d/2-.46,w-.15,h-.1,.055);
          for(const side of [-1,1]){
            cube(group,tint,side*(w/2+.46),h/2,0,.055,h-.1,d-.15);
            cube(group,tint,side*(w+doorWidth)/4,h/2,d/2+.46,segment-.1,h-.1,.055);
          }
        }
        // Jambs keep the entrance conspicuous. All ornamentation is thin and
        // the opening at ground level remains collision-free.
        for(const side of [-1,1]){
          cube(group,tint,side*(doorWidth/2+.12),1.26,faceZ,.19,2.52,.22);
          cube(group,tint,side*Math.min(w*.35,doorWidth/2+2.1),h*.67,faceZ+.02,
            Math.min(2.5,w*.13),h*.23,.11);
        }
        cube(group,tint,0,2.58,faceZ,doorWidth+.45,.23,.38);
        const windowZ=d/2+.53;
        for(const side of [-1,1]){
          const x=side*(isRound?w*.18:w*.32);
          cube(group,glass,x,h*.55,windowZ,Math.min(2.5,w*.16),Math.max(1.15,h*.19),.12);
          cube(group,tint,x,h*.67,windowZ+.02,Math.min(2.8,w*.18),.12,.22);
        }
        if(!isRound){
          for(const side of [-1,1])
            cube(group,glass,side*(w/2+.48),h*.49,-d*.19,.13,Math.max(1.05,h*.18),Math.min(3.6,d*.19));
        }
        // Taller offices/hotels/apartments reveal their different storeys.
        if(h>=8){
          for(const level of [.45,.73]){
            cube(group,tint,0,h*level,d/2+.51,w*.82,.19,.24);
          }
        }
        if(p.shape==="narrow"){
          cube(group,tint,0,h+.42,0,w+.65,.16,d*.86);
        }else if(isRound){
          // Stepped octagonal shell: this slender crown follows the smaller
          // polygonal roof without making an invisible solid interior.
          const ring=new THREE.Mesh(new THREE.TorusGeometry(Math.min(w,d)*.30,.14,6,12),tint);
          ring.rotation.x=Math.PI/2;ring.position.y=h+.4;group.add(ring);
        }else if(use==="house"){
          // Residential porch and a low slatted overhang distinguish homes.
          cube(group,wood,0,2.84,d/2+1.15,doorWidth+1.4,.15,1.7);
        }else if(use==="supermarket"){
          cube(group,tint,0,3.0,d/2+.95,w*.8,.17,1.9);
        }
        // Deliberately different street fronts: bay trims, slatted facades
        // and awnings respond to material palette and building use.
        if(p.facade==="timber"||p.facade==="industrial"){
          for(const side of [-1,1])
            cube(group,wood,side*(w*.41),h*.48,d/2+.54,.16,h*.63,.13);
        }
        if(p.facade==="glass"||p.facade==="stucco"){
          const panes=p.facade==="glass"?3:2;
          for(let i=0;i<panes;i++){
            const px=(-.30+i*.30)*w;
            if(Math.abs(px)<doorWidth/2+.2)continue;
            cube(group,glass,px,h*.43,d/2+.58,Math.min(1.7,w*.12),h*.2,.10);
          }
        }
        if(["cafe","bakery","diner","florist","clinic"].includes(use)){
          const awning=new THREE.MeshStandardMaterial({color:
            use==="florist"?0x518b69:use==="clinic"?0x6ca8c6:0xb85b52,roughness:.86});
          cube(group,awning,0,3.2,d/2+1.02,doorWidth+1.9,.15,1.5);
          for(const side of [-1,1])
            cube(group,display,side*(doorWidth/2+.72),2.86,d/2+1.37,.20,.48,.11);
        }
                // Purpose-specific fascia: no misleading painted door on a solid wall.
        if(p.text && p.text.trim().toUpperCase() !== "RESIDENCE"){
          const canvas=document.createElement("canvas");
          canvas.width=512;canvas.height=96;
          const ctx=canvas.getContext("2d");
          if(ctx){
            ctx.fillStyle=daylight?"#f6ecdf":"#252638";
            ctx.fillRect(0,0,512,96);
            ctx.fillStyle=daylight?"#283845":"#fff0c1";
            ctx.font="bold 42px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
            ctx.fillText(p.text.slice(0,18),256,48,488);
            const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
            const sign=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w*.72,15),1.25),
              new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide}));
            sign.position.set(0,Math.min(h-.7,3.65),d/2+.64);group.add(sign);
          }
        }
      }else if(p.kind==="dock"){
        const timber=new THREE.MeshStandardMaterial({color:0xa87b52,roughness:.9});
        cube(group,timber,0,.43,0,w,.7,d);
        for(let x=-w/2+1;x<w/2;x+=2)
          cube(group,masonry,x,.84,0,.08,.06,d);
        for(const x of [-w*.4,w*.4])for(const z of [-d*.42,d*.42])
          cube(group,stone,x,.85,z,.28,1.7,.28);
      }else if(p.kind==="boat"){
        // Clearly readable hull, gunwale and wheelhouse, authored at dockside.
        const hull=new THREE.MeshStandardMaterial({color:0x335872,roughness:.67});
        const boat=new THREE.Mesh(new THREE.CylinderGeometry(Math.min(d*.46,w*.26),Math.min(d*.36,w*.18),1.7,8),hull);
        boat.scale.set(w/Math.max(4,d),1,1);boat.rotation.z=Math.PI/2;
        boat.position.y=1.3;boat.castShadow=true;group.add(boat);
        cube(group,stone,0,1.95,0,w*.72,.35,d*.9);
        cube(group,masonry,-w*.13,3.3,0,w*.34,2.3,d*.58);
        cube(group,glass,-w*.13,3.6,d*.3,w*.24,.8,.12);
        cube(group,trim,w*.4,1.95,0,.2,2.6,.2);
      }else if(p.kind==="shop"){
        // Solid shop exteriors deliberately sit beside open streets/plazas.
        // Windows, illuminated signage and an entry graphic give recognisable
        // facades; no false doorway claims to be an enterable interior.
        cube(group,masonry,0,h/2,0,w,h,d);
        const windowCount=Math.max(2,Math.min(6,Math.round(w/3)));
        for(let i=0;i<windowCount;i++){
          const wx=-w/2+(i+.5)*w/windowCount;
          cube(group,glass,wx,h*.58,d/2+.07,w/windowCount*.64,h*.23,.14);
          cube(group,trim,wx,h*.73,d/2+.09,w/windowCount*.75,.14,.2);
        }
        cube(group,asphalt,-w*.22,h*.25,d/2+.09,w*.19,h*.47,.16);
        cube(group,trim,0,h*.84,d/2+.20,w*.86,h*.17,.24);
        if(p.text){
          const canvas=document.createElement("canvas");
          canvas.width=512;canvas.height=96;
          const ctx=canvas.getContext("2d");
          if(ctx){
            ctx.fillStyle="#202439";ctx.fillRect(0,0,512,96);
            ctx.fillStyle="#fff0c1";ctx.font="bold 44px sans-serif";
            ctx.textAlign="center";ctx.textBaseline="middle";
            ctx.fillText(p.text.slice(0,20),256,48,490);
            const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
            const sign=new THREE.Mesh(new THREE.PlaneGeometry(w*.83,h*.17),
              new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide}));
            sign.position.set(0,h*.84,d/2+.35);group.add(sign);
          }
        }
      }else if(p.kind==="ruin"||p.kind==="temple"){
        // Roofless broken masonry frame: open approach and sight through the
        // centre, with collision approximated by the JSON prop footprint.
        const col=Math.max(1.2,w*.14);
        for(const x of [-w*.35,w*.35])for(const z of [-d*.35,d*.35])
          cube(group,stone,x,h*.37,z,col,h*.74,col);
        cube(group,masonry,0,h*.8,0,w,.65,d*.16);
        if(biome==="jungle"){
          cube(group,moss,0,h*.83,0,w*.86,.08,d*.12);
        }
      }else if(p.kind==="container"){
        const paint=p.color?new THREE.MeshStandardMaterial({color:p.color,roughness:.75,metalness:.25}):stone;
        cube(group,paint,0,h/2,0,w,h,d);
        for(const rib of containerSideStripes(w,d,h))
          cube(group,trim,rib.x,rib.y,rib.z,rib.w,rib.h,rib.d);
      }else if(p.kind==="crane"){
        cube(group,masonry,0,h*1.3,0,1.4,h*2.6,1.4);
        cube(group,trim,w*.15,h*2.55,0,w*.95,.65,.8);
        cube(group,masonry,w*.55,h*1.9,0,.08,h*.85,.08);
      }else if(p.kind==="antenna"){
        cube(group,stone,0,h/2,0,.35,h,.35);
        cube(group,trim,0,h*.75,0,5,.22,.22);
      }else if(p.kind==="terminal"){
        cube(group,masonry,0,1.1,0,2,2.2,1.3);
        cube(group,glass,0,1.48,.7,1.5,.75,.08);
      }else if(p.kind==="lamp" && biome==="volcanic_castle"){
        const height = p.h ?? 3;
        cube(group, masonry, 0, height * 0.38, 0, .23, height * .76, .23);
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.46, .20, .32, 8), trim);
        bowl.position.y = height * .76;
        group.add(bowl);
        const flame = new THREE.Mesh(new THREE.ConeGeometry(.29, .73, 7),
          new THREE.MeshBasicMaterial({ color: p.color ?? "#ff943f" }));
        flame.position.set(.04, bowl.position.y + .43, 0);
        flame.rotation.z = -.18;
        group.add(flame);
        const light = new THREE.PointLight(p.color ?? "#ff943f", 22, 11);
        light.position.y = flame.position.y + .15;
        group.add(light);
      }else if(p.kind==="lamp"){
        const postH=p.h??6.4;
        cube(group,masonry,0,postH/2,0,.19,postH,.19);
        cube(group,trim,.53,postH-.16,0,1.22,.17,.30);
        const glow=new THREE.Mesh(new THREE.SphereGeometry(.28,8,6),
          new THREE.MeshBasicMaterial({color:p.color??"#ffd39c"}));
        glow.position.set(1.04,postH-.30,0);group.add(glow);
        // Long streets can have many posts; cap costly dynamic point lights
        // while keeping every lamp's glowing head visible.
        const illuminate = this.map.id==="floodgate"
          ?(++floodgateLampIndex%3===0)
          : ((this.map.biome!=="city"&&this.map.biome!=="city_day") ||
          (Math.abs(Math.round(p.x*7+p.z*11))%11)===0);
        if(illuminate){
          const pl=new THREE.PointLight(this.map.id==="floodgate"?(p.color??"#ffd39c"):0xffce90,
            this.map.id==="floodgate"?1.25:.52,this.map.id==="floodgate"?28:12);
          pl.position.set(.95,postH-.32,0);group.add(pl);
        }
      }else if(p.kind==="sign"){
        cube(group,masonry,0,2.15,0,.3,4.3,.3);
        cube(group,trim,0,4.35,0,w,1.4,.35);
        if(p.text){
          const canvas=document.createElement("canvas");
          canvas.width=512;canvas.height=96;
          const ctx=canvas.getContext("2d");
          if(ctx){
            ctx.clearRect(0,0,512,96);
            ctx.fillStyle="#ffffff";ctx.font="bold 38px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
            ctx.fillText(p.text.slice(0,22),256,48,480);
            const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
            const board=new THREE.Mesh(new THREE.PlaneGeometry(w*.92,1.15),
              new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide}));
            board.position.set(0,4.35,.22);group.add(board);
          }
        }
      }
      if(group.children.length)scene.add(group);
    }
  }

  /** Geometry is local to this engine instance and cleaned up on dispose. */
  private buildEnvironment() {
    for (const o of this.map.environment ?? []) {
      const g = new THREE.Group();
      g.position.set(...o.pos);
      g.userData.environmentType = o.type;
      if (o.type === "lava") {
        g.add(buildLavaSurface(o, this.lavaTime));
      } else if (o.type === "fire") {
        const floor = new THREE.Mesh(
          new THREE.CylinderGeometry(o.size[0], o.size[0], 0.06, 28),
          new THREE.MeshBasicMaterial({ color: 0xb6300c, transparent: true, opacity: 0.5, depthWrite: false })
        );
        floor.position.y = 0.03;
        g.add(floor);
        for (let i = 0; i < 7; i++) {
          const a = i / 7 * Math.PI * 2;
          const flame = new THREE.Mesh(
            new THREE.ConeGeometry(0.32 + (i % 3) * 0.08, 1.1 + (i % 2) * 0.5, 5),
            new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffb326 : 0xff5416, transparent: true, opacity: 0.83, depthWrite: false })
          );
          flame.position.set(Math.sin(a) * o.size[0] * 0.58, 0.65, Math.cos(a) * o.size[2] * 0.58);
          flame.userData.flame = true;
          flame.userData.seed = i;
          g.add(flame);
        }
        const light = new THREE.PointLight(0xff5d1a, 2.2, 9);
        light.position.y = 1.3;
        g.add(light);
      } else if (o.type === "spikes" && o.visual === "steam") {
        buildSteamVent(g,o);
      } else if (o.type === "spikes") {
        const base = new THREE.Mesh(new THREE.BoxGeometry(o.size[0] * 2, 0.12, o.size[2] * 2),
          new THREE.MeshStandardMaterial({ color: 0x361318, roughness: 0.6, metalness: 0.6 }));
        g.add(base);
        for (let x = -1.5; x <= 1.5; x++) for (let z = -1.5; z <= 1.5; z++) {
          const spike = new THREE.Mesh(new THREE.ConeGeometry(0.20, 0.65, 4),
            new THREE.MeshStandardMaterial({ color: 0xc9d0d7, metalness: 0.85, roughness: 0.3 }));
          spike.position.set(x * o.size[0] / 2, 0.34, z * o.size[2] / 2);
          g.add(spike);
        }
      } else if (o.type === "jump_pad") {
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(o.size[0], o.size[0], 0.18, 32),
          new THREE.MeshStandardMaterial({ color: 0x126577, emissive: 0x08beea, emissiveIntensity: 0.7, metalness: 0.3 }));
        disc.position.y = 0.05;
        g.add(disc);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(o.size[0] * 0.78, 0.10, 8, 32),
          new THREE.MeshBasicMaterial({ color: 0x5beaff }));
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.17;
        g.add(ring);
      } else if (o.type === "moving_platform") {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(o.size[0] * 2, o.size[1] * 2, o.size[2] * 2),
          new THREE.MeshStandardMaterial({ color: 0x256d83, metalness: 0.6, roughness: 0.35, emissive: 0x0a4b60, emissiveIntensity: 0.25 }));
        slab.castShadow = true; slab.receiveShadow = true;
        g.add(slab);
      } else if (o.type === "destructible_wall") {
        const isDamCore=o.id===FLOODGATE_CORE_ID;
        const isDamPanel=floodgateDamageTarget(o.id)===FLOODGATE_CORE_ID;
        const wall = new THREE.Mesh(new THREE.BoxGeometry(o.size[0] * 2, o.size[1] * 2, o.size[2] * 2),
          new THREE.MeshStandardMaterial({ color: isDamCore?0xf4b754:isDamPanel?0xc18248:0xa27b65, roughness: 0.88,
            emissive:isDamCore?0x6f2e08:0x000000, emissiveIntensity:isDamCore ? 0.55 : 0 }));
        wall.castShadow = true; wall.receiveShadow = true;
        g.add(wall);
        // Steel rim helps distinguish destructible cover from permanent concrete.
        const rim = new THREE.Mesh(new THREE.BoxGeometry(o.size[0] * 2 + 0.12, 0.12, o.size[2] * 2 + 0.12),
          new THREE.MeshStandardMaterial({ color: 0xf28d52, emissive: 0x7d3010, emissiveIntensity: 0.25 }));
        rim.position.y = o.size[1] - 0.07;
        g.add(rim);
        if(isDamPanel){
          // All five orange panels share one structural hit pool, so every
          // visible section invites fire instead of pretending to be invulnerable.
          const stripeMat=new THREE.MeshBasicMaterial({color:0xf7d16d});
          for(const stripeX of [-o.size[0]*.60,0,o.size[0]*.60]){
            const stripe=new THREE.Mesh(new THREE.BoxGeometry(.34,Math.min(3.4,o.size[1]*1.25),.08),stripeMat);
            stripe.position.set(stripeX,0,o.size[2]+.075);
            g.add(stripe);
          }
        }
        if(isDamPanel)buildFloodgateDamCracks(g,o.size[0],o.size[1],o.size[2]+.19,
          (o.pos[0]+150)*.13);
        if(isDamCore){
          // A bright physical target rather than another in-world text sign.
          const plate=new THREE.Mesh(new THREE.TorusGeometry(2.5,.21,8,32),
            new THREE.MeshBasicMaterial({color:0xffbd57}));
          plate.position.set(0,0,o.size[2]+.09);g.add(plate);
          const hub=new THREE.Mesh(new THREE.CylinderGeometry(.7,.7,.3,16),
            new THREE.MeshStandardMaterial({color:0x253943,emissive:0xee871d,emissiveIntensity:.7}));
          hub.rotation.x=Math.PI/2;hub.position.set(0,0,o.size[2]+.2);g.add(hub);
        }
      }
      this.scene.add(g);
      this.environmentMeshes.set(o.id, g);
    }
  }

  /** Update platform physics, trap animation and world visuals from shared time. */
  private updateEnvironment(dt: number): void {
    const previous = this.environmentTime;
    this.environmentTime += dt;
    this.lavaTime.value = this.environmentTime;
    // The distant spillway and the playable steam grates share the exact same
    // authoritative active window. Decorative water no longer suggests damage
    // while the grates are safe.
    if(this.map.id==="floodgate"&&this.floodgateBackdrop){
      const age=this.floodgateBreachAt===null?null:this.environmentTime-this.floodgateBreachAt;
      updateFloodgateBreachVisual(this.floodgateBackdrop,age);
      if(setFloodgateFreightStage(this.map,age)) {
        // Re-plan only when a pillar falls or its new bridge becomes solid.
        for(const bot of this.combatants.values())if(bot.isBot&&bot.ai){
          bot.ai.routeWaypoint=null;bot.ai.nextRouteAt=0;
        }
      }
      if(this.floodgateFreight)updateFloodgateFreight(this.floodgateFreight,age);
      const vent=(this.map.environment??[]).find(o=>o.type==="spikes"&&o.visual==="steam");
      if(vent&&vent.type==="spikes")
        setFloodgatePurgeVisual(this.floodgateBackdrop,age===null&&periodicHazardPhase(vent,this.environmentTime)==="active");
    }
    if(this.map.id==="whiteout_depot" && this.scene.fog instanceof THREE.Fog){
      const strength=whiteoutIntensity(this.environmentTime)*whiteoutExposure(this.pos.x,this.pos.z);
      const nvg=this.aiming&&this.adsProgress>.5&&this.sightDef.overlay==="nvg";
      // NVG helps in snow, but never extends sight as far as thermal heat signatures.
      this.scene.fog.near=THREE.MathUtils.lerp(this.map.theme.fogNear,nvg?16:9,strength);
      this.scene.fog.far=THREE.MathUtils.lerp(this.map.theme.fogFar,nvg?82:42,strength);
      if(this.scene.background instanceof THREE.Color)
        this.scene.background.set(this.map.theme.sky).lerp(new THREE.Color("#e2edf4"),strength*.48);
      if(this.whiteoutSnow)updateWhiteoutSnow(this.whiteoutSnow,strength,this.environmentTime,this.pos.x,this.pos.y+2,this.pos.z);
    }
    const objects = this.map.environment ?? [];
    if (!this.opts.online && objects.some(o => o.type === "lava")) {
      const now = performance.now();
      for (const bot of this.combatants.values()) {
        if (bot.isBot && bot.alive && lavaAt(objects, bot.pos)) this.eliminateBotByEnvironment(bot, LAVA_DEATH_SOURCE, now);
      }
    }
    for (const o of objects) {
      const g = this.environmentMeshes.get(o.id);
      if (!g) continue;
      if (o.type === "moving_platform") {
        const oldPos = environmentPosition(o, previous);
        const newPos = environmentPosition(o, this.environmentTime);
        const top = oldPos[1] + o.size[1];
        const onPlatform = (p: Vec3) =>
          Math.abs(p[1] - top) < 0.28 && Math.abs(p[0] - oldPos[0]) <= o.size[0] && Math.abs(p[2] - oldPos[2]) <= o.size[2];
        if (this.alive && this.onGround && onPlatform([this.pos.x, this.pos.y, this.pos.z])) {
          this.pos.add(new THREE.Vector3(newPos[0] - oldPos[0], newPos[1] - oldPos[1], newPos[2] - oldPos[2]));
        }
        if (!this.opts.online) for (const c of this.combatants.values()) {
          if (c.alive && onPlatform(c.pos)) c.pos = [c.pos[0] + newPos[0] - oldPos[0], c.pos[1] + newPos[1] - oldPos[1], c.pos[2] + newPos[2] - oldPos[2]];
        }
        moveEnvironmentCover(this.map, o, this.environmentTime);
        g.position.set(...newPos);
      } else if (o.type === "spikes" && o.visual === "steam") {
        g.visible=this.floodgateBreachAt===null;
        if(g.visible)updateSteamVent(g,o,this.environmentTime);
      } else if (o.type === "spikes") {
        const phase=periodicHazardPhase(o,this.environmentTime),active=phase==="active";
        // The dark base remains visible during the inactive/telegraph phase.
        g.children.forEach((child, i) => { child.visible = i === 0 || active; });
        if((o.warningFor??0)>0){
          const base=g.children[0];
          if(base instanceof THREE.Mesh&&base.material instanceof THREE.MeshStandardMaterial){
            base.material.emissive.setHex(phase==="warning"?(Math.sin(this.environmentTime*12)>0?0xffa22b:0x603010):0);
            base.material.emissiveIntensity=.8;
          }
        }
      } else if (o.type === "fire") {
        g.children.forEach(c => {
          if (c.userData.flame) {
            const seed = c.userData.seed as number;
            c.scale.y = 0.75 + Math.sin(this.environmentTime * 11 + seed * 2.3) * 0.25;
            c.position.y = 0.55 + Math.sin(this.environmentTime * 8 + seed) * 0.13;
          } else if (c instanceof THREE.PointLight) {
            c.intensity = 1.8 + Math.sin(this.environmentTime * 9) * 0.45;
          }
        });
      } else if (o.type === "jump_pad") {
        const glow = g.children[1];
        if (glow) glow.rotation.z = this.environmentTime * 0.65;
      }
    }
  }

  private damageEnvironmentWall(id: string, damage: number): void {
    id=floodgateDamageTarget(id);
    const original = (this.map.environment ?? []).find(o => o.id === id);
    if (!original || original.type !== "destructible_wall") return;
    const hp = this.environmentWalls.get(id) ?? original.hp;
    if (hp <= 0) return;
    this.setEnvironmentWallHP(id, Math.max(0, hp - damage));
    if(!this.opts.online)this.hitMarkerAt=performance.now();
  }

  private setEnvironmentWallHP(id: string, hp: number): void {
    const o = (this.map.environment ?? []).find(o => o.id === id);
    if (!o || o.type !== "destructible_wall") return;
    const old = this.environmentWalls.get(id) ?? o.hp;
    this.environmentWalls.set(id, hp);
    const mesh = this.environmentMeshes.get(id);
    if(mesh&&floodgateDamageTarget(id)===FLOODGATE_CORE_ID)
      updateFloodgateDamCracks(mesh,hp,o.hp);
    if (mesh) {
      mesh.visible = hp > 0;
      const wall = mesh.children[0];
      if (wall instanceof THREE.Mesh && wall.material instanceof THREE.MeshStandardMaterial) {
        const t = Math.max(0, Math.min(1, hp / o.hp));
        if(id===FLOODGATE_CORE_ID)
          wall.material.color.setRGB(.62+t*.28,.27+t*.30,.08+t*.15);
        else if(floodgateDamageTarget(id)===FLOODGATE_CORE_ID)
          wall.material.color.setRGB(.46+.25*t,.24+.16*t,.10+.12*t);
        else wall.material.color.setRGB(0.4 + t * 0.22, 0.25 + t * 0.12, 0.24 + t * 0.12);
      }
    }
    if(id===FLOODGATE_CORE_ID && hp!==old){
      // Offline prediction and online snapshots use the same single HP pool.
      // Update each panel's actual HP, not just its paint material.
      for(const panelId of floodgateBreachTargets(id))
        if(this.environmentWalls.has(panelId))this.setEnvironmentWallHP(panelId,hp);
    }
    if (old > 0 && hp <= 0) {
      if(id===FLOODGATE_CORE_ID&&this.floodgateBreachAt===null){
        this.floodgateBreachAt=this.environmentTime;
        // Pillars stay upright until advancing water reaches them.
        // Wall removal also invalidates bot paths.
        for(const bot of this.combatants.values())if(bot.isBot&&bot.ai){
          bot.ai.routeWaypoint=null;bot.ai.nextRouteAt=0;
        }
      }
      breakEnvironmentWall(this.map, id);
      if(id===FLOODGATE_CORE_ID&&this.floodgateBackdrop)
        setFloodgateBreachVisual(this.floodgateBackdrop,true);
      // One core explosion, not five simultaneous particles for linked panels.
      if(floodgateDamageTarget(id)!==FLOODGATE_CORE_ID||id===FLOODGATE_CORE_ID)
        this.spawnExplosion(new THREE.Vector3(...o.pos));
    }
  }

  /** Offline player + bot hazard damage, and client-predicted jump pad launch. */
  private interactEnvironment(): void {
    if (!this.alive || this.matchEnded) return;
    const now = performance.now();
    const feet: Vec3 = [this.pos.x, this.pos.y, this.pos.z];
    const objects = this.map.environment ?? [];
    if (!this.opts.online && lavaAt(objects, feet)) {
      this.takeDamage(this.health, "Environment", "ffa", false, LAVA_DEATH_SOURCE);
      return;
    }
    const floodAge=this.map.id==="floodgate"&&this.floodgateBreachAt!==null
      ?this.environmentTime-this.floodgateBreachAt:null;
    const flood=floodgateWaterEffect(this.pos.x,this.pos.y,this.pos.z,floodAge,this.map.cover);
    if(!this.opts.online&&flood.surge&&now>=(this.environmentCooldown.get("floodgate-surge")??0)&&
        this.selfSpawnProtectedUntil<=Date.now()){
      this.environmentCooldown.set("floodgate-surge",now+900);
      this.takeDamage(28,"Environment","ffa",false,"env_floodgate_surge");
    }

    for (const o of objects) {
      if (o.type === "jump_pad" && withinEnvironment(o, feet) && this.onGround && now >= (this.environmentCooldown.get(o.id) ?? 0)) {
        this.environmentCooldown.set(o.id, now + 700);
        this.vel.y = o.launch[1];
        this.vel.x += o.launch[0];
        this.vel.z += o.launch[2];
        this.pos.y += 0.12;
        this.onGround = false;
        if (this.activePerkId !== "silent_steps") this.sound.play("footstep", { volume: 0.7 });
      }
      if (this.opts.online || (this.selfSpawnProtectedUntil > Date.now())) continue;
      if (o.type !== "fire" && o.type !== "spikes") continue;
      if (o.type === "spikes" && ((o.visual==="steam"&&floodAge!==null) ||
          !spikesActive(o, this.environmentTime))) continue;
      if (!withinEnvironment(o, feet)) continue;
      const interval = o.type === "fire" ? 250 : 900;
      if (now < (this.environmentCooldown.get(o.id) ?? 0)) continue;
      this.environmentCooldown.set(o.id, now + interval);
      this.takeDamage(o.type === "fire" ? o.dps * interval / 1000 : o.damage, "Environment", "ffa", false, o.type);
    }
    if (this.opts.online) return;
    // Bots receive environmental damage independently of player weapon scoring.
    for (const c of this.combatants.values()) {
      if (!c.isBot || !c.alive || c.spawnProtectedUntil && c.spawnProtectedUntil > Date.now()) continue;
      const botFlood=floodgateWaterEffect(c.pos[0],c.pos[1],c.pos[2],floodAge,this.map.cover);
      if(botFlood.surge){
        const key=c.id+"|floodgate-surge";
        if(now>=(this.environmentCooldown.get(key)??0)){
          this.environmentCooldown.set(key,now+900);
          c.health=Math.max(0,c.health-28);
          if(c.health<=0){
            this.eliminateBotByEnvironment(c, "env_floodgate_surge", now);
            continue;
          }
        }
      }
      for (const o of objects) {
        if (o.type === "jump_pad" && c.ai && c.ai.envJumpVelocityY === undefined && withinEnvironment(o, c.pos)) {
          const key = `${c.id}|${o.id}|jump`;
          if (now >= (this.environmentCooldown.get(key) ?? 0)) {
            this.environmentCooldown.set(key, now + 900);
            c.ai.envJumpVelocityY = o.launch[1];
            c.ai.envLaunchX = o.launch[0];
            c.ai.envLaunchZ = o.launch[2];
            c.pos[1] += 0.12;
          }
        }
        if (o.type !== "fire" && o.type !== "spikes") continue;
        if (o.type === "spikes" && ((o.visual==="steam"&&floodAge!==null) ||
          !spikesActive(o, this.environmentTime))) continue;
        if (!withinEnvironment(o, c.pos)) continue;
        const key = `${c.id}|${o.id}`;
        const interval = o.type === "fire" ? 250 : 900;
        if (now < (this.environmentCooldown.get(key) ?? 0)) continue;
        this.environmentCooldown.set(key, now + interval);
        c.health -= o.type === "fire" ? o.dps * interval / 1000 : o.damage;
        if (c.health <= 0) {
          this.eliminateBotByEnvironment(c, o.type, now);
          break;
        }
      }
    }
  }

  private eliminateBotByEnvironment(bot: Combatant, weapon: string, now: number): void {
    bot.alive = false; bot.health = 0; bot.deaths++;
    if (this.opts.mode === "ctf") this.dropOfflineCtfCarrier(bot.id, [...bot.pos]);
    bot.deathAnimAt = now; bot.deathAnimDur = 900;
    const entry: KillFeedEntry = { killer: "Environment", victim: bot.name, weapon,
      headshot: false, killerTeam: "ffa", victimTeam: bot.team };
    this.killFeed.unshift(entry);
    if (this.killFeed.length > 6) this.killFeed.pop();
    this.opts.onKillFeed(entry);
    if (this.opts.mode !== "survival") this.scheduleRespawn(bot);
  }

  /** Animated camo: scrolling procedural starfield or bioluminescent sludge.
   * No remote textures or assets; the same material moves across the actual
   * receiver and barrel meshes instead of just a static menu swatch.
   */
  private createPrestigeTexture(kind: "cosmic" | "toxic"): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 192; canvas.height = 192;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createLinearGradient(0, 0, 192, 192);
    if (kind === "cosmic") {
      gradient.addColorStop(0, "#020716");
      gradient.addColorStop(.4, "#392768");
      gradient.addColorStop(.7, "#070b24");
      gradient.addColorStop(1, "#102b58");
    } else {
      gradient.addColorStop(0, "#051609");
      gradient.addColorStop(.45, "#174f16");
      gradient.addColorStop(.75, "#9fbf20");
      gradient.addColorStop(1, "#112409");
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 192, 192);
    // Repeatable pseudo-random coordinates so the camo doesn't flicker on swap.
    let seed = kind === "cosmic" ? 31337 : 871;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < (kind === "cosmic" ? 175 : 100); i++) {
      const x = random() * 192, y = random() * 192;
      const radius = kind === "cosmic" ? .25 + random() * 1.5 : 1 + random() * 7;
      if (kind === "cosmic") {
        ctx.fillStyle = random() > .75 ? "#a7f3ff" : "#efe4ff";
        ctx.globalAlpha = .35 + random() * .65;
      } else {
        ctx.fillStyle = random() > .6 ? "#baff25" : "#07190b";
        ctx.globalAlpha = .12 + random() * .42;
      }
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1.35, 1.35);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Contrasting procedural twill across the complete carbon-fiber finish. */
  private createCarbonTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#111820"; ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 16) for (let x = 0; x < 256; x += 16) {
      const alt = ((x + y) / 16) % 2 === 0;
      ctx.fillStyle = alt ? "#647788" : "#344554";
      ctx.fillRect(x + 1, y + 1, 13, 13);
      ctx.strokeStyle = alt ? "#8995a3" : "#495968";
      ctx.lineWidth = 2;
      for (let i = 2; i <= 11; i += 4) {
        ctx.beginPath(); ctx.moveTo(x + i, y + 1); ctx.lineTo(x + i + 5, y + 14); ctx.stroke();
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2); tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private buildViewmodel() {
    // Direct rebuilds supersede pending visual handoffs.
    this.swapViewmodelPending = false;
    this.viewmodelWeaponId = this.weaponId;
    if(this.riotShieldModel){this.disposeRiotModel(this.riotShieldModel);this.riotShieldModel=null;}
    if(this.weaponId===RIOT_SHIELD_ID){this.riotShieldModel=createRiotShieldModel(true);this.camera.add(this.riotShieldModel);}
    // ---- CRITICAL: tear down the previous viewmodel before building a new one ----
    // Old parts are parented directly to `this.camera` and never removed — without
    // this cleanup, every weapon swap stacks another full set of meshes on the
    // camera. After 10+ swaps the per-frame matrix updates balloon and the game
    // freezes. We remove each old part from the camera, dispose its geometry +
    // material, then clear the vmParts list.
    for (const p of this.vmParts) {
      this.camera.remove(p.obj);
      p.obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          const m = child.material;
          if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
          else m?.dispose();
        }
      });
    }
    this.vmParts = [];
    this.prestigeTexture?.dispose();
    this.prestigeTexture = null;
    this.sightMesh = null;
    // The support-hand rig has a separate animation track but shares the
    // camera's local coordinate system and lifetime with the weapon model.
    this.clearFirstPersonRig();

    const skin = weaponSkinById(this.weaponId==="wonder_turret"?"default":this.getCurrentSkinId());
    // Viewmodel uses MeshBasicMaterial (unlit, always full-bright) so the weapon is
    // guaranteed visible against any background — MeshStandardMaterial rendered too
    // dark without an environment map. We fake shading by using a lighter main colour
    // and darker accent parts.
    const baseCol = new THREE.Color(skin.color);
    // Lighten the base colour toward a mid steel-grey so the weapon reads against any
    // background (the raw skin colour #2b2f36 is too dark to see in-game).
    let lightCol = this.weaponId===ORBITAL_REAPER_ID?new THREE.Color(0xb578ff):baseCol.clone().lerp(new THREE.Color(0xaab4c0), skin.id === "gold" ? 0.16 : 0.7);
    // ---- Per-weapon body tint (Issue 7 + Issue c round 2) ----
    // Each weapon gets a VIBRANT unique hue so the player can tell at a glance
    // which weapon they're holding, even within the same category. Previously the
    // tints were too subtle (55% lerp toward grey washed them out). Now the tints
    // are applied with only 35% grey-lerp so the weapon's signature colour is
    // clearly visible. Default skins use the weapon's signature tint; unlocked
    // skins override this with the skin's color.
    const isDefaultSkin = skin.id === "default";
    const fullLegendaryFinish = coatsAllWeaponParts(skin) || skin.id === "carbon";
    if (isDefaultSkin) {
      const weaponTints: Record<string, number> = {
        rifle_electron: 0x097b99, // exposed cyan reactor
        crossbow_reclaimer: 0x344b2d, // muted green composite
        pistol_arc: 0x563582, // violet arc capacitor
        rifle_ar: 0x2b3a5a,       // steel blue
        rifle_dm: 0x4a2a1a,       // warm brown (battle rifle)
        rifle_burst: 0x1a3a4a,    // teal
        rifle_heavy: 0x3a1a1a,    // dark red
        smg_kp: 0x1a3a2a,         // dark teal
        smg_vector: 0x2a1a3a,     // dark purple
        smg_compact: 0x2a3a1a,    // olive
        shotgun_br: 0x4a2a1a,     // wood-brown
        shotgun_auto: 0x1a1a1a,   // matte black
        shotgun_combat: 0x1a2a2a, // gunmetal
        pistol_side: 0x2a2a2a,    // dark grey
        pistol_magnum: 0x5a3a1a,  // gold-brown (revolver)
        pistol_burst: 0x1a2a3a,   // blue-grey
        pistol_machine: 0x3a1a1a, // dark red
        dmr_scout: 0x1a3a1a,      // dark green
        dmr_heavy: 0x1a1a2a,      // dark indigo
        lmg_hv: 0x3a2a2a,         // dark warm grey
        lmg_light: 0x1a2a1a,      // military green
        sniper_lr: 0x0a1a2a,      // dark blue-black
        sniper_scout: 0x1a2a2a,   // grey-blue (lighter than Longshot)
        launcher_rocket: 0x2a3a1a,// olive green
        launcher_breach: 0x4d4034, // steel brown
        launcher_swarm: 0x364753,  // gunmetal blue
        wonder_corrosion: 0x3b5535, // muted toxic olive, no cyan trim
        wonder_deadlock: 0x603076,
        wonder_hellfire: 0xe54512,
        wonder_singularity: 0x302164,
        wonder_turret: 0x4d565c,
      };
      const tint = weaponTints[this.weaponId];
      if (tint !== undefined) {
        // Reduced grey-lerp from 55% → 35% so the weapon's signature colour is
        // clearly visible (not washed out). The tint is the dominant colour now.
        lightCol = new THREE.Color(tint).lerp(new THREE.Color(0xaab4c0), 0.35);
      }
    }
    const darkCol = skin.id === "gold" ? new THREE.Color(0x3c2c17) : baseCol.clone().lerp(new THREE.Color(0x000000), 0.35);
    const emissiveCol = skin.emissive ? new THREE.Color(skin.emissive) : null;
    this.weaponMat = new THREE.MeshBasicMaterial({
      color: lightCol,
    }) as unknown as THREE.MeshStandardMaterial; // keep type for muzzle flash tinting
    if (skin.id === "carbon") {
      this.prestigeTexture = this.createCarbonTexture();
      const material = this.weaponMat as unknown as THREE.MeshBasicMaterial;
      material.map = this.prestigeTexture;
      material.color.set(0xffffff);
      material.needsUpdate = true;
    }
    if (skin.prestige || (["wonder_singularity","wonder_stormweaver"].includes(this.weaponId) && isDefaultSkin)) {
      // Only explicitly selected Prestige skins override an existing cosmetic.
      // Event Horizon defaults to the Eventide cosmic pattern; explicit skins
      // take precedence. Hellfire stays red/orange instead of toxic green.
      this.prestigeTexture = this.createPrestigeTexture(skin.prestige ?? "cosmic");
      const material = this.weaponMat as unknown as THREE.MeshBasicMaterial;
      material.map = this.prestigeTexture;
      material.color.set(0xffffff);
      material.needsUpdate = true;
    }
    if (emissiveCol && !skin.prestige) {
      // For glowing skins, tint the basic material toward the emissive colour.
      (this.weaponMat as unknown as THREE.MeshBasicMaterial).color.lerp(emissiveCol, 0.4);
    }
    // Gold retains dark hardware and distinctive inserts; Inferno and animated
    // Prestige finishes deliberately coat the entire model.
    const accentMat = fullLegendaryFinish
      ? this.weaponMat
      : new THREE.MeshBasicMaterial({ color: darkCol });
    const glowMat = fullLegendaryFinish
      ? this.weaponMat
      : emissiveCol ? new THREE.MeshBasicMaterial({ color: emissiveCol })
        : new THREE.MeshBasicMaterial({ color: darkCol });

    // We add each viewmodel part DIRECTLY to the camera (not via a Group). Direct
    // camera children render reliably; parenting a Group to the camera caused the
    // group's children to not render in some environments. Each part's position is
    // set each frame to (base * scale + vmOffset) so the whole weapon moves together.
    this.viewmodel = new THREE.Group(); // kept for type compat; not added to the scene
    this.sightMesh = null;

    const addPart = (mesh: THREE.Object3D, baseX: number, baseY: number, baseZ: number) => {
      // Capture the exact rest orientation and scale *before* applying the
      // viewmodel's global scale. Do not reconstruct the rest orientation from
      // Euler components (parts may use a non-default Euler order).
      const baseQuat = mesh.quaternion.clone();
      const baseScale = mesh.scale.clone();
      mesh.scale.copy(baseScale).multiplyScalar(this.vmScale);
      mesh.frustumCulled = false;
      this.vmParts.push({
        obj: mesh,
        base: new THREE.Vector3(baseX, baseY, baseZ),
        baseQuat,
        baseScale,
      });
      this.camera.add(mesh);
    };

    // ---- Body construction: distinct silhouette per weapon category ----
    // Each category gets its own body / barrel / mag / grip / stock dimensions
    // so the player can tell at a glance whether they're holding an SMG, sniper,
    // LMG, pistol, or melee weapon. `muzzleZ` is the forward end of the barrel
    // (camera-local -Z) — used by the suppressor + muzzle flash blocks below.
    const category: WeaponCategory = weaponById(this.weaponId).category;
    const wid = this.weaponId;
    let muzzleZ = -0.7;  // default (assault); overridden per-category

    if (category === "melee") {
      muzzleZ = buildMeleeWeaponParts(wid,this.weaponMat,accentMat,addPart);
    } else {
      // Every ranged weapon is now built from its OWN substantial 3D silhouette,
      // rather than a common category receiver with tiny extra details.
      // The helper returns the actual barrel tip for muzzle-flash attachments.
      muzzleZ = buildFirstPersonWeapon(wid, this.weaponMat, accentMat, addPart,
        fullLegendaryFinish ? this.weaponMat : undefined,
        !isDefaultSkin ? (skin.id === "gold" ? accentMat : this.weaponMat) : undefined);
    }
    // A purchased charm lives on the weapon model rather than the HUD. It
    // inherits all aim, reload, sway and recoil transforms automatically.
    const equippedCharm=this.currentSlot==="secondary"?this.opts.loadout.secondaryCharmId:
      this.currentSlot==="melee"?this.opts.loadout.meleeCharmId:this.opts.loadout.primaryCharmId;
    if(equippedCharm&&equippedCharm!=="none"&&category!=="melee"){
      const charm=createWeaponCharm(equippedCharm,true);
      if(charm)addPart(charm,...weaponCharmMountPoint(this.weaponId,"firstPerson"));
    }
    // ---- Category accent band (Issue c round 2) ----
    // A bright, saturated COLOURED BAND wrapped around the weapon body near the
    // front of the receiver. The colour identifies the weapon CATEGORY at a
    // glance — even if the player can't see the full silhouette, the coloured
    // band tells them "red = assault rifle, yellow = SMG, orange = shotgun,
    // purple = sniper, green = LMG, blue = DMR, white = pistol, lime = PDW, amber = launcher". This is the
    // single most impactful visual cue for weapon identification.
    // The band is ONLY added for ranged weapons (not melee — melee weapons
    // already have distinct shapes: knife/shiv/machete/hammer).
    if (category !== "melee" && !weaponById(this.weaponId).wonder) {
      const categoryAccentColors: Record<string, number> = {
        assault: 0xff3b3b,    // red
        smg: 0xffd93b,        // yellow
        shotgun: 0xff8c3b,    // orange
        dmr: 0x3b7bff,        // blue
        sniper: 0x9b3bff,     // purple
        lmg: 0x3bff7b,        // green
        pistol: 0xe0e0e0,     // white
        pdw: 0xa6f060,        // lime
        launcher: 0xfb923c,   // amber
      };
      const accentColor = categoryAccentColors[category] ?? 0xffffff;
      const bandMat = fullLegendaryFinish
        ? this.weaponMat
        : new THREE.MeshBasicMaterial({ color: accentColor });
      // The band is a thin box positioned on top of the weapon body, near the
      // front (forward of the magazine). It's small enough to not clutter the
      // model but large enough to be clearly visible at a glance.
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(0.105, 0.022, 0.115),
        bandMat,
      );
      // Position the band just above the body center, forward of the sight mount.
      // For most weapons this puts it on the receiver top, between the sight and
      // the muzzle — visible from the player's POV.
      const bandZ = muzzleZ * 0.35;  // ~35% of the way from origin to muzzle
      addPart(band, 0, 0.045, bandZ);
    }
    // ---- Sight (per-sight-type scope mesh) ----
    // The shape of the optic on the weapon varies by sight type so the player can
    // see at a glance what's equipped. The sight mesh is hidden during ADS so it
    // never blocks the camera (the HUD renders the reticle overlay instead).
    // Reads the CURRENT slot's attachments (primary, secondary, or melee) so the
    // viewmodel reflects what the player is actually holding.
    const currentAtts = this.getCurrentAttachments();
    // The physical optic must follow THIS weapon's explicit, compatible sight
    // attachment or its own built-in scope — never another weapon's old slot
    // value or an incompatible/stale attachment identifier.
    const wDef = weaponById(this.weaponId);
    if (category !== "melee" && (hasMountedSight(wDef, currentAtts) ||
        (!wDef.wonder && this.sightDef.type === "iron"))) {
      const scopeGroup = new THREE.Group();
      const st = this.sightDef.type;
      if (st === "acog" || st === "hunter" || st === "thermal" || st === "nvg" || st === "sniper_scope") {
        // Magnified tube scope
        const tubeLen = (st === "hunter" || st === "sniper_scope") ? 0.16 : 0.12;
        const tubeRad = (st === "hunter" || st === "sniper_scope") ? 0.045 : 0.04;
        const scope = new THREE.Mesh(new THREE.CylinderGeometry(tubeRad, tubeRad, tubeLen, 16, 1, true), accentMat);
        scope.rotation.x = Math.PI / 2;
        scopeGroup.add(scope);
        // Front + rear lens caps (rings)
        const ringGeo = new THREE.TorusGeometry(tubeRad + 0.006, 0.008, 8, 20);
        const frontRing = new THREE.Mesh(ringGeo, accentMat);
        frontRing.position.z = -tubeLen / 2;
        scopeGroup.add(frontRing);
        const rearRing = new THREE.Mesh(ringGeo, accentMat);
        rearRing.position.z = tubeLen / 2;
        scopeGroup.add(rearRing);
        // Intentionally NO opaque tinted cap: the tube is open-ended so the scene
        // is actually visible through the optic. Tint/reticle belongs in the HUD.
        // Mount post connecting scope to weapon body
        const mount = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.04), accentMat);
        mount.position.y = -tubeRad;
        scopeGroup.add(mount);
      } else if (st === "red_dot" || st === "holo") {
        // Red dot / holo: small lens window with a glowing dot
        // Four-sided OPEN viewing frame instead of a solid plate across the glass.
        for (const side of [-1, 1]) {
          const upright = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.057, 0.008), accentMat);
          upright.position.x = side * 0.035;
          scopeGroup.add(upright);
          const rim = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.006, 0.008), accentMat);
          rim.position.y = side * 0.03;
          scopeGroup.add(rim);
        }
        // The aiming dot is drawn by the HUD at the actual screen centre.
        // Base mount
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.05), accentMat);
        base.position.y = -0.03;
        scopeGroup.add(base);
      } else if (st === "laser") {
        // Laser sight: small projector box with a red emitter
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.06), accentMat);
        scopeGroup.add(box);
        const emitter = new THREE.Mesh(
          new THREE.CircleGeometry(0.005, 10),
          fullLegendaryFinish ? this.weaponMat : new THREE.MeshBasicMaterial({ color: 0xff2222 })
        );
        emitter.position.set(0, 0, -0.031);
        emitter.rotation.y = Math.PI;
        scopeGroup.add(emitter);
      } else {
        // Low-profile rear notch pressed directly onto the existing receiver.
        // No elevated scope riser, tower, floating aperture or 'ladder'.
        for (const side of [-1,1]) {
          const ear = new THREE.Mesh(new THREE.BoxGeometry(.014,.036,.026),accentMat);
          ear.position.set(side*.029,.013,0);
          scopeGroup.add(ear);
        }
        const rearBase = new THREE.Mesh(new THREE.BoxGeometry(.075,.012,.040),accentMat);
        rearBase.position.y=-.009;
        scopeGroup.add(rearBase);
      }
      const mountHeight = adsClearance(
        wDef, st, WEAPON_VISUALS[this.weaponId]?.receiver?.[1] ?? .18,
      ).sightMountY;
      // Scope bodies and low rear notches are part of the same rigid gun pose.
      addPart(scopeGroup, 0, mountHeight, -0.1);
      if (st === "iron") {
        // Matching front blade: mounted on the actual barrel toward the muzzle,
        // not raised on stilts above the player's weapon.
        const front = new THREE.Mesh(new THREE.BoxGeometry(.012,.038,.023),accentMat);
        addPart(front, 0, mountHeight+.01, muzzleZ+.08);
      }
      this.sightMesh = scopeGroup;
    }
    // Poison tips are part of the BOLT, not a muzzle suppressor.
    const hasMuzzleAttachment = !!currentAtts.barrel && currentAtts.barrel !== "barrel_poison";
    if (this.weaponId === "crossbow_reclaimer" && currentAtts.barrel === "barrel_poison") {
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.027, 0.11, 8),
        fullLegendaryFinish ? this.weaponMat : new THREE.MeshBasicMaterial({ color: 0x75f26d })
      );
      tip.rotation.x = -Math.PI / 2;
      addPart(tip, 0, 0.06, muzzleZ - 0.055);
    }
    if (hasMuzzleAttachment) {
      const supp = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 12), accentMat);
      supp.rotation.x = Math.PI / 2;
      // Suppressor extends 0.2 forward from the bare muzzle tip (muzzleZ). Its
      // center is therefore at muzzleZ - 0.1.
      addPart(supp, 0, 0.0, muzzleZ - 0.1);
    }
    if (currentAtts.grip === "grip_laser") {
      const laser = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.08), glowMat);
      addPart(laser, 0, -0.09, -0.2);
    }

    // Permanent right-hand contact at the trigger. The left hand has its own
    // camera-space rig, so it can leave the handguard during reloads and throws.
    const gloveMaterial = new THREE.MeshBasicMaterial({ color: 0x354652 });
    const cuffMaterial = new THREE.MeshBasicMaterial({ color: 0x1c2832 });
    const triggerGlove = new THREE.Mesh(new THREE.BoxGeometry(.11,.11,.12), gloveMaterial);
    triggerGlove.rotation.z = -.15;
    addPart(triggerGlove, .09, -.15, .15);
    const wristCuff = new THREE.Mesh(new THREE.CylinderGeometry(.054,.066,.13,9), cuffMaterial);
    wristCuff.rotation.x = -.55;
    addPart(wristCuff, .11, -.23, .21);

    // muzzle flash — sits at the bare muzzle tip (or the suppressor tip if equipped)
    const flashZ = hasMuzzleAttachment ? muzzleZ - 0.2 : muzzleZ;
    const flashColor = this.weaponId === "rifle_electron" ? 0x63eaff
      : this.weaponId === "pistol_arc" ? 0xc0a0ff : 0xffdd66;
    this.muzzleFlash = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 8),
      new THREE.MeshBasicMaterial({ color: flashColor, transparent: true, opacity: 0 })
    );
    addPart(this.muzzleFlash, 0, 0.0, flashZ);
    this.muzzleLight = new THREE.PointLight(flashColor, 0, 6);
    addPart(this.muzzleLight, 0, 0.0, flashZ);

    // Add the camera to the scene so its children (the viewmodel parts) are in the
    // scene graph and get their world matrices updated each frame.
    this.scene.add(this.camera);
    this.buildFirstPersonRig();
    this.positionViewmodel();
    // Rebuild the active sight's laser together with every weapon model change.
    this.rebuildLaserIndicator();
  }

  /** One shared left-hand rig: it holds each firearm during regular gameplay,
   *  then moves to the reload/equipment pose. It is not duplicated or embedded in
   *  the rigid weapon meshes, so the magazine can be removed independently. */
  private buildFirstPersonRig() {
    // Riot shield weapons render a sidearm under the shield. When the shield is
    // destroyed, the offhand resumes a conventional two-handed pistol grip.
    const contactId = this.weaponId === RIOT_SHIELD_ID ? "pistol_side" : this.weaponId;
    this.fpSupportGrip.set(...firstPersonSupportGrip(contactId));

    const hand = new THREE.Group();
    // The glove follows the weapon contact. The arm segments live in a
    // separate camera-local group: their ends are rebuilt from the fixed
    // shoulder and the animated glove wrist, so they cannot disconnect when
    // the weapon is long or the hand moves during a reload.
    const arm = new THREE.Group();
    // Two tapered sleeve pieces meet at a small joint. No enormous
    // spherical/elbow pad geometry that protrudes from the arm silhouette.
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(.067, .079, 1, 10), this.fpCuffMat);
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(.052, .066, 1, 10), this.fpCuffMat);
    const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(.066, 10, 8), this.fpCuffMat);
    const shoulderJoint = new THREE.Mesh(new THREE.SphereGeometry(.080, 10, 8), this.fpCuffMat);
    shoulderJoint.position.copy(this.fpShoulder);
    for (const mesh of [upper, forearm, elbowJoint, shoulderJoint]) {
      mesh.frustumCulled = false;
      arm.add(mesh);
    }
    arm.visible = false;
    this.fpSupportArm = { root: arm, upper, forearm, elbow: elbowJoint, shoulder: shoulderJoint };
    this.camera.add(arm);

    const glove = new THREE.Mesh(new THREE.BoxGeometry(.132, .108, .14), this.fpHandMat);
    glove.position.set(0, -.028, .015);
    hand.add(glove);
    const knuckles = new THREE.Mesh(new THREE.BoxGeometry(.112, .023, .052), this.fpCuffMat);
    knuckles.position.set(0, .029, -.043);
    hand.add(knuckles);
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(.042, .077, .065), this.fpHandMat);
    thumb.position.set(.074, -.034, .017);
    thumb.rotation.z = -.30;
    hand.add(thumb);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(.061, .066, .115, 9), this.fpCuffMat);
    cuff.position.set(-.045, -.117, .10);
    cuff.rotation.set(-.58, 0, -.32);
    hand.add(cuff);

    hand.visible = false;
    hand.frustumCulled = false;
    this.fpActionHand = hand;
    this.camera.add(hand);
    this.fpActionProp = new THREE.Group();
    this.fpActionProp.visible = false;
    this.camera.add(this.fpActionProp);
  }

  private clearFirstPersonRig() {
    for (const root of [this.fpActionHand, this.fpSupportArm?.root, this.fpActionProp]) {
      if (!root) continue;
      this.camera.remove(root);
      root.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          // The glove materials belong to the engine and are shared; only
          // per-prop materials may be owned/disposed here.
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) if (m !== this.fpHandMat && m !== this.fpCuffMat) m.dispose();
        }
      });
    }
    this.fpActionHand = null;
    this.fpSupportArm = null;
    this.fpActionProp = null;
    this.fpActionPropId = "";
  }

  private ensureFirstPersonProp(id: string) {
    const root = this.fpActionProp;
    if (!root || this.fpActionPropId === id) return;
    while (root.children.length) {
      const child = root.children[0]; root.remove(child);
      child.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(m => m.dispose());
        }
      });
    }
    this.fpActionPropId = id;
    const materials = new Map<number,THREE.MeshBasicMaterial>();
    const mat = (color:number) => {
      let material = materials.get(color);
      if (!material) { material = new THREE.MeshBasicMaterial({color}); materials.set(color,material); }
      return material;
    };
    const dark = mat(0x313c46), steel = mat(0x8c9ba8), amber = mat(0xf5ad42), cyan = mat(0x55d9ff);
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, at:[number,number,number], rotateX=0) => {
      const m = new THREE.Mesh(geometry, material);
      m.position.set(...at); m.rotation.x=rotateX; root.add(m);
      return m;
    };
    if (id === "mine") {
      add(new THREE.CylinderGeometry(.155,.17,.072,12),dark,[0,0,0]);
      add(new THREE.TorusGeometry(.124,.014,6,18),amber,[0,.043,0],-Math.PI/2);
      add(new THREE.SphereGeometry(.038,7,6),amber,[0,.06,0]);
    } else if (id === "frag") {
      add(new THREE.SphereGeometry(.108,10,8),dark,[0,0,0]);
      add(new THREE.BoxGeometry(.07,.035,.062),steel,[0,.115,0]);
      add(new THREE.TorusGeometry(.035,.009,6,14),amber,[.035,.145,0]);
    } else if (id === "flashbang") {
      add(new THREE.CylinderGeometry(.073,.073,.21,12),steel,[0,0,0]);
      add(new THREE.CylinderGeometry(.081,.081,.02,12),dark,[0,.113,0]);
    } else if (id === "knives") {
      add(new THREE.BoxGeometry(.034,.12,.035),dark,[0,-.07,0]);
      add(new THREE.ConeGeometry(.025,.17,4),steel,[0,.07,0]);
    } else if (id === "poison_dart") {
      add(new THREE.CylinderGeometry(.013,.013,.25,8),steel,[0,0,0]);
      add(new THREE.ConeGeometry(.033,.08,8),new THREE.MeshBasicMaterial({color:0x80ea63}),[0,.15,0]);
    } else if (id === "taser") {
      add(new THREE.BoxGeometry(.14,.09,.16),dark,[0,0,0]);
      for (const x of [-.045,.045]) add(new THREE.CylinderGeometry(.011,.011,.09,8),cyan,[x,.065,-.065]);
    } else if (id === "vent") {
      add(new THREE.BoxGeometry(.095,.09,.16),cyan,[0,0,0]);
    } else if (id === "side_bolt") {
      add(new THREE.CylinderGeometry(.018,.018,.14,10),amber,[0,0,0],Math.PI/2);
      add(new THREE.ConeGeometry(.018,.055,10),steel,[0,0,-.09],-Math.PI/2);
    } else if (id === "bolt") {
      add(new THREE.CylinderGeometry(.013,.013,.31,8),steel,[0,0,0],Math.PI/2);
      add(new THREE.ConeGeometry(.024,.065,7),amber,[0,0,-.18],-Math.PI/2);
    } else if (id === "shell") {
      add(new THREE.CylinderGeometry(.029,.029,.11,10),new THREE.MeshBasicMaterial({color:0xc75d32}),[0,0,0]);
      add(new THREE.CylinderGeometry(.030,.030,.023,10),amber,[0,-.067,0]);
    } else if (id === "cylinder") {
      add(new THREE.CylinderGeometry(.056,.056,.13,9),steel,[0,0,0]);
    } else {
      // Detachable magazine / energy cell in the offhand.
      add(new THREE.BoxGeometry(.095,.24,.105),dark,[0,-.09,0]);
      add(new THREE.BoxGeometry(.105,.027,.115),steel,[0,-.22,0]);
    }
    // These materials are cached only for building this prop. Dispose materials
    // that no mesh used; referenced materials are disposed with the prop meshes.
    const used = new Set<THREE.Material>();
    root.traverse(obj => { if (obj instanceof THREE.Mesh) {
      for (const m of Array.isArray(obj.material) ? obj.material : [obj.material]) used.add(m);
    }});
    for (const m of materials.values()) if (!used.has(m)) m.dispose();
  }

  /** Articulated shoulder/elbow/wrist IK with fixed lengths in normal poses.
   * Geometry is reused every frame; extreme reaches only minimally stretch. */
  private poseFirstPersonArm() {
    const hand = this.fpActionHand;
    const arm = this.fpSupportArm;
    if (!hand || !arm) return;
    arm.root.visible = hand.visible;
    if (!hand.visible) return;

    // Compact guns use a true torso-side anchor rather than the forward
    // rifle shoulder. The IK stays linked to the moving wrist in every pose.
    const visualWeaponId = this.viewmodelWeaponId || this.weaponId;
    const shieldEquipped = visualWeaponId === RIOT_SHIELD_ID;
    const isCompact = usesCompactSupportArm(
      weaponById(visualWeaponId).category,
      shieldEquipped,
      !!this.riotShieldModel?.visible,
    );
    const frame = supportArmFraming(this.camera.aspect, isCompact);
    this.fpShoulder.set(...frame.shoulder);
    arm.shoulder.position.copy(this.fpShoulder);
    // Anchor the forearm inside the glove cuff, following all hand rotations.
    this.fpWrist.set(-.045, -.125, .10).applyQuaternion(hand.quaternion).add(hand.position);
    const joint = supportElbowPosition(
      frame.shoulder,
      [this.fpWrist.x, this.fpWrist.y, this.fpWrist.z],
      frame.pole,
      isCompact ? SUPPORT_SIDEARM_UPPER_LENGTH : SUPPORT_UPPER_ARM_LENGTH,
      isCompact ? SUPPORT_SIDEARM_FOREARM_LENGTH : SUPPORT_FOREARM_LENGTH,
    );
    this.fpElbow.set(...joint);

    const alignSleeve = (mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3) => {
      this.fpArmDirection.copy(to).sub(from);
      const length = Math.max(.001, this.fpArmDirection.length());
      mesh.position.copy(from).addScaledVector(this.fpArmDirection, .5);
      mesh.quaternion.setFromUnitVectors(this.fpArmUp, this.fpArmDirection.multiplyScalar(1 / length));
      mesh.scale.set(1, length, 1); // unit-height cylinder ends meet both joints
    };
    alignSleeve(arm.upper, this.fpShoulder, this.fpElbow);
    alignSleeve(arm.forearm, this.fpElbow, this.fpWrist);
    arm.elbow.position.copy(this.fpElbow);
  }

  private renderFirstPersonAction(now: number, visibleWeapon: boolean, restPosition: THREE.Vector3) {
    const hand = this.fpActionHand, prop = this.fpActionProp;
    if (!hand || !prop) return;
    const visualWeaponId = this.viewmodelWeaponId || this.weaponId;
    const isShield = visualWeaponId === RIOT_SHIELD_ID;
    const restMode = supportHandRestMode(
      weaponById(visualWeaponId).category, isShield, !!this.riotShieldModel?.visible,
    );
    let restRotation: THREE.Quaternion = this._vmTotalQuat;
    if (restMode === "shield" && this.riotShieldModel) {
      // The raised and side-held Bulwark shield have their own camera-space
      // poses. Attach the LEFT glove to its inner grip, never to the pistol.
      const shield = this.riotShieldModel;
      restPosition.set(-.13, -.24, .115).multiply(shield.scale)
        .applyQuaternion(shield.quaternion).add(shield.position);
      restRotation = shield.quaternion;
    }

    let pose: ActionPose | null = null;
    let propId = "";
    let progress = 0;
    if (this.equipmentAction) {
      const a = this.equipmentAction;
      progress = (now - a.startedAt) / a.duration;
      pose = sampleDeployMotion(progress, a.kind);
      propId = a.id;
    } else if (this.reloading) {
      const def = weaponById(this.weaponId);
      const style = reloadMotionFor(this.weaponId, def.category, def.special?.kind);
      progress = (now - this.reloadStartedAt) / Math.max(1, this.reloadDurationMs);
      pose = sampleReloadMotion(progress, style);
      propId = style;
    }

    // The offhand is present every frame for guns and an intact shield.
    // Melee holds stay one-handed, except during an equipment action.
    hand.visible = this.alive && visibleWeapon && (restMode !== "none" || !!pose);
    prop.visible = this.alive && visibleWeapon && !!pose?.propVisible;
    if (!hand.visible) {
      this.poseFirstPersonArm(); // hide the entire sleeve too
      return;
    }
    if (!pose) {
      hand.position.copy(restPosition);
      hand.quaternion.copy(restRotation);
      this.poseFirstPersonArm();
      return;
    }
    this.ensureFirstPersonProp(propId);
    if (this.equipmentAction) {
      hand.position.set(...pose.hand);
      prop.position.set(...pose.prop);
    } else {
      hand.position.set(pose.hand[0] + this.vmOffset.x, pose.hand[1] + this.vmOffset.y, pose.hand[2] + this.vmOffset.z);
      prop.position.set(pose.prop[0] + this.vmOffset.x, pose.prop[1] + this.vmOffset.y, pose.prop[2] + this.vmOffset.z);
    }
    hand.rotation.set(pose.handRoll * .25, 0, pose.handRoll);
    prop.rotation.set(0, 0, pose.handRoll * .6);
    if (restMode !== "none") {
      const blend = supportActionWeight(progress);
      hand.position.lerp(restPosition, 1 - blend);
      hand.quaternion.slerp(restRotation, 1 - blend);
    }
    this.poseFirstPersonArm();
  }

  // ADS fix: when aiming, move viewmodel well below camera centerline and pull closer,
  // so the bulk of the weapon drops out of view and the camera "looks down the barrel".
  // The sight mesh is hidden during ADS so it never blocks the screen.
  // On touch devices, the Fire/ADS buttons cluster in the bottom-right corner, so we
  // shift the hipfire viewmodel toward the bottom-centre/left to stay visible.
  private positionViewmodel() {
    // Handoff at the midpoint, with the old weapon already out of view.
    // Gameplay weaponId/stats/readiness were switched by the caller immediately.
    if (this.swapViewmodelPending &&
        performance.now() - this.swapAnimAt >= WEAPON_SWAP_VISUAL_MS * WEAPON_SWAP_HANDOFF) {
      this.swapViewmodelPending = false;
      this.buildViewmodel(); // positions the new model and returns here once
      return;
    }
    if (this.prestigeTexture) {
      const t = performance.now() * .001;
      this.prestigeTexture.offset.set(t * .045 % 1, t * .015 % 1);
    }
    // Weapon sits on the player's RIGHT side (positive X in camera-local space),
    // like every classic FPS viewmodel. Desktop uses a stronger rightward offset;
    // mobile uses a smaller rightward offset so it doesn't sit under the
    // bottom-right action buttons.
    const hipTarget = this.touchMode
      ? { x: 0.22, y: -0.20, z: -0.50 }   // mobile: right side, lower, away from buttons
      : { x: 0.30, y: -0.18, z: -0.48 };  // desktop: clearly right-offset (CoD-style)
    // The HUD reticle and ballistic aim stay at the exact camera center.
    // Only the viewmodel moves down: receivers, upper rails, carry handles
    // and exposed optic mounts should not obscure targets during ADS.
    // Magnified scopes use a HUD reticle; 1x sights remain part of the gun.
    const visualWeaponId = this.viewmodelWeaponId || this.weaponId;
    const wDef = weaponById(visualWeaponId);
    const isSniperScoped = wDef.category === "sniper" && this.adsProgress > 0.5;
    const isMagnifiedSight = this.sightDef.type === "acog" || this.sightDef.type === "hunter" ||
      this.sightDef.type === "thermal" || this.sightDef.type === "nvg" || this.sightDef.type === "sniper_scope";
    const receiverHeight = WEAPON_VISUALS[visualWeaponId]?.receiver?.[1] ?? .18;
    const clearance=adsClearance(wDef,this.sightDef.type,receiverHeight);
    const adsTarget = isMagnifiedSight || isSniperScoped
      ? { x: 0, y: Math.min(clearance.bodyY,-.34), z: -.24 }
      : { x: 0, y: clearance.bodyY, z: -.43 };
    // Rigid ADS: the optic has a real mount, not a screen-space sight lift.
    // Sprint pose: weapon lowered + tilted inward (tucked run stance).
    const sprintTarget = { x: 0.32, y: -0.32, z: -0.40 };
    // Melee is a one-handed upright hold on the right, not a rifle held below
    // the camera. This also exposes the hammer/axe head during idle movement.
    const meleePose = this.touchMode ? { x: 0.25, y: -0.11, z: -0.47 } : { x: 0.35, y: -0.085, z: -0.49 };
    let target = wDef.category === "melee" ? meleePose : (this.aiming ? adsTarget : hipTarget);
    if(this.weaponId===RIOT_SHIELD_ID)target=this.shieldRaised()?{x:.4,y:-.6,z:-.35}:hipTarget;
    this.updateRiotModels();
    // Subtle head-bob while moving on the ground (skipped while aiming for stability).
    let bobY = 0;
    if (!this.aiming && this.onGround && this.vel.lengthSq() > 1) {
      bobY = Math.sin(performance.now() * 0.012) * 0.012 * swayMultiplier(this.activePerkId);
    }
    // ---- Sprint sway: weapon sways left/right + bobs while sprinting ----
    let sprintSwayX = 0, sprintSwayY = 0, sprintPitch = 0, sprintRoll = 0;
    if (this.sprinting) {
      target = sprintTarget;
      const sway = Math.sin(this.sprintPhase);
      const sway2 = Math.sin(this.sprintPhase + Math.PI);
      sprintSwayX = sway * 0.05 * swayMultiplier(this.activePerkId);        // 5cm side-to-side
      sprintSwayY = Math.abs(sway2) * 0.04 * swayMultiplier(this.activePerkId);  // vertical bob (always positive — weapon pumps)
      sprintPitch = -0.25;              // muzzle tips down (running stance)
      sprintRoll = sway * 0.10 * swayMultiplier(this.activePerkId);         // weapon cants with the sway
    }
    // ---- Holster outgoing weapon, then draw incoming (cosmetic 450ms) ----
    let swapX = 0, swapY = 0, swapZ = 0, swapPitch = 0, swapRoll = 0;
    let swapActive = false;
    if (this.swapAnimAt) {
      const age = performance.now() - this.swapAnimAt;
      if (age < WEAPON_SWAP_VISUAL_MS) {
        swapActive = true;
        const pose = sampleWeaponSwapMotion(age / WEAPON_SWAP_VISUAL_MS);
        swapX = pose.x; swapY = pose.y; swapZ = pose.z;
        swapPitch = pose.pitch; swapRoll = pose.roll;
      } else {
        this.swapAnimAt = 0;
      }
    }
    // ---- Issue 4: ADS resets during weapon swap ----
    // While the swap animation is active, FORCE aiming off so the player exits
    // ADS before the new weapon is drawn. This prevents the jarring effect of
    // staying scoped while the gun changes underneath. The adsProgress smoothing
    // (below) will rapidly decay to 0 during the swap, and the ADS target
    // position is overridden by the hip position so the gun dips from hip, not
    // from ADS.
    if (swapActive) {
      this.manualAiming = false;
      target = hipTarget;  // dip from the hip position, not ADS
    }
    // Interpolate the camera-local offset. During a swap, use a faster lerp so
    // the weapon snaps down quickly (the dip should feel responsive, not floaty).
    const lerpRate = swapActive ? 0.4 : 0.25;
    this.vmOffset.x += (target.x + sprintSwayX + swapX - this.vmOffset.x) * lerpRate;
    this.vmOffset.y += (target.y + bobY + sprintSwayY + swapY - this.vmOffset.y) * lerpRate;
    this.vmOffset.z += (target.z + swapZ - this.vmOffset.z) * lerpRate;

    // ---- First-person reload and equipment poses (v6) ----
    let reloadDipY=0,reloadPitch=0,reloadRoll=0;
    let hideFixedMagazine=false;
    const now=performance.now();
    if (this.equipmentAction) {
      const a=this.equipmentAction;
      const pose=sampleDeployMotion((now-a.startedAt)/a.duration,a.kind);
      reloadDipY=pose.dip;reloadPitch=pose.pitch;reloadRoll=pose.roll;
    } else if (this.reloading) {
      const def=weaponById(this.weaponId);
      const style=reloadMotionFor(this.weaponId,def.category,def.special?.kind);
      const pose=sampleReloadMotion((now-this.reloadStartedAt)/Math.max(1,this.reloadDurationMs),style);
      reloadDipY=pose.dip;reloadPitch=pose.pitch;reloadRoll=pose.roll;
      hideFixedMagazine=pose.hideFixedMagazine;
    }

    // Weapon-specific strike: stabbing, vertical chopping, horizontal axe,
    // or overhead hammer. The same pose and timer are used by F quick melee.
    let meleeSwingPitch=0,meleeSwingRoll=0,meleeSwingYaw=0;
    let meleeSwingX=0,meleeSwingY=0,meleeSwingZ=0;
    if(this.meleeSwingAt){
      const age=performance.now()-this.meleeSwingAt;
      if(age<this.meleeSwingDur){
        const pose=meleeSwingPose(this.weaponId,age/this.meleeSwingDur);
        meleeSwingPitch=pose.pitch;meleeSwingRoll=pose.roll;meleeSwingYaw=pose.yaw;
        meleeSwingX=pose.x;meleeSwingY=pose.y;meleeSwingZ=pose.z;
      }else this.meleeSwingAt=0;
    }

    // Apply the offset (+ recoil kick-back + reload dip + sprint sway) to each viewmodel part.
    // Parts are direct children of the camera, so their local position is camera-local.
    const ox = this.vmOffset.x + meleeSwingX;
    const oy = this.vmOffset.y + reloadDipY + meleeSwingY;
    const oz = this.vmOffset.z + this.vmRecoilZ + meleeSwingZ;
    // ---- Rigid pivot rotation ----
    // The weapon should rotate as a single rigid body around the grip (the player's
    // right hand). Previously each part rotated around its OWN local origin, which
    // caused the muzzle to swing away from the barrel during sprint/reload (the
    // muzzle is 0.6 units forward of the grip — rotating around its own center
    // translated it visually off the barrel). Now we rotate each part's POSITION
    // around the grip pivot AND apply the same rotation to the part itself — net
    // effect: the whole weapon rotates together.
    const pivotX = 0, pivotY = -0.11, pivotZ = 0.12;  // grip position (camera-local)
    // ---- Round 20: Melee weapon hold angle ----
    // Melee weapons are held blade-UP with handle-DOWN (like a standard
    // forward-grip knife hold — blade extends upward from the fist).
    // The previous -1.1 (-63°) was too shallow AND rotated the wrong way,
    // causing the handle to point up instead of the blade. A -π/2 (-90°)
    // pitch rotates the forward-pointing blade to point straight UP, with
    // the handle (at z=+0.08, forward of the grip) pointing DOWN into the fist.
    const isMeleeWeapon = wDef.category === "melee";
    const meleeHoldPitch = isMeleeWeapon ? Math.PI / 2.9 : 0;  // positive X pitch lifts -Z-pointing blades into view
    const totalRotX = reloadPitch + this.vmRecoilPitch + sprintPitch + meleeSwingPitch + swapPitch + meleeHoldPitch;
    const totalRotZ = reloadRoll + sprintRoll + meleeSwingRoll + swapRoll;
    // Compute ONE quaternion for the complete weapon. The same quaternion must
    // rotate both each part's centre (around the grip) AND its orientation.
    // Euler XYZ composes X*Z; the old hand-written coordinates composed Z*X,
    // so parts diverged whenever reload pitch and roll were both non-zero.
    this._vmTotalQuat.setFromEuler(this._vmTotalEuler.set(totalRotX, meleeSwingYaw, totalRotZ, "XYZ"));
    // ---- Issue d fix: Sights get in the way ----
    // The sight meshes (scope tube, iron sight ring/post, red dot window) are
    // SOLID 3D objects. If visible during ADS, they block the camera's center
    // and prevent the player from seeing the target. The fix:
    // 1. Hide the sight mesh EARLY in the ADS transition (adsProgress > 0.15)
    //    for ALL sight types — the HUD reticle/scope overlay takes over for
    //    aiming (always at exact screen center). Previously the threshold was
    //    0.4, which let the sight mesh cross the camera centerline during the
    //    transition and temporarily block the view.
    // 2. For scoped weapons (magnified + sniper) at full ADS (adsProgress > 0.5),
    //    hide the ENTIRE viewmodel so nothing blocks the scope view. The HUD
    //    scope overlay (vignette + reticle) handles the entire visual. This
    //    replaces the old behavior where the sniper scope tube stayed visible
    //    but was positioned below the camera (appearing as a solid object at
    //    the bottom of the screen instead of something to look through).
    const hideSightDuringADS = !clearance.sightVisible && this.adsProgress > 0.15;
    const hideEntireViewmodel = !this.reloading && !this.equipmentAction && (isSniperScoped || (isMagnifiedSight && this.adsProgress > 0.5));
    const quickMeleeActive = this.updateQuickMeleeModel(now);
    for (const p of this.vmParts) {
      if(p.obj.name==="weapon_charm")swingWeaponCharm(p.obj,now);
      if (quickMeleeActive || hideEntireViewmodel) {
        // Scoped ADS: hide everything. The HUD scope overlay handles the visual.
        p.obj.visible = false;
        continue;
      }
      p.obj.visible = !hideFixedMagazine || !p.obj.userData.fpMagazine;
      // Start at this part's immutable rest position every frame (never add to
      // last frame's animated position). Rotate about the common weapon grip,
      // then add the shared ADS/recoil/reload translation.
      p.obj.position.copy(p.base).multiplyScalar(this.vmScale);
      p.obj.position.x -= pivotX;
      p.obj.position.y -= pivotY;
      p.obj.position.z -= pivotZ;
      p.obj.position.applyQuaternion(this._vmTotalQuat);
      p.obj.position.x += pivotX + ox;
      p.obj.position.y += pivotY + oy;
      p.obj.position.z += pivotZ + oz;
      // Compose the part's resting orientation with EXACTLY the same rotation
      // used for its position. This preserves barrel, optic, and grip alignment.
      p.obj.quaternion.copy(this._vmTotalQuat).multiply(p.baseQuat);
      p.obj.scale.copy(p.baseScale).multiplyScalar(this.vmScale);
    }
    // Open iron and reflex frames remain physically visible in ADS.
    // Only magnified HUD optics are hidden to prevent the solid tube blocking view.
    if (this.sightMesh) {
      this.sightMesh.visible = !quickMeleeActive && !hideEntireViewmodel && !hideSightDuringADS;
    }
    // Solve the offhand's grip with the EXACT rigid-body transform that moved
    // each weapon part (including recoil, sprint, swapping, reload and ADS).
    // Unlike a screen-space approximation, its palm cannot drift off the gun.
    this.fpRestHand.copy(this.fpSupportGrip).multiplyScalar(this.vmScale);
    this.fpRestHand.x -= pivotX;
    this.fpRestHand.y -= pivotY;
    this.fpRestHand.z -= pivotZ;
    this.fpRestHand.applyQuaternion(this._vmTotalQuat);
    this.fpRestHand.x += pivotX + ox;
    this.fpRestHand.y += pivotY + oy;
    this.fpRestHand.z += pivotZ + oz;
    this.renderFirstPersonAction(now, !hideEntireViewmodel && !quickMeleeActive, this.fpRestHand);
  }

  // ---- Laser indicator ----
  // The laser belongs to the CURRENT weapon, never to the player globally.
  private rebuildLaserIndicator() {
    if (this.laserBeam) {
      this.scene.remove(this.laserBeam);
      this.laserBeam.geometry.dispose();
      (this.laserBeam.material as THREE.Material).dispose();
      this.laserBeam = null;
    }
    if (this.laserDot) {
      this.scene.remove(this.laserDot);
      this.laserDot.geometry.dispose();
      (this.laserDot.material as THREE.Material).dispose();
      this.laserDot = null;
    }
    this.buildLaserIndicator();
  }

  // Builds a thin red line + dot mesh that shows where the player is aiming.
  // Visible only when a laser sight is equipped (sight slot OR grip slot laser).
  private buildLaserIndicator() {
    const hasLaser = this.sightDef.type === "laser" || this.getCurrentAttachments().grip === "grip_laser";
    if (!hasLaser) return;
    // The beam: a thin line from the muzzle to the aim point. Updated each frame.
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]);
    const mat = new THREE.LineBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.55 });
    this.laserBeam = new THREE.Line(geo, mat);
    this.laserBeam.frustumCulled = false;
    this.scene.add(this.laserBeam);
    // The dot at the impact point: a small bright sphere.
    this.laserDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.85 })
    );
    this.laserDot.frustumCulled = false;
    this.scene.add(this.laserDot);
  }

  // Each frame, recompute the laser's start (muzzle) and end (impact point) from
  // the camera's world position + aim direction.
  private updateLaserIndicator() {
    if (!this.laserBeam || !this.laserDot) return;
    if (!this.alive) {
      this.laserBeam.visible = false;
      this.laserDot.visible = false;
      return;
    }
    this.laserBeam.visible = true;
    this.laserDot.visible = true;
    // Raycast from the *crosshair* to determine the exact aim point. The
    // visible beam starts at the weapon's muzzle (in camera-local coordinates),
    // not at the camera eye: eye-origin lines collapse into screen-space streaks.
    // The visible reticle aims from the rendered (stair-smoothed) camera eye.
    const origin = this.camera.position.clone();
    this.camera.updateMatrixWorld();
    const muzzle = new THREE.Vector3(
      this.vmOffset.x+0.025, this.vmOffset.y-0.018,
      this.vmOffset.z-0.48,
    ).applyMatrix4(this.camera.matrixWorld);
    // Aim direction: same as aimDir but with zero spread (laser shows where you'd actually hit)
    const cp = Math.cos(this.pitch);
    const dir: Vec3 = [Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch)];
    // Find impact distance: nearest cover box or weapon range, whichever is closer
    let maxT = this.eff.range;
    for (const cov of this.map.cover) {
      const t = rayBox([origin.x, origin.y, origin.z], dir, cov.pos, cov.size);
      if (t !== null && t < maxT) maxT = t;
    }
    // Also stop at the first combatant (so the laser dot lands on enemies you're aiming at)
    for (const c of this.combatants.values()) {
      if (!c.alive || c.id === this.selfId) continue;
      if (this.opts.mode !== "ffa" && this.opts.mode !== "gungame" && c.team === this.opts.team) continue;
      const hit = rayCombatantHit([origin.x, origin.y, origin.z], dir, c.pos);
      if (hit && hit.t < maxT) maxT = hit.t;
    }
    const endX = origin.x + dir[0] * maxT;
    const endY = origin.y + dir[1] * maxT;
    const endZ = origin.z + dir[2] * maxT;
    // Update beam geometry
    const posAttr = this.laserBeam.geometry.getAttribute("position") as THREE.BufferAttribute;
    posAttr.setXYZ(0, muzzle.x, muzzle.y, muzzle.z);
    posAttr.setXYZ(1, endX, endY, endZ);
    posAttr.needsUpdate = true;
    this.laserBeam.geometry.computeBoundingSphere();
    // Place the dot at the impact point
    this.laserDot.position.set(endX, endY, endZ);
    // Pulse the dot opacity slightly for visibility
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.012);
    (this.laserDot.material as THREE.MeshBasicMaterial).opacity = pulse;
  }

  /** Independent first-person quick-melee prop. Does not change the weapon slot,
   * active ammunition, attachment state, or multiplayer weapon identity. */
  private createQuickMeleeModel() {
    // Exactly the same weapon-specific meshes as slot 3; F only overlays
    // this independent model during the attack, without swapping loadouts.
    const group=new THREE.Group();
    const skin=weaponSkinById(this.opts.loadout.meleeWeaponSkinId??"default");
    const metal=new THREE.MeshStandardMaterial({
      color:this.orbitalWeaponActive?0xb578ff:(skin.id==="default"?0xb5c6d2:skin.color),
      emissive:skin.emissive??0x000000,
      emissiveIntensity:skin.emissive?.25:0,metalness:.76,roughness:.32,
    });
    const grip=new THREE.MeshStandardMaterial({color:0x323f47,metalness:.3,roughness:.78});
    buildMeleeWeaponParts(this.meleeWeaponId,metal,grip,(part,x,y,z)=>{
      part.position.set(x,y,z);group.add(part);
    });
    group.visible=false;
    this.camera.add(group);
    this.quickMeleeModel=group;
  }
  private updateQuickMeleeModel(now: number): boolean {
    if (!this.quickMeleeModel) return false;
    const progress = (now - this.quickMeleeFeedbackAt) / this.meleeSwingDur;
    const active = this.quickMeleeFeedbackAt > 0 && progress >= 0 && progress < 1;
    const bash=this.weaponId===RIOT_SHIELD_ID && this.riotShieldHp>0;
    this.quickMeleeModel.visible = active && this.alive && !bash;
    if (active) {
      const pose=meleeSwingPose(this.meleeWeaponId,progress);
      this.quickMeleeModel.position.set(.37+pose.x,-.3+pose.y,-.56+pose.z);
      this.quickMeleeModel.rotation.set(.95+pose.pitch,pose.yaw,-.55+pose.roll);
    }
    return active && !bash;
  }

  // ---- Input ----
  private setupInput() {
    // Detect touch devices — they use on-screen controls instead of pointer lock.
    this.touchMode = typeof window !== "undefined" &&
      ("ontouchstart" in window || (navigator as any).maxTouchPoints > 0 ||
        (window.matchMedia && window.matchMedia("(pointer: coarse)").matches));

    const canvas = this.renderer.domElement;
    canvas.tabIndex = 0;
    canvas.style.outline = "none";
    canvas.addEventListener("click", () => {
      // Resume the audio context on first user gesture (browsers block audio
      // until a gesture). Safe to call repeatedly — no-op if already running.
      this.unlockAudio();
      if (this.touchMode || this.inputSuspended) return; // touch devices and menus do not use pointer lock
      if (!this.pointerLocked) canvas.requestPointerLock();
    });
    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });
    document.addEventListener("mousemove", (e) => {
      if (!this.pointerLocked) return;
      const baseSens = this.aiming ? 0.0014 : 0.0022;
      // High-zoom sights get a sensitivity reduction so the scope feels steady.
      const sightMul = this.aiming ? this.sightDef.adsSensMul : 1.0;
      // Sprinting slightly reduces look sensitivity for steadier tracking.
      const sprintMul = this.sprinting ? 0.85 : 1.0;
      const sens = baseSens * this.sensitivityMul * sightMul * sprintMul;
      this.yaw -= e.movementX * sens;
      this.pitch -= e.movementY * sens * (this.invertY ? -1 : 1);
      this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch));
    });
    document.addEventListener("mousedown", (e) => {
      if (this.touchMode || this.inputSuspended) return;
      this.unlockAudio();
      if (e.button === 0) { this.mouseDown = true; this.mousePressedThisFrame = true; }
      if (e.button === 2) this.manualAiming = true;
    });
    document.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.manualAiming = false;
    });
    document.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("keydown", (e) => {
      if (this.inputSuspended) return;
      // Record the edge in the browser event itself. Even a fast tap that starts
      // and ends between render frames must be eligible for jump buffering.
      if (e.code === "Space" && !e.repeat && !this.keys[e.code]) {
        this.lastJumpPressedAt = performance.now();
      }
      this.keys[e.code] = true;
      if (e.code === "KeyR") this.startReload();
      if (e.code === "KeyF" && !e.repeat && (this.pointerLocked || this.touchMode)) {
        e.preventDefault();
        this.unlockAudio();
        this.quickMelee();
      }
      if (e.code === "Space") e.preventDefault();
      // Weapon swap keys: 1=primary, 2=secondary, 3=melee, Q=quick-swap to last.
      if (e.code === "Digit1") this.swapWeapon("primary");
      if (e.code === "Digit2") this.swapWeapon("secondary");
      if (e.code === "Digit3") this.swapWeapon("melee");
      if (e.code === "Digit4") this.swapWeapon("wonder");
      if (e.code === "KeyQ" && !e.repeat) {
        e.preventDefault();
        // Q swaps between the last two distinct equipped weapons. With no
        // history yet, use primary <-> secondary (not the current slot).
        const target = quickSwapTarget(this.currentSlot, this.lastSlot);
        this.swapWeapon(target);
      }
    });
    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });
    window.addEventListener("resize", this.onResize);
  }

  /** Apply settings without reconstructing the game/audio contexts.
   * WeaponAudio has its own Web Audio output, so scale FX by master there too.
   */
  setAudioMix(mix: { masterVolume: number; footstepVolume: number; fxVolume: number }) {
    const levels = audioGainLevels(mix);
    this.sound.setMasterVolume(levels.master);
    this.sound.setFootstepVolume(levels.footsteps);
    this.sound.setFxVolume(levels.fx);
    this.weaponAudio.setVolume(levels.weaponOutputPercent);
  }

  /** Queue a saved preset for the next life. The server validates account inventory
   * before acknowledging authoritative loadout changes in online matches. */
  queueLoadout(next: LoadoutWire) {
    if (this.opts.mode === "gungame" || this.disposed) return;
    if (this.opts.online) {
      if (this.socket?.connected) this.socket.emit("message", { t: "queueLoadout", loadout: next });
    } else this.pendingLoadout = next;
  }

  /** Apply queued kit only at spawn, never refill/change mid-life. */
  private equipQueuedLoadout() {
    const next = this.pendingLoadout;
    if (!next) return;
    this.pendingLoadout = null;
    this.opts.loadout = next;
    this.primaryWeaponId = next.weaponId;
    this.secondaryWeaponId = next.secondaryWeaponId ?? "pistol_side";
    this.meleeWeaponId = next.meleeWeaponId ?? "knife_tactical";
    this.wonderWeaponId=next.perkId==="wonder_weapon" && !!WEAPONS.find(w=>w.id===next.wonderWeaponId && w.wonder&&!w.disabled) ? next.wonderWeaponId! : "";
    const empty = { sight: null, barrel: null, grip: null, magazine: null };
    this.primaryEff = computeEffectiveStats(weaponById(this.primaryWeaponId), next.attachments);
    this.secondaryEff = computeEffectiveStats(weaponById(this.secondaryWeaponId), next.secondaryAttachments ?? empty);
    this.meleeEff = computeEffectiveStats(weaponById(this.meleeWeaponId), empty);
    this.wonderEff=computeEffectiveStats(weaponById(this.wonderWeaponId||"rifle_ar"),empty);
    this.primarySight = sightDefForType(this.primaryEff.sightType);
    this.secondarySight = sightDefForType(this.secondaryEff.sightType);
    this.meleeSight = sightDefForType(this.meleeEff.sightType);
    this.wonderSight = sightDefForType(this.wonderEff.sightType);
    this.currentSlot = "primary"; this.lastSlot = "secondary";
    this.weaponId = this.primaryWeaponId;
    this.eff = this.primaryEff; this.sightDef = this.primarySight;
    // Every loadout change starts its selected Wonder completely drained.
    this.wonderStates.clear();
    const selected=WEAPONS.find(w=>w.id===this.wonderWeaponId);
    if(selected?.wonder && usesWonderCharges(selected))
      this.wonderStates.set(selected.id,drainedWonderCharges(selected.wonder,performance.now()));
    if(this.wonderWeaponId===RIOT_SHIELD_ID){
      this.riotShieldHp=0;this.riotShieldReadyAt=performance.now()+weaponById(RIOT_SHIELD_ID).wonder!.rechargeMs;
    }
    this.primaryAmmoInMag = this.primaryEff.magSize;
    this.secondaryAmmoInMag = this.secondaryEff.magSize;
    this.throwingKnifeState=fullThrowingKnives();
    this.meleeAmmoInMag = isThrowingKnife(this.meleeWeaponId)?this.throwingKnifeState.charges:this.meleeEff.magSize;
    this.wonderAmmoInMag = this.wonderEff.magSize;
    this.ammoInMag = this.primaryAmmoInMag;
    this.aiming = false; this.adsProgress = 0; this.manualAiming = false;
    this.reloading = false; this.equipmentAction = null;
    this.buildViewmodel();
    if (this.quickMeleeModel) {
      this.camera.remove(this.quickMeleeModel);
      this.quickMeleeModel.traverse(child => { if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const material = child.material;
        if (Array.isArray(material)) material.forEach(m => m.dispose()); else material.dispose();
      }});
      this.quickMeleeModel = null;
    }
    this.createQuickMeleeModel();
  }

  /** In-game menu: suppress controls, even on touch devices, without resetting a match. */
  setInputSuspended(suspended: boolean) {
    this.inputSuspended = suspended;
    this.keys = {};
    this.mouseDown = false;
    this.mousePressedThisFrame = false;
    this.manualAiming = false;
    this.touchMoveX = 0;
    this.touchMoveY = 0;
    this.touchFiring = false;
    this.touchAiming = false;
    this.touchPressedThisFrame = false;
    this.touchJumpQueued = false;
    if (suspended && document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
  }

  resumePointerLock() {
    if (!this.touchMode && !this.inputSuspended) void this.renderer.domElement.requestPointerLock();
  }

  /** Apply preferences live. Health-bar visibility is local-only, never sent to the server. */
  applyDisplayAndControlSettings(settings: { showHealthBars: boolean; sensitivity: number; fov: number; autoAdsOnFire: boolean; invertY: boolean }) {
    this.showHealthBars = settings.showHealthBars;
    this.sensitivityMul = settings.sensitivity;
    this.baseFov = settings.fov;
    this.autoAdsOnFire = settings.autoAdsOnFire;
    this.invertY = settings.invertY;
    for (const c of this.combatants.values()) {
      if (c.healthBar) c.healthBar.visible = this.showHealthBars && c.alive;
      if (c.healthBarBg) c.healthBarBg.visible = this.showHealthBars && c.alive;
    }
  }

  // Unlock both audio systems from the same user gesture (autoplay-safe).
  unlockAudio() {
    this.sound.resume();
    this.weaponAudio.unlock();
  }

  // ---- Public touch-input API (mobile) ----
  // Called by the TouchControls overlay. Lets mobile players move, look, fire,
  // aim, reload and jump without a pointer lock or keyboard.
  setTouchMove(x: number, y: number) {
    // x,y in [-1, 1] — joystick vector (y: -1 = forward)
    this.touchMoveX = Math.max(-1, Math.min(1, x));
    this.touchMoveY = Math.max(-1, Math.min(1, y));
  }
  applyTouchLook(dx: number, dy: number) {
    const baseSens = this.aiming ? 0.004 : 0.006;
    const sightMul = this.aiming ? this.sightDef.adsSensMul : 1.0;
    const sens = baseSens * this.sensitivityMul * sightMul;
    this.yaw -= dx * sens;
    this.pitch -= dy * sens * (this.invertY ? -1 : 1);
    this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch));
  }
  setTouchFire(b: boolean) {
    if (b && !this.touchFiring) { this.unlockAudio(); this.touchPressedThisFrame = true; }
    this.touchFiring = b;
  }
  setTouchADS(b: boolean) { this.manualAiming = b; }
  setTouchSprint(b: boolean) { this.touchSprint = b; }
  touchReload() { this.startReload(); }
  touchQuickMelee() { this.unlockAudio(); this.quickMelee(); }
  setTouchEquipmentAim(held: boolean) {
    if (this.touchEquipmentAiming && !held) this.useEquipment();
    this.touchEquipmentAiming=held;
  }
  touchJump() { this.touchJumpQueued = true; }
  // Touch weapon swap (called by on-screen slot buttons 1/2/3).
  touchSwap(slot: WeaponSlot) { this.swapWeapon(slot); }
  isTouchMode() { return this.touchMode; }

  // One-button quick melee; never changes the equipped slot or reloads a weapon.
  private quickMelee() {
    if (!this.alive || this.matchEnded || this.lobbyActive || this.preMatchCountdown > 0) return;
    if (this.opts.mode === "gungame") {
      // Gun Game forbids loadout quick-melee on firearm tiers, but F must still
      // swing the ACTUAL equipped progression weapon on melee tiers. Route it
      // through the normal melee shot path: same viewmodel animation, cooldown,
      // reach, damage and server-authoritative kill/finishing-tier validation as
      // left click. Do not create the unrelated loadout quick-melee prop.
      const meleeId = gunGameMeleeShortcutWeapon(
        this.gungameIndex, this.gungameWeapons, this.weaponId,
      );
      if (meleeId) this.fireOneShot(weaponById(meleeId));
      return;
    }
    const now = performance.now();
    const shieldBash=this.weaponId===RIOT_SHIELD_ID && this.riotShieldHp>0;
    if(isThrowingKnife(this.meleeWeaponId)&&!shieldBash){
      this.throwThrowingKnife(weaponById(this.meleeWeaponId),now,true);
      return;
    }
    const melee=shieldBash?riotBashProfile():quickMeleeProfile(weaponById(this.meleeWeaponId).stats,this.meleeWeaponId);
    if (now - this.quickMeleeLastAt < melee.cooldownMs ||
        (this.weaponId===this.meleeWeaponId && now-this.lastShotAt < melee.cooldownMs)) return;
    this.quickMeleeLastAt = now;
    if(this.weaponId===this.meleeWeaponId)this.lastShotAt=now;
    this.selfSpawnProtectedUntil = 0;
    this.quickMeleeFeedbackAt = now;
    this.meleeSwingAt = 0; // quick-melee viewmodel has its own animation
    this.meleeSwingDur = melee.swingMs;
    this.manualAiming = false;
    this.weaponAudio.play("melee", { weaponId: shieldBash?RIOT_SHIELD_ID:this.meleeWeaponId, volume: 0.9 });
    if (this.opts.online) {
      this.socket?.emit("message", { t: "quickMelee" });
      return;
    }
    const from: Vec3 = [this.pos.x, this.pos.y, this.pos.z];
    const candidate = chooseQuickMeleeTarget(from, this.yaw,
      [...this.combatants.values()].map(c => ({ id: c.id, pos: c.pos, alive: c.alive,
        protected: (c.spawnProtectedUntil ?? 0) > Date.now(),
        friendly: this.opts.mode !== "ffa" && c.team === this.opts.team })),
      (c, dist) => {
        const eye: Vec3 = [from[0], from[1] + 1.1, from[2]];
        const to: Vec3 = [c.pos[0], c.pos[1] + 1.1, c.pos[2]];
        const d: Vec3 = [(to[0]-eye[0])/dist, (to[1]-eye[1])/dist, (to[2]-eye[2])/dist];
        return !this.map.cover.some(box => { const t = rayBox(eye, d, box.pos, box.size); return t !== null && t > 0.08 && t < dist - 0.2; });
      }, melee.reach, melee.halfArcDegrees);
    if(!this.opts.online&&this.meleeWeaponId===ORBITAL_REAPER_ID)
      this.offlineOrbitalPulse(from,this.opts.team as string,null,candidate?[candidate.id]:[]);
    if(candidate){
      const target=this.combatants.get(candidate.id);
      if(target){
        this.applyDamageLocal(target,melee.damage,false,shieldBash?RIOT_SHIELD_ID:this.meleeWeaponId);
        if(shieldBash && target.alive){
          const dx=target.pos[0]-this.pos.x,dz=target.pos[2]-this.pos.z;
          const distance=Math.hypot(dx,dz)||1;
          const pushed:Vec3=[target.pos[0]+dx/distance*RIOT_BASH_KNOCKBACK,
            target.pos[1],target.pos[2]+dz/distance*RIOT_BASH_KNOCKBACK];
          if(!blocksBotMotion(this.map.cover,target.pos,pushed,target.pos[1]))target.pos=pushed;
        }
        if(this.meleeWeaponId==="baton"&&target.ai&&target.ai.reloadingUntil>now){
          target.ai.reloadingUntil=now+1100;
          target.ai.nextShotAt=Math.max(target.ai.nextShotAt,now+1100);
        }
        this.hitMarkerAt=now;
        this.sound.play("melee_hit",{volume:.7});
      }
    }
  }

  // Fourth equipment slot. Offline damage is simulated locally; online usage
  // only sends an intent. The server validates the player's selection, charges,
  // cooldown, victim teams and spawn protection before applying damage.
  private useEquipment(): void {
    // Equipment actions were retired in v9; keep the input hook a no-op
    // without unreachable legacy statements in the compiled bundle.
  }

  private updateEquipmentAction(now: number) {
    const action=this.equipmentAction;
    if (!action) return;
    if (!this.alive || this.matchEnded || this.lobbyActive) {
      this.equipmentAction=null; return;
    }
    const pose=sampleDeployMotion((now-action.startedAt)/action.duration, action.kind);
    if (pose.released && !action.committed) {
      action.committed=true;
      this.commitEquipmentUse(action.id);
    }
    if (now >= action.startedAt + action.duration) this.equipmentAction=null;
  }

  private equipmentTrajectory(id: string): ThrowPath {
    const cp=Math.cos(this.pitch);
    const dir: Vec3=[Math.sin(this.yaw)*cp,Math.sin(this.pitch),Math.cos(this.yaw)*cp];
    const origin: Vec3=[this.pos.x,this.pos.y+EYE_HEIGHT*.86,this.pos.z];
    return calculateThrowPath(origin,dir,id as "frag"|"flashbang"|"knives"|"poison_dart"|"taser"|"mine",(at,v,d)=>
      closestCoverHit(this.map.cover,at,v,d,rayBox)?.distance ?? null, this.pos.y+.12);
  }

  /** Grenades are aimed with the normal crosshair. No occluding dotted arc. */
  private updateEquipmentPreview(): void {
    if (this.equipmentPreviewLine) this.equipmentPreviewLine.visible = false;
  }

  private commitEquipmentUse(id: string): void {
    const def=equipmentById(id), now=performance.now();
    this.equipmentCharges=Math.max(0,this.equipmentCharges-1);
    this.equipmentLastAt=now;
    if(this.opts.online){
      this.socket?.emit("message",{t:"useEquipment"});
      return;
    }
    const path=this.equipmentTrajectory(id);
    if(def.type==="mine"){
      this.offlineMines.push({pos:path.impact,expiresAt:now+45000,mesh:this.makeMineMarker(path.impact)});
      return;
    }
    this.animateEquipmentPath(path.points,id,path.flightMs,()=>{
      if(this.disposed || this.matchEnded)return;
      const impact=path.impact;
      const targets=[...this.combatants.values()].filter(c=>c.alive && c.id!==this.selfId &&
        (this.opts.mode==="ffa" || c.team!==this.opts.team) &&
        !(c.spawnProtectedUntil && c.spawnProtectedUntil>Date.now()));
      if(def.type==="knife" || def.type==="poison" || def.type==="taser"){
        let first:{c:Combatant;index:number}|null=null;
        for(const c of targets){
          const center=[c.pos[0],c.pos[1]+1,c.pos[2]];
          for(let i=1;i<path.points.length;i++){
            const a=path.points[i-1],b=path.points[i],v=b.map((n,j)=>n-a[j]);
            const sq=v.reduce((sum,n)=>sum+n*n,0)||1;
            const t=Math.max(0,Math.min(1,v.reduce((sum,n,j)=>sum+n*(center[j]-a[j]),0)/sq));
            const d=Math.hypot(...center.map((n,j)=>n-a[j]-v[j]*t));
            if(d<.82 && (!first || i+t<first.index)) first={c,index:i+t};
          }
        }
        if(first){const hit:Combatant=first.c;
          this.applyDamageLocal(hit,def.damage,false,`equipment_${id}`);
          if(def.type==="poison" && hit.alive)this.poisonByVictim.set(hit.id,{expiresAt:performance.now()+4500,tickAt:performance.now()+500,weaponId:`equipment_${id}`});
          if(def.type==="taser" && hit.ai){hit.ai.nextDecisionAt=performance.now()+1700;hit.ai.targetId=null;}
        }
      } else {
        if(def.type==="flash"){
          const selfDist=Math.hypot(this.pos.x-impact[0],this.pos.z-impact[2]);
          if(selfDist<def.radius){const eye: Vec3=[this.pos.x,this.pos.y+EYE_HEIGHT,this.pos.z];
            const delta: Vec3=[eye[0]-impact[0],eye[1]-impact[1],eye[2]-impact[2]];
            const len=Math.hypot(...delta)||1;
            if(!closestCoverHit(this.map.cover,impact,[delta[0]/len,delta[1]/len,delta[2]/len],len,rayBox))
              this.equipmentFlashUntil=performance.now()+Math.round(1100+1800*(1-selfDist/def.radius));
          }
        }
        for(const c of targets){
          const dist=Math.hypot(c.pos[0]-impact[0],c.pos[2]-impact[2]);
          if(dist>def.radius)continue;
          const delta:Vec3=[c.pos[0]-impact[0],c.pos[1]+1-impact[1],c.pos[2]-impact[2]];
          const len=Math.hypot(...delta)||1;
          if(closestCoverHit(this.map.cover,impact,[delta[0]/len,delta[1]/len,delta[2]/len],len,rayBox))continue;
          if(def.type==="blast")this.applyDamageLocal(c,Math.max(12,def.damage*(1-dist/def.radius)),false,`equipment_${id}`);
          else if(def.type==="flash" && c.ai){c.ai.nextDecisionAt=performance.now()+2500;c.ai.targetId=null;}
        }
        if (def.type === "blast") this.spawnExplosion(new THREE.Vector3(...impact));
        else if (def.type === "flash") this.spawnEquipmentVisual(impact, 0xffffff);
      }
    });
  }

  /** Bullet Spitter is a placed machine, not a projectile. Uses world-space
   * yaw for the 140° arc and pivots its barrel toward elevated enemies.
   */
  private placeBulletSpitter(id: string, ownerId: string, pos: Vec3, yaw: number, expiresAt: number, offline: boolean) {
    if (this.bulletSpitters.has(id) || this.disposed || expiresAt <= Date.now()) return;
    // Physical map entity, built at true world scale (about shoulder-high,
    // with tripod legs, armored weapon head and twin barrels).
    // Never attach this to the camera / player's held weapon.
    const { root, yawPivot, barrelPivot } = buildBulletSpitterModel();
    root.position.set(pos[0], pos[1] + .015, pos[2]);
    root.rotation.y = yaw;
    root.userData.turretId = id;
    root.userData.ownerId = ownerId;
    this.scene.add(root);
    this.bulletSpitters.set(id, {
      ownerId, pos, yaw, expiresAt,
      nextShotAt: Date.now() + 300, lastFiredAt: 0, hp: TURRET_HP,
      mesh: root, yawPivot, barrelPivot, offline,
    });
  }

  private removeBulletSpitter(id: string) {
    const t = this.bulletSpitters.get(id);
    if (!t) return;
    this.scene.remove(t.mesh);
    t.mesh.traverse(o=>{if(o instanceof THREE.Mesh) {
      o.geometry.dispose();for(const mat of Array.isArray(o.material)?o.material:[o.material])mat.dispose();
    }});
    this.bulletSpitters.delete(id);
  }
  private tickBulletSpitters() {
    const now = Date.now();
    for (const [id,t] of this.bulletSpitters) {
      if (now >= t.expiresAt) {this.removeBulletSpitter(id);continue;}
      const sensor = t.mesh.getObjectByName("turretSensor");
      if (sensor) sensor.scale.setScalar(1 + Math.sin(now * .008) * .08);
      if (now - t.lastFiredAt > 550) {
        // Rotate across the permitted firing arc while searching for targets.
        t.yawPivot.rotation.y = Math.sin(now * .0015) * .98;
        t.barrelPivot.rotation.x *= .9;
      }
      if (!t.offline || now < t.nextShotAt || this.matchEnded) continue;
      const target = [...this.combatants.values()].filter(c=>
        c.alive && turretCanAttack(this.opts.mode, this.opts.team, c.team, c.id === t.ownerId) &&
        turretCanTrack(t.pos,t.yaw,c.pos) &&
        this.hasLineOfSight([t.pos[0], t.pos[1]+TURRET_MUZZLE_HEIGHT, t.pos[2]], [c.pos[0], c.pos[1]+1, c.pos[2]])
      ).sort((a,b)=>Math.hypot(a.pos[0]-t.pos[0],a.pos[2]-t.pos[2]) -
        Math.hypot(b.pos[0]-t.pos[0],b.pos[2]-t.pos[2]))[0];
      if (!target) continue;
      t.nextShotAt = now + TURRET_INTERVAL_MS;
      t.lastFiredAt = now;
      const src: Vec3 = [t.pos[0], t.pos[1]+TURRET_MUZZLE_HEIGHT, t.pos[2]];
      const delta: Vec3 = [target.pos[0]-src[0],target.pos[1]+1-src[1],target.pos[2]-src[2]];
      const len=Math.hypot(...delta)||1;
      const targetYaw = Math.atan2(delta[0], delta[2]);
      t.yawPivot.rotation.y = Math.atan2(Math.sin(targetYaw - t.yaw), Math.cos(targetYaw - t.yaw));
      t.barrelPivot.rotation.x=-Math.atan2(delta[1],Math.hypot(delta[0],delta[2]));
      this.spawnTracer(src,[delta[0]/len,delta[1]/len,delta[2]/len],"default");
      if(rayRiotShield(src,[delta[0]/len,delta[1]/len,delta[2]/len],target)!==null){
        const next=hitRiotShield(target.riotShieldHp??RIOT_SHIELD_HP,
          target.riotShieldReadyAt??0,TURRET_DAMAGE,performance.now());
        target.riotShieldHp=next.hp;target.riotShieldReadyAt=next.readyAt;
      }
      else this.applyDamageLocal(target,TURRET_DAMAGE,false,"wonder_turret");
    }
  }

  private placeDeathBomb(id: string, pos: Vec3, explodesAt: number, local: boolean) {
    if (this.deathBombs.has(id) || this.disposed) return;
    const mesh = this.makeMineMarker(pos);
    mesh.scale.setScalar(1.25);
    // Explonando is a bright amber death charge rather than a regular mine.
    const indicator = mesh.children.find(c => c instanceof THREE.Mesh && c.geometry instanceof THREE.SphereGeometry);
    if (indicator instanceof THREE.Mesh && indicator.material instanceof THREE.MeshBasicMaterial) {
      indicator.material.color.set(0xff8b20);
    }
    this.deathBombs.set(id, { pos, explodesAt, mesh, local });
  }

  private removeDeathBomb(id: string) {
    const bomb = this.deathBombs.get(id);
    if (!bomb) return;
    this.scene.remove(bomb.mesh);
    bomb.mesh.traverse(o => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        for (const material of Array.isArray(o.material) ? o.material : [o.material]) material.dispose();
      }
    });
    this.deathBombs.delete(id);
  }

  /** The online server owns all damage; local mode resolves the same fuse/AoE. */
  private tickDeathBombs() {
    const now = Date.now();
    for (const [id, bomb] of this.deathBombs) {
      const remaining = Math.max(0, bomb.explodesAt - now);
      bomb.mesh.rotation.y = (now / 380) % (Math.PI * 2);
      if (!bomb.local) {
        if (now > bomb.explodesAt + 4000) this.removeDeathBomb(id);
        continue;
      }
      if (remaining) continue;
      this.removeDeathBomb(id);
      this.spawnExplosion(new THREE.Vector3(...bomb.pos));
      for (const target of this.combatants.values()) {
        if (!target.alive || !explonandoCanHit(this.opts.mode, target.team, this.opts.team as string, target.id, this.selfId)) continue;
        const distance = Math.hypot(target.pos[0] - bomb.pos[0], target.pos[2] - bomb.pos[2]);
        const damage = explonandoDamage(distance);
        if (!damage || target.spawnProtectedUntil && target.spawnProtectedUntil > now) continue;
        const origin: Vec3 = [bomb.pos[0], bomb.pos[1] + .5, bomb.pos[2]];
        const delta: Vec3 = [target.pos[0] - origin[0], target.pos[1] + 1 - origin[1], target.pos[2] - origin[2]];
        const len = Math.hypot(...delta) || 1;
        if (closestCoverHit(this.map.cover, origin, [delta[0]/len,delta[1]/len,delta[2]/len], len, rayBox)) continue;
        this.applyDamageLocal(target, damage, false, "perk_explonando");
      }
    }
  }

  /** 3D mine: broad enough to read on the floor, flashing armed LED and raised fins. */
  private makeMineMarker(pos: Vec3): THREE.Group {
    const root = new THREE.Group();
    root.position.set(pos[0], pos[1], pos[2]);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.12, 12),
      new THREE.MeshStandardMaterial({color:0x282d30,metalness:0.65,roughness:0.35}));
    root.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 8, 24),
      new THREE.MeshBasicMaterial({color:0xf7a937}));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; root.add(ring);
    for (let i=0;i<4;i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.13,0.09,0.27),
        new THREE.MeshStandardMaterial({color:0x454b52}));
      const a = i*Math.PI/2;
      fin.position.set(Math.sin(a)*0.30,0.05,Math.cos(a)*0.30);
      fin.rotation.y = a; root.add(fin);
    }
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.095,10,8),
      new THREE.MeshBasicMaterial({color:0xff492e, transparent:true, opacity:1}));
    beacon.position.y = 0.18; root.add(beacon);
    // pulse with engine time; no separate timers or render loops needed
    beacon.userData.mineBeacon = true;
    this.scene.add(root);
    return root;
  }

  private removeMineMarker(marker: THREE.Group) {
    this.scene.remove(marker);
    marker.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(m => m.dispose());
      }
    });
  }

  /** Render the *actual* flight path with distinct equipment silhouettes. */
  private animateEquipmentPath(points: Vec3[], id: string, durationMs: number, onImpact?:()=>void): void {
    if(points.length<2){onImpact?.();return;}
    const root=new THREE.Group();
    const dark=new THREE.MeshStandardMaterial({color:0x303945,metalness:.55,roughness:.4});
    const pale=new THREE.MeshStandardMaterial({color:0xe6e7de,metalness:.45});
    const steel=new THREE.MeshStandardMaterial({color:0xb3c0c8,metalness:.6});
    const add=(geo:THREE.BufferGeometry,mat:THREE.Material, y=0)=>{const m=new THREE.Mesh(geo,mat);m.position.y=y;root.add(m);};
    if(id==="knives"){
      add(new THREE.BoxGeometry(.065,.26,.052),dark,-.12);
      add(new THREE.ConeGeometry(.05,.31,4),steel,.16);
    }else if(id==="poison_dart"){
      add(new THREE.CylinderGeometry(.012,.012,.35,8),steel);
      add(new THREE.ConeGeometry(.04,.09,8),new THREE.MeshBasicMaterial({color:0x72ed5a}),.22);
    }else if(id==="flashbang"){
      add(new THREE.CylinderGeometry(.095,.095,.27,12),pale);
      add(new THREE.CylinderGeometry(.1,.1,.025,12),dark,.14);
    }else if(id==="taser"){
      add(new THREE.BoxGeometry(.15,.10,.18),dark);
    }else{
      add(new THREE.SphereGeometry(.13,10,10),dark);
    }
    this.scene.add(root);
    const born=performance.now();
    const tick=()=>{
      if(this.disposed){this.scene.remove(root);return;}
      const t=Math.min(1,(performance.now()-born)/Math.max(1,durationMs));
      const idx=t*(points.length-1),i=Math.min(points.length-2,Math.floor(idx)),f=idx-i;
      const a=points[i],b=points[i+1];
      root.position.set(a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f);
      root.rotation.z=t*8;
      if(t<1)requestAnimationFrame(tick);
      else {
        this.scene.remove(root);
        root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
        [dark,pale,steel].forEach(m=>m.dispose());
        onImpact?.();
      }
    };
    requestAnimationFrame(tick);
  }

  private spawnEquipmentVisual(pos: Vec3, color: number, burst = true) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(burst ? .26 : .13, 10, 8),
      new THREE.MeshBasicMaterial({color,transparent:true,opacity:.85}));
    mesh.position.set(pos[0],pos[1],pos[2]);
    this.scene.add(mesh);
    setTimeout(() => { this.scene.remove(mesh); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }, burst ? 500 : 1300);
  }

  private pulseMineBeacons(now: number): void {
    const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(now * 0.011));
    for (const marker of [...this.offlineMines.map(m => m.mesh), ...this.remoteEquipmentMines.values()]) {
      marker.traverse(obj => {
        if (obj instanceof THREE.Mesh && obj.userData.mineBeacon && obj.material instanceof THREE.MeshBasicMaterial) {
          obj.material.opacity = pulse;
        }
      });
    }
  }

  private tickOfflineMines(now: number): void {
    if (this.opts.online || !this.offlineMines.length || this.matchEnded) return;
    this.offlineMines = this.offlineMines.filter(m => {
      if (now > m.expiresAt) { this.removeMineMarker(m.mesh); return false; }
      const enemy = [...this.combatants.values()].find(c => c.alive && (this.opts.mode === "ffa" || c.team !== this.opts.team) &&
        !(c.spawnProtectedUntil && c.spawnProtectedUntil > Date.now()) &&
        Math.hypot(c.pos[0]-m.pos[0],c.pos[2]-m.pos[2]) < 2.4);
      if (!enemy) return true;
      this.removeMineMarker(m.mesh);
      this.spawnEquipmentVisual(m.pos,0xf59e0b);
      for (const c of this.combatants.values()) {
        if (!c.alive || this.opts.mode !== "ffa" && c.team === this.opts.team) continue;
        const d = Math.hypot(c.pos[0]-m.pos[0],c.pos[2]-m.pos[2]);
        if (d <= 3.3) this.applyDamageLocal(c,Math.max(15,100*(1-d/3.3)),false,"equipment_mine");
      }
      return false;
    });
  }

  /** Cosmetic transition only. Ready/firing timers stay with the caller. */
  private startWeaponSwapVisual(elapsedOffsetMs = 0) {
    this.swapAnimAt = performance.now() - elapsedOffsetMs;
    this.swapViewmodelPending = true;
  }

  // ---- Weapon swap (primary / secondary / melee) ----
  // Switches the active weapon slot. Plays a swap SFX + dip animation, refreshes
  // eff/sightDef/ammo for the new slot, and notifies the server (online) so
  // other players see the weapon change. Gun Game ignores this (weapon is
  // driven by progression).
  swapWeapon(slot: WeaponSlot) {
    if (this.equipmentAction || this.survivalDowned) return;
    if (this.opts.mode === "gungame") return;  // gungame auto-advances; no manual swap
    if (this.currentSlot === slot) return;
    if (slot === "wonder" && !this.wonderWeaponId) return;
    if (!this.alive) return;
    // ---- Round 19o: Save current slot's ammo before swapping ----
    // Previously, swapping reset ammo to full (this.ammoInMag = this.eff.magSize),
    // which effectively "reloaded" the weapon in the other slot for free. Now we
    // save the current ammo to the outgoing slot, and restore the incoming slot's
    // saved ammo (or full if it was never fired).
    if (this.reloading) {
      // Cancel reload — the current slot's ammo stays at whatever it was before
      // the reload started (reload completes = full mag; reload cancelled = partial).
      this.reloading = false;
    }
    // Save current ammo to the outgoing slot.
    this.saveAmmoToSlot(this.currentSlot);
    this.lastSlot = this.currentSlot;
    this.currentSlot = slot;
    if (slot === "primary") {
      this.weaponId = this.primaryWeaponId;
      this.eff = this.primaryEff;
      this.sightDef = this.primarySight;
      this.ammoInMag = this.primaryAmmoInMag;
    } else if (slot === "secondary") {
      this.weaponId = this.secondaryWeaponId;
      this.eff = this.secondaryEff;
      this.sightDef = this.secondarySight;
      this.ammoInMag = this.secondaryAmmoInMag;
    } else if (slot === "melee") {
      this.weaponId = this.meleeWeaponId;
      this.eff = this.meleeEff;
      this.sightDef = this.meleeSight;
      this.ammoInMag = isThrowingKnife(this.meleeWeaponId)?this.throwingKnifeState.charges:this.meleeAmmoInMag;
    } else {
      this.weaponId=this.wonderWeaponId;
      this.eff=this.wonderEff;
      this.sightDef=this.wonderSight;
      this.ammoInMag=usesWonderCharges(weaponById(this.wonderWeaponId))
        ? (this.wonderStates.get(this.wonderWeaponId)?.charges ?? 0)
        : this.wonderAmmoInMag;
    }
    this.reloading = false;
    this.startWeaponSwapVisual(this.activePerkId === "quickdraw" ? 155 : 0);
    this.swapReadyAt = performance.now() + (this.activePerkId === "quickdraw" ? 110 : 290);
    this.sound.play("swap", { volume: 0.6 });
    // The old mesh remains for the holster half; rebuild at the visual handoff.
    // Notify the server (online) so other players see the swap + the server
    // validates shots against the new weapon's stats.
    if (this.opts.online && this.socket?.connected) {
      this.socket.emit("message", { t: "weaponSwap", slot } as any);
    }
  }

  // Public getter for the current slot (used by the HUD).
  getCurrentSlot(): WeaponSlot { return this.currentSlot; }
  hasWonderSlot(): boolean { return !!this.wonderWeaponId && this.opts.mode!=="gungame"; }

  // Round 20a: Public getter for socket connection state (used by GameCanvas lobby UI).
  getSocketConnected(): boolean { return !!this.socket?.connected; }

  // ---- Round 19o: Per-slot ammo save/restore helpers ----
  // Saves the current ammoInMag to the specified slot's tracked ammo.
  private saveAmmoToSlot(slot: WeaponSlot) {
    if (slot === "primary") this.primaryAmmoInMag = this.ammoInMag;
    else if (slot === "secondary") this.secondaryAmmoInMag = this.ammoInMag;
    else if (slot === "melee") this.meleeAmmoInMag = isThrowingKnife(this.meleeWeaponId)?this.throwingKnifeState.charges:this.ammoInMag;
    else if (slot === "wonder" && this.wonderWeaponId === RIOT_SHIELD_ID)
      this.wonderAmmoInMag = this.ammoInMag;
  }

  // ---- Live match stats (for mid-match exit progression saving) ----
  // Returns the current match stats so the caller can POST them to
  // /api/match/complete when the user leaves mid-match (otherwise their
  // kills/XP/credits would be lost). Returns null if the match hasn't
  // started yet or has already been finalized.
  getLiveMatchStats(): MatchEndResult | null {
    if (this.matchEnded) return null;
    if (!this.matchStartedAt) return null;
    const isSurvival = this.opts.mode === "survival";
    const objectiveScore = this.opts.mode === "ctf" ? this.ctfCaptures : this.opts.mode === "killconfirmed" ? this.confirmations + (this.denialScoreEnabled ? this.denials : 0) : this.kills;
    const others = [...this.combatants.values()].filter((c) => c.id !== this.selfId);
    const standings = [...others, {
      id: this.selfId, name: this.opts.playerName, team: this.opts.team as string,
      kills: this.kills, deaths: this.deaths, score: isSurvival ? this.survivalWave : objectiveScore, isBot: false,
    }].map((c) => ({ id: c.id, name: c.name, team: c.team, kills: c.kills, deaths: c.deaths,
      assists:c.id===this.selfId?this.assists:0,
      score:(c.score ?? c.kills)+(c.id===this.selfId && this.opts.mode!=="ctf" && this.opts.mode!=="killconfirmed"?this.assists:0), isBot: c.isBot }))
      .sort((a, b) => b.score - a.score || b.kills - a.kills);
    const placement = standings.findIndex((s) => s.id === this.selfId) + 1;
    const durationSec = Math.max(0, Math.round((performance.now() - this.matchStartedAt) / 1000));
    // Treat a mid-match leave as a loss (the player didn't win by leaving).
    const won = false;
    return {
      kills: this.kills, deaths: this.deaths, headshots: this.headshots, assists:this.assists, won,
      score: isSurvival ? this.survivalWave : objectiveScore, mode: this.opts.mode, standings,
      durationSec, completed: false, placement: placement || 1, multikills: this.multikillsCount, bestStreak: this.bestStreak, maxNoDeathStreak: this.maxNoDeathStreak, defenseKills: this.defenseKills, flagReturns: this.flagReturns, maxScoreDeficit: this.maxScoreDeficit, participants: standings.length, weaponId: this.weaponId,
      killDifficulties: this.killDifficulties.slice(),
      perWeaponKills: Object.fromEntries(this.perWeaponKills),
      perWeaponActions: Object.fromEntries(this.perWeaponActions),
      confirmations: this.confirmations, denials: this.denials,
      ...(isSurvival ? { survivalWaves: this.getSurvivalClearedWaves(), survivalTier: this.survivalTier } as any : {}),
    };
  }

  // Return the attachment map for the currently active slot. Used by
  // buildViewmodel and the laser-sight check so the viewmodel reflects the
  // attachments on the weapon the player is actually holding (not just the
  // primary). Gun Game always uses the primary's attachments (progression
  // weapons ignore sidearm attachments).
  private getCurrentAttachments(): Record<AttachmentSlot, string | null> {
    if (this.opts.mode === "gungame" || this.currentSlot==="wonder") return { sight: null, barrel: null, grip: null, magazine: null };
    if (this.currentSlot === "secondary" && this.opts.loadout.secondaryAttachments) {
      return {
        sight: this.opts.loadout.secondaryAttachments.sight ?? null,
        barrel: this.opts.loadout.secondaryAttachments.barrel ?? null,
        grip: this.opts.loadout.secondaryAttachments.grip ?? null,
        magazine: this.opts.loadout.secondaryAttachments.magazine ?? null,
      };
    }
    if (this.currentSlot === "melee" && this.opts.loadout.meleeAttachments) {
      return {
        sight: this.opts.loadout.meleeAttachments.sight ?? null,
        barrel: this.opts.loadout.meleeAttachments.barrel ?? null,
        grip: this.opts.loadout.meleeAttachments.grip ?? null,
        magazine: this.opts.loadout.meleeAttachments.magazine ?? null,
      };
    }
    return this.opts.loadout.attachments;
  }

  // Returns the weapon skin ID for the CURRENTLY active slot (primary/secondary/melee).
  // Skins are per-weapon (like attachments) — each slot has its own skin so
  // changing a skin on one weapon doesn't change it for the others. In Gun Game
  // the weapon cycles through a clean progression and ignores Armory skins.
  private getCurrentSkinId(): string {
    if (this.opts.mode === "gungame" || this.currentSlot==="wonder") return "default";
    if (this.currentSlot === "secondary") return this.opts.loadout.secondaryWeaponSkinId ?? this.opts.loadout.weaponSkinId;
    if (this.currentSlot === "melee") return this.opts.loadout.meleeWeaponSkinId ?? this.opts.loadout.weaponSkinId;
    return this.opts.loadout.weaponSkinId;
  }

  private onResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  // ---- Offline bots ----
  /** Range dummies are regular hit-detectable combatants. Only scripted
   * side-to-side targets move; none shoot or award profile progression.
   */
  private setupFiringRangeTargets() {
    RANGE_TARGETS.forEach((point, i) => {
      const id = "range_target_" + i;
      const c: Combatant = {
        id, name: ["Near Target", "Mid Target", "Far Target", "Long Target"][i],
        team: "red", isBot: true, isSelf: false,
        pos: [...point], yaw: Math.PI, pitch: 0,
        health: MAX_HEALTH, alive: true, weaponId: "pistol_side",
        weaponSkinId: "default", playerSkinId: "red",
        kills: 0, deaths: 0, score: 0,
      };
      this.combatants.set(id, c);
      this.addCombatantMesh(c);
    });
    RANGE_MOVING_TARGETS.forEach(target => {
      const c: Combatant = {
        id: "range_mover_" + target.id, name: target.name,
        team: "red", isBot: true, isSelf: false,
        pos: movingRangeTargetPosition(target, 0),
        yaw: Math.PI, pitch: 0,
        health: MAX_HEALTH, alive: true,
        weaponId: "pistol_side", weaponSkinId: "default", playerSkinId: "blue",
        kills: 0, deaths: 0, score: 0,
      };
      this.combatants.set(c.id, c);
      this.addCombatantMesh(c);
      // Cyan tracks identify moving lanes (visual geometry, not collision).
      const track = new THREE.Mesh(
        new THREE.BoxGeometry(target.halfTravel * 2 + 0.4, 0.03, 0.12),
        new THREE.MeshBasicMaterial({ color: 0x24d4ec }),
      );
      track.position.set(target.center[0], 0.065, target.center[2]);
      this.scene.add(track);
    });
    // Mark the firing line and fixed target distances without bullet-blocking cover.
    for (const z of [-28, -10, 1, 13, 25]) {
      const marker = new THREE.Mesh(new THREE.BoxGeometry(18, 0.025, 0.12),
        new THREE.MeshBasicMaterial({ color: z === -28 ? 0xffbb55 : 0x4b6172 }));
      marker.position.set(0, 0.055, z);
      this.scene.add(marker);
    }
  }

  /** Advance target positions before projectile/hitscan resolution each frame.
   * Dead dummies stay down briefly, then rejoin their lane at the current phase.
   */
  private tickFiringRangeTargets(dt: number) {
    this.rangeTimeSec += Math.max(0, dt);
    for (const target of RANGE_MOVING_TARGETS) {
      const c = this.combatants.get("range_mover_" + target.id);
      if (c?.alive) c.pos = movingRangeTargetPosition(target, this.rangeTimeSec);
    }
  }

  private setupOfflineBots() {
    let i = 0;
    const skinRotation = Math.floor(Math.random()*BOT_OPERATIVE_SKINS.length);
    const isGungame = this.opts.mode === "gungame";
    for (let n = 0; n < this.opts.botCount; n++) {
      const team = (this.opts.mode === "tdm" || this.opts.mode === "killconfirmed" || this.opts.mode === "ctf") ? (i % 2 === 0 ? "red" : "blue") : "ffa";
      const id = "bot_" + n;
      const sp = this.pickSpawn(team);
      const teamSlot = team === "ffa" ? i : Math.floor(i/2);
      const archetype = botArchetypeForSlot(teamSlot);
      const wid = isGungame ? this.gungameWeapons[0] : botArchetypeWeapon(archetype,Math.floor(Math.random()*botArchetypeWeapons(archetype).length));
      const c: Combatant = {
        id, name: "Bot-" + (n + 1), team, isBot: true, isSelf: false,
        pos: sp, yaw: 0, pitch: 0, health: MAX_HEALTH, alive: true,
        weaponId: wid, weaponSkinId: "default", playerSkinId: botOperativeSkinId(i,skinRotation),
        kills: 0, deaths: 0, score: 0,
        ai: this.makeBotAI(sp,undefined,archetype),
        gungameIndex: isGungame ? 0 : undefined,
      };
      if(c.ai)c.ai.ammoInMag=weaponById(wid).stats.magSize;
      this.combatants.set(id, c);
      this.addCombatantMesh(c);
      i++;
    }
    if (this.opts.mode === "tdm" || this.opts.mode === "killconfirmed" || this.opts.mode === "ctf") {
      const redCount = [...this.combatants.values()].filter((c) => c.team === "red").length;
      const blueCount = [...this.combatants.values()].filter((c) => c.team === "blue").length;
      (this.opts as any).team = redCount <= blueCount ? "red" : "blue";
    }
  }

  // Construct a fresh BotAI with humanization fields initialized. Skill is rolled
  // based on bot difficulty (easy = 0.28..0.45, normal = 0.45..0.65, hard = 0.65..0.80,
  // veteran = 0.80..0.95). "mixed" rolls a random difficulty per bot. Higher skill =
  // faster reaction, tighter aim, fewer misses. The resolved difficulty is stored on
  // the BotAI so per-kill rewards can scale with the victim's tier.
  private makeBotAI(sp: Vec3, overrideDifficulty?: Exclude<BotDifficulty, "mixed">, archetype: BotArchetype = "rifleman"): BotAI {
    const skillRange: Record<Exclude<BotDifficulty, "mixed">, [number, number]> = {
      easy: [0.28, 0.45],
      normal: [0.45, 0.65],
      hard: [0.65, 0.80],
      veteran: [0.80, 0.95],
    };
    // Resolve "mixed" by rolling a random tier for this bot.
    let diff: Exclude<BotDifficulty, "mixed">;
    if (overrideDifficulty) {
      diff = overrideDifficulty;
    } else if (this.botDifficulty === "mixed") {
      const opts: Exclude<BotDifficulty, "mixed">[] = ["easy", "normal", "hard", "veteran"];
      diff = opts[Math.floor(Math.random() * opts.length)];
    } else {
      diff = this.botDifficulty;
    }
    const [lo, hi] = skillRange[diff];
    const skill = lo + Math.random() * (hi - lo);
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
      moveSpeed: (0.55 + Math.random() * 0.3) * botMoveMultiplier(diff) * botPersonality(archetype).moveScale,
      attachments: { sight: null, barrel: null, grip: null, magazine: null },
      wantsHighGround: Math.random() < botArchetypeHighGroundChance(archetype,botTactics(diff).highGround),
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
      wantsReload: false,
      difficulty: diff,
      archetype,
      stuckSince: 0,
      lastPosX: sp[0],
      lastPosZ: sp[2],
    };
  }

  // ---- Survival mode (offline solo) ----
  // Endless waves of escalating bots. Player has a shared reinforcement pool;
  // each death consumes one. When the pool is empty and the player dies, game over.
  private setupSurvival() {
    (this.opts as any).team = "blue";
    this.survivalMaxReinforcements = 0;
    this.survivalReinforcements = 0;
    this.survivalWave = 0;
    this.survivalPrepLeft = 5;       // short initial prep before wave 1
    this.survivalWaveActive = false;
    this.timeLeft = 99999;           // survival has no time limit
  }

  private startSurvivalWave() {
    // Clear obsolete phase timers from bosses in earlier waves.
    this.survivalBossTimers.clear();
    this.survivalWave += 1;
    this.survivalWaveActive = true;
    // Wave-start SFX: menacing horn to signal the next wave incoming.
    this.sound.play("wave_start", { volume: 0.7 });
    // ---- Round 18-b: wave banner ----
    // Set the banner timestamp so the HUD shows "WAVE N — X enemies incoming"
    // for ~3.5 seconds after the wave starts.
    this.survivalWaveBannerAt = performance.now();
    const mutators=survivalWaveMutators(this.survivalTier,this.survivalWave);
    const count=Math.min(40,Math.ceil(survivalWaveBotCount(this.survivalWave)*mutators.spawnMul))+(mutators.boss ? 1 : 0);
    const hpMul=survivalWaveHealthMul(this.survivalWave)*mutators.healthMul;
    // Every conventional ranged weapon can spawn; specials and launchers do not.
    const botWeapons = BOT_ELIGIBLE_WEAPONS.map(w=>w.id);
    const skinRotation = Math.floor(Math.random()*BOT_OPERATIVE_SKINS.length);
    // ---- Round 18-b: spread out spawns ----
    // Use FFA spawn list (typically 20 points across the whole map) instead of
    // red-team-only spawns (typically 10 points on one side). This spreads
    // bots across the entire arena so the player isn't swarmed from one
    // direction. The pickSpawn function already maximizes distance from
    // other combatants + the player, so bots naturally spread out.
    for (let n = 0; n < count; n++) {
      const boss=mutators.boss && n === count-1;
      const id=(boss ? "svboss_" : "svbot_")+this.survivalWave+"_"+n;
      const sp = this.pickSpawn("ffa");
      const wid = boss ? "lmg_hv" : botWeapons[Math.floor(Math.random()*botWeapons.length)];
      const ai=this.makeBotAI(sp,survivalBotDifficulty(this.survivalTier,this.survivalWave),botArchetypeForCategory(weaponById(wid).category));
      ai.moveSpeed*=mutators.speedMul*(boss ? 1.3:1);
      ai.skill=Math.min(0.98,ai.skill+mutators.skillBoost);
      if(mutators.skillBoost>0) ai.difficulty="veteran";
      ai.ammoInMag=weaponById(wid).stats.magSize;
      if(boss) this.survivalBossTimers.set(id,{phase:0,nextPhaseAt:performance.now()+5000,nextSkillAt:performance.now()+8500});
      const c: Combatant = {
        id, name: boss ? `BOSS · W${this.survivalWave}` : `W${this.survivalWave}·${n + 1}`, team: "red", isBot: true, isSelf: false,
        pos: sp, yaw: 0, pitch: 0, health: Math.round(MAX_HEALTH * hpMul * (boss ? 6 : 1)), alive: true,
        bossMaxHealth:boss?Math.round(MAX_HEALTH*hpMul*6):undefined,
        weaponId: wid, weaponSkinId: "default", playerSkinId: boss ? SURVIVAL_BOSS_SKIN_ID : botOperativeSkinId(n,skinRotation),
        kills: 0, deaths: 0, score: 0,
        ai,
      };
      this.combatants.set(id, c);
      this.addCombatantMesh(c);
    }
    this.survivalEnemiesLeft = count;
  }

  private updateSurvival(dt: number) {
    if (this.matchEnded) return;
    if (this.survivalPrepLeft > 0) {
      this.survivalPrepLeft -= dt;
      if (this.survivalPrepLeft <= 0) {
        this.survivalPrepLeft = 0;
        if (!this.survivalWaveActive) this.startSurvivalWave();
      }
    } else if (this.survivalWaveActive) {
      const aliveBots = [...this.combatants.values()].filter((c) => c.isBot && c.alive).length;
      this.survivalEnemiesLeft = aliveBots;
      if (aliveBots === 0) {
        // wave cleared — cleanup dead bots and start prep for next wave
        this.survivalWaveActive = false;
        for (const [id, c] of this.combatants) {
          if (c.isBot && !c.alive) {
            if (c.group) this.scene.remove(c.group);
            this.combatants.delete(id);
          }
        }
        if(this.survivalTier==="default" && this.survivalWave >= 30) {
          this.finalizeMatchLocal();
          return;
        }
        this.survivalPrepLeft = SURVIVAL_PREP_SEC;
      }
    }
  }

  // ---- Humanoid model builder ----
  // Articulated body: torso, head, arms (upper+lower), legs (upper+lower), weapon in hands.
  private addCombatantMesh(c: Combatant) {
    const skin = playerSkinById(c.playerSkinId);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(skin.color),
      roughness: 0.6, metalness: 0.3,
      emissive: skin.emissive ? new THREE.Color(skin.emissive) : new THREE.Color(0x000000),
      emissiveIntensity: skin.emissive ? 0.4 : 0,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(skin.accent),
      roughness: 0.5, metalness: 0.4,
      emissive: skin.emissive ? new THREE.Color(skin.emissive) : new THREE.Color(skin.accent),
      emissiveIntensity: 0.3,
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7, metalness: 0.2 });
    const weaponFinish = weaponSkinById(c.weaponId==="wonder_turret"?"default":c.weaponSkinId);
    const fullWorldLegendary = coatsAllWeaponParts(weaponFinish) || weaponFinish.id === "carbon";
    const worldDefaultTint = weaponFinish.id === "default"
      ? c.weaponId === "wonder_hellfire" ? "#db3a14"
        : c.weaponId === "wonder_deadlock" ? "#51246e"
        : weaponFinish.color
      : weaponFinish.color;
    const weaponMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(worldDefaultTint),
      roughness: weaponFinish.roughness, metalness: weaponFinish.metalness,
      emissive: new THREE.Color(weaponFinish.emissive ?? "#000000"),
      emissiveIntensity: weaponFinish.emissiveIntensity ?? 0,
    });
    if (weaponFinish.id === "carbon") {
      weaponMat.map = this.createCarbonTexture();
      weaponMat.color.set(0xffffff);
    }
    if (weaponFinish.prestige || (["wonder_singularity","wonder_stormweaver"].includes(c.weaponId) && weaponFinish.id==="default")) {
      weaponMat.map = this.createPrestigeTexture(weaponFinish.prestige ?? "cosmic");
      weaponMat.color.set(0xffffff);
    }

    c.skinMaterial = bodyMat;
    const root = new THREE.Group();

    // ---- Torso (chest + hips) ----
    const torsoGroup = new THREE.Group();
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.28), bodyMat);
    chest.position.y = 1.2;
    chest.castShadow = true;
    torsoGroup.add(chest);
    // Accent stripe across chest (team color cue)
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.3), accentMat);
    stripe.position.y = 1.35;
    torsoGroup.add(stripe);
    // Hips
    const hips = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.25), darkMat);
    hips.position.y = 0.85;
    hips.castShadow = true;
    torsoGroup.add(hips);
    root.add(torsoGroup);
    // Team identity is independent of the operative skin. Red and blue players
    // keep a readable chest band even when wearing an opposing-colour skin.
    if (c.team === "red" || c.team === "blue") {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.58,0.065,0.33),
        new THREE.MeshBasicMaterial({color:c.team==="red"?0xff4256:0x4fc9ff}));
      band.position.set(0,1.09,0.01);
      torsoGroup.add(band);
    }

    // ---- Head ----
    const headGroup = new THREE.Group();
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.26), bodyMat);
    head.castShadow = true;
    headGroup.add(head);
    // Visor (accent)
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.02), accentMat);
    visor.position.set(0, 0.02, 0.13);
    headGroup.add(visor);
    headGroup.position.y = 1.62;
    root.add(headGroup);

    // ---- Arms ----
    // The glove is attached to the true end of a two-bone arm rather than a
    // fixed chest-height pose. Each frame IK puts it on a weapon-specific grip.
    const makeArm = (side: 1 | -1) => {
      const upperArmPivot = new THREE.Group();
      upperArmPivot.position.set(side * 0.3, 1.4, 0);
      const upperArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.13, BOT_UPPER_ARM_LENGTH * 0.94, 0.13), bodyMat,
      );
      upperArm.position.y = -BOT_UPPER_ARM_LENGTH * 0.48;
      upperArm.castShadow = true;
      upperArmPivot.add(upperArm);
      const lowerArmPivot = new THREE.Group();
      lowerArmPivot.position.set(0, -BOT_UPPER_ARM_LENGTH, 0);
      const lowerArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, BOT_FOREARM_LENGTH * 0.94, 0.11), darkMat,
      );
      lowerArm.position.y = -BOT_FOREARM_LENGTH * 0.48;
      lowerArm.castShadow = true;
      lowerArmPivot.add(lowerArm);
      const glove = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.115, 0.14), darkMat);
      glove.position.y = -BOT_FOREARM_LENGTH;
      glove.castShadow = true;
      lowerArmPivot.add(glove);
      upperArmPivot.add(lowerArmPivot);
      root.add(upperArmPivot);
      return { upper: upperArmPivot, lower: lowerArmPivot };
    };
    const armL = makeArm(1);
    const armR = makeArm(-1);

    // ---- Legs ----
    const makeLeg = (side: 1 | -1) => {
      const upperLegPivot = new THREE.Group();
      upperLegPivot.position.set(side * 0.13, 0.8, 0);
      const upperLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, 0.18), darkMat);
      upperLeg.position.y = -0.21;
      upperLeg.castShadow = true;
      upperLegPivot.add(upperLeg);
      const lowerLegPivot = new THREE.Group();
      lowerLegPivot.position.set(0, -0.42, 0);
      const lowerLeg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, 0.16), darkMat);
      lowerLeg.position.y = -0.2;
      lowerLeg.castShadow = true;
      lowerLegPivot.add(lowerLeg);
      // foot
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.28), bodyMat);
      foot.position.set(0, -0.42, 0.05);
      lowerLegPivot.add(foot);
      upperLegPivot.add(lowerLegPivot);
      root.add(upperLegPivot);
      return { upper: upperLegPivot, lower: lowerLegPivot };
    };
    const legL = makeLeg(1);
    const legR = makeLeg(-1);

    // Visual-only, skin-specific equipment with shared geometry for the Armory.
    // Details follow articulated limbs, but never alter combat hitboxes.
    addOperativeSkinDetails(skin, {
      torso: torsoGroup, head: headGroup,
      upperArmL: armL.upper, upperArmR: armR.upper,
      upperLegL: legL.upper, upperLegR: legR.upper,
    });

    // Larger-than-life armor is a cosmetic overlay over the standard hitbox.
    // Online boss identity is the authoritative name (IDs are random svbot IDs).
    c.bossVisual = isSurvivalBoss(c.id,c.name,c.isBot)
      ? addSurvivalBossArmor({root,torso:torsoGroup,head:headGroup,
          upperArmL:armL.upper,upperArmR:armR.upper,
          upperLegL:legL.upper,upperLegR:legR.upper})
      : undefined;

    // ---- Third-person weapon (model faces character-forward +Z) ----
    // The procedural weapon builder is camera-local (-Z forward). Its geometry,
    // hand contacts and muzzle direction are all rotated by 180° about Y for
    // soldiers, so rifles actually point ahead of the character.
    const weaponStub = new THREE.Group();
    const wcat = weaponById(c.weaponId).category;
    const wid = c.weaponId;
    if (wcat === "melee") {
      // World-space opponents carry the same identifiable blade/haft
      // profiles as first-person and F quick melee, rotated toward +Z.
      weaponStub.rotation.x=-Math.PI/2.7;
      const visual=new THREE.Group();
      visual.rotation.y=Math.PI;
      visual.scale.setScalar(BOT_WEAPON_VISUAL_SCALE);
      const grip=new THREE.MeshStandardMaterial({color:0x323f47,metalness:.3,roughness:.78});
      buildMeleeWeaponParts(wid,weaponMat,grip,(part,x,y,z)=>{
        part.position.set(x,y,z);visual.add(part);
      });
      weaponStub.add(visual);
    } else {
      // Other players/bots carry the SAME distinctive weapon silhouettes as the
      // local player. The first-person builder points toward camera -Z; rotate
      // its output 180° so it points forward (+Z) in the humanoid's hands.
      const visual = new THREE.Group();
      visual.rotation.y = Math.PI;
      visual.scale.setScalar(BOT_WEAPON_VISUAL_SCALE);
      const weaponFurniture = fullWorldLegendary
        ? weaponMat
        : new THREE.MeshStandardMaterial({ color: 0x28323b, roughness: 0.82, metalness: 0.18 });
      buildFirstPersonWeapon(wid, weaponMat, weaponFurniture, (mesh, x, y, z) => {
        mesh.position.set(x, y, z);
        visual.add(mesh);
      }, fullWorldLegendary ? weaponMat : undefined,
        weaponFinish.id !== "default" ? (weaponFinish.id === "gold" ? weaponFurniture : weaponMat) : undefined);
      if(c.charmId && c.charmId!=="none"){
        const charm=createWeaponCharm(c.charmId);
        if(charm){charm.position.set(...weaponCharmMountPoint(c.weaponId,"thirdPerson"));visual.add(charm);}
      }
      weaponStub.add(visual);
    }
    // Place the gun ahead of the chest rather than through it. The right-hand
    // grip is near the trigger; the left hand reaches under the rear handguard.
    // For pistols both hands form a compact two-handed grip, while melee uses
    // a single weapon hand and a relaxed off-hand.
    const weaponBase = new THREE.Vector3(-0.08, wcat === "melee" ? 1.29 : 1.30, 0.36);
    weaponStub.position.copy(weaponBase);
    let weaponHoldRight: THREE.Vector3;
    let weaponHoldLeft: THREE.Vector3;
    if (wcat === "melee") {
      weaponHoldRight = new THREE.Vector3(-0.07, -0.01, 0.015);
      weaponHoldLeft = new THREE.Vector3(0.38, -0.19, -0.28);
    } else {
      const contacts = weaponHoldPoints(wid);
      const toBotHandSpace = ([x, y, z]: [number, number, number]) =>
        new THREE.Vector3(-x, y, -z).multiplyScalar(BOT_WEAPON_VISUAL_SCALE);
      weaponHoldRight = toBotHandSpace(contacts.trigger);
      weaponHoldLeft = toBotHandSpace(contacts.support);
    }
    root.add(weaponStub);

    // ---- Name sprite ----
    const sprite = this.makeTextSprite(c.name + (c.isSelf ? " (You)" : ""), c.team, c.nameplateId);
    sprite.position.y = PLAYER_HEIGHT + 0.55;
    root.add(sprite);
    c.nameSprite = sprite;

    // ---- Health bar (floating above head) ----
    const barBg = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthTest: true }));
    barBg.position.y = PLAYER_HEIGHT + 0.4;
    barBg.renderOrder = 999;
    root.add(barBg);
    barBg.visible = this.showHealthBars;
    c.healthBarBg = barBg;
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.08), new THREE.MeshBasicMaterial({ color: 0x33dd66, depthTest: true }));
    bar.position.set(0, PLAYER_HEIGHT + 0.4, 0.01);
    bar.renderOrder = 1000;
    root.add(bar);
    c.healthBar = bar;
    bar.visible = this.showHealthBars;

    // ---- Team ring at feet (visible ground marker showing team color) ----
    const ringColor = c.team === "red" ? 0xef4444 : c.team === "blue" ? 0x3b82f6 : 0x9ca3af;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.7, 24),
      new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthTest: true })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    ring.renderOrder = 998;
    root.add(ring);
    c.teamRing = ring;

    // ---- Friendly chevron (floating diamond above head) ----
    // Only shown for teammates in TDM mode (not self, not enemies). Helps the
    // player identify friendlies at a glance — the chevron is always visible
    // (depthTest false) so it shows even through walls, like a real FPS "ally marker".
    // The marker is initially hidden; updateCombatantMeshes toggles visibility
    // based on whether this combatant is a friendly.
    const chevron = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.18, 0),
      new THREE.MeshBasicMaterial({ color: 0x33dd66, transparent: true, opacity: 0.85, depthTest: false })
    );
    chevron.position.y = PLAYER_HEIGHT + 0.9;
    chevron.renderOrder = 1001;
    chevron.visible = false; // toggled per-frame in updateCombatantMeshes
    root.add(chevron);
    c.friendlyMarker = chevron;
    // Magenta lock diamonds mark Deadlock's acquired enemies in-world;
    // normal depth testing means cover still hides the marker.
    const tag=new THREE.Mesh(new THREE.TorusGeometry(.22,.036,8,4),
      new THREE.MeshBasicMaterial({color:0xff4fb4,transparent:true,opacity:.98,depthTest:true}));
    tag.name="deadlock_tag";
    tag.position.y=PLAYER_HEIGHT+.47;
    tag.visible=false;
    root.add(tag);

    // ---- Round 19e: Spawn protection shield ----
    // A translucent cyan sphere around the combatant that pulses while spawn
    // protection is active. Initially hidden; toggled in updateCombatantMeshes.
    const shield = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.2, side: THREE.BackSide, depthTest: true, depthWrite: false })
    );
    shield.position.y = 1.0;
    shield.renderOrder = 997;
    // Bright ground ring makes spawn protection identifiable for both teams.
    const shieldRing = new THREE.Mesh(new THREE.TorusGeometry(0.83, 0.055, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0x66f7ff, transparent: true, opacity: 0.9, depthTest: true, depthWrite: false }));
    shieldRing.rotation.x = -Math.PI / 2;
    shieldRing.position.y = -0.85;
    shield.add(shieldRing);
    shield.visible = false;
    root.add(shield);
    c.shieldMesh = shield;

    // Depth-tested heat silhouette meshes share the already-animated body
    // geometry. They ignore atmospheric fog but NOT concrete/wall occlusion.
    // No new allocations occur while switching scopes or during a blizzard.
    const hotMaterial=new THREE.MeshBasicMaterial({
      color:0xffe7a0,transparent:true,opacity:.88,depthTest:true,depthWrite:false,fog:false,
    });
    const bodyMeshes:THREE.Mesh[]=[];
    root.traverse(obj=>{
      if(obj instanceof THREE.Mesh && (obj.material===bodyMat||obj.material===darkMat))bodyMeshes.push(obj);
    });
    c.thermalOverlays=bodyMeshes.map(body=>{
      const hot=new THREE.Mesh(body.geometry,hotMaterial);
      hot.scale.setScalar(1.04);
      hot.visible=false;
      hot.renderOrder=1;
      body.add(hot);
      return hot;
    });
    root.position.set(c.pos[0], c.pos[1], c.pos[2]);
    root.frustumCulled = false; // Round 19l: never frustum-cull combatant groups
    this.scene.add(root);
    c.group = root;

    // A rebuilt model has new joints; never reuse a pose captured from the old mesh.
    c.deathPoseStart = undefined;
    c.parts = {
      root, torso: torsoGroup, head: headGroup,
      upperArmL: armL.upper, upperArmR: armR.upper,
      lowerArmL: armL.lower, lowerArmR: armR.lower,
      upperLegL: legL.upper, upperLegR: legR.upper,
      lowerLegL: legL.lower, lowerLegR: legL.lower,
      weaponStub, weaponHoldRight, weaponHoldLeft, weaponBase, weaponMat, bodyMat,
    };
    c.walkPhase = 0;
  }

  private makeTextSprite(text: string, team: string, plateId?: string): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    const plate=cosmeticById(plateId??"standard","nameplate");
    if(plate&&plate.id!=="standard"){
      ctx.fillStyle="#0b1025";
      ctx.fillRect(8,6,240,52);
      ctx.strokeStyle=plate.color;ctx.lineWidth=3;ctx.strokeRect(9,7,238,50);
      ctx.fillStyle=plate.color;
      ctx.font="24px sans-serif";ctx.textAlign="left";ctx.fillText(plate.symbol,18,41);
    }
    ctx.fillStyle = plate?.id!=="standard" ? plate?.color??"#eeeeee" :
      team === "red" ? "#ff6b6b" : team === "blue" ? "#6ba6ff" : "#dddddd";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(0,0,0,0.85)"; ctx.lineWidth = 4;
    ctx.strokeText(text, plate?.id!=="standard"?142:128, 32);
    ctx.fillText(text, plate?.id!=="standard"?142:128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true });
    const s = new THREE.Sprite(mat);
    s.scale.set(1.6, 0.4, 1);
    return s;
  }

  // ---- Socket (online) ----
  private connectSocket() {
    console.log("[FPS] connectSocket starting, port", this.opts.socketPort, "map", this.opts.mapId);
    // Use the same endpoint as the room browser and server-health check.
    const { socketUrl, socketPath } = resolveGameServerConnection(
      window.location,
      this.opts.socketPort,
    );
    this.socket = ioClient(socketUrl, {
      path: socketPath,
      transports: ["polling", "websocket"],
      reconnection: true, reconnectionAttempts: 8, reconnectionDelay: 1000, timeout: 10000,
    });
    if (typeof window !== "undefined") (window as any).__socket = this.socket;
    this.socket.on("connect", () => {
      const rc = this.opts.roomConnect;
      if (rc?.kind === "create" && rc.config) {
        console.log("[FPS] socket connected, sending createRoom");
        this.socket.emit("message", {
          t: "createRoom", playerKey: this.opts.playerKey, name: this.opts.playerName,
          loadout: this.opts.loadout, config: rc.config,
        } as any);
      } else if (rc?.kind === "join" && rc.roomId) {
        console.log("[FPS] socket connected, sending joinRoom", rc.roomId);
        this.socket.emit("message", {
          t: "joinRoom", playerKey: this.opts.playerKey, name: this.opts.playerName,
          loadout: this.opts.loadout, roomId: rc.roomId, password: rc.password ?? null,
          team: rc.team ?? "auto",
        } as any);
      } else {
        console.log("[FPS] socket connected, sending joinMatch");
        this.socket.emit("message", {
          t: "joinMatch", playerKey: this.opts.playerKey, name: this.opts.playerName,
          mode: this.opts.mode, botCount: this.opts.botCount, loadout: this.opts.loadout,
          mapId: this.opts.mapId,
        } as any);
      }
      this.lastPingAt = performance.now();
    });
    // Round 20a: Suppress noisy connect_error logs. The socket.io client retries
    // up to N times (1s apart), and each retry fires connect_error. Logging
    // every retry as console.error is noisy and looks like a crash. Instead:
    // - Log the FIRST error only (as a warning, not an error)
    // - Subsequent retries are silent
    // - If all retries fail, the caller (GameCanvas) will show a toast and
    //   offer offline play.
    let connectErrorLogged = false;
    this.socket.on("connect_error", (e: any) => {
      if (!connectErrorLogged) {
        connectErrorLogged = true;
        console.warn("[FPS] socket connect_error:", e.message || e, "— multiplayer may be unavailable. Offline play still works.");
      }
    });
    this.socket.on("reconnect_failed", () => {
      console.warn("[FPS] socket reconnect failed — multiplayer unavailable. Use offline play instead.");
      this.opts.onSocketError?.();
    });
    this.socket.on("disconnect", (r: string) => {
      console.log("[FPS] socket disconnected:", r);
      if (this.turretDeployPending) {
        this.turretDeployPending = false;
        this.turretDeployFailedAt = performance.now();
      }
    });
    this.socket.on("message", (msg: S2C) => this.onServerMessage(msg));
    setInterval(() => {
      if (this.socket?.connected) {
        this.lastPingAt = performance.now();
        this.socket.emit("ping", Date.now());
      }
    }, 2000);
    this.socket.on("pong", (t: number) => {
      this.ping = Math.round(performance.now() - this.lastPingAt);
      void t;
    });
  }

  private onServerMessage(msg: S2C) {
    switch (msg.t) {
      case "joined":
        this.selfId = msg.selfId;
        this.scoreLimit = msg.config.scoreLimit;
        this.configuredTimeLimitSec = msg.config.timeLimit;
        this.denialScoreEnabled = msg.config.denialScoreEnabled === true;
        this.hasTimeLimit = msg.config.timeLimit > 0 && msg.mode !== "gungame" && msg.mode !== "survival";
        this.ctfResetDurationMs = ctfResetMs(msg.config.ctfFlagResetMs);
        (this.opts as any).team = msg.team;
        // switch to server's map if needed
        if (msg.mapId && msg.mapId !== this.opts.mapId) {
          this.opts.mapId = msg.mapId;
          this.map = makeEnvironmentMap(getMap(msg.mapId,msg.mode));
          // Rebuild arena visuals for the new map. We can't easily rebuild mid-scene
          // without removing old meshes; in practice the server uses the same map as
          // the client requested (findOpenRoom matches by mode only — fix that later).
        }
        for (const p of msg.players) this.ensureCombatant(p);
        // Never retain the initial FFA preview position in team modes.
        // The server's assigned team spawn is authoritative for TDM, KC,
        // CTF and other modes alike, including late lobby joins.
        const assignedSpawn = msg.players.find(p=>p.id===msg.selfId)?.pos;
        if(assignedSpawn){
          this.pos.set(assignedSpawn[0],assignedSpawn[1],assignedSpawn[2]);
          this.vel.set(0,0,0);
          this.cameraFeetY=assignedSpawn[1];
        }
        break;
      case "clusterVolley":
        this.addClusterVolley({...msg.volley,launchedAt:gravityClientTime(msg.volley.launchedAt,msg.serverNow,Date.now())},false);
        break;
      case "snapshot":
        for(const volley of msg.clusterVolleys??[])this.addClusterVolley({...volley,launchedAt:msg.serverNow?gravityClientTime(volley.launchedAt,msg.serverNow,Date.now()):volley.launchedAt},false);
        // Authoritative poison status is sent to everyone, not just the
        // attacker. Convert server timestamps so client clock skew is safe.
        this.onlinePoisoned.clear();
        for (const effect of msg.poisoned ?? []) {
          this.onlinePoisoned.set(effect.id, msg.serverNow
            ? gravityClientTime(effect.expiresAt, msg.serverNow, Date.now())
            : effect.expiresAt);
        }
        this.onlineBurning.clear();
        for (const effect of msg.burning ?? []) {
          this.onlineBurning.set(effect.id, msg.serverNow
            ? gravityClientTime(effect.expiresAt, msg.serverNow, Date.now())
            : effect.expiresAt);
        }
        for (const p of msg.players) {
          const c = this.ensureCombatant(p);
          if (p.id === this.selfId) {
            const shieldHp=p.riotShieldHp??RIOT_SHIELD_HP;
            if(shieldHp<this.riotShieldHp && this.alive){
              this.riotShieldHitFlashAt=performance.now();
              this.sound.play("melee_hit",{volume:.23,throttleMs:95});
            }
            this.riotShieldHp=shieldHp;
            // Server deadlines use epoch ms; local countdowns use performance.now.
            this.riotShieldReadyAt=p.riotShieldReadyAt
              ? performance.now()+Math.max(0,p.riotShieldReadyAt-(msg.serverNow??Date.now())) : 0;
            this.selfSpawnProtectedUntil = p.spawnProtectedUntil ?? 0;
            // Server now regenerates health authoritatively every combat tick.
            // Never let local predicted HP exceed the canonical value.
            this.health = p.health;
            this.lastServerHealth = p.health;
            // alive flag is always authoritative from the server.
            this.alive = p.alive;
            // Server is authoritative — sync from the snapshot. The instant
            // increment in the "hit" handler gives immediate HUD feedback;
            // the snapshot confirms the canonical value (resolves any race
            // where the hit event arrived slightly before the kill was credited).
            if (p.deaths > this.deaths) this.currentNoDeathStreak = 0;
            this.kills = p.kills; this.deaths = p.deaths;
            // Also update the local player's combatant so the scoreboard
            // (which iterates this.combatants) shows the right values.
            c.kills = p.kills; c.deaths = p.deaths;
            c.score = msg.scores[p.id] ?? this.kills;
            c.health = p.health; c.alive = p.alive;
            c.weaponId = p.weaponId; c.weaponSkinId = p.weaponSkinId; c.playerSkinId = p.playerSkinId;
          } else {
            c.pos = p.pos; c.yaw = p.yaw; c.pitch = p.pitch;
            c.health = p.health; c.alive = p.alive;
            c.kills = p.kills; c.deaths = p.deaths; c.score = msg.scores[p.id] ?? c.score;
            c.weaponId = p.weaponId; c.weaponSkinId = p.weaponSkinId; c.playerSkinId = p.playerSkinId;
          }
        }
        if (typeof msg.environmentTime === "number") {
          // Snapshot clocks are authoritative; small drift is smoothed to avoid jitter.
          const drift = msg.environmentTime - this.environmentTime;
          const vent=(this.map.environment??[]).find(o=>o.type==="spikes"&&o.visual==="steam");
          const phaseChanged=vent?.type==="spikes" &&
            periodicHazardPhase(vent,msg.environmentTime)!==periodicHazardPhase(vent,this.environmentTime);
          // Never smooth across a hazard boundary: the warning light, jets and
          // damage frame must use the same server-owned phase.
          this.environmentTime += phaseChanged || Math.abs(drift)>0.5 ? drift : drift*.2;
        }
        if(this.map.id==="floodgate")this.floodgateBreachAt=typeof msg.floodgateBreachAt==="number"?msg.floodgateBreachAt:null;
        for (const [id, hp] of Object.entries(msg.environmentWalls ?? {})) {
          if (Number.isFinite(hp)) this.setEnvironmentWallHP(id, hp);
        }
        // Hydrate live turrets for late-joining clients; synchronize removals.
        if (msg.gravityWells) {
          const activeIds = new Set(msg.gravityWells.map(w => w.id));
          for (const w of msg.gravityWells) this.addGravityWell(w.id, w.ownerId, w.ownerTeam, w.pos, w.radius, w.activatesAt, w.expiresAt, false, msg.serverNow);
          for (const [id, well] of this.gravityWells) if (!well.offline && !activeIds.has(id)) this.removeGravityWell(id);
        }
        if (msg.wonderFields) {
          const active=new Set(msg.wonderFields.map(f=>f.id));
          for(const f of msg.wonderFields)this.addWonderField(f.id,f.ownerId,f.ownerTeam,f.weaponId,f.kind,f.pos,f.radius,f.expiresAt,false);
          for(const [id,f] of this.wonderFields)if(!f.offline&&!active.has(id))this.removeWonderField(id);
        }
        if(msg.stormMines){
          const active=new Set(msg.stormMines.map(m=>m.id));
          for(const mine of msg.stormMines)
            this.addStormMine(mine.id,mine.pos,msg.serverNow
              ? gravityClientTime(mine.expiresAt,msg.serverNow,Date.now())
              : mine.expiresAt,false,"","");
          for(const [id,mine] of this.stormMines)
            if(!mine.offline&&!active.has(id))this.removeStormMine(id);
        }
        if (msg.turrets) {
          const activeIds = new Set(msg.turrets.map(t => t.id));
          for (const t of msg.turrets) {
            if (!this.bulletSpitters.has(t.id)) this.placeBulletSpitter(t.id,t.ownerId,t.pos,t.yaw,t.expiresAt,false);
          }
          for (const [id,t] of this.bulletSpitters) if (!t.offline && !activeIds.has(id)) this.removeBulletSpitter(id);
        }
        if(this.opts.online&&this.map.id==="floodgate")
          this.floodgateServerRulesVersion=msg.floodgateRulesVersion;
        this.teamScores = msg.teamScores;
        this.trackScoreDeficit();
        if(this.opts.mode==="ctf")this.ctfCaptures=msg.scores[this.selfId]??this.ctfCaptures;
        if(reactorObjective(this.map)){
          if(msg.orbitalCharge!==undefined)this.orbitalCharge=msg.orbitalCharge;
           this.orbitalServerVersion=msg.orbitalRulesVersion;
           this.orbitalSnapshotSeen=true;
          if(msg.orbitalHolders)this.grantOrbitalReaper(msg.orbitalHolders.includes(this.selfId));
        }
        if (this.opts.mode === "ctf") {
          this.ctfRulesVerified = msg.ctfRulesVersion === 2 && !!msg.ctfBases;
        if (msg.ctfBases) {
            this.ctfBases = msg.ctfBases;
            for (const team of ["red","blue"] as const) {
              const marker=this.ctfMarkers[team],base=msg.ctfBases[team];
              if (marker) marker.position.set(base[0],base[1]+.07,base[2]);
            }
          }
        }
        if (this.opts.mode === "ctf" && msg.ctfFlags) {
          // Snapshots update visuals only: discrete server events distinguish
          // capture, drop and return without a timing-dependent guess.
          this.ctfFlags = msg.ctfFlags;
          this.ctfOvertime = !!msg.ctfOvertime;
        }
        if (this.opts.mode === "killconfirmed") {
          this.syncKillConfirmedTags(msg.tags ?? []);
          const stats = msg.tagStats?.[this.selfId];
          if (stats) {
            this.confirmations = stats.confirmations;
            this.denials = stats.denials;
          } else if (!this.denialScoreEnabled) {
            // Compatibility with servers that only send scored confirmations.
            this.confirmations = msg.scores[this.selfId] ?? this.confirmations;
          }
        }
        // Scavenger drops are owner-private push events, NOT part of the shared
        // snapshot. Do not clear a live private pickup on each 20Hz snapshot.
        // Legacy servers may still broadcast a shared list: ignore it entirely.
        if (this.activePerkId !== "scavenger") {
          for (const id of [...this.scavengerPickups.keys()]) this.removeScavengerPickup(id);
        }
        this.timeLeft = this.opts.mode === "gungame" ? 0 : msg.timeLeft;
        // Server snapshots remain authoritative for catch-up, but a delayed
        // or older server must not repeatedly reset the running elapsed clock.
        if (typeof msg.elapsedSeconds === "number" && Number.isFinite(msg.elapsedSeconds))
          this.elapsedSeconds = Math.max(this.elapsedSeconds, msg.elapsedSeconds);
        // Survival: sync wave/reinforcement state from the server.
        if (this.opts.mode === "survival") {
          const serverWave = (msg as any).wave ?? this.survivalWave;
          // Round 18-b: detect wave change to trigger the wave banner.
          if (serverWave > this.survivalWave) {
            this.survivalWaveBannerAt = performance.now();
          }
          this.survivalWave = serverWave;
          this.survivalEnemiesLeft = (msg as any).enemiesLeft ?? this.survivalEnemiesLeft;
          this.survivalReinforcements = (msg as any).reinforcements ?? this.survivalReinforcements;
          this.survivalPrepLeft = (msg as any).prepLeft ?? this.survivalPrepLeft;
          this.survivalWaveActive = (msg as any).waveActive ?? (this.survivalEnemiesLeft>0);
          this.survivalTier=normalizeSurvivalTier((msg as any).survivalTier ?? this.survivalTier);
        }
        // Sync the server-side pre-match countdown. When > 0, the client's
        // update loop freezes local gameplay (movement, firing) and renders
        // the big "GET READY" overlay. The server also freezes bots during
        // this window.
        const serverPreMatch = (msg as any).preMatchCountdown;
        if (typeof serverPreMatch === "number" && serverPreMatch > 0) {
          this.preMatchCountdown = serverPreMatch;
        } else if (this.preMatchCountdown > 0 && (serverPreMatch === 0 || serverPreMatch === undefined)) {
          // Server says countdown is over — clear ours + play the GO sound.
          this.preMatchCountdown = 0;
          this.matchStartedAt = performance.now();
          this.sound.play("match_start", { volume: 0.8 });
        }
        // Sync the shared gungameWeapons list from the server (for late joiners
        // or if the matchStarted broadcast was missed). This keeps all clients
        // on the same per-match progression.
        if (this.opts.mode === "gungame") {
          const serverGw = (msg as any).gungameWeapons as string[] | undefined;
          if (serverGw && serverGw.length > 0) {
            // Only adopt if our list differs (avoids resetting mid-match).
            if (this.gungameWeapons.length !== serverGw.length || this.gungameWeapons.some((id, i) => id !== serverGw[i])) {
              this.gungameWeapons = serverGw;
              if (this.gungameIndex === 0 && this.weaponId !== serverGw[0]) {
                this.weaponId = serverGw[0];
                const w = weaponById(this.weaponId);
                this.eff = computeEffectiveStats(w, this.getCurrentAttachments());
                this.sightDef = sightDefForType(this.eff.sightType);
                this.ammoInMag = this.eff.magSize;
              }
            }
          }
        }
        break;
      case "shieldBashPush":
        if(msg.victimId===this.selfId && this.alive){
          // The authoritative server collision-checked the shove. Apply it to
          // the owning client so client-sent movement cannot cancel the push.
          this.pos.set(msg.pos[0],msg.pos[1],msg.pos[2]);
          this.sprinting=false;
          this.sound.play("melee_hit",{volume:.55});
        }
        break;
      case "hit": {
        if (msg.victimId === this.selfId) {
          this.damageFlashAt = performance.now();
          // Only update the regen-cooldown timestamp when real damage is dealt.
          // The server emits a "hit" S2C for every bullet that lands on the
          // player — including 0-damage edge cases (e.g. already-dead frame,
          // redundant hit after kill). Updating lastDamageAt on those caused
          // the regen timer to constantly reset, trapping the player between
          // two HP values (e.g. 38 ↔ 39 oscillation). Guard with damage > 0.
          if ((msg as any).damage && (msg as any).damage > 0) {
            this.lastDamageAt = performance.now();
          }
          this.sound.play("hit_taken", { volume: 0.55, throttleMs: 80 });
        }
        if (msg.attackerId === this.selfId) {
          this.hitMarkerAt = performance.now();
          if (msg.headshot) this.headshotMarkerAt = performance.now(); // Round 20g
          // Hit-marker SFX for non-killing hits (kills get the kill chime).
          if (!msg.killed) this.sound.play("hit_marker", { volume: 0.5, throttleMs: 60 });
        }
        // INSTANT kill/death count update (don't wait for the next snapshot —
        // gives immediate HUD feedback when the local player earns a kill or dies).
        if (msg.killed) {
          if (msg.attackerId === this.selfId) {
            this.kills += 1;
            if (msg.headshot) this.headshots += 1;
            // Attribute the kill to the weapon the SERVER says was used
            // (msg.weaponId). In online Gun Game, the server advances our tier
            // via the separate "gungameProgress" S2C — using `this.weaponId`
            // here would be correct ONLY if the "hit" message is processed
            // before "gungameProgress". While message ordering makes that
            // likely, using the server's authoritative weaponId from the hit
            // event itself eliminates any race and guarantees per-weapon skin
            // challenges (Breacher, Longshot, etc.) progress on the weapon
            // actually used for the kill.
            if (msg.weaponId !== "perk_explonando") this.recordPerWeaponKill(msg.weaponId, !!msg.headshot, this.combatants.get(msg.victimId));
            // Kill confirmation SFX (headshot chime is brighter).
            if (msg.headshot) this.sound.play("headshot", { volume: 0.8 });
            this.sound.play("kill", { volume: 0.6 });
            this.weaponAudio.playElimination(!!msg.headshot);
            this.lastElimination = { at: performance.now(), victim: this.combatants.get(msg.victimId)?.name ?? "Enemy", headshot: !!msg.headshot };
            // Register the kill for killstreak callouts.
            if (msg.defendedFlag) this.defenseKills++;
            this.registerPlayerKill();
          }
          if (msg.victimId === this.selfId) {
            this.deaths += 1;
            this.currentNoDeathStreak = 0;
            this.alive = false;
            this.grantOrbitalReaper(false);
            this.killChain = { count: 0, lastKillAt: -Infinity };
            this.recentKills = [];
            this.shotBloom = 0;
            // Set the respawn timer so the HUD countdown ("Respawning in Ns")
            // actually counts down. Previously this was only set in the offline
            // takeDamage() path — online deaths left respawnAt at 0, so the
            // HUD always showed "Respawning in 0s". The server will send a
            // "respawn" S2C when the delay elapses (which resets respawnAt=0
            // and alive=true), so this is a client-side estimate that makes
            // the countdown visible during the wait.
            const respawnDelay = this.opts.mode === "survival" ? SURVIVAL_RESPAWN_MS : RESPAWN_DELAY_MS;
            this.respawnAt = this.opts.mode === "survival" ? 0 : performance.now() + respawnDelay;
            this.sound.play("death", { volume: 0.8 });
          }
          // Trigger the death-fall animation on the victim's combatant (if it's
          // another player — bots in online mode also use this path).
          const victim = this.combatants.get(msg.victimId);
          if (victim) {
            // A winning hit may stop the server tick before its next snapshot.
            victim.alive = false;
            victim.health = 0;
            victim.deaths = msg.victimId === this.selfId ? this.deaths : victim.deaths + 1;
            victim.deathAnimAt = performance.now();
            victim.deathAnimDur = 800 + Math.random() * 250;
          }
        }
        // Track per-kill difficulty for rewards scaling. Only count kills where
        // the local player is the attacker.
        if (msg.killed && msg.attackerId === this.selfId && msg.botDifficulty) {
          this.killDifficulties.push(msg.botDifficulty as string);
        }
        break;
      }
      case "kill": {
        if(msg.entry.victim===this.opts.playerName)
          this.lastDeath={killer:msg.entry.killer,weaponId:msg.entry.weapon,
            attachments:msg.entry.attachments??[]};
        this.killFeed.unshift(msg.entry);
        if (this.killFeed.length > 6) this.killFeed.pop();
        this.opts.onKillFeed(msg.entry);
        break;
      }
      case "tagCollected":
        this.removeKillConfirmedTag(msg.tagId);
        if (msg.collectorId === this.selfId) {
          if (msg.action === "confirm") this.confirmations++;
          else this.denials++;
          this.tagNotice = { action: msg.action, at: performance.now() };
        }
        break;
      case "loadoutQueued":
        this.pendingLoadout = msg.loadout;
        break;
      case "respawn":
        if (msg.playerId === this.selfId) {
          this.equipQueuedLoadout();
          this.pos.set(msg.pos[0], msg.pos[1], msg.pos[2]);
          this.health = msg.health; this.alive = true; this.respawnAt = 0; this.lastDeath=undefined;
          this.lastPlayerRespawnAt = performance.now();
          // Wonder charges persist without a refill. New queued kits start empty.
          this.refillAmmoOnRespawn(); this.reloading = false; this.equipmentAction = null;
          this.heatStates.clear(); this.boltCharges = 0; this.poisonByVictim.clear();
          this.equipmentCharges = equipmentById(this.opts.loadout.equipmentId).charges;
          this.lastServerHealth = MAX_HEALTH;
        }
        break;
      case "gravityWell":
        this.addGravityWell(msg.id, msg.ownerId, msg.ownerTeam, msg.pos, msg.radius, msg.activatesAt, msg.expiresAt, false, msg.serverNow);
        break;
      case "gravityDetonate": {
        const radius = msg.radius ?? this.gravityWells.get(msg.id)?.radius ?? GRAVITY_WELL_RADIUS;
        this.removeGravityWell(msg.id);
        this.spawnExplosion(new THREE.Vector3(...msg.pos), "singularity", radius);
        break;
      }
      case "turretPlaced":
        this.placeBulletSpitter(msg.id, msg.ownerId, msg.pos, msg.yaw, msg.expiresAt, false);
        if (msg.ownerId === this.selfId && this.turretDeployPending) {
          this.turretDeployPending = false;
          const id = "wonder_turret";
          const rules = weaponById(id).wonder!;
          // This is an authoritative acceptance, not a speculative attempt to fire.
          const prior = this.wonderStates.get(id) ?? {charges:1,nextAt:0};
          const charged = spendWonderCharge(prior, rules, performance.now());
          if (charged) {
            this.wonderStates.set(id, charged);
            if (this.primaryWeaponId === id) this.primaryAmmoInMag = charged.charges;
            if (this.weaponId === id) this.ammoInMag = charged.charges;
          }
        }
        break;
      case "turretRejected":
        this.turretDeployPending = false;
        this.turretDeployFailedAt = performance.now();
        console.warn("[FPS] Bullet Spitter deployment declined:", msg.reason);
        this.sound.play("empty_click", { volume: .4 });
        break;
      case "turretFired": {
        const turret = this.bulletSpitters.get(msg.id);
        if (turret) {
          turret.lastFiredAt = Date.now();
          const origin: Vec3 = [turret.pos[0], turret.pos[1] + TURRET_MUZZLE_HEIGHT, turret.pos[2]];
          const delta: Vec3 = [msg.target[0]-origin[0],msg.target[1]-origin[1],msg.target[2]-origin[2]];
          const len = Math.hypot(...delta) || 1;
          const targetYaw = Math.atan2(delta[0], delta[2]);
          turret.yawPivot.rotation.y = Math.atan2(Math.sin(targetYaw - turret.yaw), Math.cos(targetYaw - turret.yaw));
          turret.barrelPivot.rotation.x = -Math.atan2(delta[1],Math.hypot(delta[0],delta[2]));
          this.spawnTracer(origin,[delta[0]/len,delta[1]/len,delta[2]/len], "default");
        }
        break;
      }
      case "turretRemoved":
        this.removeBulletSpitter(msg.id);
        break;
      case "survivalDowned":
        if (msg.playerId === this.selfId) {
          // Save the outgoing primary's remaining ammo before locking swaps.
          this.saveAmmoToSlot(this.currentSlot);
          this.survivalDowned = true;
          this.alive = true; this.health = 1; this.respawnAt = 0;
          this.sprinting = false; this.reloading = false;
          // Downed status disallows the normal swap action, so activate the
          // sidearm slot directly without sending a rejected swap packet.
          this.currentSlot = "secondary"; this.weaponId = this.secondaryWeaponId;
          this.eff = this.secondaryEff; this.sightDef = this.secondarySight;
          this.ammoInMag = this.secondaryAmmoInMag; this.buildViewmodel();
        }
        break;
      case "survivalRecovered":
        if (msg.playerId === this.selfId) {
          this.equipQueuedLoadout();
          this.survivalDowned = false;
          this.lastPlayerRespawnAt = performance.now();
          this.pos.set(...msg.pos); this.vel.set(0,0,0);
          this.alive = true; this.health = msg.health; this.respawnAt = 0; this.lastDeath = undefined;
          this.currentSlot = "primary"; this.weaponId = this.primaryWeaponId;
          this.eff = this.primaryEff; this.sightDef = this.primarySight;
          // Survival wave recovery is also a fresh deployment with full ammo.
          this.refillAmmoOnRespawn(); this.buildViewmodel();
        }
        break;
      case "deathBomb":
        this.placeDeathBomb(msg.id, msg.pos, msg.explodesAt, false);
        break;
      case "deathBombExplode":
        this.removeDeathBomb(msg.id);
        this.spawnExplosion(new THREE.Vector3(...msg.pos));
        break;
      case "scavengerDrop":
        if (this.activePerkId === "scavenger") this.spawnScavengerPickup(msg.id, msg.pos, msg.expiresAt);
        break;
      case "scavengerRemove":
        this.removeScavengerPickup(msg.id);
        break;
      case "scavengerCollected":
        if (this.activePerkId === "scavenger") this.collectScavengerAmmo();
        break;
      case "boltDrop":
        this.spawnBoltPickup(msg.id, msg.ownerId, msg.pos, msg.expiresAt);
        break;
      case "boltRemoved":
        this.removeBoltPickup(msg.id);
        break;
      case "boltRecovered":
        this.removeBoltPickup(msg.id);
        if (msg.ownerId === this.selfId) this.recoverBolt();
        break;
      case "equipmentState":
        this.equipmentCharges = msg.remaining;
        break;
      case "equipmentStatus":
        if (msg.effect === "flash") this.equipmentFlashUntil = performance.now() + msg.durationMs;
        else this.equipmentStunUntil = performance.now() + msg.durationMs;
        break;
      case "equipmentFx": {
        if(msg.mineState==="placed" && msg.mineId){
          const existing=this.remoteEquipmentMines.get(msg.mineId);
          if(existing)this.removeMineMarker(existing);
          this.remoteEquipmentMines.set(msg.mineId,this.makeMineMarker(msg.position));
        } else if(msg.mineState==="triggered"){
          if(msg.mineId){const old=this.remoteEquipmentMines.get(msg.mineId);
            if(old)this.removeMineMarker(old);this.remoteEquipmentMines.delete(msg.mineId);}
          this.spawnEquipmentVisual(msg.position,0xffb448);
        } else if(msg.path?.length){
          this.animateEquipmentPath(msg.path,msg.equipmentId,msg.flightMs??500,()=>{
            if (msg.equipmentId === "frag") this.spawnExplosion(new THREE.Vector3(...msg.position));
            else if (msg.equipmentId === "flashbang") this.spawnEquipmentVisual(msg.position,0xffffff);
            else this.spawnEquipmentVisual(msg.position,0xffb448, false);
          });
        }
        break;
      }
      case "equipmentMineRemoved": {
        const old = this.remoteEquipmentMines.get(msg.mineId);
        if (old) this.removeMineMarker(old);
        this.remoteEquipmentMines.delete(msg.mineId);
        break;
      }
      case "arcFx":
        this.spawnArcBeam(msg.from, msg.to);
        break;
      case "wonderBeam":
        this.spawnWonderBeam(msg.from, msg.to, msg.kind);
        break;
      case "stormMinePlaced":
        this.addStormMine(msg.id,msg.pos,msg.expiresAt,false,"","");
        break;
      case "stormMineRemoved":
        this.removeStormMine(msg.id);
        if(msg.triggered)this.spawnStormMineBurst(msg.pos);
        break;
      case "wonderField":
        this.addWonderField(msg.id,msg.ownerId,msg.ownerTeam,msg.weaponId,msg.kind,msg.pos,msg.radius,msg.expiresAt,false);
        break;
      case "radarPing":
        // Server sends only pings audible to this client. Never infer from globally
        // broadcast shotFx (which would allow long-range or suppressed detection).
        // Server decides who may receive a ping. Use the receiver's local clock
        // for duration so clock skew cannot make a valid ping vanish immediately.
        this.radarPings.set(msg.attackerId, {
          expiresAt: Math.max(this.radarPings.get(msg.attackerId)?.expiresAt ?? 0,
            Date.now() + (msg.durationMs === 3200 ? 3200 : msg.durationMs === 2200 ? 2200 : radarDurationMs(this.activePerkId))),
        });
        break;
      case "protectionEnded": {
        const target = this.combatants.get(msg.playerId);
        if (target) { target.spawnProtectedUntil = 0; if (target.shieldMesh) target.shieldMesh.visible = false; }
        if (msg.playerId === this.selfId) this.selfSpawnProtectedUntil = 0;
        break;
      }
      case "shotFx":
        if (msg.attackerId !== this.selfId) {
          // Every shotFx originates from a server-accepted shot. Use it as a
          // redundant radar reveal source because some targeted radarPing
          // packets may arrive before the combatant's snapshot or not arrive
          // on particular deployments. Do not reveal outside hearing range.
          const radarShooter = this.combatants.get(msg.attackerId);
          if (radarShooter && radarShooter.alive && shouldRevealGunshot(
            this.opts.mode, this.opts.team, radarShooter.team,
            { x: this.pos.x, z: this.pos.z },
            { x: msg.origin[0], z: msg.origin[2] }, !!msg.suppressed)) {
            this.radarPings.set(msg.attackerId, {
              expiresAt: radarExpiresAt(Date.now(), this.activePerkId),
            });
          }
          // Rocket launchers spawn a projectile + explosion instead of a tracer.
          if(msg.weaponId===CLUSTER_ID){
            // The server-authored volley owns every shell and bomblet visual.
          } else if (!!weaponById(msg.weaponId).explosive || ["singularity","corrosion"].includes(weaponById(msg.weaponId).wonder?.kind ?? "")) {
            // Other players' rockets: visual only (server applies damage). damage=0, applyLocalSplash=false.
            this.spawnRocketProjectile(msg.origin, msg.dir, msg.skinId, 0, false, msg.weaponId);
          } else if (msg.weaponId==="wonder_stormweaver") {
            // Server broadcasts the seven pellet paths and their chain arcs.
          } else if (msg.weaponId==="wonder_hellfire") {
            this.spawnFlameSpray(msg.origin,msg.dir);
          } else {
            this.spawnTracer(msg.origin, msg.dir, msg.skinId);
          }
          // Trigger recoil animation on the firing combatant
          const shooter = this.combatants.get(msg.attackerId);
          if (shooter) shooter.lastFireRecoil = performance.now();
          // Enemy fire sound: distance-attenuated + muffled if suppressed.
          this.playEnemyFireSound(msg.origin, msg.weaponId, !!msg.suppressed);
        }
        break;
      case "orbitalAbsorb":
        this.spawnOrbitalMote(msg.pos);
        break;
      case "orbitalPulse":
        this.showOrbitalPulse(msg.pos);
        break;
      case "orbitalReactor":
        if(reactorObjective(this.map)){
          const old=this.orbitalCharge;
          this.orbitalCharge=msg.charge;
          void old; // Charge updates are reflected in the HUD only.
        }
        break;
      case "orbitalReward":
        if(msg.playerId===this.selfId)this.grantOrbitalReaper(msg.active);
        // No Reaper claim pop-ups.
        break;
      case "ctfEvent":
        if (this.opts.mode === "ctf") {
          if (msg.action === "capture" && msg.playerId === this.selfId) this.ctfCaptures++;
          if (msg.action === "return" && msg.playerId === this.selfId) this.flagReturns++;
          this.announceCtfEvent(msg.action, msg.flag, msg.playerId);
        }
        break;
      case "matchEnd":
        this.finalizeMatch(msg.standings, msg.winnerTeam, msg.teamScores);
        break;
      case "chat":
        break;
      case "error":
        console.warn("[server error]", msg.message);
        break;
      case "roomJoined":
        // Same semantics as "joined" but for the room-lobby flow.
        this.selfId = msg.selfId;
        this.scoreLimit = msg.config.scoreLimit;
        this.configuredTimeLimitSec = msg.config.timeLimit;
        this.denialScoreEnabled = msg.config.denialScoreEnabled === true;
        this.hasTimeLimit = msg.config.timeLimit > 0 && msg.mode !== "gungame" && msg.mode !== "survival";
        this.survivalTier=normalizeSurvivalTier(msg.config.survivalTier ?? this.survivalTier);
        (this.opts as any).team = msg.team;
        if (msg.mapId && msg.mapId !== this.opts.mapId) {
          this.opts.mapId = msg.mapId;
          this.map = makeEnvironmentMap(getMap(msg.mapId,msg.mode));
        }
        for (const p of msg.players) this.ensureCombatant(p);
        // Never retain the initial FFA preview position in team modes.
        // The server's assigned team spawn is authoritative for TDM, KC,
        // CTF and other modes alike, including late lobby joins.
        const lobbySpawn = msg.players.find(p=>p.id===msg.selfId)?.pos;
        if(lobbySpawn){
          this.pos.set(lobbySpawn[0],lobbySpawn[1],lobbySpawn[2]);
          this.vel.set(0,0,0);
          this.cameraFeetY=lobbySpawn[1];
        }
        // Track lobby state from the server's response.
        this.lobbyRoomName = msg.roomName;
        this.lobbyIsHost = !!msg.isHost;
        this.lobbyPlayers = msg.players;
        this.lobbyActive = msg.state === "lobby";
        this.emitLobbyState();
        console.log("[FPS] roomJoined:", msg.roomName, "team:", msg.team, "state:", msg.state, "host:", msg.isHost);
        break;
      case "lobbySnapshot":
        // Lobby roster update (join/leave). Refresh the overlay's player list.
        this.lobbyPlayers = msg.players;
        this.lobbyActive = true;
        // The hostSocketId tells us if we're still the host (host can transfer
        // on leave). We compare against our own socket id (=== selfId for humans).
        this.lobbyIsHost = msg.hostSocketId === this.selfId;
        this.emitLobbyState();
        break;
      case "matchStarted":
        // Server transitioned the room from lobby → playing. Hide the lobby
        // overlay and reset the match clock so the timer/score display starts fresh.
        this.lobbyActive = false;
        this.lobbyPlayers = [];
        // ---- Start the pre-match countdown ----
        // The server says the match has started, but locally we freeze gameplay
        // for PRE_MATCH_COUNTDOWN_SEC so everyone has time to load the arena
        // and orient themselves before bots start shooting. The match clock is
        // shifted forward by the countdown duration so durationSec at match
        // end doesn't include the freeze.
        this.preMatchCountdown = FPSEngine.PRE_MATCH_COUNTDOWN_SEC;
        this.matchStartedAt = performance.now() + this.preMatchCountdown * 1000;
        if (msg.config) {
          this.survivalTier=normalizeSurvivalTier(msg.config.survivalTier ?? this.survivalTier);
          this.denialScoreEnabled = msg.config.denialScoreEnabled === true;
          this.opts.scoreLimit = msg.config.scoreLimit;
          this.scoreLimit = msg.config.scoreLimit;
          this.timeLeft = this.opts.mode === "gungame" ? 0 : msg.config.timeLimit;
          this.configuredTimeLimitSec = msg.config.timeLimit;
          this.hasTimeLimit = msg.config.timeLimit > 0 && this.opts.mode !== "gungame" && this.opts.mode !== "survival";
          this.ctfResetDurationMs = ctfResetMs(msg.config.ctfFlagResetMs);
          this.elapsedSeconds = 0;
        }
        // Reset tags and objective score for the new online match.
        for (const id of [...this.kcTags.keys()]) this.removeKillConfirmedTag(id);
        this.confirmations = 0; this.denials = 0; this.tagNotice = undefined;
        this.ctfFlags = createCtfFlags(this.map); this.ctfCaptures = 0; this.ctfOvertime = false; this.ctfNotice = undefined;
        this.orbitalCharge=0;
        this.orbitalServerVersion=undefined;this.orbitalSnapshotSeen=false;
        this.grantOrbitalReaper(false);
        // Reset per-kill tracking for the fresh match.
        this.killDifficulties = [];
        // Reset per-weapon kill tracking too (so a previous match's gungame
        // per-weapon tallies don't bleed into the new match).
        this.perWeaponKills = new Map();
        this.perWeaponActions = new Map();
        this.wonderStates.clear();
        const startTime=performance.now();
        const matchWonder=WEAPONS.find(w=>w.id===this.wonderWeaponId);
        if(matchWonder?.wonder && usesWonderCharges(matchWonder))
          this.wonderStates.set(matchWonder.id,drainedWonderCharges(matchWonder.wonder,startTime));
        this.riotShieldHp=matchWonder?.id===RIOT_SHIELD_ID?0:RIOT_SHIELD_HP;
        this.riotShieldReadyAt=matchWonder?.id===RIOT_SHIELD_ID
          ? startTime+RIOT_SHIELD_RECHARGE_MS:0;
        this.wonderAmmoInMag=this.wonderEff.magSize;
        if(this.weaponId===RIOT_SHIELD_ID)this.ammoInMag=this.wonderAmmoInMag;
        this.primaryAmmoInMag=this.primaryEff.magSize;
        if (this.weaponId === this.primaryWeaponId) this.ammoInMag = this.primaryAmmoInMag;
        // 19a+19b: Reset killstreak counters for the fresh match. The engine
        // instance persists across lobby→playing transitions for online matches,
        // so without these resets multikillsCount + bestStreak would carry over
        // from the previous match. Offline matches create a fresh engine
        // instance per match (field defaults are 0) but the explicit reset is
        // harmless and keeps the two paths symmetric.
        this.multikillsCount = 0;
        this.currentNoDeathStreak = 0;
        this.maxNoDeathStreak = 0;
        this.defenseKills = 0;
        this.flagReturns = 0;
        this.maxScoreDeficit = 0;
        this.bestStreak = 0;
        this.recentKills = [];
        this.killChain = { count: 0, lastKillAt: -Infinity };
        this.shotBloom = 0;
        this.lastKillstreak = null;
        // Reset Gun Game progression for the local player at match start.
        if (this.opts.mode === "gungame") {
          // Use the SERVER's resolved weapon list (shared across all players) when
          // available. This guarantees every player sees the same tier progression.
          // Fall back to a local resolution only in pure-offline mode.
          const serverWeapons = (msg as any).gungameWeapons as string[] | undefined;
          this.gungameWeapons = (serverWeapons && serverWeapons.length > 0)
            ? serverWeapons
            : this.resolveGungameWeaponsLocal();
          this.gungameIndex = 0;
          this.weaponId = this.gungameWeapons[0];
          const w = weaponById(this.weaponId);
          this.eff = computeEffectiveStats(w, this.getCurrentAttachments());
          this.sightDef = sightDefForType(this.eff.sightType);
          this.ammoInMag = this.eff.magSize;
          // Round 20: Rebuild the viewmodel so it shows the correct first-tier
          // weapon. The constructor built it from the initial weaponId, but
          // the server's gungame weapon list may differ from the local resolution.
          // Without this, the player sees the wrong weapon model at match start.
          this.buildViewmodel();
        }
        this.emitLobbyState();
        break;
      case "roomError":
        console.warn("[room error]", msg.message);
        this.opts.onRoomError?.(msg.message);
        break;
      case "roomList":
        // The engine doesn't act on room lists (the Play lobby screen does).
        break;
      case "knifeAmmo":
        this.throwingKnifeState={charges:msg.charges,nextAt:msg.rechargeMs>0?performance.now()+msg.rechargeMs:0};
        this.meleeAmmoInMag=msg.charges;
        if(isThrowingKnife(this.weaponId))this.ammoInMag=msg.charges;
        break;
      case "gungameProgress":
        // Server advanced a player's Gun Game tier. If it's the local player,
        // sync our own weaponId + effective stats so subsequent shots use the
        // new progression weapon. Other players' weaponId is already updated
        // via the snapshot (their `weaponId` field).
        if (msg.playerId === this.selfId) {
          this.gungameIndex = msg.weaponIndex;
          this.weaponId = msg.weaponId;
          if (weaponById(this.weaponId).category === "melee") { this.aiming = false; this.adsProgress = 0; }
          const w = weaponById(this.weaponId);
          this.eff = computeEffectiveStats(w, this.getCurrentAttachments());
          this.sightDef = sightDefForType(this.eff.sightType);
          if(isThrowingKnife(this.weaponId))this.throwingKnifeState=fullThrowingKnives();
          this.ammoInMag=isThrowingKnife(this.weaponId)?this.throwingKnifeState.charges:this.eff.magSize;
          this.reloading = false;
          // ---- Play the weapon-swap animation + SFX ----
          // Each Gun Game tier-up is effectively a weapon swap (the player's
          // gun changes), so we trigger the same swap animation + sound as a
          // manual 1/2/3 swap. This gives visible feedback that the new tier
          // weapon is being drawn. We also rebuild the viewmodel so the new
          // weapon's distinct shape (sniper barrel, SMG compact body, etc.)
          // is rendered.
          this.startWeaponSwapVisual();
          this.sound.play("swap", { volume: 0.5 });
          // The outgoing tier holsters before the new model is drawn.
        } else {
          const c = this.combatants.get(msg.playerId);
          if (c) {
            c.weaponId = msg.weaponId;
            c.gungameIndex = msg.weaponIndex;
          }
        }
        break;
    }
  }

  // Emit the current lobby state to the React layer (GameCanvas) so it can
  // show/hide the Lobby overlay and render the player list + Start button.
  private emitLobbyState() {
    if (!this.opts.onLobbyState) return;
    this.opts.onLobbyState({
      active: this.lobbyActive,
      isHost: this.lobbyIsHost,
      players: this.lobbyPlayers,
      roomName: this.lobbyRoomName,
    });
  }

  // Public API for the GameCanvas Lobby overlay: host requests match start.
  sendStartMatch() {
    if (!this.socket?.connected) {
      // Round 20a: Socket isn't connected (deploy without game server, or
      // server still starting). Show a helpful error instead of silently
      // doing nothing.
      console.warn("[FPS] sendStartMatch: socket not connected — can't start online match");
      this.opts.onSocketError?.();
      return;
    }
    this.socket.emit("message", { t: "startMatch" } as any);
  }

  // Public API for the GameCanvas Lobby overlay: leave the room cleanly.
  sendLeaveRoom() {
    if (this.socket?.connected) {
      this.socket.emit("message", { t: "leaveRoom" } as any);
    }
    this.lobbyActive = false;
    this.lobbyPlayers = [];
    this.emitLobbyState();
  }

  /** Rebuild third-person weapon/armor geometry on a loadout change. */
  private rebuildCombatantMesh(c: Combatant): void {
    if (!c.group) return;
    this.scene.remove(c.group);
    c.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const mat = child.material;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else mat.dispose();
      } else if (child instanceof THREE.Sprite) {
        const sm = child.material as THREE.SpriteMaterial;
        sm.map?.dispose();
        sm.dispose();
      }
    });
    c.group = undefined;
    c.parts = undefined;
    c.bossVisual = undefined;
    this.addCombatantMesh(c);
  }

  private ensureCombatant(p: SnapshotPlayer): Combatant {
    let c = this.combatants.get(p.id);
    if (!c) {
      c = {
        id: p.id, name: p.name, team: p.team, isBot: p.isBot, isSelf: p.id === this.selfId,
        pos: p.pos, yaw: p.yaw, pitch: p.pitch, health: p.health, alive: p.alive,
        weaponId: p.weaponId, weaponSkinId: p.weaponSkinId, playerSkinId: p.playerSkinId,
        charmId:p.charmId,nameplateId:p.nameplateId,
        kills: p.kills, deaths: p.deaths, score: 0,
        bossMaxHealth:p.bossMaxHealth,bossCharge:p.bossCharge,
        spawnProtectedUntil: p.spawnProtectedUntil,
      };
      this.combatants.set(p.id, c);
      if (!c.isSelf) this.addCombatantMesh(c);
    } else {
      // Gun Game (and late joins): rebuild an opponent's third-person weapon
      // if their authoritative weapon ID changes. Previously the stats changed
      // but the model in their hands stayed visually the old category forever.
      if (!c.isSelf && c.group && (p.weaponId !== c.weaponId || p.charmId !== c.charmId || p.nameplateId !== c.nameplateId)) {
        c.weaponId = p.weaponId;
        c.charmId = p.charmId;
        c.nameplateId = p.nameplateId;
        this.rebuildCombatantMesh(c);
      }
      // Round 19e: Sync spawn protection from the snapshot.
      c.spawnProtectedUntil = p.spawnProtectedUntil;
    }
    c.bossMaxHealth=p.bossMaxHealth;
    c.bossCharge=p.bossCharge;
    c.riotShieldHp=p.riotShieldHp;c.riotShieldRaised=p.riotShieldRaised;c.riotShieldReadyAt=p.riotShieldReadyAt;
    c.perkId = p.perkId;
    return c;
  }

  // ---- Spawning ----
  // Shared collision, separation, enemy sightline and recent-use scoring.
  private pickSpawn(team: string): Vec3 {
    const occupants=[...this.combatants.values()].filter(c=>c.alive).map(c=>({pos:c.pos as Vec3,team:c.team}));
    if(this.alive)occupants.push({pos:[this.pos.x,this.pos.y,this.pos.z],team:this.opts.team});
    return chooseSpawn(this,this.map,team,occupants);
  }

  /** Ordinary firearms refill on spawn; Wonder charges and cooldowns do not.
   * Applying a queued kit separately drains its selected Wonder to zero. */
  private refillAmmoOnRespawn() {
    this.primaryAmmoInMag = this.primaryEff.magSize;
    this.secondaryAmmoInMag = this.secondaryEff.magSize;
    this.meleeAmmoInMag = this.meleeEff.magSize;
    this.wonderAmmoInMag = this.wonderEff.magSize;
    // Gun Game and temporary special weapons use the active weapon's stats.
    this.ammoInMag = usesWonderCharges(weaponById(this.weaponId))
      ? (this.wonderStates.get(this.weaponId)?.charges ?? 0)
      : this.eff.magSize;
  }

  private respawnSelf() {
    this.equipQueuedLoadout();
    const sp = this.pickSpawn(this.opts.team as string);
    this.pos.set(sp[0], sp[1], sp[2]);
    this.cameraFeetY=this.pos.y;
    this.vel.set(0, 0, 0);
    this.onGround = true;
    this.lastGroundedAt = -Infinity;
    this.lastJumpPressedAt = -Infinity;
    this.wasJumpHeld = !!this.keys["Space"];
    this.touchJumpQueued = false;
    this.touchAutoSprintActive = false;
    if(this.wonderWeaponId!==RIOT_SHIELD_ID){this.riotShieldHp=RIOT_SHIELD_HP;this.riotShieldReadyAt=0;}
    this.health = MAX_HEALTH; this.alive = true;
    this.lastPlayerRespawnAt = performance.now();
    this.lastServerHealth = MAX_HEALTH; // reset so the next snapshot doesn't sync down
    this.refillAmmoOnRespawn();
    this.reloading = false;
    this.heatStates.clear(); this.boltCharges = 0; this.poisonByVictim.clear();
    this.equipmentCharges = equipmentById(this.opts.loadout.equipmentId).charges;
    // Round 20h: Local player spawn protection (offline only — online is
    // handled by the server). 3 seconds of immunity.
    if (!this.opts.online) this.selfSpawnProtectedUntil = Date.now() + 3000;
    this.respawnAt = 0;
  }

  private spawnScavengerPickup(id: string, pos: Vec3, expiresAt: number) {
    if (this.activePerkId !== "scavenger" || this.scavengerPickups.has(id)) return;
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.28, 0.43),
      new THREE.MeshStandardMaterial({ color: 0x234b31, metalness: 0.4, roughness: 0.45, emissive: 0x083b20, emissiveIntensity: 0.35 }));
    mesh.add(body);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.065, 0.11),
      new THREE.MeshBasicMaterial({ color: 0x74ef85 }));
    stripe.position.y = 0.15;
    mesh.add(stripe);
    mesh.position.set(...pos);
    this.scene.add(mesh);
    // High-contrast vertical beacon allows a small ammo pack to be found
    // among bodies, floor clutter and cover from a normal FPS viewing height.
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.050, 0.050, 1.45, 8),
      new THREE.MeshBasicMaterial({ color: 0x63ff9c, transparent: true, opacity: 0.55, depthWrite: false }));
    beacon.position.y = 0.80;
    mesh.add(beacon);
    const beaconCap = new THREE.Mesh(new THREE.OctahedronGeometry(0.20, 0),
      new THREE.MeshBasicMaterial({ color: 0xb0ffd0 }));
    beaconCap.position.y = 1.59;
    mesh.add(beaconCap);
    this.scavengerPickups.set(id, { pos, expiresAt, mesh, nextRequestAt: 0 });
  }

  private removeScavengerPickup(id: string) {
    const item = this.scavengerPickups.get(id);
    if (!item) return;
    this.scene.remove(item.mesh);
    item.mesh.traverse(obj => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(mat => mat.dispose());
    });
    this.scavengerPickups.delete(id);
  }

  private collectScavengerAmmo() {
    this.saveAmmoToSlot(this.currentSlot);
    const w=weaponById(this.weaponId);
    const eligible=(this.currentSlot==="primary" || this.currentSlot==="secondary") &&
      !w.wonder && w.category!=="melee" && w.special?.kind!=="heat";
    this.scavengerAmmoGained=eligible ? Math.max(0,this.eff.magSize-this.ammoInMag) : 0;
    if(eligible){
      this.ammoInMag=scavengerAmmoAmount(this.eff.magSize);
      this.saveAmmoToSlot(this.currentSlot);
    }
    this.scavengerFeedbackAt=performance.now();
    if(eligible)this.sound.play("reload",{volume:.34});
  }

  /** Missing match state starts an empty cooldown. The Firing Range is a
   * practice sandbox and allows immediate shots without an unlock or wait. */
  private ensureWonderState(id: string, rules: WonderChargeRules, now: number): WonderChargeState {
    const existing=this.wonderStates.get(id);
    if(existing)return existing;
    const fresh=this.opts.firingRange ? fullWonderCharges(rules) : drainedWonderCharges(rules,now);
    this.wonderStates.set(id,fresh);
    return fresh;
  }

  // ---- Special-weapon resources & ground pickups ----
  private updateSpecialResources(dt: number, now: number) {
    const clearExpired=(items:{mesh:THREE.Mesh;born:number;life:number}[])=>items.filter(item=>{
      const age=now-item.born;
      if(age>=item.life){
        this.scene.remove(item.mesh);item.mesh.geometry.dispose();
        (item.mesh.material as THREE.Material).dispose();return false;
      }
      const material=item.mesh.material as THREE.MeshBasicMaterial;
      material.opacity*=Math.max(.64,1-dt*2.3);
      return true;
    });
    this.flamePlumes=clearExpired(this.flamePlumes);
    this.stormArcMeshes=clearExpired(this.stormArcMeshes);
    for (const [id, state] of this.wonderStates) {
      const rules = weaponById(id).wonder;
      if (!rules) continue;
      const next = tickWonderCharges(state, rules, now);
      this.wonderStates.set(id, next);
      // Show stored reserve only. Including the current prepaid slice caused
      // the HUD to drop by one AFTER trigger release when that slice expired.
      const ammo=next.charges;
      if (this.primaryWeaponId === id) this.primaryAmmoInMag = ammo;
      if (this.weaponId === id) this.ammoInMag = ammo;
    }
    // Local tags are visible, persistent and never reveal enemies through cover.
    for(const [id,expires] of this.smartTags)
      if(expires<=now||!this.combatants.get(id)?.alive)this.smartTags.delete(id);
    if(this.weaponId==="wonder_deadlock"&&this.alive&&this.aiming&&this.adsProgress>=.9){
      const origin:Vec3=[this.camera.position.x,this.camera.position.y,this.camera.position.z];
      const targets=selectSmartTargets(origin,this.aimDir(0),
        [...this.combatants.values()].filter(c=>c.id!==this.selfId).map(c=>({
          id:c.id,pos:c.pos,alive:c.alive,team:c.team,
          protected:!!c.spawnProtectedUntil&&c.spawnProtectedUntil>Date.now(),
        })),this.opts.team,this.opts.mode==="ffa"||this.opts.mode==="gungame",
        this.eff.range,p=>this.hasLineOfSight(origin,[...p] as Vec3));
      for(const target of targets)if(this.smartTags.size<SMART_MAX_TAGS||this.smartTags.has(target.id))
        this.smartTags.set(target.id,now+SMART_TAG_MS);
    }
    for(const c of this.combatants.values()){
      const marker=c.group?.getObjectByName("deadlock_tag");
      if(marker){
        marker.visible=this.weaponId==="wonder_deadlock"&&c.alive&&this.smartTags.has(c.id);
        if(marker.visible)marker.rotation.z=now*.002;
      }
    }
    for (const [id, state] of this.heatStates) {
      const heatAtts = id === this.primaryWeaponId ? this.opts.loadout.attachments :
        id === this.secondaryWeaponId ? (this.opts.loadout.secondaryAttachments ?? {sight:null,barrel:null,grip:null,magazine:null}) :
        {sight:null,barrel:null,grip:null,magazine:null};
      const heat = effectiveHeatConfig(weaponById(id),heatAtts);
      if (heat) this.heatStates.set(id, coolHeat(state, heat, dt, now));
    }
    const time=Date.now();
    this.updateStormMines(time);
    for(const [id,field] of this.wonderFields){
      if(time>=field.expiresAt){this.removeWonderField(id);continue;}
      const mat=field.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity=(field.kind==="flame"?.30:.24)+(Math.sin(now*.008+field.radius)*.04);
      if(!field.offline||this.opts.online||this.matchEnded||time<field.tickAt)continue;
      field.tickAt=time+500;
      for(const c of this.combatants.values()){
        if(!c.alive||c.id===field.ownerId||(this.opts.mode!=="ffa"&&this.opts.mode!=="gungame"&&c.team===field.ownerTeam))continue;
        if(Math.hypot(c.pos[0]-field.pos[0],c.pos[2]-field.pos[2])>field.radius)continue;
        if(this.hasLineOfSight([field.pos[0],field.pos[1]+.35,field.pos[2]],[c.pos[0],c.pos[1]+.9,c.pos[2]]))
          this.applyDamageLocal(c,field.kind==="flame"?7:5,false,field.weaponId);
      }
    }
    // Poison ticks only in offline simulation; online the server owns the status.
    if (!this.opts.online && !this.matchEnded) {
      for (const [id, poison] of this.poisonByVictim) {
        const victim = this.combatants.get(id);
        if (!victim?.alive || now >= poison.expiresAt) { this.poisonByVictim.delete(id); continue; }
        if (now >= poison.tickAt) {
          poison.tickAt = now + 500;
          if (!victim.spawnProtectedUntil || victim.spawnProtectedUntil <= Date.now()) {
            this.applyDamageLocal(victim, poison.damagePerTick ?? 2, false, poison.weaponId);
          }
        }
      }
    }
    for (const [id, pack] of this.scavengerPickups) {
      if (Date.now() >= pack.expiresAt) { this.removeScavengerPickup(id); continue; }
      pack.mesh.rotation.y += dt * 1.5;
      pack.mesh.position.y = pack.pos[1] + Math.sin(now * 0.003) * 0.09;
      const nearEnough = canCollectScavengerDrop({
        now: Date.now(), expiresAt: pack.expiresAt,
        distance: Math.hypot(this.pos.x - pack.pos[0], this.pos.z - pack.pos[2]),
        alive: this.alive, perkId: this.activePerkId,
        collectorId: this.selfId, ownerId: this.selfId,
        mode: this.opts.mode, collectorTeam: this.opts.team,
      });
      if (nearEnough && this.opts.online) {
        // Reliable pickup request; server checks its OWN position, alive state,
        // perk and team before granting ammunition. Never trust client coordinates.
        const timestamp = Date.now();
        if (timestamp >= pack.nextRequestAt && this.socket?.connected) {
          this.socket.emit("message", { t: "collectScavenger", id });
          pack.nextRequestAt = timestamp + 450;
        }
      } else if (nearEnough && !this.opts.online) {
        this.removeScavengerPickup(id);
        this.collectScavengerAmmo();
      }
    }
    for (const [id, flight] of this.boltFlights) {
      const bolt = this.boltPickups.get(id);
      if (!bolt) { this.boltFlights.delete(id); continue; }
      const t = Math.min(1, (now - flight.born) / flight.duration);
      bolt.mesh.position.lerpVectors(flight.start, flight.end, t);
      if (t >= 1) this.boltFlights.delete(id);
    }
    for (const [id, bolt] of this.boltPickups) {
      if (Date.now() >= bolt.expiresAt) { this.removeBoltPickup(id); continue; }
      if (bolt.ownerId !== this.selfId || !this.alive || !this.pointerLocked && !this.touchMode) continue;
      if (Math.hypot(this.pos.x - bolt.pos[0], this.pos.z - bolt.pos[2]) > 2.0) continue;
      if (this.getCurrentAttachments().magazine==="mag_bolt_quiver" &&
          this.weaponId==="crossbow_reclaimer") continue;
      if (this.opts.online) {
        if (now >= bolt.retryAt) {
          bolt.retryAt = now + 600;
          this.socket?.emit("message", { t: "recoverBolt", boltId: id });
        }
      } else {
        this.removeBoltPickup(id);
        this.recoverBolt();
      }
    }
  }

  private recoverBolt() {
    const special = weaponById("crossbow_reclaimer").special;
    if (special?.kind !== "bolt") return;
    // Heavy ammo belongs to the CROSSBOW SLOT, not the currently held gun.
    // Pickups while holding a sidearm must still replenish collected arrows.
    const heavyPrimary=this.primaryWeaponId==="crossbow_reclaimer" &&
      this.opts.loadout.attachments?.magazine==="mag_bolt_heavy";
    const heavySecondary=this.secondaryWeaponId==="crossbow_reclaimer" &&
      this.opts.loadout.secondaryAttachments?.magazine==="mag_bolt_heavy";
    if(heavyPrimary||heavySecondary){
      if(heavyPrimary){
        this.primaryAmmoInMag=Math.min(this.primaryEff.magSize,this.primaryAmmoInMag+1);
        if(this.currentSlot==="primary")this.ammoInMag=this.primaryAmmoInMag;
      }else{
        this.secondaryAmmoInMag=Math.min(this.secondaryEff.magSize,this.secondaryAmmoInMag+1);
        if(this.currentSlot==="secondary")this.ammoInMag=this.secondaryAmmoInMag;
      }
      this.sound.play("reload",{volume:.28});
      return;
    }
    if (this.weaponId === "crossbow_reclaimer" && this.reloading) {
      this.reloadEndsAt = Math.min(this.reloadEndsAt, performance.now() + special.quickReloadSeconds * 1000);
    } else {
      this.boltCharges = Math.min(3, this.boltCharges + 1);
    }
    this.sound.play("reload", { volume: 0.28 });
  }

  private spawnBoltPickup(id: string, ownerId: string, position: Vec3, expiresAt: number) {
    if (this.boltPickups.has(id)) return;
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.75, 6),
      new THREE.MeshStandardMaterial({ color: 0x86efac, emissive: 0x22c55e, emissiveIntensity: 0.5 }),
    );
    const startPos = ownerId === this.selfId
      ? new THREE.Vector3(this.pos.x, this.pos.y + EYE_HEIGHT, this.pos.z)
      : (() => { const c = this.combatants.get(ownerId); return c
          ? new THREE.Vector3(c.pos[0], c.pos[1] + EYE_HEIGHT, c.pos[2])
          : new THREE.Vector3(position[0], Math.max(0.4, position[1]), position[2]); })();
    const endPos = new THREE.Vector3(position[0], Math.max(0.4, position[1]), position[2]);
    mesh.position.copy(startPos);
    mesh.rotation.z = Math.PI / 2.8;
    this.scene.add(mesh);
    this.boltPickups.set(id, { mesh, ownerId, pos: position, expiresAt, retryAt: 0 });
    const travelTime = Math.max(100, Math.min(900, startPos.distanceTo(endPos) / 75 * 1000));
    this.boltFlights.set(id, { start: startPos, end: endPos, born: performance.now(), duration: travelTime });
  }

  private removeBoltPickup(id: string) {
    const b = this.boltPickups.get(id);
    if (!b) return;
    this.scene.remove(b.mesh);
    b.mesh.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); const mats = Array.isArray(o.material) ? o.material : [o.material]; mats.forEach(m => m.dispose()); } });
    this.boltPickups.delete(id);
    this.boltFlights.delete(id);
  }

  private boltLanding(origin: Vec3, dir: Vec3): Vec3 {
    let t = this.eff.range;
    for (const cover of this.map.cover) {
      const hit = rayBox(origin, dir, cover.pos, cover.size);
      if (hit !== null && hit >= 0 && hit < t) t = hit;
    }
    for (const c of this.combatants.values()) {
      if (!c.alive || ((this.opts.mode === "tdm" || this.opts.mode === "killconfirmed" || this.opts.mode === "ctf") && c.team === this.opts.team)) continue;
      const hit = rayCombatantHit(origin, dir, c.pos);
      if (hit && hit.t < t) t = hit.t;
    }
    const x = origin[0] + dir[0] * t, z = origin[2] + dir[2] * t;
    // Embedded bolts fall to ground level so they can actually be reclaimed.
    return [x, 0.4, z];
  }

  /** Smart bullets arc around the muzzle; electricity renders as flickering bolts. */
  /** A moving short-range cone of orange filaments, not a ground hazard. */
  private spawnFlameSpray(origin:Vec3,dir:Vec3){
    // Flare originates at the WEAPON muzzle, not a hitscan projectile leaving
    // the camera. Overlapping translucent tongues form a continuous fire cone.
    const forward=new THREE.Vector3(...dir).normalize();
    // The true animated muzzle for our own weapon; remote players start just
    // ahead of their networked eye instead of incorrectly using our gun.
    const ownShot=this.weaponId==="wonder_hellfire" &&
      this.camera.position.distanceTo(new THREE.Vector3(...origin))<.2;
    this.camera.updateMatrixWorld(true);
    const start=ownShot
      ? this.muzzleFlash.getWorldPosition(new THREE.Vector3())
      : new THREE.Vector3(...origin).addScaledVector(forward,.48);
    for(let i=0;i<5;i++){
      // Visible flame fan follows the same broad forward arc as damage.
      const angle=(-.95+i*.475)+(Math.random()-.5)*.20;
      const spread=new THREE.Vector3(forward.x,forward.y*.45,forward.z).applyAxisAngle(new THREE.Vector3(0,1,0),angle).normalize();
      const length=1.15+Math.random()*1.25;
      const advance=i*.40;
      const centre=start.clone().addScaledVector(spread,advance+length*.5);
      centre.x+=(Math.random()-.5)*.07;centre.y+=(Math.random()-.5)*.07;
      const mesh=new THREE.Mesh(new THREE.ConeGeometry(.14+advance*.19,length,9,1),
        new THREE.MeshBasicMaterial({color:i===0?0xfff0a3:i===1?0xff981f:0xf03b13,
          transparent:true,opacity:i===0?.65:.46,depthWrite:false,
          side:THREE.DoubleSide}));
      // Three.js cones widen toward -Y. Point -Y toward the enemy so the
      // flames expand AWAY from the player, with the narrow end at the muzzle.
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),spread.clone().negate());
      mesh.position.copy(centre);this.scene.add(mesh);
      this.flamePlumes.push({mesh,born:performance.now(),life:165+i*33});
    }
  }
  private spawnWonderBeam(from:Vec3,to:Vec3,kind:"smart"|"storm"){
    const start=new THREE.Vector3(...from),end=new THREE.Vector3(...to);
    const mid=start.clone().lerp(end,.5);
    if(kind==="storm"){
      mid.x+=.24;mid.y+=.18;
      // ONE thick, jagged electrical tube instead of three fine lines.
      const points=new THREE.QuadraticBezierCurve3(start,mid,end).getPoints(19);
      for(let i=1;i<points.length-1;i++){
        points[i].x+=Math.sin(i*13.5)*.16;
        points[i].y+=Math.cos(i*9.4)*.12;
      }
      const mesh=new THREE.Mesh(new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points),28,.042,5,false),
        new THREE.MeshBasicMaterial({color:0x8deeff,transparent:true,
          opacity:.97,depthWrite:false}));
      this.scene.add(mesh);
      this.stormArcMeshes.push({mesh,born:performance.now(),life:440});
      return;
    }
    mid.y+=Math.min(2.5,start.distanceTo(end)*.055);
    const points=new THREE.QuadraticBezierCurve3(start,mid,end).getPoints(24);
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({color:0xff527f,transparent:true,opacity:.94}));
    this.scene.add(line);this.tracers.push({line,born:performance.now(),life:340});
  }
  /** Offline paths mirror server pellet hits, mine triggers and chain falloff. */
  private stormVictims(ownerId:string,ownerTeam:string):StormVictim[]{
    return [...this.combatants.values()].map(c=>({
      id:c.id,pos:c.pos,alive:c.alive,team:c.team,
      protected:!!c.spawnProtectedUntil&&c.spawnProtectedUntil>Date.now(),
    })).filter(c=>stormEnemy(c,ownerId,ownerTeam,
      this.opts.mode==="ffa"||this.opts.mode==="gungame"));
  }
  private chainStormOffline(first:Combatant,baseDamage:number,jumps:number,counts?:Map<string,number>){
    const visited=new Set([first.id]);
    let from:Vec3=[first.pos[0],first.pos[1]+1.05,first.pos[2]];
    for(let jump=1;jump<=jumps;jump++){
      const next=nextStormChainTarget(from,this.stormVictims(this.selfId,this.opts.team),
        visited,this.selfId,this.opts.team,
        this.opts.mode==="ffa"||this.opts.mode==="gungame",
        STORM_MINE_CHAIN_RADIUS,(a,b)=>this.hasLineOfSight(a,b));
      if(!next)break;
      visited.add(next.id);
      const to=stormTargetPoint(next);
      this.spawnWonderBeam(from,to,"storm");
      const victim=this.combatants.get(next.id);
      if(victim?.alive){
        const count=counts?.get(victim.id)??0;
        if(count<2){
          this.applyDamageLocal(victim,baseDamage*Math.pow(STORM_CHAIN_DECAY,jump),
            false,"wonder_stormweaver");
          counts?.set(victim.id,count+1);
        }
      }
      from=to;
    }
  }
  private addStormMine(id:string,pos:Vec3,expiresAt:number,offline:boolean,
    ownerId:string,ownerTeam:string){
    if(this.stormMines.has(id))return;
    const group=new THREE.Group();
    const bright=new THREE.MeshBasicMaterial({color:0x81f7ff,depthWrite:false});
    const dim=new THREE.MeshBasicMaterial({color:0x2779ff,transparent:true,opacity:.75,depthWrite:false});
    const core=new THREE.Mesh(new THREE.OctahedronGeometry(.20,0),bright);
    core.position.y=.13;group.add(core);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.37,.048,7,24),dim);
    ring.rotation.x=-Math.PI/2;group.add(ring);
    const cross=new THREE.Mesh(new THREE.TorusGeometry(.23,.029,6,18),bright);
    cross.rotation.y=Math.PI/2;cross.position.y=.14;group.add(cross);
    group.position.set(...pos);
    this.scene.add(group);
    this.stormMines.set(id,{mesh:group,pos,expiresAt,armedAt:Date.now()+STORM_MINE_ARM_MS,
      offline,ownerId,ownerTeam});
  }
  private removeStormMine(id:string){
    const mine=this.stormMines.get(id);if(!mine)return;
    this.scene.remove(mine.mesh);
    mine.mesh.traverse(obj=>{if(obj instanceof THREE.Mesh){
      obj.geometry.dispose();
      for(const mat of Array.isArray(obj.material)?obj.material:[obj.material])mat.dispose();
    }});
    this.stormMines.delete(id);
  }
  private spawnStormMineBurst(pos:Vec3){
    const a:Vec3=[pos[0],pos[1]+.15,pos[2]],b:Vec3=[pos[0],pos[1]+1.3,pos[2]];
    this.spawnWonderBeam(a,b,"storm");
  }
  private updateStormMines(now:number){
    for(const [id,mine] of this.stormMines){
      if(now>=mine.expiresAt){this.removeStormMine(id);continue;}
      mine.mesh.rotation.y+=.035;
      mine.mesh.scale.setScalar(.92+Math.sin(now*.007+mine.pos[0])*.12);
      if(!mine.offline||this.opts.online||this.matchEnded||now<mine.armedAt)continue;
      const target=this.stormVictims(mine.ownerId,mine.ownerTeam).find(c=>
        (this.stormMineCooldown.get(mine.ownerId+":"+c.id)??0)<=now&&
        stormMineInReach(mine.pos,c.pos)&&
        this.hasLineOfSight(mine.pos,stormTargetPoint(c)));
      if(!target)continue;
      this.removeStormMine(id);
      this.stormMineCooldown.set(mine.ownerId+":"+target.id,now+STORM_MINE_TARGET_COOLDOWN_MS);
      this.spawnStormMineBurst(mine.pos);
      this.spawnWonderBeam(mine.pos,stormTargetPoint(target),"storm");
      const victim=this.combatants.get(target.id);
      if(victim?.alive){
        this.applyDamageLocal(victim,STORM_MINE_DAMAGE,false,"wonder_stormweaver");
        this.chainStormOffline(victim,STORM_MINE_DAMAGE,STORM_MINE_JUMPS);
      }
    }
  }
  private removeWonderField(id:string){
    const field=this.wonderFields.get(id);if(!field)return;
    this.scene.remove(field.mesh);field.mesh.geometry.dispose();
    const mat=field.mesh.material;if(Array.isArray(mat))mat.forEach(m=>m.dispose());else mat.dispose();
    this.wonderFields.delete(id);
  }
  private addWonderField(id:string,ownerId:string,ownerTeam:string,weaponId:string,kind:"flame"|"sludge",pos:Vec3,radius:number,expiresAt:number,offline:boolean){
    if(this.wonderFields.has(id))return;
    const mesh=new THREE.Mesh(new THREE.CircleGeometry(radius,40),new THREE.MeshBasicMaterial({color:kind==="flame"?0xff752c:0x78c932,transparent:true,opacity:kind==="flame"?.34:.28,depthWrite:false,side:THREE.DoubleSide}));
    mesh.rotation.x=-Math.PI/2;mesh.position.set(pos[0],pos[1]+.05,pos[2]);
    this.scene.add(mesh);
    this.wonderFields.set(id,{mesh,offline,ownerId,ownerTeam,weaponId,kind,pos,radius,expiresAt,tickAt:Date.now()+500});
  }
  private spawnArcBeam(from: Vec3, to: Vec3) {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...from), new THREE.Vector3(...to)]),
      new THREE.LineBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.95 }),
    );
    this.scene.add(line);
    this.tracers.push({ line, born: performance.now(), life: 190 });
  }

  private chainArcOffline(first: Combatant, originWeaponId: string) {
    const special = weaponById(originWeaponId).special;
    if (special?.kind !== "arc") return;
    let from: ArcCandidate = { id: first.id, pos: first.pos, alive: true, team: first.team };
    const visited = new Set([first.id]);
    const candidates: ArcCandidate[] = [...this.combatants.values()]
      .filter(c => this.opts.mode === "ffa" || this.opts.mode === "gungame" || c.team !== this.opts.team)
      .map(c => ({ id: c.id, pos: c.pos, alive: c.alive, team: c.team, protected: !!c.spawnProtectedUntil && c.spawnProtectedUntil > Date.now() }));
    for (let jump = 1; jump <= special.jumps; jump++) {
      const next = nextArcTarget(from, candidates, visited, special.radius, true, (a, b) => {
        const o: Vec3 = [a.pos[0], a.pos[1] + 1.1, a.pos[2]];
        const d: Vec3 = [b.pos[0] - a.pos[0], b.pos[1] - a.pos[1], b.pos[2] - a.pos[2]];
        const len = Math.hypot(...d) || 1;
        return !this.map.cover.some(box => { const t = rayBox(o, [d[0] / len, d[1] / len, d[2] / len], box.pos, box.size); return t !== null && t >= 0 && t < len; });
      });
      if (!next) break;
      visited.add(next.id);
      this.spawnArcBeam([from.pos[0], from.pos[1] + 1.1, from.pos[2]], [next.pos[0], next.pos[1] + 1.1, next.pos[2]]);
      const victim = this.combatants.get(next.id);
      if (victim?.alive) this.applyDamageLocal(victim, this.eff.damage * Math.pow(special.decay, jump), false, originWeaponId);
      from = next;
    }
  }


  /** Full local/offline equivalents of the server's four novel actions. */
  private fireNovelWonderOffline(w:WeaponDef,origin:Vec3,dir:Vec3){
    const kind=w.wonder?.kind;
    const enemies=()=>[...this.combatants.values()].filter(c=>c.id!==this.selfId&&c.alive&&
      (this.opts.mode==="ffa"||this.opts.mode==="gungame"||c.team!==this.opts.team));
    if(kind==="smart"){
      // All valid acquired targets are struck by the same smart volley, not
      // only the first marker. A single charge is still consumed per volley.
      const tagged=[...this.smartTags].filter(([,expires])=>expires>performance.now())
        .map(([id])=>this.combatants.get(id))
        .filter((c):c is Combatant=>!!c&&c.alive&&
          (!c.spawnProtectedUntil||c.spawnProtectedUntil<=Date.now())&&
          Math.hypot(c.pos[0]-origin[0],c.pos[2]-origin[2])<=this.eff.range&&
          this.hasLineOfSight(origin,[c.pos[0],c.pos[1]+1.05,c.pos[2]]))
        .slice(0,SMART_MAX_TAGS);
      if(tagged.length){
        for(const victim of tagged){
          const to:Vec3=[victim.pos[0],victim.pos[1]+1.05,victim.pos[2]];
          this.spawnWonderBeam(origin,to,"smart");
          const path=this.normalize([to[0]-origin[0],to[1]-origin[1],to[2]-origin[2]]);
          if(rayRiotShield(origin,path,victim)!==null)victim.riotShieldHp=damageRiotShield(victim.riotShieldHp??RIOT_SHIELD_HP,this.eff.damage);
          else this.applyDamageLocal(victim,this.eff.damage,false,w.id);
        }
      }else{
        this.localFireRay(origin,dir,w.stats.headshotMult);
        this.spawnTracer(origin,dir,this.getCurrentSkinId());
      }
      return;
    }
    if(kind==="flame"){
      for(const c of enemies()){
        const target:Vec3=[c.pos[0],c.pos[1]+1,c.pos[2]];
        if(inFlameCone(origin,dir,target,HELLFIRE_RANGE)&&this.hasLineOfSight(origin,target)){
          this.applyDamageLocal(c,this.eff.damage,false,w.id);
          if(c.alive)this.localBurning.set(c.id,performance.now()+1100);
        }
      }
      return; // Burning spray never paints persistent damaging floors.
    }
    if(kind==="sludge"){
      const impact=this.boltLanding(origin,dir);
      const point:Vec3=[impact[0],this.pos.y+.12,impact[2]];
      this.addWonderField("local_field_"+(++this.localWonderSequence),this.selfId,this.opts.team,w.id,"sludge",point,w.wonder!.radius,Date.now()+8500,true);
      for(const c of enemies()){
        if(Math.hypot(c.pos[0]-point[0],c.pos[2]-point[2])<=w.wonder!.radius&&
          this.hasLineOfSight([point[0],point[1]+.5,point[2]],[c.pos[0],c.pos[1]+1,c.pos[2]]))
          this.applyDamageLocal(c,this.eff.damage,false,w.id);
      }
      return;
    }
    if(kind==="storm"){
      const hits=new Map<string,number>(),chains=new Map<string,number>();
      for(const pelletDir of stormPelletDirections(dir)){
        const impact=traceStormPellet(origin,pelletDir,this.eff.range,this.map.cover,
          this.stormVictims(this.selfId,this.opts.team));
        // Pellet travel is not chain lightning: arcs begin only on impact,
        // between struck targets (or between a triggered mine and its victim).
        if(impact.victim){
          const victim=this.combatants.get(impact.victim.id);
          if(!victim?.alive)continue;
          const amount=hits.get(victim.id)??0;
          if(amount<STORM_MAX_DIRECT_HITS_PER_TARGET){
            this.applyDamageLocal(victim,STORM_DIRECT_DAMAGE,false,w.id);
            hits.set(victim.id,amount+1);
          }
          this.chainStormOffline(victim,STORM_DIRECT_DAMAGE,STORM_CHAIN_JUMPS,chains);
        }else{
          const place=stormMinePosition(impact.point,this.map.cover);
          const owned=[...this.stormMines].filter(([,m])=>m.offline&&m.ownerId===this.selfId);
          if(owned.length>=STORM_MAX_MINES_PER_OWNER)this.removeStormMine(owned[0][0]);
          const id="offline_storm_"+(++this.localWonderSequence);
          this.addStormMine(id,place,Date.now()+STORM_MINE_LIFETIME_MS,true,this.selfId,this.opts.team);
        }
      }
      return;
    }
  }

  private shieldRaised():boolean{
    return this.weaponId===RIOT_SHIELD_ID && this.aiming && !this.reloading && !this.sprinting &&
      this.riotShieldHp>0 && (!this.quickMeleeFeedbackAt || performance.now()-this.quickMeleeFeedbackAt>=riotBashProfile().swingMs);
  }
  private disposeRiotModel(model:THREE.Object3D){
    model.removeFromParent();
    const mats=new Set<THREE.Material>();
    model.traverse(o=>{if(o instanceof THREE.Mesh || o instanceof THREE.Line){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);}});
    for(const m of mats)m.dispose();
  }
  private updateRiotModels(){
    if(!this.opts?.online){
      const next=tickRiotShield(this.riotShieldHp,this.riotShieldReadyAt,performance.now());
      this.riotShieldHp=next.hp;this.riotShieldReadyAt=next.readyAt;
    }
    const panel=shieldPanel(this.shieldRaised()), full=shieldPanel(true);
    if(this.riotShieldModel){
      const model=this.riotShieldModel;
      model.visible=this.alive&&this.riotShieldHp>0;
      applyRiotShieldDamageVisual(model,this.riotShieldHp);
      model.scale.set(panel.width/full.width,panel.height/full.height,1);
      model.position.set(panel.right,panel.centerY-EYE_HEIGHT,-Math.max(.75,panel.forward));
      const bashProgress=(performance.now()-this.quickMeleeFeedbackAt)/riotBashProfile().swingMs;
      if(this.weaponId===RIOT_SHIELD_ID && bashProgress>=0 && bashProgress<1)
        model.position.z-=.4*Math.sin(Math.PI*bashProgress);
      // Camera forward is -Z; the same panel angle is required, not its mirror.
      model.rotation.set(0,panel.yawOffset,0);
      // The Bulwark shield uses a separate left-shoulder draw, while its
      // sidearm follows the normal holster/draw timeline. Keep the new shield
      // off-screen at viewmodel handoff and sweep it into the guard pose instead
      // of making a full-size shield abruptly appear in front of the camera.
      const swapAge = this.swapAnimAt ? performance.now() - this.swapAnimAt : Infinity;
      if (swapAge >= 0 && swapAge < WEAPON_SWAP_VISUAL_MS) {
        const pose = sampleRiotShieldSwapMotion(swapAge / WEAPON_SWAP_VISUAL_MS);
        model.position.x += pose.x;
        model.position.y += pose.y;
        model.position.z += pose.z;
        model.rotation.x += pose.pitch;
        model.rotation.y += pose.yaw;
        model.rotation.z += pose.roll;
      }
    }
    for(const c of this.combatants.values()){
      if(!c.group||c.isSelf)continue;
      if(c.weaponId===RIOT_SHIELD_ID&&(!c.riotShieldModel||c.riotShieldModel.parent!==c.group)){
        c.riotShieldModel=createRiotShieldModel();c.group.add(c.riotShieldModel);
      }
      const model=c.riotShieldModel;if(!model)continue;
      model.visible=c.alive&&c.weaponId===RIOT_SHIELD_ID&&(c.riotShieldHp??RIOT_SHIELD_HP)>0;
      applyRiotShieldDamageVisual(model,c.riotShieldHp??RIOT_SHIELD_HP);
      const p=shieldPanel(!!c.riotShieldRaised);
      model.position.set(-p.right,p.centerY,p.forward);model.rotation.y=p.yawOffset;
      model.scale.set(p.width/full.width,p.height/full.height,1);
    }
  }
  private addClusterVolley(volley:ClusterVolley,offline:boolean){
    if(this.clusterVolleys.has(volley.id))return;
    const done=new Set<number>();
    // A late join must not replay old detonations.
    if(!offline)volley.shots.forEach((s,i)=>{if(Date.now()>volley.launchedAt+s.delayMs+s.path.flightMs)done.add(i);});
    this.clusterVolleys.set(volley.id,{...volley,offline,done,dealt:new Map(),meshes:new Map()});
  }
  private removeClusterVolley(id:string){
    const v=this.clusterVolleys.get(id);if(!v)return;
    for(const mesh of v.meshes.values()){mesh.removeFromParent();mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}
    this.clusterVolleys.delete(id);
  }
  private tickClusterVolleys(){
    const now=Date.now();
    for(const [id,v] of this.clusterVolleys){
      v.shots.forEach((s,i)=>{
        const age=now-v.launchedAt-s.delayMs;
        if(age<0||v.done.has(i))return;
        if(age>=s.path.flightMs){
          v.done.add(i);
          const mesh=v.meshes.get(i);if(mesh){mesh.removeFromParent();mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();v.meshes.delete(i);}
          this.spawnExplosion(new THREE.Vector3(...s.path.impact),undefined,s.radius,CLUSTER_ID);
          if(v.offline&&!this.matchEnded){
            const point=s.path.impact;
            for(const [turretId,turret] of this.bulletSpitters){if(turret.offline&&Math.hypot(turret.pos[0]-point[0],turret.pos[1]-point[1],turret.pos[2]-point[2])<=s.radius)this.removeBulletSpitter(turretId);}
            for(const target of this.combatants.values()){
              if(!target.alive||target.id===v.ownerId||(this.opts.mode!=="ffa"&&this.opts.mode!=="gungame"&&target.team===v.ownerTeam))continue;
              const center:Vec3=[target.pos[0],target.pos[1]+.85,target.pos[2]];
              const dmg=Math.min(clusterDamage(Math.hypot(center[0]-point[0],center[1]-point[1],center[2]-point[2]),s),CLUSTER_MAX_DAMAGE-(v.dealt.get(target.id)??0));
              if(dmg<=0||!this.hasLineOfSight(point,center))continue;
              v.dealt.set(target.id,(v.dealt.get(target.id)??0)+dmg);this.applyDamageLocal(target,dmg,false,CLUSTER_ID);
            }
          }
        }else{
          let mesh=v.meshes.get(i);
          if(!mesh){mesh=new THREE.Mesh(new THREE.SphereGeometry(i===0?.13:.09,8,6),new THREE.MeshBasicMaterial({color:i===0?0xffb535:0xff6030}));v.meshes.set(i,mesh);this.scene.add(mesh);}
          mesh.position.set(...clusterPositionAt(s.path,age));
        }
      });
      if(now>v.launchedAt+clusterLifetime(v.shots)+100)this.removeClusterVolley(id);
    }
  }
  // ---- Shooting ----
  // fireOneShot is called from the main loop's firing block (above). It handles
  // BOTH gun-fire and melee attacks — melee weapons route through tryMeleeAttack
  // instead of the ray-based gun path so they feel like real melee (short-range
  // arc hit, swing animation, no ammo, no tracer).
  private fireOneShot(w: WeaponDef) {
    if (!this.alive || this.reloading || this.matchEnded || performance.now() < this.equipmentStunUntil || performance.now() < this.swapReadyAt) return;
    if (w.disabled || shieldBlocksFire(w.id,this.shieldRaised(),this.riotShieldHp)) return;
    // Can't fire while sprinting — must release sprint or ADS first (arcade rule).
    if (this.sprinting) return;
    const now = performance.now();
    if(isThrowingKnife(w.id)){
      this.throwThrowingKnife(w,now,false);
      return;
    }
    const isMelee = w.category === "melee";
    // Ordinary melee weapons have no ammo — just a swing cooldown.
    if (isMelee) {
      this.tryMeleeAttack(w, now);
      return;
    }
    const special = w.special;
    if (special?.kind === "heat") {
      const state = this.heatStates.get(w.id) ?? freshHeat();
      const next = addHeat(state, effectiveHeatConfig(w,this.getCurrentAttachments()) ?? special, now);
      if (!next) return; // locked by overheat; no bullets or energy consumed
      this.heatStates.set(w.id, next);
    }
    if (w.wonder?.kind === "turret" && this.opts.online) {
      if (this.turretDeployPending) return;
      const current = tickWonderCharges(
        this.ensureWonderState(w.id,w.wonder,now), w.wonder, now,
      );
      if (current.charges <= 0) { this.sound.play("empty_click", { volume: .4 }); return; }
      if (!this.socket?.connected) {
        this.turretDeployFailedAt = now;
        this.sound.play("empty_click", { volume: .4 });
        return;
      }
      this.turretDeployPending = true;
      this.turretDeployRequestedAt = now;
      this.lastShotAt = now;
      this.socket.emit("message", { t: "deployTurret" } as const);
      return;
    }
    if (usesWonderCharges(w) && w.wonder) {
      const state = this.ensureWonderState(w.id,w.wonder,now);
      if(w.wonder.kind==="flame"){
        // Only accepted trigger-held shots call this function.
        const spent=spendHellfireFuelOnShot(state,w.wonder,now,
          this.hellfireActiveUntil,HELLFIRE_FUEL_STEP_MS);
        if(!spent){this.sound.play("empty_click",{volume:.4});return;}
        this.wonderStates.set(w.id,spent.state);
        this.hellfireActiveUntil=spent.paidThrough;
      }else{
        const next=spendWonderCharge(state,w.wonder,now);
        if(!next){this.sound.play("empty_click",{volume:.4});return;}
        this.wonderStates.set(w.id,next);
      }
    }
    if (special?.kind !== "heat" && !usesWonderCharges(w) && this.ammoInMag <= 0) {
      this.sound.play("empty_click", { volume: 0.4 });
      this.startReload();
      return;
    }
    this.lastShotAt = now;
    this.selfSpawnProtectedUntil = 0; // protection ends when the attack actually fires
    if (usesWonderCharges(w)) this.ammoInMag = this.wonderStates.get(w.id)!.charges;
    else if (special?.kind !== "heat") this.ammoInMag--;
    // Round 19o: Keep per-slot ammo in sync so swapping preserves the correct count.
    this.saveAmmoToSlot(this.currentSlot);
    if (w.wonder?.kind === "turret") {
      // Deploy equipment into the world; it is NOT a bullet, cannot hit a
      // target directly and never shows the normal muzzle flash / gunshot.
      const feet: Vec3 = [this.pos.x, this.pos.y, this.pos.z];
      const candidate = turretDeployPosition(feet, this.yaw, this.map.cover, this.map.size);
      const position: Vec3 = [candidate[0],
        groundHeightAt(this.map.cover, candidate[0], candidate[2], candidate[1], PLAYER_RADIUS),
        candidate[2]];
      if (this.opts.online) {
        this.socket?.emit("message", { t: "shot", origin: [this.pos.x, this.pos.y + EYE_HEIGHT, this.pos.z], dir: this.aimDir(0), weaponId: this.weaponId, skinId: this.getCurrentSkinId() });
      } else {
        for (const [id, item] of this.bulletSpitters) if (item.ownerId === this.selfId) this.removeBulletSpitter(id);
        this.placeBulletSpitter(`offline_turret_${Date.now()}`, this.selfId,
          position, this.yaw, Date.now() + TURRET_LIFETIME_MS, true);
      }
      this.sound.play("swap", { volume: 0.65 });
      return;
    }
    if(w.wonder?.kind!=="flame")this.triggerMuzzleFlash();
    // Hellfire uses a filtered combustion hiss, never a muzzle blast or bullet crack.
    if(!this.opts.online&&!this.opts.firingRange&&w.wonder?.kind!=="flame")
      this.publishBotNoise({sourceId:this.selfId,pos:[this.pos.x,this.pos.y,this.pos.z],
        at:now,kind:"gunshot",suppressed:this.getCurrentAttachments().barrel==="barrel_suppressor"});
    this.weaponAudio.play(this.weaponSoundCategory(this.weaponId), {
      weaponId: this.weaponId,
      aiming:this.aiming,
      suppressed: this.getCurrentAttachments().barrel === "barrel_suppressor",
      volume: w.wonder?.kind==="flame" ? .47 : .9,
    });
    // ---- Auto-reload when the mag hits 0 ----
    // As soon as the magazine is emptied by this shot, kick off a reload
    // automatically. The user shouldn't have to press R (or pull the trigger
    // on an empty gun) to start reloading — that just wastes a click. We do
    // this AFTER the shot fires (so the last bullet still goes out) and only
    // for weapons that actually have a reload (melee/launcher have reloadTime 0
    // and are handled separately).
    const justEmptied = this.ammoInMag <= 0;
    if (!usesWonderCharges(w) && special?.kind !== "heat" && justEmptied && !this.reloading && this.eff.reloadTime > 0) {
      this.startReload();
    }

    // Fire from the SAME camera eye the player sees. Stair/elevation smoothing
    // may temporarily put the rendered eye above the physics feet; firing from
    // pos.y + EYE_HEIGHT made magnified sniper shots land below the reticle.
    const origin: Vec3 = [this.camera.position.x, this.camera.position.y, this.camera.position.z];
    // Hipfire is deliberately imprecise. Repeated shots build additional bloom,
    // which recovers between engagements even for high rate-of-fire guns.
    const steadyAds = this.aiming && this.adsProgress >= 0.9 && this.onGround
      && (this.vel.x * this.vel.x + this.vel.z * this.vel.z) < 1;
    const spread = shotSpread(this.eff, w.category, this.aiming, this.currentSpread, this.shotBloom, steadyAds);
    // Buckshot pellets originate at the true crosshair ray. Their individual
    // deviations are resolved once by the shared shotgun pattern function.
    const multiPelletShotgun = w.category === "shotgun" && !w.wonder && (this.eff.pellets ?? 1) > 1;
    const dir = this.aimDir(multiPelletShotgun ? 0 : spread);
    // Apply recoil after locking the current shot's trajectory. Subsequent shots
    // must contend with the physical camera kick, not only cosmetic gun motion.
    this.applyRecoil();
    this.shotBloom = this.eff.auto
      ? automaticBloom(this.shotBloom,this.eff.fireRate,now-this.lastBloomShotAt)
      : Math.min(.28,this.shotBloom+shotBloomIncrease(this.eff.fireRate)*.32);
    this.lastBloomShotAt=now;
    const pellets = this.eff.pellets ?? 1;
    // Capture impact before damage can kill/remove a target. Reclaimed bolts
    // should land where the shot hit, not travel through a newly-dead enemy.
    const boltImpact = special?.kind === "bolt" ? this.boltLanding(origin, dir) : null;
    if(w.wonder?.kind==="cluster"){
      if(this.opts.online)this.socket?.emit("message",{t:"shot",origin,dir,weaponId:w.id,skinId:this.getCurrentSkinId()});
      else this.addClusterVolley({id:"local_cluster_"+(++this.localWonderSequence),ownerId:this.selfId,ownerTeam:this.opts.team,launchedAt:Date.now(),shots:clusterShots(origin,dir,this.map.cover,this.map)},true);
      return;
    }
    // These kinds implement new hitscan / area rules, never rocket splash.
    if(w.wonder&&["smart","flame","storm","sludge"].includes(w.wonder.kind)){
      if(w.wonder.kind==="flame")this.spawnFlameSpray(origin,dir);
      if(this.opts.online)this.socket?.emit("message",{t:"shot",origin,dir,weaponId:this.weaponId,skinId:this.getCurrentSkinId()});
      else this.fireNovelWonderOffline(w,origin,dir);
      return;
    }
    // Turrets already return through the placement path, so any remaining
    // wonder weapon here is an explosive projectile.
    const isRocket = !!w.explosive || usesWonderCharges(w);

    if (isRocket) {
      // Rocket: fires a visible projectile that travels to the impact point and
      // detonates with SPLASH damage (AoE). The damage is applied on explosion
      // arrival (not hitscan) so near-misses still deal partial damage — this
      // matches the "Splash damage on impact" weapon description.
      if (this.opts.online) {
        // Server applies the splash damage authoritatively; we just emit the shot.
        this.socket?.emit("message", { t: "shot", origin, dir, weaponId: this.weaponId, skinId: this.getCurrentSkinId() });
      }
      // Offline: damage is applied locally when the projectile arrives (below).
      this.spawnRocketProjectile(origin, dir, this.getCurrentSkinId(), w.stats.damage, !this.opts.online);
      if (!this.opts.online) {
        const first = closestCoverHit(this.map.cover, origin, dir, this.eff.range, rayBox);
        if (first?.box.environmentId && this.environmentWalls.has(first.box.environmentId)) {
          // Do not hit a wall that is behind the first combatant impact.
          const nearerEnemy = [...this.combatants.values()].some(c => {
            if (!c.alive || (this.opts.mode !== "ffa" && this.opts.mode !== "gungame" && c.team === this.opts.team)) return false;
            const hit = rayCombatantHit(origin, dir, c.pos);
            return hit !== null && hit.t < first.distance;
          });
          if (!nearerEnemy) this.damageEnvironmentWall(first.box.environmentId, this.eff.damage);
        }
      }
    } else if (this.opts.online) {
      this.socket?.emit("message", { t: "shot", origin, dir, weaponId: this.weaponId, skinId: this.getCurrentSkinId(), aiming: this.aiming });
      this.spawnTracer(origin, dir, this.getCurrentSkinId());
    } else {
      for (let i = 0; i < pellets; i++) {
        const pdir = multiPelletShotgun
          ? shotgunPelletDirection(dir, this.eff, this.aiming)
          : pellets > 1 ? this.normalize(this.add(dir, this.randSpread(spread))) : dir;
        const victim = this.localFireRay(origin, pdir, w.stats.headshotMult, false);
        if (victim && special?.kind === "arc") this.chainArcOffline(victim, w.id);
      }
      if (special?.kind === "bolt") {
        if(this.getCurrentAttachments().magazine!=="mag_bolt_quiver"){
          const id = `local_bolt_${++this.localBoltSequence}`;
          this.spawnBoltPickup(id, this.selfId, boltImpact!, Date.now() + special.lifetimeMs);
        }
      } else this.spawnTracer(origin, dir, this.getCurrentSkinId());
    }
  }

  /** Two finite steel knives shared by F and the melee slot. All damage
   * happens on the short ray, never through walls or behind another target. */
  private throwThrowingKnife(w:WeaponDef,now:number,quick:boolean){
    const gap=1000/Math.max(.1,w.stats.fireRate);
    if(now-this.lastThrowingKnifeAt<gap || now-this.lastShotAt<gap)return;
    const spent=spendThrowingKnife(this.throwingKnifeState,now,this.opts.mode==="gungame");
    if(!spent){this.sound.play("empty_click",{volume:.35});return;}
    const origin:Vec3=[this.camera.position.x,this.camera.position.y,this.camera.position.z];
    const dir=this.aimDir(0);
    this.throwingKnifeState=spent;
    this.meleeAmmoInMag=spent.charges;
    if(isThrowingKnife(this.weaponId))this.ammoInMag=spent.charges;
    this.lastThrowingKnifeAt=now;
    if(quick){this.quickMeleeLastAt=now;this.quickMeleeFeedbackAt=now;this.meleeSwingAt=0;}
    else this.meleeSwingAt=now;
    this.lastShotAt=now;
    this.meleeSwingDur=350;
    this.selfSpawnProtectedUntil=0;
    this.weaponAudio.play("melee",{weaponId:w.id,volume:.7});
    this.spawnThrowingKnifeProjectile(origin,dir);
    if(this.opts.online){
      if(quick)this.socket?.emit("message",{t:"quickMelee"});
      else this.socket?.emit("message",{t:"shot",origin,dir,weaponId:w.id,skinId:this.getCurrentSkinId()});
      return;
    }
    let nearest:{victim:Combatant;t:number;head:boolean;shield:boolean}|null=null;
    for(const c of this.combatants.values()){
      if(!c.alive||(this.opts.mode!=="ffa"&&this.opts.mode!=="gungame"&&c.team===this.opts.team))continue;
      const body=rayCombatantHit(origin,dir,c.pos);
      const shield=rayRiotShield(origin,dir,c);
      const shieldFirst=shield!==null&&shield>=0&&(!body||shield<body.t);
      const t=shieldFirst?shield!:body?.t;
      if(t===undefined||t<0||t>THROWING_KNIFE_RANGE||(nearest&&nearest.t<=t))continue;
      nearest={victim:c,t,head:!shieldFirst&&!!body?.head,shield:shieldFirst};
    }
    const cover=closestCoverHit(this.map.cover,origin,dir,THROWING_KNIFE_RANGE,rayBox);
    if(nearest&&(!cover||cover.distance>=nearest.t)){
      if(nearest.victim.spawnProtectedUntil&&nearest.victim.spawnProtectedUntil>Date.now()){
        this.hitMarkerAt=now;return;
      }
      if(nearest.shield){
        const next=hitRiotShield(nearest.victim.riotShieldHp??RIOT_SHIELD_HP,
          nearest.victim.riotShieldReadyAt??0,w.stats.damage,now);
        nearest.victim.riotShieldHp=next.hp;nearest.victim.riotShieldReadyAt=next.readyAt;
        this.sound.play("melee_hit",{volume:.4});return;
      }
      this.applyDamageLocal(nearest.victim,w.stats.damage*(nearest.head?w.stats.headshotMult:1),nearest.head,w.id);
      this.hitMarkerAt=now;
      if(nearest.head)this.headshotMarkerAt=now;
      this.sound.play("melee_hit",{volume:.65});
    }
  }

  // ---- Melee attack ----
  // Melee weapons (knife, shiv, machete, hammer) don't fire a ray — they hit
  // everything in a short frontal arc within `eff.range` (2-3 units). The closest
  // enemy in the arc takes the weapon's full damage (no damage falloff at melee
  // range). Triggers a swing animation (positionViewmodel reads meleeSwingAt).
  private tryMeleeAttack(w: WeaponDef, now: number) {
    // Swing cooldown: based on the melee weapon's fireRate (1.6 rps machete →
    // ~625ms between swings; 3.5 rps shiv → ~285ms; 0.7 rps hammer → ~1430ms).
    const swingGap=quickMeleeProfile(w.stats,w.id).cooldownMs;
    if (now - this.lastShotAt < swingGap ||
        (w.id===this.meleeWeaponId && now-this.quickMeleeLastAt < swingGap)) return;
    this.lastShotAt = now;
    this.selfSpawnProtectedUntil = 0;
    this.meleeSwingAt = now;
    this.meleeSwingDur = quickMeleeProfile(w.stats,w.id).swingMs;
    // Actual swing event, not button press (respects melee cooldown).
    this.weaponAudio.play("melee", { weaponId: this.weaponId, volume: 0.85 });

    // Use exactly the same grounded reach, facing cone and cover checks as F.
    // Never multiply melee hits for headshots; knife is already a point-blank KO.
    const from:Vec3=[this.pos.x,this.pos.y,this.pos.z];
    const nearest=chooseQuickMeleeTarget(from,this.yaw,
      [...this.combatants.values()].map(c=>({
        id:c.id,pos:c.pos,alive:c.alive,
        protected:(c.spawnProtectedUntil??0)>Date.now(),
        friendly:this.opts.mode!=="ffa"&&this.opts.mode!=="gungame"&&c.team===this.opts.team,
      })),
      (c,dist)=>{
        const eye:Vec3=[from[0],from[1]+1.1,from[2]];
        const dir:Vec3=[(c.pos[0]-from[0])/dist,0,(c.pos[2]-from[2])/dist];
        return !this.map.cover.some(box=>{
          const t=rayBox(eye,dir,box.pos,box.size);
          return t!==null&&t>.08&&t<dist-.15;
        });
      },quickMeleeProfile(w.stats,w.id).reach,quickMeleeProfile(w.stats,w.id).halfArcDegrees);
    if(!this.opts.online&&w.id===ORBITAL_REAPER_ID)
      this.offlineOrbitalPulse(from,this.opts.team as string,null,nearest?[nearest.id]:[]);
    if(nearest&&!this.opts.online){
      const victim=this.combatants.get(nearest.id);
      if(victim){
        this.applyDamageLocal(victim,this.eff.damage,false,w.id);
        this.hitMarkerAt=now;
        this.sound.play("melee_hit",{volume:.7});
      }
    }

    // Online: notify server of melee swing so other clients see the swing anim
    // and the server validates the hit. The server treats melee as a 0-range shot.
    if (this.opts.online && this.socket?.connected) {
      const cp=Math.cos(this.pitch);
      const origin: Vec3=[this.pos.x,this.pos.y+EYE_HEIGHT,this.pos.z];
      const dir: Vec3=[Math.sin(this.yaw)*cp,Math.sin(this.pitch),Math.cos(this.yaw)*cp];
      this.socket.emit("message",{t:"shot",origin,dir,weaponId:this.weaponId,skinId:this.getCurrentSkinId()});
    }
  }

  private localFireRay(origin: Vec3, dir: Vec3, headshotMult: number, isMelee = false) {
    // Heavy-caliber hitscan uses the same ordered ray contacts as the server.
    // The range supports multiple aligned mannequins, never wall penetration.
    if (this.eff.bodyPenetration && !isMelee) {
      const maxDistance = maxWeaponHitRange(this.eff.range, this.eff);
      const contacts: BodyRayContact<Combatant>[] = [];
      for (const c of this.combatants.values()) {
        if (!c.alive || (this.opts.mode !== "ffa" && this.opts.mode !== "gungame" && c.team === this.opts.team)) continue;
        const panel = rayRiotShield(origin, dir, c);
        const body = rayCombatantHit(origin, dir, c.pos);
        const shieldFirst = panel !== null && panel >= 0 && (!body || panel < body.t);
        const t = shieldFirst ? panel! : body?.t;
        if (t !== undefined) contacts.push({ target: c, t, head: shieldFirst ? false : !!body?.head,
          shield: shieldFirst, protected: (c.spawnProtectedUntil ?? 0) > Date.now() });
      }
      const cover = closestCoverHit(this.map.cover, origin, dir, maxDistance, rayBox);
      const firstBody = selectBodyPenetrationHits(contacts, maxDistance, Infinity)[0];
      if (cover?.box.environmentId && this.environmentWalls.has(cover.box.environmentId) &&
          (!firstBody || firstBody.t >= cover.distance)) {
        this.damageEnvironmentWall(cover.box.environmentId, this.eff.damage);
        return null;
      }
      const hits = selectBodyPenetrationHits(contacts, maxDistance, cover?.distance ?? Infinity,
        this.eff.bodyPenetration);
      let firstVictim: Combatant | null = null;
      for (const hit of hits) {
        const victim = hit.target;
        if (hit.protected) { this.hitMarkerAt = performance.now(); break; }
        if (hit.shield) {
          const next = hitRiotShield(victim.riotShieldHp ?? RIOT_SHIELD_HP,
            victim.riotShieldReadyAt ?? 0, this.eff.damage * hit.damageScale, performance.now());
          victim.riotShieldHp = next.hp; victim.riotShieldReadyAt = next.readyAt;
          this.sound.play("melee_hit", { volume: .45 });
          break;
        }
        const base = this.eff.damage * (hit.head ? headshotMult : 1);
        const damage = damageAtRange(base, hit.t, this.eff.range, this.eff) * hit.damageScale;
        const willKill = victim.health - damage <= 0 && victim.alive;
        this.applyDamageLocal(victim, damage, hit.head);
        if (!firstVictim) firstVictim = victim;
        this.hitMarkerAt = performance.now();
        if (hit.head) this.headshotMarkerAt = performance.now();
        if (!willKill && performance.now() - this.lastHitSoundAt > 60) {
          this.lastHitSoundAt = performance.now();
          this.sound.play("hit_marker", { volume: .5 });
        }
        if (this.matchEnded) break;
      }
      return firstVictim;
    }
    let nearest: { c: Combatant; t: number; head: boolean; shield?:boolean } | null = null;
    for (const c of this.combatants.values()) {
      if (!c.alive) continue;
      if (this.opts.mode !== "ffa" && this.opts.mode !== "gungame" && c.team === this.opts.team) continue;
      const panel=rayRiotShield(origin,dir,c);
      if(panel!==null&&panel<=maxWeaponHitRange(this.eff.range,this.eff)&&(!nearest||panel<nearest.t))nearest={c,t:panel,head:false,shield:true};
      const hit = rayCombatantHit(origin, dir, c.pos);
      if (hit && hit.t <= maxWeaponHitRange(this.eff.range, this.eff)) {
        if (!nearest || hit.t < nearest.t) nearest = { c, t: hit.t, head: hit.head };
      }
    }
    // First hit on destructible cover absorbs the bullet (even the fatal bullet).
    const firstCover = closestCoverHit(this.map.cover, origin, dir, this.eff.range * 1.6, rayBox);
    if (firstCover?.box.environmentId && this.environmentWalls.has(firstCover.box.environmentId) &&
        (!nearest || nearest.t >= firstCover.distance)) {
      this.damageEnvironmentWall(firstCover.box.environmentId, this.eff.damage);
      return null;
    }
    // cover blocking
    let blockedT = Infinity;
    for (const cov of this.coverAlong(origin,[origin[0]+dir[0]*this.eff.range,origin[1]+dir[1]*this.eff.range,origin[2]+dir[2]*this.eff.range],2)) {
      const t = rayBox(origin, dir, cov.pos, cov.size);
      if (t !== null && t < blockedT) blockedT = t;
    }
    if (nearest && nearest.t < blockedT) {
      // Round 20h: Check bot spawn protection — skip damage if protected.
      if (nearest.c.spawnProtectedUntil && nearest.c.spawnProtectedUntil > Date.now()) {
        // Show a "shield" hit marker but no damage.
        this.hitMarkerAt = performance.now();
        return null;
      }
      if(nearest.shield){
        const next=hitRiotShield(nearest.c.riotShieldHp??RIOT_SHIELD_HP,
          nearest.c.riotShieldReadyAt??0,this.eff.damage,performance.now());
        nearest.c.riotShieldHp=next.hp;nearest.c.riotShieldReadyAt=next.readyAt;
        this.sound.play("melee_hit",{volume:.45});return null;
      }
      const baseDmg = this.eff.damage * (nearest.head ? headshotMult : 1);
      const dmg = damageAtRange(baseDmg, nearest.t, this.eff.range, this.eff);
      const willKill = nearest.c.health - dmg <= 0 && nearest.c.alive;
      this.applyDamageLocal(nearest.c, dmg, nearest.head);
      if (this.eff.shotgunAmmo === "dragons_breath" && nearest.c.alive)
        this.poisonByVictim.set(nearest.c.id, { expiresAt:performance.now()+3000,
          tickAt:performance.now()+500, weaponId:this.weaponId, damagePerTick:2 });
      if (this.weaponId === "crossbow_reclaimer" && this.getCurrentAttachments().barrel === "barrel_poison" && nearest.c.alive) {
        this.poisonByVictim.set(nearest.c.id, { expiresAt: performance.now() + 4000, tickAt: performance.now() + 500, weaponId: this.weaponId });
      }
      this.hitMarkerAt = performance.now();
      if (nearest.head) this.headshotMarkerAt = performance.now(); // Round 20g: headshot marker
      // Hit-marker / melee-hit SFX (throttled — auto weapons can hit many times per second).
      // Melee weapons play a meaty thwack; guns play the soft ding. Killing hits
      // are handled downstream by applyDamageLocal (which plays the kill chime).
      if (!willKill && performance.now() - this.lastHitSoundAt > 60) {
        this.lastHitSoundAt = performance.now();
        if (isMelee) this.sound.play("melee_hit", { volume: 0.7 });
        else this.sound.play("hit_marker", { volume: 0.5 });
      }
      return nearest.c;
    }
    return null;
  }

  // Launchers have their own signature even if catalogued as a sidearm.
  private weaponSoundCategory(weaponId: string): WeaponSoundCategory {
    if (weaponById(weaponId).explosive) return "launcher";
    return weaponById(weaponId).category;
  }

  /** Plays weapon-identifiable enemy gunfire for both local bots and the
   *  multiplayer shotFx event. Distance shapes loudness and high-frequency
   *  loss; stereo pan indicates which side the shot came from. */
  private playEnemyFireSound(shooterPos: Vec3, weaponId: string, suppressed: boolean) {
    const dx = shooterPos[0] - this.pos.x;
    const dy = shooterPos[1] - this.pos.y;
    const dz = shooterPos[2] - this.pos.z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance >= 90) return;
    // Player right vector projected onto XZ (yaw=0 looks toward +Z).
    const horizontal = Math.hypot(dx, dz) || 1;
    const pan = (dx * Math.cos(this.yaw) - dz * Math.sin(this.yaw)) / horizontal;
    this.weaponAudio.play(this.weaponSoundCategory(weaponId), {
      weaponId,
      suppressed,
      distance,
      pan,
      volume: 0.92,
    });
  }

  private applyDamageLocal(victim: Combatant, damage: number, head: boolean, sourceWeaponId = this.weaponId) {
    if (!victim.alive || (victim.spawnProtectedUntil ?? 0) > Date.now()) return;
    // Remember the player's meaningful non-lethal contributions so a
    // friendly offline bot finishing the same enemy can award an assist.
    if (!this.opts.online && victim.team !== this.opts.team &&
        (this.opts.mode==="tdm"||this.opts.mode==="killconfirmed"||this.opts.mode==="ctf"||this.opts.mode==="survival")) {
      const old=this.offlineAssistDamage.get(victim.id);
      this.offlineAssistDamage.set(victim.id,{
        damage:(old && performance.now()-old.at<=10000?old.damage:0)+Math.max(0,Math.min(damage,victim.health)),
        at:performance.now(),
      });
    }
    if(victim.ai && victim.team!==this.opts.team){
      victim.ai.lastAlert=botRememberHit(this.selfId,[this.pos.x,this.pos.y,this.pos.z],performance.now());
      victim.ai.nextDecisionAt=0;
    }
    victim.health -= damage;
    if (victim.health <= 0 && victim.alive) {
      this.offlineAssistDamage.delete(victim.id);
      victim.alive = false;
      victim.deaths += 1;
      if (this.opts.mode==="ffa"||this.opts.mode==="gungame"||victim.team!==this.opts.team)
        this.recordOrbitalKill(victim.pos,[this.pos.x,this.pos.y,this.pos.z]);
      this.releaseOrbitalBotWeapon(victim);
      if (this.opts.mode === "ctf") this.dropOfflineCtfCarrier(victim.id, [...victim.pos] as Vec3);
      if (this.opts.mode !== "killconfirmed" && this.opts.mode !== "ctf") victim.score = victim.kills;
      this.kills += 1;
      this.headshots += head ? 1 : 0;
      // Offline: only a Scavenger player's kills create private ammo packs.
      if (shouldCreateScavengerDrop(this.selfId, victim.id, this.activePerkId)) {
        this.spawnScavengerPickup(`offline_ammo_${victim.id}_${Date.now()}`,
          [victim.pos[0], victim.pos[1] + 0.16, victim.pos[2]], Date.now() + SCAVENGER_DROP_LIFETIME_MS);
      }
      // Attribute this kill to the weapon the local player was holding. Critical
      // for Gun Game (where the player cycles through every progression weapon):
      // per-weapon skin challenges (Breacher, Longshot, etc.) read this map to
      // progress on the weapon actually used, not the match-start weapon.
      if (!this.opts.firingRange && sourceWeaponId !== "perk_explonando") this.recordPerWeaponKill(sourceWeaponId, head, victim);
      if (this.opts.mode === "ctf" && (this.opts.team === "red" || this.opts.team === "blue") &&
        isFlagDefenseKill(flagAtHome(this.ctfFlags[this.opts.team]), victim.pos, ctfHome(this.opts.team, this.map.id))) this.defenseKills++;
      if (this.opts.mode === "tdm") this.teamScores[this.opts.team as "red" | "blue"] += 1;
      if (this.opts.mode === "killconfirmed") this.dropLocalKillConfirmedTag(victim.id, victim.team, victim.pos);
      // Trigger the death animation (fall forward over ~900ms) before the
      // scheduleRespawn hides the mesh.
      victim.deathAnimAt = performance.now();
      victim.deathAnimDur = 800 + Math.random() * 250;
      // Kill confirmation SFX (slightly different pitch for headshots).
      if (head) this.sound.play("headshot", { volume: 0.8 });
      this.sound.play("kill", { volume: 0.6 });
      this.weaponAudio.playElimination(head);
      this.lastElimination = { at: performance.now(), victim: victim.name, headshot: head };
      this.sound.play("death", { volume: 0.5 });
      // Record the victim's difficulty for rewards scaling. Offline, all victims
      // are bots (no human opponents), so we read the bot's resolved difficulty.
      const diff: KillDifficulty = victim.ai?.difficulty ?? "normal";
      this.killDifficulties.push(diff);
      const entry: KillFeedEntry = {
        killer: this.opts.playerName, victim: victim.name, weapon: sourceWeaponId, headshot: head,
        killerTeam: this.opts.team as string, victimTeam: victim.team, botDifficulty: diff,
      };
      this.killFeed.unshift(entry);
      if (this.killFeed.length > 6) this.killFeed.pop();
      this.opts.onKillFeed(entry);
      this.registerPlayerKill();
      // Gun Game: advance the local player's tier on each kill. If they were
      // already on the final weapon (the knife), this kill wins the match.
      if (this.opts.mode === "gungame" && sourceWeaponId !== "perk_explonando") {
        const won = this.advanceLocalGungameTier();
        if (won) { this.finalizeMatchLocal(); return; }
      }
      this.scheduleRespawn(victim);
      this.checkWin();
    }
  }

  // Resolve the per-match Gun Game weapon list from the TYPE progression.
  // For each type slot (sidearm, smg, shotgun, etc.), pick a random weapon of
  // that category from the catalog. Avoids repeats within the match where
  // possible. Only ONE melee slot exists (the last tier).
  private resolveGungameWeaponsLocal(): string[] {
    return buildGunGameWeapons(this.opts.gungamePreset, this.opts.gungameMultiplier);
  }

  // Advance the local player's Gun Game tier after a kill. Updates weaponId,
  // effective stats, sight, and ammo to the next progression weapon. Returns
  // true if the player was already on the final tier (the knife) — meaning
  // this kill wins the match.
  private advanceLocalGungameTier(): boolean {
    const last = this.gungameWeapons.length - 1;
    if (canCompleteGunGame(this.gungameIndex, this.gungameWeapons, this.weaponId)) return true;
    this.gungameIndex = Math.min(last, this.gungameIndex + 1);
    this.weaponId = this.gungameWeapons[this.gungameIndex];
    if (weaponById(this.weaponId).category === "melee") { this.aiming = false; this.adsProgress = 0; }
    const w = weaponById(this.weaponId);
    this.eff = computeEffectiveStats(w, this.getCurrentAttachments());
    this.sightDef = sightDefForType(this.eff.sightType);
    if(isThrowingKnife(this.weaponId))this.throwingKnifeState=fullThrowingKnives();
    this.ammoInMag = isThrowingKnife(this.weaponId)?this.throwingKnifeState.charges:this.eff.magSize;
    this.reloading = false;
    // ---- Play the weapon-swap animation + SFX on tier-up ----
    this.startWeaponSwapVisual();
    this.sound.play("swap", { volume: 0.5 });
    // The outgoing tier holsters before the new model is drawn.
    return false;
  }

  // Advance a (non-self) combatant's Gun Game tier after a kill they earned.
  // Returns true if they were on the final tier (this kill wins for them).
  private advanceCombatantGungameTier(c: Combatant): boolean {
    const last = this.gungameWeapons.length - 1;
    const idx = c.gungameIndex ?? 0;
    if (canCompleteGunGame(idx, this.gungameWeapons, c.weaponId)) return true;
    c.gungameIndex = Math.min(last, idx + 1);
    c.weaponId = this.gungameWeapons[c.gungameIndex];
    if (c.ai) { c.ai.ammoInMag = weaponById(c.weaponId).stats.magSize; c.ai.reloadingUntil = 0; }
    return false;
  }

  private registerPlayerKill() {
    const now = performance.now();
    // Refresh the full five-second grace period with each elimination.
    // Ten kills can span nine successive five-second intervals.
    this.killChain = advanceKillChain(this.killChain, now);
    this.currentNoDeathStreak++;
    this.maxNoDeathStreak = Math.max(this.maxNoDeathStreak, this.currentNoDeathStreak);
    this.recentKills = this.recentKills.filter(t => now - t <= 5000);
    this.recentKills.push(now);
    const streak = this.killChain.count;
    // Track the match-high streak for the new tiered achievements
    // (Triple Threat / Killstreak King / Untouchable Force). Updated every
    // kill so it captures streaks of any length, not just the multikill
    // thresholds below.
    if (streak > this.bestStreak) this.bestStreak = streak;
    const tiers: { threshold: number; label: string; color: string; icon: string }[] = [
      { threshold: 2, label: "DOUBLE KILL", color: "#22c55e", icon: "x2" },
      { threshold: 3, label: "TRIPLE KILL", color: "#06b6d4", icon: "x3" },
      { threshold: 4, label: "OVERKILL", color: "#a855f7", icon: "x4" },
      { threshold: 5, label: "KILLTACULAR", color: "#f59e0b", icon: "x5" },
      { threshold: 6, label: "KILLTASTROPHE", color: "#ef4444", icon: "x6" },
      { threshold: 8, label: "UNSTOPPABLE", color: "#ec4899", icon: "∞" },
    ];
    let callout: typeof tiers[number] | null = null;
    for (const t of tiers) if (streak >= t.threshold) callout = t;
    if (callout) {
      if (streak === 2) this.multikillsCount += 1;
      this.lastKillstreak = { at: now, label: callout.label, color: callout.color, icon: callout.icon };
    }
  }

  // Attribute a kill (and optionally a headshot) to the weapon the local player
  // was holding when the kill was scored. Used by the per-weapon challenge
  // progression (Breacher, Longshot, etc.) — especially in Gun Game, where the
  // player cycles through every weapon in GUN_GAME_PROGRESSION. Called from the
  // offline kill path (applyDamageLocal) and the online "hit" S2C handler.
  private recordPerWeaponKill(weaponId: string, headshot: boolean, victim?: Combatant) {
    const entry = this.perWeaponKills.get(weaponId);
    if (entry) {
      entry.kills += 1;
      if (headshot) entry.headshots += 1;
    } else {
      this.perWeaponKills.set(weaponId, { kills: 1, headshots: headshot ? 1 : 0 });
    }
    // Temporary Reaper kills earn their unique achievement, not regular
    // Armory challenge or permanent weapon mastery progression.
    if(weaponId===ORBITAL_REAPER_ID)return;
    // Applied at elimination, including online kills acknowledged by the server.
    const actions = this.perWeaponActions.get(weaponId) ?? {};
    const bump = (metric: WeaponConditionMetric) => { actions[metric] = (actions[metric] ?? 0) + 1; };
    if (weaponId === this.weaponId) {
      const slots = weaponAttachmentSlots(weaponById(weaponId));
      const atts = this.getCurrentAttachments();
      // Gun Game deliberately does not auto-award no-attachment challenges.
      if (slots.length > 0 && this.opts.mode !== "gungame") {
        if (slots.every(slot => !atts[slot])) bump("bare_kills");
        if (slots.every(slot => !!atts[slot])) bump("fully_equipped_kills");
      }
      if (this.aiming) bump("ads_kills");
      else bump("hipfire_kills");
      if (!this.onGround) bump("airborne_kills");
      if (this.getCurrentAttachments().barrel === "barrel_suppressor") bump("suppressed_kills");
      if (this.health <= 35) bump("critical_health_kills");
      if (performance.now() - this.lastPlayerRespawnAt <= 10000) bump("comeback_kills");
    }
    if (victim) {
      const distance = Math.hypot(victim.pos[0] - this.pos.x, victim.pos[2] - this.pos.z);
      if (distance <= 10) bump("close_range_kills");
      if (distance >= 35) bump("long_range_kills");
    }
    if (this.recentKills.some(t => performance.now() - t < 5000)) bump("multikill_kills");
    this.perWeaponActions.set(weaponId, actions);
    // The P-9 is part of Bulwark: its kills ALSO speed up shield repair.
    if(this.riotShieldReadyAt>0){
      const next=accelerateRiotShield(this.riotShieldHp,this.riotShieldReadyAt,performance.now());
      this.riotShieldHp=next.hp;this.riotShieldReadyAt=next.readyAt;
    }
    if (!weaponById(weaponId).wonder) {
      for (const [id, state] of this.wonderStates) {
        const rules = weaponById(id).wonder;
        if (rules) this.wonderStates.set(id, accelerateWonderCharge(state, rules, performance.now()));
      }
    }
  }

  private scheduleRespawn(c: Combatant) {
    // In survival, dead bots stay dead until the next wave resets them.
    if (this.opts.mode === "survival") return;
    setTimeout(() => {
      if (this.disposed || this.matchEnded) return;
      const movingTarget = this.opts.firingRange
        ? RANGE_MOVING_TARGETS.find(target => c.id === "range_mover_" + target.id) : undefined;
      const sp = movingTarget ? movingRangeTargetPosition(movingTarget, this.rangeTimeSec)
        : this.opts.firingRange ? c.pos : this.pickSpawn(c.team);
      this.offlineAssistDamage.delete(c.id);
      c.pos = sp; c.health = MAX_HEALTH; c.alive = true;
      if(c.ai){c.ai.lastSighting=null;c.ai.lastAlert=null;c.ai.investigationLookAt=null;c.ai.targetId=null;}
      // Round 20h: Bot spawn protection — 2.5s immunity so bots don't get
      // spawn-killed. The shield mesh shows while active.
      c.spawnProtectedUntil = this.opts.firingRange ? 0 : Date.now() + 2500;
      // Clear the death animation so the mesh renders normally after respawn.
      c.deathAnimAt = 0;
      c.deathAnimDur = 0;
      if (c.parts) resetThirdPersonDeathPose(c.parts);
      c.deathPoseStart = undefined;
      if (c.group) {
        c.group.rotation.x = 0;
        c.group.rotation.z = 0;
        // Bug 3 fix: clear the death-anim Y offset (position.y was sunk by ease * 0.4).
        c.group.position.y = c.pos[1];
        // Bug 3 fix: visible immediately on respawn (don't wait for next mesh sync frame).
        c.group.visible = true;
      }
      // Bug 3 fix: name sprite + health bar visible immediately too.
      if (c.nameSprite) c.nameSprite.visible = true;
      if (c.healthBar) c.healthBar.visible = this.showHealthBars;
      if (c.healthBarBg) c.healthBarBg.visible = this.showHealthBars;
    }, this.opts.firingRange ? 900 : RESPAWN_DELAY_MS);
  }

  // --- Kill Confirmed dogtags (server-synced online, simulated offline) ---
  private addKillConfirmedTag(tag: KillConfirmedTag) {
    if (this.kcTags.has(tag.id)) return;
    const group = new THREE.Group();
    const tint = tag.victimTeam === "red" ? 0xff4757 : 0x22d3ee;
    const pendant = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.34),
      new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.92 })
    );
    pendant.rotation.z = Math.PI / 4;
    group.add(pendant);
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.53, 0.035, 5, 20),
      new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.7 })
    );
    halo.rotation.x = Math.PI / 2;
    group.add(halo);
    group.position.set(tag.pos[0], tag.pos[1] + 1, tag.pos[2]);
    this.scene.add(group);
    this.kcTags.set(tag.id, { tag, mesh: group });
  }
  private removeKillConfirmedTag(id: string) {
    const item = this.kcTags.get(id);
    if (!item) return;
    this.scene.remove(item.mesh);
    item.mesh.traverse(obj => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.geometry.dispose();
      const material = obj.material;
      if (Array.isArray(material)) material.forEach(m => m.dispose());
      else material.dispose();
    });
    this.kcTags.delete(id);
  }
  private syncKillConfirmedTags(tags: KillConfirmedTag[]) {
    const ids = new Set(tags.map(t => t.id));
    for (const id of [...this.kcTags.keys()]) if (!ids.has(id)) this.removeKillConfirmedTag(id);
    for (const tag of tags) this.addKillConfirmedTag(tag);
  }
  private dropLocalKillConfirmedTag(victimId: string, victimTeam: string, pos: Vec3) {
    if (this.opts.mode !== "killconfirmed" || (victimTeam !== "red" && victimTeam !== "blue")) return;
    this.addKillConfirmedTag({
      id: "offline-tag-" + (++this.kcNextTagId),
      victimId, victimTeam, pos: [...pos] as Vec3,
      expiresAt: Date.now() + KC_TAG_LIFETIME_MS,
    });
  }
  private animateKillConfirmedTags(now: number) {
    for (const item of this.kcTags.values()) {
      item.mesh.position.y = item.tag.pos[1] + 1 + Math.sin(now * 0.004 + item.tag.pos[0]) * 0.14;
      item.mesh.rotation.y += 0.012;
    }
  }
  private collectOfflineKillConfirmedTags() {
    const now = Date.now();
    for (const [id, item] of this.kcTags) {
      if (now >= item.tag.expiresAt) { this.removeKillConfirmedTag(id); continue; }
      const candidates: { id: string; team: string; pos: Vec3; c?: Combatant }[] = [];
      if (this.alive) candidates.push({ id: this.selfId, team: this.opts.team as string, pos: [this.pos.x, this.pos.y, this.pos.z] });
      for (const c of this.combatants.values()) if (c.alive && c.isBot) candidates.push({ id: c.id, team: c.team, pos: c.pos, c });
      for (const player of candidates) {
        if (player.team !== "red" && player.team !== "blue") continue;
        if (Math.hypot(player.pos[0] - item.tag.pos[0], player.pos[2] - item.tag.pos[2]) > KC_PICKUP_RADIUS) continue;
        if (Math.abs(player.pos[1] - item.tag.pos[1]) > 2.6) continue;
        const action = player.team === item.tag.victimTeam ? "deny" : "confirm";
        this.removeKillConfirmedTag(id);
        if (action === "confirm") {
          if (player.id === this.selfId) this.confirmations++;
        } else if (player.id === this.selfId) this.denials++;
        const earnsPoint = killConfirmedPickupPoints(action, this.denialScoreEnabled) === 1;
        if (earnsPoint) {
          this.teamScores[player.team as "red" | "blue"]++;
          if (player.c) player.c.score++;
        }
        if (player.id === this.selfId) this.tagNotice = { action, at: performance.now() };
        if (earnsPoint) this.checkWin();
        break;
      }
      if (this.matchEnded) return;
    }
  }

  private checkWin() {
    if (this.opts.firingRange || this.matchEnded) return;
    if (this.opts.mode === "survival") return; // endless — game over handled on reinforcement depletion
    if (this.scoreLimit <= 0) return; // time-only match
    // Round 20: Gun Game win condition is handled by advanceLocalGungameTier()
    // (reach the final melee tier + get a kill = win). Do NOT check scoreLimit
    // here — the total kill count can exceed the progression length (due to
    // deaths/respawns or bot kills) without the player reaching the final tier.
    if (this.opts.mode === "gungame") return;
    if (this.scoreLimit <= 0) return; // 0 means no score limit
    if (this.opts.mode === "ffa") {
      if (this.kills >= this.scoreLimit) this.finalizeMatchLocal();
    } else {
      if (this.teamScores.red >= this.scoreLimit || this.teamScores.blue >= this.scoreLimit) this.finalizeMatchLocal();
    }
  }

  // The score is final; continue rendering the decisive action without
  // processing movement, shots, bot AI, pickups or any new scoring.
  private beginMatchFinale(): void {
    this.matchEnded = true;
    this.finaleStartedAt = performance.now();
    this.finaleDeathAges.clear();
    for (const combatant of this.combatants.values()) {
      if (combatant.alive || !combatant.deathAnimAt || !combatant.deathAnimDur) continue;
      const age = this.finaleStartedAt - combatant.deathAnimAt;
      if (age >= 0 && age <= MATCH_FINALE_RECENT_DEATH_MS)
        this.finaleDeathAges.set(combatant.id, age);
    }
    this.mouseDown = false;
    this.touchFiring = false;
    this.burstShotsLeft = 0;
  }

  private deliverMatchEnd(result: MatchEndResult) {
    this.matchFinishingLabel = result.won ? "VICTORY" : "MATCH COMPLETE";
    this.emitHud(performance.now()); // Final standings are available before the results screen.
    this.finaleTimer = setTimeout(() => {
      this.finaleTimer = null;
      if (!this.disposed) this.opts.onMatchEnd(result);
    }, MATCH_FINALE_DURATION_MS);
  }

  private finalizeMatchLocal() {
    if (this.matchEnded) return;
    this.beginMatchFinale();
    const isSurvival = this.opts.mode === "survival";
    const objectiveScore = this.opts.mode === "ctf" ? this.ctfCaptures : this.opts.mode === "killconfirmed" ? this.confirmations + (this.denialScoreEnabled ? this.denials : 0) : this.kills;
    // Build standings. CRITICAL: filter out any combatant whose id matches
    // this.selfId BEFORE adding the self entry — otherwise the player appears
    // twice in the standings (showing up as both 1st and 2nd place in the
    // results screen). This can happen if a bot was mis-seeded with the self id
    // or if the combatants map was populated from an online snapshot that
    // included the local player.
    const others = [...this.combatants.values()].filter((c) => c.id !== this.selfId);
    const standings = [...others, {
      id: this.selfId, name: this.opts.playerName, team: this.opts.team as string,
      kills: this.kills, deaths: this.deaths, score: isSurvival ? this.survivalWave : objectiveScore, isBot: false,
    }].map((c) => ({ id: c.id, name: c.name, team: c.team, kills: c.kills, deaths: c.deaths,
      assists:c.id===this.selfId?this.assists:0,
      score:(c.score ?? c.kills)+(c.id===this.selfId && this.opts.mode!=="ctf" && this.opts.mode!=="killconfirmed"?this.assists:0), isBot: c.isBot }))
      .sort((a, b) => b.score - a.score || b.kills - a.kills);
    const placement = standings.findIndex((s) => s.id === this.selfId) + 1;
    // Win detection: FFA and Gun Game are both free-for-all — the player wins
    // if they're at the top of the standings (or reached the score limit / final
    // gun-game tier). Previously gungame fell through to the team-score branch
    // which is always false for FFA-style modes, so the player could never
    // "win" a Gun Game match (Win Rate stayed 0%).
    const isFfaStyle = this.opts.mode === "ffa" || this.opts.mode === "gungame";
    const ownTeam = this.opts.team as "red" | "blue";
    const otherTeam = ownTeam === "red" ? "blue" : "red";
    const won = isSurvival ? (this.survivalTier==="default" && this.getSurvivalClearedWaves()>=30)
      : this.opts.mode === "killconfirmed" ? this.teamScores[ownTeam] > this.teamScores[otherTeam]
      : isFfaStyle ? (standings[0]?.id === this.selfId)
      : (this.teamScores[this.opts.team as "red" | "blue"] >
         this.teamScores[this.opts.team === "red" ? "blue" : "red"]);
    // End-of-match SFX: victory fanfare or defeat tone.
    this.sound.play(won ? "match_win" : "match_lose", { volume: 0.9 });
    const durationSec = Math.max(0, Math.round((performance.now() - this.matchStartedAt) / 1000));
    this.deliverMatchEnd({
      kills: this.kills, deaths: this.deaths, headshots: this.headshots, assists:this.assists, won, score: isSurvival ? this.survivalWave : objectiveScore, mode: this.opts.mode, standings,
      durationSec, completed: true, placement, multikills: this.multikillsCount, bestStreak: this.bestStreak, maxNoDeathStreak: this.maxNoDeathStreak, defenseKills: this.defenseKills, flagReturns: this.flagReturns, maxScoreDeficit: this.maxScoreDeficit, participants: standings.length, weaponId: this.weaponId,
      killDifficulties: this.killDifficulties.slice(),
      perWeaponKills: Object.fromEntries(this.perWeaponKills),
      perWeaponActions: Object.fromEntries(this.perWeaponActions),
      confirmations: this.confirmations, denials: this.denials,
      ...(isSurvival ? { survivalWaves: this.getSurvivalClearedWaves(), survivalTier: this.survivalTier } as any : {}),
    });
  }

  private finalizeMatch(standings: any, winnerTeam: string | null, teamScores?: { red: number; blue: number }) {
    if (this.matchEnded) return;
    // A score-limit matchEnd may arrive without another periodic snapshot.
    // Apply the server's definitive scores and each player's final K/D first.
    const rows = Array.isArray(standings) ? standings : [];
    this.teamScores = finalTeamScores(rows, teamScores);
    for (const row of rows) {
      const combatant = this.combatants.get(row.id);
      if (combatant) {
        combatant.kills = row.kills;
        combatant.deaths = row.deaths;
        combatant.score = row.score;
      }
      if (row.id === this.selfId) {
        this.kills = row.kills;
        this.deaths = row.deaths;
        if (this.opts.mode === "ctf") this.ctfCaptures = row.score;
      }
    }
    this.beginMatchFinale();
    // Dedupe standings by id — a mis-seeded bot or online snapshot can include
    // the local player twice, which makes them appear in both 1st and 2nd place.
    const seen = new Set<string>();
    const dedup = (Array.isArray(standings) ? standings : []).filter((s: any) => {
      if (!s || typeof s.id !== "string") return false;
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
    standings = dedup;
    const me = standings.find((s: any) => s.id === this.selfId);
    const placement = standings.findIndex((s: any) => s.id === this.selfId) + 1;
    const isSurvival = this.opts.mode === "survival";
    // The final kill ends Standard before a further snapshot can mark waveActive=false.
    if (isSurvival && winnerTeam === "blue") this.survivalWaveActive = false;
    // Gun Game is FFA — winnerTeam may be "ffa" OR the server may report the
    // winner id differently. Treat gungame like ffa: the local player wins if
    // they're at the top of the standings.
    const isFfaStyle = this.opts.mode === "ffa" || this.opts.mode === "gungame";
    const won = isSurvival ? (this.survivalTier==="default" && winnerTeam === "blue")
      : (this.opts.mode === "tdm" || this.opts.mode === "killconfirmed" || this.opts.mode === "ctf") ? winnerTeam === this.opts.team
      : isFfaStyle ? (winnerTeam === "ffa" ? (standings[0]?.id === this.selfId) : (standings[0]?.id === this.selfId))
      : true;
    // End-of-match SFX: victory fanfare or defeat tone.
    this.sound.play(won ? "match_win" : "match_lose", { volume: 0.9 });
    const durationSec = Math.max(0, Math.round((performance.now() - this.matchStartedAt) / 1000));
    this.deliverMatchEnd({
      kills: me?.kills ?? this.kills, deaths: me?.deaths ?? this.deaths, headshots: this.headshots, assists:me?.assists??0, won: !!won,
      score: me?.score ?? (isSurvival ? this.survivalWave : this.opts.mode === "ctf" ? this.ctfCaptures : this.opts.mode === "killconfirmed" ? this.confirmations + (this.denialScoreEnabled ? this.denials : 0) : this.kills), mode: this.opts.mode, standings,
      durationSec, completed: true, placement: placement || 1, multikills: this.multikillsCount, bestStreak: this.bestStreak, maxNoDeathStreak: this.maxNoDeathStreak, defenseKills: this.defenseKills, flagReturns: this.flagReturns, maxScoreDeficit: this.maxScoreDeficit, participants: standings.length, weaponId: this.weaponId,
      killDifficulties: this.killDifficulties.slice(),
      perWeaponKills: Object.fromEntries(this.perWeaponKills),
      perWeaponActions: Object.fromEntries(this.perWeaponActions),
      confirmations: this.confirmations, denials: this.denials,
      ...(isSurvival ? { survivalWaves: this.getSurvivalClearedWaves(), survivalTier: this.survivalTier } as any : {}),
    });
  }

  private applyRecoil() {
    const kick = recoilKickRadians(this.eff.recoil, this.aiming, recoilMultiplier(this.activePerkId));
    this.pitch += kick + (Math.random() - 0.5) * kick * 0.5;
    this.yaw += (Math.random() - 0.5) * kick * 0.6;
    // Kick the viewmodel back + up; decays each frame in the update loop.
    this.vmRecoilZ = Math.min(0.08, this.vmRecoilZ + 0.04 * recoilMultiplier(this.activePerkId));
    this.vmRecoilPitch = Math.min(0.12, this.vmRecoilPitch + 0.05 * recoilMultiplier(this.activePerkId));
  }

  private triggerMuzzleFlash() {
    // The crossbow has no firearm flash. Bulwark's integrated P-9 also hides
    // its first-person flash: the camera-space effect obscures the shield visor.
    // The standalone P-9 keeps its normal flash and all shots still fire.
    if (this.weaponId === "crossbow_reclaimer" || this.weaponId === RIOT_SHIELD_ID) return;
    const suppressed = this.getCurrentAttachments().barrel === "barrel_suppressor";
    (this.muzzleFlash.material as THREE.MeshBasicMaterial).opacity = suppressed ? .14 : 1;
    this.muzzleFlash.scale.setScalar(suppressed ? .65 : 1 + Math.random() * .6);
    this.muzzleFlash.rotation.z = Math.random() * Math.PI;
    this.muzzleLight.intensity = suppressed ? .25 : 3;
    this.muzzleFlashUntil = performance.now() + 60;
  }

  private aimDir(spread: number): Vec3 {
    const cp = Math.cos(this.pitch);
    const dir: Vec3 = [
      Math.sin(this.yaw) * cp + (Math.random() - 0.5) * spread,
      Math.sin(this.pitch) + (Math.random() - 0.5) * spread,
      Math.cos(this.yaw) * cp + (Math.random() - 0.5) * spread,
    ];
    return this.normalize(dir);
  }

  /** Render an actual spinning steel blade on a short trajectory, not a tracer. */
  private spawnThrowingKnifeProjectile(origin:Vec3,dir:Vec3){
    const d=new THREE.Vector3(...dir).normalize(),start=new THREE.Vector3(...origin);
    let distance=THROWING_KNIFE_RANGE;
    for(const cov of this.map.cover){
      const t=rayBox(origin,dir,cov.pos,cov.size);
      if(t!==null&&t>=0&&t<distance)distance=t;
    }
    for(const c of this.combatants.values()){
      if(!c.alive||(this.opts.mode!=="ffa"&&this.opts.mode!=="gungame"&&c.team===this.opts.team))continue;
      const hit=rayCombatantHit(origin,dir,c.pos);
      if(hit&&hit.t>=0&&hit.t<distance)distance=hit.t;
    }
    const group=new THREE.Group();
    const steel=new THREE.MeshStandardMaterial({color:0xd6e2e8,metalness:.85,roughness:.27,side:THREE.DoubleSide});
    const grip=new THREE.MeshStandardMaterial({color:0x222a30,metalness:.2,roughness:.72});
    const blade=new THREE.Mesh(new THREE.ConeGeometry(.045,.29,4),steel);
    blade.rotation.x=-Math.PI/2;blade.position.z=-.14;
    const handle=new THREE.Mesh(new THREE.CylinderGeometry(.025,.024,.19,8),grip);
    handle.rotation.x=Math.PI/2;handle.position.z=.12;
    group.add(blade,handle);
    const rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,-1),d);
    group.quaternion.copy(rotation);group.position.copy(start);
    this.scene.add(group);
    this.thrownKnives.push({mesh:group,start,dir:d,distance,born:performance.now(),
      travelMs:Math.max(90,distance/THROWING_KNIFE_SPEED*1000),rotation});
  }

  private spawnTracer(origin: Vec3, dir: Vec3, skinId: string) {
    const skin = weaponSkinById(skinId);
    let maxT = this.eff.range;
    for (const cov of this.map.cover) {
      const t = rayBox(origin, dir, cov.pos, cov.size);
      if (t !== null && t < maxT) maxT = t;
    }
    const endX = origin[0] + dir[0] * maxT, endY = origin[1] + dir[1] * maxT, endZ = origin[2] + dir[2] * maxT;
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(origin[0] - this.pos.x, origin[1] - (this.pos.y + EYE_HEIGHT), origin[2] - this.pos.z),
      new THREE.Vector3(endX - this.pos.x, endY - (this.pos.y + EYE_HEIGHT), endZ - this.pos.z),
    ]);
    const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(skin.emissive ?? "#ffcc66"), transparent: true, opacity: 0.45 });
    const line = new THREE.Line(geo, mat);
    line.position.set(this.pos.x, this.pos.y + EYE_HEIGHT, this.pos.z);
    this.scene.add(line);
    // Short life + low opacity so tracers are a subtle visual cue, not a screen-obscuring
    // mess. Especially important on the death screen where many tracers can accumulate.
    this.tracers.push({ line, born: performance.now(), life: 45 });
  }

  // Spawn a visible rocket projectile that travels from `origin` along `dir`
  // until it hits a cover box or reaches max range. On impact, spawn an explosion
  // (expanding sphere + light flash). If `applyLocalSplash` is true (offline mode),
  // the explosion also applies SPLASH DAMAGE to all combatants within
  // `splashRadius` — damage falls off linearly from full (at center) to 30% (at edge).
  private spawnRocketProjectile(origin: Vec3, dir: Vec3, _skinId: string, damage: number, applyLocalSplash: boolean, weaponId = this.weaponId) {
    // Normalize the direction vector so the raycast + impact point math is stable.
    // (The caller's dir comes from aimDir(spread) which IS normalized, but defensive
    // normalization prevents any future edge case where a non-unit vector would
    // produce a wrong impact point and miss damage.)
    const dlen = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    const ndir: Vec3 = [dir[0] / dlen, dir[1] / dlen, dir[2] / dlen];
    // Compute the impact point (same raycast as spawnTracer, but also stop at
    // the first combatant so the rocket detonates ON the target, not behind it).
    let maxT = weaponById(weaponId).stats.range;
    for (const cov of this.map.cover) {
      const t = rayBox(origin, ndir, cov.pos, cov.size);
      if (t !== null && t < maxT) maxT = t;
    }
    // Also stop at the first combatant hit.
    for (const c of this.combatants.values()) {
      if (!c.alive || c.id === this.selfId) continue;
      if (this.opts.mode !== "ffa" && this.opts.mode !== "gungame" && c.team === this.opts.team) continue;
      const center: Vec3 = [c.pos[0], c.pos[1] + PLAYER_HEIGHT / 2, c.pos[2]];
      const hit = rayCapsule(origin, ndir, center, PLAYER_RADIUS, PLAYER_HEIGHT);
      if (hit && hit.t >= 0 && hit.t < maxT) maxT = hit.t;
    }
    const isGravity = weaponById(weaponId).wonder?.kind === "singularity";
    if (isGravity) {
      const candidates = [...this.combatants.values()].filter(c => c.alive && c.id !== this.selfId &&
        (this.opts.mode === "ffa" || this.opts.mode === "gungame" || c.team !== this.opts.team))
        .map(c => [c.pos[0], c.pos[1] + PLAYER_HEIGHT / 2, c.pos[2]] as Vec3);
      const targetT = gravityTargetDistance(origin, ndir, candidates, maxT);
      if (targetT !== null) maxT = Math.min(maxT, targetT);
    }
    const safeImpact = isGravity ? gravityImpact(origin, ndir, maxT) : null;
    const endX = safeImpact?.[0] ?? origin[0] + ndir[0] * maxT;
    const endY = safeImpact?.[1] ?? origin[1] + ndir[1] * maxT;
    const endZ = safeImpact?.[2] ?? origin[2] + ndir[2] * maxT;
    // Event Horizon is an unmistakable glowing PURPLE GRAVITY BALL, not a
    // generic missile. Other wonders and rockets keep the classic warhead.
    const rocketGroup = new THREE.Group();
    const wonder = weaponById(weaponId).wonder;
    const isBreach=weaponId==="launcher_breach",isSwarm=weaponId==="launcher_swarm";
    if (wonder?.kind === "singularity") {
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.38, 22, 18),
        new THREE.MeshBasicMaterial({ color: 0x9b57ff }));
      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.58, 20, 16),
        new THREE.MeshBasicMaterial({ color: 0x7138ff, transparent: true, opacity: 0.35, depthWrite: false }));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.055, 8, 40),
        new THREE.MeshBasicMaterial({ color: 0xe0b5ff, transparent: true, opacity: 0.9 }));
      rocketGroup.add(core, halo, ring);
    } else {
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(wonder?.kind==="corrosion" ? 0.095 : isBreach ? 0.125 : 0.075,
        wonder?.kind==="corrosion" ? 0.095 : isBreach ? 0.125 : 0.075,isBreach ? 0.36 : wonder ? 0.34 : 0.24,12),
      new THREE.MeshBasicMaterial({ color: wonder?.kind==="corrosion"?0x547743:isBreach?0xffac33:isSwarm?0x48d6f5:0x888888 }),
    );
    body.rotation.x = Math.PI / 2; // align with -Z (forward)
    rocketGroup.add(body);
    const warhead = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.10, 10),
      new THREE.MeshBasicMaterial({ color: wonder?.kind === "corrosion" ? 0x214e14 : 0x444444 }),
    );
    warhead.rotation.x = -Math.PI / 2; // point forward
    warhead.position.z = -0.16;
    rocketGroup.add(warhead);
    // Glowing trail (small sphere at the back)
    const trail = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshBasicMaterial({ color: wonder?.kind==="corrosion"?0x718b46:isBreach?0xffd966:isSwarm?0x5fffea:0xff6600,transparent:true,opacity:.96 }),
    );
    trail.position.z = 0.14;
    rocketGroup.add(trail);
    if(isBreach||isSwarm){
      // Oversized emissive halo and pulsing light make both small rockets
      // readable against urban masonry and daylight sky.
      const glow=new THREE.Mesh(new THREE.SphereGeometry(isBreach ? 0.25 : 0.17,14,10),
        new THREE.MeshBasicMaterial({color:isBreach?0xffbe42:0x32f6dd,transparent:true,opacity:.41,depthWrite:false}));
      glow.position.z=-.04;rocketGroup.add(glow);
      for(let i=0;i<(isSwarm?4:3);i++){
        const bead=new THREE.Mesh(new THREE.SphereGeometry(isBreach ? 0.05 : 0.035,8,6),
          new THREE.MeshBasicMaterial({color:isBreach?0xffec99:0xa4fff6}));
        bead.position.set(Math.sin(i*Math.PI*.5)*.14,Math.cos(i*Math.PI*.5)*.14,.16+i*.09);
        rocketGroup.add(bead);
      }
    }
    }
    // Orient the rocket group to face the travel direction.
    const start = new THREE.Vector3(origin[0], origin[1], origin[2]);
    const end = new THREE.Vector3(endX, endY, endZ);
    rocketGroup.position.copy(start);
    rocketGroup.lookAt(end);
    this.scene.add(rocketGroup);
    // Travel time scales with distance but caps at 400ms (feels responsive).
    const dist = start.distanceTo(end);
    const travelMs = wonder?.kind === "singularity"
      ? gravityTravelMs(dist) : weaponId==="launcher_breach"
      ? Math.min(700,Math.max(270,dist*9))
      : weaponId==="launcher_swarm" ? Math.min(600,Math.max(170,dist*5.25))
      : Math.min(450,Math.max(140,dist*4));
    // Splash radius: 8 units (roughly 4x player width). Larger than before so
    // near-misses still deal meaningful damage — the rocket's value is area denial.
    const splashRadius = projectileSplashRadius(weaponById(weaponId));
    this.projectiles.push({ mesh: rocketGroup, start, end, born: performance.now(), travelMs, damage, splashRadius, weaponId, applyLocalSplash });
  }

  // Reuse bounded visuals and one permanent light; never vary the scene's light count per blast.
  private spawnExplosion(pos: THREE.Vector3, wonderKind?: "singularity" | "corrosion", radius = GRAVITY_WELL_RADIUS, weaponId = "") {
    const now=performance.now(),listener=this.camera.position;
    const style=wonderKind??(weaponId==="launcher_swarm"?"swarm":"ordinary");
    this.explosionEffects.spawn(pos,style,radius,now,listener);
    if(this.explosionEffects.soundDue(pos,listener,now)){
      const dx=pos.x-listener.x,dz=pos.z-listener.z,horizontal=Math.hypot(dx,dz)||1;
      this.weaponAudio.play("launcher",{weaponId:"launcher_rocket",volume:.95,
        distance:pos.distanceTo(listener),pan:(dx*Math.cos(this.yaw)-dz*Math.sin(this.yaw))/horizontal});
    }
  }

  /** Persistent visual vortex: purple heart, concentric orbiting rings and glow.
   * Online wells are synced from server events and snapshots; offline wells are
   * spawned when our locally simulated projectile reaches its impact.
   */
  private addGravityWell(id: string, ownerId: string, ownerTeam: string, pos: Vec3,
    radius: number, activatesAt: number, expiresAt: number, offline: boolean, serverNow?: number, weaponId = "wonder_singularity") {
    if (!offline && Number.isFinite(serverNow)) {
      const receivedAt=Date.now();
      activatesAt=gravityClientTime(activatesAt,serverNow!,receivedAt);
      expiresAt=gravityClientTime(expiresAt,serverNow!,receivedAt);
    }
    if (this.gravityWells.has(id) || expiresAt < Date.now() || this.disposed) return;
    const mesh = new THREE.Group();
    mesh.position.set(...pos);
    const core = new THREE.Mesh(new THREE.SphereGeometry(1.1, 22, 18),
      new THREE.MeshBasicMaterial({ color: 0x5e1dbb }));
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.68, 20, 16),
      new THREE.MeshBasicMaterial({ color: 0xc57aff }));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(2.4, 20, 16),
      new THREE.MeshBasicMaterial({ color: 0x9a54ff, transparent: true, opacity: 0.19, depthWrite: false }));
    const orbit = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.10, 10, 70),
      new THREE.MeshBasicMaterial({ color: 0xb983ff, transparent: true, opacity: 0.67 }));
    // The translucent spherical shell is the EXACT 3D pull/damage radius;
    // a small decorative orbit remains inside it, not outside the hit range.
    const boundary = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 20),
      new THREE.MeshBasicMaterial({ color: 0x955dff, transparent: true, opacity: 0.19, depthWrite: false, wireframe: true }));
    const fieldGlow = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x8f48ff, transparent: true, opacity: 0.065, depthWrite: false, side: THREE.BackSide }));
    mesh.add(core, inner, halo, orbit, boundary, fieldGlow);
    mesh.visible = false;
    const light = new THREE.PointLight(0x8844ff, 8, radius * 1.6);
    light.position.set(...pos);
    light.visible = false;
    this.scene.add(mesh, light);
    this.gravityWells.set(id, { pos, ownerId, ownerTeam, weaponId, radius, activatesAt, expiresAt, offline, mesh, light });
  }

  private removeGravityWell(id: string) {
    const well = this.gravityWells.get(id);
    if (!well) return;
    this.scene.remove(well.mesh, well.light);
    well.mesh.traverse(child => { if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      for (const mat of Array.isArray(child.material) ? child.material : [child.material]) mat.dispose();
    } });
    well.light.dispose();
    this.gravityWells.delete(id);
  }

  private tickGravityWells(dt: number) {
    const now = Date.now();
    for (const [id, well] of this.gravityWells) {
      if (now < well.activatesAt) continue;
      if (now >= well.expiresAt) {
        if (well.offline && !this.matchEnded) {
          this.spawnExplosion(new THREE.Vector3(...well.pos), "singularity", well.radius);
          for (const enemy of this.combatants.values()) {
            if (!enemy.alive || enemy.id === well.ownerId ||
                (this.opts.mode !== "ffa" && this.opts.mode !== "gungame" && enemy.team === well.ownerTeam)) continue;
            const distance = Math.hypot(enemy.pos[0] - well.pos[0],
              enemy.pos[1] + PLAYER_HEIGHT / 2 - well.pos[1], enemy.pos[2] - well.pos[2]);
            const damage = gravityBlastDamage(distance, well.radius, weaponById(well.weaponId).stats.damage);
            if (damage && this.hasLineOfSight(well.pos,
              [enemy.pos[0], enemy.pos[1] + PLAYER_HEIGHT / 2, enemy.pos[2]])) {
              this.applyDamageLocal(enemy, damage, false, well.weaponId);
            }
          }
          this.hitMarkerAt = performance.now();
        }
        // Online wells are removed by the authoritative gravityDetonate message,
        // or the snapshot fallback below if a detonation packet was missed.
        if (well.offline || now > well.expiresAt + 1200) this.removeGravityWell(id);
        continue;
      }
      well.mesh.visible = true;
      well.light.visible = true;
      const phase = now * 0.003;
      const [core, inner, halo, orbit, boundary] = well.mesh.children;
      core.scale.setScalar(0.9 + Math.sin(phase * 3) * 0.14);
      inner.scale.setScalar(0.82 + Math.sin(phase * 4) * 0.22);
      halo.scale.setScalar(0.95 + Math.sin(phase * 2) * 0.18);
      orbit.rotation.z += dt * 2.2;
      orbit.rotation.y += dt;
      boundary.rotation.y += dt * 0.23;
      well.light.intensity = 4.6 + Math.sin(phase * 5) * 1.2;
      if (!well.offline || this.matchEnded) continue;
      for (const enemy of this.combatants.values()) {
        if (!enemy.alive || !enemy.isBot || enemy.id === well.ownerId ||
            (this.opts.mode !== "ffa" && this.opts.mode !== "gungame" && enemy.team === well.ownerTeam)) continue;
        const [dx, dz] = gravityPullOffset(well.pos, enemy.pos, well.radius, dt);
        if (!dx && !dz) continue;
        if (!this.hasLineOfSight(well.pos, [enemy.pos[0], enemy.pos[1] + 1, enemy.pos[2]])) continue;
        const dest: Vec3 = [enemy.pos[0] + dx, enemy.pos[1], enemy.pos[2] + dz];
        if (!blocksBotMotion(this.map.cover, enemy.pos, dest, enemy.pos[1])) enemy.pos = dest;
      }
    }
  }

  private startReload() {
    if (this.equipmentAction) return;
    if (usesWonderCharges(weaponById(this.weaponId))) return;
    const special = weaponById(this.weaponId).special;
    if (special?.kind === "heat") {
      const heat = this.heatStates.get(this.weaponId)?.heat ?? 0;
      if (this.reloading || !this.alive || heat <= 0) return;
      if (this.sprinting && this.activePerkId !== "field_loader") return;
      this.reloading = true;
      this.reloadStartedAt = performance.now();
      this.reloadDurationMs = (effectiveHeatConfig(weaponById(this.weaponId),this.getCurrentAttachments()) ?? special).ventSeconds * 1000 * reloadDurationMultiplier(this.activePerkId);
      this.reloadEndsAt = this.reloadStartedAt + this.reloadDurationMs;
      this.sound.play("reload", { volume: 0.55 });
      this.socket?.emit("message", { t: "reload" });
      return;
    }
    if (this.weaponId==="crossbow_reclaimer" &&
        this.getCurrentAttachments().magazine==="mag_bolt_heavy") return; // scavenged heavy arrows only
    if (this.reloading || this.ammoInMag >= this.eff.magSize || !this.alive ||
        !canStartWeaponReload(weaponById(this.weaponId).stats, this.ammoInMag)) return;
    if (this.sprinting && this.activePerkId !== "field_loader") return;
    // Melee weapons don't reload.
    if (weaponById(this.weaponId).category === "melee") return;
    this.reloading = true;
    this.reloadRoundInserted = false;
    const currentWeapon = weaponById(this.weaponId);
    // Shotguns and bolt-action rifles load one round at a time. Attachment
    // reload modifiers are applied to each shell/round, not the whole magazine.
    let duration = currentWeapon.stats.reloadStyle === "incremental"
      ? (currentWeapon.stats.reloadPerRound ?? this.eff.reloadTime / this.eff.magSize) *
        this.eff.reloadTime / Math.max(0.01, currentWeapon.stats.reloadTime)
      : this.eff.reloadTime;
    if (special?.kind === "bolt" && this.boltCharges > 0) {
      this.boltCharges--;
      duration = special.quickReloadSeconds;
    }
    this.reloadStartedAt = performance.now();
    this.reloadDurationMs = duration * 1000 * reloadDurationMultiplier(this.activePerkId);
    this.reloadEndsAt = this.reloadStartedAt + this.reloadDurationMs;
    this.sound.play("reload", { volume: 0.55 });
    this.socket?.emit("message", { t: "reload" });
  }

  // ---- Loop ----
  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    this.timer.update();
    const dt = Math.min(0.05, this.timer.getDelta());
    const frameStart=performance.now();
    this.update(dt);
    if(this.cityInteriorDetailGroups.length)this.updateCityDetailVisibility(performance.now());
    this.renderer.render(this.scene, this.camera);
    this.updateCityRenderBudget(frameStart,dt*1000);
  };

  private update(dt: number) {
    // Cinematic finish: keep recently killed operatives visible but never
    // simulate another combat tick or change match results after the verdict.
    if (this.matchEnded) {
      const now = performance.now();
      this.updateCombatantMeshes(dt * MATCH_FINALE_PLAYBACK_RATE, now);
      this.explosionEffects?.update(
        this.finaleStartedAt + (now - this.finaleStartedAt) * MATCH_FINALE_PLAYBACK_RATE,
        this.camera.position,
      );
      this.camera.position.set(this.pos.x, this.pos.y + EYE_HEIGHT, this.pos.z);
      this.camera.rotation.set(this.pitch, this.yaw + Math.PI, 0, "YXZ");
      if (now - this.lastHudAt > 80) {
        this.lastHudAt = now;
        this.emitHud(now);
      }
      return;
    }
    this.tickDeathBombs();
    this.tickBulletSpitters();
    if (this.opts.mode === "killconfirmed") this.animateKillConfirmedTags(performance.now());
    if (this.opts.mode === "ctf") this.updateCtfFlagsVisuals();
    this.animateOrbitalReactor(performance.now());
    this.tickOrbitalPickup();
    // ---- Lobby state: suppress all gameplay while the room is in the lobby
    // phase. The GameCanvas renders a Lobby overlay on top; we still render the
    // 3D scene underneath but don't process input, run AI, or count down the timer.
    if (this.lobbyActive) {
      // Keep the camera positioned at the player's spawn so the scene is visible
      // behind the overlay, but don't advance any gameplay state.
      this.camera.position.set(this.pos.x, this.pos.y + EYE_HEIGHT, this.pos.z);
      this.camera.rotation.set(this.pitch, this.yaw + Math.PI, 0, "YXZ");
      this.positionViewmodel();
      // Still emit HUD so the overlay can read scoreboard/health if needed.
      const now = performance.now();
      if (now - this.lastHudAt > 200) {
        this.lastHudAt = now;
        this.emitHud(now);
      }
      return;
    }
    // ---- Pre-match countdown: freeze gameplay for a few seconds so the player
    // can orient themselves before bots start shooting. We still render the 3D
    // scene at the player's spawn and update the viewmodel, but we do NOT
    // process input, run bot AI, tick the match timer, or allow firing. The
    // HUD renders a big centered countdown number from `preMatchCountdown`.
    // When it hits 0, a "GO!" SFX plays and normal gameplay resumes.
    if (this.preMatchCountdown > 0) {
      const second=Math.ceil(this.preMatchCountdown);
      if(second!==this.lastCountdownSecond){this.lastCountdownSecond=second;this.sound.play("countdown_tick",{volume:.8});}
      this.preMatchCountdown -= dt;
      // Keep the camera at spawn so the player can look around (mouse-look is
      // still active via the pointer-lock handler, but movement keys are
      // suppressed because updateMovement isn't called).
      this.camera.position.set(this.pos.x, this.pos.y + EYE_HEIGHT, this.pos.z);
      // Only allow yaw/pitch from the mouse — no movement, no firing.
      this.camera.rotation.set(this.pitch, this.yaw + Math.PI, 0, "YXZ");
      this.positionViewmodel();
      const now = performance.now();
      if (now - this.lastHudAt > 100) {
        this.lastHudAt = now;
        this.emitHud(now);
      }
      // When the countdown finishes, play a "go" sound and snap the match
      // start timestamp so durationSec doesn't include the freeze.
      if (this.preMatchCountdown <= 0) {
        this.preMatchCountdown = 0;
        this.matchStartedAt = performance.now();
        if (!this.opts.online) {
          this.selfSpawnProtectedUntil = Date.now() + 2500;
          for (const c of this.combatants.values()) if (c.alive && this.opts.mode !== "survival") c.spawnProtectedUntil = Date.now() + 2500;
        }
        this.sound.play("match_start", { volume: 0.8 });
      }
      return;
    }
    // Count game time locally in *every* mode, including online Survival,
    // Gun Game and user-configured unlimited-time matches. Reconcile upward
    // with authoritative snapshots instead of letting stale zeroes freeze it.
    this.elapsedSeconds = advanceMatchElapsed(this.elapsedSeconds, dt, !this.matchEnded);
    if (!this.matchEnded && !this.opts.firingRange) this.trackScoreDeficit();
    if (!this.opts.firingRange && !this.matchEnded && !this.opts.online && this.opts.mode !== "survival") {
      // Round 20: Only tick the timer if there IS a time limit (timeLeft > 0).
      // timeLeft = 0 means "no limit" — the match runs until the kill target
      // is reached. Previously, a 0 timeLimit caused the match to end instantly
      // because `0 - dt <= 0` was always true.
      if (this.timeLeft > 0 && this.opts.mode !== "gungame") {
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          if (this.opts.mode === "ctf" && this.teamScores.red === this.teamScores.blue)
            this.ctfOvertime = true;
          else this.finalizeMatchLocal();
        }
      }
    }
    if (!this.matchEnded) {
      this.tickOfflineMines(performance.now());
      this.pulseMineBeacons(performance.now());
    }
    if (!this.matchEnded) this.updateEnvironment(dt);
    if (this.opts.firingRange && !this.matchEnded) this.tickFiringRangeTargets(dt);
    this.tickGravityWells(dt);
    // Thrown ordnance keeps its authoritative schedule while its owner is dead.
    this.tickClusterVolleys();
    this.explosionEffects?.update(performance.now(),this.camera.position);
    // ---- Dead player: freeze camera + suppress all input/animation ----
    // When the local player is dead (waiting for respawn), we lock the camera
    // at the death position and suppress movement, firing, and viewmodel
    // animations. The player can still look around (mouse-look) but cannot
    // move, shoot, or play weapon animations. This prevents the jarring
    // effect of the gun continuing to sway/recoil while the player is dead.
    if (!this.alive && !this.matchEnded) {
      this.updateRiotModels(); // hide the local panel and continue remote stance updates
      // Keep the camera at the death position (don't follow movement — there is none).
      this.camera.position.set(this.pos.x, this.pos.y + EYE_HEIGHT, this.pos.z);
      this.camera.rotation.set(this.pitch, this.yaw + Math.PI, 0, "YXZ");
      // Hide the viewmodel — dead players don't hold a gun up.
      for (const p of this.vmParts) p.obj.visible = false;
      if (this.fpActionHand) this.fpActionHand.visible = false;
      if (this.fpActionProp) this.fpActionProp.visible = false;
      this.equipmentAction = null;
      // Clear all active tracers + rocket projectiles so the death screen isn't
      // cluttered with lingering bullet lines (which previously stayed visible
      // for their full life and obscured the death camera).
      for (const t of this.tracers) {
        this.scene.remove(t.line);
        (t.line.geometry as THREE.BufferGeometry).dispose();
        (t.line.material as THREE.Material).dispose();
      }
      this.tracers = [];
      for (const p of this.projectiles) {
        this.scene.remove(p.mesh);
        p.mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose();
            const m = child.material;
            if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
            else m?.dispose();
          }
        });
      }
      this.projectiles = [];
      // Still tick respawns (offline) + emit HUD so the respawn countdown shows.
      const now = performance.now();
      if (!this.opts.online && this.respawnAt === 0) {
        this.respawnAt = now + (this.opts.mode === "survival" ? SURVIVAL_RESPAWN_MS : RESPAWN_DELAY_MS);
      }
      if (!this.opts.online && this.respawnAt && now >= this.respawnAt) {
        this.respawnSelf();
      }
      if (now - this.lastHudAt > 100) {
        this.lastHudAt = now;
        this.emitHud(now);
      }
      if (!this.opts.online && this.opts.mode === "killconfirmed") this.collectOfflineKillConfirmedTags();
      // Still update combatant meshes so death animations play for OTHER players.
      this.updateCombatantMeshes(dt, now);
      return;
    }
    // Survival wave management (offline)
    if (!this.opts.online && this.opts.mode === "survival" && !this.matchEnded) {
      this.updateSurvival(dt);
    }
    // Health regen: recover HP after a few seconds out of combat. This prevents the
    // "one bad engagement = dead" feel and lets players reset between fights.
    if (!this.opts.online && this.alive && this.health < MAX_HEALTH && !this.matchEnded) {
      const since = performance.now() - this.lastDamageAt;
      if (since > regenDelayMs(this.activePerkId)) {
        this.health = Math.min(MAX_HEALTH, this.health + FPSEngine.REGEN_RATE * dt);
      }
    }
    // A fatal hit interrupts any uncommitted deploy without consuming charges.
    if (!this.alive) this.equipmentAction = null;
    this.updateEquipmentAction(performance.now());
    this.updateEquipmentPreview();
    this.updateSpecialResources(dt, performance.now());
    if (this.turretDeployPending && performance.now() - this.turretDeployRequestedAt > 3000) {
      // No authoritative placement arrived (e.g. dropped packet / disconnect).
      // The charge stays available; a subsequent press may retry.
      this.turretDeployPending = false;
      this.turretDeployFailedAt = performance.now();
    }
    this.shotBloom = Math.max(0, this.shotBloom - dt * 0.52);
    if (this.reloading && weaponById(this.weaponId).stats.reloadStyle === "incremental") {
      // Credit each shell at the actual insertion frame, not at the end of
      // the recovery animation. This updates both HUD ammo and the saved slot
      // before the player can interrupt the ongoing reload.
      const step = advanceIncrementalReload(
        this.ammoInMag, this.eff.magSize, this.reloadRoundInserted,
        this.reloadStartedAt, this.reloadDurationMs, performance.now(),
      );
      if (step.ammo !== this.ammoInMag) {
        this.ammoInMag = step.ammo;
        this.saveAmmoToSlot(this.currentSlot);
        this.sound.play("reload", { volume: 0.23 });
      }
      this.reloadRoundInserted = step.inserted;
      if (step.magazineFull) {
        this.reloading = false;
      } else if (step.cycleComplete) {
        this.reloadStartedAt = performance.now();
        this.reloadEndsAt = this.reloadStartedAt + this.reloadDurationMs;
        this.reloadRoundInserted = false;
      }
    } else if (this.reloading && performance.now() >= this.reloadEndsAt) {
      this.reloading = false;
      if (weaponById(this.weaponId).special?.kind === "heat") this.heatStates.set(this.weaponId, freshHeat());
      else this.ammoInMag = this.eff.magSize;
      this.saveAmmoToSlot(this.currentSlot);
    }
    // A new trigger press interrupts an incremental reload as soon as there is
    // ammo to fire. Already-inserted shells remain available after a swap.
    if (this.reloading && weaponById(this.weaponId).stats.reloadStyle === "incremental" &&
        this.ammoInMag > 0 && (this.mousePressedThisFrame || this.touchPressedThisFrame)) {
      this.reloading = false;
    }
    const wantFire = !this.inputSuspended && ((this.mouseDown && this.pointerLocked) || (this.touchMode && this.touchFiring));
    const inputActive = !this.inputSuspended && (this.pointerLocked || this.touchMode);
    // Effective aim: manually held ADS (RMB / ADS button) OR auto-ADS-while-firing.
    const allowSprintAds = allowsAdsWhileSprinting(this.getCurrentAttachments().grip);
    const wantsAds = this.manualAiming || (this.weaponId!==RIOT_SHIELD_ID && this.autoAdsOnFire && wantFire && this.alive);
    // Shift / mobile auto-sprint takes priority: ADS cannot silently cancel sprint.
    this.aiming = !this.equipmentAction && !this.reloading && wantsAds && (!this.sprinting || allowSprintAds);
    if (!this.equipmentAction && (wantFire || this.burstShotsLeft > 0)) {
      const w = weaponById(this.weaponId);
      const now = performance.now();
      // Semi-auto and burst weapons used to skip fireOneShot at zero ammo.
      if(wantFire && (this.mousePressedThisFrame || this.touchPressedThisFrame) &&
         this.ammoInMag<=0 && !this.reloading && !usesWonderCharges(w) &&
         w.category!=="melee" && w.special?.kind!=="heat"){
        this.sound.play("empty_click",{volume:.36});
        this.startReload();
      }
      // ---- Burst-fire in progress: continue the burst even after trigger release ----
      if (this.burstShotsLeft > 0 && now >= this.burstNextAt && this.ammoInMag > 0) {
        this.fireOneShot(w);
        this.burstShotsLeft -= 1;
        if (this.burstShotsLeft > 0) {
          // Shared burst cadence is faster than inter-burst recovery, but DMRs
          // deliberately space precision shots further apart.
          this.burstNextAt = now + burstShotIntervalMs(this.eff.fireRate, w.category);
        } else {
          // Burst complete — enforce a longer inter-burst delay (the weapon's stated fireRate).
          this.burstEndsAt = now + 1000 / Math.max(1, this.eff.fireRate);
        }
      }
      // ---- Decide whether to START a new shot / burst ----
      else if (now >= this.burstEndsAt) {
        const isAuto = this.eff.auto;
        const isBurst = (w.stats.burst ?? 1) > 1;
        const isSemi = !isAuto && !isBurst;
        if (isAuto) {
          // Full-auto: fire continuously while trigger is held, gated by fireRate.
          if (now - this.lastShotAt > 1000 / Math.max(1, this.eff.fireRate) * 0.9) {
            this.fireOneShot(w);
          }
        } else if (isBurst) {
          // Burst-fire: only fire on the press edge (trigger pull), not while held.
          if ((this.mousePressedThisFrame || this.touchPressedThisFrame) && this.ammoInMag > 0) {
            this.burstShotsLeft = Math.min(w.stats.burst ?? 1, this.ammoInMag);
            this.burstNextAt = now;
            this.burstEndsAt = Infinity;  // locked until burst completes
          }
        } else if (isSemi) {
          // Semi-auto (P-9, sniper, DMR, launcher): fires ONCE per trigger pull.
          if ((this.mousePressedThisFrame || this.touchPressedThisFrame) && this.ammoInMag > 0
              && now - this.lastShotAt > 1000 / Math.max(1, this.eff.fireRate) * 0.9) {
            this.fireOneShot(w);
          }
        }
      }
      // Clear the press-edge flags after they've been consumed this frame.
      this.mousePressedThisFrame = false;
      this.touchPressedThisFrame = false;
    } else {
      // Trigger released — clear press-edge flags too so they don't queue a shot on next press.
      this.mousePressedThisFrame = false;
      this.touchPressedThisFrame = false;
    }
    if (this.alive && inputActive && !this.survivalDowned) this.updateMovement(dt);
    this.interactEnvironment();

    // ADS smoothing
    const targetAds = this.aiming ? 1 : 0;
    this.adsProgress += (targetAds - this.adsProgress) * Math.min(1, dt * 12);
    // The optical zoom field determines actual magnification across all player FOV settings.
    // 1x sights retain their familiar ADS framing; HUD renders the matching scope overlay.
    this.camera.fov = this.weaponId===RIOT_SHIELD_ID?this.baseFov:adsFieldOfView(this.baseFov, this.sightDef, this.adsProgress);
    this.camera.updateProjectionMatrix();
    this.positionViewmodel();
    // Update the laser indicator (visible only when a laser sight is equipped)
    this.updateLaserIndicator();
    // Thermal/NVG: brighten the scene lights while ADS with NVG; thermal uses a HUD overlay only.
    if (this.hemiLight && this.dirLight) {
      const isNvgAds = this.aiming && this.sightDef.overlay === "nvg";
      const targetHemi = isNvgAds ? 2.4 : 0.9 * this.map.theme.ambient;
      const targetDir = isNvgAds ? 2.6 : 1.4;
      this.hemiLight.intensity += (targetHemi - this.hemiLight.intensity) * Math.min(1, dt * 8);
      this.dirLight.intensity += (targetDir - this.dirLight.intensity) * Math.min(1, dt * 8);
    }

    if (performance.now() > this.muzzleFlashUntil) {
      (this.muzzleFlash.material as THREE.MeshBasicMaterial).opacity *= 0.6;
      this.muzzleLight.intensity *= 0.6;
    }
    // Decay viewmodel recoil each frame.
    this.vmRecoilZ *= 0.82;
    this.vmRecoilPitch *= 0.82;

    const now = performance.now();
    this.tracers = this.tracers.filter((t) => {
      const age = now - t.born;
      if (age > t.life) { this.scene.remove(t.line); (t.line.geometry as THREE.BufferGeometry).dispose(); (t.line.material as THREE.Material).dispose(); return false; }
      (t.line.material as THREE.LineBasicMaterial).opacity = 0.45 * (1 - age / t.life);
      return true;
    });

    // ---- Update rocket projectiles: animate from start to end, spawn explosion on arrival ----
    this.projectiles = this.projectiles.filter((p) => {
      const age = now - p.born;
      if (age >= p.travelMs) {
        // Projectile reached the impact point — spawn explosion + remove.
        const rawExplosionKind = weaponById(p.weaponId).wonder?.kind;
        const explosionKind = rawExplosionKind === "singularity" || rawExplosionKind === "corrosion" ? rawExplosionKind : undefined;
        if (explosionKind === "singularity") {
          if (p.applyLocalSplash) {
            const at = Date.now();
            this.addGravityWell(`offline_gravity_${at}_${Math.random()}`, this.selfId, this.opts.team,
              [p.end.x, p.end.y, p.end.z], p.splashRadius,
              at, at + GRAVITY_WELL_DURATION_MS, true, undefined, p.weaponId);
          }
        } else {
          this.spawnExplosion(p.end, explosionKind, p.splashRadius,p.weaponId);
        }
        // Apply SPLASH DAMAGE to all combatants within radius (offline only —
        // online damage is applied authoritatively by the server).
        //
        // CRITICAL FIX: The splash damage is computed against the rocket's FULL
        // TRAJECTORY LINE SEGMENT (start → end), NOT just the impact point. This
        // means a near-miss (rocket flies PAST an enemy and hits a far wall) still
        // deals splash damage based on the closest approach distance. Previously,
        // only enemies within `splashRadius` of the IMPACT point took damage — so
        // a rocket that narrowly missed an enemy but hit a wall 20m behind them
        // dealt ZERO damage. Now the closest point on the trajectory line is used,
        // so near-misses deal partial damage (the rocket's value is area denial).
        // The local player is NOT hit by their own rocket (no self-damage).
        if (p.applyLocalSplash && explosionKind !== "singularity") {
          // Trajectory segment: p.start → p.end (both THREE.Vector3 in world space).
          const segDx = p.end.x - p.start.x;
          const segDy = p.end.y - p.start.y;
          const segDz = p.end.z - p.start.z;
          const segLenSq = segDx * segDx + segDy * segDy + segDz * segDz || 1e-9;
          for (const c of this.combatants.values()) {
            if (!c.alive) continue;
            if (this.opts.mode !== "ffa" && this.opts.mode !== "gungame" && c.team === this.opts.team) continue;
            const cx = c.pos[0], cy = c.pos[1] + PLAYER_HEIGHT / 2, cz = c.pos[2];
            // Project the combatant's center onto the trajectory segment.
            // t = clamp(dot(AP, AB) / dot(AB, AB), 0, 1) gives the closest point.
            const apx = cx - p.start.x, apy = cy - p.start.y, apz = cz - p.start.z;
            let t = (apx * segDx + apy * segDy + apz * segDz) / segLenSq;
            t = Math.max(0, Math.min(1, t));
            const closestX = p.start.x + segDx * t;
            const closestY = p.start.y + segDy * t;
            const closestZ = p.start.z + segDz * t;
            const corrosion = weaponById(p.weaponId).wonder?.kind === "corrosion";
            // Plagueheart poisons an area around the actual impact only.
            // Rockets alone retain proximity damage along their flight path.
            const d = corrosion
              ? corrosionImpactDistance([p.end.x,p.end.y,p.end.z],[cx,cy,cz])
              : Math.hypot(cx-closestX,cy-closestY,cz-closestZ);
            if (d <= p.splashRadius) {
              // Quadratic falloff: 100% damage at center (d=0), ~30% at half-radius,
              // ~10% at edge. This rewards direct hits much more than near-misses,
              // making the rocket feel powerful when it connects but not OP when it whiffs.
              // Plus a direct-hit bonus: if the combatant is within 1.5 units of the
              // closest point, apply full damage + 20% bonus (guaranteed kill on 100HP).
              const falloff = launcherSplashFactor(p.weaponId,d,p.splashRadius);
              const splashDmg = corrosion ? corrosionImpactDamage(p.damage, falloff) : p.damage * falloff;
              this.applyDamageLocal(c, splashDmg, false, p.weaponId);
              if (corrosion && c.alive) {
                // Repeated hits refresh the poison, never stack instant rocket damage.
                this.poisonByVictim.set(c.id, { expiresAt: now + CORROSION_DURATION_MS,
                  tickAt: now + CORROSION_TICK_MS, weaponId: p.weaponId,
                  damagePerTick: corrosionTickDamage(p.damage) });
              }
            }
          }
          this.hitMarkerAt = performance.now();
        }
        this.scene.remove(p.mesh);
        // Dispose geometry/materials.
        p.mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose();
            const m = child.material;
            if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
            else m?.dispose();
          }
        });
        return false;
      }
      const t = age / p.travelMs;
      p.mesh.position.lerpVectors(p.start, p.end, t);
      if (weaponById(p.weaponId).wonder?.kind === "singularity") p.mesh.rotation.z += dt * 5;
      return true;
    });

    // combatants mesh sync + humanoid animation
    this.updateCombatantMeshes(dt, now);

    if (!this.opts.online && !this.matchEnded) {
      for (const c of this.combatants.values()) {
        if (!this.opts.firingRange && c.isBot && c.alive && c.ai) this.updateBotAI(c, dt, now);
      }
    }
    this.updateRemoteFootsteps(now);

    if (!this.opts.online && this.opts.mode === "killconfirmed" && !this.matchEnded) {
      this.collectOfflineKillConfirmedTags();
    }
    if (!this.opts.online && !this.matchEnded)this.tickOrbitalPickup();
    if (!this.opts.online && this.opts.mode === "ctf" && !this.matchEnded) this.tickOfflineCtf();
    if (this.opts.online && this.socket?.connected && this.alive) {
      this.socket.emit("message", {
        t: "state", pos: [this.pos.x, this.pos.y, this.pos.z] as Vec3, yaw: this.yaw, pitch: this.pitch,
        aiming: this.aiming, firing: this.mouseDown, reloading: this.reloading, alive: this.alive, sprinting: this.sprinting,
      });
    }

    if (!this.alive && this.respawnAt === 0 && !this.opts.online) {
      this.respawnAt = now + RESPAWN_DELAY_MS;
    }
    if (!this.alive && this.respawnAt && now >= this.respawnAt && !this.opts.online) {
      this.respawnSelf();
    }

    // Physics remains exact; ease only the first-person camera across stair risers.
    if(this.cameraFeetY===null||Math.abs(this.cameraFeetY-this.pos.y)>3)this.cameraFeetY=this.pos.y;
    else this.cameraFeetY+=(this.pos.y-this.cameraFeetY)*Math.min(1,dt*11);
    this.camera.position.set(this.pos.x,this.cameraFeetY+EYE_HEIGHT,this.pos.z);
    // The game's yaw convention: forward = (sin yaw, 0, cos yaw) [see aimDir / updateMovement fwd].
    // Three.js camera local -Z is forward, so camera.rotation "YXZ" with yaw θ makes the
    // camera look toward (-sin θ, 0, -cos θ) — the OPPOSITE of our convention.
    // Adding π to the camera yaw aligns the camera forward with the game forward,
    // so pressing W moves toward where the player is looking and bullets fire forward.
    this.camera.rotation.set(this.pitch, this.yaw + Math.PI, 0, "YXZ");
    // Viewmodel parts are direct children of the camera; positionViewmodel (called above)
    // sets their camera-local positions. The camera's matrixWorld is updated by the renderer.

    if (now - this.lastHudAt > 80) {
      this.lastHudAt = now;
      this.emitHud(now);
    }
  }

  // Sync all combatant meshes (position, rotation, death animation, occlusion
  // culling, humanoid animation). Extracted from the main update loop so the
  // dead-player branch can call it independently (to keep rendering other
  // players' death animations while the local player is dead).
  /** Generate opponent footfalls from observed world-space movement.
   * Works for offline bots and online snapshots. Perks are server-synchronized,
   * so Silent Steps players make no footfall sound to OTHER listeners either.
   */
  private updateRemoteFootsteps(now: number) {
    if (!this.alive || this.matchEnded) return;
    for (const c of this.combatants.values()) {
      if (c.isSelf || c.id === this.selfId || !c.alive) {
        this.remoteFootsteps.delete(c.id);
        continue;
      }
      const prev = this.remoteFootsteps.get(c.id);
      if (!prev || c.perkId === "silent_steps") {
        this.remoteFootsteps.set(c.id, { pos: [...c.pos], at: now });
        continue;
      }
      const distanceMoved = Math.hypot(c.pos[0] - prev.pos[0], c.pos[2] - prev.pos[2]);
      const elapsed = now - prev.at;
      if (distanceMoved < 0.9 && elapsed < 900) continue;
      // Large jumps are respawns / lag correction, not audible steps.
      if (distanceMoved > 10 || Math.abs(c.pos[1] - prev.pos[1]) > 0.55 || distanceMoved < 0.9) {
        this.remoteFootsteps.set(c.id, { pos: [...c.pos], at: now });
        continue;
      }
      const sprinting = distanceMoved / Math.max(0.1, elapsed / 1000) > 7.1;
      if (elapsed < (sprinting ? 245 : 335)) continue;
      this.remoteFootsteps.set(c.id, { pos: [...c.pos], at: now });
      const listenerDistance = Math.hypot(c.pos[0] - this.pos.x, c.pos[1] - this.pos.y, c.pos[2] - this.pos.z);
      const age=this.map.id==="floodgate"&&this.floodgateBreachAt!==null
        ?this.environmentTime-this.floodgateBreachAt:null;
      const wet=floodgateWaterEffect(c.pos[0],c.pos[1],c.pos[2],age,this.map.cover).flooded;
      this.sound.playFootstepAtDistance(listenerDistance,sprinting,wet);
    }
    for (const id of this.remoteFootsteps.keys()) {
      if (!this.combatants.has(id)) this.remoteFootsteps.delete(id);
    }
  }

  private updatePoisonVisual(id: string, pos: Vec3, status: "poison" | "burn" | null, now: number) {
    let fx = this.poisonBubbles.get(id);
    // One pool of procedural effects; when the damage type changes, replace
    // its geometry so acid green never disguises orange flame damage.
    if (fx && status && fx.userData.status !== status) {
      this.updatePoisonVisual(id,pos,null,now);
      fx = undefined;
    }
    if (!status) {
      if (fx) {
        this.scene.remove(fx);
        const geometries = new Set<THREE.BufferGeometry>();
        const materials = new Set<THREE.Material>();
        fx.traverse(obj => { if (obj instanceof THREE.Mesh) {
          geometries.add(obj.geometry);
          for (const mat of Array.isArray(obj.material) ? obj.material : [obj.material]) materials.add(mat);
        } });
        geometries.forEach(geo => geo.dispose());
        materials.forEach(mat => mat.dispose());
        this.poisonBubbles.delete(id);
      }
      return;
    }
    if (!fx) {
      fx = new THREE.Group();
      fx.userData.status = status;
      const burning=status==="burn";
      const aura = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 10),
        new THREE.MeshBasicMaterial({ color: burning?0xff4715:0x49ff68,
          transparent: true, opacity: burning?.21:.16, depthWrite: false }));
      aura.position.y = 0.98;
      fx.add(aura);
      const geo = burning ? new THREE.ConeGeometry(.065,.21,6) : new THREE.SphereGeometry(0.105, 8, 6);
      const mat = new THREE.MeshBasicMaterial({ color: burning?0xffad2d:0x80ff61,
        transparent: true, opacity: burning?.9:.78, depthWrite: false });
      for (let i = 0; i < 9; i++) {
        const bubble = new THREE.Mesh(geo, mat);
        bubble.userData.poisonBubble = i;
        fx.add(bubble);
      }
      this.scene.add(fx);
      this.poisonBubbles.set(id, fx);
    }
    fx.position.set(...pos);
    let index = 0;
    for (const child of fx.children) {
      if (index++ === 0) {
        child.scale.setScalar(1 + Math.sin(now * 0.006) * 0.09);
        continue;
      }
      const i = index - 2;
      const burning=status==="burn";
      const t = (now * (burning?0.0013:0.00055) + i * 0.173) % 1;
      const angle = i * 2.39996 + now * 0.0008;
      child.position.set(Math.cos(angle) * (0.35 + i % 3 * 0.14), 0.18 + t * 1.7,
        Math.sin(angle) * (0.35 + i % 3 * 0.14));
      child.scale.setScalar((burning?.42:.6) + .6 * (1 - t));
    }
  }

  private updateCombatantMeshes(dt: number, now: number) {
    // Round 20j: Thermal vision — when ADS with a thermal scope, make enemy
    // combatants emit a bright amber glow so they're visible through walls
    // (like a real thermal scope). Also brighten the scene for NVG.
    const isThermalAds = this.aiming && this.adsProgress > 0.3 && this.sightDef.overlay === "thermal";
    const isNvgAds = this.aiming && this.adsProgress > 0.3 && this.sightDef.overlay === "nvg";
    for (const id of this.poisonBubbles.keys()) {
      if (!this.combatants.has(id)) this.updatePoisonVisual(id, [0, 0, 0], null, now);
    }
    for (const c of this.combatants.values()) {
      const poisoned = c.alive && ((this.onlinePoisoned.get(c.id) ?? 0) > Date.now()
        || (this.poisonByVictim.get(c.id)?.expiresAt ?? 0) > now);
      const burning = c.alive && ((this.onlineBurning.get(c.id) ?? 0) > Date.now()
        || (this.localBurning.get(c.id) ?? 0) > now);
      this.updatePoisonVisual(c.id, c.pos, burning ? "burn" : poisoned ? "poison" : null, now);
      if (!c.group) continue;
      // Thermal vision: override body material emissive for living enemies.
      if (c.skinMaterial && c.alive) {
        const isEnemy = c.team !== this.opts.team || this.opts.mode === "ffa" || this.opts.mode === "gungame";
        if (burning) {
          c.skinMaterial.emissive.setHex(0xff4b12);
          c.skinMaterial.emissiveIntensity = 1.1;
        } else if (poisoned) {
          c.skinMaterial.emissive.setHex(0x30ff56);
          c.skinMaterial.emissiveIntensity = 1.05;
        } else if (this.opts.mode === "ctf" && (this.ctfFlags.red.carrierId === c.id || this.ctfFlags.blue.carrierId === c.id)) {
          // Normal depth-tested material: hidden carriers never glow through cover.
          c.skinMaterial.emissive.setHex(0xffe56a);
          c.skinMaterial.emissiveIntensity = 1.0;
        } else if (isThermalAds && isEnemy && !c.isSelf) {
          // Bright amber emissive — "thermal signature"
          c.skinMaterial.emissive.setHex(0xff6600);
          c.skinMaterial.emissiveIntensity = 1.2;
        } else if (isNvgAds && isEnemy && !c.isSelf) {
          // Green tint for NVG
          c.skinMaterial.emissive.setHex(0x33ff66);
          c.skinMaterial.emissiveIntensity = 0.4;
        } else {
          // Reset to original skin emissive
          const skin = playerSkinById(c.playerSkinId);
          c.skinMaterial.emissive.set(skin.emissive ? skin.emissive : "#000000");
          c.skinMaterial.emissiveIntensity = skin.emissive ? 0.4 : 0;
        }
      }
      // Thermal ADS reveals exposed heat signatures through weather, not through
      // physical cover. The ordinary body shader is still obscured by snow fog.
      if (c.bossVisual && c.alive) {
        const timer=this.survivalBossTimers.get(c.id);
        const charge=c.bossCharge ?? (timer?bossShockwaveCharge(timer.nextSkillAt,now):0);
        updateSurvivalBossArmor(c.bossVisual,c.weaponId,charge,now);
      }
      const thermalVisible=isThermalAds&&c.alive&&!c.isSelf&&
        (this.opts.mode==="ffa"||this.opts.mode==="gungame"||c.team!==this.opts.team)&&
        Math.hypot(c.pos[0]-this.pos.x,c.pos[2]-this.pos.z)<165&&
        this.hasLineOfSight([this.pos.x,this.pos.y+EYE_HEIGHT,this.pos.z],
          [c.pos[0],c.pos[1]+1.1,c.pos[2]]);
      for(const overlay of c.thermalOverlays??[])overlay.visible=thermalVisible;
      c.group.position.set(c.pos[0], c.pos[1], c.pos[2]);
      c.group.rotation.y = c.yaw;
      // ---- Death animation: fall forward over ~900ms before hiding ----
      if (!c.alive && c.deathAnimAt && c.deathAnimDur) {
        const ageAtFinale = this.finaleDeathAges.get(c.id);
        const p = this.matchEnded && ageAtFinale !== undefined
          ? finaleDeathProgress(ageAtFinale, c.deathAnimDur, now - this.finaleStartedAt)
          : Math.min(1, (now - c.deathAnimAt) / c.deathAnimDur);
        if (p >= 1) {
          c.group.visible = false;
          if (c.nameSprite) c.nameSprite.visible = false;
          if (c.healthBar) c.healthBar.visible = false;
          if (c.healthBarBg) c.healthBarBg.visible = false;
          if (c.friendlyMarker) c.friendlyMarker.visible = false;
          if (c.shieldMesh) c.shieldMesh.visible = false;
        } else {
          c.group.visible = true;
          // IK is only updated while alive. Without a death-specific arm
          // pose, the left support hand remains extended at the weapon grip
          // throughout lava/fire/spike deaths and ordinary combat deaths.
          if (c.parts) {
            c.deathPoseStart ??= captureThirdPersonDeathPose(c.parts);
            applyThirdPersonDeathPose(c.parts, c.deathPoseStart, p);
          }
          const ease = 1 - Math.pow(1 - p, 3);
          c.group.rotation.x = ease * (Math.PI / 2);
          c.group.position.y = c.pos[1] - ease * 0.4;
          c.group.rotation.z = Math.sin(p * Math.PI) * 0.15;
          if (c.nameSprite) c.nameSprite.visible = false;
          if (c.healthBar) c.healthBar.visible = false;
          if (c.healthBarBg) c.healthBarBg.visible = false;
          if (c.friendlyMarker) c.friendlyMarker.visible = false;
          if (c.shieldMesh) c.shieldMesh.visible = false;
        }
      } else if (!c.alive) {
        c.group.visible = false;
        if (c.nameSprite) c.nameSprite.visible = false;
        if (c.healthBar) c.healthBar.visible = false;
          if (c.healthBarBg) c.healthBarBg.visible = false;
        if (c.friendlyMarker) c.friendlyMarker.visible = false;
        if (c.shieldMesh) c.shieldMesh.visible = false;
      } else {
        // Server respawns and offline respawns both reset the entire rig.
        // Otherwise the weapon can reappear at the fallen position for a frame.
        if (c.deathPoseStart) {
          if (c.parts) resetThirdPersonDeathPose(c.parts);
          c.deathPoseStart = undefined;
        }
        c.group.rotation.x = 0;
        c.group.rotation.z = 0;
        c.group.visible = true;
        if (c.nameSprite) c.nameSprite.visible = true;
        if (c.healthBarBg) c.healthBarBg.visible = this.showHealthBars;
        if (c.healthBar) {
          c.healthBar.visible = this.showHealthBars;
          const pct = Math.max(0, Math.min(1,c.health / (c.bossMaxHealth ?? MAX_HEALTH)));
          (c.healthBar as THREE.Mesh).scale.x = pct;
          (c.healthBar as THREE.Mesh).position.x = -0.45 * (1 - pct);
          (c.healthBar.material as THREE.MeshBasicMaterial).color.setHex(pct > 0.5 ? 0x33dd66 : pct > 0.25 ? 0xffaa33 : 0xff3333);
        }
        // Three.js depth testing already occludes the actual hidden pixels.
        // Never hide the WHOLE humanoid because a single chest ray touches cover:
        // a visible head/leg should stay visible while peeking around a wall.
        // The old ray-to-chest check made bots seem to vanish inside walls.

      }
      // ---- Friendly marker (TDM): show a floating green diamond above teammates.
      // Always visible (even through walls) so the player can locate their team.
      // Hidden for: self, enemies, dead players, and non-TDM modes.
      if (c.friendlyMarker) {
        const isFriendly = (this.opts.mode === "tdm" || this.opts.mode === "killconfirmed" || this.opts.mode === "ctf")
          && c.team === this.opts.team
          && c.id !== this.selfId
          && c.alive;
        c.friendlyMarker.visible = isFriendly;
        if (isFriendly) {
          // Gentle spin + vertical bob so the marker is eye-catching but not distracting.
          c.friendlyMarker.rotation.y += dt * 2;
          c.friendlyMarker.position.y = PLAYER_HEIGHT + 0.9 + Math.sin(now * 0.003) * 0.08;
        }
      }
      // ---- Round 19e: Spawn protection shield visibility ----
      if (c.shieldMesh) {
        const isProtected = c.spawnProtectedUntil && c.spawnProtectedUntil > Date.now() && c.alive;
        c.shieldMesh.visible = !!isProtected;
        if (isProtected) {
          // Pulse the opacity + scale for a "shield" effect.
          const pulse = 0.30 + Math.sin(now * 0.008) * 0.07;
          (c.shieldMesh.material as THREE.MeshBasicMaterial).opacity = pulse;
          const s = 1 + Math.sin(now * 0.006) * 0.05;
          c.shieldMesh.scale.setScalar(s);
        }
      }
      // animate humanoid (only when alive — death animation overrides)
      if (c.alive) this.animateHumanoid(c, dt, now);
    }
  }

  // Animate humanoid legs/arms based on movement. When the combatant is moving
  // horizontally, swing legs in opposition. When firing, kick arms back.
  private animateHumanoid(c: Combatant, dt: number, now: number) {
    if (!c.parts) return;
    const p = c.parts;
    // Detect motion by comparing position delta — we don't store prev pos per combatant,
    // so use a simple heuristic: bots always animate when alive (they're usually moving),
    // and the player animates only via the local engine (not rendered as a humanoid).
    // For online snapshots, we can detect motion by checking if pos changed since last frame.
    // Simpler: use the combatant's walkPhase and advance it when alive.
    const moving = c.alive;
    if (moving) {
      c.walkPhase = (c.walkPhase ?? 0) + dt * 8;
    } else {
      c.walkPhase = 0;
    }
    const swing = Math.sin(c.walkPhase ?? 0) * 0.5;
    const swing2 = Math.sin((c.walkPhase ?? 0) + Math.PI) * 0.5;
    p.upperLegL.rotation.x = swing;
    p.upperLegR.rotation.x = swing2;
    // Knee bends slightly when leg swings forward
    p.lowerLegL.rotation.x = Math.max(0, -swing * 0.6);
    p.lowerLegR.rotation.x = Math.max(0, -swing2 * 0.6);
    // Gun recoil is applied to the weapon first. Then solve BOTH arms against
    // the transformed grips so hands stay attached while firing and aiming.
    const recoilAge = c.lastFireRecoil ? now - c.lastFireRecoil : 9999;
    const recoil = recoilAge < 100 ? (1 - recoilAge / 100) * 0.15 : 0;
    p.weaponStub.traverse(obj=>{if(obj.name==="weapon_charm")swingWeaponCharm(obj,now);});
    p.weaponStub.position.copy(p.weaponBase);
    p.weaponStub.position.z -= recoil * 0.5;
    p.weaponStub.position.y += Math.sin(c.walkPhase ?? 0) * 0.006;
    // Third-person aim pitch is the same sign as the existing head pitch.
    p.weaponStub.rotation.x = c.pitch * 0.35 - recoil * 0.3;

    if(c.weaponId===RIOT_SHIELD_ID&&c.riotShieldRaised&&(c.riotShieldHp??RIOT_SHIELD_HP)>0){p.weaponStub.position.y-=.42;p.weaponStub.rotation.x+=.85;}
    const rightGrip = p.weaponHoldRight.clone()
      .applyQuaternion(p.weaponStub.quaternion).add(p.weaponStub.position);
    const leftGrip = p.weaponHoldLeft.clone()
      .applyQuaternion(p.weaponStub.quaternion).add(p.weaponStub.position);
    if(c.weaponId===RIOT_SHIELD_ID&&(c.riotShieldHp??RIOT_SHIELD_HP)>0){const panel=shieldPanel(!!c.riotShieldRaised);leftGrip.set(-panel.right+.12,.95,panel.forward-.07);}
    poseBotArm(p.upperArmR, p.lowerArmR, rightGrip, -1);
    poseBotArm(p.upperArmL, p.lowerArmL, leftGrip, 1);
    // Head tracks pitch (look up/down with aim)
    p.head.rotation.x = c.pitch * 0.7;
    // Torso also slightly pitches
    p.torso.rotation.x = c.pitch * 0.3;
  }

  private updateMovement(dt: number) {
    if (performance.now() < this.equipmentStunUntil) return;
    // Maintain mobile sprint hysteresis so small joystick fluctuations do not
    // repeatedly cancel sprint. The touch overlay uses the same shared rule.
    const touchAutoSprint = this.touchMode && shouldTouchAutoSprint(
      Math.hypot(this.touchMoveX, this.touchMoveY),
      -this.touchMoveY,
      this.touchAutoSprintActive,
    );
    this.touchAutoSprintActive = touchAutoSprint;
    const isSprintKey = this.keys["ShiftLeft"] || this.keys["ShiftRight"] || this.touchSprint || touchAutoSprint;
    // Sprint only when moving forward AND not ADS AND weapon allows it (melee always sprints).
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    // right = forward × up (right-handed) — this is the player's actual right side,
    // matching the camera after the +π yaw fix. Previously this was (fwd.z, 0, -fwd.x),
    // which after the camera fix pointed LEFT (inverted strafe on desktop + mobile).
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const move = new THREE.Vector3();
    let forwardAmt = 0;
    if (this.touchMode) {
      // On-screen joystick: touchMoveY = -1 means forward
      move.addScaledVector(fwd, -this.touchMoveY);
      move.addScaledVector(right, this.touchMoveX);
      forwardAmt = -this.touchMoveY;
    } else {
      if (this.keys["KeyW"]) { move.add(fwd); forwardAmt += 1; }
      if (this.keys["KeyS"]) { move.sub(fwd); forwardAmt -= 1; }
      if (this.keys["KeyD"]) move.add(right);
      if (this.keys["KeyA"]) move.sub(right);
    }
    const movingForward = forwardAmt > 0.3;
    // Sprint engaged: shift held + moving forward + not ADS + not firing + alive.
    // Can't sprint with a sniper/sniper-equivalent out at full ADS — must release.
    // ALSO gated on stamina: can't start a sprint with 0 stamina; must regen above
    // STAMINA_RESUME first (prevents stutter-sprint at the empty threshold).
    const reaperMovement=this.orbitalWeaponActive&&orbitalReaperEquipped(this.map,this.weaponId);
    const staminaAllowsSprint = this.stamina > FPSEngine.STAMINA_RESUME || (this.sprinting && this.stamina > 0);
    const wasSprinting = this.sprinting;
    const sprintAdsPerk = allowsAdsWhileSprinting(this.getCurrentAttachments().grip);
    this.sprinting = isSprintKey && movingForward && (!this.aiming || sprintAdsPerk) && !this.mouseDown && this.alive && this.onGround && staminaAllowsSprint;
    if (this.sprinting && this.reloading && this.activePerkId !== "field_loader") {
      this.reloading = false; // interrupted; keep partial mag
    }
    if (this.sprinting && !sprintAdsPerk) this.aiming = false;
    if (this.sprinting && !wasSprinting) {
      // Just started sprinting — play a subtle ADS-out SFX for feedback.
      this.sound.play("ads_out", { volume: 0.3 });
    }
    // ---- Stamina drain / regen ----
    if (this.sprinting) {
      this.stamina = Math.max(0, this.stamina - FPSEngine.STAMINA_DRAIN * sprintDrainMultiplier(this.activePerkId) *
        (reaperMovement?ORBITAL_REAPER_STAMINA_DRAIN_MULTIPLIER:1) * dt);
      this.lastSprintAt = performance.now();
      if (this.stamina <= 0) {
        // Exhausted — force-stop the sprint (will resume only after regen above threshold).
        this.sprinting = false;
      }
    } else {
      const sinceSprint = performance.now() - this.lastSprintAt;
      if (sinceSprint > FPSEngine.STAMINA_DELAY) {
        this.stamina = Math.min(100, this.stamina + FPSEngine.STAMINA_REGEN * dt);
      }
    }
    // Speed multipliers.
    let speedMul = 1.0;
    if (this.sprinting && this.aiming) speedMul = MOVEMENT.sprintAdsMultiplier;
    else if (this.aiming) speedMul = 0.55;
    else if (this.sprinting) speedMul = MOVEMENT.sprintMultiplier;  // was 1.6 — higher sprint speed for better map traversal
    // Momentum is intentionally preserved in the air; ground stopping and
    // direction changes are tuned independently below.
    if (this.activePerkId === "lightweight") speedMul *= 1.12;
    const carryingFlag=this.opts.mode==="ctf" && (this.ctfFlags.red.carrierId===this.selfId||this.ctfFlags.blue.carrierId===this.selfId);
    if(reaperMovement&&!carryingFlag)speedMul*=ORBITAL_REAPER_SPEED_MULTIPLIER;
    if(carryingFlag)speedMul*=CTF_SPEED_MULTIPLIER;
    const water=floodgateWaterEffect(this.pos.x,this.pos.y,this.pos.z,
      this.map.id==="floodgate"&&this.floodgateBreachAt!==null
        ?this.environmentTime-this.floodgateBreachAt:null,this.map.cover);
    const baseSpeed = MOVEMENT.walk * ctfCarrierWeaponSpeed(this.eff.moveSpeed,carryingFlag) * speedMul * sludgeMovementFactor([this.pos.x,this.pos.y,this.pos.z],this.opts.team,Date.now(),[...this.wonderFields.values()],this.opts.mode==="ffa"||this.opts.mode==="gungame") * water.speedMultiplier;
    // Footstep SFX: every ~320ms while running on ground. Louder/faster when sprinting.
    if (this.onGround && move.lengthSq() > 0.1) {
      const stepInterval = this.sprinting ? 260 : 360;
      if (performance.now() - this.lastFootstepAt > stepInterval) {
        this.lastFootstepAt = performance.now();
        if (this.activePerkId !== "silent_steps") {
          this.sound.play(water.flooded?"water_footstep":"footstep", { volume: water.flooded?(this.sprinting?.98:.84):(this.sprinting?.43:.3) });
          if(!this.opts.online&&!this.opts.firingRange)
            this.publishBotNoise({sourceId:this.selfId,pos:[this.pos.x,this.pos.y,this.pos.z],
              at:performance.now(),kind:"footstep",sprinting:this.sprinting});
        }
      }
    }
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(baseSpeed);
    // Exponential response is stable across variable frame times. Separate
    // acceleration, braking, reversal, and aerial steering behavior.
    [this.vel.x, this.vel.z] = responsiveHorizontalVelocity(
      this.vel.x, this.vel.z, move.x, move.z, this.onGround, dt,
    );

    // Press-edge jump with landing buffer + ledge grace. Holding Space cannot
    // repeatedly bunny-hop; tap once shortly before landing or after a ledge.
    const now = performance.now();
    const jumpHeld = !!this.keys["Space"];
    if ((jumpHeld && !this.wasJumpHeld) || (this.touchMode && this.touchJumpQueued)) {
      this.lastJumpPressedAt = now;
    }
    this.wasJumpHeld = jumpHeld;
    this.touchJumpQueued = false;
    if (this.onGround) this.lastGroundedAt = now;
    const wantJump = canUseBufferedJump(
      now, this.lastJumpPressedAt, this.lastGroundedAt, this.onGround,
    );
    if (wantJump) {
      this.lastJumpPressedAt = -Infinity;
      this.lastGroundedAt = -Infinity;
      this.vel.y = MOVEMENT.jumpVelocity * (this.activePerkId === "lightweight" ? 1.08 : 1);
      this.onGround = false;
      // Running takeoffs carry additional horizontal momentum, whether the
      // player is sprinting or moving at ordinary running speed.
      [this.vel.x, this.vel.z] = runJumpTakeoffVelocity(
        this.vel.x, this.vel.z, move.x, move.z, this.sprinting,
        reaperMovement?ORBITAL_REAPER_JUMP_MOMENTUM_MULTIPLIER:1,
      );
      if (this.activePerkId !== "silent_steps") this.sound.play(water.flooded?"water_footstep":"footstep", { volume: water.flooded?.9:.4 });
    }
    // Gravity: slightly stronger so jumps don't feel floaty.
    this.vel.y -= MOVEMENT.gravity * orbitalGravity(this.map,
      reaperMovement?this.weaponId:undefined) * dt;

    const next = this.pos.clone();
    next.x += this.vel.x * dt;
    next.z += this.vel.z * dt + water.pushZ * dt;
    next.y += this.vel.y * dt;
    // Gravity wells drag the local human player as well as bots. This remains
    // inside the normal collision resolution, so no pulling through walls.
    for (const well of this.gravityWells.values()) {
      const nowMs = Date.now();
      if (!this.alive || nowMs < well.activatesAt || nowMs >= well.expiresAt ||
          well.ownerId === this.selfId ||
          (this.opts.mode !== "ffa" && this.opts.mode !== "gungame" && well.ownerTeam === this.opts.team)) continue;
      if (!this.hasLineOfSight(well.pos, [this.pos.x, this.pos.y + 1, this.pos.z])) continue;
      const [dx, dz] = gravityPullOffset(well.pos, [this.pos.x, this.pos.y, this.pos.z], well.radius, dt);
      next.x += dx;
      next.z += dz;
    }
    const desiredHorizontalX = next.x, desiredHorizontalZ = next.z;

    // ---- Horizontal collision against cover (with step-up for short boxes) ----
    const r = PLAYER_RADIUS;
    const nearbyCover = this.coverAlong([this.pos.x,0,this.pos.z],[next.x,0,next.z],3);
    // Stop rising into the underside of a floor before resolving side contact.
    if (next.y > this.pos.y) {
      for (const cov of nearbyCover) {
        if (cov.kind === "accent") continue;
        const underside = cov.pos[1] - cov.size[1];
        if (this.pos.y + PLAYER_HEIGHT > underside || next.y + PLAYER_HEIGHT <= underside) continue;
        if (Math.abs(next.x - cov.pos[0]) >= cov.size[0] + r ||
            Math.abs(next.z - cov.pos[2]) >= cov.size[2] + r) continue;
        next.y = underside - PLAYER_HEIGHT - 0.001;
        this.vel.y = 0;
      }
    }
    for (const cov of nearbyCover) {
      const cx = cov.pos[0], cz = cov.pos[2];
      const hx = cov.size[0], hz = cov.size[2];
      const minY = cov.pos[1] - cov.size[1], maxY = cov.pos[1] + cov.size[1];
      // If player can step onto this box (top is within step reach), don't block horizontally
      if (maxY - next.y < BOT_STEP_HEIGHT && maxY > next.y) continue;
      // Skip if player is above the box top (standing on it) or below the box bottom
      if (next.y >= maxY - 0.05) continue;
      if (next.y + PLAYER_HEIGHT < minY) continue;
      if (Math.abs(next.x - cx) < hx + r && Math.abs(next.z - cz) < hz + r) {
        const overlapX = hx + r - Math.abs(next.x - cx);
        const overlapZ = hz + r - Math.abs(next.z - cz);
        if (overlapX < overlapZ) next.x = cx + Math.sign(next.x - cx) * (hx + r);
        else next.z = cz + Math.sign(next.z - cz) * (hz + r);
      }
    }
    // arena bounds
    const lim = this.map.size - 1;
    next.x = Math.max(-lim, Math.min(lim, next.x));
    next.z = Math.max(-lim, Math.min(lim, next.z));
    // Don't keep accumulating velocity into a wall; removes wall-hugging
    // jitter and makes direction changes immediately responsive.
    if (Math.abs(next.x - desiredHorizontalX) > 0.001) this.vel.x = 0;
    if (Math.abs(next.z - desiredHorizontalZ) > 0.001) this.vel.z = 0;

    // ---- Vertical collision: stand on top of platforms/stairs ----
    const groundY = groundHeightAt(this.coverNear(next.x,next.z,2.5), next.x, next.z, next.y, r);
    if (next.y <= groundY) {
      next.y = groundY;
      this.vel.y = 0;
      this.onGround = true;
    } else if (next.y > 0) {
      // falling or jumping — check if still above ground
      this.onGround = false;
    }
    // also keep arena floor as minimum
    if (next.y < 0) { next.y = 0; this.vel.y = 0; this.onGround = true; }
    this.pos.copy(next);

    // ---- Dynamic spread factor (drives HUD crosshair size) ----
    // 0 = perfectly accurate (still + ADS). 1 = max bloom (sprinting + jumping + firing).
    let spread = 0;
    if (this.sprinting) spread += 0.85;
    else if (!this.onGround) spread += 0.5;
    else if (this.vel.lengthSq() > 4) spread += 0.3;  // moving fast
    if (this.mouseDown || this.touchFiring) spread += 0.15;
    if (this.aiming) spread *= 0.3;  // ADS tightens everything
    this.currentSpread = Math.min(1, spread + this.shotBloom * (this.aiming ? 0.22 : 0.45));
    // Advance the sprint-sway phase so the viewmodel bobs left/right while sprinting.
    if (this.sprinting) {
      this.sprintPhase += dt * 11;
    } else {
      this.sprintPhase *= 0.9;  // decay back to neutral when not sprinting
    }
  }

  // ---- Bot AI (offline) ----
  // Bots use the same ground-height logic as the player so they can climb
  // stairs/ramps and reach elevated positions on vertical maps.
  private updateBotAI(c: Combatant, dt: number, now: number) {
    const ai = c.ai!;
    this.hearBotNoise(c,now);
    const floodAge=this.map.id==="floodgate"&&this.floodgateBreachAt!==null
      ?this.environmentTime-this.floodgateBreachAt:null;
    const boss=this.survivalBossTimers.get(c.id);
    if (boss) {
      if(now>=boss.nextPhaseAt) {
        boss.phase=(boss.phase+1)%3;
        const nextWeapon=["lmg_hv","shotgun_auto","rifle_heavy"][boss.phase];
        if (c.weaponId !== nextWeapon) {
          c.weaponId=nextWeapon;
          // Offline does not receive network snapshots: rebuild the held gun
          // so each phase is visually distinguishable, just like online.
          this.rebuildCombatantMesh(c);
        }
        ai.ammoInMag=weaponById(c.weaponId).stats.magSize;
        ai.burstShotsLeft=0; ai.burstEndsAt=0;
        boss.nextPhaseAt=now+5500;
      }
      if(now>=boss.nextSkillAt) {
        boss.nextSkillAt=now+12500;
        const d=Math.hypot(this.pos.x-c.pos[0],this.pos.z-c.pos[2]);
        if(this.alive && d<11) this.takeDamage(Math.round(28*(1-d/15)),c.name,c.team,false,c.weaponId);
      }
    }
    const w = weaponById(c.weaponId);
    const eff = computeEffectiveStats(w, this.opts.mode === "gungame" ? this.getCurrentAttachments() : ai.attachments);
    // Fix any pre-existing penetration before movement, including bad legacy spawns.
    c.pos = this.clamp(this.collideBots(c.pos, c.pos[1]));
    const rival=this.nearestEnemy(c);
    const hostiles=[...this.bulletSpitters.entries()].filter(([,t])=>t.offline &&
      t.ownerId!==c.id && turretCanAttack(this.opts.mode,c.team,this.opts.team as string,false) &&
      Math.hypot(c.pos[0]-t.pos[0],c.pos[2]-t.pos[2])<25 &&
      this.hasLineOfSight([c.pos[0],c.pos[1]+1.45,c.pos[2]],[t.pos[0],t.pos[1]+TURRET_MUZZLE_HEIGHT,t.pos[2]]))
      .sort((a,b)=>Math.hypot(a[1].pos[0]-c.pos[0],a[1].pos[2]-c.pos[2])-
        Math.hypot(b[1].pos[0]-c.pos[0],b[1].pos[2]-c.pos[2]));
    if(hostiles.length && (!rival || Math.hypot(rival.pos[0]-c.pos[0],rival.pos[2]-c.pos[2])>17) &&
      now>=ai.nextShotAt && now>ai.reloadingUntil && ai.ammoInMag>0){
      const [id,t]=hostiles[0],origin:Vec3=[c.pos[0],c.pos[1]+1.45,c.pos[2]];
      const diff:Vec3=[t.pos[0]-origin[0],t.pos[1]+TURRET_MUZZLE_HEIGHT-origin[1],t.pos[2]-origin[2]];
      const len=Math.hypot(...diff)||1;
      t.hp-=Math.max(5,eff.damage*.55);ai.ammoInMag--;ai.lastFiredAt=now;
      ai.nextShotAt=now+1000/Math.max(.5,eff.fireRate);
      this.spawnTracer(origin,[diff[0]/len,diff[1]/len,diff[2]/len],"default");
      if(t.hp<=0)this.removeBulletSpitter(id);
    }
    if (now > ai.nextDecisionAt) {
      ai.nextDecisionAt = now + botDecisionDelay(ai.difficulty, Math.random());
      const enemy = this.nearestEnemy(c);
      if(enemy)ai.lastSighting=botRememberSighting(enemy.id,enemy.pos,now);
      const remembered=ai.lastSighting;
      const rememberedEnemy=remembered
        ? remembered.targetId===this.selfId
          ? {alive:this.alive,team:this.opts.team}
          : this.combatants.get(remembered.targetId)
        : null;
      const alert=ai.lastAlert;
      const alertSource=alert?.sourceId===this.selfId
        ? {alive:this.alive,team:this.opts.team}
        : alert?this.combatants.get(alert.sourceId):null;
      const audioInvestigation=!enemy?botAlertInvestigation(alert,c.pos,now,ai.difficulty,
        ai.archetype,!!alertSource?.alive &&
        (this.opts.mode==="ffa"||this.opts.mode==="gungame"||alertSource.team!==c.team)):null;
      if(alert&&!audioInvestigation&&!enemy)ai.lastAlert=null;
      if(enemy)ai.lastAlert=null;
      const investigation=!enemy ? botInvestigation(remembered,c.pos,now,
        ai.difficulty,ai.archetype,!!rememberedEnemy?.alive &&
        (this.opts.mode==="ffa"||this.opts.mode==="gungame"||rememberedEnemy.team!==c.team),
        c.id) : null;
      if(remembered&&!investigation&&!enemy)ai.lastSighting=null;
      // Collect/deny nearby Kill Confirmed tags when immediate combat doesn't
      // demand attention. Bots actively pursue tags even if enemies are visible.
      const nearestTag = this.opts.mode === "killconfirmed"
        ? [...this.kcTags.values()].map(item => item.tag)
            .filter(tag => tag.expiresAt > Date.now())
            .sort((a, b) => Math.hypot(a.pos[0] - c.pos[0], a.pos[2] - c.pos[2]) -
              Math.hypot(b.pos[0] - c.pos[0], b.pos[2] - c.pos[2]))[0]
        : undefined;
      const tagDistance = nearestTag ? Math.hypot(nearestTag.pos[0] - c.pos[0], nearestTag.pos[2] - c.pos[2]) : Infinity;
      const threatDistance = enemy ? Math.hypot(enemy.pos[0] - c.pos[0], enemy.pos[2] - c.pos[2]) : Infinity;
      const pursueTag = !!nearestTag && tagDistance < 20 && threatDistance > 12;
      const roster=[...this.combatants.values()].filter(b=>!!b.ai).map(b=>({
        id:b.id,team:b.team,pos:b.pos,alive:b.alive,
        carryingFlag:this.ctfFlags.red.carrierId===b.id||this.ctfFlags.blue.carrierId===b.id,
        hasReward:this.orbitalBotHolders.has(b.id),
      }));
      const orbitalObjective=orbitalBotShouldContest(this.map,this.orbitalCharge,
        roster.find(b=>b.id===c.id)!,roster,threatDistance)
        ?orbitalBotDeckGoal(c.pos,c.team,this.map):null;
      const ctfIntent = !orbitalObjective && this.opts.mode === "ctf" && (c.team === "red" || c.team === "blue") && !ctfEngageThreat(threatDistance,c.weaponId)
        ? ctfBotIntent(this.ctfFlags,c.team,c.id,c.pos,c.weaponId,
            [...this.combatants.values()].filter(p=>p.isBot&&p.team===c.team).map(p=>p.id),
            Object.fromEntries([...this.combatants.values()].filter(p=>p.alive).map(p=>[p.id,p.pos]).concat(
              this.alive?[[this.selfId,[this.pos.x,this.pos.y,this.pos.z] as Vec3]]:[])),this.map)
        : null;
      const ctfObjective = ctfIntent ? ctfStairWaypoint(ctfIntent.goal,c.pos,this.map) : null;
      ai.ctfGuarding=!!ctfIntent && ctfIntent.role.startsWith("defend");
      const ctfCritical=ctfIntent?.role==="recover"||ctfIntent?.role==="escort";
      const base=c.team==="red"||c.team==="blue"?ctfBase(c.team,this.map.id):null;
      // Prefer the freshest audible threat near the flag, but retain objective priority.
    const stimulus=audioInvestigation &&
      (!investigation || (ai.lastAlert?.at??0) >= (remembered?.seenAt??0))
      ? audioInvestigation : investigation;
    const nearBase=!!stimulus&&!!base&&Math.hypot(
      stimulus.lookAt[0]-base[0],stimulus.lookAt[2]-base[2])<34;
      const investigate=stimulus&&!pursueTag&&!orbitalObjective&&!ctfCritical &&
        (!ctfIntent||!ctfIntent.role.startsWith("defend")||nearBase) ? stimulus : null;
      ai.investigationLookAt=investigate?[...investigate.lookAt] as Vec3:null;
      // Ground-level bots otherwise acquire distant opponents through map
      // walls on every decision tick and never enter patrol mode. Let designated
      // climbers first approach their real stair entry when combat is not
      // immediate; close or clearly visible threats still take precedence.
      const city=(this.map.biome==="city"||this.map.biome==="city_day");
      const safeToClimb=city&&ai.wantsHighGround&&!pursueTag&&!ctfObjective&&
        threatDistance>27;
      if(safeToClimb&&!ai.highGroundPatrol){
        const variation=c.id.split("").reduce((n,ch)=>n+ch.charCodeAt(0),0);
        ai.highGroundPatrol=chooseCityHighGroundGoal(c.pos,this.highGroundGoals(),variation);
        if(ai.highGroundPatrol){
          ai.highGroundExpiresAt=now+24000;
          ai.routeWaypoint=null;ai.nextRouteAt=0;
        }
      }
      const climbing=safeToClimb&&!!ai.highGroundPatrol&&c.pos[1]<ai.highGroundPatrol.roof[1]-.65;
      const prevTarget = ai.targetId;
      ai.targetId = pursueTag || orbitalObjective || investigate || ctfObjective || climbing ? null : (enemy ? enemy.id : null);
      if (pursueTag && nearestTag) ai.wanderTarget = [...nearestTag.pos] as Vec3;
      else if (orbitalObjective) ai.wanderTarget = [...orbitalObjective] as Vec3;
      else if (investigate) ai.wanderTarget = [...investigate.goal] as Vec3;
      else if (ctfObjective) ai.wanderTarget = [...ctfObjective] as Vec3;
      // Record when a NEW target is acquired so we can enforce a human-like reaction delay.
      if (ai.targetId && ai.targetId !== prevTarget) {
        ai.acquiredTargetAt = now;
      }
      if (!ai.targetId) {
        if(orbitalObjective||investigate||ctfObjective||(pursueTag&&nearestTag)){
          ai.highGroundPatrol=null;
          ai.wanderTarget=[...(orbitalObjective??investigate?.goal??ctfObjective??nearestTag!.pos)] as Vec3;
        }else{
          if(ai.highGroundPatrol&&(now>(ai.highGroundExpiresAt??0)||
            c.pos[1]>=ai.highGroundPatrol.roof[1]-.8))ai.highGroundPatrol=null;
          if(!ai.highGroundPatrol && ai.wantsHighGround &&
            (this.map.biome==="city"||this.map.biome==="city_day" ? Math.random()<.92 : Math.random()<.55)){
            const variation=c.id.split("").reduce((n,ch)=>n+ch.charCodeAt(0),0);
            const goal=chooseCityHighGroundGoal(c.pos,this.highGroundGoals(),variation);
            if(goal){
              ai.highGroundPatrol=goal;ai.highGroundExpiresAt=now+20000;
              ai.routeWaypoint=null;ai.nextRouteAt=0;
            }
          }
          if(ai.highGroundPatrol)ai.wanderTarget=[...ai.highGroundPatrol.roof] as Vec3;
          else if(Math.hypot(ai.wanderTarget[0]-c.pos[0],ai.wanderTarget[2]-c.pos[2])<2.5)
            ai.wanderTarget=chooseBotPatrolPoint(c.team,this.opts.mode,c.pos,
              this.map.spawns.red,this.map.spawns.blue,this.map.spawns.ffa);
        }
      }
      if (Math.random() < 0.4) ai.strafeDir = -ai.strafeDir;
    }
    const target = ai.targetId ? this.combatants.get(ai.targetId) : null;
    const targetIsSelf = ai.targetId === this.selfId;
    const selfCombatant: Combatant = {
      id: this.selfId, name: this.opts.playerName, team: this.opts.team as string, isBot: false, isSelf: true,
      pos: [this.pos.x, this.pos.y, this.pos.z], yaw: this.yaw, pitch: this.pitch, health: this.health,
      alive: this.alive, weaponId: this.weaponId, weaponSkinId: this.opts.loadout.weaponSkinId,
      playerSkinId: this.opts.loadout.playerSkinId, kills: this.kills, deaths: this.deaths, score: this.opts.mode === "killconfirmed" ? this.confirmations + (this.denialScoreEnabled ? this.denials : 0) : this.kills,
    };
    const candidate = targetIsSelf ? selfCombatant : target;
    const candidateDist=candidate?Math.hypot(candidate.pos[0]-c.pos[0],candidate.pos[2]-c.pos[2]):Infinity;
    const tgt=candidate?.alive &&
      candidateDist<=Math.min(botDetectionRange(ai.difficulty,w.category),
        this.map.id==="whiteout_depot"?whiteoutVisibility(this.environmentTime,c.pos):Infinity) &&
      this.hasLineOfSight([c.pos[0],c.pos[1]+PLAYER_HEIGHT/2,c.pos[2]],
        [candidate.pos[0],candidate.pos[1]+PLAYER_HEIGHT/2,candidate.pos[2]])
      ? candidate : null;
    if(tgt)ai.lastSighting=botRememberSighting(tgt.id,tgt.pos,now);
    else if(ai.targetId){ai.targetId=null;ai.nextDecisionAt=0;}
    // Bots receive each shell only after its insert time. They can return fire
    // after the first completed shell if threatened.
    if (w.stats.reloadStyle === "incremental" &&
        ai.reloadingUntil > 0 && now >= ai.reloadingUntil && ai.ammoInMag < eff.magSize) {
      ai.ammoInMag++;
      const stepMs = Math.max(300, (w.stats.reloadPerRound ?? eff.reloadTime / eff.magSize) *
        eff.reloadTime / Math.max(0.01, w.stats.reloadTime) * 1000);
      ai.reloadingUntil = ai.ammoInMag >= eff.magSize || ai.targetId ? 0 : now + stepMs;
    }
    if (tgt && tgt.alive) {
      const dx = tgt.pos[0] - c.pos[0], dz = tgt.pos[2] - c.pos[2], dy = (tgt.pos[1] + 1.5) - (c.pos[1] + 1.5);
      const dist = Math.hypot(dx, dz);
      // ---- Aim tracking: turn toward target, but with skill-scaled lag + drift ----
      // Lower-skill bots turn more slowly and overshoot more. Higher-skill bots snap closer.
      const turnLerp = botTurnLerp(ai.difficulty, ai.skill);
      const desiredYaw = Math.atan2(dx, dz);
      // Aim error: a slow-varying random offset (every ~500ms pick a new offset).
      // Magnitude scales inversely with skill — bad bots wobble more.
      if (now > ai.nextAimErrorAt) {
        ai.nextAimErrorAt = now + 350 + Math.random() * 400;
        const errMag = ((1 - ai.skill) * 0.18 + 0.02) * botAimDriftMultiplier(ai.difficulty);
        ai.aimErrorYaw = (Math.random() - 0.5) * errMag * 2;
        ai.aimErrorPitch = (Math.random() - 0.5) * errMag * 2;
      }
      c.yaw = this.lerpAngle(c.yaw, desiredYaw + ai.aimErrorYaw, turnLerp);
      c.pitch = this.lerpAngle(c.pitch, Math.atan2(dy, Math.hypot(dx, dz)) + ai.aimErrorPitch, turnLerp);

      // Spray drift accumulates while firing (simulating uncompensated recoil) and
      // decays when the bot isn't firing. Applied as an offset to the shot direction.
      const sinceFired = now - ai.lastFiredAt;
      if (sinceFired > 200) {
        // Recovering — drift decays toward 0
        ai.sprayDriftYaw *= 0.92;
        ai.sprayDriftPitch *= 0.92;
      }

      const clearShot = this.hasLineOfSight(
        [c.pos[0], c.pos[1] + 1.45, c.pos[2]],
        [tgt.pos[0], tgt.pos[1] + 1.45, tgt.pos[2]],
      );
      const reactionReady = now - ai.acquiredTargetAt >= botReactionDelay(ai.difficulty);
      const aimSettled = now - ai.acquiredTargetAt >=
        botReactionDelay(ai.difficulty) + eff.adsTime * 750;
      const stance = botCombatDecision(w.category, dist, clearShot,
        reactionReady, aimSettled, ai.ammoInMag > 0, now < ai.reloadingUntil,ai.difficulty,ai.archetype);
      ai.sprinting = stance.sprinting;
      ai.aiming = stance.aiming;
      if(now>=(ai.nextCombatJumpAt??0)&&botWantsCombatJump(ai.difficulty,w.category,dist,clearShot,
        ai.envJumpVelocityY===undefined&&botHasJumpClearance(this.coverNear(c.pos[0],c.pos[2],2.5),c.pos),now,ai.nextCombatJumpAt??0,Math.random())){
        ai.envJumpVelocityY=MOVEMENT.jumpVelocity;ai.envLaunchX=0;ai.envLaunchZ=0;ai.nextCombatJumpAt=now+botTactics(ai.difficulty).jumpCooldown;
      }
      const botCarryingFlag=this.opts.mode==="ctf"&&(this.ctfFlags.red.carrierId===c.id||this.ctfFlags.blue.carrierId===c.id);
      const speed = (botCarryingFlag ? CTF_SPEED_MULTIPLIER : 1) * ai.moveSpeed * 6 * MOVEMENT.botPursuitMultiplier * (ai.sprinting ? 1.25 : 1) * ctfCarrierWeaponSpeed(eff.moveSpeed,botCarryingFlag) *
        (orbitalReaperEquipped(this.map,c.weaponId)&&!botCarryingFlag?ORBITAL_REAPER_SPEED_MULTIPLIER:1) * sludgeMovementFactor(c.pos,c.team,Date.now(),[...this.wonderFields.values()],this.opts.mode==="ffa"||this.opts.mode==="gungame") * floodgateWaterEffect(c.pos[0],c.pos[1],c.pos[2],floodAge,this.map.cover).speedMultiplier;
      const ideal=w.category==="melee" ? Math.max(.7,w.stats.range-.15) : stance.idealDistance;
      const chaseThreshold=w.category==="melee" ? ideal : ideal+3;
      // Determine the desired movement vector for this frame.
      let mvx = 0, mvz = 0;
      if (dist > chaseThreshold) { mvx = Math.sin(c.yaw) * speed * dt; mvz = Math.cos(c.yaw) * speed * dt; }
      else if (dist < ideal - 3) { mvx = -Math.sin(c.yaw) * speed * dt; mvz = -Math.cos(c.yaw) * speed * dt; }
      else { mvx = Math.cos(c.yaw) * ai.strafeDir * speed * dt * stance.strafe; mvz = -Math.sin(c.yaw) * ai.strafeDir * speed * dt * stance.strafe; }
      // Obstacle-aware chase navigation around the dense Bunker centre.
      if((dist > chaseThreshold || Math.abs(tgt.pos[1] - c.pos[1]) > 1.3) &&
          (Math.abs(tgt.pos[1] - c.pos[1]) > 1.3 || this.opts.mapId==="bunker" ||
          this.botMoveBlocked(c.pos,[c.pos[0]+mvx*6,c.pos[1],c.pos[2]+mvz*6],c.pos[1]) ||
          floodgateRouteNeedsDetour(c.pos,tgt.pos,floodAge,this.map.cover))) {
        if(now>(ai.nextRouteAt??0)||!ai.routeWaypoint){
          ai.routeWaypoint=botNextWaypoint(c.pos,tgt.pos,this.map.cover,this.map.size,3,floodgatePathHazards(this.map,this.floodgateBreachAt!==null),
            this.map.regions,this.coverIndex()??undefined,this.coverIndex()?280:1000,floodAge) ??
            botHighGroundWaypoint(c.pos,tgt.pos,this.map.cover);
          ai.nextRouteAt=now+850;
        }
        const waypoint=ai.routeWaypoint;
        if(waypoint){const wx=waypoint[0]-c.pos[0],wz=waypoint[2]-c.pos[2],len=Math.hypot(wx,wz);
          if(len>.25){mvx=wx/len*speed*dt;mvz=wz/len*speed*dt;}else ai.nextRouteAt=0;
        }
      }
      // Substep the movement so bots can't tunnel through thin walls at high
      // speed. Each substep is at most 0.15 units (Task 16-a — tightened from
      // 0.20 so the upcoming thin cover boxes in Task 16-b with half-extent
      // 0.3-0.4 have more headroom). After each substep, run the pre-movement
      // probe — if the next substep would enter a wall, try sliding along it
      // (zero out the blocked axis), then a 45° diagonal nudge, before giving
      // up on the remaining substeps.
      const moveLen = Math.hypot(mvx, mvz);
      const SUBSTEP = 0.15;
      const steps = Math.max(1, Math.ceil(moveLen / SUBSTEP));
      const sx = mvx / steps, sz = mvz / steps;
      for (let s = 0; s < steps; s++) {
        const from: Vec3 = [c.pos[0], c.pos[1], c.pos[2]];
        const nextX = c.pos[0] + sx, nextZ = c.pos[2] + sz;
        const to: Vec3 = [nextX, c.pos[1], nextZ];
        if (!this.botMoveBlocked(from, to, c.pos[1])) {
          c.pos[0] = nextX; c.pos[2] = nextZ;
        } else {
          // Try sliding along X only (zero Z).
          const toX: Vec3 = [nextX, c.pos[1], c.pos[2]];
          if (!this.botMoveBlocked(from, toX, c.pos[1])) { c.pos[0] = nextX; continue; }
          // Try sliding along Z only (zero X).
          const toZ: Vec3 = [c.pos[0], c.pos[1], nextZ];
          if (!this.botMoveBlocked(from, toZ, c.pos[1])) { c.pos[2] = nextZ; continue; }
          // Task 16-a: 45° diagonal nudge — slide diagonally along the wall.
          // Rotates the intended direction (sx, sz) by 45° (CW) and tries that.
          // Helps bots slide around concave corners instead of jamming. The
          // magnitude is preserved at ~0.707 of the original substep.
          const diagX = (sx + sz) * 0.5;
          const diagZ = (sz - sx) * 0.5;
          const toDiag: Vec3 = [c.pos[0] + diagX, c.pos[1], c.pos[2] + diagZ];
          if (!this.botMoveBlocked(from, toDiag, c.pos[1])) { c.pos[0] = toDiag[0]; c.pos[2] = toDiag[2]; continue; }
          // Fully blocked — stop this frame's movement.
          break;
        }
      }
      // Final iterative push-out (handles any residual overlap from edge cases).
      c.pos = this.collideBots(c.pos, c.pos[1]);
      // Task 16-a: soft bot-vs-bot (and bot-vs-player) separation. Push the bot
      // away from any other combatant that's too close on XZ. Runs AFTER the
      // cover push-out and BEFORE the ground snap so the snap uses the
      // separated XZ position.
      this.separateBots(c, c.pos[1]);
        c.pos=this.collideBots(c.pos,c.pos[1]);
      // ---- Reaction delay: skill-scaled ----
      // Easy bots take 500-900ms; veteran bots take 120-250ms. Gives the player a window.
      const REACTION_MS = botReactionDelay(ai.difficulty);
      const reacted = now - ai.acquiredTargetAt >= REACTION_MS;

      // ---- Burst fire for auto weapons ----
      // Auto weapons fire 3-6 round bursts with a 200-500ms pause between bursts.
      // Semi-auto weapons tap at their natural cadence (no burst logic).
      const isAuto = w.stats.auto;
      // If we're between bursts, wait until burstEndsAt before firing again.
      const burstPaused = isAuto && now < ai.burstEndsAt;
      // Start a new burst if the previous one is exhausted
      if (isAuto && ai.burstShotsLeft <= 0 && now >= ai.burstEndsAt && reacted) {
        // Skill-scaled burst length: better bots fire longer, more controlled bursts.
        ai.burstShotsLeft = Math.max(2, Math.round(3 + ai.skill * 4 + (Math.random() - 0.5) * 2 + botPersonality(ai.archetype).extraBurstShots));
      }
      // Distance-scaled extra spread: bots are less accurate at long range.
      const distSpread = dist > 25 ? (dist - 25) * 0.0015 : 0;

      // ---- Intentional miss chance ----
      // Even with a clear shot, low-skill bots fluff some bullets. The miss is implemented
      // as extra spread on the shot (the bullet goes somewhere, just not on target).
      // Easy = 35% miss, normal = 22%, hard = 12%, veteran = 5%.
      const missChance = (1 - ai.skill) * 0.45 + 0.03;
      const missThisShot = Math.random() < missChance;
      const missSpread = missThisShot ? eff.spread * 8 + 0.04 : 0;
      const mechanicalSpread = botShotSpread(eff, !!ai.aiming);
      const botShotgun = w.category === "shotgun" && !w.wonder && (eff.pellets ?? 1) > 1;
      const baseAimJitter = botShotgun ? 0 : mechanicalSpread * 2;

      if (!ai.sprinting && clearShot && reacted && now > ai.nextShotAt && ai.ammoInMag > 0 && now > ai.reloadingUntil && !burstPaused && (w.id!==ORBITAL_REAPER_ID||dist<=ORBITAL_PULSE_RADIUS)) {
        const origin: Vec3 = [c.pos[0], c.pos[1] + 1.5, c.pos[2]];
        // Final aim = bot yaw/pitch + weapon spread + spray drift + distance spread + (miss boost)
        const aimYaw = c.yaw + ai.sprayDriftYaw + (Math.random() - 0.5) * (baseAimJitter + distSpread + missSpread);
        const aimPitch = c.pitch + ai.sprayDriftPitch + (Math.random() - 0.5) * (baseAimJitter + distSpread + missSpread);
        const dir = this.dirFromYawPitch(aimYaw, aimPitch);
        if(w.category==="melee"){
          if(w.id===ORBITAL_REAPER_ID)this.offlineOrbitalBotSwing(c);
          else this.offlineBotMeleeSwing(c,w.id);
        }else{
          const pellets = eff.pellets ?? 1;
          for (let i = 0; i < pellets; i++) {
            const pdir = botShotgun
              ? shotgunPelletDirection(dir, eff, !!ai.aiming)
              : pellets > 1 ? this.normalize(this.add(dir, this.randSpread(mechanicalSpread))) : dir;
            this.botFireRay(c, origin, pdir, eff, w.stats.headshotMult);
          }
        }
        if(w.category!=="melee")this.spawnTracer(origin, dir, c.weaponSkinId);
        c.lastFireRecoil = now;
        ai.lastFiredAt = now;
        if(w.category!=="melee")ai.ammoInMag--;
        c.spawnProtectedUntil = 0; // attacking cancels bot spawn protection
        if (c.shieldMesh) c.shieldMesh.visible = false;
        if(w.category!=="melee"){
          this.recordRadarShot(c.id, c.pos, c.team, ai.attachments.barrel === "barrel_suppressor");
          this.publishBotNoise({sourceId:c.id,pos:c.pos,at:now,kind:"gunshot",
            suppressed:ai.attachments.barrel==="barrel_suppressor"});
        }
        // Enemy fire sound: distance-attenuated + muffled if suppressed.
        // Bots in offline mode have null barrel attachments (no suppressors),
        // but the check is wired correctly so a future loadout pass would Just Work.
        if(w.category!=="melee")this.playEnemyFireSound(c.pos, c.weaponId, ai.attachments.barrel === "barrel_suppressor");
        // Accumulate spray drift from this shot (recovers when not firing).
        const driftKick = eff.recoil * 0.0042 * (1 - ai.skill * 0.5);
        ai.sprayDriftPitch += driftKick;  // climb up
        ai.sprayDriftYaw += (Math.random() - 0.5) * driftKick * 0.8;  // horizontal wander
        // Clamp drift so it doesn't spiral to infinity
        ai.sprayDriftYaw = Math.max(-0.18, Math.min(0.18, ai.sprayDriftYaw));
        ai.sprayDriftPitch = Math.max(0, Math.min(0.18, ai.sprayDriftPitch));
        // Compute next-shot timing.
        if (isAuto) {
          // Burst cadence: shots within a burst are at the weapon's fire rate (slightly
          // slower for low-skill bots). When the burst is exhausted, set a longer pause.
          ai.burstShotsLeft -= 1;
          if (ai.burstShotsLeft <= 0) {
            // End of burst — pause 200-500ms (less for higher skill)
            const pauseMs = 200 + (1 - ai.skill) * 350 + Math.random() * 200;
            ai.burstEndsAt = now + pauseMs;
            ai.nextShotAt = now + pauseMs;
          } else {
            ai.nextShotAt = now + 1000 / Math.max(1, eff.fireRate) * (1.0 + (1 - ai.skill) * 0.4) + Math.random() * 30;
          }
        } else {
          // Semi-auto: tap cadence, slower than full auto fire rate (human can't spam).
          ai.nextShotAt = now + 1000 / Math.max(1, eff.fireRate) * (1.4 + (1 - ai.skill) * 0.6) + Math.random() * 200;
        }
      }
      // ---- Reload decisions ----
      // Bots reload when empty (always) OR when below 30% mag AND no enemy is currently
      // visible/close (smart reload). Higher-skill bots are smarter about this.
      const enemyVisible = dist < 35;
      const lowAmmo = ai.ammoInMag <= Math.max(1, Math.floor(eff.magSize * 0.3));
      const wantSmartReload = lowAmmo && !enemyVisible && ai.skill > 0.4 &&
        canStartWeaponReload(w.stats, ai.ammoInMag) && Math.random() < 0.02;
      if (!ai.sprinting && (ai.ammoInMag <= 0 || wantSmartReload) && now > ai.reloadingUntil) {
        const durationMs = w.stats.reloadStyle === "incremental"
          ? Math.max(300, (w.stats.reloadPerRound ?? eff.reloadTime / eff.magSize) *
              eff.reloadTime / Math.max(0.01, w.stats.reloadTime) * 1000)
          : eff.reloadTime * 1000;
        ai.reloadingUntil = now + durationMs;
        if (w.stats.reloadStyle !== "incremental") ai.ammoInMag = eff.magSize;
        ai.burstShotsLeft = 0;
        ai.burstEndsAt = now + durationMs;
      }
    } else {
      const patrolGoal=ai.highGroundPatrol;
      const patrolPoint=patrolGoal?cityHighGroundStep(c.pos,patrolGoal,
        this.coverNear(c.pos[0],c.pos[2],35)):ai.wanderTarget;
      const dx=patrolPoint[0]-c.pos[0],dz=patrolPoint[2]-c.pos[2];
      const d=Math.hypot(dx,dz);
      ai.aiming=ai.archetype==="marksman" && d<=2.5;
      ai.sprinting = botPatrolSprint(d,ai.difficulty,ai.archetype);
      if(d<=1.5){
        if(ai.investigationLookAt){
          const last=ai.investigationLookAt;
          const dx=last[0]-c.pos[0],dz=last[2]-c.pos[2];
          const angle=Math.hypot(dx,dz)>0.4?Math.atan2(dx,dz):c.yaw;
          c.yaw=this.lerpAngle(c.yaw,angle+Math.sin(now/850+c.id.length)*.38,.15);
        }else if(ai.ctfGuarding&&(c.team==="red"||c.team==="blue")){
          c.yaw=this.lerpAngle(c.yaw,ctfDefenderScanYaw(c.team,c.pos,c.id,this.map.id),.12);
        }else if(ai.archetype==="marksman"){
          if(ai.idleLookYaw===undefined)ai.idleLookYaw=c.yaw;
          c.yaw=this.lerpAngle(c.yaw,ai.idleLookYaw+Math.sin(now/2300+c.id.length)*.5,.1);
        }
      }else ai.idleLookYaw=undefined;
      if(d>(patrolGoal?.38:1.5)){
        // Task 16-a: wall-ahead lookahead. Probe 2 units forward in the
        // movement direction. If blocked, rotate the movement direction by
        // ±35° (sign from ai.strafeDir) so the bot angles around the obstacle
        // instead of headbutting it. The yaw is set to the rotated direction
        // so the bot faces where it's going.
        let fx = dx / d, fz = dz / d;
        const patrolBlocked = this.botMoveBlocked(c.pos, [c.pos[0]+fx*4,c.pos[1],c.pos[2]+fz*4],c.pos[1]);
        if((patrolBlocked || (patrolGoal&&d>5) ||
            Math.abs(patrolPoint[1]-c.pos[1])>1.3 || this.opts.mapId==="bunker" ||
            floodgateRouteNeedsDetour(c.pos,patrolPoint,floodAge,this.map.cover)) &&
            (!patrolGoal||d>4.5)){
          if(now>(ai.nextRouteAt??0)||!ai.routeWaypoint){
            ai.routeWaypoint=botNextWaypoint(c.pos,patrolPoint,this.map.cover,this.map.size,3,
              floodgatePathHazards(this.map,this.floodgateBreachAt!==null),this.map.regions,this.coverIndex()??undefined,this.coverIndex()?280:1000,floodAge);
            ai.nextRouteAt=now+(this.coverIndex()?1500:850);
          }
          const waypoint=ai.routeWaypoint;
          if(waypoint){const wx=waypoint[0]-c.pos[0],wz=waypoint[2]-c.pos[2],wd=Math.hypot(wx,wz);
            if(wd>.25){fx=wx/wd;fz=wz/wd;}else ai.nextRouteAt=0;
          }
        }
        const probeFrom: Vec3 = [c.pos[0], c.pos[1], c.pos[2]];
        const probeTo: Vec3 = [c.pos[0] + fx * 2, c.pos[1], c.pos[2] + fz * 2];
        if (this.botMoveBlocked(probeFrom, probeTo, c.pos[1])) {
          const baseX=fx,baseZ=fz;
          const turns=[35,-35,70,-70,105,-105,145,-145,180];
          let clear=false;
          for(const angle of turns){
            const theta=angle*ai.strafeDir*Math.PI/180;
            const hx=baseX*Math.cos(theta)-baseZ*Math.sin(theta);
            const hz=baseX*Math.sin(theta)+baseZ*Math.cos(theta);
            if(!this.botMoveBlocked(probeFrom,[c.pos[0]+hx*1.5,c.pos[1],c.pos[2]+hz*1.5],c.pos[1])){
              fx=hx;fz=hz;clear=true;break;
            }
          }
          if(!clear) ai.strafeDir=-ai.strafeDir;
          c.yaw = Math.atan2(fx, fz);
        } else {
          c.yaw = this.lerpAngle(c.yaw, Math.atan2(dx, dz), 0.15);
        }
        const scan=botCornerScan(ai.difficulty,patrolBlocked,now,ai);
        if((ai.cornerUntil??0)>now){ai.sprinting=false;c.yaw=this.lerpAngle(c.yaw,Math.atan2(fx,fz)+scan,.28);}
        const cornerSpeed=(ai.cornerUntil??0)>now?.35:1;
        // Task 16-a: substepped, collision-aware movement (brings the wander
        // path to parity with the engage path so bots can't clip into walls
        // mid-wander). SUBSTEP=0.15, with slide-along-wall + 45° diagonal.
        const moveSpeed = (this.opts.mode === "ctf" && (this.ctfFlags.red.carrierId === c.id || this.ctfFlags.blue.carrierId === c.id) ? CTF_SPEED_MULTIPLIER : 1) * ai.moveSpeed * 5 * MOVEMENT.botPursuitMultiplier * (ai.sprinting ? 1.25 : 1) * dt * sludgeMovementFactor(c.pos,c.team,Date.now(),[...this.wonderFields.values()],this.opts.mode==="ffa"||this.opts.mode==="gungame") * floodgateWaterEffect(c.pos[0],c.pos[1],c.pos[2],floodAge,this.map.cover).speedMultiplier;
        const mvx = fx * moveSpeed * cornerSpeed;
        const mvz = fz * moveSpeed * cornerSpeed;
        const moveLen = Math.hypot(mvx, mvz);
        const SUBSTEP = 0.15;
        const steps = Math.max(1, Math.ceil(moveLen / SUBSTEP));
        const sx = mvx / steps, sz = mvz / steps;
        for (let s = 0; s < steps; s++) {
          const from: Vec3 = [c.pos[0], c.pos[1], c.pos[2]];
          const nextX = c.pos[0] + sx, nextZ = c.pos[2] + sz;
          const to: Vec3 = [nextX, c.pos[1], nextZ];
          if (!this.botMoveBlocked(from, to, c.pos[1])) {
            c.pos[0] = nextX; c.pos[2] = nextZ;
          } else {
            const toX: Vec3 = [nextX, c.pos[1], c.pos[2]];
            if (!this.botMoveBlocked(from, toX, c.pos[1])) { c.pos[0] = nextX; continue; }
            const toZ: Vec3 = [c.pos[0], c.pos[1], nextZ];
            if (!this.botMoveBlocked(from, toZ, c.pos[1])) { c.pos[2] = nextZ; continue; }
            // 45° diagonal nudge (same as the engage path).
            const diagX = (sx + sz) * 0.5;
            const diagZ = (sz - sx) * 0.5;
            const toDiag: Vec3 = [c.pos[0] + diagX, c.pos[1], c.pos[2] + diagZ];
            if (!this.botMoveBlocked(from, toDiag, c.pos[1])) { c.pos[0] = toDiag[0]; c.pos[2] = toDiag[2]; continue; }
            break;
          }
        }
        // Bug 1 fix: cover collision (same logic as player) — push out of any blocking cover box.
        c.pos = this.collideBots(c.pos, c.pos[1]);
        // Task 16-a: soft bot-vs-bot separation (same as engage path).
        this.separateBots(c, c.pos[1]);
        c.pos=this.collideBots(c.pos,c.pos[1]);

      }
    }
    // Ground-level bots are displaced by the same persistent southbound current
    // as human players; normal collision still prevents pushing through cover.
    const botWater=floodgateWaterEffect(c.pos[0],c.pos[1],c.pos[2],
      floodAge,this.map.cover);
    if(botWater.flooded){
      const next:[number,number,number]=[c.pos[0],c.pos[1],c.pos[2]+botWater.pushZ*dt];
      if(!this.botMoveBlocked(c.pos,next,c.pos[1]))c.pos=this.clamp(this.collideBots(next,next[1]));
    }
    // Always perform vertical navigation, including when stationary: a bot that
    // stops moving at a ledge must still fall, rather than float/phase through it.
    c.pos = this.clamp(this.collideBots(c.pos, c.pos[1]));
    if (c.ai?.envJumpVelocityY !== undefined) {
      const vy = c.ai.envJumpVelocityY;
      c.pos = [c.pos[0] + (c.ai.envLaunchX ?? 0) * dt,
        c.pos[1] + vy * dt,
        c.pos[2] + (c.ai.envLaunchZ ?? 0) * dt];
      c.ai.envJumpVelocityY = vy - 22 * orbitalGravity(this.map,c.weaponId) * dt;
      const ground = botGroundHeight(this.coverNear(c.pos[0],c.pos[2],2.5), c.pos[0], c.pos[2], c.pos[1]);
      if (c.ai.envJumpVelocityY <= 0 && c.pos[1] <= ground) {
        c.pos[1] = ground;
        c.ai.envJumpVelocityY = undefined;
      }
    } else {
      c.pos[1] = botNextFeetY(this.coverNear(c.pos[0],c.pos[2],2.5), c.pos, dt);
    }
    c.pos = this.clamp(this.collideBots(c.pos, c.pos[1]));
    // ---- Task 16-a: stuck detection & recovery ----
    // Measure how far the bot moved THIS tick (vs the position recorded at the
    // end of the previous tick). If the bot has a movement intent (target
    // acquired OR wander target > 1.5 away) but barely moved (< 0.05 units),
    // it's stuck — mark the start time. If still stuck after 1.2s, force a
    // recovery: new random wander target, clear the target (so it wanders),
    // flip strafe dir, nudge sideways, re-run collideBots.
    {
      const wanderDist = Math.hypot(ai.wanderTarget[0] - c.pos[0], ai.wanderTarget[2] - c.pos[2]);
      const hasIntent = ai.targetId !== null || wanderDist > 1.5;
      const moved = Math.hypot(c.pos[0] - ai.lastPosX, c.pos[2] - ai.lastPosZ);
      if (hasIntent && moved < 0.05) {
        if (ai.stuckSince === 0) ai.stuckSince = now;
      } else {
        ai.stuckSince = 0;
      }
      if (ai.stuckSince > 0 && now - ai.stuckSince > 1200) {
        // Reset stuck patrol toward enemy territory, not the same team spawn.
        ai.wanderTarget = chooseBotPatrolPoint(c.team, this.opts.mode, c.pos,
          this.map.spawns.red, this.map.spawns.blue, this.map.spawns.ffa);
        ai.highGroundPatrol=null;ai.highGroundExpiresAt=now+4500;
        ai.targetId = null;        // wander instead of engaging
        ai.lastSighting=null;ai.investigationLookAt=null;
      ai.routeWaypoint=null;ai.nextRouteAt=0;
        ai.strafeDir = -ai.strafeDir;
        ai.stuckSince = 0;
        // Nudge sideways so the bot has a chance to unstick from the corner.
        const before: Vec3 = [...c.pos];
        const tryPos: Vec3 = [before[0] + (Math.random() - 0.5) * 0.6, before[1], before[2] + (Math.random() - 0.5) * 0.6];
        if (!this.botMoveBlocked(before, tryPos, before[1])) c.pos = tryPos;
        c.pos = this.clamp(this.collideBots(c.pos, c.pos[1]));
      }
    }
    // Record this tick's position for next tick's stuck measurement.
    const stepDistance=Math.hypot(c.pos[0]-ai.lastPosX,c.pos[2]-ai.lastPosZ);
    if(stepDistance>.08&&now-(ai.lastNoiseStepAt??0)>(ai.sprinting?280:390)){
      ai.lastNoiseStepAt=now;
      this.publishBotNoise({sourceId:c.id,pos:c.pos,at:now,kind:"footstep",sprinting:!!ai.sprinting});
    }
    ai.lastPosX = c.pos[0];
    ai.lastPosZ = c.pos[2];
  }

  private nearestEnemy(c: Combatant): Combatant | null {
    let best: Combatant | null = null; let bestD = Infinity;
    const selfC: Combatant = {
      id: this.selfId, name: this.opts.playerName, team: this.opts.team as string, isBot: false, isSelf: true,
      pos: [this.pos.x, this.pos.y, this.pos.z], yaw: 0, pitch: 0, health: this.health, alive: this.alive,
      weaponId: this.weaponId, weaponSkinId: "", playerSkinId: "", kills: 0, deaths: 0, score: 0,
    };
    const candidates = [...this.combatants.values(), selfC];
    // Bots require LINE OF SIGHT to acquire a target (no longer omniscient).
    // If no visible enemy exists, the bot wanders. This makes bots feel less
    // psychic — you can break LoS to escape them.
    for (const e of candidates) {
      if (e.id === c.id || !e.alive || (this.opts.mode === "survival" && e.isBot)) continue;
      if (e.team === c.team && this.opts.mode !== "ffa" && this.opts.mode !== "gungame") continue;
      const d = Math.hypot(e.pos[0] - c.pos[0], e.pos[2] - c.pos[2]);
      if (d >= bestD) continue;
      // Only acquire targets within engagement range AND with clear LoS.
      if (d > Math.min(botDetectionRange(c.ai?.difficulty??"normal",weaponById(c.weaponId).category),
        this.map.id==="whiteout_depot"?whiteoutVisibility(this.environmentTime,c.pos):Infinity)) continue;
      const fromY = c.pos[1] + PLAYER_HEIGHT / 2;
      const toY = e.pos[1] + PLAYER_HEIGHT / 2;
      if (!this.hasLineOfSight([c.pos[0], fromY, c.pos[2]], [e.pos[0], toY, e.pos[2]])) continue;
      bestD = d;
      best = e;
    }
    return best;
  }

  // Line-of-sight check: returns true if there's a clear line from `from` to `to`
  // (no blocking cover boxes in between). Used by the bot AI so bots require LoS
  // before acquiring a target (instead of being omniscient).
  private hasLineOfSight(from: Vec3, to: Vec3): boolean {
    const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.01) return true;
    const dir: Vec3 = [dx / len, dy / len, dz / len];
    for (const cov of this.coverAlong(from,to,2)) {
      if (cov.kind === "accent" || cov.kind === "stair") continue;
      const t = rayBox(from, dir, cov.pos, cov.size);
      if (t !== null && t < len) return false;
    }
    return true;
  }

  private botFireRay(attacker: Combatant, origin: Vec3, dir: Vec3, eff: EffectiveStats, headshotMult: number) {
    const contacts: BodyRayContact<Combatant>[] = [];
    const selfC: Combatant = {
      id: this.selfId, name: this.opts.playerName, team: this.opts.team as string, isBot: false, isSelf: true,
      pos: [this.pos.x, this.pos.y, this.pos.z], yaw: 0, pitch: 0, health: this.health, alive: this.alive,
      weaponId: "", weaponSkinId: "", playerSkinId: "", kills: 0, deaths: 0, score: 0,
    };
    selfC.weaponId=this.weaponId;selfC.yaw=this.yaw;selfC.riotShieldHp=this.riotShieldHp;selfC.riotShieldRaised=this.shieldRaised();
    const candidates = [...this.combatants.values(), selfC];
    for (const e of candidates) {
      if (e.id === attacker.id || !e.alive) continue;
      if (e.team === attacker.team && this.opts.mode !== "ffa" && this.opts.mode !== "gungame") continue;
      const panel = rayRiotShield(origin, dir, e);
      const body = rayCombatantHit(origin, dir, e.pos);
      const shieldFirst = panel !== null && panel >= 0 && (!body || panel < body.t);
      const t = shieldFirst ? panel! : body?.t;
      if (t !== undefined) contacts.push({ target: e, t, head: shieldFirst ? false : !!body?.head,
        shield: shieldFirst, protected: e.id === this.selfId
          ? this.selfSpawnProtectedUntil > Date.now() : (e.spawnProtectedUntil ?? 0) > Date.now() });
    }
    const maxDistance = maxWeaponHitRange(eff.range, eff);
    const coverDistance = closestCoverHit(this.map.cover, origin, dir, maxDistance, rayBox)?.distance ?? Infinity;
    const hits = selectBodyPenetrationHits(contacts, maxDistance, coverDistance, eff.bodyPenetration);
    for (const hit of hits) {
      const nearest = { victim: hit.target, t: hit.t, head: hit.head, shield: hit.shield };
      if (hit.protected) break;
      if(nearest.shield){
        if(nearest.victim.id===this.selfId){
          if(this.selfSpawnProtectedUntil>Date.now())return;
          const next=hitRiotShield(this.riotShieldHp,this.riotShieldReadyAt,eff.damage * hit.damageScale,performance.now());
          this.riotShieldHp=next.hp;this.riotShieldReadyAt=next.readyAt;
          this.riotShieldHitFlashAt=performance.now();
          this.sound.play("melee_hit",{volume:.35,throttleMs:90});
        }else{
          const next=hitRiotShield(nearest.victim.riotShieldHp??RIOT_SHIELD_HP,
            nearest.victim.riotShieldReadyAt??0,eff.damage * hit.damageScale,performance.now());
          nearest.victim.riotShieldHp=next.hp;nearest.victim.riotShieldReadyAt=next.readyAt;
        }
        break;
      }
      const baseDmg = eff.damage * (nearest.head ? headshotMult : 1);
      let dmg = damageAtRange(baseDmg, nearest.t, eff.range, eff) * hit.damageScale;
      // Survival: bots hit harder as waves progress, BUT base damage is reduced
      // by 35% to give players more survivability (Round 18-b balance fix).
      // Net: wave 1 = 65% damage, wave 8 = 65%*1.42 = 92%, wave 14 = 65%*1.78 = 116%.
      // This gives players a much better early game while still ramping up.
      if (this.opts.mode === "survival")
        dmg *= 0.65 * survivalWaveDamageMul(this.survivalWave) * survivalWaveMutators(this.survivalTier,this.survivalWave).damageMul;
      // Round 20h: Check local player spawn protection — skip damage if protected.
      if (nearest.victim.id === this.selfId && this.selfSpawnProtectedUntil > Date.now()) {
        break; // player is spawn-protected — bullet absorbed
      }
      if (nearest.victim.id === this.selfId) {
        const dx = this.pos.x - attacker.pos[0];
        const dz = this.pos.z - attacker.pos[2];
        const fwdX = Math.sin(this.yaw);
        const fwdZ = Math.cos(this.yaw);
        const angleToAttacker = Math.atan2(dx, dz);
        const angleToFwd = Math.atan2(fwdX, fwdZ);
        let rel = angleToAttacker - angleToFwd;
        while (rel > Math.PI) rel -= Math.PI * 2;
        while (rel < -Math.PI) rel += Math.PI * 2;
        this.lastDamageDir = rel;
        this.lastDamageDirAt = performance.now();
        // If this shot will kill the local player, advance the attacker's
        // gungame tier FIRST (mirroring the bot-on-bot path) so the killer's
        // progression updates even when they killed the human player.
        const willKill = this.health - dmg <= 0;
        if (willKill && this.opts.mode === "gungame") {
          const won = this.advanceCombatantGungameTier(attacker);
          if (won) { this.takeDamage(dmg, attacker.name, attacker.team, headshotMult > 1); this.finalizeMatchLocal(); return; }
        }
        this.takeDamage(dmg, attacker.name, attacker.team, headshotMult > 1,
          attacker.weaponId,attacker.pos);
      } else {
        if(nearest.victim.ai && (this.opts.mode==="ffa"||this.opts.mode==="gungame"||nearest.victim.team!==attacker.team)){
          nearest.victim.ai.lastAlert=botRememberHit(attacker.id,attacker.pos,performance.now());
          nearest.victim.ai.nextDecisionAt=0;
        }
        nearest.victim.health -= dmg;
        if (nearest.victim.health <= 0 && nearest.victim.alive) {
          const recent=this.offlineAssistDamage.get(nearest.victim.id);
          if (attacker.team === this.opts.team && nearest.victim.team !== this.opts.team &&
              (this.opts.mode==="tdm"||this.opts.mode==="killconfirmed"||this.opts.mode==="ctf") &&
              recent && recent.damage>=15 && performance.now()-recent.at<=10000)
            this.assists++;
          this.offlineAssistDamage.delete(nearest.victim.id);
          nearest.victim.alive = false; nearest.victim.deaths += 1;
          nearest.victim.deathAnimAt = performance.now(); nearest.victim.deathAnimDur = 900;
          if(this.opts.mode==="ffa"||this.opts.mode==="gungame"||attacker.team!==nearest.victim.team)
            this.recordOrbitalKill(nearest.victim.pos,attacker.pos);
          this.releaseOrbitalBotWeapon(nearest.victim);
          if (this.opts.mode === "ctf") this.dropOfflineCtfCarrier(nearest.victim.id, [...nearest.victim.pos] as Vec3);
          if (this.opts.mode !== "killconfirmed" && this.opts.mode !== "ctf") nearest.victim.score = nearest.victim.kills;
          attacker.kills += 1;
          if (this.opts.mode !== "killconfirmed" && this.opts.mode !== "ctf") attacker.score = attacker.kills;
          if (this.opts.mode === "killconfirmed") this.dropLocalKillConfirmedTag(nearest.victim.id, nearest.victim.team, nearest.victim.pos);
          if (this.opts.mode === "tdm") this.teamScores[attacker.team as "red" | "blue"] += 1;
          const entry: KillFeedEntry = { killer: attacker.name, victim: nearest.victim.name, weapon: attacker.weaponId, headshot: nearest.head, killerTeam: attacker.team, victimTeam: nearest.victim.team };
          this.killFeed.unshift(entry); if (this.killFeed.length > 6) this.killFeed.pop();
          this.opts.onKillFeed(entry);
          // Gun Game: advance the bot attacker's tier. If they were on the
          // knife tier, this kill wins the match for them.
          if (this.opts.mode === "gungame") {
            const won = this.advanceCombatantGungameTier(attacker);
            if (won) { this.finalizeMatchLocal(); return; }
          }
          this.scheduleRespawn(nearest.victim);
          this.checkWin();
        }
      }
    }
  }

  private takeDamage(
    dmg:number,attackerName:string,attackerTeam:string,head:boolean,
    weaponId="rifle_ar",attackerPos?:Vec3,
  ) {
    if (!this.alive || (weaponId !== LAVA_DEATH_SOURCE && this.selfSpawnProtectedUntil > Date.now())) return;
    this.health -= dmg;
    this.damageFlashAt = performance.now();
    this.lastDamageAt = performance.now();
    // Hit-taken SFX (sharp low thud). Throttled so a burst doesn't spam.
    this.sound.play("hit_taken", { volume: 0.55, throttleMs: 80 });
    if (this.health <= 0) {
      this.health = 0; this.alive = false; this.deaths += 1;
      this.currentNoDeathStreak = 0;
      // Falling, environmental hazards and friendly damage must not charge
      // the reactor; only a legitimate opposing-team kill contributes.
      if ((attackerTeam==="red"||attackerTeam==="blue"||attackerTeam==="ffa"&&attackerPos!==undefined)&&
          (this.opts.mode==="ffa"||this.opts.mode==="gungame"||attackerTeam!==this.opts.team))
        this.recordOrbitalKill([this.pos.x,this.pos.y,this.pos.z],attackerPos);
      this.grantOrbitalReaper(false);
      if (this.opts.mode === "ctf") this.dropOfflineCtfCarrier(this.selfId, [this.pos.x,this.pos.y,this.pos.z]);
      this.killChain = { count: 0, lastKillAt: -Infinity };
      this.recentKills = [];
      this.shotBloom = 0;
      if (this.activePerkId === "explonando") {
        const pos: Vec3 = [this.pos.x, this.pos.y, this.pos.z];
        this.placeDeathBomb("offline_death_" + this.deaths, pos, Date.now() + EXPLO_FUSE_MS, true);
      }
      if (this.opts.mode === "killconfirmed") this.dropLocalKillConfirmedTag(this.selfId, this.opts.team as string, [this.pos.x, this.pos.y, this.pos.z]);
      // Local player death SFX.
      this.sound.play("death", { volume: 0.8 });
      this.lastDeath={killer:attackerName,weaponId,attachments:[]};
      const entry: KillFeedEntry = { killer: attackerName, victim: this.opts.playerName, weapon: weaponId, headshot: head, killerTeam: attackerTeam, victimTeam: this.opts.team as string };
      this.killFeed.unshift(entry); if (this.killFeed.length > 6) this.killFeed.pop();
      this.opts.onKillFeed(entry);
      // Offline Survival is solo: one death ends the run; no reinforcements.
      if (this.opts.mode === "survival") {
        this.finalizeMatchLocal();
      } else {
        this.respawnAt = performance.now() + RESPAWN_DELAY_MS;
      }
    }
  }

  // Add a short-lived enemy position ping after a *validated* gunshot.
  // Offline bots use this locally; online players receive targeted radarPing packets.
  private recordRadarShot(id: string, pos: Vec3, team: string, suppressed: boolean) {
    if (id === this.selfId || friendlyOnRadar(this.opts.mode, this.opts.team, team)) return;
    if (!canHearGunshot({ x: this.pos.x, z: this.pos.z }, { x: pos[0], z: pos[2] }, suppressed)) return;
    this.radarPings.set(id, { expiresAt: radarExpiresAt(Date.now(), this.activePerkId) });
  }

  private emitHud(now: number) {
    const orbitalWarning=this.orbitalSnapshotSeen
      ?orbitalServerWarning(this.map,this.opts.online,this.orbitalServerVersion)
      :undefined;
    const radarNow = Date.now();
    for (const [id, ping] of this.radarPings) if (ping.expiresAt <= radarNow) this.radarPings.delete(id);
    const scoreboard: ScoreRow[] = [];
    if (this.opts.online) {
      for (const c of this.combatants.values()) {
        scoreboard.push({ id: c.id, name: c.name, team: c.team, kills: c.kills, deaths: c.deaths, score: c.score, isBot: c.isBot, isSelf: c.id === this.selfId });
      }
    } else {
      for (const c of this.combatants.values()) {
        scoreboard.push({ id: c.id, name: c.name, team: c.team, kills: c.kills, deaths: c.deaths, score: this.opts.mode === "killconfirmed" || this.opts.mode === "ctf" ? c.score : c.kills, isBot: c.isBot, isSelf: false });
      }
      scoreboard.push({ id: this.selfId, name: this.opts.playerName, team: this.opts.team as string, kills: this.kills, deaths: this.deaths, score: this.opts.mode === "ctf" ? this.ctfCaptures : this.opts.mode === "killconfirmed" ? this.confirmations + (this.denialScoreEnabled ? this.denials : 0) : this.kills, isBot: false, isSelf: true });
    }
    scoreboard.sort((a, b) => b.score - a.score || b.kills - a.kills);
    this.opts.onHud({
      health: Math.max(0, Math.round(this.health)),
      maxHealth: MAX_HEALTH,
      ammo: this.ammoInMag,
      magSize: this.eff.magSize,
      heat: weaponById(this.weaponId).special?.kind === "heat" ? (this.heatStates.get(this.weaponId)?.heat ?? 0) : undefined,
      overheated: this.heatStates.get(this.weaponId)?.locked ?? false,
      boltCharges: this.weaponId === "crossbow_reclaimer" ? this.boltCharges : undefined,
      perkName: perkById(this.opts.loadout.perkId).name,
      scavengerFeedbackAt: this.scavengerFeedbackAt,
      scavengerAmmoGained: this.scavengerAmmoGained,
      scavengerPacksNearby: this.activePerkId === "scavenger"
        ? [...this.scavengerPickups.values()].filter(p =>
            Math.hypot(this.pos.x - p.pos[0], this.pos.z - p.pos[2]) <= 45).length : 0,
      matchEnding: this.matchFinishingLabel ?? undefined,
      quickMeleeAt: this.quickMeleeFeedbackAt,
      equipmentCharges: this.opts.mode === "gungame" ? 0 : this.equipmentCharges,
      flashRemainingMs: Math.max(0,this.equipmentFlashUntil-now),
      reloading: this.reloading,
      weaponName: weaponById(this.weaponId).name,
      weaponId: this.weaponId,
      alive: this.alive,
      respawnIn: this.alive ? 0 : Math.max(0, Math.ceil((this.respawnAt - now) / 1000)),
      kills: this.kills,
      deaths: this.deaths,
      score: this.opts.online ? (this.combatants.get(this.selfId)?.score ?? (this.opts.mode === "ctf" ? this.ctfCaptures : this.opts.mode === "killconfirmed" ? this.confirmations + (this.denialScoreEnabled ? this.denials : 0) : this.kills)) : (this.opts.mode === "ctf" ? this.ctfCaptures : this.opts.mode === "killconfirmed" ? this.confirmations + (this.denialScoreEnabled ? this.denials : 0) : this.kills),
      teamScores: this.teamScores,
      playerTeam: this.opts.team as string,
      ctfFlags: this.opts.mode === "ctf" ? this.ctfFlags : undefined,
      orbitalKillsRequired:reactorObjective(this.map)?.killsRequired,
      orbitalCharge:reactorObjective(this.map)?this.orbitalCharge:undefined,
      orbitalReaper:reactorObjective(this.map)?this.orbitalWeaponActive:undefined,
      orbitalWarning,
      mapEvent:this.map.id==="floodgate"
        ?(this.opts.online&&this.floodgateServerRulesVersion!==5
          ?{phase:"warning" as const,label:"FLOODGATE SERVER OUTDATED · redeploy to enable flood event",secondsLeft:0}
          :undefined)
        :this.map.id==="whiteout_depot"?whiteoutWeatherStatus(this.environmentTime):undefined,
      ctfOvertime: this.opts.mode === "ctf" ? this.ctfOvertime : undefined,
      ctfFlagResetMs: this.opts.mode === "ctf" ? this.ctfResetDurationMs : undefined,
      ctfCarrying: this.opts.mode === "ctf" &&
        (this.ctfFlags.red.carrierId === this.selfId || this.ctfFlags.blue.carrierId === this.selfId),
      ctfNotice: this.ctfNotice,
      ctfZoneError: orbitalWarning ?? (this.opts.mode === "ctf" && this.opts.online && !this.ctfRulesVerified
        ? "Multiplayer server has outdated CTF scoring rules. Restart/update the game server."
        : this.opts.mode === "ctf" && (this.opts.team === "red" || this.opts.team === "blue") &&
          (this.ctfFlags.red.carrierId === this.selfId || this.ctfFlags.blue.carrierId === this.selfId) &&
          ctfWithin([this.pos.x,this.pos.y,this.pos.z],this.ctfBases[this.opts.team],teamObjective(this.map,"capture_zone",this.opts.team)?.radius??4.7,teamObjective(this.map,"capture_zone",this.opts.team)?.verticalTolerance??3) &&
          !flagAtHome(this.ctfFlags[this.opts.team])
          ? "RETURN YOUR STOLEN OR DROPPED FLAG BEFORE SCORING" : undefined),
      scoreLimit: this.scoreLimit,
      timeLimitSec: this.configuredTimeLimitSec,
      confirmations: this.confirmations,
      denials: this.denials,
      denialScoreEnabled: this.denialScoreEnabled,
      tagNotice: this.tagNotice,
      timeLeft: Math.max(0, Math.ceil(this.timeLeft)),
      unlimitedTime: !this.hasTimeLimit || (this.opts.mode === "ctf" && this.ctfOvertime),
      elapsedSeconds: Math.max(0,Math.floor(this.elapsedSeconds)),
      scoreboard,
      killFeed: this.killFeed,
      lastDeath: this.lastDeath,
      lastElimination: this.lastElimination,
      hitMarker: this.hitMarkerAt,
      headshotMarker: this.headshotMarkerAt,  // Round 20g: headshot marker
      damageFlash: this.damageFlashAt,
      riotShieldHitFlash:this.riotShieldHitFlashAt,
      pointerLocked: this.pointerLocked,
      ping: this.ping,
      killstreak: this.lastKillstreak ?? undefined,
      damageDir: this.lastDamageDir ?? undefined,
      damageDirAt: this.lastDamageDirAt,
      mapName: this.map.name,
      radar: {
        size: this.map.size, playerX: this.pos.x, playerZ: this.pos.z, yaw: this.yaw,
        regions:this.map.regions?.length ? regionRectangles(this.map.regions).map(r=>({
          x:radarToPercent(r.x-r.w/2,this.map.size),z:radarToPercent(r.z-r.d/2,this.map.size),
          w:r.w/(2*this.map.size)*100,h:r.d/(2*this.map.size)*100,
        })) : undefined,
        lava: this.map.environment?.filter(o => o.type === "lava").map(o => ({
          x: radarToPercent(o.pos[0] - o.size[0], this.map.size),
          z: radarToPercent(o.pos[2] - o.size[2], this.map.size),
          w: o.size[0] / this.map.size * 100,
          h: o.size[2] / this.map.size * 100,
        })),
        cover: this.map.cover.filter(c => c.kind !== "accent" && c.kind !== "stair").slice(0, 100).map(c => ({
          x: radarToPercent(c.pos[0] - c.size[0], this.map.size),
          z: radarToPercent(c.pos[2] - c.size[2], this.map.size),
          w: Math.max(0.5, c.size[0] / this.map.size * 100),
          h: Math.max(0.5, c.size[2] / this.map.size * 100),
        })),
        markers: [
          ...[...this.combatants.values()].filter(c => c.alive && !c.isSelf &&
            friendlyOnRadar(this.opts.mode, this.opts.team, c.team)).map(c =>
              ({ id: c.id, x: radarToPercent(c.pos[0], this.map.size), z: radarToPercent(c.pos[2], this.map.size), kind: "ally" as const })),
          ...[...this.radarPings.entries()].flatMap(([id, p]) => {
            const c = this.combatants.get(id);
            // A gunshot authorizes a temporary reveal, not permanent visibility.
            // Position comes from the combatant's current server snapshot (online)
            // or simulation state (offline), and follows movement while revealed.
            if (!c || id === this.selfId || friendlyOnRadar(this.opts.mode, this.opts.team, c.team)) return [];
            const current = trackedRadarPosition(radarNow, p.expiresAt, {
              x: c.pos[0], z: c.pos[2], alive: c.alive,
            });
            if (!current) return [];
            return [{ id, x: radarToPercent(current.x, this.map.size), z: radarToPercent(current.z, this.map.size), kind: "fire" as const }];
          }),
        ],
      },
      aiming: this.aiming,
      sightType: weaponById(this.weaponId).category === "melee" ? "iron" : this.sightDef.type,
      adsProgress: weaponById(this.weaponId).category === "melee" ? 0 : this.adsProgress,
      // `scoped` is true only when the player is meaningfully ADS-ing with a
      // sniper-class weapon (adsProgress past ~50% so the scope has actually
      // reached the eye). This drives the dedicated sniper-scope HUD overlay.
      scoped: this.aiming && this.adsProgress > 0.5 && weaponById(this.weaponId).category === "sniper",
      // Round 20h: Local player spawn protection (for first-person shield overlay).
      selfSpawnProtected: this.selfSpawnProtectedUntil > Date.now(),
      // Crosshair reflects both inherent hipfire inaccuracy and accumulated
      // firing/movement bloom. High-spread weapons no longer show a misleading
      // pin-point reticle just because the player is standing still.
      spreadFactor: Math.min(2, this.currentSpread + Math.min(2,
        (weaponById(this.weaponId).category === "shotgun" && !weaponById(this.weaponId).wonder && (this.eff.pellets ?? 1) > 1
          ? shotgunConeRadians(this.eff, this.aiming)
          : shotSpread(this.eff, weaponById(this.weaponId).category, this.aiming, 0, this.shotBloom, true)) / 0.12
      ) * (this.aiming ? 0.12 : 0.8)),
      // Sprinting flag (HUD shows sprint indicator + tighter weapon-sway logic).
      sprinting: this.sprinting,
      // Health-regen cooldown in ms (0 = regen active; >0 = ms until regen starts).
      regenCooldownMs: this.alive && this.health < MAX_HEALTH
        ? Math.max(0, regenDelayMs(this.activePerkId) - (now - this.lastDamageAt))
        : 0,
      // Sprint stamina (0..100) + regen cooldown (0 = regen active; >0 = ms until regen starts).
      stamina: Math.round(this.stamina),
      staminaCooldownMs: !this.sprinting && this.stamina < 100
        ? Math.max(0, FPSEngine.STAMINA_DELAY - (now - this.lastSprintAt))
        : 0,
      // Equipped weapon slot + per-slot weapon names (for the HUD slot strip).
      weaponSlot: this.currentSlot,
      primaryName: weaponById(this.primaryWeaponId).name,
      secondaryName: weaponById(this.secondaryWeaponId).name,
      meleeName: weaponById(this.meleeWeaponId).name,
      ...(this.wonderWeaponId ? {wonderName:weaponById(this.wonderWeaponId).name,wonderWeaponId:this.wonderWeaponId} : {}),
      primaryWeaponId: this.primaryWeaponId,
      secondaryWeaponId: this.secondaryWeaponId,
      meleeWeaponId: this.meleeWeaponId,
      ...(this.wonderWeaponId===RIOT_SHIELD_ID ? {
        wonderShieldHp:this.riotShieldHp,
        wonderShieldRechargeMs:riotShieldCooldownMs(this.riotShieldHp,this.riotShieldReadyAt,now),
      }:{}),
      ...(this.wonderWeaponId && usesWonderCharges(weaponById(this.wonderWeaponId)) ? {
        wonderCharges:this.wonderStates.get(this.wonderWeaponId)?.charges??0,
        wonderChargeMax:weaponById(this.wonderWeaponId).wonder!.maxCharges,
        wonderSlotCooldownMs:wonderCooldownMs(this.ensureWonderState(this.wonderWeaponId,weaponById(this.wonderWeaponId).wonder!,now),weaponById(this.wonderWeaponId).wonder!,now),
      }:{}),
      ...(this.weaponId === "wonder_turret" ? {
        turretDeployPending: this.turretDeployPending,
        turretDeployFailed: this.turretDeployFailedAt > 0 && now - this.turretDeployFailedAt < 2000,
      } : {}),
      ...(this.weaponId===RIOT_SHIELD_ID?{riotShieldHp:this.riotShieldHp,riotShieldRaised:this.shieldRaised(),riotShieldRechargeMs:riotShieldCooldownMs(this.riotShieldHp,this.riotShieldReadyAt,now)}:{}),
      ...(usesWonderCharges(weaponById(this.weaponId)) ? { wonderRechargeMs: wonderCooldownMs(this.ensureWonderState(this.weaponId,weaponById(this.weaponId).wonder!,now), weaponById(this.weaponId).wonder!, now) } : {}),
      ...(this.opts.mode === "survival" ? {
        survivalWave: this.survivalWave,
        survivalTier: this.survivalTier,
        survivalModifierNames: survivalWaveMutators(this.survivalTier,this.survivalWave).names,
        survivalBossWave: survivalWaveMutators(this.survivalTier,this.survivalWave).boss,
        survivalEnemiesLeft: this.survivalEnemiesLeft,
        survivalReinforcements: this.survivalReinforcements,
        survivalMaxReinforcements: this.survivalMaxReinforcements,
        survivalDowned: this.survivalDowned,
        survivalWaitingForWave: this.opts.online && !this.alive && !this.matchEnded &&
          this.lastDeath?.weaponId === LAVA_DEATH_SOURCE,
        survivalPrepLeft: Math.max(0, Math.ceil(this.survivalPrepLeft)),
        survivalWaveActive: this.survivalWaveActive,
        // Round 18-b: wave banner timestamp (ms since page load). The HUD shows
        // a "WAVE N — X enemies incoming" banner for ~3.5s after this timestamp.
        survivalWaveBannerAt: this.survivalWaveBannerAt,
      } : {}),
      ...(this.opts.mode === "gungame" ? {
        gungameIndex: this.gungameIndex,
        gungameTotal: this.gungameWeapons.length,
        gungameWeapons: this.gungameWeapons,
      } : {}),
      // Pre-match countdown (0 when not counting down). The HUD shows a big
      // centered number while this is > 0.
      preMatchCountdown: Math.max(0, Math.ceil(this.preMatchCountdown)),
    });
  }

  // ---- helpers ----
  private clamp(pos: Vec3): Vec3 {
    const lim = this.map.size - 1;
    return [Math.max(-lim, Math.min(lim, pos[0])), Math.max(0, pos[1]), Math.max(-lim, Math.min(lim, pos[2]))];
  }
  // Bug 1 fix: apply the SAME cover collision logic that the player uses in
  // updateMovement to a bot's XZ position. `currentY` is the bot's feet Y at
  // the moment of the collision check (used for step-up test). Returns a new
  // Vec3 with X/Z pushed out of any blocking cover box along the axis of
  // least overlap. Used by both the engage and wander code paths in updateBotAI.
  //
  // ROBUSTNESS (Task 16-a): does 6 iterative resolution passes so a bot pushed
  // out of one box isn't pushed INTO an adjacent box. Dense maps (and the
  // upcoming density increase in Task 16-b) create clusters of adjacent boxes
  // where 3 passes could leave residual overlap. Also explicitly skips
  // "accent" and "stair" kind boxes (decorative / walkable) — only "solid",
  // "cover", and "platform" block horizontal movement. This matches the
  // player's collision behaviour (which also doesn't filter by kind but the
  // step-up + above/below checks handle platforms correctly).
  //
  // TUNNELING DEFENSE-IN-DEPTH: if a bot tunneled THROUGH a thin wall during a
  // fast frame (despite the tightened SUBSTEP=0.15 + botMoveBlocked probe), the
  // `Math.sign(out[0] - b.cx)` push-out could point to the WRONG side (the far
  // side), embedding the bot past the box edge. As a safety net, clamp the
  // result so the bot never ends up more than `b.hx + r + 0.1` from the box
  // center on the pushed axis — bounds the worst case so a wrong sign can't
  // fling the bot deep into another wall. The primary tunneling defence is the
  // substep + botMoveBlocked (which we've tightened); this clamp is just
  // insurance for the rare edge case where multiple boxes interact and a wrong
  // sign would compound.
  private collideBots(pos: Vec3, currentY: number): Vec3 {
    return resolveBotOverlap(this.coverNear(pos[0],pos[2],3), pos, currentY);
  }

  // Soft bot-vs-bot (and bot-vs-player) separation. After the cover push-out,
  // nudge the bot away from any other combatant that's too close on the XZ plane.
  // Uses a gentle lerp (* 0.5) so the push is soft — over successive frames, two
  // stacked bots move apart smoothly instead of snapping. This prevents doorway
  // jams and the ugly "two bots occupying the same point" stack.
  //
  // "Other combatants" = all other `this.combatants` (alive) PLUS the local
  // player at `this.pos` (only if `this.alive`). Dead combatants and combatants
  // on a different Y level (different floor — `|dY| > PLAYER_HEIGHT * 0.8`) are
  // skipped. The player is pushed ONLY on the bot's side — we don't mutate
  // `this.pos` (the player's own collision handles their side).
  private separateBots(bot: Combatant, currentY: number): void {
    const minDist = this.opts.mode === "ctf" ? 3.1 : 2 * PLAYER_RADIUS + 0.2;
    const minDistSq = minDist * minDist;
    const yTol = PLAYER_HEIGHT * 0.8;
    const others: { pos: Vec3; alive: boolean }[] = [];
    for (const c of this.combatants.values()) {
      if (c.id === bot.id) continue;
      others.push({ pos: c.pos, alive: c.alive });
    }
    if (this.alive) others.push({ pos: [this.pos.x, this.pos.y, this.pos.z], alive: true });
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
      if (!blocksBotMotion(this.coverAlong(before,after,2), before, after, currentY)) {
        bot.pos = after;
      }
    }
  }

  // Pre-movement collision probe: returns true if moving from `from` to `to`
  // (XZ only) would put the bot inside any blocking cover box. Used to gate
  // bot movement so they don't even STEP into a wall (prevents the visual
  // "bot clips into wall then pops out" flicker, and prevents tunneling at
  // high speeds). The check is conservative — it samples the destination only.
  private botMoveBlocked(from: Vec3, to: Vec3, currentY: number): boolean {
    const cover = this.coverAlong(from, to, 2);
    return blocksBotMotion(cover, from, to, currentY) ||
      botEntersHazard(cover, this.map.environment, from, to, this.environmentTime);
  }
  private lerpAngle(a: number, b: number, t: number): number {
    let diff = b - a; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }
  private dirFromYawPitch(yaw: number, pitch: number): Vec3 {
    const cp = Math.cos(pitch);
    return [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
  }
  private normalize(v: Vec3): Vec3 { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  private add(a: Vec3, b: Vec3): Vec3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  private randSpread(s: number): Vec3 { return [(Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s]; }

  dispose() {
    if (this.finaleTimer) { clearTimeout(this.finaleTimer); this.finaleTimer = null; }
    for (const id of [...this.poisonBubbles.keys()]) this.updatePoisonVisual(id, [0, 0, 0], null, 0);
    for (const id of [...this.kcTags.keys()]) this.removeKillConfirmedTag(id);
    this.disposed = true;
    for (const id of [...this.deathBombs.keys()]) this.removeDeathBomb(id);
    for (const id of [...this.bulletSpitters.keys()]) this.removeBulletSpitter(id);
    for (const id of [...this.gravityWells.keys()]) this.removeGravityWell(id);
    cancelAnimationFrame(this.raf);
    this.timer.dispose();
    window.removeEventListener("resize", this.onResize);
    if (this.socket) this.socket.disconnect();
    if(this.equipmentPreviewLine){
      this.scene.remove(this.equipmentPreviewLine);
      this.equipmentPreviewLine.geometry.dispose();
      (this.equipmentPreviewLine.material as THREE.Material).dispose();
      this.equipmentPreviewLine=null;
    }
    // Clean up the laser indicator meshes (if any)
    if (this.laserBeam) { this.scene.remove(this.laserBeam); (this.laserBeam.geometry as THREE.BufferGeometry).dispose(); (this.laserBeam.material as THREE.Material).dispose(); this.laserBeam = null; }
    if (this.laserDot) { this.scene.remove(this.laserDot); (this.laserDot.geometry as THREE.BufferGeometry).dispose(); (this.laserDot.material as THREE.Material).dispose(); this.laserDot = null; }
    for (const g of this.environmentMeshes.values()) {
      this.scene.remove(g);
      g.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      });
    }
    this.environmentMeshes.clear();
    for (const id of [...this.scavengerPickups.keys()]) this.removeScavengerPickup(id);
    // Recoverable bolt meshes are owned by this engine instance.
    for (const id of [...this.boltPickups.keys()]) this.removeBoltPickup(id);
    // Dispose the sound system (closes the AudioContext).
    this.remoteFootsteps.clear();
    this.clearFirstPersonRig();
    if (this.quickMeleeModel) {
      this.camera.remove(this.quickMeleeModel);
      this.quickMeleeModel.traverse(obj => { if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }});
      this.quickMeleeModel = null;
    }
    this.fpHandMat.dispose(); this.fpCuffMat.dispose();
    this.sound.dispose();
    for(const id of [...this.clusterVolleys.keys()])this.removeClusterVolley(id);
    if(this.riotShieldModel)this.disposeRiotModel(this.riotShieldModel);
    this.weaponAudio.dispose();
    this.explosionEffects?.dispose();
    if(this.gardenMaterial){
      this.gardenMaterial.map?.dispose();
      this.gardenMaterial.dispose();
      this.gardenMaterial=null;
    }
    if(this.surfaceMaterials){
      for(const m of Object.values(this.surfaceMaterials)){
        m.map?.dispose();
        m.dispose();
      }
      this.surfaceMaterials=null;
    }
    this.renderer.dispose();
    // Promptly free the graphics context between matches and dev remounts.
    this.renderer.forceContextLoss();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    if (document.pointerLockElement) document.exitPointerLock();
  }
}

// Re-export for callers that want the map list (e.g. UI)
export { MAP_LIST };
