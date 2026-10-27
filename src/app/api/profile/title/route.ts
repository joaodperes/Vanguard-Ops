import { NextRequest, NextResponse } from "next/server";
import { resolvePlayerKey } from "@/lib/auth";
import { getOrCreatePlayer, buildProfileView } from "@/lib/player-service";
import { achievementTitle } from "@/lib/achievement-titles";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Equip an earned achievement title, or clear it with an empty ID. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { playerKey } = await resolvePlayerKey(req, typeof body.playerKey === "string" ? body.playerKey : undefined);
  if (!playerKey) return NextResponse.json({ error: "playerKey required" }, { status: 400 });
  if (typeof body.achievementId !== "string" || body.achievementId.length > 80)
    return NextResponse.json({ error: "Invalid title" }, { status: 400 });
  const id = body.achievementId;
  if (id && !achievementTitle(id)) return NextResponse.json({ error: "Unknown title" }, { status: 400 });
  const player = await getOrCreatePlayer(playerKey);
  if (id) {
    const ownership = await db.playerAchievement.findUnique({
      where: { playerId_achievementId: { playerId: player.id, achievementId: id } },
    });
    if (!ownership) return NextResponse.json({ error: "Earn this mastery achievement before equipping its title" }, { status: 403 });
  }
  await db.player.update({ where: { id: player.id }, data: { selectedTitle: id } });
  return NextResponse.json(await buildProfileView(playerKey));
}
