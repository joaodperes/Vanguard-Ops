import { NextRequest, NextResponse } from "next/server";
import { getAllWeaponProgress, getWeaponChallengesView } from "@/lib/player-service";
import { resolvePlayerKey } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/weapon-progress?playerKey=...
// Returns:
//   {
//     progress: Record<weaponId, { weaponId, kills, headshots }>,
//     challenges: Record<weaponId, WeaponChallengeView[]>
//   }
// Used by the Armory to render per-weapon skin challenge progress tiles.
export async function GET(req: NextRequest) {
  const qp = req.nextUrl.searchParams.get("playerKey") ?? undefined;
  const { playerKey } = await resolvePlayerKey(req, qp);
  if (!playerKey) return NextResponse.json({ error: "playerKey required" }, { status: 400 });

  const progress = await getAllWeaponProgress(playerKey);
  // Only compute challenge views for weapons the player has actually used
  // (i.e. appear in MatchRecord) — those are the only ones with non-zero progress.
  const challengePromises = Object.keys(progress).map(async (wid) => [wid, await getWeaponChallengesView(playerKey, wid)] as const);
  const challengeEntries = await Promise.all(challengePromises);
  const challenges: Record<string, Awaited<ReturnType<typeof getWeaponChallengesView>>> = {};
  for (const [wid, view] of challengeEntries) challenges[wid] = view;

  return NextResponse.json({ progress, challenges });
}
