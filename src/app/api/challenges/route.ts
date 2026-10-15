import { NextRequest, NextResponse } from "next/server";
import { getDailyChallengesView, getWeeklyChallengesView } from "@/lib/player-service";
import { resolvePlayerKey } from "@/lib/auth";
import { weeklyChallengeKey } from "@/lib/game-data";

export const dynamic = "force-dynamic";

// GET /api/challenges?playerKey=...
// Returns the player's daily + weekly challenge progress in one call.
// 17-C: Elite is no longer a separate lifetime list — instead, daily/weekly
// challenges can be promoted to elite variants per (playerKey, periodKey,
// challengeId). Each challenge in the `challenges`/`weekly` arrays has an
// `isElite` flag indicating whether it's a promoted variant. The legacy
// `elite` field is kept as an empty array for backward-compat with clients
// that still read it (the Profile screen no longer has an Elite Quests tab).
export async function GET(req: NextRequest) {
  const qp = req.nextUrl.searchParams.get("playerKey") ?? undefined;
  const { playerKey } = await resolvePlayerKey(req, qp);
  if (!playerKey) return NextResponse.json({ error: "playerKey required" }, { status: 400 });
  const [challenges, weekly] = await Promise.all([
    getDailyChallengesView(playerKey),
    getWeeklyChallengesView(playerKey),
  ]);
  return NextResponse.json({
    challenges,
    weekly,
    // Empty legacy field — kept so older clients don't break. Elite variants
    // are now embedded inside `challenges`/`weekly` with isElite=true.
    elite: [],
    dayKey: new Date().toISOString().slice(0, 10),
    weekKey: weeklyChallengeKey(),
  });
}
