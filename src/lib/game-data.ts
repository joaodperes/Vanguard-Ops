// ============================================================================
// VANGUARD OPS — Static game data catalog
// Shared between API routes, the game server, and the client UI.
// ============================================================================

import type { WeaponSpecial } from "./weapon-mechanics";

export type WeaponCategory = "assault" | "smg" | "shotgun" | "dmr" | "sniper" | "lmg" | "sidearm" | "melee";

// Weapon slots are the three loadout positions a player can equip.
// primary  -> assault / smg / shotgun / dmr / sniper / lmg
// secondary -> sidearm
// melee    -> melee
export type WeaponSlot = "primary" | "secondary" | "melee";

// The secondary accepts a second primary only with Well Prepared.
export function isPrimaryWeaponCategory(category: WeaponCategory): boolean {
  return category !== "sidearm" && category !== "melee";
}

// Map a weapon category to its loadout slot.
export function weaponSlot(category: WeaponCategory): WeaponSlot {
  switch (category) {
    case "sidearm": return "secondary";
    case "melee": return "melee";
    default: return "primary";
  }
}

export interface WeaponStats {
  damage: number;        // per bullet
  fireRate: number;      // rounds per second
  magSize: number;
  reloadTime: number;    // seconds
  spread: number;        // base inaccuracy (radians) when hipfiring
  adsSpread: number;     // inaccuracy when aiming
  recoil: number;        // vertical kick magnitude
  range: number;         // effective range (damage falloff beyond)
  adsTime: number;       // seconds to aim down sights
  moveSpeed: number;     // movement multiplier
  auto: boolean;         // automatic fire
  pellets?: number;      // for shotguns
  burst?: number;        // shots per burst (e.g. 3 = 3-round burst). Default 1 (no burst).
  headshotMult: number;  // headshot damage multiplier
}

export interface WeaponDef {
  special?: WeaponSpecial;
  /** Wonder weapons are purchased with permanent weapon-Prestige tokens. */
  wonder?: { kind: "singularity" | "corrosion" | "turret"; maxCharges: 1 | 2; rechargeMs: number; killBonusMs: number; radius: number };
  id: string;
  name: string;
  category: WeaponCategory;
  unlockLevel: number;
  unlockCost: number;    // credits
  stats: WeaponStats;
  description: string;
  // Optional list of attachment slots this weapon supports. If undefined, all 4
  // slots (sight/barrel/grip/magazine) are available. Use [] for weapons that
  // don't take attachments (e.g. the knife).
  attachments?: AttachmentSlot[];
  // The sight type used when NO sight attachment is equipped. Defaults to
  // "iron". Snipers set this to "sniper_scope" so they have a proper 6x scope
  // out of the box (the user can still override by equipping a different sight
  // attachment, but the default is no longer iron sight).
  baseSightType?: SightType;
}

export const WEAPONS: WeaponDef[] = [
  {
    id: "wonder_singularity", name: "Event Horizon", category: "dmr",
    unlockLevel: 1, unlockCost: 0,
    description: "Wonder Weapon: a collapsing star launches a devastating gravity pulse. One charge.",
    wonder: { kind: "singularity", maxCharges: 1, rechargeMs: 48000, killBonusMs: 2400, radius: 11 },
    attachments: [],
    stats: { damage: 165, fireRate: 0.7, magSize: 1, reloadTime: 0, spread: 0.003, adsSpread: 0.0004, recoil: 2.4, range: 95, adsTime: 0.36, moveSpeed: 0.88, auto: false, headshotMult: 1 },
  },
  {
    id: "wonder_corrosion", name: "Plagueheart", category: "shotgun",
    unlockLevel: 1, unlockCost: 0,
    description: "Wonder Weapon: unstable bio-reactor seeds a corrosive blast and lingering poison. Two charges.",
    wonder: { kind: "corrosion", maxCharges: 2, rechargeMs: 38000, killBonusMs: 1800, radius: 9 },
    attachments: [],
    stats: { damage: 85, fireRate: 1.1, magSize: 2, reloadTime: 0, spread: 0.005, adsSpread: 0.002, recoil: 1.8, range: 60, adsTime: 0.28, moveSpeed: 0.94, auto: false, headshotMult: 1 },
  },
  {
    id: "wonder_turret", name: "Bullet Spitter", category: "lmg",
    unlockLevel: 1, unlockCost: 0,
    description: "Wonder Weapon: deploy an automated turret with a 140° horizontal field of fire and full vertical tracking. Lasts 25 seconds; any explosive or melee strike destroys it immediately.",
    wonder: { kind: "turret", maxCharges: 1, rechargeMs: 55000, killBonusMs: 2000, radius: 0 },
    attachments: [],
    stats: { damage: 17, fireRate: 2.8, magSize: 1, reloadTime: 0, spread: 0, adsSpread: 0, recoil: 0, range: 30, adsTime: 0.1, moveSpeed: 0.9, auto: false, headshotMult: 1 },
  },
  // Special weapons — opt into a mechanic; ordinary guns keep their existing behavior.
  {
    id: "rifle_electron", name: "Electron Rifle", category: "assault",
    unlockLevel: 31, unlockCost: 2200,
    description: "Unlimited energy shots. Manage heat or vent the reactor before it overheats.",
    special: { kind: "heat", heatPerShot: 5, coolPerSecond: 43, coolDelayMs: 175, overheatAt: 100, resumeAt: 45, ventSeconds: 0.85 },
    stats: { damage: 24, fireRate: 9, magSize: 100, reloadTime: 1.25, spread: 0.014, adsSpread: 0.004, recoil: 0.55, range: 75, adsTime: 0.24, moveSpeed: 0.93, auto: true, headshotMult: 1.45 },
    attachments: ["sight", "grip"],
  },
  {
    id: "crossbow_reclaimer", name: "Reclaimer Crossbow", category: "dmr",
    unlockLevel: 19, unlockCost: 1600,
    description: "Retrieve fired bolts on the ground to shorten your reload. Optional poison tips.",
    special: { kind: "bolt", pickupRadius: 2.0, lifetimeMs: 18000, quickReloadSeconds: 0.65 },
    stats: { damage: 76, fireRate: 0.65, magSize: 1, reloadTime: 2.1, spread: 0.009, adsSpread: 0.001, recoil: 0.35, range: 85, adsTime: 0.28, moveSpeed: 0.94, auto: false, headshotMult: 1.6 },
    attachments: ["sight", "barrel"],
  },
  {
    id: "pistol_arc", name: "Arc Pistol", category: "sidearm",
    unlockLevel: 32, unlockCost: 2300,
    description: "Electrical discharge leaps to nearby foes for decreasing damage.",
    special: { kind: "arc", jumps: 2, radius: 6, decay: 0.55 },
    stats: { damage: 35, fireRate: 3.2, magSize: 10, reloadTime: 1.9, spread: 0.013, adsSpread: 0.004, recoil: 0.7, range: 50, adsTime: 0.2, moveSpeed: 1.02, auto: false, headshotMult: 1.35 },
    attachments: ["sight", "magazine"],
  },
  // Semi-auto accuracy specialist: high per-shot reward, no auto-fire.
  {
    id: "rifle_falcon", name: "Falcon SR", category: "assault", unlockLevel: 20, unlockCost: 1900,
    description: "Precise semi-auto rifle with hard-hitting controlled shots and a small magazine.",
    stats: { damage: 54, fireRate: 4.2, magSize: 16, reloadTime: 2.2, spread: 0.007, adsSpread: 0.0015, recoil: 1.15, range: 105, adsTime: 0.29, moveSpeed: 0.89, auto: false, headshotMult: 1.65 },
  },
  // Compact two-round burst weapon for rhythmic tap-fire, unlike the Reaver's 3-round burst.
  {
    id: "rifle_hydra", name: "Hydra Twin", category: "assault", unlockLevel: 34, unlockCost: 2600,
    description: "Fast two-round bursts. Strong opening damage but demanding burst discipline.",
    stats: { damage: 29, fireRate: 11, burst: 2, magSize: 32, reloadTime: 2.5, spread: 0.012, adsSpread: 0.003, recoil: 1.05, range: 73, adsTime: 0.24, moveSpeed: 0.94, auto: false, headshotMult: 1.45 },
  },
  {
    id: "dmr_cyclone", name: "Cyclone DMR", category: "dmr", unlockLevel: 18, unlockCost: 1900,
    description: "Two-shot burst marksman rifle for fast follow-up hits at medium-long range.",
    stats: { damage: 39, fireRate: 9, burst: 2, magSize: 20, reloadTime: 2.6, spread: 0.006, adsSpread: 0.0015, recoil: 1.05, range: 116, adsTime: 0.33, moveSpeed: 0.86, auto: false, headshotMult: 1.75 },
  },
  {
    id: "dmr_whisper", name: "Whisper DMR", category: "dmr", unlockLevel: 35, unlockCost: 2700,
    description: "Low-recoil semi-auto precision rifle. Extremely accurate but deliberately paced.",
    stats: { damage: 62, fireRate: 2.7, magSize: 14, reloadTime: 2.0, spread: 0.003, adsSpread: 0.0006, recoil: 0.42, range: 145, adsTime: 0.32, moveSpeed: 0.9, auto: false, headshotMult: 1.9 },
  },
  {
    id: "baton", name: "Shock Baton", category: "melee", unlockLevel: 16, unlockCost: 900,
    description: "Quick defensive baton with extended reach and rapid successive strikes.",
    stats: { damage: 60, fireRate: 2.8, magSize: 1, reloadTime: 0, spread: 0, adsSpread: 0, recoil: 0, range: 3.25, adsTime: 0, moveSpeed: 1.13, auto: false, headshotMult: 1.5 }, attachments: [],
  },
  {
    id: "axe", name: "Breacher Axe", category: "melee", unlockLevel: 33, unlockCost: 2300,
    description: "Heavy chopping weapon with superior reach; slow, powerful committed swings.",
    stats: { damage: 145, fireRate: 0.98, magSize: 1, reloadTime: 0, spread: 0, adsSpread: 0, recoil: 0, range: 3.2, adsTime: 0, moveSpeed: 0.96, auto: false, headshotMult: 1.5 }, attachments: [],
  },
  {
    id: "rifle_ar",
    name: "VK-12 Assault",
    category: "assault",
    unlockLevel: 1,
    unlockCost: 0,
    description: "Balanced full-auto rifle. Reliable in any engagement.",
    // 35 dmg @ 9 rps, hsMult 1.5 → 3 chest / 2 head to kill 100HP. TTK ~0.22s chest, ~0.11s head.
    stats: { damage: 35, fireRate: 9, magSize: 30, reloadTime: 2.2, spread: 0.012, adsSpread: 0.003, recoil: 0.9, range: 80, adsTime: 0.25, moveSpeed: 0.9, auto: true, headshotMult: 1.5 },
  },
  // Tier 2 SMG — 800 CR (Task 18-c+d economy tier scheme).
  {
    id: "smg_kp",
    name: "Kestrel SMG",
    category: "smg",
    unlockLevel: 12,
    unlockCost: 800,
    description: "High fire-rate submachine gun. Excels in close quarters.",
    // 26 dmg @ 13 rps, hsMult 1.4 → 4 chest / 3 head to kill 100HP. TTK ~0.31s chest, ~0.23s head.
    stats: { damage: 26, fireRate: 13, magSize: 28, reloadTime: 1.9, spread: 0.02, adsSpread: 0.006, recoil: 0.7, range: 45, adsTime: 0.18, moveSpeed: 1.05, auto: true, headshotMult: 1.4 },
  },
  // Tier 1 shotgun — 500 CR (Task 18-c+d economy tier scheme).
  {
    id: "shotgun_br",
    name: "Breacher",
    category: "shotgun",
    unlockLevel: 4,
    unlockCost: 500,
    description: "Pump shotgun. Devastating up close, 8 pellets per shell.",
    // 19 dmg * 8 pellets = 152 per shell, hsMult 1.3 → 1 shell to kill at point blank.
    stats: { damage: 19, fireRate: 1.6, magSize: 7, reloadTime: 3.0, spread: 0.075, adsSpread: 0.05, recoil: 1.6, range: 24, adsTime: 0.3, moveSpeed: 0.92, auto: false, pellets: 8, headshotMult: 1.3 },
    // Shotguns don't take a grip slot — only sight/barrel/magazine.
    attachments: ["sight", "barrel", "magazine"],
  },
  // Tier 2 DMR — 800 CR (Task 18-c+d economy tier scheme).
  {
    id: "rifle_dm",
    name: "Marksman DMR",
    category: "dmr",
    unlockLevel: 15,
    unlockCost: 800,
    description: "Semi-auto designated marksman rifle. Punches hard at range.",
    // 74 dmg @ 4 rps, hsMult 1.8 → 2 chest / 1 head to kill 100HP. TTK ~0.25s head, ~0.5s chest.
    stats: { damage: 74, fireRate: 4, magSize: 20, reloadTime: 2.5, spread: 0.005, adsSpread: 0.0015, recoil: 1.3, range: 110, adsTime: 0.35, moveSpeed: 0.85, auto: false, headshotMult: 1.8 },
  },
  // Tier 2 sniper — 800 CR (Task 18-c+d economy tier scheme).
  {
    id: "sniper_lr",
    name: "Longshot",
    category: "sniper",
    unlockLevel: 26,
    unlockCost: 800,
    description: "Bolt-action sniper. One-shot kills to the head, two to the body.",
    // 135 dmg, hsMult 2.0 → headshot = 270 (1-shot kill), body = 135 (1 shot to kill 100HP).
    stats: { damage: 135, fireRate: 1, magSize: 5, reloadTime: 3.2, spread: 0.001, adsSpread: 0.0, recoil: 2.6, range: 200, adsTime: 0.6, moveSpeed: 0.7, auto: false, headshotMult: 2.0 },
    // Snipers don't take a grip slot — only sight/barrel/magazine.
    attachments: ["sight", "barrel", "magazine"],
    // Snipers ship with a 6x scope as standard (not iron sight). The player
    // can still equip a different sight attachment to override this.
    baseSightType: "sniper_scope",
  },
  // Tier 2 LMG — 800 CR (Task 18-c+d economy tier scheme).
  {
    id: "lmg_hv",
    name: "Hailstorm LMG",
    category: "lmg",
    unlockLevel: 24,
    unlockCost: 800,
    description: "Heavy machine gun. 75-round belt, suppressive monster.",
    // 30 dmg @ 10 rps, hsMult 1.4 → 4 chest / 3 head to kill 100HP. TTK ~0.4s chest.
    stats: { damage: 30, fireRate: 10, magSize: 75, reloadTime: 4.0, spread: 0.018, adsSpread: 0.005, recoil: 1.0, range: 90, adsTime: 0.4, moveSpeed: 0.75, auto: true, headshotMult: 1.4 },
  },
  {
    id: "pistol_side",
    name: "Sidearm P-9",
    category: "sidearm",
    unlockLevel: 1,
    unlockCost: 0,
    description: "Standard issue sidearm. Always equipped as backup.",
    // 41 dmg @ 5 rps, hsMult 1.5 → 3 chest / 2 head to kill 100HP.
    stats: { damage: 41, fireRate: 5, magSize: 12, reloadTime: 1.6, spread: 0.015, adsSpread: 0.005, recoil: 0.8, range: 50, adsTime: 0.2, moveSpeed: 1.0, auto: false, headshotMult: 1.5 },
    // Sidearms don't take a grip slot.
    attachments: ["sight", "barrel", "magazine"],
  },
  // Tier 3 SMG — 1200 CR (Task 18-c+d economy tier scheme).
  {
    id: "smg_vector",
    name: "Vector PDW",
    category: "smg",
    unlockLevel: 17,
    unlockCost: 1200,
    description: "Compact PDW with blistering fire rate. Shreds at point-blank.",
    // 16 dmg @ 16 rps → ~7 chest / 5 head to kill 100HP. TTK ~0.44s chest.
    stats: { damage: 16, fireRate: 16, magSize: 40, reloadTime: 2.1, spread: 0.022, adsSpread: 0.008, recoil: 0.6, range: 38, adsTime: 0.16, moveSpeed: 1.1, auto: true, headshotMult: 1.35 },
  },
  // Tier 3 shotgun — 1200 CR (Task 18-c+d economy tier scheme).
  {
    id: "shotgun_auto",
    name: "Wraith Auto",
    category: "shotgun",
    unlockLevel: 21,
    unlockCost: 1200,
    description: "Full-auto shotgun. 8 pellets per shell, sustained suppression.",
    // 9 dmg * 8 pellets = 72 per shell, hsMult 1.3. Full-auto at 2.5 rps.
    stats: { damage: 9, fireRate: 2.5, magSize: 10, reloadTime: 3.4, spread: 0.08, adsSpread: 0.055, recoil: 1.4, range: 22, adsTime: 0.3, moveSpeed: 0.9, auto: true, pellets: 8, headshotMult: 1.3 },
  },
  {
    id: "pistol_magnum",
    name: "Magnum .50",
    category: "sidearm",
    unlockLevel: 23,
    unlockCost: 1500,
    description: "Heavy revolver. Two chest shots drop a full-health target.",
    // 115 dmg @ 1.7 rps, hsMult 2.0 → 1 chest / 1 head to kill 100HP.
    stats: { damage: 115, fireRate: 1.7, magSize: 6, reloadTime: 2.4, spread: 0.01, adsSpread: 0.003, recoil: 2.0, range: 70, adsTime: 0.25, moveSpeed: 0.98, auto: false, headshotMult: 2.0 },
  },
  // Tier 1 DMR — 500 CR (Task 18-c+d economy tier scheme).
  {
    id: "dmr_scout",
    name: "Scout Tactical",
    category: "dmr",
    unlockLevel: 7,
    unlockCost: 500,
    description: "Lightweight DMR. Faster handling than the Marksman, softer punch.",
    // 51 dmg @ 6 rps, hsMult 1.7 → 2 chest / 1 head to kill 100HP.
    stats: { damage: 51, fireRate: 6, magSize: 24, reloadTime: 2.2, spread: 0.006, adsSpread: 0.002, recoil: 1.0, range: 95, adsTime: 0.28, moveSpeed: 0.92, auto: false, headshotMult: 1.7 },
  },
  {
    id: "knife_tactical",
    name: "Tactical Knife",
    category: "melee",
    unlockLevel: 1,
    unlockCost: 0,
    description: "Standard issue combat knife. Silent and lethal at touching distance.",
    // 101 dmg, hsMult 2.0 → 1 chest / 1 head to kill 100HP.
    stats: { damage: 101, fireRate: 2, magSize: 1, reloadTime: 0, spread: 0, adsSpread: 0, recoil: 0, range: 3, adsTime: 0, moveSpeed: 1.1, auto: false, headshotMult: 2.0 },
    // The knife accepts no attachments.
    attachments: [],
  },
  {
    id: "shiv",
    name: "Shiv",
    category: "melee",
    unlockLevel: 2,
    unlockCost: 200,
    description: "Improvised blade. Lightning fast but fragile. Two quick stabs to drop an enemy.",
    // 47 dmg @ 3.5 rps, hsMult 2.0 → 3 chest / 2 head to kill 100HP. Fastest melee, lowest per-hit damage.
    stats: { damage: 47, fireRate: 3.5, magSize: 1, reloadTime: 0, spread: 0, adsSpread: 0, recoil: 0, range: 2.2, adsTime: 0, moveSpeed: 1.2, auto: false, headshotMult: 2.0 },
    // The shiv accepts no attachments.
    attachments: [],
  },
  {
    id: "machete",
    name: "Machete",
    category: "melee",
    unlockLevel: 8,
    unlockCost: 600,
    description: "Versatile blade. Balanced swing speed and damage.",
    // 81 dmg @ 1.6 rps, hsMult 1.8 → 2 chest / 1 head to kill 100HP. Balanced mid-tier melee.
    stats: { damage: 81, fireRate: 1.6, magSize: 1, reloadTime: 0, spread: 0, adsSpread: 0, recoil: 0, range: 2.6, adsTime: 0, moveSpeed: 1.15, auto: false, headshotMult: 1.8 },
    // The machete accepts no attachments.
    attachments: [],
  },
  {
    id: "hammer",
    name: "Sledge Hammer",
    category: "melee",
    unlockLevel: 29,
    unlockCost: 1500,
    description: "Brutal slow swing. One hit drops anything short of armor.",
    // 189 dmg @ 0.7 rps, hsMult 1.5 → 1 chest / 1 head to kill 100HP. One body shot drops near anything.
    stats: { damage: 189, fireRate: 0.7, magSize: 1, reloadTime: 0, spread: 0, adsSpread: 0, recoil: 0, range: 2.8, adsTime: 0, moveSpeed: 0.92, auto: false, headshotMult: 1.5 },
    // The hammer accepts no attachments.
    attachments: [],
  },
  {
    id: "pistol_burst",
    name: "Burst Pistol",
    category: "sidearm",
    unlockLevel: 13,
    unlockCost: 800,
    description: "Three-round burst sidearm. High burst DPS at mid range.",
    // 24 dmg @ 4 rps burst-fire (3-round burst). hsMult 1.5. Each trigger pull fires
    // 3 rounds in quick succession; longer pause between bursts.
    stats: { damage: 24, fireRate: 4, magSize: 21, reloadTime: 2.0, spread: 0.012, adsSpread: 0.004, recoil: 0.9, range: 55, adsTime: 0.18, moveSpeed: 1.0, auto: false, burst: 3, headshotMult: 1.5 },
    attachments: ["sight", "barrel", "magazine"],
  },
  {
    id: "pistol_machine",
    name: "Machine Pistol",
    category: "sidearm",
    unlockLevel: 30,
    unlockCost: 2000,
    description: "Full-auto machine pistol. Mag-dump to win at point-blank.",
    // 19 dmg @ 11 rps, hsMult 1.35 → ~6 chest / 4 head to kill 100HP. TTK ~0.55s chest, ~0.36s head.
    stats: { damage: 19, fireRate: 11, magSize: 25, reloadTime: 1.8, spread: 0.025, adsSpread: 0.008, recoil: 0.85, range: 40, adsTime: 0.15, moveSpeed: 1.05, auto: true, headshotMult: 1.35 },
    attachments: ["sight", "barrel", "magazine"],
  },
  {
    id: "launcher_rocket",
    name: "RL-7 Rocket Launcher",
    category: "sidearm",
    unlockLevel: 36,
    unlockCost: 4000,
    description: "Shoulder-fired rocket. Splash damage on impact — clear rooms and campers.",
    // 176 dmg @ 0.7 rps, hsMult 1.0, magSize 1. Slow heavy-hitter (1 rocket to kill 100HP).
    // NOTE: Engine does not yet support AoE/splash damage — currently fires as a slow single-shot heavy.
    // Future enhancement: add splash radius so missed-but-close shots deal partial damage.
    stats: { damage: 176, fireRate: 0.7, magSize: 1, reloadTime: 3.5, spread: 0.0, adsSpread: 0.0, recoil: 2.5, range: 90, adsTime: 0.5, moveSpeed: 0.75, auto: false, pellets: 1, headshotMult: 1.0 },
    // Launchers take only sight + barrel (no grip, no magazine — fixed single-shot tube).
    attachments: ["sight", "barrel"],
  },
  // ---- New weapons (variety expansion) ----
  // Low-level sniper so players who enjoy sniping don't have to wait until LVL 12.
  // Tier 1 sniper — 500 CR (Task 18-c+d economy tier scheme).
  {
    id: "sniper_scout",
    name: "Scout Sniper",
    category: "sniper",
    unlockLevel: 5,
    unlockCost: 500,
    description: "Lightweight entry-level sniper. Faster handling than the Longshot, but won't one-shot body kill.",
    // 95 dmg, hsMult 2.0 → headshot = 190 (1-shot kill), body = 95 (2 shots to kill). Faster fire rate + ADS.
    stats: { damage: 95, fireRate: 1.2, magSize: 7, reloadTime: 2.6, spread: 0.002, adsSpread: 0.0, recoil: 1.8, range: 160, adsTime: 0.45, moveSpeed: 0.82, auto: false, headshotMult: 2.0 },
    attachments: ["sight", "barrel", "magazine"],
    baseSightType: "sniper_scope",
  },
  // Second assault rifle — burst-fire, earlier unlock level
  // Tier 2 assault — 800 CR (Task 18-c+d economy tier scheme; rifle_ar T1 is free).
  {
    id: "rifle_burst",
    name: "Reaver BR",
    category: "assault",
    unlockLevel: 11,
    unlockCost: 800,
    description: "Burst-fire assault rifle. Three rounds per trigger pull — deadly at mid range.",
    // 28 dmg @ 9 rps burst (3-round burst). hsMult 1.5. Each burst = 84 dmg if all 3 hit.
    stats: { damage: 28, fireRate: 9, magSize: 30, reloadTime: 2.3, spread: 0.008, adsSpread: 0.002, recoil: 0.8, range: 75, adsTime: 0.28, moveSpeed: 0.92, auto: false, burst: 3, headshotMult: 1.5 },
  },
  // Third assault rifle — heavy hitter, higher level
  // Tier 3 assault — 1200 CR (Task 18-c+d economy tier scheme).
  {
    id: "rifle_heavy",
    name: "Behemoth AR",
    category: "assault",
    unlockLevel: 22,
    unlockCost: 1200,
    description: "Heavy battle rifle. High damage per shot, slower fire rate, punishing recoil.",
    // 48 dmg @ 6 rps, hsMult 1.6 → 2 chest / 2 head to kill. High recoil.
    stats: { damage: 48, fireRate: 6, magSize: 20, reloadTime: 2.8, spread: 0.01, adsSpread: 0.003, recoil: 1.4, range: 85, adsTime: 0.32, moveSpeed: 0.85, auto: false, headshotMult: 1.6 },
  },
  // Third SMG — budget option, early unlock
  // Tier 1 SMG — 500 CR (Task 18-c+d economy tier scheme).
  {
    id: "smg_compact",
    name: "Wasp PDW",
    category: "smg",
    unlockLevel: 3,
    unlockCost: 500,
    description: "Ultra-compact budget SMG. Fast handling, low damage — a starter run-and-gun.",
    // 20 dmg @ 12 rps, hsMult 1.3 → 5 chest / 4 head to kill. Cheap + early.
    stats: { damage: 20, fireRate: 12, magSize: 24, reloadTime: 1.7, spread: 0.018, adsSpread: 0.005, recoil: 0.65, range: 38, adsTime: 0.16, moveSpeed: 1.08, auto: true, headshotMult: 1.3 },
  },
  // Third shotgun — automatic combat shotgun, mid level
  // Tier 2 shotgun — 800 CR (Task 18-c+d economy tier scheme).
  {
    id: "shotgun_combat",
    name: "Mauler CS",
    category: "shotgun",
    unlockLevel: 14,
    unlockCost: 800,
    description: "Semi-auto combat shotgun. Faster fire rate than the Breacher, tighter spread.",
    // 14 dmg * 8 pellets = 112 per shell, hsMult 1.3. Semi-auto at 2 rps.
    stats: { damage: 14, fireRate: 2, magSize: 8, reloadTime: 2.8, spread: 0.06, adsSpread: 0.04, recoil: 1.3, range: 26, adsTime: 0.25, moveSpeed: 0.93, auto: false, pellets: 8, headshotMult: 1.3 },
    attachments: ["sight", "barrel", "magazine"],
  },
  // Third DMR — heavy hitting, higher level
  // Tier 3 DMR — 1200 CR (Task 18-c+d economy tier scheme).
  {
    id: "dmr_heavy",
    name: "Executioner DMR",
    category: "dmr",
    unlockLevel: 25,
    unlockCost: 1200,
    description: "Heavy DMR. Near-sniper damage with semi-auto fire rate. Devastating at range.",
    // 85 dmg @ 3 rps, hsMult 1.8 → 2 chest / 1 head to kill. High recoil per shot.
    stats: { damage: 85, fireRate: 3, magSize: 15, reloadTime: 2.8, spread: 0.004, adsSpread: 0.001, recoil: 1.6, range: 130, adsTime: 0.4, moveSpeed: 0.82, auto: false, headshotMult: 1.8 },
  },
  // Second LMG — lighter, faster, earlier unlock
  // Tier 1 LMG — 500 CR (Task 18-c+d economy tier scheme).
  {
    id: "lmg_light",
    name: "Vanguard LSW",
    category: "lmg",
    unlockLevel: 10,
    unlockCost: 500,
    description: "Light support weapon. Faster than the Hailstorm, smaller belt, better mobility.",
    // 28 dmg @ 11 rps, hsMult 1.4 → 4 chest / 3 head to kill. Better moveSpeed than Hailstorm.
    stats: { damage: 28, fireRate: 11, magSize: 50, reloadTime: 3.2, spread: 0.015, adsSpread: 0.004, recoil: 0.85, range: 80, adsTime: 0.35, moveSpeed: 0.82, auto: true, headshotMult: 1.4 },
  },
  // ---- Task 18-c+d: 3rd Sniper + 3rd LMG (Tier 3 in each category, 1200 CR) ----
  // Tier 3 sniper — Annihilator. Heavy anti-material sniper: devastating one-shot body kills
  // but glacial fire rate + massive recoil. Unlocks at L16.
  {
    id: "sniper_heavy",
    name: "Annihilator",
    category: "sniper",
    unlockLevel: 28,
    unlockCost: 1200,
    description: "Heavy anti-material sniper. Devastating one-shot body kills, but glacial fire rate and massive recoil.",
    // 170 dmg, hsMult 2.0 → body = 170 (1-shot kill 100HP), head = 340 (overkill). Very slow.
    stats: { damage: 170, fireRate: 0.6, magSize: 4, reloadTime: 3.8, spread: 0.001, adsSpread: 0.0, recoil: 3.2, range: 250, adsTime: 0.75, moveSpeed: 0.65, auto: false, headshotMult: 2.0 },
    attachments: ["sight", "barrel", "magazine"],
    baseSightType: "sniper_scope",
  },
  // Tier 3 LMG — Leviathan. 100-round belt, devastating suppressive fire, sluggish handling.
  // Unlocks at L17.
  {
    id: "lmg_heavy",
    name: "Leviathan",
    category: "lmg",
    unlockLevel: 27,
    unlockCost: 1200,
    description: "Heavy machine gun. 100-round belt, devastating suppressive fire, but sluggish handling.",
    // 34 dmg @ 8 rps, hsMult 1.4 → 3 chest / 2 head to kill. Slow fire rate for LMG, huge mag.
    stats: { damage: 34, fireRate: 8, magSize: 100, reloadTime: 5.0, spread: 0.02, adsSpread: 0.006, recoil: 1.2, range: 95, adsTime: 0.5, moveSpeed: 0.68, auto: true, headshotMult: 1.4 },
  },
];

