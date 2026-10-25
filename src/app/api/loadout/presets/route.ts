import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { resolvePlayerKey } from "@/lib/auth";
import { getOrCreatePlayer, buildProfileView } from "@/lib/player-service";
import {
  MAX_SAVED_LOADOUTS, cleanLoadoutName, parseSavedLoadouts, captureSavedLoadout,
} from "@/lib/saved-loadouts";
import { DEFAULT_PERK_ID, perkById } from "@/lib/perks";

export const dynamic = "force-dynamic";

// Save the player's CURRENT equipped gear. The client cannot submit arbitrary
// owned weapons, skins, or attachments into a preset.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    playerKey?: string; action?: "save" | "rename" | "delete";
    id?: string; name?: string; perkId?: string;
  };
  const { playerKey } = await resolvePlayerKey(req, body.playerKey);
  if (!playerKey) return NextResponse.json({ error: "playerKey required" }, { status: 400 });
  if (!["save", "rename", "delete"].includes(body.action ?? "")) {
    return NextResponse.json({ error: "Invalid preset operation" }, { status: 400 });
  }
  const player = await getOrCreatePlayer(playerKey);
  const active = player.loadout ?? await db.loadout.create({ data: { playerId: player.id } });
  const presets = parseSavedLoadouts(active.savedLoadouts);
  let updated = presets;
  if (body.action === "save") {
    const name = cleanLoadoutName(body.name);
    if (!name) return NextResponse.json({ error: "Give your loadout a name" }, { status: 400 });
    if (presets.length >= MAX_SAVED_LOADOUTS) {
      return NextResponse.json({ error: "You can save up to five loadouts" }, { status: 409 });
    }
    const perkId = body.perkId ?? DEFAULT_PERK_ID;
    const perk = perkById(perkId);
    if (perk.id !== perkId || perk.unlockLevel > player.level) {
      return NextResponse.json({ error: "That perk is not unlocked" }, { status: 403 });
    }
    updated = [...presets, captureSavedLoadout(active, randomUUID(), name, perkId)];
  } else if (body.action === "rename") {
    const name = cleanLoadoutName(body.name);
    if (!name) return NextResponse.json({ error: "Give your loadout a name" }, { status: 400 });
    if (!presets.some(p => p.id === body.id)) return NextResponse.json({ error: "Loadout not found" }, { status: 404 });
    updated = presets.map(p => p.id === body.id ? { ...p, name } : p);
  } else {
    if (!presets.some(p => p.id === body.id)) return NextResponse.json({ error: "Loadout not found" }, { status: 404 });
    updated = presets.filter(p => p.id !== body.id);
  }
  await db.loadout.update({ where: { playerId: player.id }, data: { savedLoadouts: JSON.stringify(updated) } });
  return NextResponse.json(await buildProfileView(playerKey));
}
