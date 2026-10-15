import { NextRequest, NextResponse } from "next/server";
import { getRecentMatches } from "@/lib/player-service";
import { resolvePlayerKey } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/match-history?playerKey=...&limit=...
export async function GET(req: NextRequest) {
  const qp = req.nextUrl.searchParams.get("playerKey") ?? undefined;
  const { playerKey } = await resolvePlayerKey(req, qp);
  if (!playerKey) return NextResponse.json({ error: "playerKey required" }, { status: 400 });
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 20)));
  const matches = await getRecentMatches(playerKey, limit);
  return NextResponse.json({ matches });
}