export type AttachmentSlot = "sight" | "barrel" | "grip" | "magazine";

// All 4 attachment slots, in canonical display order.
export const ALL_ATTACHMENT_SLOTS: AttachmentSlot[] = ["sight", "barrel", "grip", "magazine"];

// Per-weapon attachment compatibility map. If a weapon isn't in this map, all
// attachments for that slot are allowed. If a weapon IS in the map for a slot,
// only the listed attachment IDs are compatible with that weapon.
export const WEAPON_ATTACHMENT_COMPAT: Record<string, Partial<Record<AttachmentSlot, string[]>>> = {
  crossbow_reclaimer: {
    sight: ["sight_acog", "sight_hunter", "sight_thermal"],
    barrel: ["barrel_poison", "barrel_bolt_fletching", "barrel_bolt_piercing"],
  },
  rifle_electron: {
    sight: ["sight_red_dot", "sight_holo", "sight_acog"],
    grip: ["grip_vertical", "grip_precision", "grip_runner_ads"],
  },
  pistol_arc: {
    sight: ["sight_red_dot", "sight_laser", "sight_holo"],
    magazine: ["mag_extended", "mag_quickdraw", "mag_balanced"],
  },
  sniper_lr: {
    sight: ["sight_hunter", "sight_thermal", "sight_acog", "sight_nvg"],
    barrel: ["barrel_suppressor", "barrel_heavy", "barrel_match"],
    magazine: ["mag_extended", "mag_quickdraw", "mag_balanced"],
  },
  sniper_scout: {
    sight: ["sight_hunter", "sight_thermal", "sight_acog", "sight_nvg"],
    barrel: ["barrel_suppressor", "barrel_heavy", "barrel_match"],
    magazine: ["mag_extended", "mag_quickdraw", "mag_balanced"],
  },
  // Task 18-c+d: 3rd sniper — same attachment restrictions as sniper_lr / sniper_scout.
  sniper_heavy: {
    sight: ["sight_hunter", "sight_thermal", "sight_acog", "sight_nvg"],
    barrel: ["barrel_suppressor", "barrel_heavy", "barrel_match"],
    magazine: ["mag_extended", "mag_quickdraw", "mag_balanced"],
  },
  // knife_tactical has attachments: [] so no slots are available — no entries needed.
  // lmg_heavy (Task 18-c+d) intentionally NOT listed here: it uses the default
  // attachment filtering (all attachments allowed for its category — same as
  // lmg_hv and lmg_light, which also don't have a compat entry).
};

// Curated, balanced 2–4 attachment choices for each supported category/slot.
// Weapon-specific overrides above win (special mechanics, sniper restrictions).
// No generic "all attachments" fallback: the Armory and server must agree on
// which attachments are valid for a particular weapon.
export const CATEGORY_ATTACHMENT_CHOICES: Partial<Record<WeaponCategory, Partial<Record<AttachmentSlot, string[]>>>> = {
  assault: {
    sight: ["sight_red_dot", "sight_holo", "sight_acog", "sight_thermal"],
    barrel: ["barrel_suppressor", "barrel_compensator", "barrel_muzzle_brake", "barrel_heavy"],
    grip: ["grip_vertical", "grip_angled", "grip_runner_ads", "grip_precision"],
    magazine: ["mag_extended", "mag_quickdraw", "mag_drum", "mag_balanced"],
  },
  smg: {
    sight: ["sight_red_dot", "sight_holo", "sight_laser", "sight_nvg"],
    barrel: ["barrel_suppressor", "barrel_compensator", "barrel_ported", "barrel_lightweight"],
    grip: ["grip_vertical", "grip_angled", "grip_laser", "grip_runner_ads"],
    magazine: ["mag_extended", "mag_quickdraw", "mag_drum", "mag_balanced"],
  },
  shotgun: {
    sight: ["sight_laser", "sight_red_dot", "sight_holo"],
    barrel: ["barrel_choke", "barrel_ported", "barrel_lightweight"],
    grip: ["grip_angled", "grip_laser", "grip_runner_ads"],
    magazine: ["mag_extended", "mag_quickdraw", "mag_shell_carrier"],
  },
  dmr: {
    sight: ["sight_acog", "sight_hunter", "sight_thermal", "sight_nvg"],
    barrel: ["barrel_suppressor", "barrel_heavy", "barrel_match"],
    grip: ["grip_precision", "grip_stability", "grip_runner_ads"],
    magazine: ["mag_extended", "mag_quickdraw", "mag_balanced"],
  },
  sniper: {
    sight: ["sight_acog", "sight_hunter", "sight_thermal", "sight_nvg"],
    barrel: ["barrel_suppressor", "barrel_heavy", "barrel_match"],
    magazine: ["mag_extended", "mag_quickdraw", "mag_balanced"],
  },
  lmg: {
    sight: ["sight_red_dot", "sight_holo", "sight_acog", "sight_thermal"],
    barrel: ["barrel_compensator", "barrel_muzzle_brake", "barrel_heavy", "barrel_ported"],
    grip: ["grip_vertical", "grip_stability", "grip_precision"],
    magazine: ["mag_extended", "mag_drum", "mag_balanced"],
  },
  sidearm: {
    sight: ["sight_red_dot", "sight_laser", "sight_holo"],
    barrel: ["barrel_suppressor", "barrel_ported", "barrel_lightweight"],
    grip: ["grip_laser", "grip_precision", "grip_runner_ads"],
    magazine: ["mag_extended", "mag_quickdraw", "mag_balanced"],
  },
};

