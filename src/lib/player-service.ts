import { calculateMatchRewards } from "./match-rewards";
import { ORBITAL_REAPER_ID } from "./orbital-reactor";
import { careerXpAfterMatch, CAREER_TITLES } from "./career";
import { careerContractsView, recordCareerMatch } from "./career-contract-service";
import { xpProgressInLevel } from "./progression";
// Player progression service — shared helpers used by API routes
import { db } from "@/lib/db";
import { unlockedAchievementTitles, masteryAchievementStats } from "./achievement-titles";
import { collectorProgress, collectorSkinEntitlements } from "./collector";
import { cosmeticShopOwnership, parseEquippedCharms, cosmeticById } from "./cosmetics";
import { prestigeEligible, tokenEligiblePrestiges, PRESTIGE_CAMO_IDS } from "./weapon-prestige";
import { calculateWonderWallet } from "./wonder-economy";
import { parseWeaponSetups } from "./weapon-setups";
import { wonderFinishById, wonderKillEffectById, validWonderModule } from "./wonder-expansion";
import { PERKS } from "./perks";
import { normalizeSurvivalTier, survivalRecordMode, type SurvivalTier, type SurvivalProgress } from "./survival";
import { sanitizeOwnedAttachments } from "./loadout-security";
import { parseSavedLoadouts, type SavedLoadout } from "./saved-loadouts";
import { OPERATOR_CONTRACTS, armoryChallengeProgress, allSkinChallengesForWeapon, weaponChallengeProgress, weaponMasteryProgress, parseWeaponConditionStats, emptyWeaponConditionStats, type WeaponConditionStats, type ArmoryChallengeView } from "./armory-challenges";
import {
  WEAPONS,
  ATTACHMENTS,
  WEAPON_SKINS,
  PLAYER_SKINS,
  levelForXp,
  REWARDS,
  type ResolvedLoadout,
  resolveLoadout,
  ACHIEVEMENTS,
  dailyChallengeSet,
  weeklyChallengeSet,
  weeklyChallengeKey,
  ELITE_QUESTS,
  DAILY_ELITE_CHANCE,
  WEEKLY_ELITE_CHANCE,
  shouldPromoteToElite,
  canPromoteChallengeToElite,
  promoteChallengeToElite,
  nextChallengeProgress,
  type ChallengeMetric,
  type ChallengeDef,
  type WeaponChallengeMetric,
  WEAPON_CHALLENGES,
  weaponById,
  weaponSlot,
  SKIN_WILDCARD_WEAPON_ID,
} from "@/lib/game-data";

export interface MatchResultInput {
  playerKey: string;
  kills: number;
  deaths: number;
  headshots: number;
  assists?: number;
  won: boolean;
  mode: "ffa" | "tdm" | "survival" | "gungame" | "killconfirmed" | "ctf";
  score: number;
  // Personal Kill Confirmed objective stats (separate from kills).
  confirmations?: number;
  denials?: number;
  online?: boolean;
  durationSec?: number;
  /** True when the round finishes naturally, false for early exit. */
  completed?: boolean;
  placement?: number;
  weaponId?: string;
  multikills?: number;       // number of double-kill or better streaks achieved in this match
  survivalWaves?: number;    // completed waves, not merely the wave spawned
  survivalTier?: SurvivalTier;
  // 19a+19b: Highest kill streak achieved in this match (kills within the 5s
  // streak window). The engine tracks this in registerPlayerKill (updating
  // bestStreak whenever the current streak exceeds it) and forwards it in
  // MatchEndResult. applyMatchResult updates the player's lifetime bestKillstreak
  // (Player model column) which drives the Triple Threat / Killstreak King /
  // Untouchable Force tiered achievements.
  bestStreak?: number;
  maxNoDeathStreak?: number;
  defenseKills?: number;
  flagReturns?: number;
  maxScoreDeficit?: number;
  participants?: number;
  // Per-kill difficulty breakdown (one entry per kill). Values: "easy"|"normal"|"hard"|"veteran"|"enemy_player".
  // Used to scale XP/credits by victim difficulty. Optional — legacy callers omit it.
  killDifficulties?: string[];
  // Per-weapon kill/headshot tallies for the match. Used by Gun Game (where the
  // player cycles through all weapons in GUN_GAME_PROGRESSION) to attribute kills
  // to the weapon actually used for each kill — instead of attributing all kills
  // to `weaponId` (the match-start weapon). The challenge-check block reads this
  // map to evaluate per-weapon skin challenges for EVERY weapon that got kills.
  // Optional — non-gungame callers omit it (kills default to `weaponId`).
  perWeaponKills?: Record<string, { kills: number; headshots: number }>;
  perWeaponActions?: Record<string, Partial<WeaponConditionStats>>;
}

/** Older hosted SQLite files predate the dedicated Wonder slot.
 * Add this single, non-destructive column before Prisma selects Loadout rows.
 * A shared promise ensures concurrent auth/profile requests never race ALTER TABLE.
 * No owned weapons, named presets or progression rows are dropped here.
 */
let wonderSlotSchemaReady:Promise<void>|null=null;
export function ensureWonderSlotColumn():Promise<void>{
  if(!wonderSlotSchemaReady){
    wonderSlotSchemaReady=(async()=>{
      const columns=await db.$queryRawUnsafe<Array<{name:string}>>('PRAGMA table_info("Loadout")');
      if(columns.length && !columns.some(column=>column.name==="wonderWeaponId")){
        await db.$executeRawUnsafe('ALTER TABLE "Loadout" ADD COLUMN "wonderWeaponId" TEXT NOT NULL DEFAULT \'\'');
      }
    })().catch(error=>{wonderSlotSchemaReady=null;throw error});
  }
  return wonderSlotSchemaReady;
}

export async function getOrCreatePlayer(playerKey: string, name?: string) {
  await ensureWonderSlotColumn();
  let player = await db.player.findUnique({
    where: { playerKey },
    include: {
      weaponUnlocks: true,
      skinUnlocks: true,
      attachmentUnlocks: true,
      playerSkinUnlocks: true,
      loadout: true,
      achievements: true,
    },
  });
  if (!player) {
    // Race-condition-safe create: if another concurrent request inserted this
    // playerKey between our findUnique and create, Prisma throws P2002. Catch
    // it and re-fetch. This is critical for /api/challenges which calls
    // getOrCreatePlayer via 3 parallel view functions (daily/weekly/elite).
    try {
      player = await db.player.create({
        data: {
          playerKey,
          name: name && name.trim() ? name.trim().slice(0, 20) : "Recruit",
        },
        include: {
          weaponUnlocks: true,
          skinUnlocks: true,
          attachmentUnlocks: true,
          playerSkinUnlocks: true,
          loadout: true,
          achievements: true,
        },
      });
    } catch (e: any) {
      if (e?.code === "P2002") {
        // Another concurrent request inserted this player — re-fetch.
        player = await db.player.findUnique({
          where: { playerKey },
          include: {
            weaponUnlocks: true,
            skinUnlocks: true,
            attachmentUnlocks: true,
            playerSkinUnlocks: true,
            loadout: true,
            achievements: true,
          },
        });
      } else {
        throw e;
      }
    }
  }
  // Upgrade a legacy equipped primary Wonder to the independent fourth slot.
  if(player?.loadout?.primaryWeapon.startsWith("wonder_")){
    const existing=player.loadout;
    const upgraded={primaryWeapon:"rifle_ar",wonderWeaponId:existing.primaryWeapon,
      perkId:"wonder_weapon",weaponSkin:"default",attachments:"{}"};
    await db.loadout.update({where:{playerId:player.id},data:upgraded});
    player.loadout={...existing,...upgraded};
  }
  // Persistently discard legacy presets with a Wonder occupying primary.
  // Permanent Wonder unlock ownership is stored separately and never deleted.
  if(player?.loadout){
    const clean=JSON.stringify(parseSavedLoadouts(player.loadout.savedLoadouts));
    if(clean!==player.loadout.savedLoadouts){
      await db.loadout.update({where:{playerId:player.id},data:{savedLoadouts:clean}});
      player.loadout={...player.loadout,savedLoadouts:clean};
    }
  }
  // At this point `player` is non-null in practice — either it existed, we
  // just created it, or we re-fetched after a P2002 race. The non-null assertion
  // lets downstream code use `player.id` etc. without per-call null checks.
  return player!;
}

/** Finalize earned permanent Prestige awards without relying on client claims.
 * Each (player, weapon) row is unique; token balance derives from award rows.
 */
export async function grantWeaponPrestiges(playerId: string): Promise<string[]> {
  const [progress, skins, attachments, claimed] = await Promise.all([
    db.weaponProgress.findMany({ where: { playerId } }),
    db.skinUnlock.findMany({ where: { playerId } }),
    db.attachmentUnlock.findMany({ where: { playerId } }),
    db.weaponPrestige.findMany({ where: { playerId } }),
  ]);
  const byWeapon = new Map(progress.map(p => [p.weaponId, p]));
  const owned = new Map<string, Set<string>>();
  for (const s of skins) {
    if (s.weaponId === "*") continue; // wildcard is not proof of per-weapon mastery
    if (!owned.has(s.weaponId)) owned.set(s.weaponId, new Set());
    owned.get(s.weaponId)!.add(s.skinId);
  }
  const ownedAttachments = new Map<string, Set<string>>();
  for (const a of attachments) {
    if (!ownedAttachments.has(a.weaponId)) ownedAttachments.set(a.weaponId, new Set());
    ownedAttachments.get(a.weaponId)!.add(a.attachmentId);
  }
  const already = new Set(claimed.map(p => p.weaponId));
  const eligible = WEAPONS.filter(w => !w.wonder && !already.has(w.id)).filter(w => {
    const p = byWeapon.get(w.id);
    return prestigeEligible(w.id, {
      kills: p?.kills ?? 0, headshots: p?.headshots ?? 0,
      conditionStats: parseWeaponConditionStats(p?.conditionStats),
    }, owned.get(w.id), ownedAttachments.get(w.id));
  });
  if (!eligible.length) return [];
  const earned: string[] = [];
  await db.$transaction(async tx => {
    for (const weapon of eligible) {
      const key = { playerId, weaponId: weapon.id };
      // Atomic upsert respects the per-player/weapon unique constraint even if
      // profile and match-end requests reach this function concurrently.
      await tx.weaponPrestige.upsert({
        where: { playerId_weaponId: key }, create: { ...key, legacyReward: false }, update: {},
      });
      earned.push(weapon.id);
    }
  });
  return earned;
}

