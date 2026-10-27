import { NextRequest, NextResponse } from "next/server";
import { resolvePlayerKey } from "@/lib/auth";
import { buildProfileView, getOrCreatePlayer } from "@/lib/player-service";
import { CareerPromotionError, promoteCareer } from "@/lib/career-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !Number.isSafeInteger(body.rank) || body.rank < 0) {
    return NextResponse.json({ error: "Current Career rank required" }, { status: 400 });
  }
  const { playerKey } = await resolvePlayerKey(req, typeof body.playerKey === "string" ? body.playerKey : undefined);
  if (!playerKey) return NextResponse.json({ error: "playerKey required" }, { status: 400 });
  const player = await getOrCreatePlayer(playerKey);
  try {
    await promoteCareer(player.id, body.rank);
  } catch (error) {
    if (error instanceof CareerPromotionError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
  return NextResponse.json(await buildProfileView(playerKey));
}