export function compatibleAttachments(weaponId: string, slot: AttachmentSlot): string[] {
  const weapon = weaponById(weaponId);
  if (!weaponAttachmentSlots(weapon).includes(slot)) return [];
  const allowed = WEAPON_ATTACHMENT_COMPAT[weaponId]?.[slot] ??
    CATEGORY_ATTACHMENT_CHOICES[weapon.category]?.[slot] ?? [];
  return allowed.filter(id => ATTACHMENTS.some(a => a.id === id && a.slot === slot));
}

// Helper: list the attachment slots a weapon supports. Defaults to all 4.
export function weaponAttachmentSlots(weapon: WeaponDef): AttachmentSlot[] {
  return weapon.attachments ?? ALL_ATTACHMENT_SLOTS;
}

// ---- Sight system -----------------------------------------------------------
// Sight attachments reference a SightType, which carries the optic's zoom level,
// reticle style, and any ADS visual overlay (thermal/NVG tint, laser beam, etc.).
// "iron" is the default sight used when no sight attachment is equipped.
export type SightType =
  | "iron"
  | "red_dot"
  | "holo"
  | "acog"
  | "hunter"
  | "thermal"
  | "nvg"
  | "laser"
  | "sniper_scope";

export interface SightDef {
  type: SightType;
  name: string;
  zoom: number;          // 1.0 = no magnification, 4.0 = 4x scope
  reticle: "iron" | "dot" | "holo" | "chevron" | "mildot" | "thermal" | "nvg" | "laser";
  // FOV reduction (degrees) when fully ADS — replaces the engine's old hardcoded 25°
  adsFovReduction: number;
  // Visual overlay rendered on the HUD when ADS with this sight
  overlay?: "thermal" | "nvg" | "laser";
  // Sensitivity multiplier applied while ADS (lower = steadier high-zoom scopes)
  adsSensMul: number;
  description: string;
}

export const SIGHT_DEFS: Record<SightType, SightDef> = {
  iron:    { type: "iron",    name: "Iron Sight",     zoom: 1.0, reticle: "iron",    adsFovReduction: 22, adsSensMul: 0.80, description: "Standard iron sight. No magnification. Quick to aim." },
  red_dot: { type: "red_dot", name: "Red Dot",        zoom: 1.0, reticle: "dot",    adsFovReduction: 24, adsSensMul: 0.78, description: "1x red dot. Clean reticle, fast target acquisition." },
  holo:    { type: "holo",    name: "Holographic",    zoom: 1.0, reticle: "holo",   adsFovReduction: 24, adsSensMul: 0.80, description: "1x holographic. Wide FOV reticle for tracking." },
  acog:    { type: "acog",    name: "ACOG 4x",        zoom: 4.0, reticle: "chevron", adsFovReduction: 50, adsSensMul: 0.45, description: "4x magnification. Mid-range precision, slower ADS." },
  hunter:  { type: "hunter",  name: "Hunter 6x",      zoom: 6.0, reticle: "mildot", adsFovReduction: 60, adsSensMul: 0.32, description: "6x magnification. Sniper-grade optic, very slow ADS." },
  thermal: { type: "thermal", name: "Thermal 2x",     zoom: 2.0, reticle: "thermal", adsFovReduction: 38, adsSensMul: 0.55, description: "2x thermal. Highlights heat signatures through cover fog.", overlay: "thermal" },
  nvg:     { type: "nvg",     name: "NVG Scope",      zoom: 1.5, reticle: "nvg",    adsFovReduction: 32, adsSensMul: 0.65, description: "Night vision scope. Brightens dark scenes with green tint.", overlay: "nvg" },
  laser:   { type: "laser",   name: "Laser Sight",    zoom: 1.0, reticle: "laser",  adsFovReduction: 22, adsSensMul: 0.85, description: "Iron sight + visible laser indicator. Tightens hipfire.", overlay: "laser" },
  sniper_scope: { type: "sniper_scope", name: "Sniper Scope", zoom: 6.0, reticle: "mildot", adsFovReduction: 58, adsSensMul: 0.30, description: "Base 6x sniper scope. Standard on all bolt-action rifles. Long-range precision." },
};

export const SIGHT_LIST: SightDef[] = Object.values(SIGHT_DEFS);

export function sightDefForType(type: SightType): SightDef {
  return SIGHT_DEFS[type] ?? SIGHT_DEFS.iron;
}

// Resolve the effective sight for a loadout: returns the SightDef for the equipped
// sight attachment, or the weapon's baseSightType (default "iron") if no sight is
// equipped. Snipers set baseSightType="sniper_scope" so they get a 6x scope out
// of the box instead of iron sight.
export function sightDefForAttachments(atts: Partial<Record<AttachmentSlot, string | null>>, baseSightType?: SightType): SightDef {
  const sightId = atts.sight;
  if (!sightId) return SIGHT_DEFS[baseSightType ?? "iron"];
  const def = ATTACHMENTS.find((a) => a.id === sightId);
  if (def?.sightType) return SIGHT_DEFS[def.sightType];
  return SIGHT_DEFS[baseSightType ?? "iron"];
}

export interface AttachmentDef {
  id: string;
  name: string;
  slot: AttachmentSlot;
  unlockLevel: number;
  unlockCost: number;
  description: string;
  // For sight attachments: which SightType this attachment installs. Non-sight
  // attachments leave this undefined.
  sightType?: SightType;
  // Weapon categories this attachment is compatible with. USED FOR FILTERING:
  // the customizer only shows attachments whose `weaponCategories` includes the
  // current weapon's category. Leave undefined to mean "all weapons". This is
  // the canonical filter field — `compatibleAttachments()` reads it directly.
  // Examples: suppressors don't fit launchers; scopes don't fit shotguns.
  weaponCategories?: WeaponCategory[];
  exclusiveWeaponIds?: string[];
  // Legacy alias for `weaponCategories` (kept for backward-compat with any
  // catalog entries that still use the old name). When both are set, they
  // should be the same list — `weaponCategories` is canonical.
  recommendedFor?: WeaponCategory[];
  effects: {
    damage?: number;       // additive percent e.g. 10 => +10%
    recoil?: number;       // additive percent (negative reduces)
    spread?: number;       // additive percent — affects HIPFIRE spread
    adsSpread?: number;    // additive percent — affects ADS spread (defaults to spread if unset)
    adsTime?: number;      // additive percent
    magSize?: number;      // additive rounds
    reloadTime?: number;   // additive percent
    moveSpeed?: number;    // additive percent
    range?: number;        // additive percent
  };
}

export const ATTACHMENTS: AttachmentDef[] = [
  {
    id: "barrel_poison", name: "Venom Bolt Tips", slot: "barrel",
    unlockLevel: 9, unlockCost: 550,
    description: "Crossbow bolts apply 4 damage per second for 4 seconds. Repeated hits refresh duration.",
    exclusiveWeaponIds: ["crossbow_reclaimer"], weaponCategories: ["dmr"],
    effects: {},
  },
  // ---- Sights ----
  // Each sight attachment installs a SightType (see SIGHT_DEFS). The optic itself
  // controls zoom/reticle/overlay; attachment.effects are stat bonuses layered on top.
  {
    id: "sight_red_dot", name: "Red Dot Sight", slot: "sight", sightType: "red_dot",
    unlockLevel: 2, unlockCost: 200,
    description: "1x red dot. Clean reticle, tighter ADS spread.",
    recommendedFor: ["assault", "smg", "lmg", "sidearm"],
    weaponCategories: ["assault", "smg", "lmg", "sidearm"],
    effects: { adsSpread: -12, adsTime: -5 },
  },
  {
    id: "sight_holo", name: "Holographic Sight", slot: "sight", sightType: "holo",
    unlockLevel: 6, unlockCost: 250,
    description: "1x holo. Wide FOV reticle for tracking fast targets.",
    recommendedFor: ["assault", "smg", "lmg"],
    weaponCategories: ["assault", "smg", "lmg"],
    effects: { adsTime: -10, adsSpread: -8 },
  },
  {
    id: "sight_laser", name: "Laser Sight", slot: "sight", sightType: "laser",
    unlockLevel: 5, unlockCost: 250,
    description: "Iron sight + visible laser indicator. Dramatically tightens hipfire.",
    recommendedFor: ["smg", "shotgun", "sidearm"],
    weaponCategories: ["smg", "shotgun", "sidearm"],
    // Hipfire-only buff — laser doesn't help when ADS (you're already aiming precisely)
    effects: { spread: -30 },
  },
  {
    id: "sight_acog", name: "ACOG 4x Scope", slot: "sight", sightType: "acog",
    unlockLevel: 10, unlockCost: 300,
    description: "4x magnification. Extends effective range, tighter ADS at distance.",
    recommendedFor: ["assault", "dmr", "lmg"],
    weaponCategories: ["assault", "dmr", "lmg"],
    effects: { range: 20, adsTime: 15, adsSpread: -15 },
  },
  {
    id: "sight_thermal", name: "Thermal 2x Scope", slot: "sight", sightType: "thermal",
    unlockLevel: 12, unlockCost: 300,
    description: "2x thermal. Highlights heat signatures through fog/darkness.",
    recommendedFor: ["dmr", "sniper", "assault"],
    weaponCategories: ["dmr", "sniper", "assault"],
    effects: { range: 15, adsSpread: -10, adsTime: 10 },
  },
  {
    id: "sight_nvg", name: "NVG Scope", slot: "sight", sightType: "nvg",
    unlockLevel: 14, unlockCost: 300,
    description: "1.5x night vision. Brightens dark scenes with green tint.",
    recommendedFor: ["assault", "smg", "dmr", "sniper"],
    weaponCategories: ["assault", "smg", "dmr", "sniper"],
    effects: { adsSpread: -8, adsTime: 5 },
  },
  {
    id: "sight_hunter", name: "Hunter 6x Scope", slot: "sight", sightType: "hunter",
    unlockLevel: 16, unlockCost: 300,
    description: "6x magnification. Sniper-grade optic, very slow ADS, extreme range.",
    recommendedFor: ["sniper", "dmr"],
    weaponCategories: ["sniper", "dmr"],
    effects: { range: 30, adsTime: 20, adsSpread: -20 },
  },
  // ---- Barrel ----
  // Suppressors trade damage for stealth + a touch of recoil control.
  {
    id: "barrel_suppressor", name: "Suppressor", slot: "barrel",
    unlockLevel: 4, unlockCost: 250,
    description: "Silences fire and hides muzzle flash. Slight damage drop, tighter hipfire.",
    recommendedFor: ["assault", "smg", "dmr", "sidearm"],
    weaponCategories: ["assault", "smg", "dmr", "sidearm"],
    effects: { damage: -5, recoil: -10, spread: -8 },
  },
  // Compensators reduce vertical recoil strongly (good for high-recoil autos).
  {
    id: "barrel_compensator", name: "Compensator", slot: "barrel",
    unlockLevel: 7, unlockCost: 200,
    description: "Redirects gas. Strong vertical recoil reduction.",
    recommendedFor: ["assault", "lmg", "smg"],
    weaponCategories: ["assault", "lmg", "smg"],
    effects: { recoil: -22 },
  },
  // Muzzle brake: similar to compensator but also slightly tightens hipfire.
  {
    id: "barrel_muzzle_brake", name: "Muzzle Brake", slot: "barrel",
    unlockLevel: 8, unlockCost: 250,
    description: "Redirects muzzle climb. Strong recoil control + tighter hipfire.",
    recommendedFor: ["assault", "lmg"],
    weaponCategories: ["assault", "lmg"],
    effects: { recoil: -18, spread: -5 },
  },
  // Heavy barrel: more damage + range at the cost of MORE recoil (snipers/marksman).
  {
    id: "barrel_heavy", name: "Heavy Barrel", slot: "barrel",
    unlockLevel: 11, unlockCost: 300,
    description: "Stiffer barrel. More damage + range, but MORE recoil kick.",
    recommendedFor: ["dmr", "sniper", "assault"],
    weaponCategories: ["dmr", "sniper", "assault"],
    effects: { damage: 12, recoil: 15, range: 10, adsSpread: -8 },
  },
  // ---- Grip ----
  // Vertical grip: pure vertical recoil control (autos).
  {
    id: "grip_vertical", name: "Vertical Grip", slot: "grip",
    unlockLevel: 3, unlockCost: 200,
    description: "Controls vertical climb. Best on high-recoil autos.",
    recommendedFor: ["assault", "lmg", "smg"],
    weaponCategories: ["assault", "lmg", "smg"],
    effects: { recoil: -15 },
  },
  // Angled grip: faster ADS, slight hipfire buff (close-quarters).
  {
    id: "grip_angled", name: "Angled Grip", slot: "grip",
    unlockLevel: 9, unlockCost: 250,
    description: "Faster aim-down-sights. Slight hipfire recovery.",
    recommendedFor: ["smg", "assault", "shotgun"],
    weaponCategories: ["smg", "assault", "shotgun"],
    effects: { adsTime: -20, spread: -4 },
  },
  // Laser grip: hipfire-only buff (laser pointer steadies the off-hand).
  {
    id: "grip_laser", name: "Laser Grip", slot: "grip",
    unlockLevel: 13, unlockCost: 300,
    description: "Laser pointer grip. Tightens hipfire dramatically (no ADS effect).",
    recommendedFor: ["smg", "shotgun", "sidearm"],
    weaponCategories: ["smg", "shotgun", "sidearm"],
    effects: { spread: -28 },
  },
  {
    id: "grip_runner_ads", name: "Run-and-Gun Grip", slot: "grip",
    unlockLevel: 16, unlockCost: 400,
    description: "Allows aiming down sights while sprinting. Sprint speed is reduced during ADS.",
    weaponCategories: ["assault", "smg", "shotgun", "dmr", "sidearm"],
    effects: { adsTime: 12, recoil: 6 },
  },
  // ---- Magazine ----
  {
    id: "mag_extended", name: "Extended Mag", slot: "magazine",
    unlockLevel: 5, unlockCost: 200,
    description: "+50% magazine capacity.",
    recommendedFor: ["assault", "smg", "lmg", "shotgun"],
    weaponCategories: ["assault", "smg", "lmg", "shotgun"],
    effects: { magSize: 50 },
  },
  {
    id: "mag_quickdraw", name: "Quickdraw Mag", slot: "magazine",
    unlockLevel: 8, unlockCost: 250,
    description: "Faster reloads.",
    recommendedFor: ["assault", "smg", "shotgun", "dmr"],
    weaponCategories: ["assault", "smg", "shotgun", "dmr"],
    effects: { reloadTime: -25 },
  },
  {
    id: "mag_drum", name: "Drum Mag", slot: "magazine",
    unlockLevel: 14, unlockCost: 300,
    description: "Massive capacity, slower handling + reload.",
    recommendedFor: ["assault", "lmg", "smg"],
    weaponCategories: ["assault", "lmg", "smg"],
    effects: { magSize: 100, moveSpeed: -8, reloadTime: 15 },
  },
  // ---- Additional v14 choices: each supported slot has 2–4 options. ----
  { id: "barrel_match", name: "Match Barrel", slot: "barrel", unlockLevel: 12, unlockCost: 380,
    description: "Precision rifling tightens aimed spread and adds range at the cost of slower ADS.",
    weaponCategories: ["dmr", "sniper"], effects: { adsSpread: -18, range: 12, adsTime: 10 } },
  { id: "barrel_ported", name: "Ported Barrel", slot: "barrel", unlockLevel: 8, unlockCost: 300,
    description: "Faster recovery and lower recoil, with a small range penalty.",
    weaponCategories: ["smg", "shotgun", "lmg", "sidearm"], effects: { recoil: -14, range: -7 } },
  { id: "barrel_lightweight", name: "Lightweight Barrel", slot: "barrel", unlockLevel: 11, unlockCost: 330,
    description: "Better handling and mobility, reduced damage at distance.",
    weaponCategories: ["smg", "shotgun", "sidearm"], effects: { moveSpeed: 6, adsTime: -12, range: -12 } },
  { id: "barrel_choke", name: "Tight Choke", slot: "barrel", unlockLevel: 9, unlockCost: 300,
    description: "Concentrates shotgun pellets for tighter hip-fire and aimed spread.",
    weaponCategories: ["shotgun"], effects: { spread: -18, adsSpread: -16 } },
  { id: "barrel_bolt_fletching", name: "Stabilized Fletching", slot: "barrel", unlockLevel: 10, unlockCost: 300,
    description: "Improves crossbow bolt accuracy and effective range.",
    exclusiveWeaponIds: ["crossbow_reclaimer"], weaponCategories: ["dmr"], effects: { spread: -16, adsSpread: -14, range: 14 } },
  { id: "barrel_bolt_piercing", name: "Piercing Bolt Head", slot: "barrel", unlockLevel: 15, unlockCost: 420,
    description: "Heavier bolt head deals more direct damage but is slower to reload.",
    exclusiveWeaponIds: ["crossbow_reclaimer"], weaponCategories: ["dmr"], effects: { damage: 10, reloadTime: 12 } },
  { id: "grip_precision", name: "Precision Grip", slot: "grip", unlockLevel: 10, unlockCost: 320,
    description: "Steadier aim and lower recoil, at the cost of a slightly slower ADS transition.",
    effects: { recoil: -12, adsSpread: -10, adsTime: 7 } },
  { id: "grip_stability", name: "Stability Grip", slot: "grip", unlockLevel: 12, unlockCost: 340,
    description: "Helps keep sustained long-range fire controlled, at a slight mobility cost.",
    effects: { recoil: -20, moveSpeed: -4 } },
  { id: "mag_balanced", name: "Balanced Magazine", slot: "magazine", unlockLevel: 10, unlockCost: 310,
    description: "A few additional rounds and quicker reloads without the bulk of a drum.",
    effects: { magSize: 20, reloadTime: -12 } },
  { id: "mag_shell_carrier", name: "Shell Carrier", slot: "magazine", unlockLevel: 12, unlockCost: 325,
    description: "Carries a few additional shotgun shells and improves reload handling.",
    weaponCategories: ["shotgun"], effects: { magSize: 25, reloadTime: -14 } },
];

