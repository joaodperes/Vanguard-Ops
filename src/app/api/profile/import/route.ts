import { levelForXp } from "@/lib/progression";
import { restoreCareer } from "@/lib/career";
import { perkById, DEFAULT_PERK_ID } from "@/lib/perks";
import { parseSavedLoadouts } from "@/lib/saved-loadouts";
import { cosmeticById, parseEquippedCharms } from "@/lib/cosmetics";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { WEAPONS } from "@/lib/game-data";
import { resolvePlayerKey } from "@/lib/auth";
import { parseWeaponConditionStats } from "@/lib/armory-challenges";

export const dynamic = "force-dynamic";

// POST /api/profile/import
// Body: { playerKey?: string, data: <exported JSON> }
// Restores a player profile from an exported JSON file. The playerKey in the
// exported data is used as the target — if the current session/guest key
// matches the export's playerKey, the profile is restored in place. If the
// target playerKey doesn't exist, it's created. If it exists, it's updated
// (taking the MAX of numeric fields to avoid downgrading progress).
//
// This is the user-facing recovery path for "progress deleted on publish":
// even if the persistent DB is wiped, a player with a saved export file can
// restore their full progression.
interface ExportData {
  format?: string;
  playerKey: string;
  player: {
    name: string;
    level: number;
    careerRank?: number;
    careerXp?: number;
    careerTokensSpent?: number;
    wonderTokenLedgerReady?: boolean;
    wonderLegacyCredits?: number;
    selectedTitle?: string;
    selectedReticle?: string;
    selectedNameplate?: string;
    equippedCharms?: string;
    pvpBestKillstreak?: number;
    xp: number;
    credits: number;
    kills: number;
    deaths: number;
    matchesPlayed: number;
    matchesWon: number;
    survivalBestWave: number;
    selectedSkin: string;
    dailyChallengesCompleted: number;
    weeklyChallengesCompleted: number;
    eliteChallengesCompleted: number;
    totalChallengesCompleted: number;
    // 19a+19b: lifetime best kill streak (optional on import for backward
    // compat with profiles exported before this field existed — defaults to 0).
    bestKillstreak?: number;
  };
  weaponUnlocks?: { weaponId: string }[];
  skinUnlocks?: { weaponId: string; skinId: string }[];
  attachmentUnlocks?: { weaponId: string; attachmentId: string }[];
  playerSkinUnlocks?: { skinId: string }[];
  loadout?: {
    perkId?: string;
    primaryReticle?: string;secondaryReticle?: string;primaryCharm?: string;secondaryCharm?: string;
    secondaryWeaponSkin?: string;
    meleeWeaponSkin?: string;
    weaponSetups?: string;
    savedLoadouts?: string;
    primaryWeapon: string;
    secondaryWeapon: string;
    meleeWeapon: string;
    weaponSkin: string;
    playerSkin: string;
    attachments: string;
    secondaryAttachments: string;
    meleeAttachments: string;
  } | null;
  achievements?: { achievementId: string; earnedAt: string }[];
  weaponProgress?: { weaponId: string; kills: number; headshots: number; conditionStats?: string }[];
  weaponPrestiges?: { weaponId: string; legacyReward?: boolean }[];
  wonderUnlocks?: { weaponId: string }[];
  wonderTokenAwards?: { weaponId: string; legacy?: boolean }[];
  careerContracts?: {cycle:number;contractId:string;goal:number;progress:number;completed:boolean}[];
  careerRewards?: {cycle:number}[];
  careerShopPurchases?: {itemKey:string;currency:string;cost:number}[];
  matchRecords?: {
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
  }[];
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { data, playerKey: bodyKey } = body as { data?: ExportData; playerKey?: string };

  if (!data || !data.playerKey || !data.player) {
    return NextResponse.json({ error: "Invalid export data: missing playerKey or player fields" }, { status: 400 });
  }

  // Resolve the current session/guest key. We allow import if:
  // 1. The current user is a guest (no session) and bodyKey matches the export's playerKey, OR
  // 2. The current user is logged in and their session playerKey matches the export's playerKey.
  // This prevents importing someone else's profile into your account.
  const { playerKey: sessionKey, session } = await resolvePlayerKey(req, bodyKey);
  const targetKey = data.playerKey;
  if (session) {
    // Logged-in user: the export's playerKey must match their session.
    if (sessionKey !== targetKey) {
      return NextResponse.json({ error: "Cannot import a profile that doesn't belong to your account" }, { status: 403 });
    }
  } else {
    // Guest: the bodyKey must match the export's playerKey.
    if (bodyKey !== targetKey) {
      return NextResponse.json({ error: "playerKey must match the export's playerKey" }, { status: 403 });
    }
  }