/** Persist a one-time entitlement when Prestige and Mastery 5 coincide.
 * Historical Wonder purchases prove past tokens were paid, even if mastery
 * requirements were raised afterward. Pair them with the oldest Prestige
 * awards that predate the last historic Wonder purchase. If that source is
 * unavailable, a one-time non-spendable compensation offsets the purchase.
 * The old purchase table does not link a Wonder to its source weapon.
 */
const wonderTokenReconciling=new Map<string,Promise<{awardedWeapons:string[];legacyCredits:number}>>();
export async function reconcileWonderTokenAwards(playerId:string):Promise<{
  awardedWeapons:string[];legacyCredits:number;
}> {
  const active=wonderTokenReconciling.get(playerId);
  if(active)return active;
  // SQLite's interactive transactions can time out under concurrent initial
  // profile reads. Use a singleflight per player; each award is protected by
  // a database unique key and persisted before the migration marker.
  const pending=(async()=>{
    const [player,prestiges,progress,purchases,prior]=await Promise.all([
      db.player.findUniqueOrThrow({where:{id:playerId},
        select:{wonderTokenLedgerReady:true,wonderLegacyCredits:true}}),
      db.weaponPrestige.findMany({where:{playerId},select:{weaponId:true,awardedAt:true}}),
      db.weaponProgress.findMany({where:{playerId},select:{weaponId:true,kills:true,headshots:true}}),
      db.wonderUnlock.findMany({where:{playerId},select:{weaponId:true,unlockedAt:true}}),
      db.wonderTokenAward.findMany({where:{playerId},select:{weaponId:true}}),
    ]);
    const totals=Object.fromEntries(progress.map(p=>[p.weaponId,{kills:p.kills,headshots:p.headshots}]));
    const qualified=tokenEligiblePrestiges(prestiges.map(p=>p.weaponId),totals);
    const latestPurchase=purchases.reduce((time,p)=>Math.max(time,p.unlockedAt.getTime()),0);
    const historical=player.wonderTokenLedgerReady?[]:
      prestiges.filter(p=>p.awardedAt.getTime()<=latestPurchase)
        .sort((a,b)=>a.awardedAt.getTime()-b.awardedAt.getTime()||
          a.weaponId.localeCompare(b.weaponId))
        .slice(0,purchases.length).map(p=>p.weaponId);
    const legacyCredits=player.wonderTokenLedgerReady?player.wonderLegacyCredits:
      Math.max(0,purchases.length-historical.length);
    const awarded=new Set(prior.map(a=>a.weaponId));
    for(const weaponId of new Set([...historical,...qualified])){
      if(awarded.has(weaponId))continue;
      await db.wonderTokenAward.upsert({
        where:{playerId_weaponId:{playerId,weaponId}},
        create:{playerId,weaponId,legacy:historical.includes(weaponId)},update:{},
      });
      awarded.add(weaponId);
    }
    if(!player.wonderTokenLedgerReady)await db.player.updateMany({
      where:{id:playerId,wonderTokenLedgerReady:false},
      data:{wonderTokenLedgerReady:true,wonderLegacyCredits:legacyCredits},
    });
    return {awardedWeapons:[...awarded],legacyCredits};
  })();
  wonderTokenReconciling.set(playerId,pending);
  try{return await pending;}finally{
    if(wonderTokenReconciling.get(playerId)===pending)wonderTokenReconciling.delete(playerId);
  }
}

/** Backfill mastery-title awards for existing weapon specialists.
 * Creating the achievement and credit/XP payout in one transaction ensures
 * reopening Profile never pays the same title twice. */
async function grantExistingMasteryTitles(playerId:string):Promise<boolean> {
  const rows=await db.weaponProgress.findMany({where:{playerId}});
  const values=masteryAchievementStats(rows);
  const existing=new Set((await db.playerAchievement.findMany({where:{playerId}})).map(a=>a.achievementId));
  let granted=false;
  for(const achievement of ACHIEVEMENTS.filter(a=>a.category==="mastery")) {
    if(existing.has(achievement.id) || (values[achievement.metric as keyof typeof values]??0)<achievement.goal) continue;
    try {
      await db.$transaction(async tx=>{
        await tx.playerAchievement.create({data:{playerId,achievementId:achievement.id}});
        await tx.player.update({where:{id:playerId},data:{
          xp:{increment:achievement.rewardXp},credits:{increment:achievement.rewardCredits},
        }});
      });
      granted=true;
    }catch(error){
      // Concurrent profile refresh may have inserted this same unique award.
      if((error as {code?:string})?.code!=="P2002")throw error;
    }
  }
  return granted;
}

/** Server-awarded collection milestones stay correct after Shop / Armory purchases.
 * Unique achievement rows guard against duplicate awards on concurrent refreshes. */
async function grantCollectorAchievements(playerId:string):Promise<void> {
  const p=await db.player.findUniqueOrThrow({where:{id:playerId},include:{
    weaponUnlocks:true,attachmentUnlocks:true,skinUnlocks:true,
    playerSkinUnlocks:true,achievements:true,weaponPrestiges:true,weaponProgress:true,
  }});
  const attachments:Record<string,string[]>={};
  for(const row of p.attachmentUnlocks)(attachments[row.weaponId]??=[]).push(row.attachmentId);
  const skins=collectorSkinEntitlements(p.skinUnlocks,p.weaponProgress,p.weaponPrestiges);
  const score=collectorProgress({
    level:levelForXp(p.xp),
    unlockedWeapons:p.weaponUnlocks.map(row=>row.weaponId),
    ownedAttachments:attachments,ownedWeaponSkins:skins,
    ownedOperators:["default",p.selectedSkin,...p.playerSkinUnlocks.map(row=>row.skinId)],
  });
  const earned=new Set(p.achievements.map(x=>x.achievementId));
  for(const ach of ACHIEVEMENTS.filter(a=>a.metric==="collection_percent"&&a.goal<=score.percent&&!earned.has(a.id))){
    try{
      await db.$transaction(async tx=>{
        await tx.playerAchievement.create({data:{playerId,achievementId:ach.id}});
        await tx.player.update({where:{id:playerId},data:{
          xp:{increment:ach.rewardXp},credits:{increment:ach.rewardCredits},
        }});
      });
    }catch(e){if((e as {code?:string})?.code!=="P2002")throw e;}
  }
}

export interface PlayerProfileView {
  playerKey: string;
  name: string;
  level: number;
  xp: number;
  credits: number;
  kills: number;
  deaths: number;
  matchesPlayed: number;
  matchesWon: number;
  survivalBestWave: number;
  kd: number;
  selectedSkin: string;
  selectedTitle: string;
  selectedNameplate: string;
  ownedCosmetics: string[];
  unlockedTitles: { id: string; title: string }[];
  xpProgress: { current: number; needed: number; level: number };
  unlocks: {
    weapons: string[];
    // Flat lists — preserved for backward-compat with the Profile collection grid.
    weaponSkins: string[];
    playerSkins: string[];
    attachments: string[];
    // Per-weapon unlock maps (new). Keyed by weaponId.
    // `attachmentsByWeapon[weaponId]` = attachment IDs unlocked for that weapon.
    // `skinsByWeapon[weaponId]` = skin IDs unlocked for that weapon (always
    //   includes "default" and any free-by-level baseline skins).
    attachmentsByWeapon: Record<string, string[]>;
    skinsByWeapon: Record<string, string[]>;
  };
  loadout: ResolvedLoadout;
  savedLoadouts: SavedLoadout[];
  // Lifetime per-weapon kill/headshot progress, keyed by weaponId. Source of
  // truth for weapon challenge progress (Breacher "Close Quarters", Longshot
  // "Marksman", etc.). In gungame the player cycles through many weapons per
  // match — MatchRecord.weaponId only stores the match-start weapon, so this
  // map (backed by the WeaponProgress table) is needed for accurate per-weapon
  // lifetime counts across all game modes.
  weaponProgress: Record<string, { kills: number; headshots: number; conditionStats: WeaponConditionStats }>;
  operatorContracts: ArmoryChallengeView[];
  career: Awaited<ReturnType<typeof careerContractsView>>;
  prestige: { tokens: number; masteredWeapons: string[]; tokenReadyWeapons: string[]; wonderWeapons: string[]; legacyCredits: number;
    wonderPurchases:string[]; wonderSetups:Record<string,{moduleId:string;skinId:string;killEffectId:string}> };
}