export interface WeaponSkinDef {
  id: string;
  name: string;
  unlockLevel: number;
  unlockCost: number;
  rarity: "common" | "rare" | "epic" | "legendary";
  // Skin tier controls how the skin unlocks:
  //  - "standard"  : basic color variants (default, arctic, desert, etc.) — available
  //                  on ALL weapons. One unlock (SkinUnlock with weaponId="*") applies globally.
  //  - "rare"      : per-weapon challenge-earned skin (future).
  //  - "legendary" : per-weapon special-event skin (future).
  // Currently every skin is "standard" — non-standard tiers will be added later.
  tier: "standard" | "rare" | "legendary";
  // Visual properties for the engine
  color: string;        // base hex
  metalness: number;    // 0..1
  roughness: number;    // 0..1
  emissive?: string;    // glow color
  emissiveIntensity?: number;
  /** Awarded free to a weapon after completing every standard skin challenge. */
  prestige?: "cosmic" | "toxic";
}

// Wildcard weaponId used in SkinUnlock rows for standard-tier skins. A skin
// unlocked with weaponId="*" is available on every weapon (one unlock grants
// it globally). Non-standard skins use the specific weaponId they were
// unlocked for.
export const SKIN_WILDCARD_WEAPON_ID = "*";

// Helper: is this skin tier globally unlocked by a single SkinUnlock row?
export function isStandardSkin(skin: WeaponSkinDef): boolean {
  return skin.tier === "standard";
}

export const WEAPON_SKINS: WeaponSkinDef[] = [
  // Task 18-c+d: skin costs boosted proportional to unlock difficulty (challenge goal scaling).
  { id: "default", name: "Standard", unlockLevel: 1, unlockCost: 0, rarity: "common", tier: "standard", color: "#2b2f36", metalness: 0.6, roughness: 0.45 },
  { id: "arctic", name: "Arctic", unlockLevel: 2, unlockCost: 500, rarity: "common", tier: "standard", color: "#dfe7ee", metalness: 0.4, roughness: 0.5 },
  { id: "crimson", name: "Crimson Edge", unlockLevel: 4, unlockCost: 1000, rarity: "rare", tier: "standard", color: "#7f1d1d", metalness: 0.7, roughness: 0.35 },
  { id: "emerald", name: "Emerald", unlockLevel: 7, unlockCost: 1500, rarity: "rare", tier: "standard", color: "#065f46", metalness: 0.7, roughness: 0.3 },
  { id: "carbon", name: "Carbon Fiber", unlockLevel: 10, unlockCost: 2000, rarity: "epic", tier: "standard", color: "#111418", metalness: 0.3, roughness: 0.6 },
  { id: "neon", name: "Neon Pulse", unlockLevel: 12, unlockCost: 3000, rarity: "epic", tier: "standard", color: "#0a0a0a", metalness: 0.5, roughness: 0.2, emissive: "#22d3ee", emissiveIntensity: 0.7 },
  { id: "inferno", name: "Inferno", unlockLevel: 14, unlockCost: 4000, rarity: "legendary", tier: "standard", color: "#1c0a02", metalness: 0.6, roughness: 0.25, emissive: "#f97316", emissiveIntensity: 0.6 },
  { id: "gold", name: "Gold Standard", unlockLevel: 16, unlockCost: 6000, rarity: "legendary", tier: "standard", color: "#d4af37", metalness: 0.95, roughness: 0.18 },
  { id: "prestige_cosmic", name: "Eventide", unlockLevel: 1, unlockCost: 0, rarity: "legendary", tier: "legendary", color: "#080d2b", metalness: 0.65, roughness: 0.13, emissive: "#a78bfa", emissiveIntensity: 1.1, prestige: "cosmic" },
  { id: "prestige_toxic", name: "Viridian Blight", unlockLevel: 1, unlockCost: 0, rarity: "legendary", tier: "legendary", color: "#143c1c", metalness: 0.25, roughness: 0.16, emissive: "#a3e635", emissiveIntensity: 1.2, prestige: "toxic" },
];

export interface PlayerSkinDef {
  id: string;
  name: string;
  unlockLevel: number;
  unlockCost: number;
  rarity: "common" | "rare" | "epic" | "legendary";
  color: string;
  accent: string;
  emissive?: string;
}

export const PLAYER_SKINS: PlayerSkinDef[] = [
  // Task 18-c+d: operator skin costs boosted to match weapon skin cost curve.
  { id: "default", name: "Operative", unlockLevel: 1, unlockCost: 0, rarity: "common", color: "#4b5563", accent: "#9ca3af" },
  { id: "red", name: "Crimson Recon", unlockLevel: 2, unlockCost: 400, rarity: "common", color: "#b91c1c", accent: "#fca5a5" },
  { id: "blue", name: "Azure Sentinel", unlockLevel: 3, unlockCost: 600, rarity: "common", color: "#1d4ed8", accent: "#93c5fd" },
  { id: "green", name: "Jungle Ghost", unlockLevel: 5, unlockCost: 1000, rarity: "rare", color: "#15803d", accent: "#86efac" },
  { id: "orange", name: "Ember Unit", unlockLevel: 7, unlockCost: 1500, rarity: "rare", color: "#c2410c", accent: "#fdba74" },
  { id: "purple", name: "Violet Spectre", unlockLevel: 9, unlockCost: 2000, rarity: "rare", color: "#6d28d9", accent: "#c4b5fd" },
  { id: "phantom", name: "Phantom", unlockLevel: 13, unlockCost: 3000, rarity: "epic", color: "#0a0a0a", accent: "#22d3ee", emissive: "#22d3ee" },
  { id: "crimson_lord", name: "Crimson Lord", unlockLevel: 16, unlockCost: 5000, rarity: "legendary", color: "#3f0a0a", accent: "#ef4444", emissive: "#ef4444" },
];

// ============================================================================
// WEAPON CHALLENGES — per-weapon skin unlocks.
// Skins are no longer unlocked by player level alone; they're earned by hitting
// gameplay milestones with a specific weapon. Each challenge maps a (weaponId,
// metric, goal) to a skinId reward. The Armory shows live progress and the
// match-completion flow auto-grants the skin when a challenge is cleared.
// ============================================================================
// Persistent per-elimination conditions shared by gameplay and progression.
export type WeaponConditionMetric =
  | "bare_kills" | "fully_equipped_kills" | "ads_kills"
  | "hipfire_kills" | "airborne_kills" | "close_range_kills"
  | "long_range_kills" | "multikill_kills"
  | "suppressed_kills" | "critical_health_kills" | "comeback_kills";
export type WeaponChallengeMetric = "kills" | "headshots" | WeaponConditionMetric;

export interface WeaponChallengeDef {
  id: string;
  weaponId: string;
  skinId: string;
  goal: number;
  metric: WeaponChallengeMetric;
  // Optional AND-based mastery steps. All steps must be completed.
  requirements?: { metric: WeaponChallengeMetric; goal: number }[];
  title: string;
  description: string;
}

