import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/auth/me — returns the logged-in account info, or 401 for guests.
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({
    authenticated: true,
    playerKey: session.playerKey,
    playerId: session.playerId,
    name: session.name,
    email: session.email,
  });
}
