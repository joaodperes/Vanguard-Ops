import { NextRequest, NextResponse } from "next/server";
import { getAchievementsView } from "@/lib/player-service";
import { resolvePlayerKey } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/achievements?playerKey=...
export async function GET(req: NextRequest) {
  const qp = req.nextUrl.searchParams.get("playerKey") ?? undefined;
  const { playerKey } = await resolvePlayerKey(req, qp);
  if (!playerKey) return NextResponse.json({ error: "playerKey required" }, { status: 400 });
  const achievements = await getAchievementsView(playerKey);
  return NextResponse.json({ achievements });
}
