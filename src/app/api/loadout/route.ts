import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildProfileView, getOrCreatePlayer, safeWeaponId } from "@/lib/player-service";
import {
  WEAPONS,
  weaponById,
  weaponAttachmentSlots,
  compatibleAttachments,
  WEAPON_CHALLENGES,
  WEAPON_SKINS,
  isStandardSkin,
  type AttachmentSlot,
} from "@/lib/game-data";
import { resolvePlayerKey } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/loadout?playerKey=...
export async function GET(req: NextRequest) {
  const qp = req.nextUrl.searchParams.get("playerKey") ?? undefined;
  const { playerKey } = await resolvePlayerKey(req, qp);
  if (!playerKey) return NextResponse.json({ error: "playerKey required" }, { status: 400 });
  const view = await buildProfileView(playerKey);
  return NextResponse.json(view?.loadout ?? null);
}

// Clean + validate an attachment map for a given weapon. Drops any attachment
// ids that aren't in a slot the weapon supports, or aren't in the per-weapon
// compatibility list. Returns a JSON string suitable for the DB column.
function sanitizeAttachments(
  weaponId: string,
  raw: Record<string, string | null> | undefined,
): string {
  if (!raw) return "{}";
  const wdef = weaponById(weaponId);
  const supportedSlots = weaponAttachmentSlots(wdef);
  const cleaned: Record<string, string | null> = {};
  for (const slot of supportedSlots) {
    const id = raw[slot];
    if (!id) {
      cleaned[slot] = null;
      continue;
    }
    const allowed = compatibleAttachments(weaponId, slot as AttachmentSlot);
    if (allowed.includes(id)) cleaned[slot] = id;
    // silently drop incompatible ids (client should have filtered already)
  }
  return JSON.stringify(cleaned);
}

