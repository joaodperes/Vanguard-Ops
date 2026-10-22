import { NextRequest, NextResponse } from "next/server";
import { applyMatchResult, type MatchResultInput } from "@/lib/player-service";
import { resolvePlayerKey } from "@/lib/auth";
import { normalizeSurvivalTier } from "@/lib/survival";
import { WEAPONS } from "@/lib/game-data";
import { WEAPON_CONDITION_METRICS, type WeaponConditionStats } from "@/lib/armory-challenges";

export const dynamic = "force-dynamic";

// POST /api/match/complete { playerKey, kills, deaths, headshots, won, mode, score, online, durationSec, placement, weaponId, multikills, survivalWaves, killDifficulties, perWeaponKills }
// Awards XP & credits for a completed match. Trusted client report (sandbox).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const input = body as MatchResultInput;
  const { playerKey } = await resolvePlayerKey(req, input?.playerKey);
  if (!playerKey) return NextResponse.json({ error: "playerKey required" }, { status: 400 });
  // sanity caps to avoid absurd values
  const kills = Math.max(0, Math.min(200, Math.floor(input.kills ?? 0)));
  const deaths = Math.max(0, Math.min(200, Math.floor(input.deaths ?? 0)));
  const headshots = Math.max(0, Math.min(kills, Math.floor(input.headshots ?? 0)));
  const mode: "ffa" | "tdm" | "survival" | "gungame" | "killconfirmed" =
    input.mode === "tdm" ? "tdm" : input.mode === "killconfirmed" ? "killconfirmed" : input.mode === "survival" ? "survival" : input.mode === "gungame" ? "gungame" : "ffa";
  // Per-weapon kill/headshot tallies (gungame). Sanitize: keep only entries with
  // numeric kills/headshots, cap each at the sanity-capped total kill count, and
  // verify the summed per-weapon kills don't exceed the reported total (defensive
  // — the engine should always produce a self-consistent map).
  const rawPerWeapon = input.perWeaponKills ?? {};
  const perWeaponKills: Record<string, { kills: number; headshots: number }> = {};
  let perWeaponKillsSum = 0;
  for (const [wid, entry] of Object.entries(rawPerWeapon)) {
    if (!entry || typeof entry !== "object") continue;
    const k = Math.max(0, Math.min(kills, Math.floor(Number(entry.kills) || 0)));
    const h = Math.max(0, Math.min(k, Math.floor(Number(entry.headshots) || 0)));
    if (k <= 0 && h <= 0) continue;
    perWeaponKillsSum += k;
    // Drop the map if it's inconsistent (sum exceeds total kills — would
    // double-count toward challenges). We keep the per-weapon entries only if
    // the sum is within tolerance (+5 for rounding/headshot edge cases).
    if (perWeaponKillsSum > kills + 5) {
      perWeaponKillsSum = -1;
      break;
    }
    perWeaponKills[wid] = { kills: k, headshots: h };
  }
  // Contextual metrics are per-kill subsets, never independently trusted totals.
  // Unknown weapons/conditions and inconsistent match counts are discarded.
  const validWeapons = new Set(WEAPONS.map(w => w.id));
  const perWeaponActions: Record<string, Partial<WeaponConditionStats>> = {};
  const rawActions = input.perWeaponActions;
  if (rawActions && typeof rawActions === "object" && !Array.isArray(rawActions)) {
    for (const [wid, raw] of Object.entries(rawActions)) {
      if (!validWeapons.has(wid) || !raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      // Context can't progress a different weapon than the one credited for kills.
      const weaponKillCap = perWeaponKillsSum >= 0 && Object.keys(perWeaponKills).length > 0
        ? (perWeaponKills[wid]?.kills ?? 0)
        : (wid === input.weaponId ? kills : 0);
      if (weaponKillCap <= 0) continue;
      const sanitized: Partial<WeaponConditionStats> = {};
      for (const metric of WEAPON_CONDITION_METRICS) {
        const value = (raw as Record<string, unknown>)[metric];
        if (typeof value === "number" && Number.isFinite(value) && value > 0) {
          sanitized[metric] = Math.min(weaponKillCap, Math.floor(value));
        }
      }
      if (Object.keys(sanitized).length) perWeaponActions[wid] = sanitized;
    }
  }
  const result = await applyMatchResult({
    playerKey,
    kills,
    deaths,
    headshots,
    won: !!input.won,
    mode,
    score: Math.max(0, Math.floor(input.score ?? 0)),
    confirmations: mode === "killconfirmed" ? Math.max(0, Math.min(200, Math.floor(input.confirmations ?? 0))) : 0,
    denials: mode === "killconfirmed" ? Math.max(0, Math.min(200, Math.floor(input.denials ?? 0))) : 0,
    online: !!input.online,
    durationSec: Math.max(0, Math.min(7200, Math.floor(input.durationSec ?? 0))),
    placement: Math.max(1, Math.min(16, Math.floor(input.placement ?? 1))),
    weaponId: typeof input.weaponId === "string" ? input.weaponId : "rifle_ar",
    multikills: Math.max(0, Math.min(30, Math.floor(input.multikills ?? 0))),
    // 19a+19b: pass through the match-high kill streak. Cap at the sanity
    // limit of 30 (same as multikills — a legitimate single-match streak
    // rarely exceeds 20 even on the best runs). Forwarded to applyMatchResult
    // which Math.maxes it against player.bestKillstreak for the tiered
    // streak achievements.
    bestStreak: Math.max(0, Math.min(30, Math.floor((input as any).bestStreak ?? 0))),
    survivalWaves: Math.max(0, Math.min(999, Math.floor((input as any).survivalWaves ?? 0))),
    survivalTier: normalizeSurvivalTier(input.survivalTier),
    // Per-kill difficulty breakdown for difficulty-scaled XP. Cap the array
    // length at the (sanity-capped) kill count to avoid abuse.
    killDifficulties: Array.isArray(input.killDifficulties)
      ? (input.killDifficulties as string[]).slice(0, kills)
      : [],
    // Per-weapon kill attribution (gungame). Pass through only if the sanitized
    // map is consistent (perWeaponKillsSum === -1 signals inconsistency → drop)
    // AND non-empty (an empty {} would cause metricDelta to skip the weaponId
    // fallback path for per-weapon metrics like kills_with_shotgun, breaking
    // FFA/TDM challenge progression where perWeaponKills isn't sent).
    perWeaponKills: perWeaponKillsSum >= 0 && Object.keys(perWeaponKills).length > 0 ? perWeaponKills : undefined,
    perWeaponActions,
  });
  return NextResponse.json(result);
}