  const existing = await db.player.findUnique({
    where: { playerKey: targetKey },
    include: { loadout: true },
  });

  const p = data.player;
  const career = restoreCareer(existing, p);
  const existingShopPurchases=existing ? await db.careerShopPurchase.count({where:{playerId:existing.id}}):0;
  const restoredTokensSpent=Math.max(existing?.careerTokensSpent??0,
    Number.isSafeInteger(p.careerTokensSpent)&&p.careerTokensSpent!>=0?p.careerTokensSpent!:0);
  const restoredXp = Math.max(existing?.xp ?? 0, p.xp);
  // Pre-ledger backups have neither property and are reconciled after import.
  const restoredWonderCredits = Math.max(existing?.wonderLegacyCredits ?? 0,
    Number.isSafeInteger(p.wonderLegacyCredits) && p.wonderLegacyCredits! >= 0
      ? Math.min(100, p.wonderLegacyCredits!) : 0);
  const restoredWonderReady = (existing?.wonderTokenLedgerReady ?? false) ||
    p.wonderTokenLedgerReady === true;
  const restoredPerk = perkById(data.loadout?.perkId);
  // Legacy backups had one reticle and weapon-ID charms; convert to the two active slots.
  const legacyCharms=parseEquippedCharms(p.equippedCharms);
  const cosmeticChoice=(id:string|undefined,kind:"reticle"|"charm",fallback:string)=>
    typeof id==="string"&&cosmeticById(id,kind)?id:fallback;
  const restoredLoadout = {
    primaryReticle:cosmeticChoice(data.loadout?.primaryReticle??p.selectedReticle,"reticle","classic"),
    secondaryReticle:cosmeticChoice(data.loadout?.secondaryReticle??p.selectedReticle,"reticle","classic"),
    primaryCharm:cosmeticChoice(data.loadout?.primaryCharm??legacyCharms[data.loadout?.primaryWeapon??""],"charm","none"),
    secondaryCharm:cosmeticChoice(data.loadout?.secondaryCharm??legacyCharms[data.loadout?.secondaryWeapon??""],"charm","none"),
    cosmeticsMigrated:true,
    perkId: restoredPerk.unlockLevel <= levelForXp(restoredXp) ? restoredPerk.id : DEFAULT_PERK_ID,
    ...(data.loadout?.secondaryWeaponSkin !== undefined ? { secondaryWeaponSkin: data.loadout.secondaryWeaponSkin } : {}),
    ...(data.loadout?.meleeWeaponSkin !== undefined ? { meleeWeaponSkin: data.loadout.meleeWeaponSkin } : {}),
    ...(data.loadout?.weaponSetups !== undefined ? { weaponSetups: data.loadout.weaponSetups } : {}),
    ...(data.loadout?.savedLoadouts !== undefined ? { savedLoadouts: JSON.stringify(parseSavedLoadouts(data.loadout.savedLoadouts)) } : {}),
  };

