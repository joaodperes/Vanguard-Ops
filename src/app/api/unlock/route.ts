import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildProfileView, getOrCreatePlayer, effectiveUnlocks, safeWeaponId } from "@/lib/player-service";
import {
  WEAPONS,
  ATTACHMENTS,
  PLAYER_SKINS,
  levelForXp,
  weaponById,
  weaponAttachmentSlots,
  compatibleAttachments,
  type AttachmentSlot,
} from "@/lib/game-data";
import { resolvePlayerKey } from "@/lib/auth";

export const dynamic = "force-dynamic";

type UnlockKind = "weapon" | "playerSkin" | "attachment";

// POST /api/unlock
// Body: { playerKey, kind, itemId, weaponId? }
//  - kind="weapon"     : purchases a weapon by id (credits). weaponId not required.
//  - kind="playerSkin" : purchases an operative skin by id (credits).
//  - kind="attachment" : purchases an attachment PER-WEAPON. `weaponId` is required
//                        and the attachment must be compatible with that weapon.
//  - (kind="weaponSkin" was removed — weapon skins now unlock exclusively via
//     per-weapon challenges applied during match completion.)
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
    const def = PLAYER_SKINS.find((s) => s.id === itemId);
    if (!def) return NextResponse.json({ error: "item not found" }, { status: 404 });
    if (level < def.unlockLevel) return NextResponse.json({ error: `Requires level ${def.unlockLevel}` }, { status: 403 });
    if (player.credits < def.unlockCost) return NextResponse.json({ error: `Not enough credits (need ${def.unlockCost})` }, { status: 403 });

    await db.$transaction(async (tx) => {
      await tx.player.update({ where: { id: player.id }, data: { credits: player.credits - def.unlockCost, selectedSkin: itemId } });
    });

    const view = await buildProfileView(playerKey);
    return NextResponse.json({ ok: true, profile: view });
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

    if (level < attachmentDef.unlockLevel) return NextResponse.json({ error: `Requires level ${attachmentDef.unlockLevel}` }, { status: 403 });
    if (player.credits < attachmentDef.unlockCost) return NextResponse.json({ error: `Not enough credits (need ${attachmentDef.unlockCost})` }, { status: 403 });

    // Check already owned PER-WEAPON.
    const existing = await db.attachmentUnlock.findUnique({
      where: { playerId_weaponId_attachmentId: { playerId: player.id, weaponId, attachmentId: attachmentDef.id } },
    });
    if (existing) return NextResponse.json({ error: "already owned for this weapon" }, { status: 400 });

    await db.$transaction(async (tx) => {
      await tx.player.update({ where: { id: player.id }, data: { credits: player.credits - attachmentDef.unlockCost } });
      await tx.attachmentUnlock.create({ data: { playerId: player.id, weaponId, attachmentId: attachmentDef.id } });
    });

    const view = await buildProfileView(playerKey);
    return NextResponse.json({ ok: true, profile: view });
  }

  return NextResponse.json({ error: "unknown kind" }, { status: 400 });
}
