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
  weaponPrestiges?: { weaponId: string }[];
  wonderUnlocks?: { weaponId: string }[];
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

  if (existing) {
    // Update — take MAX of numeric progression fields to avoid downgrading.
    await db.player.update({
      where: { id: existing.id },
      data: {
        name: p.name,
        level: Math.max(existing.level, p.level),
        xp: Math.max(existing.xp, p.xp),
        credits: Math.max(existing.credits, p.credits),
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
        level: p.level,
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

  // --- Restore one-time Prestige awards and Wonder purchases (dedup by key).
  // Balance is derived from these two tables, not from a mutable imported counter.
  if (data.weaponPrestiges?.length) {
    for (const { weaponId } of data.weaponPrestiges) {
      if (!WEAPONS.some(w => w.id === weaponId && !w.wonder)) continue;
      await db.weaponPrestige.upsert({
        where: { playerId_weaponId: { playerId: player.id, weaponId } },
        create: { playerId: player.id, weaponId }, update: {},
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
      const [earned, spent] = await Promise.all([
        db.weaponPrestige.count({ where: { playerId: player.id } }),
        db.wonderUnlock.count({ where: { playerId: player.id } }),
      ]);
      if (spent < earned) {
        await db.wonderUnlock.create({ data: { playerId: player.id, weaponId } });
      }
    }
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