  if (existing) {
    // Update — take MAX of numeric progression fields to avoid downgrading.
    await db.player.update({
      where: { id: existing.id },
      data: {
        name: p.name,
        level: levelForXp(restoredXp),
        ...career,
        careerTokensSpent:restoredTokensSpent,
        wonderTokenLedgerReady:restoredWonderReady,
        wonderLegacyCredits:restoredWonderCredits,
        ...(p.selectedTitle !== undefined ? { selectedTitle: p.selectedTitle } : {}),
        ...(p.selectedReticle && cosmeticById(p.selectedReticle,"reticle")?{selectedReticle:p.selectedReticle}:{}),
        ...(p.selectedNameplate && cosmeticById(p.selectedNameplate,"nameplate")?{selectedNameplate:p.selectedNameplate}:{}),
        ...(p.equippedCharms?{equippedCharms:JSON.stringify({...parseEquippedCharms(existing.equippedCharms),...parseEquippedCharms(p.equippedCharms)})}:{}),
        pvpBestKillstreak: Math.max(existing.pvpBestKillstreak, p.pvpBestKillstreak ?? 0),
        xp: Math.max(existing.xp, p.xp),
        // Once Career spending starts, replaying a backup cannot refund it.
        credits: existing.careerRank > 0 || existingShopPurchases>0 ? existing.credits : Math.max(existing.credits, p.credits),
        kills: Math.max(existing.kills, p.kills),
        deaths: Math.max(existing.deaths, p.deaths),
        matchesPlayed: Math.max(existing.matchesPlayed, p.matchesPlayed),
        matchesWon: Math.max(existing.matchesWon, p.matchesWon),
        survivalBestWave: Math.max(existing.survivalBestWave, p.survivalBestWave),
        selectedSkin: p.selectedSkin,
        dailyChallengesCompleted: Math.max(existing.dailyChallengesCompleted, p.dailyChallengesCompleted),
        weeklyChallengesCompleted: Math.max(existing.weeklyChallengesCompleted, p.weeklyChallengesCompleted),
        eliteChallengesCompleted: Math.max(existing.eliteChallengesCompleted, p.eliteChallengesCompleted),
        totalChallengesCompleted: Math.max(existing.totalChallengesCompleted, p.totalChallengesCompleted),
        // 19a+19b: take the higher of existing vs imported bestKillstreak
        // (Math.max pattern matches the other lifetime stats above).
        bestKillstreak: Math.max(existing.bestKillstreak, p.bestKillstreak ?? 0),
      },
    });
  } else {
    // Create the player fresh.
    await db.player.create({
      data: {
        playerKey: targetKey,
        name: p.name,
        level: levelForXp(p.xp),
        ...career,
        careerTokensSpent:restoredTokensSpent,
        wonderTokenLedgerReady:restoredWonderReady,
        wonderLegacyCredits:restoredWonderCredits,
        selectedTitle: p.selectedTitle ?? "",
        selectedReticle: p.selectedReticle && cosmeticById(p.selectedReticle,"reticle")?p.selectedReticle:"classic",
        selectedNameplate: p.selectedNameplate && cosmeticById(p.selectedNameplate,"nameplate")?p.selectedNameplate:"standard",
        equippedCharms: JSON.stringify(parseEquippedCharms(p.equippedCharms)),
        pvpBestKillstreak: p.pvpBestKillstreak ?? 0,
        xp: p.xp,
        credits: p.credits,
        kills: p.kills,
        deaths: p.deaths,
        matchesPlayed: p.matchesPlayed,
        matchesWon: p.matchesWon,
        survivalBestWave: p.survivalBestWave,
        selectedSkin: p.selectedSkin,
        dailyChallengesCompleted: p.dailyChallengesCompleted,
        weeklyChallengesCompleted: p.weeklyChallengesCompleted,
        eliteChallengesCompleted: p.eliteChallengesCompleted,
        totalChallengesCompleted: p.totalChallengesCompleted,
        // 19a+19b: default to 0 if missing from the imported profile (backward
        // compat with older exports that didn't include this field).
        bestKillstreak: p.bestKillstreak ?? 0,
      },
    });
  }

  // Get the player (existing or newly created) for related-row operations.
  const player = await db.player.findUnique({ where: { playerKey: targetKey }, include: { loadout: true } });
  if (!player) {
    return NextResponse.json({ error: "Failed to resolve player after create/update" }, { status: 500 });
  }

  // --- Restore unlocks (dedup: skip if already exists) ---
  if (data.weaponUnlocks?.length) {
    const existingW = new Set((await db.weaponUnlock.findMany({ where: { playerId: player.id } })).map((u) => u.weaponId));
    const toCreate = data.weaponUnlocks.filter((u) => !existingW.has(u.weaponId));
    if (toCreate.length) await db.weaponUnlock.createMany({ data: toCreate.map((u) => ({ playerId: player.id, weaponId: u.weaponId })) });
  }
  if (data.skinUnlocks?.length) {
    const existingS = new Set((await db.skinUnlock.findMany({ where: { playerId: player.id } })).map((u) => `${u.weaponId}:${u.skinId}`));
    const toCreate = data.skinUnlocks.filter((u) => !existingS.has(`${u.weaponId}:${u.skinId}`));
    if (toCreate.length) await db.skinUnlock.createMany({ data: toCreate.map((u) => ({ playerId: player.id, weaponId: u.weaponId, skinId: u.skinId })) });
  }
  if (data.attachmentUnlocks?.length) {
    const existingA = new Set((await db.attachmentUnlock.findMany({ where: { playerId: player.id } })).map((u) => `${u.weaponId}:${u.attachmentId}`));
    const toCreate = data.attachmentUnlocks.filter((u) => !existingA.has(`${u.weaponId}:${u.attachmentId}`));
    if (toCreate.length) await db.attachmentUnlock.createMany({ data: toCreate.map((u) => ({ playerId: player.id, weaponId: u.weaponId, attachmentId: u.attachmentId })) });
  }