export async function buildProfileView(playerKey: string): Promise<PlayerProfileView | null> {
  const initial = await getOrCreatePlayer(playerKey);
  const granted = await grantExistingMasteryTitles(initial.id);
  const player = granted ? await getOrCreatePlayer(playerKey) : initial;
  if (!player) return null;
  await grantWeaponPrestiges(player.id);
  const wonderLedger=await reconcileWonderTokenAwards(player.id);
  await grantCollectorAchievements(player.id);
  const [prestigeRows, wonderRows] = await Promise.all([
    db.weaponPrestige.findMany({ where: { playerId: player.id } }),
    db.wonderUnlock.findMany({ where: { playerId: player.id } }),
  ]);
  const masteredWeapons = prestigeRows.map(p => p.weaponId);
  const legacyPrestigeWeapons = new Set(prestigeRows.filter(p => p.legacyReward).map(p => p.weaponId));
  const wonderWeapons = wonderRows.map(w => w.weaponId);
  if (!player.loadout) {
    // The first menu/tutorial can request the profile concurrently. A single
    // upsert prevents those fresh-player requests racing to create the kit.
    await db.loadout.upsert({ where: { playerId: player.id }, create: { playerId: player.id }, update: {} });
  }
  const fresh = await db.player.findUnique({
        where: { playerKey },
        include: { weaponUnlocks: true, skinUnlocks: true, attachmentUnlocks: true,
          playerSkinUnlocks: true, loadout: true, achievements: true },
      });
  const p = fresh!;
  // Migrate existing account-wide reticles and per-weapon charms once into
  // equipped loadout slots. Subsequent choices belong solely to each loadout.
  if(p.loadout && !p.loadout.cosmeticsMigrated){
    const old=parseEquippedCharms(p.equippedCharms);
    const migration={primaryReticle:cosmeticById(p.selectedReticle,"reticle")?p.selectedReticle:"classic",
      secondaryReticle:cosmeticById(p.selectedReticle,"reticle")?p.selectedReticle:"classic",
      primaryCharm:old[p.loadout.primaryWeapon]??"none",secondaryCharm:old[p.loadout.secondaryWeapon]??"none",cosmeticsMigrated:true};
    const updated=await db.loadout.updateMany({where:{playerId:p.id,cosmeticsMigrated:false},data:migration});
    Object.assign(p.loadout,updated.count?migration:await db.loadout.findUniqueOrThrow({where:{playerId:p.id}}));
  }
  const level = levelForXp(p.xp);
  // Use the shared XP-curve helpers so this stays in sync with game-data.ts.
  // Repair legacy cached levels without trusting them for entitlement checks.
  if (p.level !== level) await db.player.updateMany({
    where: { id: p.id, xp: p.xp }, data: { level },
  });

  // Build per-weapon unlock maps from the (now weaponId-bearing) DB rows.
  const attachmentsByWeapon: Record<string, string[]> = {};
  const skinsByWeapon: Record<string, string[]> = {};
  for (const u of p.attachmentUnlocks) {
    if (!attachmentsByWeapon[u.weaponId]) attachmentsByWeapon[u.weaponId] = [];
    if (!attachmentsByWeapon[u.weaponId].includes(u.attachmentId)) attachmentsByWeapon[u.weaponId].push(u.attachmentId);
  }
  for (const u of p.skinUnlocks) {
    if (u.weaponId === SKIN_WILDCARD_WEAPON_ID) continue; // legacy global grants need challenge verification
    if (!skinsByWeapon[u.weaponId]) skinsByWeapon[u.weaponId] = [];
    if (!skinsByWeapon[u.weaponId].includes(u.skinId)) skinsByWeapon[u.weaponId].push(u.skinId);
  }
  // Default skin is always available; all other skins require per-weapon challenges.
  // Migrate *effective* legacy wildcard grants safely: only offer the skin
  // for a specific weapon if that weapon actually meets its challenge goal.
  // Older versions wrote weaponId="*" even though each challenge is per-weapon.
  const historicProgress=await db.weaponProgress.findMany({where:{playerId:p.id}});
  const historicById=new Map(historicProgress.map(row=>[row.weaponId,row]));
  const legacyGlobal=new Set(p.skinUnlocks.filter(u=>u.weaponId===SKIN_WILDCARD_WEAPON_ID).map(u=>u.skinId));
  for(const w of WEAPONS){
    if(!skinsByWeapon[w.id])skinsByWeapon[w.id]=[];
    if(!skinsByWeapon[w.id].includes("default"))skinsByWeapon[w.id].push("default");
    // Viridian Blight comes from Prestige, Eventide from Mastery 5/5.
    // Awards earned before the split explicitly retain BOTH historical skins.
    const mastered = historicById.get(w.id);
    const rank5 = weaponMasteryProgress(mastered?.kills ?? 0, mastered?.headshots ?? 0, w.id).rank === 5;
    if (masteredWeapons.includes(w.id) && !skinsByWeapon[w.id].includes("prestige_toxic")) skinsByWeapon[w.id].push("prestige_toxic");
    if ((rank5 || legacyPrestigeWeapons.has(w.id)) && !skinsByWeapon[w.id].includes("prestige_cosmic")) skinsByWeapon[w.id].push("prestige_cosmic");
    for(const ch of WEAPON_CHALLENGES){
      if(ch.weaponId!==w.id || !legacyGlobal.has(ch.skinId))continue;
      const row=historicById.get(w.id);
      const progress=ch.metric==="kills"?(row?.kills??0):(row?.headshots??0);
      if(progress>=ch.goal && !skinsByWeapon[w.id].includes(ch.skinId))skinsByWeapon[w.id].push(ch.skinId);
    }
  }

  // Flat lists (for legacy Profile collection grid): unique attachment/skin IDs
  // unlocked for ANY weapon.
  const flatAttachments = Array.from(new Set(p.attachmentUnlocks.map((u) => u.attachmentId)));
  const flatSkins = Array.from(new Set(Object.values(skinsByWeapon).flat().filter(id=>id!=="default")));

  // Resolve loadout, validating the equipped skin is unlocked for the equipped primary.
  const primaryId = p.loadout?.primaryWeapon ?? "rifle_ar";
  const secondaryId = p.loadout?.secondaryWeapon ?? "pistol_side";
  const meleeId = p.loadout?.meleeWeapon ?? "knife_tactical";
  const unlockedSkinsForWeapon = skinsByWeapon[primaryId] ?? ["default"];
  const unlockedSkinsForSecondary = skinsByWeapon[secondaryId] ?? ["default"];
  const unlockedSkinsForMelee = skinsByWeapon[meleeId] ?? ["default"];
  const loadout = resolveLoadout({
    perkId: p.loadout?.perkId ?? "battle_hardened",
    wonderWeaponId: p.loadout?.wonderWeaponId ?? "",
    primaryWeapon: primaryId,
    secondaryWeapon: secondaryId,
    meleeWeapon: meleeId,
    equipmentId: p.loadout?.equipmentId ?? "frag",
    level,
    weaponSkin: p.loadout?.weaponSkin ?? "default",
    secondaryWeaponSkin: p.loadout?.secondaryWeaponSkin ?? "default",
    meleeWeaponSkin: p.loadout?.meleeWeaponSkin ?? "default",
    playerSkin: p.loadout?.playerSkin ?? p.selectedSkin ?? "default",
    primaryReticle:p.loadout?.primaryReticle,secondaryReticle:p.loadout?.secondaryReticle,
    primaryCharm:p.loadout?.primaryCharm,secondaryCharm:p.loadout?.secondaryCharm,
    // Attachments, including poison bolts, only resolve if purchased for the
    // exact equipped weapon. Also discard incompatible legacy selections.
    attachments: sanitizeOwnedAttachments(primaryId, p.loadout?.attachments ?? "{}", attachmentsByWeapon[primaryId]),
    secondaryAttachments: sanitizeOwnedAttachments(secondaryId, p.loadout?.secondaryAttachments ?? "{}", attachmentsByWeapon[secondaryId]),
    meleeAttachments: sanitizeOwnedAttachments(meleeId, p.loadout?.meleeAttachments ?? "{}", attachmentsByWeapon[meleeId]),
    unlockedSkinsForWeapon,
    unlockedSkinsForSecondary,
    unlockedSkinsForMelee,
  });
  // Lifetime per-weapon kill/headshot progress for the profile view. Used by
  // the Armory to surface challenge progress bars (e.g. "Breacher: 47/50 kills").
  // Source: WeaponProgress table (updated on every match completion).
  const wpRows = historicProgress;
  const weaponProgress: Record<string, { kills: number; headshots: number; conditionStats: WeaponConditionStats }> = {};
  const totalHeadshots = wpRows.reduce((sum, row) => sum + row.headshots, 0);
  const operatorContracts = OPERATOR_CONTRACTS.map(ch => armoryChallengeProgress(ch, {
    kills: 0, headshots: 0, totalKills: p.kills,
    totalHeadshots, matches: p.matchesPlayed, wins: p.matchesWon,
  }));
  for (const row of wpRows) {
    weaponProgress[row.weaponId] = { kills: row.kills, headshots: row.headshots, conditionStats: parseWeaponConditionStats(row.conditionStats) };
  }
  // Reaching Mastery 5 creates a permanent reward, not a recalculated currency.
  const tokenReadyWeapons = wonderLedger.awardedWeapons;
  const unlockedTitles = [
    ...unlockedAchievementTitles(p.achievements?.map(a => a.achievementId) ?? []),
    ...CAREER_TITLES.filter(t => p.careerRank >= t.rank).map(t => ({ id: t.id, title: t.title })),
  ];
  // Retired intermediate-tier titles must not remain on nameplates or leave
  // the selector pointing at an option that no longer exists. Awards stay intact.
  const selectedTitle = unlockedTitles.some(t => t.id === p.selectedTitle) ? p.selectedTitle : "";
  const purchases=await db.careerShopPurchase.findMany({where:{playerId:p.id},select:{itemKey:true,currency:true,cost:true}});
  const purchaseKeys=purchases.map(x=>x.itemKey);
  const wonderPurchases=purchases.filter(x=>x.currency==="wonder").map(x=>x.itemKey);
  const ownedCosmetics=cosmeticShopOwnership(purchaseKeys);
  const wonderSetups:Record<string,{moduleId:string;skinId:string;killEffectId:string}>={};
  for(const [wonderId,setup] of Object.entries(parseWeaponSetups(p.loadout?.weaponSetups))){
    if(!wonderWeapons.includes(wonderId))continue;
    wonderSetups[wonderId]={
      moduleId:validWonderModule(wonderId,setup.moduleId??"")&&
        wonderPurchases.includes("module_"+setup.moduleId)?setup.moduleId??"":"",
      skinId:wonderFinishById(setup.skin)?wonderPurchases.includes(setup.skin+"_"+wonderId)?setup.skin:"":"",
      killEffectId:wonderKillEffectById(setup.killEffectId??"")&&
        wonderPurchases.includes(setup.killEffectId+"_"+wonderId)?setup.killEffectId??"":"",
    };
  }
  const activeWonder=loadout.wonderWeaponId;
  loadout.wonderModuleId=wonderSetups[activeWonder]?.moduleId??"";
  loadout.wonderSkinId=wonderSetups[activeWonder]?.skinId??"";
  loadout.wonderKillEffectId=wonderSetups[activeWonder]?.killEffectId??"";
  const selectedNameplate=ownedCosmetics.includes(p.selectedNameplate)?p.selectedNameplate:"standard";
  // Account ownership gates persisted cosmetic choices even for old backup data.
  loadout.primaryReticle=ownedCosmetics.includes(loadout.primaryReticle)?loadout.primaryReticle:"classic";
  loadout.secondaryReticle=ownedCosmetics.includes(loadout.secondaryReticle)?loadout.secondaryReticle:"classic";
  loadout.primaryCharm=loadout.weapon.category!=="melee"&&ownedCosmetics.includes(loadout.primaryCharm)?loadout.primaryCharm:"none";
  loadout.secondaryCharm=!loadout.secondary.wonder&&loadout.secondary.category!=="melee"&&ownedCosmetics.includes(loadout.secondaryCharm)?loadout.secondaryCharm:"none";
  if (selectedTitle !== p.selectedTitle) await db.player.updateMany({
    where: { id: p.id, selectedTitle: p.selectedTitle }, data: { selectedTitle },
  });
  return {
    playerKey: p.playerKey,
    name: p.name,
    level,
    xp: p.xp,
    credits: p.credits,
    kills: p.kills,
    deaths: p.deaths,
    matchesPlayed: p.matchesPlayed,
    matchesWon: p.matchesWon,
    survivalBestWave: p.survivalBestWave,
    kd: p.deaths === 0 ? p.kills : Math.round((p.kills / p.deaths) * 100) / 100,
    selectedSkin: p.selectedSkin,
    selectedTitle,
    selectedNameplate,ownedCosmetics,
    unlockedTitles,
    xpProgress: xpProgressInLevel(p.xp),
    unlocks: {
      weapons: [...p.weaponUnlocks.map((u) => u.weaponId), ...wonderWeapons],
      weaponSkins: flatSkins,
      playerSkins: Array.from(new Set(["default", p.selectedSkin, ...p.playerSkinUnlocks.map(u => u.skinId), ...autoUnlockedItems(level).playerSkins])),
      attachments: flatAttachments,
      attachmentsByWeapon,
      skinsByWeapon,
    },
    loadout,
    savedLoadouts: parseSavedLoadouts(p.loadout?.savedLoadouts),
    weaponProgress,
    operatorContracts,
    career: await careerContractsView(p),
    prestige: { tokens: calculateWonderWallet(tokenReadyWeapons.length,wonderLedger.legacyCredits,wonderWeapons.length,purchases).available,
      masteredWeapons, tokenReadyWeapons, wonderWeapons, legacyCredits: wonderLedger.legacyCredits,wonderPurchases,wonderSetups },
  };
}

