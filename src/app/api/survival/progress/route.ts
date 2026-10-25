import { NextRequest, NextResponse } from "next/server";
import { getSurvivalProgress } from "@/lib/player-service";
import { resolvePlayerKey } from "@/lib/auth";
export const dynamic = "force-dynamic";
// Read server-persisted clears rather than trusting local-storage unlock flags.
export async function GET(req:NextRequest) {
  const {playerKey}=await resolvePlayerKey(req, req.nextUrl.searchParams.get("playerKey") ?? undefined);
  if(!playerKey) return NextResponse.json({error:"playerKey required"},{status:400});
  return NextResponse.json(await getSurvivalProgress(playerKey));
}
