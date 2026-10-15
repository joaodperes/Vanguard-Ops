import { NextRequest, NextResponse } from "next/server";
import { buildProfileView, getOrCreatePlayer } from "@/lib/player-service";
import { db } from "@/lib/db";
import { resolvePlayerKey } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/profile?playerKey=...   (guest)   OR   with session cookie (account)
export async function GET(req: NextRequest) {
  const qp = req.nextUrl.searchParams.get("playerKey") ?? undefined;
  const { playerKey } = await resolvePlayerKey(req, qp);
  if (!playerKey) return NextResponse.json({ error: "playerKey required" }, { status: 400 });
  const view = await buildProfileView(playerKey);
  return NextResponse.json(view);
}

// POST /api/profile  { playerKey, name }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { playerKey: bodyKey, name } = body as { playerKey?: string; name?: string };
  const { playerKey } = await resolvePlayerKey(req, bodyKey);
  if (!playerKey) return NextResponse.json({ error: "playerKey required" }, { status: 400 });
  const player = await getOrCreatePlayer(playerKey, name);
  if (name && name.trim()) {
    await db.player.update({ where: { id: player.id }, data: { name: name.trim().slice(0, 20) } });
  }
  const view = await buildProfileView(playerKey);
  return NextResponse.json(view);
}