/** Only currently playable weapons are announced when a level gate opens. */
export function newlyAvailableWeaponsAtLevel(level: number) {
  return WEAPONS.filter(w => !w.wonder && !w.disabled && w.unlockLevel === level);
}

// Determine which items a player has unlocked by virtue of level (auto-unlocked, free).
// NOTE: attachments and weapon skins are no longer auto-unlocked by level —
// they're earned per-weapon via purchases (attachments) or weapon challenges (skins).
// The auto-unlock lists for those are intentionally empty; the entries are kept
// in the return shape for backward-compat with consumers that read these fields.
export function autoUnlockedItems(level: number) {
  return {
    weapons: WEAPONS.filter((w) => !w.wonder && !w.disabled && w.unlockLevel <= level && w.unlockCost === 0).map((w) => w.id),
    attachments: [] as string[],
    weaponSkins: [] as string[],
    playerSkins: PLAYER_SKINS.filter((s) => !s.shopCurrency && s.unlockLevel <= level && s.unlockCost === 0).map((s) => s.id),
  };
}

// Merge DB unlocks with auto-unlocked (free) items.
export function effectiveUnlocks(level: number, dbUnlocks: { weapons: string[]; weaponSkins: string[]; playerSkins: string[]; attachments: string[] }) {
  const auto = autoUnlockedItems(level);
  return {
    weapons: Array.from(new Set([...auto.weapons, ...dbUnlocks.weapons])),
    weaponSkins: Array.from(new Set([...auto.weaponSkins, ...dbUnlocks.weaponSkins])),
    playerSkins: Array.from(new Set([...auto.playerSkins, ...dbUnlocks.playerSkins])),
    attachments: Array.from(new Set([...auto.attachments, ...dbUnlocks.attachments])),
  };
}

export interface AwardResult {
  xpGained: number;
  creditsGained: number;
  completionXp: number;
  completionCredits: number;
  breakdown: import("./match-rewards").RewardBreakdown;
  leveledUp: boolean;
  newLevel: number;
  newUnlocks: { weapons: string[]; purchasableWeapons: string[]; perks: string[]; weaponSkins: string[]; playerSkins: string[]; attachments: string[] };
  // Per-weapon skin challenges completed during this match.
  newWeaponChallenges: { challengeId: string; weaponId: string; skinId: string; title: string; description: string }[];
  newPrestiges: string[];
  newAchievements: { id: string; title: string; description: string; rewardXp: number; rewardCredits: number }[];
  challengeAwards: { challengeId: string; title: string; rewardXp: number; rewardCredits: number }[];
  challengeProgress: { id: string; kind: "daily" | "weekly" | "elite" | "weapon"; title: string; description?: string; before: number; progress: number; goal: number; completed: boolean }[];
  bonusXp: number;
  bonusCredits: number;
}

// Compute the metric delta for a single match against a challenge metric type.
function metricDelta(metric: ChallengeMetric, m: MatchResultInput): number {
  switch (metric) {
    case "kills": return m.kills;
    case "headshots": return m.headshots;
    case "wins": return m.won ? 1 : 0;
    case "matches": return 1;
    case "tdm_kills": return m.mode === "tdm" ? m.kills : 0;
    case "ffa_kills": return m.mode === "ffa" ? m.kills : 0;
    case "kill_confirmations": return m.mode === "killconfirmed" ? (m.confirmations ?? 0) : 0;
    case "kill_denials": return m.mode === "killconfirmed" ? (m.denials ?? 0) : 0;
    // Per-weapon metrics: in Gun Game the player cycles through ALL weapon
    // types, so we must attribute kills via `perWeaponKills` (the map of
    // weaponId → {kills, headshots} for this match) rather than `weaponId`
    // (which is only the match-start weapon). For non-gungame modes where
    // perWeaponKills is absent, fall back to checking `weaponId`.
    //
    // "kills_with_shotgun" credits kills from ANY shotgun-category weapon
    // (shotgun_br, shotgun_auto, shotgun_combat) — not just the Breacher.
    // Likewise "kills_with_sniper" credits any sniper (sniper_lr, sniper_scout).
    // This makes the daily "Breacher" (10 shotgun kills) and "Longshot" (8
    // sniper kills) challenges progress correctly in Gun Game, where the
    // player may use a different shotgun/sniper each match.
    case "kills_with_shotgun": {
      const pw = m.perWeaponKills;
      if (pw && Object.keys(pw).length > 0) {
        let sum = 0;
        for (const [wid, vals] of Object.entries(pw)) {
          if (wid === "shotgun_br" || wid === "shotgun_auto" || wid === "shotgun_combat") {
            sum += vals.kills;
          }
        }
        return sum;
      }
      const wid = m.weaponId ?? "";
      return (wid === "shotgun_br" || wid === "shotgun_auto" || wid === "shotgun_combat") ? m.kills : 0;
    }
    case "kills_with_sniper": {
      const pw = m.perWeaponKills;
      if (pw && Object.keys(pw).length > 0) {
        let sum = 0;
        for (const [wid, vals] of Object.entries(pw)) {
          if (wid === "sniper_lr" || wid === "sniper_scout") {
            sum += vals.kills;
          }
        }
        return sum;
      }
      const wid = m.weaponId ?? "";
      return (wid === "sniper_lr" || wid === "sniper_scout") ? m.kills : 0;
    }
    case "multikills": return m.multikills ?? 0;
    case "survival_kills": return m.mode === "survival" ? m.kills : 0;
    case "survival_waves": return m.mode === "survival" ? (m.survivalWaves ?? 0) : 0;
    // Gun Game kills count toward the gungame-specific metric (and the
    // generic "kills" metric above). Treated like FFA for challenge tracking.
    case "gungame_kills": return m.mode === "gungame" ? m.kills : 0;
    // ---- Round 18-d: Secondary + Melee kill challenges ----
    // Sum kills from all Secondary categories (pistols, PDWs and launchers)
    // by stable weapon ID, or ALL melee-category
    // weapons (knife_tactical, shiv, machete, hammer) via perWeaponKills.
    // If perWeaponKills is absent, fall back to checking the match-start weapon.
    case "kills_with_secondary": {
      const pw = m.perWeaponKills;
      if (pw && Object.keys(pw).length > 0) {
        let sum = 0;
        for (const [wid, vals] of Object.entries(pw)) {
          if (weaponSlot(weaponById(wid).category) === "secondary") sum += vals.kills;
        }
        return sum;
      }
      return weaponSlot(weaponById(m.weaponId ?? "rifle_ar").category) === "secondary" ? m.kills : 0;
    }
    case "kills_with_melee": {
      const pw = m.perWeaponKills;
      if (pw && Object.keys(pw).length > 0) {
        let sum = 0;
        for (const [wid, vals] of Object.entries(pw)) {
          if (weaponById(wid).category === "melee") sum += vals.kills;
        }
        return sum;
      }
      return weaponById(m.weaponId ?? "rifle_ar").category === "melee" ? m.kills : 0;
    }
    // "level" is a lifetime stat — no per-match delta. Elite quests handle it
    // separately via eliteLifetimeValue().
    case "level": return 0;
    default: return 0;
  }
}

async function getSurvivalProgressById(playerId: string): Promise<SurvivalProgress> {
  const [defaultWins, hard, elite, nightmare] = await Promise.all([
    db.matchRecord.count({where:{playerId,mode:"survival",won:true}}),
    db.matchRecord.aggregate({where:{playerId,mode:"survival_hard"},_max:{waves:true}}),
    db.matchRecord.aggregate({where:{playerId,mode:"survival_elite"},_max:{waves:true}}),
    db.matchRecord.aggregate({where:{playerId,mode:"survival_nightmare"},_max:{waves:true}}),
  ]);
  return {defaultWins,hardBest:hard._max.waves ?? 0,eliteBest:elite._max.waves ?? 0,nightmareBest:nightmare._max.waves ?? 0};
}
export async function getSurvivalProgress(playerKey:string):Promise<SurvivalProgress> {
  const player=await getOrCreatePlayer(playerKey);
  return getSurvivalProgressById(player.id);
}

