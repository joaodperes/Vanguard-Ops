import { levelForXp } from "@/lib/progression";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolvePlayerKey } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/profile/export?playerKey=...
// Exports the player's entire progression as a JSON file. The player can save
// this file as a backup. If the server DB is ever wiped (e.g. a redeploy that
// loses the persistent volume), the player can restore via /api/profile/import.
//
// The export includes: player row, all unlocks (weapons/skins/attachments),
// loadout, match records, achievements, daily challenges, and weapon progress.
// It does NOT include User (email/password) rows — those are tied to accounts
// and can't be restored without re-registering.
export async function GET(req: NextRequest) {
  const qp = req.nextUrl.searchParams.get("playerKey") ?? undefined;
  const { playerKey } = await resolvePlayerKey(req, qp);
  if (!playerKey) {
    return NextResponse.json({ error: "playerKey required" }, { status: 400 });
  }

  const player = await db.player.findUnique({
    where: { playerKey },
    include: {
      weaponUnlocks: true,
      skinUnlocks: true,
      attachmentUnlocks: true,
      playerSkinUnlocks: true,
      loadout: true,
      matchRecords: true,
      achievements: true,
      dailyChallenges: true,
      weaponProgress: true,
      weaponPrestiges: true,
      wonderUnlocks: true,
      careerContracts: true,
      careerRewards: true,
      careerShopPurchases: true,
    },
  });

  if (!player) {
    return NextResponse.json({ error: "player not found" }, { status: 404 });
  }

  const exportData = {
    format: "vanguard-ops-profile-v1",
    exportedAt: new Date().toISOString(),
    playerKey: player.playerKey,
    player: {
      name: player.name,
      level: levelForXp(player.xp),
      careerRank: player.careerRank,
      careerXp: player.careerXp,
      careerTokensSpent: player.careerTokensSpent,
      selectedTitle: player.selectedTitle,
      selectedReticle: player.selectedReticle,
      selectedNameplate: player.selectedNameplate,
      equippedCharms: player.equippedCharms,
      pvpBestKillstreak: player.pvpBestKillstreak,
      xp: player.xp,
      credits: player.credits,
      kills: player.kills,
      deaths: player.deaths,
      matchesPlayed: player.matchesPlayed,
      matchesWon: player.matchesWon,
      survivalBestWave: player.survivalBestWave,
      selectedSkin: player.selectedSkin,
      dailyChallengesCompleted: player.dailyChallengesCompleted,
      weeklyChallengesCompleted: player.weeklyChallengesCompleted,
      eliteChallengesCompleted: player.eliteChallengesCompleted,
      totalChallengesCompleted: player.totalChallengesCompleted,
      // 19a+19b: include lifetime best kill streak so profile transfers
      // preserve streak-achievement progress (Triple Threat / Killstreak King /
      // Untouchable Force).
      bestKillstreak: player.bestKillstreak,
    },
    weaponUnlocks: player.weaponUnlocks.map((u) => ({ weaponId: u.weaponId })),
    skinUnlocks: player.skinUnlocks.map((u) => ({ weaponId: u.weaponId, skinId: u.skinId })),
    attachmentUnlocks: player.attachmentUnlocks.map((u) => ({ weaponId: u.weaponId, attachmentId: u.attachmentId })),
    playerSkinUnlocks: player.playerSkinUnlocks.map(u => ({ skinId: u.skinId })),
    loadout: player.loadout
      ? {
          perkId: player.loadout.perkId,
          secondaryWeaponSkin: player.loadout.secondaryWeaponSkin,
          meleeWeaponSkin: player.loadout.meleeWeaponSkin,
          weaponSetups: player.loadout.weaponSetups,
          savedLoadouts: player.loadout.savedLoadouts,
          primaryWeapon: player.loadout.primaryWeapon,
          secondaryWeapon: player.loadout.secondaryWeapon,
          meleeWeapon: player.loadout.meleeWeapon,
          weaponSkin: player.loadout.weaponSkin,
          playerSkin: player.loadout.playerSkin,
          attachments: player.loadout.attachments,
          secondaryAttachments: player.loadout.secondaryAttachments,
          meleeAttachments: player.loadout.meleeAttachments,
        }
      : null,
    achievements: player.achievements.map((a) => ({ achievementId: a.achievementId, earnedAt: a.earnedAt })),
    weaponProgress: player.weaponProgress.map((w) => ({ weaponId: w.weaponId, kills: w.kills, headshots: w.headshots, conditionStats: w.conditionStats })),
    weaponPrestiges: player.weaponPrestiges.map(w => ({ weaponId: w.weaponId, legacyReward: w.legacyReward })),
    wonderUnlocks: player.wonderUnlocks.map(w => ({ weaponId: w.weaponId })),
    careerContracts: player.careerContracts.map(c=>({cycle:c.cycle,contractId:c.contractId,goal:c.goal,progress:c.progress,completed:c.completed})),
    careerRewards: player.careerRewards.map(r=>({cycle:r.cycle})),
    careerShopPurchases: player.careerShopPurchases.map(p=>({itemKey:p.itemKey,currency:p.currency,cost:p.cost})),
    // Match records can be large; include them for completeness but they're
    // optional on import (the import can skip them to save space).
    matchRecords: player.matchRecords.map((m) => ({
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
      playedAt: m.playedAt,
    })),
  };

  // Return as a downloadable JSON attachment.
  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="vanguard-ops-profile-${player.name.replace(/[^a-zA-Z0-9]/g, "_")}.json"`,
    },
  });
}