  // Old exports have no ownership list. Grandfather their equipped operator
  // without inventing ownership for skins not represented in the file.
  const candidateOperatorSkins = [
    ...(data.playerSkinUnlocks ?? []).map(u => u.skinId),
    data.player.selectedSkin,
  ].filter(id => typeof id === "string" && id !== "default");
  if (candidateOperatorSkins.length) {
    const existingOps = new Set(
      (await db.playerSkinUnlock.findMany({ where: { playerId: player.id } })).map(u => u.skinId),
    );
    const toCreate = [...new Set(candidateOperatorSkins)].filter(id => !existingOps.has(id));
    if (toCreate.length) await db.playerSkinUnlock.createMany({
      data: toCreate.map(skinId => ({ playerId: player.id, skinId })),
    });
  }

  // --- Restore loadout ---
  if (data.loadout) {
    if (player.loadout) {
      await db.loadout.update({
        where: { playerId: player.id },
        data: {
          ...restoredLoadout,
          primaryWeapon: data.loadout.primaryWeapon,
          secondaryWeapon: data.loadout.secondaryWeapon,
          meleeWeapon: data.loadout.meleeWeapon,
          weaponSkin: data.loadout.weaponSkin,
          playerSkin: data.loadout.playerSkin,
          attachments: data.loadout.attachments,
          secondaryAttachments: data.loadout.secondaryAttachments,
          meleeAttachments: data.loadout.meleeAttachments,
        },
      });
    } else {
      await db.loadout.create({
        data: {
          playerId: player.id,
          ...restoredLoadout,
          primaryWeapon: data.loadout.primaryWeapon,
          secondaryWeapon: data.loadout.secondaryWeapon,
          meleeWeapon: data.loadout.meleeWeapon,
          weaponSkin: data.loadout.weaponSkin,
          playerSkin: data.loadout.playerSkin,
          attachments: data.loadout.attachments,
          secondaryAttachments: data.loadout.secondaryAttachments,
          meleeAttachments: data.loadout.meleeAttachments,
        },
      });
    }
  }

  // --- Restore achievements (dedup) ---
  if (data.achievements?.length) {
    const existingAch = new Set((await db.playerAchievement.findMany({ where: { playerId: player.id } })).map((a) => a.achievementId));
    const toCreate = data.achievements.filter((a) => !existingAch.has(a.achievementId));
    if (toCreate.length) await db.playerAchievement.createMany({ data: toCreate.map((a) => ({ playerId: player.id, achievementId: a.achievementId, earnedAt: new Date(a.earnedAt) })) });
  }

  // --- Restore weapon progress (take MAX to avoid downgrading) ---
  if (data.weaponProgress?.length) {
    for (const wp of data.weaponProgress) {
      const existing = await db.weaponProgress.findUnique({ where: { playerId_weaponId: { playerId: player.id, weaponId: wp.weaponId } } });
      const imported = parseWeaponConditionStats(wp.conditionStats);
      if (existing) {
        const retained = parseWeaponConditionStats(existing.conditionStats);
        for (const key of Object.keys(retained) as Array<keyof typeof retained>) {
          retained[key] = Math.max(retained[key], imported[key]);
        }
        await db.weaponProgress.update({
          where: { id: existing.id },
          data: {
            kills: Math.max(existing.kills, wp.kills),
            headshots: Math.max(existing.headshots, wp.headshots),
            conditionStats: JSON.stringify(retained),
          },
        });
      } else {
        await db.weaponProgress.create({
          data: {
            playerId: player.id, weaponId: wp.weaponId, kills: wp.kills, headshots: wp.headshots,
            conditionStats: JSON.stringify(imported),
          },
        });
      }
    }
  }

  // --- Restore permanent Prestige awards, token entitlements and Wonder purchases.
  if (data.weaponPrestiges?.length) {
    for (const { weaponId, legacyReward } of data.weaponPrestiges) {
      if (!WEAPONS.some(w => w.id === weaponId && !w.wonder)) continue;
      await db.weaponPrestige.upsert({
        where: { playerId_weaponId: { playerId: player.id, weaponId } },
        create: { playerId: player.id, weaponId, legacyReward: legacyReward !== false }, update: {},
      });
    }
  }
  if (data.wonderTokenAwards?.length) {
    for (const { weaponId, legacy } of data.wonderTokenAwards) {
      if (!WEAPONS.some(w => w.id === weaponId && !w.wonder)) continue;
      const prestige = await db.weaponPrestige.findUnique({
        where: { playerId_weaponId: { playerId: player.id, weaponId } },
      });
      if (!prestige) continue;
      await db.wonderTokenAward.upsert({
        where: { playerId_weaponId: { playerId: player.id, weaponId } },
        create: { playerId: player.id, weaponId, legacy: legacy === true },
        update: {},
      });
    }
  }
  if (data.wonderUnlocks?.length) {
    for (const { weaponId } of data.wonderUnlocks) {
      if (!WEAPONS.some(w => w.id === weaponId && w.wonder)) continue;
      const owned = await db.wonderUnlock.findUnique({
        where: { playerId_weaponId: { playerId: player.id, weaponId } },
      });
      if (owned) continue;
      const [earned, spent, account, legacyPrestiges] = await Promise.all([
        db.wonderTokenAward.count({ where: { playerId: player.id } }),
        db.wonderUnlock.count({ where: { playerId: player.id } }),
        db.player.findUniqueOrThrow({ where: { id: player.id },
          select: { wonderTokenLedgerReady: true, wonderLegacyCredits: true } }),
        db.weaponPrestige.count({ where: { playerId: player.id } }),
      ]);
      const allowed = account.wonderTokenLedgerReady
        ? earned + account.wonderLegacyCredits : Math.max(earned, legacyPrestiges);
      if (spent < allowed) {
        await db.wonderUnlock.create({ data: { playerId: player.id, weaponId } });
      }
    }
  }

