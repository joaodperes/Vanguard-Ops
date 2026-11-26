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

// PATCH /api/profile { playerKey, defaultBotDifficulty } OR { playerKey, name }
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { playerKey: bodyKey, defaultBotDifficulty, name } = body as {
    playerKey?: string;
    defaultBotDifficulty?: string;
    name?: string;
  };
  const { playerKey } = await resolvePlayerKey(req, bodyKey);
  if (!playerKey) return NextResponse.json({ error: "playerKey required" }, { status: 400 });
  const player = await getOrCreatePlayer(playerKey);
  if (typeof name === "string") {
    const callsign = name.trim();
    if (callsign.length < 3 || callsign.length > 20 || !/^[a-zA-Z0-9 _-]+$/.test(callsign)) {
      return NextResponse.json({ error: "Callsign must be 3–20 characters and use only letters, numbers, spaces, underscores or hyphens." }, { status: 400 });
    }
    await db.player.update({ where: { id: player.id }, data: { name: callsign } });
  } else if (typeof defaultBotDifficulty === "string") {
    const allowed = ["easy", "normal", "hard", "veteran", "mixed"];
    if (!allowed.includes(defaultBotDifficulty)) {
      return NextResponse.json({ error: "Invalid default bot difficulty" }, { status: 400 });
    }
    await db.player.update({ where: { id: player.id }, data: { defaultBotDifficulty } });
  } else {
    return NextResponse.json({ error: "Provide a callsign or default bot difficulty." }, { status: 400 });
  }
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