export async function applyMatchResult(input: MatchResultInput): Promise<AwardResult> {
  const survivalTier = normalizeSurvivalTier(input.survivalTier);
  const survivalProgressBefore = input.mode === "survival" ? await getSurvivalProgress(input.playerKey) : null;
  if (input.mode === "survival") input.won = survivalTier === "default" && !!input.won && (input.survivalWaves ?? 0) >= 30;
  const player = await getOrCreatePlayer(input.playerKey);
  const oldLevel = levelForXp(player.xp);

  const rewards = calculateMatchRewards(input);
  const { killXp, killCredits, winXp, winCredits, survivalWaves, completionXp, completionCredits } = rewards;
  let { xpGained, creditsGained } = rewards;
  const breakdown = rewards.breakdown;

  // --- 17-C: Quest-completion counters ---
  // Local accumulators for how many challenges (by type) were newly awarded
  // during THIS match. Added to the Player's lifetime counters in the final
  // transaction. Used by the new quest achievements (Daily Devotee, Weekly
  // Warrior, Elite Hunter, Quest Master).
  let dailyAwardedCount = 0;
  let weeklyAwardedCount = 0;
  let eliteAwardedCount = 0;

  // --- Daily challenges progress (with per-player elite promotion 17-C) ---
  // The effective set may include elite variants (3× goal, 3× reward, suffixed
  // `_elite` id) for challenges that rolled a promotion this period. Elite
  // variants are stored with isElite=true so they can be queried/filtered.
  const dayKey = new Date().toISOString().slice(0, 10);
  const todaysChallenges = effectiveDailyChallenges(player.playerKey, dayKey);
  const challengeAwards: { challengeId: string; title: string; rewardXp: number; rewardCredits: number }[] = [];
  const challengeProgress: AwardResult["challengeProgress"] = [];
  for (const ch of todaysChallenges) {
    const delta = metricDelta(ch.metric, input);
    if (delta <= 0) continue;
    const isElite = ch.id.endsWith("_elite");
    const existing = await db.dailyChallenge.findUnique({
      where: { playerId_challengeId_dayKey: { playerId: player.id, challengeId: ch.id, dayKey } },
    });
    const newProgress = nextChallengeProgress(ch, existing?.progress ?? 0, delta);
    const justCompleted = !existing?.completed && newProgress >= ch.goal;
    if (newProgress > (existing?.progress ?? 0)) challengeProgress.push({
      id: ch.id, kind: isElite ? "elite" : "daily", title: ch.title, description: ch.description,
      before: existing?.progress ?? 0, progress: newProgress, goal: ch.goal, completed: newProgress >= ch.goal,
    });
    if (existing) {
      await db.dailyChallenge.update({
        where: { id: existing.id },
        data: { progress: newProgress, completed: justCompleted || existing.completed },
      });
    } else {
      await db.dailyChallenge.create({
        data: { playerId: player.id, challengeId: ch.id, dayKey, type: "daily", isElite, progress: newProgress, goal: ch.goal, completed: justCompleted },
      });
    }
    // Auto-award on completion (no manual claim needed — keeps UX simple)
    if (justCompleted && !existing?.awarded) {
      await db.dailyChallenge.update({
        where: { playerId_challengeId_dayKey: { playerId: player.id, challengeId: ch.id, dayKey } },
        data: { awarded: true },
      });
      challengeAwards.push({ challengeId: ch.id, title: ch.title, rewardXp: ch.rewardXp, rewardCredits: ch.rewardCredits });
      breakdown.challenges.xp += ch.rewardXp;
      breakdown.challenges.credits += ch.rewardCredits;
      xpGained += ch.rewardXp;
      creditsGained += ch.rewardCredits;
      // Increment the appropriate quest counter. Elite variants count toward
      // the elite counter (NOT the daily counter) + the total counter.
      if (isElite) eliteAwardedCount++;
      else dailyAwardedCount++;
    }
  }

  // --- Weekly challenges progress (2 rotating objectives, ISO week, with elite promotion) ---
  const weekKey = weeklyChallengeKey();
  const thisWeeksChallenges = effectiveWeeklyChallenges(player.playerKey, weekKey);
  for (const ch of thisWeeksChallenges) {
    const delta = metricDelta(ch.metric, input);
    if (delta <= 0) continue;
    const isElite = ch.id.endsWith("_elite");
    const existing = await db.dailyChallenge.findUnique({
      where: { playerId_challengeId_dayKey: { playerId: player.id, challengeId: ch.id, dayKey: weekKey } },
    });
    const newProgress = nextChallengeProgress(ch, existing?.progress ?? 0, delta);
    const justCompleted = !existing?.completed && newProgress >= ch.goal;
    if (newProgress > (existing?.progress ?? 0)) challengeProgress.push({
      id: ch.id, kind: isElite ? "elite" : "weekly", title: ch.title, description: ch.description,
      before: existing?.progress ?? 0, progress: newProgress, goal: ch.goal, completed: newProgress >= ch.goal,
    });
    if (existing) {
      await db.dailyChallenge.update({
        where: { id: existing.id },
        data: { progress: newProgress, completed: justCompleted || existing.completed },
      });
    } else {
      await db.dailyChallenge.create({
        data: { playerId: player.id, challengeId: ch.id, dayKey: weekKey, type: "weekly", isElite, progress: newProgress, goal: ch.goal, completed: justCompleted },
      });
    }
    if (justCompleted && !existing?.awarded) {
      await db.dailyChallenge.update({
        where: { playerId_challengeId_dayKey: { playerId: player.id, challengeId: ch.id, dayKey: weekKey } },
        data: { awarded: true },
      });
      challengeAwards.push({ challengeId: ch.id, title: ch.title, rewardXp: ch.rewardXp, rewardCredits: ch.rewardCredits });
      breakdown.challenges.xp += ch.rewardXp;
      breakdown.challenges.credits += ch.rewardCredits;
      xpGained += ch.rewardXp;
      creditsGained += ch.rewardCredits;
      if (isElite) eliteAwardedCount++;
      else weeklyAwardedCount++;
    }
  }

  // --- Achievements check (lifetime stats, including quest counters 17-C) ---
  // Run AFTER the daily/weekly loops so the new quest-completion counters
  // reflect this match's awards (Player counters + per-match increments).
  const newAchievements: AwardResult["newAchievements"] = [];
  const headshotAgg = await db.matchRecord.aggregate({ where: { playerId: player.id }, _sum: { headshots: true } });
  const lifetimeHeadshots = (headshotAgg._sum.headshots ?? 0) + input.headshots;
  // Only ordinary combat modes count toward PvP combat achievements.
  // Survival-specific records may use suffixed mode IDs, so positively list
  // the non-Survival modes rather than subtracting just "survival".
  const combatModes = ["ffa","tdm","gungame","killconfirmed","ctf"];
  const combatAgg = await db.matchRecord.aggregate({
    where:{playerId:player.id,mode:{in:combatModes}},
    _sum:{kills:true,headshots:true},_count:{_all:true},
  });
  const combatWins = await db.matchRecord.count({where:{playerId:player.id,mode:{in:combatModes},won:true}});
  const [ctfAggregate,ctfWonMatches] = await Promise.all([
    db.matchRecord.aggregate({where:{playerId:player.id,mode:"ctf"},_sum:{score:true}}),
    db.matchRecord.count({where:{playerId:player.id,mode:"ctf",won:true}}),
  ]);
  const countsThisMatch = input.mode!=="survival";
  const weaponRows = await db.weaponProgress.findMany({where:{playerId:player.id}});
  const projectedWeapons = new Map(weaponRows.map(row=>[row.weaponId,{
    weaponId:row.weaponId,kills:row.kills,headshots:row.headshots,
  }]));
  const matchWeaponStats=input.perWeaponKills ?? {
    [input.weaponId ?? player.loadout?.primaryWeapon ?? "rifle_ar"]:{kills:input.kills,headshots:input.headshots},
  };
  for (const [wid,delta] of Object.entries(matchWeaponStats)){
    if(!WEAPONS.some(w=>w.id===wid)&&wid!==ORBITAL_REAPER_ID)continue;
    const current=projectedWeapons.get(wid)??{weaponId:wid,kills:0,headshots:0};
    projectedWeapons.set(wid,{weaponId:wid,kills:current.kills+Math.max(0,delta.kills),headshots:current.headshots+Math.max(0,delta.headshots)});
  }
  const masteryStats=masteryAchievementStats([...projectedWeapons.values()]
    .filter(row=>row.weaponId!==ORBITAL_REAPER_ID));
  const totalAwardedThisMatch = dailyAwardedCount + weeklyAwardedCount + eliteAwardedCount;
  const survivalProgress = survivalProgressBefore ?? {defaultWins:0,hardBest:0,eliteBest:0,nightmareBest:0};
  if (input.mode === "survival") {
    if (survivalTier === "default" && input.won) survivalProgress.defaultWins++;
    if (survivalTier === "hard") survivalProgress.hardBest = Math.max(survivalProgress.hardBest,survivalWaves);
    if (survivalTier === "elite") survivalProgress.eliteBest = Math.max(survivalProgress.eliteBest,survivalWaves);
    if (survivalTier === "nightmare") survivalProgress.nightmareBest = Math.max(survivalProgress.nightmareBest,survivalWaves);
  }
  const lifetimeStats = {
    kills: (combatAgg._sum.kills ?? 0) + (countsThisMatch?input.kills:0),
    wins: combatWins + (countsThisMatch&&input.won?1:0),
    matches: combatAgg._count._all + (countsThisMatch?1:0),
    ctf_captures:(ctfAggregate._sum.score??0)+(input.mode==="ctf"?Math.max(0,Math.floor(input.score)):0),
    ctf_wins:ctfWonMatches+(input.mode==="ctf"&&input.won?1:0),
    level: levelForXp(player.xp + xpGained),
    credits_earned_total: player.credits + creditsGained,
    survival_waves: Math.max(player.survivalBestWave, survivalWaves),
    // 17-C: post-match lifetime quest counters (existing + this match's awards)
    daily_challenges_completed: player.dailyChallengesCompleted + dailyAwardedCount,
    weekly_challenges_completed: player.weeklyChallengesCompleted + weeklyAwardedCount,
    elite_challenges_completed: player.eliteChallengesCompleted + eliteAwardedCount,
    total_challenges_completed: player.totalChallengesCompleted + totalAwardedThisMatch,
    // 19a+19b: lifetime best kill streak — the highest single-match streak
    // across all matches. Updated here from input.bestStreak (the engine's
    // per-match bestStreak field). Drives the Triple Threat / Killstreak King /
    // Untouchable Force tiered achievements.
    best_killstreak: Math.max(player.bestKillstreak, input.bestStreak ?? 0),
  };
  const getStatValue = (metric: string): number => {
    switch (metric) {
      case "kills": return lifetimeStats.kills;
      case "headshots": return (combatAgg._sum.headshots ?? 0) + (countsThisMatch?input.headshots:0);
      case "wins": return lifetimeStats.wins;
      case "matches": return lifetimeStats.matches;
      case "level": return levelForXp(player.xp + xpGained);
      case "credits_earned_total": return lifetimeStats.credits_earned_total;
      case "survival_waves": return lifetimeStats.survival_waves;
      case "survival_default_wins": return survivalProgress.defaultWins;
      case "survival_hard_waves": return survivalProgress.hardBest;
      case "survival_elite_waves": return survivalProgress.eliteBest;
      case "survival_nightmare_waves": return survivalProgress.nightmareBest;
      case "daily_challenges_completed": return lifetimeStats.daily_challenges_completed;
      case "weekly_challenges_completed": return lifetimeStats.weekly_challenges_completed;
      case "elite_challenges_completed": return lifetimeStats.elite_challenges_completed;
      case "total_challenges_completed": return lifetimeStats.total_challenges_completed;
      // 19a+19b: lifetime best kill streak (Player.bestKillstreak). Set by
      // Math.max above when this match's bestStreak exceeds the prior best.
      case "ctf_captures": return lifetimeStats.ctf_captures;
      case "ctf_wins": return lifetimeStats.ctf_wins;
      case "nexus_reaper_kills": return projectedWeapons.get(ORBITAL_REAPER_ID)?.kills ?? 0;
      case "best_killstreak": return Math.max(player.pvpBestKillstreak,countsThisMatch?(input.bestStreak??0):0);
      case "mastery_recruits": return masteryStats.mastery_recruits;
      case "mastery_specialists": return masteryStats.mastery_specialists;
      case "mastery_elites": return masteryStats.mastery_elites;
      default: return 0;
    }
  };

  const earnedAchievementIds = new Set(player.achievements?.map((a) => a.achievementId) ?? []);
  for (const ach of ACHIEVEMENTS) {
    if (earnedAchievementIds.has(ach.id)) continue;
    if (getStatValue(ach.metric) >= ach.goal) {
      newAchievements.push({ id: ach.id, title: ach.title, description: ach.description, rewardXp: ach.rewardXp, rewardCredits: ach.rewardCredits });
      breakdown.achievements.xp += ach.rewardXp;
      breakdown.achievements.credits += ach.rewardCredits;
      xpGained += ach.rewardXp;
      creditsGained += ach.rewardCredits;
    }
  }

  // NOTE (17-C): The legacy lifetime ELITE_QUESTS block has been removed.
  // Elite is now a per-period promotion of daily/weekly challenges (handled
  // in the loops above). Old DB rows with type="elite" / dayKey="elite" are
  // left orphaned (no automatic cleanup) — they don't affect new logic.

  const newXp = player.xp + xpGained;
  const newLevel = levelForXp(newXp);
  const leveledUp = newLevel > oldLevel;

  // Auto-grant items unlocked by the new level (free ones).
  // NOTE: weapons auto-grant by level. Attachments & weapon skins are no longer
  // auto-granted by level — they're per-weapon (purchased or challenge-earned).
  const newUnlocks = { weapons: [] as string[], purchasableWeapons: [] as string[], perks: [] as string[], weaponSkins: [] as string[], playerSkins: [] as string[], attachments: [] as string[] };
  if (leveledUp) {
    for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
      for (const w of newlyAvailableWeaponsAtLevel(lvl)) {
        if (w.unlockCost === 0 && !player.weaponUnlocks.find((u) => u.weaponId === w.id)) newUnlocks.weapons.push(w.id);
        else if (w.unlockCost > 0) newUnlocks.purchasableWeapons.push(w.id);
      }
      for (const perk of PERKS) if (perk.unlockLevel === lvl) newUnlocks.perks.push(perk.id);
      for (const s of PLAYER_SKINS) if (s.levelReward && s.unlockLevel === lvl) newUnlocks.playerSkins.push(s.id);
    }
  }

  // Report non-completion bonuses separately: end-of-match rewards have their own Results row.
  const bonusXp = xpGained - (killXp + winXp + completionXp);
  const bonusCredits = creditsGained - (killCredits + winCredits + completionCredits);

  // --- Per-weapon skin challenges (kills / headshots milestones) ---
  // Completing the goal opens the CREDIT PURCHASE in the Armory.
  // SkinUnlock rows represent purchases/legacy grants, not newly earned eligibility.
  // The equipped weapon for this match may have just crossed a challenge goal.
  // We compute the post-match totals for each weapon that got kills this match
  // (existing DB aggregates + this match's contribution) and create SkinUnlock
  // rows for any newly-completed challenges. Standard-tier skins unlock globally
  // (one SkinUnlock row with weaponId="*"); non-standard (future) skins are PER-WEAPON.
  //
  // GUN GAME NOTE: In gungame mode the player cycles through every weapon in
  // GUN_GAME_PROGRESSION (pistol → SMG → rifle → … → knife). The engine tracks
  // per-weapon kill/headshot tallies in `input.perWeaponKills`. We use that map
  // to attribute this match's kills to the weapon actually used for each kill —
  // so the Breacher's "Close Quarters" challenge progresses on shotgun kills
  // even though the match-start weapon (pistol_side) is what's stored in
  // `input.weaponId` / MatchRecord.weaponId. Non-gungame callers omit the map;
  // their kills default to `input.weaponId` (the equipped weapon) as before.
  const equippedWeaponId = input.weaponId ?? player.loadout?.primaryWeapon ?? "rifle_ar";
  const newWeaponChallenges: { challengeId: string; weaponId: string; skinId: string; title: string; description: string }[] = [];
  // Build the set of weapons that got kills this match: always include the
  // equipped/start weapon, plus every weapon in perWeaponKills (gungame).
  const perWeaponKillsInput = input.perWeaponKills ?? {};
  const hasPerWeapon = input.perWeaponKills != null;
  const weaponsToCheck = new Set<string>();
  if (equippedWeaponId) weaponsToCheck.add(equippedWeaponId);
  for (const wid of Object.keys(perWeaponKillsInput)) weaponsToCheck.add(wid);
  // Pre-filter to catalog weapons that actually have challenges defined —
  // avoids issuing pointless DB aggregate queries for unknown weapons.
  const catalogWeaponIds = new Set(WEAPONS.map((w) => w.id));
  const challengeWeaponIds = new Set(WEAPONS.map(w => w.id));
  const anyWeaponToCheck = [...weaponsToCheck].some((wid) => catalogWeaponIds.has(wid) && challengeWeaponIds.has(wid));
  if (anyWeaponToCheck) {
    // Fetch ALL of the player's skin unlocks ONCE — we'll check both per-weapon AND
    // wildcard rows when deciding if a standard skin is already unlocked.
    const allPlayerSkinUnlocks = await db.skinUnlock.findMany({
      where: { playerId: player.id },
    });
    // Map skinId -> set of weaponIds it's been unlocked for (including "*").
    const skinUnlockMap = new Map<string, Set<string>>();
    for (const u of allPlayerSkinUnlocks) {
      if (!skinUnlockMap.has(u.skinId)) skinUnlockMap.set(u.skinId, new Set());
      skinUnlockMap.get(u.skinId)!.add(u.weaponId);
    }
    for (const wid of weaponsToCheck) {
      // Skip non-catalog weapons or weapons with no challenges defined.
      if (!catalogWeaponIds.has(wid)) continue;
      if (!challengeWeaponIds.has(wid)) continue;
      // Every reward belongs to this weapon (legacy wildcard is not sufficient).
      const isSkinAlreadyUnlocked = (skinId: string): boolean => {
        const weaponIds = skinUnlockMap.get(skinId);
        if (!weaponIds || weaponIds.size === 0) return false;
        return weaponIds.has(wid);
      };
      // Lifetime kills/headshots for this weapon come from the WeaponProgress
      // table (updated on every match completion). NOTE: MatchRecord.weaponId
      // only stores the match-start weapon (pistol_side in gungame), so aggregating
      // MatchRecord would ALWAYS return 0 for the other weapons cycled through in
      // gungame. WeaponProgress is updated from perWeaponKills (gungame) or the
      // equipped weapon (other modes) inside the $transaction below.
      const wp = await db.weaponProgress.findUnique({
        where: { playerId_weaponId: { playerId: player.id, weaponId: wid } },
      });
      // This match's contribution to this weapon. If the caller sent perWeaponKills
      // (gungame), use the per-weapon tally (0 if no entry for this weapon). Otherwise
      // (non-gungame / legacy), attribute all kills/headshots to the equipped weapon.
      const matchKills = hasPerWeapon
        ? (perWeaponKillsInput[wid]?.kills ?? 0)
        : (wid === equippedWeaponId ? input.kills : 0);
      const matchHeadshots = hasPerWeapon
        ? (perWeaponKillsInput[wid]?.headshots ?? 0)
        : (wid === equippedWeaponId ? input.headshots : 0);
      const weaponKills = (wp?.kills ?? 0) + matchKills;
      const weaponHeadshots = (wp?.headshots ?? 0) + matchHeadshots;
      const oldContext = parseWeaponConditionStats(wp?.conditionStats);
      const newContext = { ...oldContext };
      for (const [metric, count] of Object.entries(input.perWeaponActions?.[wid] ?? {})) {
        if (metric in newContext && typeof count === "number" && Number.isFinite(count) && count > 0) {
          newContext[metric as keyof WeaponConditionStats] += Math.min(matchKills, Math.floor(count));
        }
      }
      for (const ch of allSkinChallengesForWeapon(wid)) {
        if (isSkinAlreadyUnlocked(ch.skinId)) continue;
        const nextState = weaponChallengeProgress(ch, { kills: weaponKills, headshots: weaponHeadshots, conditionStats: newContext });
        const previousState = weaponChallengeProgress(ch, { kills: wp?.kills ?? 0, headshots: wp?.headshots ?? 0, conditionStats: oldContext });
        if (nextState.progress > previousState.progress) challengeProgress.push({
          id: ch.id, kind: "weapon", title: `${weaponById(wid).name} · ${ch.title}`, description: ch.description,
          before: previousState.progress, progress: nextState.progress, goal: nextState.goal,
          completed: nextState.completed,
        });
        if (nextState.completed && !previousState.completed) {
          newWeaponChallenges.push({
            challengeId: ch.id,
            weaponId: ch.weaponId,
            skinId: ch.skinId,
            title: ch.title,
            description: ch.description,
          });
        }
      }
    }
  }

  await db.$transaction(async (tx) => {
    const current = await tx.player.findUniqueOrThrow({ where: { id: player.id } });
    await tx.player.update({
      where: { id: player.id },
      data: {
        xp: { increment: xpGained },
        credits: { increment: creditsGained },
        level: levelForXp(current.xp + xpGained),
        careerXp: careerXpAfterMatch(current.careerXp, current.careerRank, current.xp, xpGained),
        kills: player.kills + input.kills,
        deaths: player.deaths + input.deaths,
        matchesPlayed: player.matchesPlayed + 1,
        matchesWon: player.matchesWon + (input.won ? 1 : 0),
        survivalBestWave: Math.max(player.survivalBestWave, survivalWaves),
        // 17-C: increment lifetime quest-completion counters
        dailyChallengesCompleted: player.dailyChallengesCompleted + dailyAwardedCount,
        weeklyChallengesCompleted: player.weeklyChallengesCompleted + weeklyAwardedCount,
        eliteChallengesCompleted: player.eliteChallengesCompleted + eliteAwardedCount,
        totalChallengesCompleted: player.totalChallengesCompleted + totalAwardedThisMatch,
        // 19a+19b: update lifetime best kill streak. Math.max so a lower
        // bestStreak this match doesn't overwrite a higher prior best.
        bestKillstreak: Math.max(player.bestKillstreak, input.bestStreak ?? 0),
        pvpBestKillstreak: Math.max(player.pvpBestKillstreak, input.mode!=="survival" ? (input.bestStreak ?? 0) : 0),
      },
    });
    if (newUnlocks.weapons.length) await tx.weaponUnlock.createMany({ data: newUnlocks.weapons.map((id) => ({ playerId: player.id, weaponId: id })) });
    // SkinUnlock is now created only when a player purchases an earned skin.
    if (newAchievements.length) await tx.playerAchievement.createMany({ data: newAchievements.map((a) => ({ playerId: player.id, achievementId: a.id })) });
    // Update lifetime per-weapon progress. WeaponProgress is the source of truth
    // for weapon challenge checks (above). In gungame, the player cycles through
    // many weapons per match — MatchRecord.weaponId only stores the match-start
    // weapon, so we'd lose per-weapon kills between matches without this table.
    // Non-gungame callers omit perWeaponKills; we attribute all kills/headshots
    // to the equipped weapon in that case (matching the challenge-check logic).
    const perWeaponKillsForTx = input.perWeaponKills ?? {};
    const equippedForTx = equippedWeaponId;
    const weaponContributions: Record<string, { kills: number; headshots: number }> = {};
    if (hasPerWeapon) {
      for (const [wid, vals] of Object.entries(perWeaponKillsForTx)) {
        weaponContributions[wid] = { kills: vals.kills, headshots: vals.headshots };
      }
    } else if (equippedForTx) {
      weaponContributions[equippedForTx] = { kills: input.kills, headshots: input.headshots };
    }
    for (const [wid, vals] of Object.entries(weaponContributions)) {
      if (vals.kills === 0 && vals.headshots === 0) continue;
      const existing = await tx.weaponProgress.findUnique({ where: { playerId_weaponId: { playerId: player.id, weaponId: wid } } });
      const oldContext = parseWeaponConditionStats(existing?.conditionStats);
      for (const [metric, count] of Object.entries(input.perWeaponActions?.[wid] ?? {})) {
        if (metric in oldContext && typeof count === "number" && Number.isFinite(count) && count > 0) {
          oldContext[metric as keyof WeaponConditionStats] += Math.min(vals.kills, Math.floor(count));
        }
      }
      await tx.weaponProgress.upsert({
        where: { playerId_weaponId: { playerId: player.id, weaponId: wid } },
        create: { playerId: player.id, weaponId: wid, kills: vals.kills, headshots: vals.headshots, conditionStats: JSON.stringify(oldContext) },
        update: { kills: (existing?.kills ?? 0) + vals.kills, headshots: (existing?.headshots ?? 0) + vals.headshots, conditionStats: JSON.stringify(oldContext) },
      });
    }
    // Append a match record for the history view
    await tx.matchRecord.create({
      data: {
        playerId: player.id,
        mode: input.mode === "survival" ? survivalRecordMode(survivalTier) : input.mode,
        online: input.online ?? false,
        kills: input.kills,
        deaths: input.deaths,
        headshots: input.headshots,
        score: input.score,
        placement: input.placement ?? 1,
        won: input.won,
        durationSec: input.durationSec ?? 0,
        weaponId: input.weaponId ?? "rifle_ar",
        waves: survivalWaves,
      },
    });
    // Active Career Contracts advance atomically with this completed match.
    await recordCareerMatch(tx,player.id,current.xp,xpGained,{
      mode:input.mode,won:input.won,kills:input.kills,headshots:input.headshots,
      survivalWaves,weaponId:input.weaponId??equippedForTx,
      perWeaponKills:input.perWeaponKills,
    });
  });

  const newPrestiges = await grantWeaponPrestiges(player.id);
  return { xpGained, creditsGained, completionXp, completionCredits, breakdown, leveledUp, newLevel: Math.max(newLevel, oldLevel), newUnlocks, newWeaponChallenges, newPrestiges, newAchievements, challengeAwards, challengeProgress, bonusXp, bonusCredits };
}

