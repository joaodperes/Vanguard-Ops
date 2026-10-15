import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createSessionToken, setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/auth/register { email, password, name }
// Creates a new Player + User account and sets a session cookie.
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { email, password, name } = body as { email?: string; password?: string; name?: string };

  const emailNorm = (email ?? "").trim().toLowerCase();
  if (!emailNorm || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailNorm)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }
  const displayName = (name ?? "").trim().slice(0, 20) || "Recruit";

  // Round 20a: Catch DB errors and return a proper JSON response.
  let existing;
  try {
    existing = await db.user.findUnique({ where: { email: emailNorm } });
  } catch (dbErr) {
    console.error("[auth/register] DB error:", dbErr);
    return NextResponse.json(
      { error: "Database unavailable — please try again. If this persists, the server may be initializing." },
      { status: 503 }
    );
  }
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
  }

  const playerKey = "p_" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4);
  const passwordHash = await hashPassword(password);

  let player;
  try {
    player = await db.player.create({
      data: {
        playerKey,
        name: displayName,
        user: { create: { email: emailNorm, passwordHash } },
      },
      include: { user: true },
    });
  } catch (dbErr) {
    console.error("[auth/register] DB create error:", dbErr);
    return NextResponse.json(
      { error: "Could not create account — database error. Please try again." },
      { status: 503 }
    );
  }

  const token = createSessionToken(player.id);
  const res = NextResponse.json({
    ok: true,
    playerKey: player.playerKey,
    playerId: player.id,
    name: player.name,
    email: emailNorm,
  });
  setSessionCookie(res, token);
  return res;
}
