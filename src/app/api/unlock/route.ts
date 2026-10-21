import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildProfileView, getOrCreatePlayer, effectiveUnlocks, safeWeaponId } from "@/lib/player-service";
import {
  WEAPONS,
  ATTACHMENTS,
  PLAYER_SKINS,
  WEAPON_SKINS,
  levelForXp,
  weaponById,
  weaponAttachmentSlots,
  compatibleAttachments,
  type AttachmentSlot,
} from "@/lib/game-data";
import { resolvePlayerKey } from "@/lib/auth";
import { attachmentChallenge, armoryChallengeProgress, operatorContract, skinChallengesForWeaponAndSkin } from "@/lib/armory-challenges";

export const dynamic = "force-dynamic";

type UnlockKind = "weapon" | "weaponSkin" | "playerSkin" | "attachment";

// POST /api/unlock
// Body: { playerKey, kind, itemId, weaponId? }
//  - kind="weapon"     : purchases a weapon by id (credits). weaponId not required.
//  - kind="playerSkin" : purchases an operative skin by id (credits).
//  - kind="attachment" : purchases an attachment PER-WEAPON. `weaponId` is required
//                        and the attachment must be compatible with that weapon.
//  - kind="weaponSkin" : purchases a skin for a specific owned weapon after
//                        its permanent per-weapon challenge is completed.
// Earning a challenge makes an item purchasable, not automatically owned.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    playerKey: bodyKey,
    kind,
    itemId,
    weaponId: bodyWeaponId,
  } = body as { playerKey?: string; kind?: UnlockKind; itemId?: string; weaponId?: string };
  const { playerKey } = await resolvePlayerKey(req, bodyKey);
  if (!playerKey || !kind || !itemId) {
    return NextResponse.json({ error: "playerKey, kind, itemId required" }, { status: 400 });
  }

  const player = await getOrCreatePlayer(playerKey);
  if (!player) return NextResponse.json({ error: "player not found" }, { status: 404 });
  const level = levelForXp(player.xp);

  if (kind === "weapon") {
    const def = WEAPONS.find((w) => w.id === itemId);
    if (!def) return NextResponse.json({ error: "item not found" }, { status: 404 });
    if (level < def.unlockLevel) return NextResponse.json({ error: `Requires level ${def.unlockLevel}` }, { status: 403 });
    if (player.credits < def.unlockCost) return NextResponse.json({ error: `Not enough credits (need ${def.unlockCost})` }, { status: 403 });
    const owned = effectiveUnlocks(level, {
      weapons: player.weaponUnlocks.map((u) => u.weaponId),
      weaponSkins: [],
      playerSkins: [],
      attachments: [],
    });
    if (owned.weapons.includes(itemId)) return NextResponse.json({ error: "already owned" }, { status: 400 });

    await db.$transaction(async (tx) => {
      await tx.player.update({ where: { id: player.id }, data: { credits: player.credits - def.unlockCost } });
      await tx.weaponUnlock.create({ data: { playerId: player.id, weaponId: itemId } });
    });

    const view = await buildProfileView(playerKey);
    return NextResponse.json({ ok: true, profile: view });
  }

  if (kind === "playerSkin") {
    const def = PLAYER_SKINS.find(s => s.id === itemId);
    if (!def) return NextResponse.json({ error: "item not found" }, { status: 404 });
    if (def.id === "default" || player.selectedSkin === itemId ||
      player.playerSkinUnlocks.some(p => p.skinId === itemId))
      return NextResponse.json({ error: "already owned" }, { status: 400 });

    const contract = operatorContract(itemId);
    if (!contract) return NextResponse.json({ error: "operator contract not found" }, { status: 403 });
    const headshots = await db.weaponProgress.aggregate({
      where: { playerId: player.id }, _sum: { headshots: true },
    });
    const ready = armoryChallengeProgress(contract, {
      kills: 0, headshots: 0, totalKills: player.kills,
      totalHeadshots: headshots._sum.headshots ?? 0,
      matches: player.matchesPlayed, wins: player.matchesWon,
    });
    if (!ready.completed) return NextResponse.json({ error: `Complete contract: ${contract.description}` }, { status: 403 });

    try {
      await db.$transaction(async tx => {
        const charged = await tx.player.updateMany({
          where: { id: player.id, credits: { gte: def.unlockCost } },
          data: { credits: { decrement: def.unlockCost } },
        });
        if (!charged.count) throw new Error("NOT_ENOUGH_CREDITS");
        await tx.playerSkinUnlock.create({ data: { playerId: player.id, skinId: itemId } });
        await tx.player.update({ where: { id: player.id }, data: { selectedSkin: itemId } });
        await tx.loadout.updateMany({ where: { playerId: player.id }, data: { playerSkin: itemId } });
      });
    } catch (e: any) {
      if (e?.message === "NOT_ENOUGH_CREDITS") return NextResponse.json({ error: "Not enough credits" }, { status: 403 });
      if (e?.code === "P2002") return NextResponse.json({ error: "already owned" }, { status: 400 });
      throw e;
    }
    return NextResponse.json({ ok: true, profile: await buildProfileView(playerKey) });
  }

  if (kind === "weaponSkin") {
    const def = WEAPON_SKINS.find(s => s.id === itemId);
    if (!def || !bodyWeaponId) return NextResponse.json({ error: "skin and weaponId required" }, { status: 400 });
    if (def.id === "default") return NextResponse.json({ error: "standard skin is free" }, { status: 400 });
    const weapon = WEAPONS.find(w => w.id === bodyWeaponId);
    if (!weapon) return NextResponse.json({ error: "invalid weapon" }, { status: 400 });
    const isWeaponOwned = player.weaponUnlocks.some(w => w.weaponId === weapon.id) ||
      (weapon.unlockCost === 0 && weapon.unlockLevel <= level);
    if (!isWeaponOwned) return NextResponse.json({ error: "weapon not owned" }, { status: 403 });
    const owned = await db.skinUnlock.findUnique({
      where: { playerId_weaponId_skinId: { playerId: player.id, weaponId: weapon.id, skinId: itemId } },
    });
    if (owned) return NextResponse.json({ error: "already owned" }, { status: 400 });
    const goalDefs = skinChallengesForWeaponAndSkin(weapon.id, itemId);
    if (!goalDefs.length) return NextResponse.json({ error: "skin has no valid challenge" }, { status: 403 });
    const stat = await db.weaponProgress.findUnique({
      where: { playerId_weaponId: { playerId: player.id, weaponId: weapon.id } },
    });
    const done = goalDefs.some(ch => (ch.metric === "kills" ? stat?.kills ?? 0 : stat?.headshots ?? 0) >= ch.goal);
    if (!done) return NextResponse.json({ error: "Complete the weapon skin challenge first" }, { status: 403 });
    try {
      await db.$transaction(async tx => {
        const charged = await tx.player.updateMany({
          where: { id: player.id, credits: { gte: def.unlockCost } },
          data: { credits: { decrement: def.unlockCost } },
        });
        if (!charged.count) throw new Error("NOT_ENOUGH_CREDITS");
        await tx.skinUnlock.create({ data: { playerId: player.id, weaponId: weapon.id, skinId: def.id } });
      });
    } catch (e: any) {
      if (e?.message === "NOT_ENOUGH_CREDITS") return NextResponse.json({ error: "Not enough credits" }, { status: 403 });
      if (e?.code === "P2002") return NextResponse.json({ error: "already owned" }, { status: 400 });
      throw e;
    }
    return NextResponse.json({ ok: true, profile: await buildProfileView(playerKey) });
  }

  if (kind === "attachment") {
    // Per-weapon attachment purchase. `weaponId` is required and must be a
    // catalog weapon the player owns. The attachment must be in a slot the
    // weapon supports AND in the per-weapon compatibility list.
    if (!bodyWeaponId) {
      return NextResponse.json({ error: "weaponId required for attachment unlocks" }, { status: 400 });
    }
    const weaponId = safeWeaponId(bodyWeaponId);
    const weaponDef = weaponById(weaponId);
    const attachmentDef = ATTACHMENTS.find((a) => a.id === itemId);
    if (!attachmentDef) return NextResponse.json({ error: "item not found" }, { status: 404 });

    // Verify the player owns the weapon (or it's free / auto-unlocked).
    const ownedWeapons = effectiveUnlocks(level, {
      weapons: player.weaponUnlocks.map((u) => u.weaponId),
      weaponSkins: [],
      playerSkins: [],
      attachments: [],
    }).weapons;
    if (!ownedWeapons.includes(weaponId)) {
      return NextResponse.json({ error: "you don't own this weapon yet" }, { status: 403 });
    }

    // Slot support check: weapon.attachments (or all 4 if undefined).
    const supportedSlots = weaponAttachmentSlots(weaponDef);
    if (!supportedSlots.includes(attachmentDef.slot as AttachmentSlot)) {
      return NextResponse.json({ error: `weapon does not support the ${attachmentDef.slot} slot` }, { status: 400 });
    }
    // Compatibility check: WEAPON_ATTACHMENT_COMPAT map (or all attachments in slot if not in map).
    const allowedIds = compatibleAttachments(weaponId, attachmentDef.slot as AttachmentSlot);
    if (!allowedIds.includes(attachmentDef.id)) {
      return NextResponse.json({ error: "attachment not compatible with this weapon" }, { status: 400 });
    }

    const ch = attachmentChallenge(weaponId, attachmentDef.id);
    if (!ch) return NextResponse.json({ error: "attachment challenge not found" }, { status: 403 });
    const stats = await db.weaponProgress.findUnique({
      where: { playerId_weaponId: { playerId: player.id, weaponId } },
    });
    if (!armoryChallengeProgress(ch, {
      kills: stats?.kills ?? 0, headshots: stats?.headshots ?? 0,
      matches: 0, wins: 0, totalKills: 0, totalHeadshots: 0,
    }).completed) return NextResponse.json({ error: `Complete challenge: ${ch.description}` }, { status: 403 });
    if (player.credits < attachmentDef.unlockCost) return NextResponse.json({ error: `Not enough credits (need ${attachmentDef.unlockCost})` }, { status: 403 });

    // Check already owned PER-WEAPON.
    const existing = await db.attachmentUnlock.findUnique({
      where: { playerId_weaponId_attachmentId: { playerId: player.id, weaponId, attachmentId: attachmentDef.id } },
    });
    if (existing) return NextResponse.json({ error: "already owned for this weapon" }, { status: 400 });

    try {
      await db.$transaction(async tx => {
        const charged = await tx.player.updateMany({
          where: { id: player.id, credits: { gte: attachmentDef.unlockCost } },
          data: { credits: { decrement: attachmentDef.unlockCost } },
        });
        if (!charged.count) throw new Error("NOT_ENOUGH_CREDITS");
        await tx.attachmentUnlock.create({ data: { playerId: player.id, weaponId, attachmentId: attachmentDef.id } });
      });
    } catch (e: any) {
      if (e?.message === "NOT_ENOUGH_CREDITS") return NextResponse.json({ error: "Not enough credits" }, { status: 403 });
      if (e?.code === "P2002") return NextResponse.json({ error: "already owned" }, { status: 400 });
      throw e;
    }

    const view = await buildProfileView(playerKey);
    return NextResponse.json({ ok: true, profile: view });
  }

  return NextResponse.json({ error: "unknown kind" }, { status: 400 });
}