// --- Profile enrichment: recent matches, achievements, daily challenge progress ---
export interface MatchRecordView {
  id: string;
  mode: string;
  online: boolean;
  kills: number;
  deaths: number;
  headshots: number;
  score: number;
  placement: number;
  won: boolean;
  durationSec: number;
  weaponId: string;
  waves: number;
  playedAt: string;
}

export interface DailyChallengeView {
  challengeId: string;
  title: string;
  description: string;
  icon: string;
  metric: ChallengeMetric;
  goal: number;
  progress: number;
  completed: boolean;
  awarded: boolean;
  rewardXp: number;
  rewardCredits: number;
  // 17-C: true if this is an elite-promoted variant of the base daily
  // challenge (3× goal, 3× reward, purple/pink UI treatment).
  isElite: boolean;
}

export interface AchievementView {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: string;
  metric: string;
  goal: number;
  currentValue: number;
  earned: boolean;
  earnedAt?: string;
  rewardXp: number;
  rewardCredits: number;
}

export async function getRecentMatches(playerKey: string, limit = 20): Promise<MatchRecordView[]> {
  const player = await getOrCreatePlayer(playerKey);
  const records = await db.matchRecord.findMany({
    where: { playerId: player.id },
    orderBy: { playedAt: "desc" },
    take: limit,
  });
  return records.map((r) => ({
    id: r.id, mode: r.mode, online: r.online, kills: r.kills, deaths: r.deaths,
    headshots: r.headshots, score: r.score, placement: r.placement, won: r.won,
    durationSec: r.durationSec, weaponId: r.weaponId, waves: r.waves, playedAt: r.playedAt.toISOString(),
  }));
}