export const WEAPON_CHALLENGES: WeaponChallengeDef[] = [
  // ---- rifle_ar (VK-12 Assault) ----
  { id: "wc_ar_kills_50",     weaponId: "rifle_ar",   skinId: "crimson",  goal: 50,  metric: "kills",     title: "Bloodied Rifle",        description: "Get 50 kills with the VK-12 Assault" },
  { id: "wc_ar_hs_75",        weaponId: "rifle_ar",   skinId: "neon",     goal: 75,  metric: "headshots", title: "Precision Operator",    description: "Land 75 headshots with the VK-12 Assault" },
  { id: "wc_ar_kills_250",    weaponId: "rifle_ar",   skinId: "inferno",  goal: 250, metric: "kills",     title: "Assault Master",        description: "Get 250 kills with the VK-12 Assault" },

  // ---- smg_kp (Kestrel SMG) ----
  { id: "wc_smg_kills_50",    weaponId: "smg_kp",     skinId: "arctic",   goal: 50,  metric: "kills",     title: "Kestrel Striker",       description: "Get 50 kills with the Kestrel SMG" },
  { id: "wc_smg_hs_60",       weaponId: "smg_kp",     skinId: "carbon",   goal: 60,  metric: "headshots", title: "Snap Shot",             description: "Land 60 headshots with the Kestrel SMG" },
  { id: "wc_smg_kills_200",   weaponId: "smg_kp",     skinId: "neon",     goal: 200, metric: "kills",     title: "SMG Master",            description: "Get 200 kills with the Kestrel SMG" },

  // ---- shotgun_br (Breacher) ----
  { id: "wc_shotgun_kills_30",  weaponId: "shotgun_br", skinId: "crimson",  goal: 30,  metric: "kills",     title: "Close Quarters",        description: "Get 30 kills with the Breacher" },
  { id: "wc_shotgun_kills_120", weaponId: "shotgun_br", skinId: "inferno",  goal: 120, metric: "kills",     title: "Breacher Master",       description: "Get 120 kills with the Breacher" },

  // ---- rifle_dm (Marksman DMR) ----
  { id: "wc_dmr_kills_40",    weaponId: "rifle_dm",   skinId: "emerald",  goal: 40,  metric: "kills",     title: "Marksman",              description: "Get 40 kills with the Marksman DMR" },
  { id: "wc_dmr_hs_50",       weaponId: "rifle_dm",   skinId: "carbon",   goal: 50,  metric: "headshots", title: "Headhunter",            description: "Land 50 headshots with the Marksman DMR" },
  { id: "wc_dmr_kills_150",   weaponId: "rifle_dm",   skinId: "gold",     goal: 150, metric: "kills",     title: "Marksman Master",       description: "Get 150 kills with the Marksman DMR" },

  // ---- sniper_lr (Longshot) ----
  { id: "wc_sniper_hs_25",    weaponId: "sniper_lr",  skinId: "carbon",   goal: 25,  metric: "headshots", title: "Silent Death",          description: "Land 25 headshots with the Longshot" },
  { id: "wc_sniper_kills_100",weaponId: "sniper_lr",  skinId: "gold",     goal: 100, metric: "kills",     title: "Longshot Legend",       description: "Get 100 kills with the Longshot" },

  // ---- lmg_hv (Hailstorm LMG) ----
  { id: "wc_lmg_kills_75",    weaponId: "lmg_hv",     skinId: "arctic",   goal: 75,  metric: "kills",     title: "Suppressor",            description: "Get 75 kills with the Hailstorm LMG" },
  { id: "wc_lmg_kills_200",   weaponId: "lmg_hv",     skinId: "inferno",  goal: 200, metric: "kills",     title: "Hailstorm Master",      description: "Get 200 kills with the Hailstorm LMG" },

  // ---- pistol_side (Sidearm P-9) ----
  { id: "wc_pistol_kills_25", weaponId: "pistol_side",skinId: "arctic",   goal: 25,  metric: "kills",     title: "Sidearm Specialist",    description: "Get 25 kills with the Sidearm P-9" },
  { id: "wc_pistol_hs_40",    weaponId: "pistol_side",skinId: "crimson",  goal: 40,  metric: "headshots", title: "Pistol Precision",      description: "Land 40 headshots with the Sidearm P-9" },

  // ---- smg_vector (Vector PDW) ----
  { id: "wc_vector_kills_60", weaponId: "smg_vector", skinId: "neon",     goal: 60,  metric: "kills",     title: "Vector Storm",          description: "Get 60 kills with the Vector PDW" },

  // ---- shotgun_auto (Wraith Auto) ----
  { id: "wc_autoshotgun_kills_60", weaponId: "shotgun_auto", skinId: "emerald", goal: 60, metric: "kills", title: "Wraith",                description: "Get 60 kills with the Wraith Auto" },

  // ---- pistol_magnum (Magnum .50) ----
  { id: "wc_magnum_kills_30", weaponId: "pistol_magnum", skinId: "gold",   goal: 30,  metric: "kills",     title: "Hand Cannon",           description: "Get 30 kills with the Magnum .50" },
  { id: "wc_magnum_hs_20",    weaponId: "pistol_magnum", skinId: "inferno",goal: 20,  metric: "headshots", title: "Deadeye",               description: "Land 20 headshots with the Magnum .50" },

  // ---- dmr_scout (Scout Tactical) ----
  { id: "wc_scout_kills_50",  weaponId: "dmr_scout",  skinId: "emerald",  goal: 50,  metric: "kills",     title: "Scout",                 description: "Get 50 kills with the Scout Tactical" },
  { id: "wc_scout_hs_60",     weaponId: "dmr_scout",  skinId: "carbon",   goal: 60,  metric: "headshots", title: "Scout Sharpshooter",    description: "Land 60 headshots with the Scout Tactical" },

  // ---- shiv (Shiv) ----
  { id: "wc_shiv_kills_30",   weaponId: "shiv",        skinId: "arctic",   goal: 30,  metric: "kills",     title: "Quick Hands",           description: "Get 30 kills with the Shiv" },

  // ---- machete (Machete) ----
  { id: "wc_machete_kills_40",weaponId: "machete",     skinId: "emerald",  goal: 40,  metric: "kills",     title: "Jungle Striker",        description: "Get 40 kills with the Machete" },

  // ---- hammer (Sledge Hammer) ----
  { id: "wc_hammer_kills_30", weaponId: "hammer",      skinId: "inferno",  goal: 30,  metric: "kills",     title: "Smasher",               description: "Get 30 kills with the Sledge Hammer" },

  // ---- pistol_burst (Burst Pistol) ----
  { id: "wc_burst_kills_50",  weaponId: "pistol_burst",skinId: "crimson",  goal: 50,  metric: "kills",     title: "Burst Specialist",      description: "Get 50 kills with the Burst Pistol" },

  // ---- pistol_machine (Machine Pistol) ----
  { id: "wc_machine_kills_60",weaponId: "pistol_machine",skinId: "neon",   goal: 60,  metric: "kills",     title: "Mag Dump",              description: "Get 60 kills with the Machine Pistol" },

  // ---- launcher_rocket (RL-7 Rocket Launcher) ----
  { id: "wc_launcher_kills_25", weaponId: "launcher_rocket", skinId: "gold", goal: 25, metric: "kills",   title: "Demolitionist",         description: "Get 25 kills with the RL-7 Rocket Launcher" },

  // ---- New weapons ----
  // ---- sniper_scout (Scout Sniper) ----
  { id: "wc_scout_sniper_kills_30", weaponId: "sniper_scout", skinId: "emerald", goal: 30, metric: "kills", title: "Eagle Eye", description: "Get 30 kills with the Scout Sniper" },
  { id: "wc_scout_sniper_hs_40",    weaponId: "sniper_scout", skinId: "carbon",  goal: 40, metric: "headshots", title: "Scout Sniper Sharpshooter", description: "Land 40 headshots with the Scout Sniper" },

  // ---- rifle_burst (Reaver BR) ----
  { id: "wc_rifle_burst_kills_50", weaponId: "rifle_burst", skinId: "crimson", goal: 50, metric: "kills", title: "Burst Fire", description: "Get 50 kills with the Reaver BR" },
  { id: "wc_rifle_burst_kills_150", weaponId: "rifle_burst", skinId: "neon", goal: 150, metric: "kills", title: "Reaver Master", description: "Get 150 kills with the Reaver BR" },

  // ---- rifle_heavy (Behemoth AR) ----
  { id: "wc_rifle_heavy_kills_60", weaponId: "rifle_heavy", skinId: "inferno", goal: 60, metric: "kills", title: "Behemoth", description: "Get 60 kills with the Behemoth AR" },
  { id: "wc_rifle_heavy_hs_50",    weaponId: "rifle_heavy", skinId: "gold",    goal: 50, metric: "headshots", title: "Heavy Trigger", description: "Land 50 headshots with the Behemoth AR" },

  // ---- smg_compact (Wasp PDW) ----
  { id: "wc_smg_compact_kills_40", weaponId: "smg_compact", skinId: "arctic", goal: 40, metric: "kills", title: "Wasp", description: "Get 40 kills with the Wasp PDW" },
  { id: "wc_smg_compact_kills_120", weaponId: "smg_compact", skinId: "neon", goal: 120, metric: "kills", title: "Wasp Master", description: "Get 120 kills with the Wasp PDW" },

  // ---- shotgun_combat (Mauler CS) ----
  { id: "wc_shotgun_combat_kills_40", weaponId: "shotgun_combat", skinId: "crimson", goal: 40, metric: "kills", title: "Mauler", description: "Get 40 kills with the Mauler CS" },
  { id: "wc_shotgun_combat_kills_100", weaponId: "shotgun_combat", skinId: "inferno", goal: 100, metric: "kills", title: "Mauler Master", description: "Get 100 kills with the Mauler CS" },

  // ---- dmr_heavy (Executioner DMR) ----
  { id: "wc_dmr_heavy_kills_50", weaponId: "dmr_heavy", skinId: "gold", goal: 50, metric: "kills", title: "Executioner", description: "Get 50 kills with the Executioner DMR" },
  { id: "wc_dmr_heavy_hs_40",    weaponId: "dmr_heavy", skinId: "carbon", goal: 40, metric: "headshots", title: "Executioner Sharpshooter", description: "Land 40 headshots with the Executioner DMR" },

  // ---- lmg_light (Vanguard LSW) ----
  { id: "wc_lmg_light_kills_60", weaponId: "lmg_light", skinId: "arctic", goal: 60, metric: "kills", title: "Vanguard", description: "Get 60 kills with the Vanguard LSW" },
  { id: "wc_lmg_light_kills_150", weaponId: "lmg_light", skinId: "neon", goal: 150, metric: "kills", title: "Vanguard Master", description: "Get 150 kills with the Vanguard LSW" },

  // ============================================================================
  // Round 17-c: Comprehensive skin-challenge coverage.
  // Previously many (weapon, skin) pairs had NO challenge defined, so the Armory
  // showed them as "Locked" with no unlock path — players couldn't tell how to
  // get those skins. This block adds challenges so EVERY non-default skin has at
  // least one challenge on EVERY weapon. Goals scale with skin rarity
  // (common=rare=epic=legendary): arctic/crimson ~30-50, emerald ~75, carbon
  // ~60 hs, neon ~120, inferno ~200, gold ~100. Melee weapons get lower kill
  // goals since melee kills are harder to come by.
  // ============================================================================
  // ---- knife_tactical (Tactical Knife) — had ZERO challenges ----
  { id: "wc_knife_tactical_kills_20", weaponId: "knife_tactical", skinId: "arctic", goal: 20, metric: "kills", title: "First Cut", description: "Get 20 kills with the Tactical Knife" },
  { id: "wc_knife_tactical_kills_60", weaponId: "knife_tactical", skinId: "crimson", goal: 60, metric: "kills", title: "Bloodied Blade", description: "Get 60 kills with the Tactical Knife" },
  { id: "wc_knife_tactical_kills_100", weaponId: "knife_tactical", skinId: "emerald", goal: 100, metric: "kills", title: "Emerald Blade", description: "Get 100 kills with the Tactical Knife" },
  { id: "wc_knife_tactical_hs_50", weaponId: "knife_tactical", skinId: "carbon", goal: 50, metric: "headshots", title: "Carbon Blade", description: "Land 50 headshots with the Tactical Knife" },
  { id: "wc_knife_tactical_kills_160", weaponId: "knife_tactical", skinId: "neon", goal: 160, metric: "kills", title: "Neon Blade", description: "Get 160 kills with the Tactical Knife" },
  { id: "wc_knife_tactical_kills_220", weaponId: "knife_tactical", skinId: "inferno", goal: 220, metric: "kills", title: "Knife Master", description: "Get 220 kills with the Tactical Knife" },
  { id: "wc_knife_tactical_kills_300", weaponId: "knife_tactical", skinId: "gold", goal: 300, metric: "kills", title: "Knife Legend", description: "Get 300 kills with the Tactical Knife" },

  // ---- rifle_ar (VK-12 Assault) — fill missing arctic/emerald/carbon/gold ----
  { id: "wc_ar_kills_100",  weaponId: "rifle_ar", skinId: "emerald", goal: 100, metric: "kills", title: "Assault Specialist", description: "Get 100 kills with the VK-12 Assault" },
  { id: "wc_ar_kills_400",  weaponId: "rifle_ar", skinId: "gold",    goal: 400, metric: "kills", title: "Assault Legend", description: "Get 400 kills with the VK-12 Assault" },
  { id: "wc_ar_kills_25",   weaponId: "rifle_ar", skinId: "arctic",  goal: 25,  metric: "kills", title: "Frost Operator", description: "Get 25 kills with the VK-12 Assault" },
  { id: "wc_ar_hs_120",     weaponId: "rifle_ar", skinId: "carbon",  goal: 120, metric: "headshots", title: "Carbon Precision", description: "Land 120 headshots with the VK-12 Assault" },

  // ---- smg_kp (Kestrel SMG) — fill missing crimson/emerald/inferno/gold ----
  { id: "wc_smg_kills_30",  weaponId: "smg_kp", skinId: "crimson", goal: 30,  metric: "kills", title: "Crimson Kestrel", description: "Get 30 kills with the Kestrel SMG" },
  { id: "wc_smg_kills_90",  weaponId: "smg_kp", skinId: "emerald", goal: 90,  metric: "kills", title: "Emerald Kestrel", description: "Get 90 kills with the Kestrel SMG" },
  { id: "wc_smg_kills_280", weaponId: "smg_kp", skinId: "inferno", goal: 280, metric: "kills", title: "SMG Inferno", description: "Get 280 kills with the Kestrel SMG" },
  { id: "wc_smg_kills_350", weaponId: "smg_kp", skinId: "gold",    goal: 350, metric: "kills", title: "SMG Legend", description: "Get 350 kills with the Kestrel SMG" },

  // ---- shotgun_br (Breacher) — fill missing arctic/emerald/carbon/neon/gold ----
  { id: "wc_shotgun_kills_15",  weaponId: "shotgun_br", skinId: "arctic", goal: 15,  metric: "kills", title: "Frost Breacher", description: "Get 15 kills with the Breacher" },
  { id: "wc_shotgun_kills_60",  weaponId: "shotgun_br", skinId: "emerald", goal: 60,  metric: "kills", title: "Emerald Breacher", description: "Get 60 kills with the Breacher" },
  { id: "wc_shotgun_hs_40",     weaponId: "shotgun_br", skinId: "carbon",  goal: 40,  metric: "headshots", title: "Carbon Pellet", description: "Land 40 headshots with the Breacher" },
  { id: "wc_shotgun_kills_180", weaponId: "shotgun_br", skinId: "neon",    goal: 180, metric: "kills", title: "Neon Breacher", description: "Get 180 kills with the Breacher" },
  { id: "wc_shotgun_kills_250", weaponId: "shotgun_br", skinId: "gold",    goal: 250, metric: "kills", title: "Breacher Legend", description: "Get 250 kills with the Breacher" },

  // ---- rifle_dm (Marksman DMR) — fill missing arctic/crimson/neon/inferno ----
  { id: "wc_dmr_kills_20",  weaponId: "rifle_dm", skinId: "arctic",  goal: 20,  metric: "kills", title: "Frost Marksman", description: "Get 20 kills with the Marksman DMR" },
  { id: "wc_dmr_kills_70",  weaponId: "rifle_dm", skinId: "crimson", goal: 70,  metric: "kills", title: "Crimson Marksman", description: "Get 70 kills with the Marksman DMR" },
  { id: "wc_dmr_kills_200", weaponId: "rifle_dm", skinId: "neon",    goal: 200, metric: "kills", title: "Neon Marksman", description: "Get 200 kills with the Marksman DMR" },
  { id: "wc_dmr_kills_300", weaponId: "rifle_dm", skinId: "inferno", goal: 300, metric: "kills", title: "DMR Inferno", description: "Get 300 kills with the Marksman DMR" },

  // ---- sniper_lr (Longshot) — fill missing arctic/crimson/emerald/neon/inferno ----
  { id: "wc_sniper_kills_15",  weaponId: "sniper_lr", skinId: "arctic",  goal: 15,  metric: "kills", title: "Frost Sniper", description: "Get 15 kills with the Longshot" },
  { id: "wc_sniper_kills_40",  weaponId: "sniper_lr", skinId: "crimson", goal: 40,  metric: "kills", title: "Crimson Death", description: "Get 40 kills with the Longshot" },
  { id: "wc_sniper_kills_70",  weaponId: "sniper_lr", skinId: "emerald", goal: 70,  metric: "kills", title: "Emerald Death", description: "Get 70 kills with the Longshot" },
  { id: "wc_sniper_kills_150", weaponId: "sniper_lr", skinId: "neon",    goal: 150, metric: "kills", title: "Neon Death", description: "Get 150 kills with the Longshot" },
  { id: "wc_sniper_kills_200", weaponId: "sniper_lr", skinId: "inferno", goal: 200, metric: "kills", title: "Longshot Inferno", description: "Get 200 kills with the Longshot" },

  // ---- lmg_hv (Hailstorm LMG) — fill missing crimson/emerald/carbon/neon/gold ----
  { id: "wc_lmg_kills_40",  weaponId: "lmg_hv", skinId: "crimson", goal: 40,  metric: "kills", title: "Crimson Hailstorm", description: "Get 40 kills with the Hailstorm LMG" },
  { id: "wc_lmg_kills_100", weaponId: "lmg_hv", skinId: "emerald", goal: 100, metric: "kills", title: "Emerald Hailstorm", description: "Get 100 kills with the Hailstorm LMG" },
  { id: "wc_lmg_hs_80",     weaponId: "lmg_hv", skinId: "carbon",  goal: 80,  metric: "headshots", title: "Carbon Suppressor", description: "Land 80 headshots with the Hailstorm LMG" },
  { id: "wc_lmg_kills_280", weaponId: "lmg_hv", skinId: "neon",    goal: 280, metric: "kills", title: "Neon Hailstorm", description: "Get 280 kills with the Hailstorm LMG" },
  { id: "wc_lmg_kills_400", weaponId: "lmg_hv", skinId: "gold",    goal: 400, metric: "kills", title: "LMG Legend", description: "Get 400 kills with the Hailstorm LMG" },

  // ---- pistol_side (Sidearm P-9) — fill missing emerald/carbon/neon/inferno/gold ----
  { id: "wc_pistol_kills_50",  weaponId: "pistol_side", skinId: "emerald", goal: 50,  metric: "kills", title: "Emerald Sidearm", description: "Get 50 kills with the Sidearm P-9" },
  { id: "wc_pistol_hs_80",     weaponId: "pistol_side", skinId: "carbon",  goal: 80,  metric: "headshots", title: "Carbon Sidearm", description: "Land 80 headshots with the Sidearm P-9" },
  { id: "wc_pistol_kills_120", weaponId: "pistol_side", skinId: "neon",    goal: 120, metric: "kills", title: "Neon Sidearm", description: "Get 120 kills with the Sidearm P-9" },
  { id: "wc_pistol_kills_180", weaponId: "pistol_side", skinId: "inferno", goal: 180, metric: "kills", title: "Sidearm Inferno", description: "Get 180 kills with the Sidearm P-9" },
  { id: "wc_pistol_kills_250", weaponId: "pistol_side", skinId: "gold",    goal: 250, metric: "kills", title: "Sidearm Legend", description: "Get 250 kills with the Sidearm P-9" },

  // ---- smg_vector (Vector PDW) — fill missing arctic/crimson/emerald/carbon/inferno/gold ----
  { id: "wc_vector_kills_25",  weaponId: "smg_vector", skinId: "arctic",  goal: 25,  metric: "kills", title: "Frost Vector", description: "Get 25 kills with the Vector PDW" },
  { id: "wc_vector_kills_40",  weaponId: "smg_vector", skinId: "crimson", goal: 40,  metric: "kills", title: "Crimson Vector", description: "Get 40 kills with the Vector PDW" },
  { id: "wc_vector_kills_90",  weaponId: "smg_vector", skinId: "emerald", goal: 90,  metric: "kills", title: "Emerald Vector", description: "Get 90 kills with the Vector PDW" },
  { id: "wc_vector_hs_70",     weaponId: "smg_vector", skinId: "carbon",  goal: 70,  metric: "headshots", title: "Carbon Vector", description: "Land 70 headshots with the Vector PDW" },
  { id: "wc_vector_kills_200", weaponId: "smg_vector", skinId: "inferno", goal: 200, metric: "kills", title: "Vector Inferno", description: "Get 200 kills with the Vector PDW" },
  { id: "wc_vector_kills_300", weaponId: "smg_vector", skinId: "gold",    goal: 300, metric: "kills", title: "Vector Legend", description: "Get 300 kills with the Vector PDW" },

  // ---- shotgun_auto (Wraith Auto) — fill missing arctic/crimson/carbon/neon/inferno/gold ----
  { id: "wc_autoshotgun_kills_30",  weaponId: "shotgun_auto", skinId: "arctic",  goal: 30,  metric: "kills", title: "Frost Wraith", description: "Get 30 kills with the Wraith Auto" },
  { id: "wc_autoshotgun_kills_50",  weaponId: "shotgun_auto", skinId: "crimson", goal: 50,  metric: "kills", title: "Crimson Wraith", description: "Get 50 kills with the Wraith Auto" },
  { id: "wc_autoshotgun_hs_45",     weaponId: "shotgun_auto", skinId: "carbon",  goal: 45,  metric: "headshots", title: "Carbon Wraith", description: "Land 45 headshots with the Wraith Auto" },
  { id: "wc_autoshotgun_kills_120", weaponId: "shotgun_auto", skinId: "neon",    goal: 120, metric: "kills", title: "Neon Wraith", description: "Get 120 kills with the Wraith Auto" },
  { id: "wc_autoshotgun_kills_180", weaponId: "shotgun_auto", skinId: "inferno", goal: 180, metric: "kills", title: "Wraith Inferno", description: "Get 180 kills with the Wraith Auto" },
  { id: "wc_autoshotgun_kills_250", weaponId: "shotgun_auto", skinId: "gold",    goal: 250, metric: "kills", title: "Wraith Legend", description: "Get 250 kills with the Wraith Auto" },

  // ---- pistol_magnum (Magnum .50) — fill missing arctic/crimson/emerald/carbon/neon ----
  { id: "wc_magnum_kills_15", weaponId: "pistol_magnum", skinId: "arctic",  goal: 15, metric: "kills", title: "Frost Hand Cannon", description: "Get 15 kills with the Magnum .50" },
  { id: "wc_magnum_kills_50", weaponId: "pistol_magnum", skinId: "crimson", goal: 50, metric: "kills", title: "Crimson Deadeye", description: "Get 50 kills with the Magnum .50" },
  { id: "wc_magnum_kills_80", weaponId: "pistol_magnum", skinId: "emerald", goal: 80, metric: "kills", title: "Emerald Deadeye", description: "Get 80 kills with the Magnum .50" },
  { id: "wc_magnum_hs_50",    weaponId: "pistol_magnum", skinId: "carbon",  goal: 50, metric: "headshots", title: "Carbon Deadeye", description: "Land 50 headshots with the Magnum .50" },
  { id: "wc_magnum_kills_150",weaponId: "pistol_magnum", skinId: "neon",    goal: 150, metric: "kills", title: "Neon Deadeye", description: "Get 150 kills with the Magnum .50" },

  // ---- dmr_scout (Scout Tactical) — fill missing arctic/crimson/neon/inferno/gold ----
  { id: "wc_scout_kills_20",  weaponId: "dmr_scout", skinId: "arctic",  goal: 20,  metric: "kills", title: "Frost Scout", description: "Get 20 kills with the Scout Tactical" },
  { id: "wc_scout_kills_40",  weaponId: "dmr_scout", skinId: "crimson", goal: 40,  metric: "kills", title: "Crimson Scout", description: "Get 40 kills with the Scout Tactical" },
  { id: "wc_scout_kills_100", weaponId: "dmr_scout", skinId: "neon",    goal: 100, metric: "kills", title: "Neon Scout", description: "Get 100 kills with the Scout Tactical" },
  { id: "wc_scout_kills_180", weaponId: "dmr_scout", skinId: "inferno", goal: 180, metric: "kills", title: "Scout Inferno", description: "Get 180 kills with the Scout Tactical" },
  { id: "wc_scout_kills_250", weaponId: "dmr_scout", skinId: "gold",    goal: 250, metric: "kills", title: "Scout Legend", description: "Get 250 kills with the Scout Tactical" },

  // ---- shiv (Shiv) — fill missing crimson/emerald/carbon/neon/inferno/gold ----
  { id: "wc_shiv_kills_15",  weaponId: "shiv", skinId: "crimson", goal: 15,  metric: "kills", title: "Crimson Shiv", description: "Get 15 kills with the Shiv" },
  { id: "wc_shiv_kills_40",  weaponId: "shiv", skinId: "emerald", goal: 40,  metric: "kills", title: "Emerald Shiv", description: "Get 40 kills with the Shiv" },
  { id: "wc_shiv_hs_30",     weaponId: "shiv", skinId: "carbon",  goal: 30,  metric: "headshots", title: "Carbon Shiv", description: "Land 30 headshots with the Shiv" },
  { id: "wc_shiv_kills_80",  weaponId: "shiv", skinId: "neon",    goal: 80,  metric: "kills", title: "Neon Shiv", description: "Get 80 kills with the Shiv" },
  { id: "wc_shiv_kills_120", weaponId: "shiv", skinId: "inferno", goal: 120, metric: "kills", title: "Shiv Inferno", description: "Get 120 kills with the Shiv" },
  { id: "wc_shiv_kills_180", weaponId: "shiv", skinId: "gold",    goal: 180, metric: "kills", title: "Shiv Legend", description: "Get 180 kills with the Shiv" },

  // ---- machete (Machete) — fill missing arctic/crimson/carbon/neon/inferno/gold ----
  { id: "wc_machete_kills_20", weaponId: "machete", skinId: "arctic",  goal: 20, metric: "kills", title: "Frost Striker", description: "Get 20 kills with the Machete" },
  { id: "wc_machete_kills_60", weaponId: "machete", skinId: "crimson", goal: 60, metric: "kills", title: "Crimson Striker", description: "Get 60 kills with the Machete" },
  { id: "wc_machete_hs_35",    weaponId: "machete", skinId: "carbon",  goal: 35, metric: "headshots", title: "Carbon Striker", description: "Land 35 headshots with the Machete" },
  { id: "wc_machete_kills_100",weaponId: "machete", skinId: "neon",    goal: 100, metric: "kills", title: "Neon Striker", description: "Get 100 kills with the Machete" },
  { id: "wc_machete_kills_150",weaponId: "machete", skinId: "inferno", goal: 150, metric: "kills", title: "Striker Inferno", description: "Get 150 kills with the Machete" },
  { id: "wc_machete_kills_220",weaponId: "machete", skinId: "gold",    goal: 220, metric: "kills", title: "Machete Legend", description: "Get 220 kills with the Machete" },

  // ---- hammer (Sledge Hammer) — fill missing arctic/crimson/emerald/carbon/neon/gold ----
  { id: "wc_hammer_kills_15",  weaponId: "hammer", skinId: "arctic",  goal: 15,  metric: "kills", title: "Frost Smasher", description: "Get 15 kills with the Sledge Hammer" },
  { id: "wc_hammer_kills_45",  weaponId: "hammer", skinId: "crimson", goal: 45,  metric: "kills", title: "Crimson Smasher", description: "Get 45 kills with the Sledge Hammer" },
  { id: "wc_hammer_kills_80",  weaponId: "hammer", skinId: "emerald", goal: 80,  metric: "kills", title: "Emerald Smasher", description: "Get 80 kills with the Sledge Hammer" },
  { id: "wc_hammer_hs_30",     weaponId: "hammer", skinId: "carbon",  goal: 30,  metric: "headshots", title: "Carbon Smasher", description: "Land 30 headshots with the Sledge Hammer" },
  { id: "wc_hammer_kills_120", weaponId: "hammer", skinId: "neon",    goal: 120, metric: "kills", title: "Neon Smasher", description: "Get 120 kills with the Sledge Hammer" },
  { id: "wc_hammer_kills_200", weaponId: "hammer", skinId: "gold",    goal: 200, metric: "kills", title: "Hammer Legend", description: "Get 200 kills with the Sledge Hammer" },

  // ---- pistol_burst (Burst Pistol) — fill missing arctic/emerald/carbon/neon/inferno/gold ----
  { id: "wc_burst_kills_25",  weaponId: "pistol_burst", skinId: "arctic",  goal: 25,  metric: "kills", title: "Frost Burst", description: "Get 25 kills with the Burst Pistol" },
  { id: "wc_burst_kills_80",  weaponId: "pistol_burst", skinId: "emerald", goal: 80,  metric: "kills", title: "Emerald Burst", description: "Get 80 kills with the Burst Pistol" },
  { id: "wc_burst_hs_60",     weaponId: "pistol_burst", skinId: "carbon",  goal: 60,  metric: "headshots", title: "Carbon Burst", description: "Land 60 headshots with the Burst Pistol" },
  { id: "wc_burst_kills_140", weaponId: "pistol_burst", skinId: "neon",    goal: 140, metric: "kills", title: "Neon Burst", description: "Get 140 kills with the Burst Pistol" },
  { id: "wc_burst_kills_220", weaponId: "pistol_burst", skinId: "inferno", goal: 220, metric: "kills", title: "Burst Inferno", description: "Get 220 kills with the Burst Pistol" },
  { id: "wc_burst_kills_300", weaponId: "pistol_burst", skinId: "gold",    goal: 300, metric: "kills", title: "Burst Legend", description: "Get 300 kills with the Burst Pistol" },

  // ---- pistol_machine (Machine Pistol) — fill missing arctic/crimson/emerald/carbon/inferno/gold ----
  { id: "wc_machine_kills_25",  weaponId: "pistol_machine", skinId: "arctic",  goal: 25,  metric: "kills", title: "Frost Mag Dump", description: "Get 25 kills with the Machine Pistol" },
  { id: "wc_machine_kills_45",  weaponId: "pistol_machine", skinId: "crimson", goal: 45,  metric: "kills", title: "Crimson Mag Dump", description: "Get 45 kills with the Machine Pistol" },
  { id: "wc_machine_kills_90",  weaponId: "pistol_machine", skinId: "emerald", goal: 90,  metric: "kills", title: "Emerald Mag Dump", description: "Get 90 kills with the Machine Pistol" },
  { id: "wc_machine_hs_70",     weaponId: "pistol_machine", skinId: "carbon",  goal: 70,  metric: "headshots", title: "Carbon Mag Dump", description: "Land 70 headshots with the Machine Pistol" },
  { id: "wc_machine_kills_180", weaponId: "pistol_machine", skinId: "inferno", goal: 180, metric: "kills", title: "Mag Dump Inferno", description: "Get 180 kills with the Machine Pistol" },
  { id: "wc_machine_kills_260", weaponId: "pistol_machine", skinId: "gold",    goal: 260, metric: "kills", title: "Machine Pistol Legend", description: "Get 260 kills with the Machine Pistol" },

  // ---- launcher_rocket (RL-7 Rocket Launcher) — fill missing arctic/crimson/emerald/carbon/neon/inferno ----
  { id: "wc_launcher_kills_10", weaponId: "launcher_rocket", skinId: "arctic",  goal: 10, metric: "kills", title: "Frost Demolitionist", description: "Get 10 kills with the RL-7 Rocket Launcher" },
  { id: "wc_launcher_kills_20", weaponId: "launcher_rocket", skinId: "crimson", goal: 20, metric: "kills", title: "Crimson Demolitionist", description: "Get 20 kills with the RL-7 Rocket Launcher" },
  { id: "wc_launcher_kills_40", weaponId: "launcher_rocket", skinId: "emerald", goal: 40, metric: "kills", title: "Emerald Demolitionist", description: "Get 40 kills with the RL-7 Rocket Launcher" },
  { id: "wc_launcher_hs_15",    weaponId: "launcher_rocket", skinId: "carbon",  goal: 15, metric: "headshots", title: "Carbon Demolitionist", description: "Land 15 headshots with the RL-7 Rocket Launcher" },
  { id: "wc_launcher_kills_60", weaponId: "launcher_rocket", skinId: "neon",    goal: 60, metric: "kills", title: "Neon Demolitionist", description: "Get 60 kills with the RL-7 Rocket Launcher" },
  { id: "wc_launcher_kills_90", weaponId: "launcher_rocket", skinId: "inferno", goal: 90, metric: "kills", title: "Demolitionist Inferno", description: "Get 90 kills with the RL-7 Rocket Launcher" },

  // ---- sniper_scout (Scout Sniper) — fill missing arctic/crimson/neon/inferno/gold ----
  { id: "wc_scout_sniper_kills_15", weaponId: "sniper_scout", skinId: "arctic",  goal: 15, metric: "kills", title: "Frost Eagle Eye", description: "Get 15 kills with the Scout Sniper" },
  { id: "wc_scout_sniper_kills_25", weaponId: "sniper_scout", skinId: "crimson", goal: 25, metric: "kills", title: "Crimson Eagle Eye", description: "Get 25 kills with the Scout Sniper" },
  { id: "wc_scout_sniper_kills_90", weaponId: "sniper_scout", skinId: "neon",    goal: 90, metric: "kills", title: "Neon Eagle Eye", description: "Get 90 kills with the Scout Sniper" },
  { id: "wc_scout_sniper_kills_140",weaponId: "sniper_scout", skinId: "inferno", goal: 140, metric: "kills", title: "Eagle Eye Inferno", description: "Get 140 kills with the Scout Sniper" },
  { id: "wc_scout_sniper_kills_200",weaponId: "sniper_scout", skinId: "gold",    goal: 200, metric: "kills", title: "Scout Sniper Legend", description: "Get 200 kills with the Scout Sniper" },

  // ---- rifle_burst (Reaver BR) — fill missing arctic/emerald/carbon/inferno/gold ----
  { id: "wc_rifle_burst_kills_25",  weaponId: "rifle_burst", skinId: "arctic",  goal: 25,  metric: "kills", title: "Frost Reaver", description: "Get 25 kills with the Reaver BR" },
  { id: "wc_rifle_burst_kills_90",  weaponId: "rifle_burst", skinId: "emerald", goal: 90,  metric: "kills", title: "Emerald Reaver", description: "Get 90 kills with the Reaver BR" },
  { id: "wc_rifle_burst_hs_75",     weaponId: "rifle_burst", skinId: "carbon",  goal: 75,  metric: "headshots", title: "Carbon Reaver", description: "Land 75 headshots with the Reaver BR" },
  { id: "wc_rifle_burst_kills_220", weaponId: "rifle_burst", skinId: "inferno", goal: 220, metric: "kills", title: "Reaver Inferno", description: "Get 220 kills with the Reaver BR" },
  { id: "wc_rifle_burst_kills_320", weaponId: "rifle_burst", skinId: "gold",    goal: 320, metric: "kills", title: "Reaver Legend", description: "Get 320 kills with the Reaver BR" },

  // ---- rifle_heavy (Behemoth AR) — fill missing arctic/crimson/emerald/carbon/neon ----
  { id: "wc_rifle_heavy_kills_25", weaponId: "rifle_heavy", skinId: "arctic",  goal: 25, metric: "kills", title: "Frost Behemoth", description: "Get 25 kills with the Behemoth AR" },
  { id: "wc_rifle_heavy_kills_50", weaponId: "rifle_heavy", skinId: "crimson", goal: 50, metric: "kills", title: "Crimson Behemoth", description: "Get 50 kills with the Behemoth AR" },
  { id: "wc_rifle_heavy_kills_100",weaponId: "rifle_heavy", skinId: "emerald", goal: 100, metric: "kills", title: "Emerald Behemoth", description: "Get 100 kills with the Behemoth AR" },
  { id: "wc_rifle_heavy_hs_90",    weaponId: "rifle_heavy", skinId: "carbon",  goal: 90, metric: "headshots", title: "Carbon Behemoth", description: "Land 90 headshots with the Behemoth AR" },
  { id: "wc_rifle_heavy_kills_200",weaponId: "rifle_heavy", skinId: "neon",    goal: 200, metric: "kills", title: "Neon Behemoth", description: "Get 200 kills with the Behemoth AR" },

  // ---- smg_compact (Wasp PDW) — fill missing crimson/emerald/carbon/inferno/gold ----
  { id: "wc_smg_compact_kills_20",  weaponId: "smg_compact", skinId: "crimson", goal: 20,  metric: "kills", title: "Crimson Wasp", description: "Get 20 kills with the Wasp PDW" },
  { id: "wc_smg_compact_kills_60",  weaponId: "smg_compact", skinId: "emerald", goal: 60,  metric: "kills", title: "Emerald Wasp", description: "Get 60 kills with the Wasp PDW" },
  { id: "wc_smg_compact_hs_50",     weaponId: "smg_compact", skinId: "carbon",  goal: 50,  metric: "headshots", title: "Carbon Wasp", description: "Land 50 headshots with the Wasp PDW" },
  { id: "wc_smg_compact_kills_180", weaponId: "smg_compact", skinId: "inferno", goal: 180, metric: "kills", title: "Wasp Inferno", description: "Get 180 kills with the Wasp PDW" },
  { id: "wc_smg_compact_kills_250", weaponId: "smg_compact", skinId: "gold",    goal: 250, metric: "kills", title: "Wasp Legend", description: "Get 250 kills with the Wasp PDW" },

  // ---- shotgun_combat (Mauler CS) — fill missing arctic/emerald/carbon/neon/gold ----
  { id: "wc_shotgun_combat_kills_20",  weaponId: "shotgun_combat", skinId: "arctic",  goal: 20,  metric: "kills", title: "Frost Mauler", description: "Get 20 kills with the Mauler CS" },
  { id: "wc_shotgun_combat_kills_70",  weaponId: "shotgun_combat", skinId: "emerald", goal: 70,  metric: "kills", title: "Emerald Mauler", description: "Get 70 kills with the Mauler CS" },
  { id: "wc_shotgun_combat_hs_50",     weaponId: "shotgun_combat", skinId: "carbon",  goal: 50,  metric: "headshots", title: "Carbon Mauler", description: "Land 50 headshots with the Mauler CS" },
  { id: "wc_shotgun_combat_kills_160", weaponId: "shotgun_combat", skinId: "neon",    goal: 160, metric: "kills", title: "Neon Mauler", description: "Get 160 kills with the Mauler CS" },
  { id: "wc_shotgun_combat_kills_240", weaponId: "shotgun_combat", skinId: "gold",    goal: 240, metric: "kills", title: "Mauler Legend", description: "Get 240 kills with the Mauler CS" },

  // ---- dmr_heavy (Executioner DMR) — fill missing arctic/crimson/emerald/neon/inferno ----
  { id: "wc_dmr_heavy_kills_20",  weaponId: "dmr_heavy", skinId: "arctic",  goal: 20,  metric: "kills", title: "Frost Executioner", description: "Get 20 kills with the Executioner DMR" },
  { id: "wc_dmr_heavy_kills_40",  weaponId: "dmr_heavy", skinId: "crimson", goal: 40,  metric: "kills", title: "Crimson Executioner", description: "Get 40 kills with the Executioner DMR" },
  { id: "wc_dmr_heavy_kills_80",  weaponId: "dmr_heavy", skinId: "emerald", goal: 80,  metric: "kills", title: "Emerald Executioner", description: "Get 80 kills with the Executioner DMR" },
  { id: "wc_dmr_heavy_kills_140", weaponId: "dmr_heavy", skinId: "neon",    goal: 140, metric: "kills", title: "Neon Executioner", description: "Get 140 kills with the Executioner DMR" },
  { id: "wc_dmr_heavy_kills_220", weaponId: "dmr_heavy", skinId: "inferno", goal: 220, metric: "kills", title: "Executioner Inferno", description: "Get 220 kills with the Executioner DMR" },

  // ---- lmg_light (Vanguard LSW) — fill missing crimson/emerald/carbon/inferno/gold ----
  { id: "wc_lmg_light_kills_30",  weaponId: "lmg_light", skinId: "crimson", goal: 30,  metric: "kills", title: "Crimson Vanguard", description: "Get 30 kills with the Vanguard LSW" },
  { id: "wc_lmg_light_kills_100", weaponId: "lmg_light", skinId: "emerald", goal: 100, metric: "kills", title: "Emerald Vanguard", description: "Get 100 kills with the Vanguard LSW" },
  { id: "wc_lmg_light_hs_80",     weaponId: "lmg_light", skinId: "carbon",  goal: 80,  metric: "headshots", title: "Carbon Vanguard", description: "Land 80 headshots with the Vanguard LSW" },
  { id: "wc_lmg_light_kills_220", weaponId: "lmg_light", skinId: "inferno", goal: 220, metric: "kills", title: "Vanguard Inferno", description: "Get 220 kills with the Vanguard LSW" },
  { id: "wc_lmg_light_kills_320", weaponId: "lmg_light", skinId: "gold",    goal: 320, metric: "kills", title: "Vanguard Legend", description: "Get 320 kills with the Vanguard LSW" },

  // ============================================================================
  // Task 18-c+d: Weapon challenges for the 2 new high-tier weapons — sniper_heavy
  // (Annihilator, L16) and lmg_heavy (Leviathan, L17). 7 challenges each covering
  // all 7 non-default skins. Goals scale with skin rarity, similar to other
  // snipers/LMGs but slightly higher since these are high-tier unlocks.
  // ============================================================================
  // ---- sniper_heavy (Annihilator) ----
  { id: "wc_sniper_heavy_kills_15",  weaponId: "sniper_heavy", skinId: "arctic",   goal: 15,  metric: "kills",     title: "Frost Annihilator",     description: "Get 15 kills with the Annihilator" },
  { id: "wc_sniper_heavy_kills_30",  weaponId: "sniper_heavy", skinId: "crimson",  goal: 30,  metric: "kills",     title: "Crimson Annihilator",   description: "Get 30 kills with the Annihilator" },
  { id: "wc_sniper_heavy_kills_50",  weaponId: "sniper_heavy", skinId: "emerald",  goal: 50,  metric: "kills",     title: "Emerald Annihilator",   description: "Get 50 kills with the Annihilator" },
  { id: "wc_sniper_heavy_hs_35",     weaponId: "sniper_heavy", skinId: "carbon",   goal: 35,  metric: "headshots", title: "Carbon Annihilator",    description: "Land 35 headshots with the Annihilator" },
  { id: "wc_sniper_heavy_kills_100", weaponId: "sniper_heavy", skinId: "neon",     goal: 100, metric: "kills",     title: "Neon Annihilator",      description: "Get 100 kills with the Annihilator" },
  { id: "wc_sniper_heavy_kills_150", weaponId: "sniper_heavy", skinId: "inferno",  goal: 150, metric: "kills",     title: "Annihilator Inferno",   description: "Get 150 kills with the Annihilator" },
  { id: "wc_sniper_heavy_kills_200", weaponId: "sniper_heavy", skinId: "gold",     goal: 200, metric: "kills",     title: "Annihilator Legend",    description: "Get 200 kills with the Annihilator" },

  // ---- lmg_heavy (Leviathan) ----
  { id: "wc_lmg_heavy_kills_40",  weaponId: "lmg_heavy", skinId: "arctic",   goal: 40,  metric: "kills",     title: "Frost Leviathan",     description: "Get 40 kills with the Leviathan" },
  { id: "wc_lmg_heavy_kills_60",  weaponId: "lmg_heavy", skinId: "crimson",  goal: 60,  metric: "kills",     title: "Crimson Leviathan",   description: "Get 60 kills with the Leviathan" },
  { id: "wc_lmg_heavy_kills_100", weaponId: "lmg_heavy", skinId: "emerald",  goal: 100, metric: "kills",     title: "Emerald Leviathan",   description: "Get 100 kills with the Leviathan" },
  { id: "wc_lmg_heavy_hs_70",     weaponId: "lmg_heavy", skinId: "carbon",   goal: 70,  metric: "headshots", title: "Carbon Leviathan",    description: "Land 70 headshots with the Leviathan" },
  { id: "wc_lmg_heavy_kills_180", weaponId: "lmg_heavy", skinId: "neon",     goal: 180, metric: "kills",     title: "Neon Leviathan",      description: "Get 180 kills with the Leviathan" },
  { id: "wc_lmg_heavy_kills_250", weaponId: "lmg_heavy", skinId: "inferno",  goal: 250, metric: "kills",     title: "Leviathan Inferno",   description: "Get 250 kills with the Leviathan" },
  { id: "wc_lmg_heavy_kills_350", weaponId: "lmg_heavy", skinId: "gold",     goal: 350, metric: "kills",     title: "Leviathan Legend",    description: "Get 350 kills with the Leviathan" },
];

