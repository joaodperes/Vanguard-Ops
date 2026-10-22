// ============================================================================
// VANGUARD OPS — Three.js FPS engine (vanilla, no R3F)
// Supports OFFLINE (local bots, client-authoritative) and ONLINE (socket.io,
// server-authoritative) modes. Renders arena, weapons, other players, HUD data.
// ============================================================================
import * as THREE from "three";
import { coolHeat, addHeat, freshHeat, nextArcTarget, type HeatState, type ArcCandidate } from "@/lib/weapon-mechanics";
import { io as ioClient } from "socket.io-client";
import { resolveGameServerConnection } from "@/lib/game-network";
import { equipmentById } from "@/lib/equipment"; // legacy equipment models remain unused
import { friendlyOnRadar, canHearGunshot, shouldRevealGunshot, radarExpiresAt, radarDurationMs, radarToPercent, trackedRadarPosition } from "@/lib/radar";
import { quickSwapTarget } from "./quick-swap";
import { canCollectScavengerDrop } from "./scavenger-pickups";
import { chooseQuickMeleeTarget, QUICK_MELEE_DAMAGE, QUICK_MELEE_COOLDOWN_MS } from "./quick-melee";
import { botMoveMultiplier, botDecisionDelay, botReactionDelay, botTurnLerp, botAimDriftMultiplier } from "./bot-difficulty";
import { perkById, reloadDurationMultiplier, regenDelayMs, sprintDrainMultiplier, recoilMultiplier, swayMultiplier, scavengerAmmoAmount, SCAVENGER_PICKUP_RADIUS, SCAVENGER_DROP_LIFETIME_MS, SCAVENGER_PICKUP_ARM_MS } from "@/lib/perks";
import { calculateThrowPath, type ThrowPath } from "@/lib/throw-trajectory";
import { sampleReloadMotion, sampleDeployMotion, reloadMotionFor, equipmentMotionFor, deployDurationMs, type DeployMotion, type ReloadMotion, type ActionPose } from "@/lib/first-person-animation";
import { buildGunGameWeapons, canCompleteGunGame } from "@/lib/gun-game";
import { chooseBotPatrolPoint } from "@/lib/bot-patrol";
import { botNextWaypoint } from "@/lib/bot-routing";
import { normalizeSurvivalTier, survivalWaveMutators, survivalWavesCleared, type SurvivalTier } from "./survival";
import { MOVEMENT, allowsAdsWhileSprinting, shouldTouchAutoSprint, responsiveHorizontalVelocity, canUseBufferedJump } from "@/lib/movement-rules";
import {
  getMap, MAP_LIST, rayBox, rayCapsule, PLAYER_RADIUS, PLAYER_HEIGHT, EYE_HEIGHT, MAX_HEALTH, RESPAWN_DELAY_MS,
  SURVIVAL_PREP_SEC, SURVIVAL_RESPAWN_MS, survivalWaveBotCount, survivalWaveHealthMul, survivalWaveDamageMul,
  GUN_GAME_PROGRESSION, GUN_GAME_TYPE_PROGRESSION, KC_TAG_LIFETIME_MS, KC_PICKUP_RADIUS, killConfirmedPickupPoints,
  type Vec3, type LoadoutWire, type GameMode, type MapId, type MapDef, type SnapshotPlayer, type S2C, type KillFeedEntry, type CoverBox, type BotDifficulty, type KillDifficulty, type KillConfirmedTag,
} from "@/lib/game-protocol";
import {
  weaponById, weaponSkinById, playerSkinById, computeEffectiveStats,
  SIGHT_DEFS, sightDefForType, weaponSlot, WEAPONS, weaponAttachmentSlots,
  type AttachmentSlot, type EffectiveStats, type SightType, type SightDef,
  type WeaponSlot, type WeaponDef, type WeaponCategory, type WeaponConditionMetric,
} from "@/lib/game-data";
import { SoundManager } from "@/lib/sound";
import { WeaponAudio, type WeaponSoundCategory } from "@/lib/weapon-audio";
import { buildFirstPersonWeapon, weaponHoldPoints } from "@/lib/weapon-models";
import {
  makeEnvironmentMap, moveEnvironmentCover, breakEnvironmentWall, environmentPosition,
  withinEnvironment, spikesActive, closestCoverHit,
} from "@/lib/dynamic-environment";
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
  masterVolume?: number;       // 0..100, default 80. Drives the SoundManager gain.
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
  scoreLimit?: number;  // Kill target (or confirmed tags for Kill Confirmed)
  confirmations?: number;
  denials?: number;
  denialScoreEnabled?: boolean;
  tagNotice?: { action: "confirm" | "deny"; at: number };
  timeLeft: number;
  scoreboard: ScoreRow[];
  killFeed: KillFeedEntry[];
  lastElimination?: { at: number; victim: string; headshot: boolean };
  hitMarker: number;     // timestamp of last hit
  headshotMarker?: number;  // Round 20g: timestamp of last headshot hit (distinct visual)
  damageFlash: number;   // timestamp of last damage taken
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
  radar?: { size: number; playerX: number; playerZ: number; yaw: number; cover: { x: number; z: number; w: number; h: number }[]; markers: { id: string; x: number; z: number; kind: "ally" | "fire" }[] };
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
  // Per-slot weapon IDs (so the HUD can show a category-color dot per slot).
  primaryWeaponId: string;
  secondaryWeaponId: string;
  meleeWeaponId: string;
  // survival mode info (undefined for FFA/TDM)
  survivalWave?: number;
  survivalTier?: SurvivalTier;
  survivalModifierNames?: string[];
  survivalBossWave?: boolean;
  survivalEnemiesLeft?: number;
  survivalReinforcements?: number;
  survivalMaxReinforcements?: number;
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
  kills: number; deaths: number; headshots: number; won: boolean; score: number; mode: GameMode;
  standings: { id: string; name: string; team: string; kills: number; deaths: number; score: number; isBot: boolean }[];
  durationSec?: number;
  placement?: number;
  multikills?: number;
  // 19a+19b: Highest kill streak achieved in the match (kills within the
  // 5s streak window). Drives the player's lifetime bestKillstreak stat
  // (Triple Threat / Killstreak King / Untouchable Force achievements).
  bestStreak?: number;
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
  wanderTarget: Vec3;
  nextShotAt: number;
  nextDecisionAt: number;
  ammoInMag: number;
  reloadingUntil: number;
  strafeDir: number;
  moveSpeed: number;
  sprinting?: boolean;
  attachments: Record<AttachmentSlot, string | null>;
  // vertical navigation: try to climb to high ground when target is above
  wantsHighGround: boolean;
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
  pos: Vec3;
  yaw: number;
  pitch: number;
  health: number;
  alive: boolean;
  weaponId: string;
  weaponSkinId: string;
  playerSkinId: string;
  kills: number;
  deaths: number;
  score: number;
  // local (offline bots) AI fields
  ai?: BotAI;
  group?: THREE.Group;
  nameSprite?: THREE.Sprite;
  healthBar?: THREE.Mesh;
  skinMaterial?: THREE.MeshStandardMaterial;
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
  // Gun Game progression (offline gungame only) — 0-based tier index into
  // GUN_GAME_PROGRESSION. Undefined for non-gungame matches.
  gungameIndex?: number;
  // Round 19e: Spawn protection — timestamp (ms, Date.now()) until which this
  // combatant is immune to damage. Set by the server on spawn/respawn. The
  // client reads it from snapshots and shows a shield aura while active.
  spawnProtectedUntil?: number;
  // Shield mesh for spawn protection visual (created in addCombatantMesh,
  // toggled in updateCombatantMeshes).
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

// ---- Headshot collision -----------------------------------------------------
// Keep this in sync with the humanoid built by addCombatantMesh:
// the visible 0.26 × 0.28 × 0.26 head is centered 1.62 units above the feet.
// A little padding compensates for animation/network interpolation and makes
// accurately aimed shots reliable. We still use the existing capsule for the
// rest of the body, but NEVER its coarse headshot classification.
const HEAD_CENTER_Y = 1.62;
const HEAD_HALF_EXTENTS: Vec3 = [0.19, 0.18, 0.19];