// ---- Weekly challenges ----
export interface WeeklyChallengeView {
  challengeId: string;
  title: string;
  description: string;
  icon: string;
  metric: ChallengeMetric;
  goal: number;
  progress: number;
  completed: boolean;
  awarded: boolean;
  rewardXp: number;
  rewardCredits: number;
  weekKey: string;
  // 17-C: true if this is an elite-promoted variant of the base weekly
  // challenge (3× goal, 3× reward, purple/pink UI treatment).
  isElite: boolean;
}

// 17-C: Build the player's effective daily challenge set, applying per-player
// elite promotion. Each base daily challenge has a deterministic DAILY_ELITE_CHANCE
// chance (per playerKey + dayKey + challengeId) of being replaced by its elite
// variant (3× goal, 3× reward, suffixed `_elite` id). Returns the array of
// effective ChallengeDefs (some may be elite variants).
function effectiveDailyChallenges(playerKey: string, dayKey: string): ChallengeDef[] {
  const base = dailyChallengeSet();
  return base.map((c) =>
    canPromoteChallengeToElite(c) && shouldPromoteToElite(playerKey, dayKey, c.id, DAILY_ELITE_CHANCE)
      ? promoteChallengeToElite(c)
      : c,
  );
}

// 17-C: Same as effectiveDailyChallenges but for the weekly set with
// WEEKLY_ELITE_CHANCE.
function effectiveWeeklyChallenges(playerKey: string, weekKey: string): ChallengeDef[] {
  const base = weeklyChallengeSet();
  return base.map((c) =>
    canPromoteChallengeToElite(c) && shouldPromoteToElite(playerKey, weekKey, c.id, WEEKLY_ELITE_CHANCE)
      ? promoteChallengeToElite(c)
      : c,
  );
}

export async function getDailyChallengesView(playerKey: string): Promise<DailyChallengeView[]> {
  const player = await getOrCreatePlayer(playerKey);
  const dayKey = new Date().toISOString().slice(0, 10);
  const set = effectiveDailyChallenges(player.playerKey, dayKey);
  const progress = await db.dailyChallenge.findMany({ where: { playerId: player.id, dayKey } });
  const byId = new Map(progress.map((p) => [p.challengeId, p]));
  return set.map((c) => {
    const p = byId.get(c.id);
    // isElite is inferred from the suffixed id (the base id won't have a row
    // because we never wrote one — only the suffixed one is created on first
    // progress update). This avoids needing the DB column for the view layer
    // (the column is for queryability / future analytics).
    const isElite = c.id.endsWith("_elite");
    return {
      challengeId: c.id,
      title: c.title,
      description: c.description,
      icon: c.icon,
      metric: c.metric,
      goal: c.goal,
      progress: p?.progress ?? 0,
      completed: p?.completed ?? false,
      awarded: p?.awarded ?? false,
      rewardXp: c.rewardXp,
      rewardCredits: c.rewardCredits,
      isElite,
    };
  });
}

export async function getWeeklyChallengesView(playerKey: string): Promise<WeeklyChallengeView[]> {
  const player = await getOrCreatePlayer(playerKey);
  const weekKey = weeklyChallengeKey();
  const set = effectiveWeeklyChallenges(player.playerKey, weekKey);
  const progress = await db.dailyChallenge.findMany({ where: { playerId: player.id, dayKey: weekKey } });
  const byId = new Map(progress.map((p) => [p.challengeId, p]));
  return set.map((c) => {
    const p = byId.get(c.id);
    const isElite = c.id.endsWith("_elite");
    return {
      challengeId: c.id,
      title: c.title,
      description: c.description,
      icon: c.icon,
      metric: c.metric,
      goal: c.goal,
      progress: p?.progress ?? 0,
      completed: p?.completed ?? false,
      awarded: p?.awarded ?? false,
      rewardXp: c.rewardXp,
      rewardCredits: c.rewardCredits,
      weekKey,
      isElite,
    };
  });
}