// Helper: list all challenges for a given weapon.
export function challengesForWeapon(weaponId: string): WeaponChallengeDef[] {
  return WEAPON_CHALLENGES.filter((c) => c.weaponId === weaponId);
}

// Helper: list all challenges whose skin reward applies to the given weapon.
export function skinChallengesForWeapon(weaponId: string, skinId: string): WeaponChallengeDef[] {
  return WEAPON_CHALLENGES.filter((c) => c.weaponId === weaponId && c.skinId === skinId);
}

// ---- Leveling curve ---------------------------------------------------------
// XP curve: steeper progression so leveling takes meaningful play time.
// Level N requires totalXpForLevel(N) cumulative XP. The curve is roughly
// cubic — early levels come quickly (so new players feel progression), but
// mid-to-high levels take many matches to climb. This replaces the old
// `100 * (level-1) * level` quadratic curve which let a single 30-kill match
// take a player from level 1 → level 5.
//
// Examples (new vs old):
//   L2:  150 XP  (was 200)   — slight ease for the very first level
//   L4:  1350 XP (was 1200)  — comparable
//   L8:  7350 XP (was 5600)  — steeper
//   L12: 19800 XP (was 13200) — significantly steeper
//   L20: 77000 XP (was 38000) — much steeper (veteran players)
//   L30: 244650 XP (was 87000) — long-term goal
export function totalXpForLevel(level: number): number {
  if (level <= 1) return 0;
  // Cubic-ish: 50 * (level-1)^2 * level / 2 ≈ 25 * (level-1)^2 * level
  // Tuned so L2 = 150, L4 = 1350, L8 = 7350, L12 = 19800.
  return Math.round(25 * (level - 1) * (level - 1) * level);
}
export function levelForXp(xp: number): number {
  let lvl = 1;
  while (totalXpForLevel(lvl + 1) <= xp) lvl++;
  return lvl;
}
export function xpProgressInLevel(xp: number): { current: number; needed: number; level: number } {
  const level = levelForXp(xp);
  const base = totalXpForLevel(level);
  const next = totalXpForLevel(level + 1);
  return { current: xp - base, needed: next - base, level };
}