// POST /api/loadout
// Body: { playerKey, primaryWeapon?, secondaryWeapon?, meleeWeapon?, weaponSkin?,
//         secondaryWeaponSkin?, meleeWeaponSkin?, playerSkin?,
//         attachments?, secondaryAttachments?, meleeAttachments? }
// Each field is optional; only provided fields are updated. Skins are per-weapon
// (like attachments) — weaponSkin applies to the primary, secondaryWeaponSkin to
// the secondary, meleeWeaponSkin to the melee slot.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    playerKey: bodyKey,
    primaryWeapon,
    secondaryWeapon,
    meleeWeapon,
    weaponSkin,
    secondaryWeaponSkin,
    meleeWeaponSkin,
    playerSkin,
    attachments,
    secondaryAttachments,
    meleeAttachments,
  } = body as {
    playerKey?: string;
    primaryWeapon?: string;
    secondaryWeapon?: string;
    meleeWeapon?: string;
    weaponSkin?: string;
    secondaryWeaponSkin?: string;
    meleeWeaponSkin?: string;
    playerSkin?: string;
    attachments?: Record<string, string | null>;
    secondaryAttachments?: Record<string, string | null>;
    meleeAttachments?: Record<string, string | null>;
  };
  const { playerKey } = await resolvePlayerKey(req, bodyKey);
  if (!playerKey) return NextResponse.json({ error: "playerKey required" }, { status: 400 });
  const player = await getOrCreatePlayer(playerKey);
  if (!player) return NextResponse.json({ error: "player not found" }, { status: 404 });

  // Validate weapon selections against the catalog and their slot constraints.
  if (primaryWeapon !== undefined) {
    const w = WEAPONS.find((x) => x.id === primaryWeapon);
    if (!w) return NextResponse.json({ error: "unknown primaryWeapon" }, { status: 400 });
    if (w.category === "sidearm" || w.category === "melee") {
      return NextResponse.json({ error: "primaryWeapon must be a primary-slot weapon" }, { status: 400 });
    }
  }
  if (secondaryWeapon !== undefined) {
    const w = WEAPONS.find((x) => x.id === secondaryWeapon);
    if (!w) return NextResponse.json({ error: "unknown secondaryWeapon" }, { status: 400 });
    if (w.category !== "sidearm") {
      return NextResponse.json({ error: "secondaryWeapon must be a sidearm" }, { status: 400 });
    }
  }
  if (meleeWeapon !== undefined) {
    const w = WEAPONS.find((x) => x.id === meleeWeapon);
    if (!w) return NextResponse.json({ error: "unknown meleeWeapon" }, { status: 400 });
    if (w.category !== "melee") {
      return NextResponse.json({ error: "meleeWeapon must be a melee weapon" }, { status: 400 });
    }
  }

  // If attachments are provided, validate each is compatible with the equipped
  // primary weapon (after this update is applied). Drop any incompatible ones.
  let attsJson: string | undefined;
  if (attachments !== undefined) {
    const effectivePrimary = safeWeaponId(primaryWeapon ?? player.loadout?.primaryWeapon ?? "rifle_ar");
    attsJson = sanitizeAttachments(effectivePrimary, attachments);
  }
  // Secondary attachments apply to the equipped secondary (sidearm). Sidearms
  // support attachments just like primaries — validate + clean the same way.
  let secAttsJson: string | undefined;
  if (secondaryAttachments !== undefined) {
    const effectiveSecondary = safeWeaponId(secondaryWeapon ?? player.loadout?.secondaryWeapon ?? "pistol_side");
    secAttsJson = sanitizeAttachments(effectiveSecondary, secondaryAttachments);
  }
  // Melee attachments: melee weapons don't take attachments — always "{}".
  // We still accept the field for API symmetry but persist an empty object.
  let melAttsJson: string | undefined;
  if (meleeAttachments !== undefined) {
    melAttsJson = "{}";
  }

  // If a weaponSkin is provided, ensure it's unlocked for the equipped primary.
  // If not, silently drop it (resolveLoadout will also fall back to "default").
  // Standard-tier skins unlock globally — check for ANY row for this skinId
  // (wildcard OR specific weaponId). Non-standard skins check the specific
  // (weaponId, skinId) pair only.
  // This validation runs PER-SLOT: the primary skin is checked against the
  // primary weapon, the secondary skin against the secondary weapon, etc.
  const sanitizeSkinForWeapon = async (skinId: string | undefined, weaponId: string): Promise<string | undefined> => {
    if (skinId === undefined || skinId === "default") return skinId;
    if (!WEAPON_SKINS.some(s => s.id === skinId)) return undefined;
    const owned = await db.skinUnlock.findUnique({
      where: { playerId_weaponId_skinId: { playerId: player.id, weaponId, skinId } },
    });
    // A completed challenge is only eligibility to buy, not permission to equip.
    return owned ? skinId : undefined;
  };
  const effectivePrimary = safeWeaponId(primaryWeapon ?? player.loadout?.primaryWeapon ?? "rifle_ar");
  const effectiveSecondary = safeWeaponId(secondaryWeapon ?? player.loadout?.secondaryWeapon ?? "pistol_side");
  const effectiveMelee = safeWeaponId(meleeWeapon ?? player.loadout?.meleeWeapon ?? "knife_tactical");
  const sanitizedWeaponSkin = await sanitizeSkinForWeapon(weaponSkin, effectivePrimary);
  const sanitizedSecondarySkin = await sanitizeSkinForWeapon(secondaryWeaponSkin, effectiveSecondary);
  const sanitizedMeleeSkin = await sanitizeSkinForWeapon(meleeWeaponSkin, effectiveMelee);
  if (playerSkin !== undefined &&
      playerSkin !== "default" && playerSkin !== player.selectedSkin &&
      !player.playerSkinUnlocks.some(u => u.skinId === playerSkin)) {
    return NextResponse.json({ error: "operator skin not owned" }, { status: 403 });
  }

  await db.loadout.upsert({
    where: { playerId: player.id },
    create: {
      playerId: player.id,
      primaryWeapon: primaryWeapon ?? "rifle_ar",
      secondaryWeapon: secondaryWeapon ?? "pistol_side",
      meleeWeapon: meleeWeapon ?? "knife_tactical",
      weaponSkin: sanitizedWeaponSkin ?? "default",
      secondaryWeaponSkin: sanitizedSecondarySkin ?? "default",
      meleeWeaponSkin: sanitizedMeleeSkin ?? "default",
      playerSkin: playerSkin ?? "default",
      attachments: attsJson ?? "{}",
      secondaryAttachments: secAttsJson ?? "{}",
      meleeAttachments: melAttsJson ?? "{}",
    },
    update: {
      ...(primaryWeapon !== undefined ? { primaryWeapon } : {}),
      ...(secondaryWeapon !== undefined ? { secondaryWeapon } : {}),
      ...(meleeWeapon !== undefined ? { meleeWeapon } : {}),
      ...(sanitizedWeaponSkin !== undefined ? { weaponSkin: sanitizedWeaponSkin } : {}),
      ...(sanitizedSecondarySkin !== undefined ? { secondaryWeaponSkin: sanitizedSecondarySkin } : {}),
      ...(sanitizedMeleeSkin !== undefined ? { meleeWeaponSkin: sanitizedMeleeSkin } : {}),
      ...(playerSkin !== undefined ? { playerSkin } : {}),
      ...(attsJson !== undefined ? { attachments: attsJson } : {}),
      ...(secAttsJson !== undefined ? { secondaryAttachments: secAttsJson } : {}),
      ...(melAttsJson !== undefined ? { meleeAttachments: melAttsJson } : {}),
    },
  });
  if (playerSkin !== undefined) {
    await db.player.update({ where: { id: player.id }, data: { selectedSkin: playerSkin } });
  }
  const view = await buildProfileView(playerKey);
  return NextResponse.json(view);
}
