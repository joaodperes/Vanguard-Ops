import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSessionToken, setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/auth/login { email, password }
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { email, password } = body as { email?: string; password?: string };
  const emailNorm = (email ?? "").trim().toLowerCase();

  if (!emailNorm || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  // Round 20a: Catch DB errors and return a proper JSON response instead of
  // crashing with a 500 (which causes the client's res.json() to throw and
  // show "network error").
  let user;
  try {
    user = await db.user.findUnique({ where: { email: emailNorm }, include: { player: true } });
  } catch (dbErr) {
    console.error("[auth/login] DB error:", dbErr);
    return NextResponse.json(
      { error: "Database unavailable — please try again. If this persists, the server may be initializing." },
      { status: 503 }
    );
  }
  if (!user || !user.player) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = createSessionToken(user.player.id);
  const res = NextResponse.json({
    ok: true,
    playerKey: user.player.playerKey,
    playerId: user.player.id,
    name: user.player.name,
    email: user.email,
  });
  setSessionCookie(res, token);
  return res;
}