// XP & credit rewards
// Reduced per-kill XP from 100 → 25 so a single 30-kill match no longer takes
// a player from L1 → L4. The bulk of XP now comes from wins + challenges,
// not raw kill count. Difficulty-scaled kill XP is applied in player-service
// (easy=10, normal=15, hard=22, veteran=30 — see applyMatchResult).
export const REWARDS = {
  killXp: 25,
  killCredits: 8,
  // 19a+19b: Headshot bonus boosted from 12→25 XP / 3→8 CR. Headshots now
  // award roughly 2x the kill XP bonus and ~2.7x the credits, making precision
  // play meaningfully more rewarding. The bonus is added on top of the per-kill
  // XP/credits in applyMatchResult (both the difficulty-scaled path and the
  // legacy flat path) so it naturally stacks with the new kill-streak bonus.
  headshotXpBonus: 25,
  headshotCreditsBonus: 8,
  winXpBonus: 150,
  winCreditsBonus: 50,
  participationXp: 25,
  participationCredits: 10,
};

// ---- Lookup helpers ---------------------------------------------------------
export const weaponById = (id: string) => WEAPONS.find((w) => w.id === id) ?? WEAPONS[0];
export const attachmentById = (id: string) => ATTACHMENTS.find((a) => a.id === id);
export const weaponSkinById = (id: string) => WEAPON_SKINS.find((s) => s.id === id) ?? WEAPON_SKINS[0];
export const playerSkinById = (id: string) => PLAYER_SKINS.find((s) => s.id === id) ?? PLAYER_SKINS[0];

export interface ResolvedLoadout {
  weapon: WeaponDef;
  secondary: WeaponDef;
  melee: WeaponDef;
  weaponSkin: WeaponSkinDef;
  // Per-weapon skins (secondary + melee). Each slot has its own skin so
  // changing one doesn't change the others.
  secondaryWeaponSkin: WeaponSkinDef;
  meleeWeaponSkin: WeaponSkinDef;
  playerSkin: PlayerSkinDef;
  attachments: Record<AttachmentSlot, string | null>;
  // Secondary-slot attachments (sidearms). Defaults to all-null when not provided.
  secondaryAttachments: Record<AttachmentSlot, string | null>;
  // Melee-slot attachments. Always all-null for now (melee weapons don't take
  // attachments) — included for forward-compat.
  meleeAttachments: Record<AttachmentSlot, string | null>;
}

export function resolveLoadout(input: {
  primaryWeapon: string;
  secondaryWeapon?: string;
  meleeWeapon?: string;
  weaponSkin: string;
  // Per-weapon skins for the secondary + melee slots.
  secondaryWeaponSkin?: string;
  meleeWeaponSkin?: string;
  playerSkin: string;
  attachments: Record<string, string | null> | string;
  // Optional secondary + melee attachment maps (JSON string or object).
  // Default to all-null if not provided.
  secondaryAttachments?: Record<string, string | null> | string;
  meleeAttachments?: Record<string, string | null> | string;
  // Optional: set of skin IDs unlocked for the equipped primary weapon. When
  // supplied, the resolved skin falls back to "default" if not in this set.
  unlockedSkinsForWeapon?: string[];
  // Optional: skin IDs unlocked for the secondary + melee weapons (per-weapon
  // skin validation). Defaults to ["default"] when not supplied.
  unlockedSkinsForSecondary?: string[];
  unlockedSkinsForMelee?: string[];
}): ResolvedLoadout {
  const parseAtts = (v: Record<string, string | null> | string | undefined): Record<AttachmentSlot, string | null> => {
    const o = v ? (typeof v === "string" ? JSON.parse(v || "{}") : v) : {};
    return {
      sight: o.sight ?? null,
      barrel: o.barrel ?? null,
      grip: o.grip ?? null,
      magazine: o.magazine ?? null,
    };
  };
  const weapon = weaponById(input.primaryWeapon);
  // Validate each slot's skin is unlocked for that slot's weapon. If not,
  // fall back to the default skin (which is always available).
  const validateSkin = (skinId: string, unlocked: string[] | undefined): WeaponSkinDef => {
    if (unlocked && !unlocked.includes(skinId)) return weaponSkinById("default");
    return weaponSkinById(skinId);
  };
  const skinId = validateSkin(input.weaponSkin, input.unlockedSkinsForWeapon);
  const secondarySkin = validateSkin(input.secondaryWeaponSkin ?? "default", input.unlockedSkinsForSecondary);
  const meleeSkin = validateSkin(input.meleeWeaponSkin ?? "default", input.unlockedSkinsForMelee);
  return {
    weapon,
    secondary: weaponById(input.secondaryWeapon ?? "pistol_side"),
    melee: weaponById(input.meleeWeapon ?? "knife_tactical"),
    weaponSkin: skinId,
    secondaryWeaponSkin: secondarySkin,
    meleeWeaponSkin: meleeSkin,
    playerSkin: playerSkinById(input.playerSkin),
    attachments: parseAtts(input.attachments),
    secondaryAttachments: parseAtts(input.secondaryAttachments),
    meleeAttachments: parseAtts(input.meleeAttachments),
  };
}

// Compute effective stats after applying attachment effects.
// `spread` (hipfire) and `adsSpread` (ADS) are tracked separately so attachments
// can tune one without the other (e.g. laser sight only buffs hipfire; red dot
// only buffs ADS). If an attachment sets only `spread`, the same modifier is
// applied to ADS too (backward-compat with attachments authored before the
// decoupling).
export interface EffectiveStats extends WeaponStats {
  magSize: number;
  // The resolved sight type for this loadout (engine reads this for zoom/reticle).
  sightType: SightType;
}

export function computeEffectiveStats(weapon: WeaponDef, atts: Record<AttachmentSlot, string | null>): EffectiveStats {
  const base = { ...weapon.stats };
  const acc: Record<string, number> = {};
  for (const slot of ["sight", "barrel", "grip", "magazine"] as AttachmentSlot[]) {
    const id = atts[slot];
    if (!id) continue;
    const def = attachmentById(id);
    if (!def) continue;
    for (const [k, v] of Object.entries(def.effects)) {
      acc[k] = (acc[k] ?? 0) + (v as number);
    }
  }
  const pct = (val: number, key: string) => base[key as keyof WeaponStats] as number * (1 + (acc[key] ?? 0) / 100);
  const magBonus = acc.magSize ?? 0;
  // Resolve sight type from the equipped sight attachment (iron if none).
  const sightDef = sightDefForAttachments(atts, weapon.baseSightType);
  return {
    ...base,
    damage: Math.round(pct(base.damage, "damage")),
    recoil: Math.max(0.05, base.recoil * (1 + (acc.recoil ?? 0) / 100)),
    // Hipfire spread: clamp so an attachment can't make it negative.
    spread: Math.max(0.0005, base.spread * (1 + (acc.spread ?? 0) / 100)),
    // ADS spread: uses adsSpread modifier if set, else falls back to spread modifier.
    adsSpread: Math.max(0.0, base.adsSpread * (1 + ((acc.adsSpread ?? acc.spread) ?? 0) / 100)),
    adsTime: Math.max(0.05, base.adsTime * (1 + (acc.adsTime ?? 0) / 100)),
    reloadTime: Math.max(0.4, base.reloadTime * (1 + (acc.reloadTime ?? 0) / 100)),
    moveSpeed: Math.max(0.4, base.moveSpeed * (1 + (acc.moveSpeed ?? 0) / 100)),
    range: Math.max(8, base.range * (1 + (acc.range ?? 0) / 100)),
    magSize: Math.max(1, Math.round(base.magSize * (1 + magBonus / 100))),
    sightType: sightDef.type,
  };
}

export const RARITY_COLORS: Record<string, string> = {
  common: "#9ca3af",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

// ============================================================================
// RANKS — tier system based on level. Purely cosmetic title shown in UI.
// ============================================================================
export interface RankDef {
  level: number;       // minimum level to achieve
  name: string;        // display name
  shortName: string;   // short code for badges
  color: string;       // accent color
  insignia: string;    // emoji-like glyph used in SVG-free badges
}

export const RANKS: RankDef[] = [
  { level: 1, name: "Recruit", shortName: "RCT", color: "#9ca3af", insignia: "▾" },
  { level: 3, name: "Private", shortName: "PVT", color: "#a3a3a3", insignia: "•" },
  { level: 5, name: "Corporal", shortName: "CPL", color: "#84cc16", insignia: "⌂" },
  { level: 8, name: "Sergeant", shortName: "SGT", color: "#22c55e", insignia: "◆" },
  { level: 11, name: "Lieutenant", shortName: "LT", color: "#06b6d4", insignia: "★" },
  { level: 14, name: "Captain", shortName: "CPT", color: "#3b82f6", insignia: "★" },
  { level: 17, name: "Major", shortName: "MAJ", color: "#a855f7", insignia: "✦" },
  { level: 20, name: "Colonel", shortName: "COL", color: "#ec4899", insignia: "✦" },
  { level: 24, name: "General", shortName: "GEN", color: "#f59e0b", insignia: "✪" },
  { level: 30, name: "Vanguard Elite", shortName: "VGE", color: "#ef4444", insignia: "✪" },
];

export function rankForLevel(level: number): RankDef {
  let r = RANKS[0];
  for (const rank of RANKS) if (level >= rank.level) r = rank;
  return r;
}
export function nextRank(level: number): RankDef | null {
  for (const rank of RANKS) if (rank.level > level) return rank;
  return null;
}

// ============================================================================
// DAILY CHALLENGES — 3 rotating objectives. The current set is determined by
// the day-of-year so all players share the same set on a given day.
// ============================================================================
export type ChallengeMetric =
  | "kills"
  | "headshots"
  | "wins"
  | "matches"
  | "tdm_kills"
  | "ffa_kills"
  | "kills_with_shotgun"
  | "kills_with_sniper"
  // Task 18-c+d: secondary (sidearm) + melee kill metrics for the new
  // Sidearm Slinger / Blade Master daily challenges and Pistolero / Edgewalker
  // weekly challenges. metricDelta in player-service.ts is updated separately
  // by the main agent to handle these.
  | "kills_with_secondary"
  | "kills_with_melee"
  | "multikills" // double-kill or better
  | "survival_kills"
  | "survival_waves"
  | "gungame_kills"
  | "kill_confirmations"
  | "kill_denials"
  | "level";   // elite quests: lifetime player level

export interface ChallengeDef {
  id: string;
  metric: ChallengeMetric;
  goal: number;
  rewardXp: number;
  rewardCredits: number;
  title: string;
  description: string;
  icon: string; // lucide icon name (string -> client maps)
  // Category distinguishes rotating daily/weekly challenges from lifetime
  // "elite" quests. Defaults to "daily" for existing entries.
  category?: "daily" | "weekly" | "elite";
}

export const DAILY_CHALLENGE_POOL: ChallengeDef[] = [
  // Task 18-c+d: rewardCredits ×2.5 (rounded to nearest 25) and rewardXp ×1.5
  // (rounded to nearest 50) to make daily challenges more rewarding. The two
  // new secondary/melee challenges (ch_secondary_15, ch_melee_5) are authored
  // at the already-boosted values directly.
  { id: "ch_kills_25", metric: "kills", goal: 25, rewardXp: 300, rewardCredits: 250, title: "Bloodhound", description: "Get 25 kills", icon: "Crosshair" },
  { id: "ch_kills_50", metric: "kills", goal: 50, rewardXp: 600, rewardCredits: 500, title: "Exterminator", description: "Get 50 kills", icon: "Crosshair" },
  { id: "ch_hs_10", metric: "headshots", goal: 10, rewardXp: 450, rewardCredits: 375, title: "Sharpshooter", description: "Land 10 headshots", icon: "Target" },
  { id: "ch_hs_25", metric: "headshots", goal: 25, rewardXp: 900, rewardCredits: 750, title: "Marksman", description: "Land 25 headshots", icon: "Target" },
  { id: "ch_win_3", metric: "wins", goal: 3, rewardXp: 550, rewardCredits: 450, title: "Victor", description: "Win 3 matches", icon: "Trophy" },
  { id: "ch_play_5", metric: "matches", goal: 5, rewardXp: 250, rewardCredits: 200, title: "Active Duty", description: "Play 5 matches", icon: "Swords" },
  { id: "ch_tags_12", metric: "kill_confirmations", goal: 12, rewardXp: 500, rewardCredits: 450, title: "Dog Tag Collector", description: "Recover 12 enemy tags in Kill Confirmed", icon: "Shield" },
  { id: "ch_denials_5", metric: "kill_denials", goal: 5, rewardXp: 500, rewardCredits: 450, title: "Last-Second Save", description: "Deny 5 enemy confirmations by retrieving allied tags", icon: "Shield" },
  { id: "ch_tdm_20", metric: "tdm_kills", goal: 20, rewardXp: 400, rewardCredits: 325, title: "Team Player", description: "Get 20 kills in TDM", icon: "Shield" },
  { id: "ch_ffa_20", metric: "ffa_kills", goal: 20, rewardXp: 400, rewardCredits: 325, title: "Lone Wolf", description: "Get 20 kills in FFA", icon: "Users" },
  { id: "ch_multi_5", metric: "multikills", goal: 5, rewardXp: 550, rewardCredits: 450, title: "Killing Spree", description: "Achieve 5 multi-kills", icon: "Zap" },
  { id: "ch_shotgun_10", metric: "kills_with_shotgun", goal: 10, rewardXp: 400, rewardCredits: 325, title: "Breacher", description: "Get 10 kills with shotguns", icon: "Crosshair" },
  { id: "ch_sniper_8", metric: "kills_with_sniper", goal: 8, rewardXp: 550, rewardCredits: 450, title: "Longshot", description: "Get 8 kills with snipers", icon: "Crosshair" },
  { id: "ch_surv_kills_30", metric: "survival_kills", goal: 30, rewardXp: 450, rewardCredits: 375, title: "Last Stand", description: "Get 30 kills in Survival", icon: "Skull" },
  { id: "ch_surv_waves_5", metric: "survival_waves", goal: 5, rewardXp: 550, rewardCredits: 450, title: "Holdout", description: "Survive 5 waves in one run", icon: "Shield" },
  // ---- Task 18-c+d: new secondary / melee daily challenges ----
  { id: "ch_secondary_15", metric: "kills_with_secondary", goal: 15, rewardXp: 300, rewardCredits: 250, title: "Sidearm Slinger", description: "Get 15 kills with secondary weapons", icon: "Crosshair" },
  { id: "ch_melee_5", metric: "kills_with_melee", goal: 5, rewardXp: 400, rewardCredits: 350, title: "Blade Master", description: "Get 5 kills with melee weapons", icon: "Swords" },
];

// Deterministic daily rotation: 3 challenges per day, rotating through the pool.
export function dailyChallengeSet(date = new Date()): ChallengeDef[] {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86400000);
  const pool = DAILY_CHALLENGE_POOL;
  const n = pool.length;
  // 3 challenges with offset based on day
  const indices = [0, 1, 2].map((i) => (dayOfYear * 3 + i) % n);
  // de-dupe just in case pool < 3
  const unique = Array.from(new Set(indices));
  while (unique.length < 3) {
    for (let i = 0; i < n && unique.length < 3; i++) if (!unique.includes(i)) unique.push(i);
  }
  return unique.slice(0, 3).map((i) => pool[i]);
}

// ============================================================================
// WEEKLY CHALLENGES — 2 harder objectives rotating weekly (ISO week). Larger
// goals + bigger rewards than daily challenges. All players share the same
// weekly set, so it's a global "this week's challenge" for everyone.
// ============================================================================
export const WEEKLY_CHALLENGE_POOL: ChallengeDef[] = [
  { id: "wk_tags_50", metric: "kill_confirmations", goal: 50, rewardXp: 1800, rewardCredits: 1200, title: "Evidence Locker", description: "Collect 50 enemy dog tags across Kill Confirmed matches", icon: "Shield", category: "weekly" },
  // Task 18-c+d: same boost as daily — rewardCredits ×2.5 (nearest 25),
  // rewardXp ×1.5 (nearest 50). The two new secondary/melee weeklies are
  // authored at the already-boosted values directly.
  { id: "wk_kills_200", metric: "kills", goal: 200, rewardXp: 2250, rewardCredits: 1875, title: "Slayer", description: "Get 200 kills this week", icon: "Crosshair", category: "weekly" },
  { id: "wk_hs_50", metric: "headshots", goal: 50, rewardXp: 1800, rewardCredits: 1500, title: "Marksman Elite", description: "Land 50 headshots this week", icon: "Target", category: "weekly" },
  { id: "wk_wins_10", metric: "wins", goal: 10, rewardXp: 2700, rewardCredits: 2250, title: "Champion", description: "Win 10 matches this week", icon: "Trophy", category: "weekly" },
  { id: "wk_multi_30", metric: "multikills", goal: 30, rewardXp: 1500, rewardCredits: 1250, title: "Spree Master", description: "Achieve 30 multi-kills this week", icon: "Zap", category: "weekly" },
  { id: "wk_surv_kills_100", metric: "survival_kills", goal: 100, rewardXp: 1500, rewardCredits: 1250, title: "Last Stand Veteran", description: "Get 100 kills in Survival this week", icon: "Skull", category: "weekly" },
  { id: "wk_gungame_30", metric: "gungame_kills", goal: 30, rewardXp: 1800, rewardCredits: 1500, title: "Gun Game Pro", description: "Get 30 kills in Gun Game this week", icon: "Swords", category: "weekly" },
  // ---- Task 18-c+d: new secondary / melee weekly challenges ----
  { id: "wk_secondary_50", metric: "kills_with_secondary", goal: 50, rewardXp: 1500, rewardCredits: 1500, title: "Pistolero", description: "Get 50 kills with secondary weapons this week", icon: "Crosshair", category: "weekly" },
  { id: "wk_melee_15", metric: "kills_with_melee", goal: 15, rewardXp: 1800, rewardCredits: 1750, title: "Edgewalker", description: "Get 15 kills with melee weapons this week", icon: "Swords", category: "weekly" },
];

