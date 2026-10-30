import { NextRequest, NextResponse } from "next/server";
import { getAllWeaponProgress, getWeaponChallengesView } from "@/lib/player-service";
import { resolvePlayerKey } from "@/lib/auth";
import { WEAPONS } from "@/lib/game-data";

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
  // Always include melee skin trials, even if the weapon has zero recorded kills.
  // This ensures the default Tactical Knife is fully discoverable for new players.
  const weaponIds = new Set([...Object.keys(progress), ...WEAPONS.filter(w => w.category === "melee").map(w => w.id)]);
  const challengePromises = [...weaponIds].map(async (wid) => [wid, await getWeaponChallengesView(playerKey, wid)] as const);
  const challengeEntries = await Promise.all(challengePromises);
  const challenges: Record<string, Awaited<ReturnType<typeof getWeaponChallengesView>>> = {};
  for (const [wid, view] of challengeEntries) challenges[wid] = view;

  return NextResponse.json({ progress, challenges });
}
