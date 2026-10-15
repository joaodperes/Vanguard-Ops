// ============================================================================
// VANGUARD OPS — Lightweight credentials auth (no external deps)
// - Password hashing: Node crypto.scrypt (salt + hash, stored as "salt:hash")
// - Session token: base64(playerId).base64(hmac-sha256(playerId)) signed with
//   a server secret. Stateless, tamper-evident. Stored in an httpOnly cookie.
// - Guest mode: if no session cookie is present, API routes fall back to the
//   client-supplied playerKey (localStorage). This keeps the game playable
//   without an account while giving accounts cross-device persistence.
// ============================================================================
import { scrypt as scryptCb, randomBytes, createHmac, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number
) => Promise<Buffer>;

const SESSION_COOKIE = "vanguard_session";
const SESSION_TTL_DAYS = 30;

function sessionSecret(): string {
  return (
    process.env.VANGUARD_SESSION_SECRET ||
    "vanguard-ops-dev-session-secret-change-in-production-9f3a2c7e"
  );
}

// ---- Password hashing ----
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const derived = await scrypt(password, salt, 64);
  const a = Buffer.from(hashHex, "hex");
  const b = derived;
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ---- Session token ----
function b64url(s: string | Buffer): string {
  return Buffer.from(s as any).toString("base64url");
}

export function createSessionToken(playerId: string): string {
  const payload = b64url(playerId);
  const sig = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  // timing-safe compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

// ---- Cookie helpers ----
export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

function readCookie(req: NextRequest, name: string): string | undefined {
  return req.cookies.get(name)?.value;
}

export interface SessionInfo {
  playerKey: string;
  playerId: string;
  email: string;
  name: string;
}

// Resolve the player from a session cookie. Returns null if no valid session.
export async function getSession(req: NextRequest): Promise<SessionInfo | null> {
  const token = readCookie(req, SESSION_COOKIE);
  const playerId = verifySessionToken(token);
  if (!playerId) return null;
  const user = await db.user.findUnique({
    where: { playerId },
    include: { player: true },
  });
  if (!user || !user.player) return null;
  return {
    playerKey: user.player.playerKey,
    playerId: user.player.id,
    email: user.email,
    name: user.player.name,
  };
}

// Resolve the effective playerKey for a request:
// 1. If a valid session cookie is present, use the account's playerKey.
// 2. Otherwise fall back to the client-supplied playerKey (guest mode).
// This lets every existing API route support both accounts and guests.
export async function resolvePlayerKey(
  req: NextRequest,
  bodyPlayerKey?: string
): Promise<{ playerKey: string | null; session: SessionInfo | null }> {
  const session = await getSession(req);
  if (session) return { playerKey: session.playerKey, session };
  return { playerKey: bodyPlayerKey ?? null, session: null };
}

export { SESSION_COOKIE };