// Deterministic weekly rotation: 2 challenges per ISO week, picked from the
// pool using the week number so every player sees the same pair that week.
export function weeklyChallengeSet(date = new Date()): ChallengeDef[] {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86400000);
  // ISO-ish week number: floor((dayOfYear + 6) / 7). 1-based.
  const week = Math.floor((dayOfYear + 6) / 7);
  const pool = WEEKLY_CHALLENGE_POOL;
  const n = pool.length;
  const indices = [0, 1].map((i) => (week * 2 + i) % n);
  const unique = Array.from(new Set(indices));
  while (unique.length < 2) {
    for (let i = 0; i < n && unique.length < 2; i++) if (!unique.includes(i)) unique.push(i);
  }
  return unique.slice(0, 2).map((i) => pool[i]);
}

// Stable week key (YYYY-Www) used as the "period key" for weekly challenge
// progress rows in the DB. Same string for all players in the same week.
export function weeklyChallengeKey(date = new Date()): string {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86400000);
  const week = Math.floor((dayOfYear + 6) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ============================================================================
// ELITE PROMOTION (17-C) — daily/weekly challenges can be "promoted" to an
// Elite variant per-player per-period. An elite variant has 3x the goal and
// 3x the reward (XP + credits). Promotion chance is deterministic per
// (playerKey, periodKey, challengeId) so the same player sees the same elite
// quests on reload within the same period. The elite id is suffixed `_elite`
// so its DB row (keyed by challengeId+dayKey) doesn't collide with the base.
// ============================================================================
export const DAILY_ELITE_CHANCE = 0.15;
export const WEEKLY_ELITE_CHANCE = 0.25;
export const ELITE_GOAL_MULTIPLIER = 3;
export const ELITE_REWARD_MULTIPLIER = 3;

// Stable 0..1 hash from an arbitrary string (FNV-1a 32-bit, normalized).
// Deterministic — same input always returns same output. Used to decide
// elite promotion per (playerKey, periodKey, challengeId).
export function hashToUnitInterval(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // unsigned 32-bit normalize to [0, 1)
  return (h >>> 0) / 0x100000000;
}

// Returns true if a (playerKey, periodKey, challengeId) combination should be
// promoted to elite. Deterministic.
export function shouldPromoteToElite(
  playerKey: string,
  periodKey: string,
  challengeId: string,
  threshold: number,
): boolean {
  return hashToUnitInterval(`${playerKey}|${periodKey}|${challengeId}`) < threshold;
}

// Build an elite-promoted copy of a ChallengeDef. The base challenge's id is
// suffixed with `_elite` to ensure DB uniqueness, and the goal + rewards are
// scaled by ELITE_GOAL_MULTIPLIER / ELITE_REWARD_MULTIPLIER. The category is
// preserved (daily/weekly) — elite is just a flag on top.
export function promoteChallengeToElite(base: ChallengeDef): ChallengeDef {
  return {
    ...base,
    id: `${base.id}_elite`,
    goal: base.goal * ELITE_GOAL_MULTIPLIER,
    rewardXp: base.rewardXp * ELITE_REWARD_MULTIPLIER,
    rewardCredits: base.rewardCredits * ELITE_REWARD_MULTIPLIER,
    // Title/description get an "Elite" prefix so the UI can show it distinctly
    // even without reading the separate isElite flag.
    title: `Elite ${base.title}`,
    description: `ELITE — ${base.description} (3× goal, 3× reward)`,
  };
}

// ============================================================================
// ELITE QUESTS (LEGACY) — LIFETIME accomplishments.
// DEPRECATED (17-C): Elite Quests are no longer a separate lifetime list.
// Instead, daily/weekly challenges can be promoted to elite variants per
// (playerKey, periodKey, challengeId) — see DAILY_ELITE_CHANCE etc. above.
// This array is kept only for backward-compat with old DB rows that still
// exist with type="elite" / dayKey="elite" from prior migrations. It is no
// longer used by getEliteQuestsView / applyMatchResult (which now handle
// only daily/weekly + their elite variants).
// ============================================================================
export const ELITE_QUESTS: ChallengeDef[] = [
  { id: "elite_kills_1000", metric: "kills", goal: 1000, rewardXp: 5000, rewardCredits: 2500, title: "Reaper Elite", description: "Get 1000 kills — lifetime", icon: "Crosshair", category: "elite" },
  { id: "elite_wins_50", metric: "wins", goal: 50, rewardXp: 6000, rewardCredits: 3000, title: "Tactician Supreme", description: "Win 50 matches — lifetime", icon: "Trophy", category: "elite" },
  { id: "elite_surv_waves_20", metric: "survival_waves", goal: 20, rewardXp: 7500, rewardCredits: 3500, title: "Untouchable", description: "Survive 20 waves in a single Survival run", icon: "Shield", category: "elite" },
  { id: "elite_hs_500", metric: "headshots", goal: 500, rewardXp: 8000, rewardCredits: 4000, title: "Headhunter Prime", description: "Land 500 headshots — lifetime", icon: "Target", category: "elite" },
  { id: "elite_level_25", metric: "level", goal: 25, rewardXp: 10000, rewardCredits: 5000, title: "Vanguard Legend", description: "Reach level 25", icon: "TrendingUp", category: "elite" },
];

// ============================================================================
// ACHIEVEMENTS — one-time lifetime accomplishments.
// ============================================================================
export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  // The metric checked against player lifetime stats
  metric:
    | "kills"
    | "headshots"
    | "wins"
    | "matches"
    | "level"
    | "credits_earned_total"
    | "survival_waves"
    | "survival_default_wins"
    | "survival_hard_waves"
    | "survival_elite_waves"
    | "survival_nightmare_waves"
    // 17-C: quest-completion lifetime counters (Player model columns)
    | "daily_challenges_completed"
    | "weekly_challenges_completed"
    | "elite_challenges_completed"
    | "total_challenges_completed"
    // 19a+19b: Lifetime best kill streak (Player.bestKillstreak). Distinct
    // from the "multikills" ChallengeMetric which counts the NUMBER of
    // double-kill-or-better streaks; this tracks the highest streak length
    // achieved across all matches. Drives the Triple Threat / Killstreak King /
    // Untouchable Force tiered achievements.
    | "best_killstreak";
  goal: number;
  tier: "bronze" | "silver" | "gold" | "platinum";
  rewardXp: number;
  rewardCredits: number;
  // PvP = earned in FFA/TDM; PvE = earned in Survival. General milestones
  // (level, matches played, quest completion) default to "pvp".
  category: "pvp" | "pve";
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_blood", title: "First Blood", description: "Get your first kill", icon: "Droplet", metric: "kills", goal: 1, tier: "bronze", rewardXp: 50, rewardCredits: 25, category: "pvp" },
  { id: "kills_100", title: "Centurion", description: "Get 100 kills", icon: "Crosshair", metric: "kills", goal: 100, tier: "bronze", rewardXp: 200, rewardCredits: 100, category: "pvp" },
  { id: "kills_500", title: "Bloodbath", description: "Get 500 kills", icon: "Crosshair", metric: "kills", goal: 500, tier: "silver", rewardXp: 500, rewardCredits: 250, category: "pvp" },
  { id: "kills_2000", title: "Reaper", description: "Get 2000 kills", icon: "Crosshair", metric: "kills", goal: 2000, tier: "gold", rewardXp: 1500, rewardCredits: 750, category: "pvp" },
  { id: "hs_50", title: "Headsplitter", description: "Land 50 headshots", icon: "Target", metric: "headshots", goal: 50, tier: "bronze", rewardXp: 200, rewardCredits: 100, category: "pvp" },
  { id: "hs_250", title: "Sharpshooter", description: "Land 250 headshots", icon: "Target", metric: "headshots", goal: 250, tier: "silver", rewardXp: 600, rewardCredits: 300, category: "pvp" },
  { id: "win_10", title: "Tactician", description: "Win 10 matches", icon: "Trophy", metric: "wins", goal: 10, tier: "bronze", rewardXp: 250, rewardCredits: 125, category: "pvp" },
  { id: "win_50", title: "Champion", description: "Win 50 matches", icon: "Trophy", metric: "wins", goal: 50, tier: "silver", rewardXp: 750, rewardCredits: 375, category: "pvp" },
  { id: "win_200", title: "Conqueror", description: "Win 200 matches", icon: "Crown", metric: "wins", goal: 200, tier: "gold", rewardXp: 2000, rewardCredits: 1000, category: "pvp" },
  { id: "play_25", title: "Veteran", description: "Play 25 matches", icon: "Swords", metric: "matches", goal: 25, tier: "bronze", rewardXp: 200, rewardCredits: 100, category: "pvp" },
  { id: "play_100", title: "Dedicated", description: "Play 100 matches", icon: "Swords", metric: "matches", goal: 100, tier: "silver", rewardXp: 600, rewardCredits: 300, category: "pvp" },
  { id: "level_10", title: "Promoted", description: "Reach level 10", icon: "TrendingUp", metric: "level", goal: 10, tier: "bronze", rewardXp: 300, rewardCredits: 150, category: "pvp" },
  { id: "level_20", title: "Officer", description: "Reach level 20", icon: "TrendingUp", metric: "level", goal: 20, tier: "silver", rewardXp: 800, rewardCredits: 400, category: "pvp" },
  { id: "level_30", title: "Vanguard Elite", description: "Reach level 30", icon: "TrendingUp", metric: "level", goal: 30, tier: "platinum", rewardXp: 3000, rewardCredits: 1500, category: "pvp" },
  { id: "surv_5", title: "Survivor", description: "Survive 5 waves in a single Survival run", icon: "Shield", metric: "survival_waves", goal: 5, tier: "bronze", rewardXp: 250, rewardCredits: 125, category: "pve" },
  { id: "surv_10", title: "Last Bastion", description: "Survive 10 waves in a single Survival run", icon: "Shield", metric: "survival_waves", goal: 10, tier: "silver", rewardXp: 700, rewardCredits: 350, category: "pve" },
  { id: "surv_20", title: "Untouchable", description: "Survive 20 waves in a single Survival run", icon: "Crown", metric: "survival_waves", goal: 20, tier: "gold", rewardXp: 2000, rewardCredits: 1000, category: "pve" },
  { id: "surv_default_victory", title: "Hold the Line", description: "Clear all 30 Standard Survival waves", icon: "Trophy", metric: "survival_default_wins", goal: 1, tier: "gold", rewardXp: 2500, rewardCredits: 1250, category: "pve" },
  { id: "surv_hard_10", title: "Against the Odds", description: "Clear 10 Hard Survival waves", icon: "Shield", metric: "survival_hard_waves", goal: 10, tier: "silver", rewardXp: 750, rewardCredits: 400, category: "pve" },
  { id: "surv_hard_20", title: "Unbreakable", description: "Reach 20 completed waves on Hard and unlock Elite", icon: "Crown", metric: "survival_hard_waves", goal: 20, tier: "gold", rewardXp: 2000, rewardCredits: 1000, category: "pve" },
  { id: "surv_elite_boss", title: "Boss Slayer", description: "Defeat Elite's wave-10 boss", icon: "Swords", metric: "survival_elite_waves", goal: 10, tier: "silver", rewardXp: 1200, rewardCredits: 600, category: "pve" },
  { id: "surv_elite_20", title: "Elite Vanguard", description: "Clear 20 Elite waves and unlock Nightmare", icon: "Crown", metric: "survival_elite_waves", goal: 20, tier: "platinum", rewardXp: 3500, rewardCredits: 1800, category: "pve" },
  { id: "surv_nightmare_10", title: "Night Terror", description: "Defeat Nightmare's wave-10 boss", icon: "Flame", metric: "survival_nightmare_waves", goal: 10, tier: "gold", rewardXp: 2000, rewardCredits: 1100, category: "pve" },
  { id: "surv_nightmare_20", title: "Beyond the Abyss", description: "Clear 20 Nightmare waves", icon: "Crown", metric: "survival_nightmare_waves", goal: 20, tier: "platinum", rewardXp: 6000, rewardCredits: 3000, category: "pve" },
  // ---- 17-C: Quest-completion milestones (lifetime counters on Player) ----
  { id: "quest_daily_10", title: "Daily Devotee", description: "Complete 10 daily challenges", icon: "Calendar", metric: "daily_challenges_completed", goal: 10, tier: "bronze", rewardXp: 300, rewardCredits: 150, category: "pvp" },
  { id: "quest_weekly_5", title: "Weekly Warrior", description: "Complete 5 weekly challenges", icon: "Star", metric: "weekly_challenges_completed", goal: 5, tier: "silver", rewardXp: 800, rewardCredits: 400, category: "pvp" },
  { id: "quest_elite_3", title: "Elite Hunter", description: "Complete 3 elite quests", icon: "Sparkles", metric: "elite_challenges_completed", goal: 3, tier: "gold", rewardXp: 2000, rewardCredits: 1000, category: "pvp" },
  { id: "quest_total_50", title: "Quest Master", description: "Complete 50 total challenges (any type)", icon: "Crown", metric: "total_challenges_completed", goal: 50, tier: "platinum", rewardXp: 5000, rewardCredits: 2500, category: "pvp" },
  // ---- 19a+19b: Tiered kill-streak milestones (Player.bestKillstreak) ----
  // Tracks the lifetime HIGHEST kill streak (kills within the 5s streak
  // window). Distinct from the "multikills" challenge metric which counts the
  // NUMBER of double-kill-or-better streaks; this measures streak LENGTH.
  { id: "streak_3", title: "Triple Threat", description: "Achieve a 3-kill streak", icon: "Flame", metric: "best_killstreak", goal: 3, tier: "bronze", rewardXp: 100, rewardCredits: 50, category: "pvp" },
  { id: "streak_5", title: "Killstreak King", description: "Achieve a 5-kill streak", icon: "Flame", metric: "best_killstreak", goal: 5, tier: "silver", rewardXp: 300, rewardCredits: 150, category: "pvp" },
  { id: "streak_10", title: "Untouchable Force", description: "Achieve a 10-kill streak", icon: "Crown", metric: "best_killstreak", goal: 10, tier: "gold", rewardXp: 1000, rewardCredits: 500, category: "pvp" },
];

export const ACHIEVEMENT_TIER_COLORS: Record<string, string> = {
  bronze: "#cd7f32",
  silver: "#c0c0c0",
  gold: "#ffd700",
  platinum: "#e5e4e2",
};

// ============================================================================
// MATCH SETTINGS — configurable per-match options.
// ============================================================================
export interface MatchModeConfig {
  id: "ffa" | "tdm" | "survival" | "gungame" | "killconfirmed";
  label: string;
  description: string;
  icon: string;
  defaultScoreLimit: number;
  scoreOptions: number[];
  defaultTimeLimit: number; // minutes
  timeOptions: number[];
  teamBased: boolean;
  accentColor: string;
}

export const MATCH_MODES: Record<string, MatchModeConfig> = {
  ffa: {
    id: "ffa",
    label: "Free-For-All",
    description: "Everyone vs everyone. First to the kill limit wins.",
    icon: "Users",
    defaultScoreLimit: 30,
    scoreOptions: [15, 30, 50],
    defaultTimeLimit: 8,
    timeOptions: [5, 8, 12],
    teamBased: false,
    accentColor: "#f43f5e",
  },
  tdm: {
    id: "tdm",
    label: "Team Deathmatch",
    description: "Red vs Blue. First team to the kill limit wins.",
    icon: "Shield",
    defaultScoreLimit: 60,
    scoreOptions: [40, 60, 100],
    defaultTimeLimit: 10,
    timeOptions: [8, 10, 15],
    teamBased: true,
    accentColor: "#3b82f6",
  },
  killconfirmed: {
    id: "killconfirmed",
    label: "Kill Confirmed",
    description: "Recover enemy dogtags to score. Collect allied tags to deny points.",
    icon: "Tags",
    defaultScoreLimit: 40,
    scoreOptions: [25, 40, 60, 75],
    defaultTimeLimit: 10,
    timeOptions: [5, 8, 10, 15],
    teamBased: true,
    accentColor: "#22d3ee",
  },
  survival: {
    id: "survival",
    label: "Survival",
    description: "Clear 30 waves on Standard, then unlock Hard, Elite and Nightmare endless tiers.",
    icon: "Skull",
    defaultScoreLimit: 0,   // no kill limit — endless
    scoreOptions: [0],
    defaultTimeLimit: 0,    // no time limit
    timeOptions: [0],
    teamBased: true,        // all players on same team
    accentColor: "#f59e0b",
  },
  gungame: {
    id: "gungame",
    label: "Gun Game",
    description: "Cycle through weapons with each kill. First to the final weapon wins.",
    icon: "Swords",
    // Must match GUN_GAME_TYPE_PROGRESSION.length (30 in game-protocol.ts).
    // The server sets room.config.scoreLimit = room.gungameWeapons.length on
    // match start, so this value is only used for the Play screen summary preview.
    defaultScoreLimit: 30,
    scoreOptions: [30],
    defaultTimeLimit: 0,
    timeOptions: [0],
    teamBased: false,
    accentColor: "#a855f7",
  },
};

// ============================================================================
// KILLSTREAK CALLOUTS — used by the HUD for multi-kill announcements.
// ============================================================================
export interface KillstreakCallout {
  threshold: number;   // kills within the streak window (3s)
  label: string;
  color: string;
  icon: string;
}

export const KILLSTREAK_CALLOUTS: KillstreakCallout[] = [
  { threshold: 2, label: "DOUBLE KILL", color: "#22c55e", icon: "x2" },
  { threshold: 3, label: "TRIPLE KILL", color: "#06b6d4", icon: "x3" },
  { threshold: 4, label: "OVERKILL", color: "#a855f7", icon: "x4" },
  { threshold: 5, label: "KILLTACULAR", color: "#f59e0b", icon: "x5" },
  { threshold: 6, label: "KILLTASTROPHE", color: "#ef4444", icon: "x6" },
  { threshold: 8, label: "UNSTOPPABLE", color: "#ec4899", icon: "∞" },
];