  // Career Contracts and purchase ledger survive backup/restore. Unique rows
  // are permanent; imports can never lower spent tokens or repeat an award.
  for(const record of data.careerRewards??[]){
    if(!Number.isSafeInteger(record.cycle)||record.cycle<0)continue;
    await db.careerReward.upsert({
      where:{playerId_cycle:{playerId:player.id,cycle:record.cycle}},
      create:{playerId:player.id,cycle:record.cycle},update:{},
    });
  }
  for(const record of data.careerContracts??[]){
    if(!Number.isSafeInteger(record.cycle)||record.cycle<0||typeof record.contractId!=="string"||record.contractId.length>80)continue;
    if(!Number.isSafeInteger(record.goal)||record.goal<1||!Number.isSafeInteger(record.progress)||record.progress<0)continue;
    const key={playerId:player.id,cycle:record.cycle,contractId:record.contractId};
    const existingContract=await db.careerContract.findUnique({where:{playerId_cycle_contractId:key}});
    await db.careerContract.upsert({
      where:{playerId_cycle_contractId:key},
      create:{...key,goal:record.goal,progress:Math.min(record.goal,record.progress),completed:!!record.completed},
      update:existingContract?{progress:Math.max(existingContract.progress,Math.min(existingContract.goal,record.progress)),
        completed:existingContract.completed||!!record.completed}:{},
    });
  }
  for(const record of data.careerShopPurchases??[]){
    if(typeof record.itemKey!=="string"||record.itemKey.length>128||
      !["career","credits"].includes(record.currency)||!Number.isSafeInteger(record.cost)||record.cost<0)continue;
    await db.careerShopPurchase.upsert({
      where:{playerId_itemKey:{playerId:player.id,itemKey:record.itemKey}},
      create:{playerId:player.id,itemKey:record.itemKey,currency:record.currency,cost:record.cost},update:{},
    });
  }

  // --- Restore match records (skip duplicates by playedAt+score — best-effort) ---
  if (data.matchRecords?.length) {
    const existingMR = await db.matchRecord.findMany({ where: { playerId: player.id }, select: { playedAt: true, score: true, kills: true } });
    const seen = new Set(existingMR.map((m) => `${m.playedAt.toISOString()}:${m.score}:${m.kills}`));
    const toCreate = data.matchRecords.filter((m) => !seen.has(`${new Date(m.playedAt).toISOString()}:${m.score}:${m.kills}`));
    if (toCreate.length) {
      await db.matchRecord.createMany({
        data: toCreate.map((m) => ({
          playerId: player.id,
          mode: m.mode,
          online: m.online,
          kills: m.kills,
          deaths: m.deaths,
          headshots: m.headshots,
          score: m.score,
          placement: m.placement,
          won: m.won,
          durationSec: m.durationSec,
          weaponId: m.weaponId,
          waves: m.waves,
          playedAt: new Date(m.playedAt),
        })),
      });
    }
  }

  return NextResponse.json({
    success: true,
    playerKey: targetKey,
    restored: {
      weaponUnlocks: data.weaponUnlocks?.length ?? 0,
      skinUnlocks: data.skinUnlocks?.length ?? 0,
      attachmentUnlocks: data.attachmentUnlocks?.length ?? 0,
      playerSkinUnlocks: data.playerSkinUnlocks?.length ?? 0,
      achievements: data.achievements?.length ?? 0,
      weaponProgress: data.weaponProgress?.length ?? 0,
      matchRecords: data.matchRecords?.length ?? 0,
    },
  });
}