// ---- Elite quests (LEGACY LIFETIME view) ----
// 17-C: kept for backward-compat with old DB rows that have type="elite" /
// dayKey="elite" from prior migrations. The new Elite system is per-period
// (daily/weekly) elite variants — see getDailyChallengesView / getWeeklyChallengesView
// above. This function still reads the legacy lifetime rows so existing data
// isn't orphaned, but is no longer called by /api/challenges (which now only
// returns daily + weekly + their elite variants).
export interface EliteQuestView {
  challengeId: string;
  title: string;
  description: string;
  icon: string;
  metric: ChallengeMetric;
  goal: number;
  progress: number;        // current lifetime stat value (clamped to goal for display)
  completed: boolean;
  awarded: boolean;
  rewardXp: number;
  rewardCredits: number;
}

export async function getEliteQuestsView(playerKey: string): Promise<EliteQuestView[]> {
  const player = await getOrCreatePlayer(playerKey);
  const elitePeriodKey = "elite";
  const rows = await db.dailyChallenge.findMany({ where: { playerId: player.id, dayKey: elitePeriodKey } });
  const byId = new Map(rows.map((r) => [r.challengeId, r]));
  // Lifetime stats — computed from the player + match record aggregates (same
  // pattern as getAchievementsView).
  const headshotAgg = await db.matchRecord.aggregate({ where: { playerId: player.id }, _sum: { headshots: true } });
  const lifetimeHeadshots = headshotAgg._sum.headshots ?? 0;
  const level = levelForXp(player.xp);
  const statFor = (metric: ChallengeMetric): number => {
    switch (metric) {
      case "kills": return player.kills;
      case "headshots": return lifetimeHeadshots;
      case "wins": return player.matchesWon;
      case "matches": return player.matchesPlayed;
      case "level": return level;
      case "survival_waves": return player.survivalBestWave;
      default: return 0;
    }
  };
  return ELITE_QUESTS.map((q) => {
    const r = byId.get(q.id);
    const current = statFor(q.metric);
    const completed = (r?.completed ?? false) || current >= q.goal;
    return {
      challengeId: q.id,
      title: q.title,
      description: q.description,
      icon: q.icon,
      metric: q.metric,
      goal: q.goal,
      progress: Math.min(q.goal, Math.max(r?.progress ?? 0, current)),
      completed,
      awarded: r?.awarded ?? false,
      rewardXp: q.rewardXp,
      rewardCredits: q.rewardCredits,
    };
  });
}

export async function getAchievementsView(playerKey: string): Promise<AchievementView[]> {
  const player = await getOrCreatePlayer(playerKey);
  await grantExistingMasteryTitles(player.id);
  await grantCollectorAchievements(player.id);
  const earned = await db.playerAchievement.findMany({ where: { playerId: player.id } });
  const earnedMap = new Map(earned.map((a) => [a.achievementId, a.earnedAt]));
  const combatModes=["ffa","tdm","gungame","killconfirmed","ctf"];
  const combatAgg=await db.matchRecord.aggregate({
    where:{playerId:player.id,mode:{in:combatModes}},
    _sum:{kills:true,headshots:true},_count:{_all:true},
  });
  const combatWins=await db.matchRecord.count({where:{playerId:player.id,mode:{in:combatModes},won:true}});
  const [ctfAggregate,ctfWonMatches]=await Promise.all([
    db.matchRecord.aggregate({where:{playerId:player.id,mode:"ctf"},_sum:{score:true}}),
    db.matchRecord.count({where:{playerId:player.id,mode:"ctf",won:true}}),
  ]);
  const weaponRows=await db.weaponProgress.findMany({where:{playerId:player.id}});
  const masteryStats=masteryAchievementStats(weaponRows
    .filter(row=>row.weaponId!==ORBITAL_REAPER_ID));
  const survivalProgress = await getSurvivalProgressById(player.id);
  const acquiredAttachments:Record<string,string[]>={};
  for(const row of player.attachmentUnlocks)(acquiredAttachments[row.weaponId]??=[]).push(row.attachmentId);
  const prestigeHistory=await db.weaponPrestige.findMany({where:{playerId:player.id}});
  const acquiredSkins=collectorSkinEntitlements(player.skinUnlocks,weaponRows,prestigeHistory);
  const collection=collectorProgress({
    level:levelForXp(player.xp),unlockedWeapons:player.weaponUnlocks.map(w=>w.weaponId),
    ownedAttachments:acquiredAttachments,ownedWeaponSkins:acquiredSkins,
    ownedOperators:["default",player.selectedSkin,...player.playerSkinUnlocks.map(s=>s.skinId)],
  });
  const statFor = (metric: string): number => {
    switch (metric) {
      case "collection_percent": return collection.percent;
      case "kills": return combatAgg._sum.kills ?? 0;
      case "headshots": return combatAgg._sum.headshots ?? 0;
      case "wins": return combatWins;
      case "matches": return combatAgg._count._all;
      case "level": return levelForXp(player.xp);
      case "credits_earned_total": return player.credits;
      case "survival_waves": return player.survivalBestWave;
      case "survival_default_wins": return survivalProgress.defaultWins;
      case "survival_hard_waves": return survivalProgress.hardBest;
      case "survival_elite_waves": return survivalProgress.eliteBest;
      case "survival_nightmare_waves": return survivalProgress.nightmareBest;
      // 17-C: quest-completion lifetime counters (stored on Player)
      case "daily_challenges_completed": return player.dailyChallengesCompleted;
      case "weekly_challenges_completed": return player.weeklyChallengesCompleted;
      case "elite_challenges_completed": return player.eliteChallengesCompleted;
      case "total_challenges_completed": return player.totalChallengesCompleted;
      // 19a+19b: lifetime best kill streak (Player.bestKillstreak)
      case "ctf_captures": return ctfAggregate._sum.score ?? 0;
      case "ctf_wins": return ctfWonMatches;
      case "nexus_reaper_kills": return weaponRows.find(w=>w.weaponId===ORBITAL_REAPER_ID)?.kills ?? 0;
      case "best_killstreak": return player.pvpBestKillstreak;
      case "mastery_recruits": return masteryStats.mastery_recruits;
      case "mastery_specialists": return masteryStats.mastery_specialists;
      case "mastery_elites": return masteryStats.mastery_elites;
      default: return 0;
    }
  };
  return ACHIEVEMENTS.map((a) => {
    const e = earnedMap.get(a.id);
    return {
      id: a.id, title: a.title, description: a.description, icon: a.icon, tier: a.tier,
      metric: a.metric, goal: a.goal, currentValue: statFor(a.metric),
      earned: !!e, earnedAt: e?.toISOString(), rewardXp: a.rewardXp, rewardCredits: a.rewardCredits,
    };
  });
}

// --- Per-weapon progress (kills / headshots) for the Armory challenge view ---
export interface WeaponProgressView {
  weaponId: string;
  kills: number;
  headshots: number;
  conditionStats: WeaponConditionStats;
}

// The authoritative lifetime row includes kills from all weapons used in Gun Game
// and contextual stats. MatchRecord.weaponId only records the match-start weapon.
export async function getWeaponProgress(playerKey: string, weaponId: string): Promise<WeaponProgressView> {
  const player = await getOrCreatePlayer(playerKey);
  if (!player) return { weaponId, kills: 0, headshots: 0, conditionStats: emptyWeaponConditionStats() };
  const row = await db.weaponProgress.findUnique({
    where: { playerId_weaponId: { playerId: player.id, weaponId } },
  });
  return {
    weaponId,
    kills: row?.kills ?? 0,
    headshots: row?.headshots ?? 0,
    conditionStats: parseWeaponConditionStats(row?.conditionStats),
  };
}
export async function getAllWeaponProgress(playerKey: string): Promise<Record<string, WeaponProgressView>> {
  const player = await getOrCreatePlayer(playerKey);
  if (!player) return {};
  const rows = await db.weaponProgress.findMany({ where: { playerId: player.id } });
  const result: Record<string, WeaponProgressView> = {};
  for (const row of rows) {
    result[row.weaponId] = {
      weaponId: row.weaponId, kills: row.kills, headshots: row.headshots,
      conditionStats: parseWeaponConditionStats(row.conditionStats),
    };
  }
  return result;
}

export interface WeaponChallengeView {
  challengeId: string;
  weaponId: string;
  skinId: string;
  metric: WeaponChallengeMetric;
  goal: number;
  progress: number;
  completed: boolean;
  requirements?: { metric: WeaponChallengeMetric; goal: number; progress: number; completed: boolean }[];
  title: string;
  description: string;
}
export async function getWeaponChallengesView(playerKey: string, weaponId: string): Promise<WeaponChallengeView[]> {
  const player = await getOrCreatePlayer(playerKey);
  if (!player) return [];
  const progress = await getWeaponProgress(playerKey, weaponId);
  const unlockedSkins = await db.skinUnlock.findMany({
    where: { playerId: player.id, weaponId },
  });
  const owned = new Set(unlockedSkins.map(u => u.skinId));
  return allSkinChallengesForWeapon(weaponId).map(ch => {
    const state = weaponChallengeProgress(ch, progress);
    return {
      challengeId: ch.id, weaponId: ch.weaponId, skinId: ch.skinId, metric: ch.metric,
      goal: state.goal, progress: state.progress,
      completed: owned.has(ch.skinId) || state.completed,
      requirements: ch.requirements ? state.steps : undefined,
      title: ch.title, description: ch.description,
    };
  });
}

// Per-weapon attachment unlock view: returns the attachment IDs the player has
// unlocked for a specific weapon.
export async function getWeaponAttachmentUnlocks(playerKey: string, weaponId: string): Promise<string[]> {
  const player = await getOrCreatePlayer(playerKey);
  if (!player) return [];
  const rows = await db.attachmentUnlock.findMany({
    where: { playerId: player.id, weaponId },
  });
  return rows.map((r) => r.attachmentId);
}

// Normalize an unknown weapon id to a valid catalog id (fallback to rifle_ar).
export function safeWeaponId(id: string | undefined | null): string {
  if (id && WEAPONS.some((w) => w.id === id)) return id;
  return "rifle_ar";
}
// Re-export for callers that already import from player-service.
export { weaponById };
