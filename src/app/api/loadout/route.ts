import { levelForXp } from "@/lib/progression";
import { NextRequest, NextResponse } from "next/server";
import { parseWeaponSetups, rememberSetup } from "@/lib/weapon-setups";
import { parseSavedLoadouts } from "@/lib/saved-loadouts";
import { cosmeticById, cosmeticShopOwnership } from "@/lib/cosmetics";
import { db } from "@/lib/db";
import { attachmentsForWeaponSelection, emptyAttachmentMap } from "@/lib/loadout-attachments";
import { weaponChallengeProgress, weaponMasteryProgress, parseWeaponConditionStats } from "@/lib/armory-challenges";
import { skinChallengesForWeaponAndSkin } from "@/lib/armory-challenges";
import { buildProfileView, getOrCreatePlayer, safeWeaponId } from "@/lib/player-service";
import {
  WEAPONS,
  isPrimaryWeaponCategory,
  weaponById,
  weaponAttachmentSlots,
  compatibleAttachments,
  WEAPON_CHALLENGES,
  WEAPON_SKINS,
  isStandardSkin,
  type AttachmentSlot,
} from "@/lib/game-data";
import { resolvePlayerKey } from "@/lib/auth";
import { canEquipSecondaryPrimary, DEFAULT_PERK_ID, perkById } from "@/lib/perks";

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
  const wdef = weaponById(weaponId);
  const supportedSlots = weaponAttachmentSlots(wdef);
  const cleaned: Record<AttachmentSlot, string | null> = emptyAttachmentMap();
  if (!raw) return JSON.stringify(cleaned);
  for (const slot of supportedSlots) {
    const id = raw[slot];
    if (!id) {
      cleaned[slot] = null;
      continue;
    }
    const allowed = compatibleAttachments(weaponId, slot as AttachmentSlot);
    if (allowed.includes(id)) cleaned[slot] = id;
    // Keep null for incompatible ids; an old attachment can never survive as
    // a ghost optic when changing the weapon in the same loadout slot.
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
  // Equipping a saved preset flows through this same validation/ownership path
  // as manual Armory changes. Preset content is always loaded from the DB.
  const rawBody = await req.json().catch(() => ({}));
  let body = rawBody;
  if (typeof rawBody.presetId === "string") {
    const { playerKey: ownerKey } = await resolvePlayerKey(req, rawBody.playerKey);
    if (!ownerKey) return NextResponse.json({ error: "playerKey required" }, { status: 400 });
    const owner = await getOrCreatePlayer(ownerKey);
    const preset = parseSavedLoadouts(owner.loadout?.savedLoadouts).find(p => p.id === rawBody.presetId);
    if (!preset) return NextResponse.json({ error: "Saved loadout not found" }, { status: 404 });
    body = { ...preset, playerKey: rawBody.playerKey };
  }
  const {
    playerKey: bodyKey,
    primaryWeapon,
    secondaryWeapon: requestedSecondaryWeapon,
    perkId,
    meleeWeapon,
    weaponSkin,
    secondaryWeaponSkin,
    meleeWeaponSkin,
    playerSkin,
    attachments,
    secondaryAttachments,
    meleeAttachments,
    primaryReticle, secondaryReticle, primaryCharm, secondaryCharm,
  } = body as {
    playerKey?: string;
    primaryWeapon?: string;
    secondaryWeapon?: string;
    perkId?: string;
    meleeWeapon?: string;
    weaponSkin?: string;
    secondaryWeaponSkin?: string;
    meleeWeaponSkin?: string;
    playerSkin?: string;
    attachments?: Record<string, string | null>;
    secondaryAttachments?: Record<string, string | null>;
    meleeAttachments?: Record<string, string | null>;
    primaryReticle?: string; secondaryReticle?: string; primaryCharm?: string; secondaryCharm?: string;
  };
  const { playerKey } = await resolvePlayerKey(req, bodyKey);
  if (!playerKey) return NextResponse.json({ error: "playerKey required" }, { status: 400 });
  const player = await getOrCreatePlayer(playerKey);
  if (!player) return NextResponse.json({ error: "player not found" }, { status: 404 });

  // Level-gated passive unlocks: clients must explicitly identify the
  // selected perk when equipping a second primary. The server checks level.
  let selectedPerk = perkById(perkId ?? player.loadout?.perkId ?? DEFAULT_PERK_ID);
  if (perkId && (selectedPerk.id !== perkId || selectedPerk.unlockLevel > levelForXp(player.xp))) {
    return NextResponse.json({ error: "Perk is locked at your current level" }, { status: 403 });
  }
  if (selectedPerk.unlockLevel > levelForXp(player.xp)) selectedPerk = perkById(DEFAULT_PERK_ID);
  let secondaryWeapon = requestedSecondaryWeapon;
  // A perk-only update must also remove a now-ineligible second primary.
  // Pass the fallback through the normal attachment/skin/setup validation.
  const storedSecondary = weaponById(player.loadout?.secondaryWeapon ?? "pistol_side");
  if (secondaryWeapon === undefined && isPrimaryWeaponCategory(storedSecondary.category) &&
      (!canEquipSecondaryPrimary(selectedPerk.id, levelForXp(player.xp)) ||
       storedSecondary.id === (primaryWeapon ?? player.loadout?.primaryWeapon ?? "rifle_ar"))) {
    secondaryWeapon = "pistol_side";
  }
  // Validate weapon selections against the catalog and their slot constraints.
  if (primaryWeapon !== undefined) {
    const w = WEAPONS.find((x) => x.id === primaryWeapon);
    if (!w) return NextResponse.json({ error: "unknown primaryWeapon" }, { status: 400 });
    if (w.disabled) return NextResponse.json({ error: "Weapon is temporarily disabled" }, { status: 403 });
    if (w.wonder) {
      const owned = await db.wonderUnlock.findUnique({ where: {
        playerId_weaponId: { playerId: player.id, weaponId: w.id },
      } });
      if (!owned) return NextResponse.json({ error: "Unlock this Wonder Weapon using a Prestige token first" }, { status: 403 });
    }
    if (!w.wonder && w.unlockCost > 0 && !player.weaponUnlocks.some(u => u.weaponId === w.id)) {
      return NextResponse.json({ error: "Primary weapon must be unlocked or purchased first" }, { status: 403 });
    }
    if (!isPrimaryWeaponCategory(w.category)) {
      return NextResponse.json({ error: "primaryWeapon must be a primary-slot weapon" }, { status: 400 });
    }
  }
  if (secondaryWeapon !== undefined) {
    const w = WEAPONS.find((x) => x.id === secondaryWeapon);
    if (w?.disabled) return NextResponse.json({ error: "Weapon is temporarily disabled" }, { status: 403 });
    if (!w) return NextResponse.json({ error: "unknown secondaryWeapon" }, { status: 400 });
    if (!w.wonder && w.unlockCost > 0 && !player.weaponUnlocks.some(u => u.weaponId === w.id)) {
      return NextResponse.json({ error: "Secondary weapon must be unlocked or purchased first" }, { status: 403 });
    }
    const anotherPrimary = isPrimaryWeaponCategory(w.category);
    if (anotherPrimary && (!canEquipSecondaryPrimary(selectedPerk.id, levelForXp(player.xp)) || w.wonder ||
      w.id === (primaryWeapon ?? player.loadout?.primaryWeapon ?? "rifle_ar"))) {
      return NextResponse.json({ error: "Second primary requires Well Prepared (LVL 28), must be different from your first, and cannot be a Wonder Weapon" }, { status: 403 });
    }
    if (w.category === "melee") {
      return NextResponse.json({ error: "secondaryWeapon must be a pistol, PDW, launcher or a permitted second primary" }, { status: 400 });
    }
    if (anotherPrimary && w.unlockCost > 0 &&
      !player.weaponUnlocks.some(u => u.weaponId === w.id)) {
      return NextResponse.json({ error: "Second primary weapon is not owned" }, { status: 403 });
    }
  }
  if (meleeWeapon !== undefined) {
    const w = WEAPONS.find((x) => x.id === meleeWeapon);
    if (!w) return NextResponse.json({ error: "unknown meleeWeapon" }, { status: 400 });
    if (w.category !== "melee") {
      return NextResponse.json({ error: "meleeWeapon must be a melee weapon" }, { status: 400 });
    }
  }

  // Attachment maps are tied to the weapon, not transferable across different
  // weapons occupying the same primary/secondary loadout slot. A switch with
  // no supplied map clears every attachment, including any old optic. Explicit
  // None selections are also persisted as real null values.
  // Snapshot previous selections before changing any slot. A weapon's saved
  // setup follows its weapon ID rather than the transient loadout slot.
  const setups=parseWeaponSetups(player.loadout?.weaponSetups);
  if(player.loadout){
    rememberSetup(setups,player.loadout.primaryWeapon,player.loadout.weaponSkin,player.loadout.attachments);
    rememberSetup(setups,player.loadout.secondaryWeapon,player.loadout.secondaryWeaponSkin,player.loadout.secondaryAttachments);
    rememberSetup(setups,player.loadout.meleeWeapon,player.loadout.meleeWeaponSkin,player.loadout.meleeAttachments);
  }
  const previousPrimary = safeWeaponId(player.loadout?.primaryWeapon ?? "rifle_ar");
  const selectedPrimary = safeWeaponId(primaryWeapon ?? previousPrimary);
  const primaryAtts = attachmentsForWeaponSelection(previousPrimary, selectedPrimary, attachments ?? (previousPrimary !== selectedPrimary ? setups[selectedPrimary]?.attachments : undefined));
  const attsJson = primaryAtts === undefined ? undefined : sanitizeAttachments(selectedPrimary, primaryAtts);

  const previousSecondary = safeWeaponId(player.loadout?.secondaryWeapon ?? "pistol_side");
  const selectedSecondary = safeWeaponId(secondaryWeapon ?? previousSecondary);
  const secondaryAtts = attachmentsForWeaponSelection(previousSecondary, selectedSecondary, secondaryAttachments ?? (previousSecondary !== selectedSecondary ? setups[selectedSecondary]?.attachments : undefined));
  const secAttsJson = secondaryAtts === undefined ? undefined : sanitizeAttachments(selectedSecondary, secondaryAtts);
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
    const skinDef = WEAPON_SKINS.find(s => s.id === skinId);
    if (!skinDef) return undefined;
    if (skinDef.prestige) {
      const prestige=await db.weaponPrestige.findUnique({where:{
        playerId_weaponId:{playerId:player.id,weaponId},
      }});
      if(skinDef.prestige==="toxic")return prestige ? skinId:undefined;
      // Eventide belongs to rank-5 Mastery, independent of Prestige.
      // Historical pre-split Prestige awards retain their Eventide entitlement.
      const progress=await db.weaponProgress.findUnique({where:{
        playerId_weaponId:{playerId:player.id,weaponId},
      }});
      return prestige?.legacyReward || weaponMasteryProgress(
        progress?.kills??0,progress?.headshots??0,weaponId,
      ).rank===5 ? skinId:undefined;
    }
    const owned = await db.skinUnlock.findUnique({
      where: { playerId_weaponId_skinId: { playerId: player.id, weaponId, skinId } },
    });
    // A completed challenge is only eligibility to buy, not permission to equip.
    if (owned) return skinId;
    // Legacy wildcard grants existed before paid per-weapon unlocks. Preserve
    // only if this specific weapon already completed its own skin challenge.
    const legacy = await db.skinUnlock.findUnique({
      where: { playerId_weaponId_skinId: { playerId: player.id, weaponId: "*", skinId } },
    });
    if (!legacy) return undefined;
    const stats = await db.weaponProgress.findUnique({
      where: { playerId_weaponId: { playerId: player.id, weaponId } },
    });
    return skinChallengesForWeaponAndSkin(weaponId, skinId).some(ch =>
      weaponChallengeProgress(ch, { kills: stats?.kills ?? 0, headshots: stats?.headshots ?? 0,
        conditionStats: parseWeaponConditionStats(stats?.conditionStats) }).completed,
    ) ? skinId : undefined;
  };
  const effectivePrimary = safeWeaponId(primaryWeapon ?? player.loadout?.primaryWeapon ?? "rifle_ar");
  const effectiveSecondary = safeWeaponId(secondaryWeapon ?? player.loadout?.secondaryWeapon ?? "pistol_side");
  const effectiveMelee = safeWeaponId(meleeWeapon ?? player.loadout?.meleeWeapon ?? "knife_tactical");
  const candidatePrimarySkin = await sanitizeSkinForWeapon(weaponSkin ?? (effectivePrimary!==previousPrimary ? setups[effectivePrimary]?.skin ?? "default" : undefined), effectivePrimary);
  const candidateSecondarySkin = await sanitizeSkinForWeapon(secondaryWeaponSkin ?? (effectiveSecondary!==previousSecondary ? setups[effectiveSecondary]?.skin ?? "default" : undefined), effectiveSecondary);
  const candidateMeleeSkin = await sanitizeSkinForWeapon(meleeWeaponSkin ?? (effectiveMelee!==(player.loadout?.meleeWeapon??"knife_tactical") ? setups[effectiveMelee]?.skin ?? "default" : undefined), effectiveMelee);
  // On a weapon swap, never retain the outgoing weapon's old skin if a
  // previously saved skin is now unowned or invalid.
  const sanitizedWeaponSkin=candidatePrimarySkin??(effectivePrimary!==previousPrimary?"default":undefined);
  const sanitizedSecondarySkin=candidateSecondarySkin??(effectiveSecondary!==previousSecondary?"default":undefined);
  const sanitizedMeleeSkin=candidateMeleeSkin??(effectiveMelee!==(player.loadout?.meleeWeapon??"knife_tactical")?"default":undefined);
    if (playerSkin !== undefined &&
      playerSkin !== "default" && playerSkin !== player.selectedSkin &&
      !player.playerSkinUnlocks.some(u => u.skinId === playerSkin)) {
    return NextResponse.json({ error: "operator skin not owned" }, { status: 403 });
  }

  // Validate all paid cosmetic choices before committing an updated loadout.
  const cosmeticSelections = { primaryReticle, secondaryReticle, primaryCharm, secondaryCharm };
  const selections = Object.entries(cosmeticSelections).filter(([, id]) => id !== undefined);
  if (selections.length) {
    const purchases = await db.careerShopPurchase.findMany({ where: { playerId: player.id }, select: { itemKey: true } });
    const owned = cosmeticShopOwnership(purchases.map(p => p.itemKey));
    for (const [field, id] of selections) {
      const kind = field.endsWith("Reticle") ? "reticle" : "charm";
      if (typeof id !== "string" || !cosmeticById(id, kind)) return NextResponse.json({ error: "Unknown cosmetic option" }, { status: 400 });
      if (!owned.includes(id)) return NextResponse.json({ error: "Buy this cosmetic in the Shop before equipping" }, { status: 403 });
    }
  }
  const primaryWonder = !!weaponById(effectivePrimary).wonder;
  const secondaryWonder = !!weaponById(effectiveSecondary).wonder;
  if ((primaryWonder && primaryCharm !== undefined && primaryCharm !== "none") ||
      (secondaryWonder && secondaryCharm !== undefined && secondaryCharm !== "none")) {
    return NextResponse.json({ error: "Wonder Weapons cannot equip charms" }, { status: 403 });
  }

  // Persist each newly chosen setup after ownership/compatibility checks,
  // preserving explicit None attachments and falling back to default when a
  // formerly owned skin is no longer available.
  rememberSetup(setups,effectivePrimary,sanitizedWeaponSkin??player.loadout?.weaponSkin??"default",
    attsJson??player.loadout?.attachments??"{}");
  rememberSetup(setups,effectiveSecondary,sanitizedSecondarySkin??player.loadout?.secondaryWeaponSkin??"default",
    secAttsJson??player.loadout?.secondaryAttachments??"{}");
  rememberSetup(setups,effectiveMelee,sanitizedMeleeSkin??player.loadout?.meleeWeaponSkin??"default",
    melAttsJson??player.loadout?.meleeAttachments??"{}");
  await db.loadout.upsert({
    where: { playerId: player.id },
    create: {
      playerId: player.id,
      primaryWeapon: primaryWeapon ?? "rifle_ar",
      secondaryWeapon: secondaryWeapon ?? "pistol_side",
      meleeWeapon: meleeWeapon ?? "knife_tactical",
      perkId: selectedPerk.id,
      weaponSkin: sanitizedWeaponSkin ?? "default",
      secondaryWeaponSkin: sanitizedSecondarySkin ?? "default",
      meleeWeaponSkin: sanitizedMeleeSkin ?? "default",
      playerSkin: playerSkin ?? "default",
      primaryReticle: primaryReticle ?? "classic", secondaryReticle: secondaryReticle ?? "classic",
      primaryCharm: primaryWonder ? "none" : primaryCharm ?? "none",
      secondaryCharm: secondaryWonder ? "none" : secondaryCharm ?? "none",
      cosmeticsMigrated: true,
      attachments: attsJson ?? "{}",
      secondaryAttachments: secAttsJson ?? "{}",
      meleeAttachments: melAttsJson ?? "{}",
      weaponSetups:JSON.stringify(setups),
    },
    update: {
      weaponSetups:JSON.stringify(setups),
      ...(primaryReticle !== undefined ? { primaryReticle } : {}),
      ...(secondaryReticle !== undefined ? { secondaryReticle } : {}),
      ...(primaryCharm !== undefined || primaryWonder ? { primaryCharm: primaryWonder ? "none" : primaryCharm } : {}),
      ...(secondaryCharm !== undefined || secondaryWonder ? { secondaryCharm: secondaryWonder ? "none" : secondaryCharm } : {}),
      ...(selections.length ? { cosmeticsMigrated: true } : {}),
      ...(primaryWeapon !== undefined ? { primaryWeapon } : {}),
      ...(secondaryWeapon !== undefined ? { secondaryWeapon } : {}),
      ...(meleeWeapon !== undefined ? { meleeWeapon } : {}),
      perkId: selectedPerk.id,
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
    // The old Armory only stored the last selected operator, not every
    // purchase. Preserve this last known legacy entitlement before switching.
    if (player.selectedSkin !== "default") {
      await db.playerSkinUnlock.upsert({
        where: { playerId_skinId: { playerId: player.id, skinId: player.selectedSkin } },
        create: { playerId: player.id, skinId: player.selectedSkin },
        update: {},
      });
    }
    await db.player.update({ where: { id: player.id }, data: { selectedSkin: playerSkin } });
  }
  const view = await buildProfileView(playerKey);
  return NextResponse.json(view);
}