function rayCombatantHit(origin: Vec3, dir: Vec3, feet: Vec3): { t: number; head: boolean } | null {
  const headCenter: Vec3 = [feet[0], feet[1] + HEAD_CENTER_Y, feet[2]];
  const headT = rayBox(origin, dir, headCenter, HEAD_HALF_EXTENTS);
  // Prefer the actual head intersection instead of an overlapping torso capsule.
  // Using headT (not the capsule's earlier entry) also respects cover occlusion.
  if (headT !== null && headT >= 0) return { t: headT, head: true };

  const bodyCenter: Vec3 = [feet[0], feet[1] + PLAYER_HEIGHT / 2, feet[2]];
  const bodyHit = rayCapsule(origin, dir, bodyCenter, PLAYER_RADIUS, PLAYER_HEIGHT);
  return bodyHit && bodyHit.t >= 0 ? { t: bodyHit.t, head: false } : null;
}

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
  private environmentTime = 0;
  private environmentWalls = new Map<string, number>();
  private environmentMeshes = new Map<string, THREE.Group>();
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
  private reloading = false;
  private reloadEndsAt = 0;
  private reloadStartedAt = 0;
  private reloadDurationMs = 0;
  // Equipment commits when the hand releases the device, not on key-down.
  // The server remains authoritative for damage, charges and cooldowns.
  private equipmentAction: { id: string; startedAt: number; kind: DeployMotion; duration: number; committed: boolean } | null = null;
  // Resources are per-weapon rather than per-slot so swapping cannot reset them.
  private heatStates = new Map<string, HeatState>();
  private boltCharges = 0;
  private boltPickups = new Map<string, { mesh: THREE.Object3D; ownerId: string; pos: Vec3; expiresAt: number; retryAt: number }>();
  private localBoltSequence = 0;
  private boltFlights = new Map<string, { start: THREE.Vector3; end: THREE.Vector3; born: number; duration: number }>();
  private poisonByVictim = new Map<string, { expiresAt: number; tickAt: number; weaponId: string }>();
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
  private fpActionHand: THREE.Group | null = null;
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

  // tracers
  private tracers: { line: THREE.Line; born: number; life: number }[] = [];
  // Rocket projectiles (visual only — damage is hitscan). Each entry tracks the
  // mesh, its start position, end position (impact point), birth time, and travel
  // duration. The projectile animates from start to end over `travelMs`, then
  // spawns an explosion at the impact point.
  private projectiles: { mesh: THREE.Object3D; start: THREE.Vector3; end: THREE.Vector3; born: number; travelMs: number; damage: number; splashRadius: number; weaponId: string; applyLocalSplash: boolean }[] = [];
  // Explosion effects: expanding sphere + point light flash at an impact point.
  private explosions: { mesh: THREE.Mesh; light: THREE.PointLight; born: number; life: number }[] = [];

  // scoring
  private kills = 0;
  private deaths = 0;
  private headshots = 0;
  private teamScores = { red: 0, blue: 0 };
  // Kill Confirmed collectibles and per-player objectives (separate from kills).
  private kcTags = new Map<string, { tag: KillConfirmedTag; mesh: THREE.Group }>();
  private kcNextTagId = 0;
  private confirmations = 0;
  private denials = 0;
  private denialScoreEnabled = false;
  private tagNotice: { action: "confirm" | "deny"; at: number } | undefined;
  private timeLeft = 360;
  private matchEnded = false;
  private matchFinishingLabel: string | null = null;
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
  // 19a+19b: Highest kill streak achieved in the current match (kills within
  // the streak window, currently 5s — see registerPlayerKill). Reset on match
  // start. Forwarded in MatchEndResult so the rewards API can update the
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
  // Per-slot effective stats (precomputed on swap to avoid recompute each shot).
  private primaryEff: EffectiveStats;
  private secondaryEff: EffectiveStats;
  private meleeEff: EffectiveStats;
  private primarySight: SightDef;
  private secondarySight: SightDef;
  private meleeSight: SightDef;
  // Swap animation: timestamp the player last swapped weapons. The viewmodel
  // dips down + back up over ~250ms for a visible swap.
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
  private lastFootstepAt = 0;    // throttle footstep SFX

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
  private survivalMaxReinforcements = 5;
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
    this.map = makeEnvironmentMap(getMap(opts.mapId));
    for (const o of this.map.environment ?? []) {
      if (o.type === "destructible_wall") this.environmentWalls.set(o.id, o.hp);
    }
    // ---- Weapon slot setup ----
    // Primary comes from loadout.weaponId. Secondary/melee fall back to defaults.
    this.primaryWeaponId = opts.loadout.weaponId;
    this.secondaryWeaponId = opts.loadout.secondaryWeaponId ?? "pistol_side";
    this.meleeWeaponId = opts.loadout.meleeWeaponId ?? "knife_tactical";
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
    this.primarySight = sightDefForType(this.primaryEff.sightType);
    this.secondarySight = sightDefForType(this.secondaryEff.sightType);
    this.meleeSight = sightDefForType(this.meleeEff.sightType);
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
    this.primaryAmmoInMag = this.primaryEff.magSize;
    this.secondaryAmmoInMag = this.secondaryEff.magSize;
    this.meleeAmmoInMag = this.meleeEff.magSize;
    // ---- Sound manager ----
    this.sound = new SoundManager();
    this.weaponAudio = new WeaponAudio(opts.masterVolume ?? 80);
    if (typeof opts.masterVolume === "number") {
      this.sound.setMasterVolume(opts.masterVolume / 100);
    }
    this.sensitivityMul = opts.sensitivity && opts.sensitivity > 0 ? opts.sensitivity : 1.0;
    this.baseFov = opts.fov ? Math.max(60, Math.min(110, opts.fov)) : 75;
    this.scoreLimit = opts.scoreLimit ?? (opts.mode === "ffa" ? 30 : opts.mode === "killconfirmed" ? 40 : opts.mode === "gungame" ? this.gungameWeapons.length : 60);
    this.denialScoreEnabled = opts.denialScoreEnabled === true || opts.roomConnect?.config?.denialScoreEnabled === true;
    this.timeLeft = opts.mode === "gungame" ? 0 : (opts.timeLimitSec ?? 360);
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
      try { this.sound.dispose(); } catch {}
      try { this.weaponAudio.dispose(); } catch {}
      throw error;
    }
    this.buildArena();
    this.buildEnvironment();
    this.buildViewmodel();
    this.createQuickMeleeModel();
    this.buildLaserIndicator();
    this.setupInput();
    if (opts.online) this.connectSocket();
    else if (opts.mode === "survival") this.setupSurvival();
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
      this.preMatchCountdown = FPSEngine.PRE_MATCH_COUNTDOWN_SEC;
      this.matchStartedAt = performance.now() + this.preMatchCountdown * 1000;
      // 19a+19b: Explicit per-match reset for offline matches. The engine is
      // freshly constructed per offline match so the field defaults are already
      // 0, but setting them here keeps the offline path symmetric with the
      // online `matchStarted` handler resets and is defensively correct if a
      // future change ever reuses an engine instance across matches.
      this.multikillsCount = 0;
      this.bestStreak = 0;
      this.recentKills = [];
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    // PCFShadowMap provides soft PCF shadows in modern Three.js.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.container.appendChild(this.renderer.domElement);

    const theme = this.map.theme;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(theme.sky);
    this.scene.fog = new THREE.Fog(theme.fog, theme.fogNear, theme.fogFar);

    this.camera = new THREE.PerspectiveCamera(this.baseFov, this.container.clientWidth / this.container.clientHeight, 0.05, 500);

    const hemi = new THREE.HemisphereLight(0x9db4c0, 0x202830, 0.9 * theme.ambient);
    this.hemiLight = hemi;
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.4);
    this.dirLight = dir;
    dir.position.set(30, 50, 20);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.left = -50; dir.shadow.camera.right = 50;
    dir.shadow.camera.top = 50; dir.shadow.camera.bottom = -50;
    dir.shadow.camera.far = 120;
    this.scene.add(dir);
    const fill = new THREE.DirectionalLight(0x4a6080, 0.4);
    fill.position.set(-20, 20, -20);
    this.scene.add(fill);
  }

  private buildArena() {
    const theme = this.map.theme;
    // floor
    const floorGeo = new THREE.PlaneGeometry(this.map.size * 2, this.map.size * 2);
    const floorMat = new THREE.MeshStandardMaterial({ color: theme.floor, roughness: 0.95, metalness: 0.0 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    // grid
    const grid = new THREE.GridHelper(this.map.size * 2, 64, theme.gridColor, theme.gridColor);
    (grid.material as THREE.Material).opacity = 0.4;
    (grid.material as THREE.Material).transparent = true;
    grid.position.y = 0.02;
    this.scene.add(grid);

    // walls
    const wallMat = new THREE.MeshStandardMaterial({ color: theme.wall, roughness: 0.8, metalness: 0.1 });
    const wallH = this.map.wallHeight;
    const t = 1;
    const s = this.map.size;
    const walls = [
      { pos: [0, wallH / 2, -s], size: [s * 2, wallH, t] },
      { pos: [0, wallH / 2, s], size: [s * 2, wallH, t] },
      { pos: [-s, wallH / 2, 0], size: [t, wallH, s * 2] },
      { pos: [s, wallH / 2, 0], size: [t, wallH, s * 2] },
    ] as const;
    for (const w of walls) {
      const geo = new THREE.BoxGeometry(w.size[0], w.size[1], w.size[2]);
      const m = new THREE.Mesh(geo, wallMat);
      m.position.set(w.pos[0], w.pos[1], w.pos[2]);
      m.castShadow = true; m.receiveShadow = true;
      this.scene.add(m);
    }

    // cover / platforms / stairs
    const coverMat = new THREE.MeshStandardMaterial({ color: theme.cover, roughness: 0.7, metalness: 0.2 });
    const accentMat = new THREE.MeshStandardMaterial({ color: theme.coverAccent, roughness: 0.5, metalness: 0.3, emissive: theme.coverAccent, emissiveIntensity: 0.25 });
    const stairMat = new THREE.MeshStandardMaterial({ color: theme.stair, roughness: 0.85, metalness: 0.15 });
    const platformMat = new THREE.MeshStandardMaterial({ color: theme.platform, roughness: 0.8, metalness: 0.2 });
    for (const c of this.map.cover) {
      if (c.environmentId) continue; // handled by animated environment meshes
      const kind = c.kind ?? "cover";
      const mat = kind === "accent" ? accentMat : kind === "stair" ? stairMat : kind === "platform" ? platformMat : coverMat;
      const geo = new THREE.BoxGeometry(c.size[0] * 2, c.size[1] * 2, c.size[2] * 2);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(c.pos[0], c.pos[1], c.pos[2]);
      m.castShadow = true; m.receiveShadow = true;
      this.scene.add(m);
      // Accent stripe on tall platforms (visual cue for climbable tops)
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

  /** Geometry is local to this engine instance and cleaned up on dispose. */
  private buildEnvironment() {
    for (const o of this.map.environment ?? []) {
      const g = new THREE.Group();
      g.position.set(...o.pos);
      g.userData.environmentType = o.type;
      if (o.type === "fire") {
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
        const wall = new THREE.Mesh(new THREE.BoxGeometry(o.size[0] * 2, o.size[1] * 2, o.size[2] * 2),
          new THREE.MeshStandardMaterial({ color: 0x9f7772, roughness: 0.88 }));
        wall.castShadow = true; wall.receiveShadow = true;
        g.add(wall);
        // Steel rim helps distinguish destructible cover from permanent concrete.
        const rim = new THREE.Mesh(new THREE.BoxGeometry(o.size[0] * 2 + 0.12, 0.12, o.size[2] * 2 + 0.12),
          new THREE.MeshStandardMaterial({ color: 0xf28d52, emissive: 0x7d3010, emissiveIntensity: 0.25 }));
        rim.position.y = o.size[1] - 0.07;
        g.add(rim);
      }
      this.scene.add(g);
      this.environmentMeshes.set(o.id, g);
    }
  }

  /** Update platform physics, trap animation and world visuals from shared time. */
  private updateEnvironment(dt: number): void {
    const previous = this.environmentTime;
    this.environmentTime += dt;
    for (const o of this.map.environment ?? []) {
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
      } else if (o.type === "spikes") {
        const active = spikesActive(o, this.environmentTime);
        // The dark base remains visible during the inactive/telegraph phase.
        g.children.forEach((child, i) => { child.visible = i === 0 || active; });
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
    const original = (this.map.environment ?? []).find(o => o.id === id);
    if (!original || original.type !== "destructible_wall") return;
    const hp = this.environmentWalls.get(id) ?? original.hp;
    if (hp <= 0) return;
    this.setEnvironmentWallHP(id, Math.max(0, hp - damage));
  }

  private setEnvironmentWallHP(id: string, hp: number): void {
    const o = (this.map.environment ?? []).find(o => o.id === id);
    if (!o || o.type !== "destructible_wall") return;
    const old = this.environmentWalls.get(id) ?? o.hp;
    this.environmentWalls.set(id, hp);
    const mesh = this.environmentMeshes.get(id);
    if (mesh) {
      mesh.visible = hp > 0;
      const wall = mesh.children[0];
      if (wall instanceof THREE.Mesh && wall.material instanceof THREE.MeshStandardMaterial) {
        const t = Math.max(0, Math.min(1, hp / o.hp));
        wall.material.color.setRGB(0.4 + t * 0.22, 0.25 + t * 0.12, 0.24 + t * 0.12);
      }
    }
    if (old > 0 && hp <= 0) {
      breakEnvironmentWall(this.map, id);
      this.spawnExplosion(new THREE.Vector3(...o.pos));
    }
  }

  /** Offline player + bot hazard damage, and client-predicted jump pad launch. */
  private interactEnvironment(): void {
    if (!this.alive || this.matchEnded) return;
    const now = performance.now();
    const feet: Vec3 = [this.pos.x, this.pos.y, this.pos.z];
    for (const o of this.map.environment ?? []) {
      if (o.type === "jump_pad" && withinEnvironment(o, feet) && this.onGround && now >= (this.environmentCooldown.get(o.id) ?? 0)) {
        this.environmentCooldown.set(o.id, now + 700);
        this.vel.y = o.launch[1];
        this.vel.x += o.launch[0];
        this.vel.z += o.launch[2];
        this.pos.y += 0.12;
        this.onGround = false;
        this.sound.play("footstep", { volume: 0.7 });
      }
      if (this.opts.online || (this.selfSpawnProtectedUntil > Date.now())) continue;
      if (o.type !== "fire" && o.type !== "spikes") continue;
      if (o.type === "spikes" && !spikesActive(o, this.environmentTime)) continue;
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
      for (const o of this.map.environment ?? []) {
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
        if (o.type === "spikes" && !spikesActive(o, this.environmentTime)) continue;
        if (!withinEnvironment(o, c.pos)) continue;
        const key = `${c.id}|${o.id}`;
        const interval = o.type === "fire" ? 250 : 900;
        if (now < (this.environmentCooldown.get(key) ?? 0)) continue;
        this.environmentCooldown.set(key, now + interval);
        c.health -= o.type === "fire" ? o.dps * interval / 1000 : o.damage;
        if (c.health <= 0) {
          c.alive = false; c.health = 0; c.deaths++;
          c.deathAnimAt = performance.now(); c.deathAnimDur = 900;
          const entry: KillFeedEntry = { killer: "Environment", victim: c.name, weapon: o.type, headshot: false, killerTeam: "ffa", victimTeam: c.team };
          this.killFeed.unshift(entry);
          if (this.killFeed.length > 6) this.killFeed.pop();
          this.opts.onKillFeed(entry);
          if (this.opts.mode !== "survival") this.scheduleRespawn(c);
          break;
        }
      }
    }
  }

  private buildViewmodel() {
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
    this.sightMesh = null;
    // The support-hand rig has a separate animation track but shares the
    // camera's local coordinate system and lifetime with the weapon model.
    this.clearFirstPersonRig();

    const skin = weaponSkinById(this.getCurrentSkinId());
    // Viewmodel uses MeshBasicMaterial (unlit, always full-bright) so the weapon is
    // guaranteed visible against any background — MeshStandardMaterial rendered too
    // dark without an environment map. We fake shading by using a lighter main colour
    // and darker accent parts.
    const baseCol = new THREE.Color(skin.color);
    // Lighten the base colour toward a mid steel-grey so the weapon reads against any
    // background (the raw skin colour #2b2f36 is too dark to see in-game).
    let lightCol = baseCol.clone().lerp(new THREE.Color(0xaab4c0), 0.7);
    // ---- Per-weapon body tint (Issue 7 + Issue c round 2) ----
    // Each weapon gets a VIBRANT unique hue so the player can tell at a glance
    // which weapon they're holding, even within the same category. Previously the
    // tints were too subtle (55% lerp toward grey washed them out). Now the tints
    // are applied with only 35% grey-lerp so the weapon's signature colour is
    // clearly visible. Default skins use the weapon's signature tint; unlocked
    // skins override this with the skin's color.
    const isDefaultSkin = skin.id === "default";
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
      };
      const tint = weaponTints[this.weaponId];
      if (tint !== undefined) {
        // Reduced grey-lerp from 55% → 35% so the weapon's signature colour is
        // clearly visible (not washed out). The tint is the dominant colour now.
        lightCol = new THREE.Color(tint).lerp(new THREE.Color(0xaab4c0), 0.35);
      }
    }
    const darkCol = baseCol.clone().lerp(new THREE.Color(0x000000), 0.35);
    const emissiveCol = skin.emissive ? new THREE.Color(skin.emissive) : null;
    this.weaponMat = new THREE.MeshBasicMaterial({
      color: lightCol,
    }) as unknown as THREE.MeshStandardMaterial; // keep type for muzzle flash tinting
    if (emissiveCol) {
      // For glowing skins, tint the basic material toward the emissive colour.
      (this.weaponMat as unknown as THREE.MeshBasicMaterial).color.lerp(emissiveCol, 0.4);
    }
    const accentMat = new THREE.MeshBasicMaterial({ color: darkCol });
    const glowMat = emissiveCol
      ? new THREE.MeshBasicMaterial({ color: emissiveCol })
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
      // ---- Melee weapons: blade or shaft, no barrel/mag/grip/stock ----
      if (wid === "hammer" || wid === "axe") {
        // Long haft sits in the fist; enlarged head remains visible above it.
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.029, 0.69, 10), accentMat);
        handle.rotation.x = Math.PI / 2;
        addPart(handle, 0, -0.045, -0.17);
        if (wid === "hammer") {
          const head = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.14, 0.16), this.weaponMat);
          addPart(head, 0, -0.045, -0.48);
          const strikingFace = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.155, 0.18), accentMat);
          addPart(strikingFace, 0.14, -0.045, -0.48);
        } else {
          const blade = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.075, 0.24), this.weaponMat);
          addPart(blade, 0, -0.045, -0.48);
          const edge = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.09, 0.25), accentMat);
          addPart(edge, -0.15, -0.045, -0.48);
        }
        muzzleZ = -0.55;
      } else if (wid === "baton") {
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.026, 0.63, 12), this.weaponMat);
        shaft.rotation.x = Math.PI / 2;
        addPart(shaft, 0, -0.05, -0.16);
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.035, 0.045), accentMat);
        addPart(guard, 0, -0.05, 0.08);
        muzzleZ = -0.47;
      } else if (wid === "machete") {
        // Machete: long broad blade + small handle
        const handle = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, 0.04, 0.10),
          accentMat,
        );
        addPart(handle, 0, -0.05, 0.10);
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.03, 0.06, 0.45),
          this.weaponMat,
        );
        addPart(blade, 0, -0.05, -0.22);
        muzzleZ = -0.45;
      } else if (wid === "shiv") {
        // Shiv: small improvised blade
        const handle = new THREE.Mesh(
          new THREE.BoxGeometry(0.035, 0.035, 0.08),
          accentMat,
        );
        addPart(handle, 0, -0.05, 0.08);
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.02, 0.035, 0.22),
          this.weaponMat,
        );
        addPart(blade, 0, -0.05, -0.13);
        muzzleZ = -0.25;
      } else {
        // knife_tactical (default melee): standard combat knife
        const handle = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, 0.04, 0.10),
          accentMat,
        );
        addPart(handle, 0, -0.05, 0.08);
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.025, 0.05, 0.32),
          this.weaponMat,
        );
        addPart(blade, 0, -0.05, -0.18);
        muzzleZ = -0.35;
      }
    } else {
      // Every ranged weapon is now built from its OWN substantial 3D silhouette,
      // rather than a common category receiver with tiny extra details.
      // The helper returns the actual barrel tip for muzzle-flash attachments.
      muzzleZ = buildFirstPersonWeapon(wid, this.weaponMat, accentMat, addPart);
    }
    // ---- Category accent band (Issue c round 2) ----
    // A bright, saturated COLOURED BAND wrapped around the weapon body near the
    // front of the receiver. The colour identifies the weapon CATEGORY at a
    // glance — even if the player can't see the full silhouette, the coloured
    // band tells them "red = assault rifle, yellow = SMG, orange = shotgun,
    // purple = sniper, green = LMG, blue = DMR, white = sidearm". This is the
    // single most impactful visual cue for weapon identification.
    // The band is ONLY added for ranged weapons (not melee — melee weapons
    // already have distinct shapes: knife/shiv/machete/hammer).
    if (category !== "melee") {
      const categoryAccentColors: Record<string, number> = {
        assault: 0xff3b3b,    // red
        smg: 0xffd93b,        // yellow
        shotgun: 0xff8c3b,    // orange
        dmr: 0x3b7bff,        // blue
        sniper: 0x9b3bff,     // purple
        lmg: 0x3bff7b,        // green
        sidearm: 0xe0e0e0,    // white
      };
      const accentColor = categoryAccentColors[category] ?? 0xffffff;
      const bandMat = new THREE.MeshBasicMaterial({ color: accentColor });
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
    const sightId = currentAtts.sight;
    // Render the sight mesh when a sight attachment is equipped OR when the
    // weapon has a non-iron base sight (e.g. snipers ship with a sniper_scope
    // by default — the scope should be visible on the model even with no
    // attachment equipped).
    const wDef = weaponById(this.weaponId);
    const hasBaseScope = wDef.baseSightType && wDef.baseSightType !== "iron";
    if (category !== "melee" && (sightId || hasBaseScope)) {
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
          new THREE.MeshBasicMaterial({ color: 0xff2222 })
        );
        emitter.position.set(0, 0, -0.031);
        emitter.rotation.y = Math.PI;
        scopeGroup.add(emitter);
      } else {
        // Iron sight: simple post + ring
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.04, 0.005), accentMat);
        post.position.y = 0.02;
        scopeGroup.add(post);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.004, 6, 14), accentMat);
        scopeGroup.add(ring);
      }
      addPart(scopeGroup, 0, 0.08, -0.1);
      this.sightMesh = scopeGroup;
    }
    // Poison tips are part of the BOLT, not a muzzle suppressor.
    const hasMuzzleAttachment = !!currentAtts.barrel && currentAtts.barrel !== "barrel_poison";
    if (this.weaponId === "crossbow_reclaimer" && currentAtts.barrel === "barrel_poison") {
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.027, 0.11, 8),
        new THREE.MeshBasicMaterial({ color: 0x75f26d })
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

    // Permanent right-hand contact: the new articulated support hand appears
    // only while operating equipment/reloading, but the weapon no longer looks
    // like it is floating during idle, sprint and firing animations.
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
  }

  /** Procedural camera-space glove, forearm and held object. Kept separate from
   *  vmParts so the support hand can reach down for a magazine or forward for
   *  a grenade without warping the receiver/barrel meshes. */
  private buildFirstPersonRig() {
    const hand = new THREE.Group();
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(.049,.065,.35,9), this.fpCuffMat);
    forearm.rotation.set(.42,0,-.27); forearm.position.set(.12,-.14,.15);
    hand.add(forearm);
    const glove = new THREE.Mesh(new THREE.BoxGeometry(.135,.105,.145),this.fpHandMat);
    glove.position.set(0,0,-.03); hand.add(glove);
    const knuckles = new THREE.Mesh(new THREE.BoxGeometry(.113,.022,.05),this.fpCuffMat);
    knuckles.position.set(0,.048,-.08); hand.add(knuckles);
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(.044,.085,.058),this.fpHandMat);
    thumb.position.set(-.08,-.027,-.02); thumb.rotation.z=.25; hand.add(thumb);
    hand.visible = false;
    this.fpActionHand = hand;
    this.camera.add(hand);
    this.fpActionProp = new THREE.Group();
    this.fpActionProp.visible = false;
    this.camera.add(this.fpActionProp);
  }

  private clearFirstPersonRig() {
    for (const root of [this.fpActionHand, this.fpActionProp]) {
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
    } else if (id === "bolt") {
      add(new THREE.CylinderGeometry(.013,.013,.31,8),steel,[0,0,0]);
      add(new THREE.ConeGeometry(.024,.065,7),amber,[0,.18,0]);
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

  private renderFirstPersonAction(now: number, visibleWeapon: boolean) {
    const hand=this.fpActionHand, prop=this.fpActionProp;
    if (!hand || !prop) return;
    let pose: ActionPose | null = null;
    let propId = "";
    if (this.equipmentAction) {
      const a=this.equipmentAction;
      pose=sampleDeployMotion((now-a.startedAt)/a.duration,a.kind);
      propId=a.id;
    } else if (this.reloading) {
      const def=weaponById(this.weaponId);
      const style=reloadMotionFor(this.weaponId,def.category,def.special?.kind);
      pose=sampleReloadMotion((now-this.reloadStartedAt)/Math.max(1,this.reloadDurationMs),style);
      propId=style;
    }
    hand.visible=!!pose && this.alive && visibleWeapon;
    prop.visible=!!pose?.propVisible && this.alive && visibleWeapon;
    if (!pose || !visibleWeapon) return;
    this.ensureFirstPersonProp(propId);
    if (this.equipmentAction) {
      hand.position.set(...pose.hand);
      prop.position.set(...pose.prop);
    } else {
      hand.position.set(pose.hand[0]+this.vmOffset.x,pose.hand[1]+this.vmOffset.y,pose.hand[2]+this.vmOffset.z);
      prop.position.set(pose.prop[0]+this.vmOffset.x,pose.prop[1]+this.vmOffset.y,pose.prop[2]+this.vmOffset.z);
    }
    hand.rotation.set(pose.handRoll*.25,0,pose.handRoll);
    prop.rotation.set(0,0,pose.handRoll*.6);
  }

  // ADS fix: when aiming, move viewmodel well below camera centerline and pull closer,
  // so the bulk of the weapon drops out of view and the camera "looks down the barrel".
  // The sight mesh is hidden during ADS so it never blocks the screen.
  // On touch devices, the Fire/ADS buttons cluster in the bottom-right corner, so we
  // shift the hipfire viewmodel toward the bottom-centre/left to stay visible.
  private positionViewmodel() {
    // Weapon sits on the player's RIGHT side (positive X in camera-local space),
    // like every classic FPS viewmodel. Desktop uses a stronger rightward offset;
    // mobile uses a smaller rightward offset so it doesn't sit under the
    // bottom-right action buttons.
    const hipTarget = this.touchMode
      ? { x: 0.22, y: -0.20, z: -0.50 }   // mobile: right side, lower, away from buttons
      : { x: 0.30, y: -0.18, z: -0.48 };  // desktop: clearly right-offset (CoD-style)
    // ---- ADS target depends on sight type ----
    // Issue d fix: Previously the iron-sight ADS target was y=-0.06, which put
    // the weapon body's TOP (carry handle, rail, sight base) at y≈+0.015 —
    // ABOVE the camera center, partially blocking the view. Now the iron-sight
    // ADS target is y=-0.10, so the body top is at y≈-0.025 — below the camera.
    // The gun is still "raised" (vs hip-fire y=-0.18) but low enough that no
    // solid object crosses the camera centerline. The HUD crosshair/dot handles
    // the actual aiming reference (always at exact screen center).
    // Magnified scopes: gun kept even lower (y=-0.14) so the scope tube and
    // barrel are well below the camera. The HUD scope overlay (vignette +
    // reticle) handles the scope visual — the 3D scope mesh is hidden during
    // ADS (see hideSightDuringADS below) so it never blocks the view.
    const wDef = weaponById(this.weaponId);
    const isSniperScoped = wDef.category === "sniper" && this.adsProgress > 0.5;
    const isMagnifiedSight = this.sightDef.type === "acog" || this.sightDef.type === "hunter" ||
      this.sightDef.type === "thermal" || this.sightDef.type === "nvg" || this.sightDef.type === "sniper_scope";
    const adsTarget = isMagnifiedSight || isSniperScoped
      ? { x: 0.0, y: -0.19, z: -0.22 }   // scoped: gun lower so scope is at eye, barrel hidden below
      : { x: 0.0, y: -0.15, z: -0.38 };  // iron/red_dot: gun raised but BELOW camera centerline so body/rail don't block view
    // Sprint pose: weapon lowered + tilted inward (tucked run stance).
    const sprintTarget = { x: 0.32, y: -0.32, z: -0.40 };
    // Melee is a one-handed upright hold on the right, not a rifle held below
    // the camera. This also exposes the hammer/axe head during idle movement.
    const meleePose = this.touchMode ? { x: 0.25, y: -0.11, z: -0.47 } : { x: 0.35, y: -0.085, z: -0.49 };
    let target = wDef.category === "melee" ? meleePose : (this.aiming ? adsTarget : hipTarget);
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
    // ---- Weapon-swap dip animation (Issue 3 + 4) ----
    // A dramatic 450ms 3-phase animation that makes the weapon change obvious:
    //   Phase 1 (0-160ms): weapon drops DOWN + pitches forward + cants right,
    //                       sliding out of view (the "holster" motion).
    //   Phase 2 (160-300ms): weapon is fully lowered (off-screen) — this is the
    //                       "gap" where the old weapon is gone and the new one
    //                       is being drawn. ADS is FORCED off during this window.
    //   Phase 3 (300-450ms): weapon rises back UP into the ready position,
    //                       pitching back to level (the "draw" motion).
    // The dip is deep enough (-0.55) that the weapon goes fully below the
    // camera's view, so the player sees the gun disappear and reappear — a
    // clear visual cue that the weapon changed. The old 250ms / -0.25 dip was
    // too subtle (the gun barely moved and the change was easy to miss).
    let swapDipY = 0, swapPitch = 0, swapRoll = 0;
    let swapActive = false;
    if (this.swapAnimAt) {
      const age = performance.now() - this.swapAnimAt;
      const dur = 450;
      if (age < dur) {
        swapActive = true;
        const p = age / dur;
        if (p < 0.35) {
          // Phase 1: drop down + pitch forward (holster)
          const t = p / 0.35;
          swapDipY = -0.55 * t;
          swapPitch = 0.8 * t;    // muzzle tips down
          swapRoll = 0.35 * t;    // weapon cants right
        } else if (p < 0.65) {
          // Phase 2: fully lowered (off-screen) — hold at the bottom
          swapDipY = -0.55;
          swapPitch = 0.8;
          swapRoll = 0.35;
        } else {
          // Phase 3: rise back up (draw) — ease out
          const t = (p - 0.65) / 0.35;
          const ease = 1 - Math.pow(1 - t, 3);  // ease-out cubic
          swapDipY = -0.55 * (1 - ease);
          swapPitch = 0.8 * (1 - ease);
          swapRoll = 0.35 * (1 - ease);
        }
      } else {
        this.swapAnimAt = 0;  // animation complete
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
    this.vmOffset.x += (target.x + sprintSwayX - this.vmOffset.x) * lerpRate;
    this.vmOffset.y += ((target.y + bobY + sprintSwayY + swapDipY) - this.vmOffset.y) * lerpRate;
    this.vmOffset.z += (target.z - this.vmOffset.z) * lerpRate;

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

    // ---- Melee swing animation ----
    // The weapon sweeps from upper-right to lower-left across the swing duration
    // (a "slashing" motion). Progress 0..1: first half swings forward + down
    // (the strike), second half recovers back to ready position.
    let meleeSwingPitch = 0, meleeSwingRoll = 0, meleeSwingY = 0;
    if (this.meleeSwingAt) {
      const age = performance.now() - this.meleeSwingAt;
      if (age < this.meleeSwingDur) {
        const p = age / this.meleeSwingDur;
        // Sharp forward slice: peak at p=0.35 (strike point), then recover.
        const strike = Math.sin(p * Math.PI);  // 0..1..0 bell
        meleeSwingPitch = -1.4 * strike;        // muzzle sweeps DOWN hard
        meleeSwingRoll = 0.9 * strike;          // weapon cants right (forehand slash)
        meleeSwingY = -0.08 * strike;           // small dip to sell the weight
      } else {
        this.meleeSwingAt = 0;  // animation complete
      }
    }

    // Apply the offset (+ recoil kick-back + reload dip + sprint sway) to each viewmodel part.
    // Parts are direct children of the camera, so their local position is camera-local.
    const ox = this.vmOffset.x;
    const oy = this.vmOffset.y + reloadDipY + meleeSwingY;
    const oz = this.vmOffset.z + this.vmRecoilZ;
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
    const isMeleeWeapon = weaponById(this.weaponId).category === "melee";
    const meleeHoldPitch = isMeleeWeapon ? Math.PI / 2.9 : 0;  // positive X pitch lifts -Z-pointing blades into view
    const totalRotX = reloadPitch + this.vmRecoilPitch + sprintPitch + meleeSwingPitch + swapPitch + meleeHoldPitch;
    const totalRotZ = reloadRoll + sprintRoll + meleeSwingRoll + swapRoll;
    // Compute ONE quaternion for the complete weapon. The same quaternion must
    // rotate both each part's centre (around the grip) AND its orientation.
    // Euler XYZ composes X*Z; the old hand-written coordinates composed Z*X,
    // so parts diverged whenever reload pitch and roll were both non-zero.
    this._vmTotalQuat.setFromEuler(this._vmTotalEuler.set(totalRotX, 0, totalRotZ, "XYZ"));
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
    const hideSightDuringADS = this.adsProgress > 0.15;
    const hideEntireViewmodel = !this.reloading && !this.equipmentAction && (isSniperScoped || (isMagnifiedSight && this.adsProgress > 0.5));
    const quickMeleeActive = this.updateQuickMeleeModel(now);
    for (const p of this.vmParts) {
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
    // Sight mesh visibility: hidden during ADS (for ALL sight types) so it
    // never blocks the camera. The HUD reticle/scope overlay handles aiming.
    if (this.sightMesh) {
      this.sightMesh.visible = !quickMeleeActive && !hideEntireViewmodel && !hideSightDuringADS;
    }
    this.renderFirstPersonAction(now, !hideEntireViewmodel);
  }

  // ---- Laser indicator ----
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
    // Muzzle origin: camera position offset slightly down/forward (approximate barrel exit)
    const origin = new THREE.Vector3(this.pos.x, this.pos.y + EYE_HEIGHT - 0.1, this.pos.z);
    // Aim direction: same as aimDir but with zero spread (laser shows where you'd actually hit)
    const cp = Math.cos(this.pitch);
    const dir: Vec3 = [Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp];
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
    posAttr.setXYZ(0, origin.x, origin.y, origin.z);
    posAttr.setXYZ(1, endX, endY, endZ);
    posAttr.needsUpdate = true;
    // Place the dot at the impact point
    this.laserDot.position.set(endX, endY, endZ);
    // Pulse the dot opacity slightly for visibility
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.012);
    (this.laserDot.material as THREE.MeshBasicMaterial).opacity = pulse;
  }

  /** Independent first-person quick-melee prop. Does not change the weapon slot,
   * active ammunition, attachment state, or multiplayer weapon identity. */
  private createQuickMeleeModel() {
    const group = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.040, 0.34, 10),
      new THREE.MeshStandardMaterial({ color: 0x262c32, metalness: 0.35, roughness: 0.72 }));
    handle.position.y = -0.12; group.add(handle);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.026, 0.065),
      new THREE.MeshStandardMaterial({ color: 0x687480, metalness: 0.7 }));
    guard.position.y = 0.06; group.add(guard);
    const isBaton = this.meleeWeaponId === "baton";
    const isHeavy = this.meleeWeaponId === "hammer" || this.meleeWeaponId === "axe";
    if (isBaton) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.031, 0.43, 10),
        new THREE.MeshStandardMaterial({ color: 0x455963, emissive: 0x074b73, emissiveIntensity: 0.8 }));
      rod.position.y = 0.29; group.add(rod);
    } else if (isHeavy) {
      const head = new THREE.Mesh(new THREE.BoxGeometry(this.meleeWeaponId === "axe" ? 0.32 : 0.27, 0.15, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x91a5b3, metalness: 0.75 }));
      head.position.y = 0.32; group.add(head);
    } else {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.066, this.meleeWeaponId === "machete" ? 0.52 : 0.37, 0.018),
        new THREE.MeshStandardMaterial({ color: 0xc3d2de, metalness: 0.77, roughness: 0.3 }));
      blade.position.y = 0.27; group.add(blade);
    }
    const fist = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.13, 0.13),
      new THREE.MeshStandardMaterial({ color: 0x354652 }));
    fist.position.set(0.025, -0.19, 0.03); group.add(fist);
    group.visible = false;
    this.camera.add(group);
    this.quickMeleeModel = group;
  }
  private updateQuickMeleeModel(now: number): boolean {
    if (!this.quickMeleeModel) return false;
    const progress = (now - this.quickMeleeFeedbackAt) / this.meleeSwingDur;
    const active = this.quickMeleeFeedbackAt > 0 && progress >= 0 && progress < 1;
    this.quickMeleeModel.visible = active && this.alive;
    if (active) {
      const slice = Math.sin(Math.PI * progress);
      this.quickMeleeModel.position.set(0.37 - 0.20 * slice, -0.30 + 0.18 * slice, -0.56 - 0.19 * slice);
      this.quickMeleeModel.rotation.set(-0.34 - 1.25 * slice, -0.35, -0.55 + 1.3 * slice);
    }
    return active;
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
      if (this.touchMode) return; // touch devices don't use pointer lock
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
      if (this.touchMode) return;
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
    if (!this.alive || this.matchEnded || this.lobbyActive || this.preMatchCountdown > 0 || this.opts.mode === "gungame") return;
    const now = performance.now();
    if (now - this.quickMeleeLastAt < QUICK_MELEE_COOLDOWN_MS) return;
    this.quickMeleeLastAt = now;
    this.selfSpawnProtectedUntil = 0;
    this.quickMeleeFeedbackAt = now;
    this.meleeSwingAt = 0; // quick-melee viewmodel has its own animation
    this.meleeSwingDur = 390;
    this.manualAiming = false;
    this.weaponAudio.play("melee", { weaponId: this.meleeWeaponId, volume: 0.9 });
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
      });
    if (candidate) {
      const target = this.combatants.get(candidate.id);
      if (target) {
        this.applyDamageLocal(target, QUICK_MELEE_DAMAGE, false, this.meleeWeaponId);
        this.hitMarkerAt = now;
        this.sound.play("melee_hit", { volume: 0.7 });
      }
    }
  }

  // Fourth equipment slot. Offline damage is simulated locally; online usage
  // only sends an intent. The server validates the player's selection, charges,
  // cooldown, victim teams and spawn protection before applying damage.
  private useEquipment(): void {
    return; // v9: equipment retired, all such actions replaced with passive perks
    if (this.matchEnded || !this.alive || this.lobbyActive || this.preMatchCountdown > 0 || this.opts.mode === "gungame") return;
    if (performance.now() < this.equipmentStunUntil || this.equipmentAction || this.reloading) return;
    const def = equipmentById(this.opts.loadout.equipmentId);
    const now = performance.now();
    if (this.equipmentCharges <= 0 || now - this.equipmentLastAt < def.cooldownMs) return;
    const kind = equipmentMotionFor(def.id);
    this.manualAiming = false;
    this.equipmentAction = {id:def.id,kind,startedAt:now,duration:deployDurationMs(kind),committed:false};
    this.sound.play("swap", {volume:.25});
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

  // ---- Weapon swap (primary / secondary / melee) ----
  // Switches the active weapon slot. Plays a swap SFX + dip animation, refreshes
  // eff/sightDef/ammo for the new slot, and notifies the server (online) so
  // other players see the weapon change. Gun Game ignores this (weapon is
  // driven by progression).
  swapWeapon(slot: WeaponSlot) {
    if (this.equipmentAction) return;
    if (this.opts.mode === "gungame") return;  // gungame auto-advances; no manual swap
    if (this.currentSlot === slot) return;
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
    } else {
      this.weaponId = this.meleeWeaponId;
      this.eff = this.meleeEff;
      this.sightDef = this.meleeSight;
      this.ammoInMag = this.meleeAmmoInMag;
    }
    this.reloading = false;
    this.swapAnimAt = performance.now() - (this.activePerkId === "quickdraw" ? 155 : 0);
    this.swapReadyAt = performance.now() + (this.activePerkId === "quickdraw" ? 110 : 290);
    this.sound.play("swap", { volume: 0.6 });
    // Rebuild the viewmodel for the new weapon (different geometry/material).
    this.buildViewmodel();
    // Notify the server (online) so other players see the swap + the server
    // validates shots against the new weapon's stats.
    if (this.opts.online && this.socket?.connected) {
      this.socket.emit("message", { t: "weaponSwap", slot } as any);
    }
  }

  // Public getter for the current slot (used by the HUD).
  getCurrentSlot(): WeaponSlot { return this.currentSlot; }

  // Round 20a: Public getter for socket connection state (used by GameCanvas lobby UI).
  getSocketConnected(): boolean { return !!this.socket?.connected; }

  // ---- Round 19o: Per-slot ammo save/restore helpers ----
  // Saves the current ammoInMag to the specified slot's tracked ammo.
  private saveAmmoToSlot(slot: WeaponSlot) {
    if (slot === "primary") this.primaryAmmoInMag = this.ammoInMag;
    else if (slot === "secondary") this.secondaryAmmoInMag = this.ammoInMag;
    else this.meleeAmmoInMag = this.ammoInMag;
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
    const objectiveScore = this.opts.mode === "killconfirmed" ? this.confirmations + (this.denialScoreEnabled ? this.denials : 0) : this.kills;
    const others = [...this.combatants.values()].filter((c) => c.id !== this.selfId);
    const standings = [...others, {
      id: this.selfId, name: this.opts.playerName, team: this.opts.team as string,
      kills: this.kills, deaths: this.deaths, score: isSurvival ? this.survivalWave : objectiveScore, isBot: false,
    }].map((c) => ({ id: c.id, name: c.name, team: c.team, kills: c.kills, deaths: c.deaths, score: c.score ?? c.kills, isBot: c.isBot }))
      .sort((a, b) => b.score - a.score || b.kills - a.kills);
    const placement = standings.findIndex((s) => s.id === this.selfId) + 1;
    const durationSec = Math.max(0, Math.round((performance.now() - this.matchStartedAt) / 1000));
    // Treat a mid-match leave as a loss (the player didn't win by leaving).
    const won = false;
    return {
      kills: this.kills, deaths: this.deaths, headshots: this.headshots, won,
      score: isSurvival ? this.survivalWave : objectiveScore, mode: this.opts.mode, standings,
      durationSec, placement: placement || 1, multikills: this.multikillsCount, bestStreak: this.bestStreak, weaponId: this.weaponId,
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
    if (this.opts.mode === "gungame") return { sight: null, barrel: null, grip: null, magazine: null };
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
    if (this.opts.mode === "gungame") return "default";
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
  private setupOfflineBots() {
    let i = 0;
    const botWeapons = ["rifle_ar", "smg_kp", "rifle_dm", "rifle_ar", "smg_kp"];
    const isGungame = this.opts.mode === "gungame";
    for (let n = 0; n < this.opts.botCount; n++) {
      const team = (this.opts.mode === "tdm" || this.opts.mode === "killconfirmed") ? (i % 2 === 0 ? "red" : "blue") : "ffa";
      const id = "bot_" + n;
      const sp = this.pickSpawn(team);
      const wid = isGungame ? this.gungameWeapons[0] : botWeapons[i % botWeapons.length];
      const c: Combatant = {
        id, name: "Bot-" + (n + 1), team, isBot: true, isSelf: false,
        pos: sp, yaw: 0, pitch: 0, health: MAX_HEALTH, alive: true,
        weaponId: wid, weaponSkinId: "default", playerSkinId: isGungame ? "default" : ["default", "red", "blue", "green"][i % 4],
        kills: 0, deaths: 0, score: 0,
        ai: this.makeBotAI(sp),
        gungameIndex: isGungame ? 0 : undefined,
      };
      this.combatants.set(id, c);
      this.addCombatantMesh(c);
      i++;
    }
    if (this.opts.mode === "tdm" || this.opts.mode === "killconfirmed") {
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
  private makeBotAI(sp: Vec3): BotAI {
    const skillRange: Record<Exclude<BotDifficulty, "mixed">, [number, number]> = {
      easy: [0.28, 0.45],
      normal: [0.45, 0.65],
      hard: [0.65, 0.80],
      veteran: [0.80, 0.95],
    };
    // Resolve "mixed" by rolling a random tier for this bot.
    let diff: Exclude<BotDifficulty, "mixed">;
    if (this.botDifficulty === "mixed") {
      const opts: Exclude<BotDifficulty, "mixed">[] = ["easy", "normal", "hard", "veteran"];
      diff = opts[Math.floor(Math.random() * opts.length)];
    } else {
      diff = this.botDifficulty;
    }
    const [lo, hi] = skillRange[diff];
    const skill = lo + Math.random() * (hi - lo);
    return {
      targetId: null,
      wanderTarget: sp,
      nextShotAt: 0,
      nextDecisionAt: 0,
      ammoInMag: 30,
      reloadingUntil: 0,
      strafeDir: Math.random() < 0.5 ? 1 : -1,
      moveSpeed: (0.55 + Math.random() * 0.3) * botMoveMultiplier(diff),
      attachments: { sight: null, barrel: null, grip: null, magazine: null },
      wantsHighGround: Math.random() < 0.3,
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
    this.survivalMaxReinforcements = 5;
    this.survivalReinforcements = this.survivalMaxReinforcements;
    this.survivalWave = 0;
    this.survivalPrepLeft = 5;       // short initial prep before wave 1
    this.survivalWaveActive = false;
    this.timeLeft = 99999;           // survival has no time limit
  }

  private startSurvivalWave() {
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
    // ---- Round 18-b: expanded random weapon pool ----
    // Previously only 6 weapons cycled. Now use ALL primary + secondary weapons
    // (excluding melee and launcher — those are problematic for bot AI) for
    // much more gameplay variety. Each bot gets a truly random weapon.
    const botWeapons = [
      "rifle_ar", "rifle_burst", "rifle_heavy",       // assault
      "smg_kp", "smg_vector", "smg_compact",            // smg
      "shotgun_br", "shotgun_auto", "shotgun_combat",   // shotgun
      "rifle_dm", "dmr_scout", "dmr_heavy",             // dmr
      "sniper_scout", "sniper_lr", "sniper_heavy",      // sniper
      "lmg_hv", "lmg_light", "lmg_heavy",               // lmg
      "pistol_side", "pistol_burst", "pistol_machine", "pistol_magnum", // sidearms
    ];
    const skins = ["red", "orange", "purple", "default", "red", "blue", "green", "phantom"];
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
      const ai=this.makeBotAI(sp);
      ai.moveSpeed*=mutators.speedMul*(boss ? 1.3:1);
      ai.skill=Math.min(0.98,ai.skill+mutators.skillBoost);
      if(mutators.skillBoost>0) ai.difficulty="veteran";
      ai.ammoInMag=weaponById(wid).stats.magSize;
      if(boss) this.survivalBossTimers.set(id,{phase:0,nextPhaseAt:performance.now()+5000,nextSkillAt:performance.now()+8500});
      const c: Combatant = {
        id, name: boss ? `BOSS · W${this.survivalWave}` : `W${this.survivalWave}·${n + 1}`, team: "red", isBot: true, isSelf: false,
        pos: sp, yaw: 0, pitch: 0, health: Math.round(MAX_HEALTH * hpMul * (boss ? 6 : 1)), alive: true,
        weaponId: wid, weaponSkinId: "default", playerSkinId: skins[n % skins.length],
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
    const weaponMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.6 });

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

    // ---- Third-person weapon (model faces character-forward +Z) ----
    // The procedural weapon builder is camera-local (-Z forward). Its geometry,
    // hand contacts and muzzle direction are all rotated by 180° about Y for
    // soldiers, so rifles actually point ahead of the character.
    const weaponStub = new THREE.Group();
    const wcat = weaponById(c.weaponId).category;
    const wid = c.weaponId;
    if (wcat === "melee") {
      // Melee blades are held upright in the right hand instead of pointing
      // horizontally out of the model's stomach.
      weaponStub.rotation.x = -Math.PI / 2.7;
      if (wid === "hammer" || wid === "axe") {
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.4, 10), weaponMat);
        handle.rotation.x = Math.PI / 2;
        handle.position.set(0, 0, 0.15);
        weaponStub.add(handle);
        const head = new THREE.Mesh(new THREE.BoxGeometry(wid === "axe" ? 0.30 : 0.22, 0.10, 0.15), weaponMat);
        head.position.set(0, 0.02, 0.38);
        weaponStub.add(head);
      } else if (wid === "baton") {
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.027,0.029,.54,10), weaponMat);
        shaft.rotation.x = Math.PI/2;
        shaft.position.z = .20;
        weaponStub.add(shaft);
      } else if (wid === "machete") {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.05, 0.38), weaponMat);
        blade.position.set(0, 0, 0.22);
        weaponStub.add(blade);
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.09), weaponMat);
        handle.position.set(0, 0, 0.0);
        weaponStub.add(handle);
      } else if (wid === "shiv") {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.03, 0.20), weaponMat);
        blade.position.set(0, 0, 0.14);
        weaponStub.add(blade);
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.07), weaponMat);
        handle.position.set(0, 0, 0.0);
        weaponStub.add(handle);
      } else {
        // knife_tactical (default)
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.04, 0.28), weaponMat);
        blade.position.set(0, 0, 0.18);
        weaponStub.add(blade);
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.09), weaponMat);
        handle.position.set(0, 0, 0.0);
        weaponStub.add(handle);
      }
    } else {
      // Other players/bots carry the SAME distinctive weapon silhouettes as the
      // local player. The first-person builder points toward camera -Z; rotate
      // its output 180° so it points forward (+Z) in the humanoid's hands.
      const visual = new THREE.Group();
      visual.rotation.y = Math.PI;
      visual.scale.setScalar(BOT_WEAPON_VISUAL_SCALE);
      const weaponFurniture = new THREE.MeshStandardMaterial({
        color: 0x28323b, roughness: 0.82, metalness: 0.18,
      });
      buildFirstPersonWeapon(wid, weaponMat, weaponFurniture, (mesh, x, y, z) => {
        mesh.position.set(x, y, z);
        visual.add(mesh);
      });
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
    const sprite = this.makeTextSprite(c.name + (c.isSelf ? " (You)" : ""), c.team);
    sprite.position.y = PLAYER_HEIGHT + 0.55;
    root.add(sprite);
    c.nameSprite = sprite;

    // ---- Health bar (floating above head) ----
    const barBg = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthTest: false }));
    barBg.position.y = PLAYER_HEIGHT + 0.4;
    barBg.renderOrder = 999;
    root.add(barBg);
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.08), new THREE.MeshBasicMaterial({ color: 0x33dd66, depthTest: false }));
    bar.position.set(0, PLAYER_HEIGHT + 0.4, 0.01);
    bar.renderOrder = 1000;
    root.add(bar);
    c.healthBar = bar;

    // ---- Team ring at feet (visible ground marker showing team color) ----
    const ringColor = c.team === "red" ? 0xef4444 : c.team === "blue" ? 0x3b82f6 : 0x9ca3af;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.7, 24),
      new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthTest: false })
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

    root.position.set(c.pos[0], c.pos[1], c.pos[2]);
    root.frustumCulled = false; // Round 19l: never frustum-cull combatant groups
    this.scene.add(root);
    c.group = root;

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

  private makeTextSprite(text: string, team: string): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = team === "red" ? "#ff6b6b" : team === "blue" ? "#6ba6ff" : "#dddddd";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(0,0,0,0.85)"; ctx.lineWidth = 4;
    ctx.strokeText(text, 128, 32);
    ctx.fillText(text, 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
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
    this.socket.on("disconnect", (r: string) => console.log("[FPS] socket disconnected:", r));
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
        this.denialScoreEnabled = msg.config.denialScoreEnabled === true;
        (this.opts as any).team = msg.team;
        // switch to server's map if needed
        if (msg.mapId && msg.mapId !== this.opts.mapId) {
          this.opts.mapId = msg.mapId;
          this.map = makeEnvironmentMap(getMap(msg.mapId));
          // Rebuild arena visuals for the new map. We can't easily rebuild mid-scene
          // without removing old meshes; in practice the server uses the same map as
          // the client requested (findOpenRoom matches by mode only — fix that later).
        }
        for (const p of msg.players) this.ensureCombatant(p);
        break;
      case "snapshot":
        for (const p of msg.players) {
          const c = this.ensureCombatant(p);
          if (p.id === this.selfId) {
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
          this.environmentTime += Math.abs(drift) > 0.5 ? drift : drift * 0.2;
        }
        for (const [id, hp] of Object.entries(msg.environmentWalls ?? {})) {
          if (Number.isFinite(hp)) this.setEnvironmentWallHP(id, hp);
        }
        this.teamScores = msg.teamScores;
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
        // Draw authoritative ammo drops regardless of perk; only Scavenger can collect.
        // This makes absent drops distinguishable from a perk-registration problem.
        const drops = msg.scavengerDrops ?? [];
        const received = new Set(drops.map(d => d.id));
        for (const d of drops) this.spawnScavengerPickup(d.id, d.pos, d.expiresAt);
        for (const id of [...this.scavengerPickups.keys()]) {
          if (!received.has(id)) this.removeScavengerPickup(id);
        }
        this.timeLeft = this.opts.mode === "gungame" ? 0 : msg.timeLeft;
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
            this.recordPerWeaponKill(msg.weaponId, !!msg.headshot, this.combatants.get(msg.victimId));
            // Kill confirmation SFX (headshot chime is brighter).
            if (msg.headshot) this.sound.play("headshot", { volume: 0.8 });
            this.sound.play("kill", { volume: 0.6 });
            this.weaponAudio.playElimination(!!msg.headshot);
            this.lastElimination = { at: performance.now(), victim: this.combatants.get(msg.victimId)?.name ?? "Enemy", headshot: !!msg.headshot };
            // Register the kill for killstreak callouts.
            this.registerPlayerKill();
          }
          if (msg.victimId === this.selfId) {
            this.deaths += 1;
            this.alive = false;
            // Set the respawn timer so the HUD countdown ("Respawning in Ns")
            // actually counts down. Previously this was only set in the offline
            // takeDamage() path — online deaths left respawnAt at 0, so the
            // HUD always showed "Respawning in 0s". The server will send a
            // "respawn" S2C when the delay elapses (which resets respawnAt=0
            // and alive=true), so this is a client-side estimate that makes
            // the countdown visible during the wait.
            const respawnDelay = this.opts.mode === "survival" ? SURVIVAL_RESPAWN_MS : RESPAWN_DELAY_MS;
            this.respawnAt = performance.now() + respawnDelay;
            this.sound.play("death", { volume: 0.8 });
          }
          // Trigger the death-fall animation on the victim's combatant (if it's
          // another player — bots in online mode also use this path).
          const victim = this.combatants.get(msg.victimId);
          if (victim) {
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
      case "respawn":
        if (msg.playerId === this.selfId) {
          this.pos.set(msg.pos[0], msg.pos[1], msg.pos[2]);
          this.health = msg.health; this.alive = true; this.respawnAt = 0;
          this.ammoInMag = this.eff.magSize; this.reloading = false; this.equipmentAction = null;
          this.heatStates.clear(); this.boltCharges = 0; this.poisonByVictim.clear();
          this.equipmentCharges = equipmentById(this.opts.loadout.equipmentId).charges;
          // Round 20: Refill ALL weapon slots on respawn (not just the active one).
          this.primaryAmmoInMag = this.primaryEff.magSize;
          this.secondaryAmmoInMag = this.secondaryEff.magSize;
          this.meleeAmmoInMag = this.meleeEff.magSize;
          this.lastServerHealth = MAX_HEALTH;
        }
        break;
      case "scavengerDrop":
        this.spawnScavengerPickup(msg.id, msg.pos, msg.expiresAt);
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
          if (msg.weaponId === "launcher_rocket") {
            // Other players' rockets: visual only (server applies damage). damage=0, applyLocalSplash=false.
            this.spawnRocketProjectile(msg.origin, msg.dir, msg.skinId, 0, false);
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
      case "matchEnd":
        this.finalizeMatch(msg.standings, msg.winnerTeam);
        break;
      case "chat":
        break;
      case "error":
        console.warn("[server error]", msg.message);
        break;
      case "roomJoined":
        // Same semantics as "joined" but for the room-lobby flow.
        this.selfId = msg.selfId;
        this.denialScoreEnabled = msg.config.denialScoreEnabled === true;
        this.survivalTier=normalizeSurvivalTier(msg.config.survivalTier ?? this.survivalTier);
        (this.opts as any).team = msg.team;
        if (msg.mapId && msg.mapId !== this.opts.mapId) {
          this.opts.mapId = msg.mapId;
          this.map = makeEnvironmentMap(getMap(msg.mapId));
        }
        for (const p of msg.players) this.ensureCombatant(p);
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
        }
        // Reset tags and objective score for the new online match.
        for (const id of [...this.kcTags.keys()]) this.removeKillConfirmedTag(id);
        this.confirmations = 0; this.denials = 0; this.tagNotice = undefined;
        // Reset per-kill tracking for the fresh match.
        this.killDifficulties = [];
        // Reset per-weapon kill tracking too (so a previous match's gungame
        // per-weapon tallies don't bleed into the new match).
        this.perWeaponKills = new Map();
        this.perWeaponActions = new Map();
        // 19a+19b: Reset killstreak counters for the fresh match. The engine
        // instance persists across lobby→playing transitions for online matches,
        // so without these resets multikillsCount + bestStreak would carry over
        // from the previous match. Offline matches create a fresh engine
        // instance per match (field defaults are 0) but the explicit reset is
        // harmless and keeps the two paths symmetric.
        this.multikillsCount = 0;
        this.bestStreak = 0;
        this.recentKills = [];
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
          this.ammoInMag = this.eff.magSize;
          this.reloading = false;
          // ---- Play the weapon-swap animation + SFX ----
          // Each Gun Game tier-up is effectively a weapon swap (the player's
          // gun changes), so we trigger the same swap animation + sound as a
          // manual 1/2/3 swap. This gives visible feedback that the new tier
          // weapon is being drawn. We also rebuild the viewmodel so the new
          // weapon's distinct shape (sniper barrel, SMG compact body, etc.)
          // is rendered.
          this.swapAnimAt = performance.now();
          this.sound.play("swap", { volume: 0.5 });
          this.buildViewmodel();
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

  private ensureCombatant(p: SnapshotPlayer): Combatant {
    let c = this.combatants.get(p.id);
    if (!c) {
      c = {
        id: p.id, name: p.name, team: p.team, isBot: p.isBot, isSelf: p.id === this.selfId,
        pos: p.pos, yaw: p.yaw, pitch: p.pitch, health: p.health, alive: p.alive,
        weaponId: p.weaponId, weaponSkinId: p.weaponSkinId, playerSkinId: p.playerSkinId,
        kills: p.kills, deaths: p.deaths, score: 0,
        spawnProtectedUntil: p.spawnProtectedUntil,
      };
      this.combatants.set(p.id, c);
      if (!c.isSelf) this.addCombatantMesh(c);
    } else {
      // Gun Game (and late joins): rebuild an opponent's third-person weapon
      // if their authoritative weapon ID changes. Previously the stats changed
      // but the model in their hands stayed visually the old category forever.
      if (!c.isSelf && c.group && p.weaponId !== c.weaponId) {
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
        c.weaponId = p.weaponId;
        c.group = undefined;
        c.parts = undefined;
        this.addCombatantMesh(c);
      }
      // Round 19e: Sync spawn protection from the snapshot.
      c.spawnProtectedUntil = p.spawnProtectedUntil;
    }
    return c;
  }

  // ---- Spawning ----
  // Pick a spawn point that is as FAR as possible from any other living player
  // (not just enemies — we also want to avoid spawning on top of allies).
  private pickSpawn(team: string): Vec3 {
    const list = team === "red" ? this.map.spawns.red : team === "blue" ? this.map.spawns.blue : this.map.spawns.ffa;
    const others = [...this.combatants.values()].filter((c) => c.alive);
    // Also include the player's own current position (so we don't respawn where we just died)
    const selfHere: { pos: Vec3 } | null = this.alive ? { pos: [this.pos.x, this.pos.y, this.pos.z] } : null;
    // ---- Spawn safety filter: skip spawn points whose XZ is INSIDE a cover box ----
    // (Some maps — notably Neon Plaza — have spawns inside the central tower or
    // corner platforms. Without this filter, the player spawns embedded in a wall
    // and can't move. The Y will be snapped to ground level below, but the XZ
    // must be in open space.) We check against cover boxes whose top is above
    // the player's feet + 0.5 (so we don't accidentally filter spawns that sit
    // on top of a platform — those are intentional elevated spawns).
    const safeList = list.filter((sp) => {
      for (const cov of this.map.cover) {
        const cx = cov.pos[0], cz = cov.pos[2];
        const hx = cov.size[0], hz = cov.size[2];
        const minY = cov.pos[1] - cov.size[1];
        const maxY = cov.pos[1] + cov.size[1];
        // Inside the box's XZ footprint?
        if (Math.abs(sp[0] - cx) < hx + PLAYER_RADIUS && Math.abs(sp[2] - cz) < hz + PLAYER_RADIUS) {
          // And the box's body extends above the spawn's feet (i.e. the spawn is
          // embedded in the box's volume, not standing on its roof)?
          if (maxY > sp[1] + 0.5 && minY < sp[1] + PLAYER_HEIGHT) {
            return false;  // unsafe — skip this spawn
          }
        }
      }
      return true;
    });
    // Fall back to the unfiltered list if EVERY spawn is unsafe (shouldn't happen
    // in practice, but prevents a hard crash if a map's spawns are all bad).
    const candidateList = safeList.length > 0 ? safeList : list;
    const points = candidateList.map((sp) => {
      let minD = Infinity;
      for (const e of others) {
        const d = Math.hypot(e.pos[0] - sp[0], e.pos[2] - sp[2]);
        if (d < minD) minD = d;
      }
      if (selfHere) {
        const d = Math.hypot(selfHere.pos[0] - sp[0], selfHere.pos[2] - sp[2]);
        if (d < minD) minD = d;
      }
      // Slight random jitter to break ties so bots don't always pick the same spawn
      return { sp, score: minD + Math.random() * 2 };
    });
    points.sort((a, b) => b.score - a.score);
    // Round 20: Enforce minimum spawn separation. Never spawn within 8 units
    // of another living player if avoidable. If ALL spawn points are within 8
    // units (small map / many players), pick the farthest one.
    const MIN_SPAWN_DIST = 8;
    const farPoints = points.filter((p) => p.score >= MIN_SPAWN_DIST);
    const chosen = (farPoints.length > 0 ? farPoints : points)[0].sp;
    // Snap Y to ground level at that XZ
    const groundY = botGroundHeight(this.map.cover, chosen[0], chosen[2], chosen[1]);
    return [chosen[0], Math.max(chosen[1], groundY), chosen[2]];
  }

  private respawnSelf() {
    const sp = this.pickSpawn(this.opts.team as string);
    this.pos.set(sp[0], sp[1], sp[2]);
    this.vel.set(0, 0, 0);
    this.onGround = true;
    this.lastGroundedAt = -Infinity;
    this.lastJumpPressedAt = -Infinity;
    this.wasJumpHeld = !!this.keys["Space"];
    this.touchJumpQueued = false;
    this.touchAutoSprintActive = false;
    this.health = MAX_HEALTH; this.alive = true;
    this.lastServerHealth = MAX_HEALTH; // reset so the next snapshot doesn't sync down
    this.ammoInMag = this.eff.magSize; this.reloading = false;
    this.heatStates.clear(); this.boltCharges = 0; this.poisonByVictim.clear();
    this.equipmentCharges = equipmentById(this.opts.loadout.equipmentId).charges;
    // Round 19o: refill ALL slots on respawn (not just the active one).
    this.primaryAmmoInMag = this.primaryEff.magSize;
    this.secondaryAmmoInMag = this.secondaryEff.magSize;
    this.meleeAmmoInMag = this.meleeEff.magSize;
    // Round 20h: Local player spawn protection (offline only — online is
    // handled by the server). 3 seconds of immunity.
    if (!this.opts.online) this.selfSpawnProtectedUntil = Date.now() + 3000;
    this.respawnAt = 0;
  }

  private spawnScavengerPickup(id: string, pos: Vec3, expiresAt: number) {
    if (this.scavengerPickups.has(id)) return;
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
    this.saveAmmoToSlot(this.currentSlot); // reconcile shots spent since last weapon swap
    // A cache always replenishes conventional primary and secondary magazines,
    // including the one currently held. Heat/melee weapons have no ammo, but
    // their holstered firearms still benefit. Ammo reserve is unlimited in
    // this game; restore the actual magazine values used by weapon swapping.
    const beforePrimary = this.primaryAmmoInMag;
    const beforeSecondary = this.secondaryAmmoInMag;
    if (this.primaryWeaponId && weaponById(this.primaryWeaponId).special?.kind !== "heat" &&
        weaponById(this.primaryWeaponId).category !== "melee") {
      this.primaryAmmoInMag = Math.min(this.primaryEff.magSize,
        this.primaryAmmoInMag + scavengerAmmoAmount(this.primaryEff.magSize));
    }
    if (this.secondaryWeaponId && weaponById(this.secondaryWeaponId).special?.kind !== "heat" &&
        weaponById(this.secondaryWeaponId).category !== "melee") {
      this.secondaryAmmoInMag = Math.min(this.secondaryEff.magSize,
        this.secondaryAmmoInMag + scavengerAmmoAmount(this.secondaryEff.magSize));
    }
    if (this.currentSlot === "primary") this.ammoInMag = this.primaryAmmoInMag;
    if (this.currentSlot === "secondary") this.ammoInMag = this.secondaryAmmoInMag;
    this.scavengerAmmoGained = (this.primaryAmmoInMag - beforePrimary) +
      (this.secondaryAmmoInMag - beforeSecondary);
    this.scavengerFeedbackAt = performance.now();
    this.sound.play("reload", { volume: 0.34 });
  }

  // ---- Special-weapon resources & ground pickups ----
  private updateSpecialResources(dt: number, now: number) {
    for (const [id, state] of this.heatStates) {
      const special = weaponById(id).special;
      if (special?.kind === "heat") this.heatStates.set(id, coolHeat(state, special, dt, now));
    }
    // Poison ticks only in offline simulation; online the server owns the status.
    if (!this.opts.online && !this.matchEnded) {
      for (const [id, poison] of this.poisonByVictim) {
        const victim = this.combatants.get(id);
        if (!victim?.alive || now >= poison.expiresAt) { this.poisonByVictim.delete(id); continue; }
        if (now >= poison.tickAt) {
          poison.tickAt = now + 500;
          if (!victim.spawnProtectedUntil || victim.spawnProtectedUntil <= Date.now()) {
            this.applyDamageLocal(victim, 2, false, poison.weaponId);
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
      if (!c.alive || (this.opts.mode === "tdm" && c.team === this.opts.team)) continue;
      const hit = rayCombatantHit(origin, dir, c.pos);
      if (hit && hit.t < t) t = hit.t;
    }
    const x = origin[0] + dir[0] * t, z = origin[2] + dir[2] * t;
    // Embedded bolts fall to ground level so they can actually be reclaimed.
    return [x, 0.4, z];
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

  // ---- Shooting ----
  // fireOneShot is called from the main loop's firing block (above). It handles
  // BOTH gun-fire and melee attacks — melee weapons route through tryMeleeAttack
  // instead of the ray-based gun path so they feel like real melee (short-range
  // arc hit, swing animation, no ammo, no tracer).
  private fireOneShot(w: WeaponDef) {
    if (!this.alive || this.reloading || this.matchEnded || performance.now() < this.equipmentStunUntil || performance.now() < this.swapReadyAt) return;
    // Can't fire while sprinting — must release sprint or ADS first (arcade rule).
    if (this.sprinting) return;
    const now = performance.now();
    const isMelee = w.category === "melee";
    // Melee weapons have no ammo — just a swing cooldown.
    if (isMelee) {
      this.tryMeleeAttack(w, now);
      return;
    }
    const special = w.special;
    if (special?.kind === "heat") {
      const state = this.heatStates.get(w.id) ?? freshHeat();
      const next = addHeat(state, special, now);
      if (!next) return; // locked by overheat; no bullets or energy consumed
      this.heatStates.set(w.id, next);
    }
    if (special?.kind !== "heat" && this.ammoInMag <= 0) {
      this.sound.play("empty_click", { volume: 0.4 });
      this.startReload();
      return;
    }
    this.lastShotAt = now;
    this.selfSpawnProtectedUntil = 0; // protection ends when the attack actually fires
    if (special?.kind !== "heat") this.ammoInMag--;
    // Round 19o: Keep per-slot ammo in sync so swapping preserves the correct count.
    this.saveAmmoToSlot(this.currentSlot);
    this.triggerMuzzleFlash();
    this.weaponAudio.play(this.weaponSoundCategory(this.weaponId), {
      weaponId: this.weaponId,
      suppressed: this.getCurrentAttachments().barrel === "barrel_suppressor",
      volume: 0.9,
    });
    // ---- Auto-reload when the mag hits 0 ----
    // As soon as the magazine is emptied by this shot, kick off a reload
    // automatically. The user shouldn't have to press R (or pull the trigger
    // on an empty gun) to start reloading — that just wastes a click. We do
    // this AFTER the shot fires (so the last bullet still goes out) and only
    // for weapons that actually have a reload (melee/launcher have reloadTime 0
    // and are handled separately).
    const justEmptied = this.ammoInMag <= 0;
    if (special?.kind !== "heat" && justEmptied && !this.reloading && this.eff.reloadTime > 0) {
      this.startReload();
    }

    const origin: Vec3 = [this.pos.x, this.pos.y + EYE_HEIGHT, this.pos.z];
    // Spread is amplified by the dynamic spread factor (movement/sprint/jump).
    const baseSpread = this.aiming ? this.eff.adsSpread : this.eff.spread;
    // Reward settled ADS shots without removing intended hipfire/movement spread.
    const steadyAds = this.aiming && this.adsProgress >= 0.9 && this.onGround
      && (this.vel.x * this.vel.x + this.vel.z * this.vel.z) < 1;
    const spread = baseSpread * (1 + this.currentSpread * 1.5) * (steadyAds ? 0.5 : 1);
    const dir = this.aimDir(spread);
    // Apply kick only after the outgoing direction is locked in. Otherwise a
    // precision click launches above the crosshair before the view visibly moves.
    this.applyRecoil();
    const pellets = w.stats.pellets ?? 1;
    // Capture impact before damage can kill/remove a target. Reclaimed bolts
    // should land where the shot hit, not travel through a newly-dead enemy.
    const boltImpact = special?.kind === "bolt" ? this.boltLanding(origin, dir) : null;
    const isRocket = this.weaponId === "launcher_rocket";

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
      this.socket?.emit("message", { t: "shot", origin, dir, weaponId: this.weaponId, skinId: this.getCurrentSkinId() });
      this.spawnTracer(origin, dir, this.getCurrentSkinId());
    } else {
      for (let i = 0; i < pellets; i++) {
        const pdir = pellets > 1 ? this.normalize(this.add(dir, this.randSpread(spread))) : dir;
        const victim = this.localFireRay(origin, pdir, w.stats.headshotMult, false);
        if (victim && special?.kind === "arc") this.chainArcOffline(victim, w.id);
      }
      if (special?.kind === "bolt") {
        const id = `local_bolt_${++this.localBoltSequence}`;
        this.spawnBoltPickup(id, this.selfId, boltImpact!, Date.now() + special.lifetimeMs);
      } else this.spawnTracer(origin, dir, this.getCurrentSkinId());
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
    const swingGap = 1000 / Math.max(1, this.eff.fireRate) * 0.9;
    if (now - this.lastShotAt < swingGap) return;
    this.lastShotAt = now;
    this.selfSpawnProtectedUntil = 0;
    this.meleeSwingAt = now;
    // Actual swing event, not button press (respects melee cooldown).
    this.weaponAudio.play("melee", { weaponId: this.weaponId, volume: 0.85 });

    // Melee is a short-range frontal arc: hit the closest enemy within range
    // and within ±60° of the player's view direction.
    const origin: Vec3 = [this.pos.x, this.pos.y + EYE_HEIGHT, this.pos.z];
    const cp = Math.cos(this.pitch);
    const fwd: Vec3 = [Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp];
    let nearest: { c: Combatant; dist: number; head: boolean } | null = null;
    const meleeRange = this.eff.range;
    const arcCos = Math.cos(Math.PI / 3);  // ±60° arc
    for (const c of this.combatants.values()) {
      if (!c.alive) continue;
      if (this.opts.mode !== "ffa" && this.opts.mode !== "gungame" && c.team === this.opts.team) continue;
      const dx = c.pos[0] - origin[0];
      const dy = (c.pos[1] + PLAYER_HEIGHT / 2) - origin[1];
      const dz = c.pos[2] - origin[2];
      const dist = Math.hypot(dx, dy, dz);
      if (dist > meleeRange) continue;
      // Normalized direction to enemy
      const nx = dx / (dist || 1), ny = dy / (dist || 1), nz = dz / (dist || 1);
      // Dot product with forward — must be > arcCos (within arc).
      const dot = nx * fwd[0] + ny * fwd[1] + nz * fwd[2];
      if (dot < arcCos) continue;
      if (!nearest || dist < nearest.dist) {
        // Award melee headshots only when the actual forward aim ray crosses
        // the head, not simply because the target's head is above eye height.
        const head = rayCombatantHit(origin, fwd, c.pos)?.head ?? false;
        nearest = { c, dist, head };
      }
    }
    const wallHit = closestCoverHit(this.map.cover, origin, fwd, meleeRange, rayBox);
    if (!this.opts.online && wallHit?.box.environmentId && this.environmentWalls.has(wallHit.box.environmentId) &&
        (!nearest || wallHit.distance < nearest.dist)) {
      this.damageEnvironmentWall(wallHit.box.environmentId, this.eff.damage);
    }
    // Cover blocking: if a wall is between player and the enemy, no hit.
    if (nearest) {
      let blocked = false;
      const dirToEnemy: Vec3 = [
        (nearest.c.pos[0] - origin[0]) / (nearest.dist || 1),
        ((nearest.c.pos[1] + PLAYER_HEIGHT / 2) - origin[1]) / (nearest.dist || 1),
        (nearest.c.pos[2] - origin[2]) / (nearest.dist || 1),
      ];
      for (const cov of this.map.cover) {
        const t = rayBox(origin, dirToEnemy, cov.pos, cov.size);
        if (t !== null && t < nearest.dist) { blocked = true; break; }
      }
      if (!blocked) {
        const dmg = this.eff.damage * (nearest.head ? w.stats.headshotMult : 1);
        const willKill = nearest.c.health - dmg <= 0 && nearest.c.alive;
        this.applyDamageLocal(nearest.c, dmg, nearest.head);
        this.hitMarkerAt = performance.now();
        // Melee hit SFX (meaty thwack).
        this.sound.play("melee_hit", { volume: 0.7 });
        if (willKill) {
          // Kill chime already played by applyDamageLocal path; nothing extra here.
        }
      }
    }

    // Online: notify server of melee swing so other clients see the swing anim
    // and the server validates the hit. The server treats melee as a 0-range shot.
    if (this.opts.online && this.socket?.connected) {
      const dir: Vec3 = [Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp];
      this.socket.emit("message", { t: "shot", origin, dir, weaponId: this.weaponId, skinId: this.getCurrentSkinId() });
    }
  }

  // Damage falloff: at distance <= range, full damage. Beyond range, damage falls linearly
  // to 60% at range*1.6, then stays at 60%.
  private damageAtRange(base: number, dist: number, range: number): number {
    if (dist <= range) return base;
    const fallEnd = range * 1.6;
    if (dist >= fallEnd) return base * 0.6;
    const t = (dist - range) / (fallEnd - range);
    return base * (1 - 0.4 * t);
  }

  private localFireRay(origin: Vec3, dir: Vec3, headshotMult: number, isMelee = false) {
    let nearest: { c: Combatant; t: number; head: boolean } | null = null;
    for (const c of this.combatants.values()) {
      if (!c.alive) continue;
      if (this.opts.mode !== "ffa" && this.opts.mode !== "gungame" && c.team === this.opts.team) continue;
      const hit = rayCombatantHit(origin, dir, c.pos);
      if (hit && hit.t <= this.eff.range * 1.6) {
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
    for (const cov of this.map.cover) {
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
      const baseDmg = this.eff.damage * (nearest.head ? headshotMult : 1);
      const dmg = this.damageAtRange(baseDmg, nearest.t, this.eff.range);
      const willKill = nearest.c.health - dmg <= 0 && nearest.c.alive;
      this.applyDamageLocal(nearest.c, dmg, nearest.head);
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
    if (weaponId === "launcher_rocket") return "launcher";
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
    victim.health -= damage;
    if (victim.health <= 0 && victim.alive) {
      victim.alive = false;
      victim.deaths += 1;
      if (this.opts.mode !== "killconfirmed") victim.score = victim.kills;
      this.kills += 1;
      this.headshots += head ? 1 : 0;
      // All enemies drop a visible ammo cache. Only Scavenger owners can collect.
      this.spawnScavengerPickup(`offline_ammo_${victim.id}_${Date.now()}`,
        [victim.pos[0], victim.pos[1] + 0.16, victim.pos[2]], Date.now() + SCAVENGER_DROP_LIFETIME_MS);
      // Attribute this kill to the weapon the local player was holding. Critical
      // for Gun Game (where the player cycles through every progression weapon):
      // per-weapon skin challenges (Breacher, Longshot, etc.) read this map to
      // progress on the weapon actually used, not the match-start weapon.
      this.recordPerWeaponKill(sourceWeaponId, head, victim);
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
      if (this.opts.mode === "gungame") {
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
    this.ammoInMag = this.eff.magSize;
    this.reloading = false;
    // ---- Play the weapon-swap animation + SFX on tier-up ----
    this.swapAnimAt = performance.now();
    this.sound.play("swap", { volume: 0.5 });
    this.buildViewmodel();
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
    // 19a+19b: Streak window widened from 3s → 5s so chained kills across
    // reloads / target switches count toward multi-kills more reliably.
    // 5s gives the player enough breathing room to land the next kill before
    // the streak resets — 3s was too punishing on slower-firing weapons
    // (snipers, pump shotguns) where the time between kills naturally exceeds 3s.
    this.recentKills = this.recentKills.filter((t) => now - t < 5000);
    this.recentKills.push(now);
    const streak = this.recentKills.length;
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
    }
    if (victim) {
      const distance = Math.hypot(victim.pos[0] - this.pos.x, victim.pos[2] - this.pos.z);
      if (distance <= 10) bump("close_range_kills");
      if (distance >= 35) bump("long_range_kills");
    }
    if (this.recentKills.some(t => performance.now() - t < 5000)) bump("multikill_kills");
    this.perWeaponActions.set(weaponId, actions);
  }

  private scheduleRespawn(c: Combatant) {
    // In survival, dead bots stay dead until the next wave resets them.
    if (this.opts.mode === "survival") return;
    setTimeout(() => {
      if (this.disposed || this.matchEnded) return;
      const sp = this.pickSpawn(c.team);
      c.pos = sp; c.health = MAX_HEALTH; c.alive = true;
      // Round 20h: Bot spawn protection — 2.5s immunity so bots don't get
      // spawn-killed. The shield mesh shows while active.
      c.spawnProtectedUntil = Date.now() + 2500;
      // Clear the death animation so the mesh renders normally after respawn.
      c.deathAnimAt = 0;
      c.deathAnimDur = 0;
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
      if (c.healthBar) c.healthBar.visible = true;
    }, RESPAWN_DELAY_MS);
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
    if (this.matchEnded) return;
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

  // Keep the arena onscreen briefly after the decisive kill, even in FFA.
  private deliverMatchEnd(result: MatchEndResult) {
    this.matchFinishingLabel = result.won ? "VICTORY" : "MATCH COMPLETE";
    this.emitHud(performance.now());
    setTimeout(() => {
      if (!this.disposed) this.opts.onMatchEnd(result);
    }, 2500);
  }

  private finalizeMatchLocal() {
    if (this.matchEnded) return;
    this.matchEnded = true;
    const isSurvival = this.opts.mode === "survival";
    const objectiveScore = this.opts.mode === "killconfirmed" ? this.confirmations + (this.denialScoreEnabled ? this.denials : 0) : this.kills;
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
    }].map((c) => ({ id: c.id, name: c.name, team: c.team, kills: c.kills, deaths: c.deaths, score: c.score ?? c.kills, isBot: c.isBot }))
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
      kills: this.kills, deaths: this.deaths, headshots: this.headshots, won, score: isSurvival ? this.survivalWave : objectiveScore, mode: this.opts.mode, standings,
      durationSec, placement, multikills: this.multikillsCount, bestStreak: this.bestStreak, weaponId: this.weaponId,
      killDifficulties: this.killDifficulties.slice(),
      perWeaponKills: Object.fromEntries(this.perWeaponKills),
      perWeaponActions: Object.fromEntries(this.perWeaponActions),
      confirmations: this.confirmations, denials: this.denials,
      ...(isSurvival ? { survivalWaves: this.getSurvivalClearedWaves(), survivalTier: this.survivalTier } as any : {}),
    });
  }

  private finalizeMatch(standings: any, winnerTeam: string | null) {
    if (this.matchEnded) return;
    this.matchEnded = true;
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
      : (this.opts.mode === "tdm" || this.opts.mode === "killconfirmed") ? winnerTeam === this.opts.team
      : isFfaStyle ? (winnerTeam === "ffa" ? (standings[0]?.id === this.selfId) : (standings[0]?.id === this.selfId))
      : true;
    // End-of-match SFX: victory fanfare or defeat tone.
    this.sound.play(won ? "match_win" : "match_lose", { volume: 0.9 });
    const durationSec = Math.max(0, Math.round((performance.now() - this.matchStartedAt) / 1000));
    this.deliverMatchEnd({
      kills: me?.kills ?? this.kills, deaths: me?.deaths ?? this.deaths, headshots: this.headshots, won: !!won,
      score: me?.score ?? (isSurvival ? this.survivalWave : this.opts.mode === "killconfirmed" ? this.confirmations + (this.denialScoreEnabled ? this.denials : 0) : this.kills), mode: this.opts.mode, standings,
      durationSec, placement: placement || 1, multikills: this.multikillsCount, bestStreak: this.bestStreak, weaponId: this.weaponId,
      killDifficulties: this.killDifficulties.slice(),
      perWeaponKills: Object.fromEntries(this.perWeaponKills),
      perWeaponActions: Object.fromEntries(this.perWeaponActions),
      confirmations: this.confirmations, denials: this.denials,
      ...(isSurvival ? { survivalWaves: this.getSurvivalClearedWaves(), survivalTier: this.survivalTier } as any : {}),
    });
  }

  private applyRecoil() {
    const kick = this.eff.recoil * 0.006 * (this.aiming ? 0.5 : 1) * recoilMultiplier(this.activePerkId);
    this.pitch += kick + (Math.random() - 0.5) * kick * 0.5;
    this.yaw += (Math.random() - 0.5) * kick * 0.6;
    // Kick the viewmodel back + up; decays each frame in the update loop.
    this.vmRecoilZ = Math.min(0.08, this.vmRecoilZ + 0.04 * recoilMultiplier(this.activePerkId));
    this.vmRecoilPitch = Math.min(0.12, this.vmRecoilPitch + 0.05 * recoilMultiplier(this.activePerkId));
  }

  private triggerMuzzleFlash() {
    // A mechanical crossbow does not emit a firearm-style muzzle flash.
    if (this.weaponId === "crossbow_reclaimer") return;
    (this.muzzleFlash.material as THREE.MeshBasicMaterial).opacity = 1;
    this.muzzleFlash.scale.setScalar(1 + Math.random() * 0.6);
    this.muzzleFlash.rotation.z = Math.random() * Math.PI;
    this.muzzleLight.intensity = 3;
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
  private spawnRocketProjectile(origin: Vec3, dir: Vec3, _skinId: string, damage: number, applyLocalSplash: boolean) {
    // Normalize the direction vector so the raycast + impact point math is stable.
    // (The caller's dir comes from aimDir(spread) which IS normalized, but defensive
    // normalization prevents any future edge case where a non-unit vector would
    // produce a wrong impact point and miss damage.)
    const dlen = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    const ndir: Vec3 = [dir[0] / dlen, dir[1] / dlen, dir[2] / dlen];
    // Compute the impact point (same raycast as spawnTracer, but also stop at
    // the first combatant so the rocket detonates ON the target, not behind it).
    let maxT = this.eff.range;
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
    const endX = origin[0] + ndir[0] * maxT, endY = origin[1] + ndir[1] * maxT, endZ = origin[2] + ndir[2] * maxT;
    // Build the rocket mesh: a small elongated body + cone warhead + glowing trail.
    const rocketGroup = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.22, 10),
      new THREE.MeshBasicMaterial({ color: 0x888888 }),
    );
    body.rotation.x = Math.PI / 2; // align with -Z (forward)
    rocketGroup.add(body);
    const warhead = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.10, 10),
      new THREE.MeshBasicMaterial({ color: 0x444444 }),
    );
    warhead.rotation.x = -Math.PI / 2; // point forward
    warhead.position.z = -0.16;
    rocketGroup.add(warhead);
    // Glowing trail (small sphere at the back)
    const trail = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.7 }),
    );
    trail.position.z = 0.14;
    rocketGroup.add(trail);
    // Orient the rocket group to face the travel direction.
    const start = new THREE.Vector3(origin[0], origin[1], origin[2]);
    const end = new THREE.Vector3(endX, endY, endZ);
    rocketGroup.position.copy(start);
    rocketGroup.lookAt(end);
    this.scene.add(rocketGroup);
    // Travel time scales with distance but caps at 400ms (feels responsive).
    const dist = start.distanceTo(end);
    const travelMs = Math.min(400, Math.max(120, dist * 3));
    // Splash radius: 8 units (roughly 4x player width). Larger than before so
    // near-misses still deal meaningful damage — the rocket's value is area denial.
    const splashRadius = 8;
    this.projectiles.push({ mesh: rocketGroup, start, end, born: performance.now(), travelMs, damage, splashRadius, weaponId: this.weaponId, applyLocalSplash });
  }

  // Spawn an explosion effect at a world position: an expanding emissive sphere
  // + a brief point light flash. The effect auto-fades and is removed after ~500ms.
  private spawnExplosion(pos: THREE.Vector3) {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff6622, transparent: true, opacity: 0.85 }),
    );
    sphere.position.copy(pos);
    this.scene.add(sphere);
    const light = new THREE.PointLight(0xff6622, 4, 12);
    light.position.copy(pos);
    this.scene.add(light);
    this.explosions.push({ mesh: sphere, light, born: performance.now(), life: 500 });
    // Explosion SFX.
    this.weaponAudio.play("launcher", { weaponId: "launcher_rocket", volume: 0.95 });
  }

  private startReload() {
    if (this.equipmentAction) return;
    const special = weaponById(this.weaponId).special;
    if (special?.kind === "heat") {
      const heat = this.heatStates.get(this.weaponId)?.heat ?? 0;
      if (this.reloading || !this.alive || heat <= 0) return;
      if (this.sprinting && this.activePerkId !== "field_loader") return;
      this.reloading = true;
      this.reloadStartedAt = performance.now();
      this.reloadDurationMs = special.ventSeconds * 1000 * reloadDurationMultiplier(this.activePerkId);
      this.reloadEndsAt = this.reloadStartedAt + this.reloadDurationMs;
      this.sound.play("reload", { volume: 0.55 });
      this.socket?.emit("message", { t: "reload" });
      return;
    }
    if (this.reloading || this.ammoInMag >= this.eff.magSize || !this.alive) return;
    if (this.sprinting && this.activePerkId !== "field_loader") return;
    // Melee weapons don't reload.
    if (weaponById(this.weaponId).category === "melee") return;
    this.reloading = true;
    let duration = this.eff.reloadTime;
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
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number) {
    if (this.opts.mode === "killconfirmed") this.animateKillConfirmedTags(performance.now());
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
          for (const c of this.combatants.values()) if (c.alive) c.spawnProtectedUntil = Date.now() + 2500;
        }
        this.sound.play("match_start", { volume: 0.8 });
      }
      return;
    }
    if (!this.matchEnded && !this.opts.online && this.opts.mode !== "survival") {
      // Round 20: Only tick the timer if there IS a time limit (timeLeft > 0).
      // timeLeft = 0 means "no limit" — the match runs until the kill target
      // is reached. Previously, a 0 timeLimit caused the match to end instantly
      // because `0 - dt <= 0` was always true.
      if (this.timeLeft > 0 && this.opts.mode !== "gungame") {
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) { this.timeLeft = 0; this.finalizeMatchLocal(); }
      }
    }
    if (!this.matchEnded) {
      this.tickOfflineMines(performance.now());
      this.pulseMineBeacons(performance.now());
    }
    if (!this.matchEnded) this.updateEnvironment(dt);
    // ---- Dead player: freeze camera + suppress all input/animation ----
    // When the local player is dead (waiting for respawn), we lock the camera
    // at the death position and suppress movement, firing, and viewmodel
    // animations. The player can still look around (mouse-look) but cannot
    // move, shoot, or play weapon animations. This prevents the jarring
    // effect of the gun continuing to sway/recoil while the player is dead.
    if (!this.alive && !this.matchEnded) {
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
    if (this.reloading && performance.now() >= this.reloadEndsAt) {
      this.reloading = false;
      if (weaponById(this.weaponId).special?.kind === "heat") this.heatStates.set(this.weaponId, freshHeat());
      else this.ammoInMag = this.eff.magSize;
      // Round 19o: Save the refilled ammo to the current slot so swapping
      // away and back preserves the full mag (and doesn't reset it).
      this.saveAmmoToSlot(this.currentSlot);
    }
    const wantFire = (this.mouseDown && this.pointerLocked) || (this.touchMode && this.touchFiring);
    const inputActive = this.pointerLocked || this.touchMode;
    // Effective aim: manually held ADS (RMB / ADS button) OR auto-ADS-while-firing.
    const allowSprintAds = allowsAdsWhileSprinting(this.getCurrentAttachments().grip);
    const wantsAds = this.manualAiming || (this.autoAdsOnFire && wantFire && this.alive);
    // Shift / mobile auto-sprint takes priority: ADS cannot silently cancel sprint.
    this.aiming = !this.equipmentAction && !this.reloading && wantsAds && (!this.sprinting || allowSprintAds);
    if (!this.equipmentAction && (wantFire || this.burstShotsLeft > 0)) {
      const w = weaponById(this.weaponId);
      const now = performance.now();
      // ---- Burst-fire in progress: continue the burst even after trigger release ----
      if (this.burstShotsLeft > 0 && now >= this.burstNextAt && this.ammoInMag > 0) {
        this.fireOneShot(w);
        this.burstShotsLeft -= 1;
        if (this.burstShotsLeft > 0) {
          // Next shot in the burst fires at the intra-burst cadence (much faster than the
          // weapon's stated fireRate — the fireRate is the BETWEEN-burst cadence).
          this.burstNextAt = now + 1000 / Math.max(1, this.eff.fireRate * 3);
        } else {
          // Burst complete — enforce a longer inter-burst delay (the weapon's stated fireRate).
          this.burstEndsAt = now + 1000 / Math.max(1, this.eff.fireRate);
        }
      }
      // ---- Decide whether to START a new shot / burst ----
      else if (now >= this.burstEndsAt) {
        const isAuto = w.stats.auto;
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
    if (this.alive && inputActive) this.updateMovement(dt);
    this.interactEnvironment();

    // ADS smoothing
    const targetAds = this.aiming ? 1 : 0;
    this.adsProgress += (targetAds - this.adsProgress) * Math.min(1, dt * 12);
    // Per-sight FOV reduction (iron/red_dot = small zoom, ACOG = bigger, Hunter = biggest).
    // The HUD renders the matching reticle overlay; the camera FOV provides the zoom.
    this.camera.fov = this.baseFov - this.adsProgress * this.sightDef.adsFovReduction;
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
        this.spawnExplosion(p.end);
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
        if (p.applyLocalSplash) {
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
            const dx = cx - closestX, dy = cy - closestY, dz = cz - closestZ;
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (d <= p.splashRadius) {
              // Quadratic falloff: 100% damage at center (d=0), ~30% at half-radius,
              // ~10% at edge. This rewards direct hits much more than near-misses,
              // making the rocket feel powerful when it connects but not OP when it whiffs.
              // Plus a direct-hit bonus: if the combatant is within 1.5 units of the
              // closest point, apply full damage + 20% bonus (guaranteed kill on 100HP).
              const norm = d / p.splashRadius;
              const falloff = d <= 1.5 ? 1.2 : (1 - norm * norm) * 0.9 + 0.1;
              const splashDmg = p.damage * falloff;
              this.applyDamageLocal(c, splashDmg, false);
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
      return true;
    });

    // ---- Update explosions: expand + fade out, then remove ----
    this.explosions = this.explosions.filter((e) => {
      const age = now - e.born;
      if (age > e.life) {
        this.scene.remove(e.mesh);
        this.scene.remove(e.light);
        (e.mesh.geometry as THREE.BufferGeometry).dispose();
        (e.mesh.material as THREE.Material).dispose();
        return false;
      }
      const t = age / e.life;
      // Expand from 0.3 to ~2.5 radius.
      const scale = 0.3 + t * 2.2;
      e.mesh.scale.setScalar(scale);
      (e.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - t);
      // Light fades faster.
      e.light.intensity = 4 * (1 - t) * (1 - t);
      return true;
    });

    // combatants mesh sync + humanoid animation
    this.updateCombatantMeshes(dt, now);

    if (!this.opts.online && !this.matchEnded) {
      for (const c of this.combatants.values()) {
        if (c.isBot && c.alive && c.ai) this.updateBotAI(c, dt, now);
      }
    }

    if (!this.opts.online && this.opts.mode === "killconfirmed" && !this.matchEnded) {
      this.collectOfflineKillConfirmedTags();
    }
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

    this.camera.position.set(this.pos.x, this.pos.y + EYE_HEIGHT, this.pos.z);
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
  private updateCombatantMeshes(dt: number, now: number) {
    // Round 20j: Thermal vision — when ADS with a thermal scope, make enemy
    // combatants emit a bright amber glow so they're visible through walls
    // (like a real thermal scope). Also brighten the scene for NVG.
    const isThermalAds = this.aiming && this.adsProgress > 0.3 && this.sightDef.overlay === "thermal";
    const isNvgAds = this.aiming && this.adsProgress > 0.3 && this.sightDef.overlay === "nvg";
    for (const c of this.combatants.values()) {
      if (!c.group) continue;
      // Thermal vision: override body material emissive for living enemies.
      if (c.skinMaterial && c.alive) {
        const isEnemy = c.team !== this.opts.team || this.opts.mode === "ffa" || this.opts.mode === "gungame";
        if (isThermalAds && isEnemy && !c.isSelf) {
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
      c.group.position.set(c.pos[0], c.pos[1], c.pos[2]);
      c.group.rotation.y = c.yaw;
      // ---- Death animation: fall forward over ~900ms before hiding ----
      if (!c.alive && c.deathAnimAt && c.deathAnimDur) {
        const age = now - c.deathAnimAt;
        const p = Math.min(1, age / c.deathAnimDur);
        if (p >= 1) {
          c.group.visible = false;
          if (c.nameSprite) c.nameSprite.visible = false;
          if (c.healthBar) c.healthBar.visible = false;
          if (c.friendlyMarker) c.friendlyMarker.visible = false;
          if (c.shieldMesh) c.shieldMesh.visible = false;
        } else {
          c.group.visible = true;
          const ease = 1 - Math.pow(1 - p, 3);
          c.group.rotation.x = ease * (Math.PI / 2);
          c.group.position.y = c.pos[1] - ease * 0.4;
          c.group.rotation.z = Math.sin(p * Math.PI) * 0.15;
          if (c.nameSprite) c.nameSprite.visible = false;
          if (c.healthBar) c.healthBar.visible = false;
          if (c.friendlyMarker) c.friendlyMarker.visible = false;
          if (c.shieldMesh) c.shieldMesh.visible = false;
        }
      } else if (!c.alive) {
        c.group.visible = false;
        if (c.nameSprite) c.nameSprite.visible = false;
        if (c.healthBar) c.healthBar.visible = false;
        if (c.friendlyMarker) c.friendlyMarker.visible = false;
        if (c.shieldMesh) c.shieldMesh.visible = false;
      } else {
        c.group.rotation.x = 0;
        c.group.rotation.z = 0;
        c.group.visible = true;
        if (c.nameSprite) c.nameSprite.visible = true;
        if (c.healthBar) {
          c.healthBar.visible = true;
          const pct = Math.max(0, c.health / MAX_HEALTH);
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
        const isFriendly = (this.opts.mode === "tdm" || this.opts.mode === "killconfirmed")
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
    p.weaponStub.position.copy(p.weaponBase);
    p.weaponStub.position.z -= recoil * 0.5;
    p.weaponStub.position.y += Math.sin(c.walkPhase ?? 0) * 0.006;
    // Third-person aim pitch is the same sign as the existing head pitch.
    p.weaponStub.rotation.x = c.pitch * 0.35 - recoil * 0.3;

    const rightGrip = p.weaponHoldRight.clone()
      .applyQuaternion(p.weaponStub.quaternion).add(p.weaponStub.position);
    const leftGrip = p.weaponHoldLeft.clone()
      .applyQuaternion(p.weaponStub.quaternion).add(p.weaponStub.position);
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
      this.stamina = Math.max(0, this.stamina - FPSEngine.STAMINA_DRAIN * sprintDrainMultiplier(this.activePerkId) * dt);
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
    const baseSpeed = MOVEMENT.walk * this.eff.moveSpeed * speedMul;
    // Footstep SFX: every ~320ms while running on ground. Louder/faster when sprinting.
    if (this.onGround && move.lengthSq() > 0.1) {
      const stepInterval = this.sprinting ? 260 : 360;
      if (performance.now() - this.lastFootstepAt > stepInterval) {
        this.lastFootstepAt = performance.now();
        this.sound.play("footstep", { volume: this.sprinting ? 0.35 : 0.22 });
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
      // Tiny forward sprint-hop boost for that arcade momentum feel.
      if (this.sprinting) {
        this.vel.x += fwd.x * MOVEMENT.sprintJumpBoost;
        this.vel.z += fwd.z * MOVEMENT.sprintJumpBoost;
      }
      this.sound.play("footstep", { volume: 0.4 });
    }
    // Gravity: slightly stronger so jumps don't feel floaty.
    this.vel.y -= MOVEMENT.gravity * dt;

    const next = this.pos.clone();
    next.x += this.vel.x * dt;
    next.z += this.vel.z * dt;
    next.y += this.vel.y * dt;
    const desiredHorizontalX = next.x, desiredHorizontalZ = next.z;

    // ---- Horizontal collision against cover (with step-up for short boxes) ----
    const r = PLAYER_RADIUS;
    for (const cov of this.map.cover) {
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
    const groundY = groundHeightAt(this.map.cover, next.x, next.z, next.y, r);
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
    this.currentSpread = Math.min(1, spread);
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
    const boss=this.survivalBossTimers.get(c.id);
    if (boss) {
      if(now>=boss.nextPhaseAt) {
        boss.phase=(boss.phase+1)%3;
        c.weaponId=["lmg_hv","shotgun_auto","rifle_heavy"][boss.phase];
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
    if (now > ai.nextDecisionAt) {
      ai.nextDecisionAt = now + botDecisionDelay(ai.difficulty, Math.random());
      const enemy = this.nearestEnemy(c);
      const prevTarget = ai.targetId;
      ai.targetId = enemy ? enemy.id : null;
      // Record when a NEW target is acquired so we can enforce a human-like reaction delay.
      if (ai.targetId && ai.targetId !== prevTarget) {
        ai.acquiredTargetAt = now;
      }
      if (!enemy) {
        // Seek enemy and friendly dogtags when not engaged with an enemy.
        const closestTag = this.opts.mode === "killconfirmed"
          ? [...this.kcTags.values()].map(item => item.tag).sort((a, b) =>
              Math.hypot(a.pos[0] - c.pos[0], a.pos[2] - c.pos[2]) -
              Math.hypot(b.pos[0] - c.pos[0], b.pos[2] - c.pos[2]))[0]
          : undefined;
        if (closestTag) ai.wanderTarget = closestTag.pos;
        else if (Math.hypot(ai.wanderTarget[0] - c.pos[0], ai.wanderTarget[2] - c.pos[2]) < 2.5)
          ai.wanderTarget = chooseBotPatrolPoint(c.team, this.opts.mode, c.pos,
            this.map.spawns.red, this.map.spawns.blue, this.map.spawns.ffa);
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
    const tgt = targetIsSelf ? selfCombatant : target;
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
      c.pitch = this.lerpAngle(c.pitch, Math.atan2(dy, Math.hypot(dx, dz)) * 0.6 + ai.aimErrorPitch, turnLerp);

      // Spray drift accumulates while firing (simulating uncompensated recoil) and
      // decays when the bot isn't firing. Applied as an offset to the shot direction.
      const sinceFired = now - ai.lastFiredAt;
      if (sinceFired > 200) {
        // Recovering — drift decays toward 0
        ai.sprayDriftYaw *= 0.92;
        ai.sprayDriftPitch *= 0.92;
      }

      ai.sprinting = dist > 26 && ai.ammoInMag > 0 && now > ai.reloadingUntil;
      const speed = ai.moveSpeed * 6 * MOVEMENT.botPursuitMultiplier * (ai.sprinting ? 1.25 : 1) * eff.moveSpeed;
      const ideal = 14;
      // Determine the desired movement vector for this frame.
      let mvx = 0, mvz = 0;
      if (dist > ideal + 3) { mvx = Math.sin(c.yaw) * speed * dt; mvz = Math.cos(c.yaw) * speed * dt; }
      else if (dist < ideal - 3) { mvx = -Math.sin(c.yaw) * speed * dt; mvz = -Math.cos(c.yaw) * speed * dt; }
      else { mvx = Math.cos(c.yaw) * ai.strafeDir * speed * dt * 0.7; mvz = -Math.sin(c.yaw) * ai.strafeDir * speed * dt * 0.7; }
      // Obstacle-aware chase navigation around the dense Bunker centre.
      if((dist > ideal + 3 || Math.abs(tgt.pos[1] - c.pos[1]) > 1.3) &&
          (Math.abs(tgt.pos[1] - c.pos[1]) > 1.3 || this.opts.mapId==="bunker" ||
          this.botMoveBlocked(c.pos,[c.pos[0]+mvx*6,c.pos[1],c.pos[2]+mvz*6],c.pos[1]))) {
        if(now>(ai.nextRouteAt??0)||!ai.routeWaypoint){
          ai.routeWaypoint=botNextWaypoint(c.pos,tgt.pos,this.map.cover,this.map.size,3,this.map.environment);
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
        ai.burstShotsLeft = Math.max(2, Math.round(3 + ai.skill * 4 + (Math.random() - 0.5) * 2));
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

      if (!ai.sprinting && reacted && now > ai.nextShotAt && ai.ammoInMag > 0 && now > ai.reloadingUntil && !burstPaused) {
        const origin: Vec3 = [c.pos[0], c.pos[1] + 1.5, c.pos[2]];
        // Final aim = bot yaw/pitch + weapon spread + spray drift + distance spread + (miss boost)
        const aimYaw = c.yaw + ai.sprayDriftYaw + (Math.random() - 0.5) * (eff.spread * 2 + distSpread + missSpread);
        const aimPitch = c.pitch + ai.sprayDriftPitch + (Math.random() - 0.5) * (eff.spread * 2 + distSpread + missSpread);
        const dir = this.dirFromYawPitch(aimYaw, aimPitch);
        const pellets = w.stats.pellets ?? 1;
        for (let i = 0; i < pellets; i++) {
          const pdir = pellets > 1 ? this.normalize(this.add(dir, this.randSpread(eff.spread))) : dir;
          this.botFireRay(c, origin, pdir, eff, w.stats.headshotMult);
        }
        this.spawnTracer(origin, dir, c.weaponSkinId);
        c.lastFireRecoil = now;
        ai.lastFiredAt = now;
        ai.ammoInMag--;
        c.spawnProtectedUntil = 0; // attacking cancels bot spawn protection
        if (c.shieldMesh) c.shieldMesh.visible = false;
        this.recordRadarShot(c.id, c.pos, c.team, ai.attachments.barrel === "barrel_suppressor");
        // Enemy fire sound: distance-attenuated + muffled if suppressed.
        // Bots in offline mode have null barrel attachments (no suppressors),
        // but the check is wired correctly so a future loadout pass would Just Work.
        this.playEnemyFireSound(c.pos, c.weaponId, ai.attachments.barrel === "barrel_suppressor");
        // Accumulate spray drift from this shot (recovers when not firing).
        const driftKick = eff.recoil * 0.0024 * (1 - ai.skill * 0.5);
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
      const wantSmartReload = lowAmmo && !enemyVisible && ai.skill > 0.4 && Math.random() < 0.02;
      if (!ai.sprinting && (ai.ammoInMag <= 0 || wantSmartReload) && now > ai.reloadingUntil) {
        ai.reloadingUntil = now + eff.reloadTime * 1000; ai.ammoInMag = eff.magSize;
        ai.burstShotsLeft = 0;
        ai.burstEndsAt = now + eff.reloadTime * 1000;
      }
    } else {
      ai.sprinting = false;
      const dx = ai.wanderTarget[0] - c.pos[0], dz = ai.wanderTarget[2] - c.pos[2];
      const d = Math.hypot(dx, dz);
      if (d > 1.5) {
        // Task 16-a: wall-ahead lookahead. Probe 2 units forward in the
        // movement direction. If blocked, rotate the movement direction by
        // ±35° (sign from ai.strafeDir) so the bot angles around the obstacle
        // instead of headbutting it. The yaw is set to the rotated direction
        // so the bot faces where it's going.
        let fx = dx / d, fz = dz / d;
        const patrolBlocked = this.botMoveBlocked(c.pos, [c.pos[0]+fx*4,c.pos[1],c.pos[2]+fz*4],c.pos[1]);
        if(patrolBlocked || Math.abs(ai.wanderTarget[1] - c.pos[1]) > 1.3 || this.opts.mapId === "bunker") {
          if(now>(ai.nextRouteAt??0)||!ai.routeWaypoint){
            ai.routeWaypoint=botNextWaypoint(c.pos,ai.wanderTarget,this.map.cover,this.map.size,3,this.map.environment);
            ai.nextRouteAt=now+850;
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
        // Task 16-a: substepped, collision-aware movement (brings the wander
        // path to parity with the engage path so bots can't clip into walls
        // mid-wander). SUBSTEP=0.15, with slide-along-wall + 45° diagonal.
        const moveSpeed = ai.moveSpeed * 5 * MOVEMENT.botPursuitMultiplier * dt;
        const mvx = fx * moveSpeed;
        const mvz = fz * moveSpeed;
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

      }
    }
    // Always perform vertical navigation, including when stationary: a bot that
    // stops moving at a ledge must still fall, rather than float/phase through it.
    c.pos = this.clamp(this.collideBots(c.pos, c.pos[1]));
    if (c.ai?.envJumpVelocityY !== undefined) {
      const vy = c.ai.envJumpVelocityY;
      c.pos = [c.pos[0] + (c.ai.envLaunchX ?? 0) * dt,
        c.pos[1] + vy * dt,
        c.pos[2] + (c.ai.envLaunchZ ?? 0) * dt];
      c.ai.envJumpVelocityY = vy - 22 * dt;
      const ground = botGroundHeight(this.map.cover, c.pos[0], c.pos[2], c.pos[1]);
      if (c.ai.envJumpVelocityY <= 0 && c.pos[1] <= ground) {
        c.pos[1] = ground;
        c.ai.envJumpVelocityY = undefined;
      }
    } else {
      c.pos[1] = botNextFeetY(this.map.cover, c.pos, dt);
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
        ai.targetId = null;        // wander instead of engaging
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
      if (e.id === c.id || !e.alive) continue;
      if (e.team === c.team && this.opts.mode !== "ffa" && this.opts.mode !== "gungame") continue;
      const d = Math.hypot(e.pos[0] - c.pos[0], e.pos[2] - c.pos[2]);
      if (d >= bestD) continue;
      // Only acquire targets within engagement range AND with clear LoS.
      if (d > 55) continue;
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
    for (const cov of this.map.cover) {
      if (cov.kind === "accent" || cov.kind === "stair") continue;
      const t = rayBox(from, dir, cov.pos, cov.size);
      if (t !== null && t < len) return false;
    }
    return true;
  }

  private botFireRay(attacker: Combatant, origin: Vec3, dir: Vec3, eff: EffectiveStats, headshotMult: number) {
    let nearest: { victim: Combatant; t: number; head: boolean } | null = null;
    const selfC: Combatant = {
      id: this.selfId, name: this.opts.playerName, team: this.opts.team as string, isBot: false, isSelf: true,
      pos: [this.pos.x, this.pos.y, this.pos.z], yaw: 0, pitch: 0, health: this.health, alive: this.alive,
      weaponId: "", weaponSkinId: "", playerSkinId: "", kills: 0, deaths: 0, score: 0,
    };
    const candidates = [...this.combatants.values(), selfC];
    for (const e of candidates) {
      if (e.id === attacker.id || !e.alive) continue;
      if (e.team === attacker.team && this.opts.mode !== "ffa" && this.opts.mode !== "gungame") continue;
      const hit = rayCombatantHit(origin, dir, e.pos);
      if (hit && hit.t <= eff.range * 1.6) {
        if (!nearest || hit.t < nearest.t) nearest = { victim: e, t: hit.t, head: hit.head };
      }
    }
    let blockedT = Infinity;
    for (const cov of this.map.cover) {
      const t = rayBox(origin, dir, cov.pos, cov.size);
      if (t !== null && t < blockedT) blockedT = t;
    }
    if (nearest && nearest.t < blockedT) {
      const baseDmg = eff.damage * (nearest.head ? headshotMult : 1);
      let dmg = this.damageAtRange(baseDmg, nearest.t, eff.range);
      // Survival: bots hit harder as waves progress, BUT base damage is reduced
      // by 35% to give players more survivability (Round 18-b balance fix).
      // Net: wave 1 = 65% damage, wave 8 = 65%*1.42 = 92%, wave 14 = 65%*1.78 = 116%.
      // This gives players a much better early game while still ramping up.
      if (this.opts.mode === "survival")
        dmg *= 0.65 * survivalWaveDamageMul(this.survivalWave) * survivalWaveMutators(this.survivalTier,this.survivalWave).damageMul;
      // Round 20h: Check local player spawn protection — skip damage if protected.
      if (nearest.victim.id === this.selfId && this.selfSpawnProtectedUntil > Date.now()) {
        return; // player is spawn-protected — no damage
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
        this.takeDamage(dmg, attacker.name, attacker.team, headshotMult > 1);
      } else {
        nearest.victim.health -= dmg;
        if (nearest.victim.health <= 0 && nearest.victim.alive) {
          nearest.victim.alive = false; nearest.victim.deaths += 1;
          if (this.opts.mode !== "killconfirmed") nearest.victim.score = nearest.victim.kills;
          attacker.kills += 1;
          if (this.opts.mode !== "killconfirmed") attacker.score = attacker.kills;
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

  private takeDamage(dmg: number, attackerName: string, attackerTeam: string, head: boolean, weaponId = "rifle_ar") {
    if (!this.alive || this.selfSpawnProtectedUntil > Date.now()) return;
    this.health -= dmg;
    this.damageFlashAt = performance.now();
    this.lastDamageAt = performance.now();
    // Hit-taken SFX (sharp low thud). Throttled so a burst doesn't spam.
    this.sound.play("hit_taken", { volume: 0.55, throttleMs: 80 });
    if (this.health <= 0) {
      this.health = 0; this.alive = false; this.deaths += 1;
      if (this.opts.mode === "killconfirmed") this.dropLocalKillConfirmedTag(this.selfId, this.opts.team as string, [this.pos.x, this.pos.y, this.pos.z]);
      // Local player death SFX.
      this.sound.play("death", { volume: 0.8 });
      const entry: KillFeedEntry = { killer: attackerName, victim: this.opts.playerName, weapon: weaponId, headshot: head, killerTeam: attackerTeam, victimTeam: this.opts.team as string };
      this.killFeed.unshift(entry); if (this.killFeed.length > 6) this.killFeed.pop();
      this.opts.onKillFeed(entry);
      // Survival: consume a reinforcement. Game over when the pool is empty.
      if (this.opts.mode === "survival") {
        this.survivalReinforcements = Math.max(0, this.survivalReinforcements - 1);
        if (this.survivalReinforcements <= 0) {
          this.finalizeMatchLocal(); // out of reinforcements — game over
        } else {
          this.respawnAt = performance.now() + SURVIVAL_RESPAWN_MS;
        }
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
    const radarNow = Date.now();
    for (const [id, ping] of this.radarPings) if (ping.expiresAt <= radarNow) this.radarPings.delete(id);
    const scoreboard: ScoreRow[] = [];
    if (this.opts.online) {
      for (const c of this.combatants.values()) {
        scoreboard.push({ id: c.id, name: c.name, team: c.team, kills: c.kills, deaths: c.deaths, score: c.score, isBot: c.isBot, isSelf: c.id === this.selfId });
      }
    } else {
      for (const c of this.combatants.values()) {
        scoreboard.push({ id: c.id, name: c.name, team: c.team, kills: c.kills, deaths: c.deaths, score: this.opts.mode === "killconfirmed" ? c.score : c.kills, isBot: c.isBot, isSelf: false });
      }
      scoreboard.push({ id: this.selfId, name: this.opts.playerName, team: this.opts.team as string, kills: this.kills, deaths: this.deaths, score: this.opts.mode === "killconfirmed" ? this.confirmations + (this.denialScoreEnabled ? this.denials : 0) : this.kills, isBot: false, isSelf: true });
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
      score: this.opts.online ? (this.combatants.get(this.selfId)?.score ?? (this.opts.mode === "killconfirmed" ? this.confirmations + (this.denialScoreEnabled ? this.denials : 0) : this.kills)) : (this.opts.mode === "killconfirmed" ? this.confirmations + (this.denialScoreEnabled ? this.denials : 0) : this.kills),
      teamScores: this.teamScores,
      scoreLimit: this.scoreLimit,
      confirmations: this.confirmations,
      denials: this.denials,
      denialScoreEnabled: this.denialScoreEnabled,
      tagNotice: this.tagNotice,
      timeLeft: Math.max(0, Math.ceil(this.timeLeft)),
      scoreboard,
      killFeed: this.killFeed,
      lastElimination: this.lastElimination,
      hitMarker: this.hitMarkerAt,
      headshotMarker: this.headshotMarkerAt,  // Round 20g: headshot marker
      damageFlash: this.damageFlashAt,
      pointerLocked: this.pointerLocked,
      ping: this.ping,
      killstreak: this.lastKillstreak ?? undefined,
      damageDir: this.lastDamageDir ?? undefined,
      damageDirAt: this.lastDamageDirAt,
      mapName: this.map.name,
      radar: {
        size: this.map.size, playerX: this.pos.x, playerZ: this.pos.z, yaw: this.yaw,
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
      // Dynamic crosshair spread (drives HUD crosshair gap size).
      spreadFactor: this.currentSpread,
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
      primaryWeaponId: this.primaryWeaponId,
      secondaryWeaponId: this.secondaryWeaponId,
      meleeWeaponId: this.meleeWeaponId,
      ...(this.opts.mode === "survival" ? {
        survivalWave: this.survivalWave,
        survivalTier: this.survivalTier,
        survivalModifierNames: survivalWaveMutators(this.survivalTier,this.survivalWave).names,
        survivalBossWave: survivalWaveMutators(this.survivalTier,this.survivalWave).boss,
        survivalEnemiesLeft: this.survivalEnemiesLeft,
        survivalReinforcements: this.survivalReinforcements,
        survivalMaxReinforcements: this.survivalMaxReinforcements,
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
    return resolveBotOverlap(this.map.cover, pos, currentY);
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
    const minDist = 2 * PLAYER_RADIUS + 0.2;
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
      if (!blocksBotMotion(this.map.cover, before, after, currentY)) {
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
    if (blocksBotMotion(this.map.cover, from, to, currentY)) return true;
    for (const o of this.map.environment ?? []) {
      if (o.type !== "fire" && !(o.type === "spikes" && spikesActive(o, this.environmentTime))) continue;
      if (!withinEnvironment(o, from) && withinEnvironment(o, to)) return true;
    }
    return false;
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
    for (const id of [...this.kcTags.keys()]) this.removeKillConfirmedTag(id);
    this.disposed = true;
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
    this.weaponAudio.dispose();
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
