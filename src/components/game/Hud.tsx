"use client";
import { useEffect, useState } from "react";
import type { HudState, ScoreRow } from "@/lib/fps-engine";
import { formatMatchClock } from "@/lib/match-clock";
import type { GameMode } from "@/lib/game-protocol";
import { Minimap } from "./Minimap";
import { weaponById, WEAPONS, ATTACHMENTS } from "@/lib/game-data";
import { displayMapLabel } from "@/lib/display-labels";
import { matchHudInfo } from "@/lib/match-hud";
import { ctfFlagLine, killRank, teamScorePerspective } from "@/lib/hud-top-stats";
import type { WeaponCategory } from "@/lib/game-data";
import { Heart, Zap, Trophy, Skull, Clock, LogOut, Users, AlertTriangle, Crosshair as CrosshairIcon, Shield, Swords, Target, ChevronUp, Siren } from "lucide-react";

// ---- Category accent colors (matches the 3D band on the weapon model) ----
// Used for the small dot/badge next to the weapon name in the HUD so the player
// can identify the weapon CATEGORY at a glance, matching the colored band on
// the 3D weapon model. This solves the "weapons aren't visually distinct"
// complaint — even without reading the weapon name, the colored dot tells the
// player what type of weapon they're holding.
const CATEGORY_ACCENT: Record<WeaponCategory, { color: string; label: string }> = {
  assault: { color: "#ff3b3b", label: "AR" },     // red
  smg: { color: "#ffd93b", label: "SMG" },        // yellow
  shotgun: { color: "#ff8c3b", label: "SG" },     // orange
  dmr: { color: "#3b7bff", label: "DMR" },        // blue
  sniper: { color: "#9b3bff", label: "SNP" },     // purple
  lmg: { color: "#3bff7b", label: "LMG" },        // green
  pistol: { color: "#e0e0e0", label: "PST" },    // white
  pdw: { color: "#a6f060", label: "PDW" },       // lime
  launcher: { color: "#fb923c", label: "RKT" },  // amber
  melee: { color: "#808080", label: "MLE" },      // grey
};

interface Props {
  hud: HudState;
  onExit: () => void;
  mode: GameMode;
  crosshairColor?: string;
  crosshairSize?: number;
  showPing?: boolean;
  isTouch?: boolean;
  scopeOverlay?: boolean;
}

export function Hud({ hud, onExit, mode, crosshairColor = "#22c55e", crosshairSize = 8, showPing = true, isTouch = false, scopeOverlay = true }: Props) {
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [hitFlash, setHitFlash] = useState(0);
  const [dmgFlash, setDmgFlash] = useState(0);
  const [killstreakShown, setKillstreakShown] = useState<string | null>(null);
  const [eliminationShown, setEliminationShown] = useState<HudState["lastElimination"]>();
  useEffect(() => {
    if (!hud.lastElimination?.at) return;
    setEliminationShown(hud.lastElimination);
    const timeout = setTimeout(() => setEliminationShown(undefined), 1500);
    return () => clearTimeout(timeout);
  }, [hud.lastElimination?.at]);

  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      // Only open the scoreboard while the player is actively in the match
      // (pointer locked). This prevents Tab from opening the scoreboard over
      // the "CLICK TO PLAY" overlay when the pointer is unlocked.
      if (e.code === "Tab" && hud.pointerLocked) { e.preventDefault(); setShowScoreboard(true); }
    };
    const up = (e: KeyboardEvent) => { if (e.code === "Tab") setShowScoreboard(false); };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, [hud.pointerLocked]);

  // ---- Prevent scoreboard / click-to-play overlap ----
  // The "CLICK TO PLAY" overlay (rendered by GameCanvas) shows whenever the
  // pointer is unlocked (e.g. after pressing Escape). If the player was
  // holding Tab at that moment — or presses Tab while unlocked — the
  // scoreboard would render ON TOP of the click-to-play box, producing the
  // overlap the user reported. Fix: the scoreboard is only meaningful while
  // the player is actually in the match (pointer locked). Whenever the
  // pointer unlocks, force the scoreboard closed and ignore Tab presses
  // until the pointer is locked again. This makes the two overlays mutually
  // exclusive by construction.
  useEffect(() => {
    if (!hud.pointerLocked) setShowScoreboard(false);
  }, [hud.pointerLocked]);

  useEffect(() => { if (hud.hitMarker) setHitFlash(hud.hitMarker); }, [hud.hitMarker]);
  // Round 20g: Headshot marker — separate flash state for the distinct red marker.
  const [hsFlash, setHsFlash] = useState(0);
  useEffect(() => { if (hud.headshotMarker) setHsFlash(hud.headshotMarker); }, [hud.headshotMarker]);
  useEffect(() => { if (hud.damageFlash) setDmgFlash(hud.damageFlash); }, [hud.damageFlash]);

  // Show killstreak callout for ~1.8s when it changes
  useEffect(() => {
    if (hud.killstreak && hud.killstreak.at > 0) {
      const now = performance.now();
      if (now - hud.killstreak.at < 1800) {
        setKillstreakShown(hud.killstreak.label);
        const t = setTimeout(() => setKillstreakShown(null), 1800 - (now - hud.killstreak.at));
        return () => clearTimeout(t);
      }
    }
  }, [hud.killstreak]);

  const now = performance.now();
  const hitMarkerAge = now - hitFlash;
  const showHit = hitMarkerAge < 220;
  // Round 20g: Headshot marker — shows a distinct red "X" marker on headshots.
  const hsMarkerAge = now - hsFlash;
  const showHsMarker = hsMarkerAge < 400;
  const dmgAge = now - dmgFlash;
  const showDmg = dmgAge < 350;
  const healthPct = hud.health / hud.maxHealth;
  const ammoPct = hud.magSize > 0 ? hud.ammo / hud.magSize : 0;
  const lowAmmo = ammoPct < 0.25 && hud.ammo > 0;
  const clockText = formatMatchClock(hud);
  const matchInfo = matchHudInfo(mode, hud.survivalTier);

  // damage direction indicator
  const showDamageDir = hud.damageDir !== undefined && hud.damageDirAt && (now - hud.damageDirAt < 1500);

  // ---- Dynamic crosshair gap (driven by spread factor) ----
  // crosshairSize is the base arm length. When spread is high (sprinting/moving),
  // the gap from center grows so the crosshair visually "opens up".
  const spreadFactor = hud.spreadFactor ?? 0;
  const dynamicGap = 2 + spreadFactor * 30;  // up to ~62 px for high-spread sniper/shotgun hipfire
  // ---- Health-regen cooldown ring (visible while waiting for regen) ----
  const regenMs = hud.regenCooldownMs ?? 0;
  const regenWaiting = regenMs > 0 && hud.alive && hud.health < hud.maxHealth;
  const regenSec = Math.ceil(regenMs / 1000);
  // ---- Weapon slot indicator (1/2/3) ----
  const slotNum = hud.weaponSlot === "primary" ? 1 : hud.weaponSlot === "secondary" ? 2 : 3;

  // ---- Local player's team (TDM scoreboard grouping) ----
  // In TDM mode the scoreboard is split into Red/Blue panels; we use this to
  // mark every teammate as an "ally" (Shield icon) since all players on your
  // team are friendlies.
  const selfTeam = hud.scoreboard.find(r => r.isSelf)?.team;
  const ranking = killRank(hud.scoreboard, hud.kills);
  const teamScores = teamScorePerspective(hud.teamScores, selfTeam);
  const flagLine = hud.ctfFlags ? ctfFlagLine(hud.ctfFlags, selfTeam, !!hud.ctfCarrying) : null;
  const clockEnding = !hud.unlimitedTime && !hud.ctfOvertime && hud.timeLeft > 0 && hud.timeLeft <= 30;

  return (
    <div className="absolute inset-0 pointer-events-none select-none font-mono">
      {/* damage vignette */}
      {showDmg && (
        <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 200px 40px rgba(239,68,68,0.55)", opacity: 1 - dmgAge / 350 }} />
      )}
      {/* Round 20h: Spawn protection overlay — cyan vignette + "PROTECTED" label */}
      {hud.alive && hud.selfSpawnProtected && (
        <>
          <div className="absolute inset-0 animate-pulse" style={{ boxShadow: "inset 0 0 180px 30px rgba(34,211,238,0.3)" }} />
          <div className="absolute left-1/2 top-[15%] -translate-x-1/2 text-cyan-300 text-xs font-bold uppercase tracking-[0.3em] flex items-center gap-1.5"
               style={{ animation: "countdownPulse 1s ease-in-out infinite", textShadow: "0 0 10px rgba(34,211,238,0.6)" }}>
            <Shield className="w-3.5 h-3.5" /> Protected
          </div>
        </>
      )}
      {/* low-health vignette */}
      {hud.alive && healthPct <= 0.25 && (
        <div className="absolute inset-0 animate-pulse" style={{ boxShadow: "inset 0 0 200px 40px rgba(239,68,68,0.35)" }} />
      )}

      {/* crosshair OR scope reticle overlay */}
      {hud.alive && (hud.pointerLocked || isTouch) && (
        <ScopeOrCrosshair
          hud={hud}
          crosshairColor={crosshairColor}
          crosshairSize={crosshairSize}
          dynamicGap={dynamicGap}
          showHit={showHit}
          hitMarkerAge={hitMarkerAge}
          scopeOverlay={scopeOverlay}
        />
      )}

      {/* Round 20g: Headshot marker — distinct red "X" with skull icon.
          Shows for ~400ms after a headshot hit (longer than the normal hit
          marker's 220ms) so the player clearly sees they landed a headshot. */}
      {hud.alive && showHsMarker && (hud.pointerLocked || isTouch) && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ opacity: 1 - hsMarkerAge / 400 }}>
          <svg width="48" height="48" viewBox="0 0 48 48" style={{ animation: "countdownPop 0.3s ease-out" }}>
            {/* Red X marker */}
            <line x1="10" y1="10" x2="20" y2="20" stroke="#ff3b3b" strokeWidth="3" strokeLinecap="round" />
            <line x1="38" y1="10" x2="28" y2="20" stroke="#ff3b3b" strokeWidth="3" strokeLinecap="round" />
            <line x1="10" y1="38" x2="20" y2="28" stroke="#ff3b3b" strokeWidth="3" strokeLinecap="round" />
            <line x1="38" y1="38" x2="28" y2="28" stroke="#ff3b3b" strokeWidth="3" strokeLinecap="round" />
            {/* Center dot */}
            <circle cx="24" cy="24" r="2" fill="#ff3b3b" />
          </svg>
          <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2 text-[9px] font-black text-rose-400 uppercase tracking-wider whitespace-nowrap" style={{ textShadow: "0 0 8px rgba(255,59,59,0.6)" }}>
            Headshot
          </div>
        </div>
      )}

      {/* Personal elimination confirmation. Only shown for your own kills. */}
      {hud.alive && eliminationShown && (
        <div className="absolute top-[32%] left-1/2 -translate-x-1/2 text-center" style={{ animation: "eliminationPop 0.2s ease-out" }}>
          <div className="rounded-lg border border-amber-400/40 bg-black/75 backdrop-blur px-4 py-2 shadow-lg">
            <span className="text-amber-300 text-sm font-black tracking-[0.2em]">{eliminationShown.headshot ? "HEADSHOT ELIMINATION" : "ELIMINATED"}</span>
            <div className="text-white/80 text-xs mt-0.5">{eliminationShown.victim}</div>
          </div>
        </div>
      )}
      {/* killstreak callout — center-top */}
      {killstreakShown && hud.killstreak && (
        <div className="absolute left-1/2 top-[22%] -translate-x-1/2 text-center" style={{ animation: "killstreakPop 0.4s ease-out" }}>
          <div className="text-5xl font-black tracking-widest mb-1" style={{ color: hud.killstreak.color, textShadow: `0 0 20px ${hud.killstreak.color}` }}>
            {hud.killstreak.icon}
          </div>
          <div className="text-xl font-bold tracking-[0.3em]" style={{ color: hud.killstreak.color, textShadow: `0 0 12px ${hud.killstreak.color}` }}>
            {killstreakShown}
          </div>
        </div>
      )}

      {/* damage direction indicator */}
      {showDamageDir && hud.damageDir !== undefined && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 220, height: 220 }}>
          <div
            className="absolute left-1/2 top-0 -translate-x-1/2"
            style={{ transformOrigin: "50% 110px", transform: `rotate(${(hud.damageDir * 180) / Math.PI}deg)` }}
          >
            <div className="flex flex-col items-center" style={{ animation: "dmgDirFade 1.5s ease-out forwards" }}>
              <div className="text-rose-500" style={{ filter: "drop-shadow(0 0 6px rgba(239,68,68,0.8))" }}>
                <AlertTriangle className="w-7 h-7" fill="currentColor" />
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Lean, objective-only scoreboard. Mode identity remains in countdown / TAB scoreboard. */}
      <div className={`absolute left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 max-w-[96vw] ${isTouch ? "top-1.5" : "top-3"}`}>
        <div className={`flex items-center justify-center whitespace-nowrap ${isTouch ? "gap-1" : "gap-2"}`}>
          {mode === "survival" ? (
            <>
              <div className={`bg-black/65 backdrop-blur rounded-lg border border-amber-500/30 flex items-center ${isTouch ? "gap-1 px-2 py-1" : "gap-1.5 px-3 py-1.5"}`}>
                <Skull className={isTouch ? "w-3 h-3 text-amber-400" : "w-4 h-4 text-amber-400"} />
                <span className={`text-white/60 uppercase ${isTouch ? "text-[9px]" : "text-xs"}`}>Wave</span>
                <span className={`text-amber-300 font-black tabular-nums ${isTouch ? "text-sm" : "text-lg"}`}>{hud.survivalWave ?? 0}</span>
              </div>
              <div className={`bg-black/65 backdrop-blur rounded-lg border border-white/10 flex items-center ${isTouch ? "gap-1 px-2 py-1" : "gap-1.5 px-3 py-1.5"}`}>
                <Clock className="w-3 h-3 text-white/60" />
                <span className={`text-white font-bold tabular-nums ${isTouch ? "text-xs" : "text-sm"}`}>{clockText}</span>
              </div>
              <div className={`backdrop-blur rounded-lg border flex items-center ${isTouch ? "gap-1 px-2 py-1" : "gap-1.5 px-3 py-1.5"} ${(hud.survivalPrepLeft ?? 0) > 0 ? "bg-amber-950/70 border-amber-500/30" : "bg-black/65 border-rose-500/30"}`}>
                <span className={`uppercase ${isTouch ? "text-[9px]" : "text-xs"} ${(hud.survivalPrepLeft ?? 0) > 0 ? "text-amber-200" : "text-rose-200"}`}>
                  {(hud.survivalPrepLeft ?? 0) > 0 ? "Prep" : "Enemies"}
                </span>
                <span className={`font-black tabular-nums ${isTouch ? "text-sm" : "text-lg"} ${(hud.survivalPrepLeft ?? 0) > 0 ? "text-amber-300" : "text-rose-300"}`}>
                  {(hud.survivalPrepLeft ?? 0) > 0 ? Math.ceil(hud.survivalPrepLeft ?? 0) + "s" : hud.survivalEnemiesLeft ?? 0}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className={`backdrop-blur rounded-lg border flex items-center ${isTouch ? "gap-1 px-2 py-1" : "gap-1.5 px-3 py-1.5"} ${clockEnding ? "bg-rose-950/75 border-rose-500/50" : "bg-black/65 border-white/10"}`}>
                <Clock className={`w-3 h-3 ${clockEnding ? "text-rose-300" : "text-white/60"}`} />
                <span className={`font-bold tabular-nums ${isTouch ? "text-xs" : "text-sm"} ${clockEnding ? "text-rose-300" : "text-white"}`}>{clockText}</span>
                {hud.ctfOvertime && <span className="text-amber-300 text-[9px] font-black">OT</span>}
              </div>
              {mode === "ffa" ? (
                <>
                  <div className={`bg-black/65 backdrop-blur rounded-lg border border-white/10 flex items-center ${isTouch ? "gap-1 px-2 py-1" : "gap-1.5 px-3 py-1.5"}`}>
                    <span className="text-white/60 text-[10px] font-bold">K</span>
                    <span className={`text-white font-black tabular-nums ${isTouch ? "text-xs" : "text-sm"}`}>{hud.kills}</span>
                    {hud.scoreLimit !== undefined && hud.scoreLimit > 0 && <span className="text-amber-300/70 text-[10px]">/{hud.scoreLimit}</span>}
                  </div>
                  <div className={`bg-black/65 backdrop-blur rounded-lg border border-white/10 flex items-center ${isTouch ? "gap-1 px-2 py-1" : "gap-1.5 px-3 py-1.5"}`}>
                    <Trophy className="w-3 h-3 text-amber-300" />
                    <span className={`text-amber-200 font-black tabular-nums ${isTouch ? "text-xs" : "text-sm"}`}>#{ranking.rank}<span className="text-white/40 font-normal">/{ranking.players}</span></span>
                  </div>
                </>
              ) : mode === "tdm" ? (
                <>
                  <div className={`bg-black/65 backdrop-blur rounded-lg border border-white/10 flex items-center ${isTouch ? "gap-1.5 px-2 py-1" : "gap-2 px-3 py-1.5"}`}>
                    <span className="text-red-300 font-bold text-[10px]">R</span>
                    <span className={`text-red-300 font-black tabular-nums ${isTouch ? "text-xs" : "text-sm"}`}>{hud.teamScores.red}</span>
                    <span className="text-white/30">–</span>
                    <span className={`text-blue-300 font-black tabular-nums ${isTouch ? "text-xs" : "text-sm"}`}>{hud.teamScores.blue}</span>
                    <span className="text-blue-300 font-bold text-[10px]">B</span>
                  </div>
                  <div className={`bg-black/65 backdrop-blur rounded-lg border border-white/10 flex items-center ${isTouch ? "gap-1 px-2 py-1" : "gap-1.5 px-3 py-1.5"}`}>
                    <span className="text-white/60 text-[10px] font-bold">K/D</span>
                    <span className={`text-white font-black tabular-nums ${isTouch ? "text-xs" : "text-sm"}`}>{hud.kills}<span className="text-white/30">/</span>{hud.deaths}</span>
                  </div>
                </>
              ) : mode === "killconfirmed" || mode === "ctf" ? (
                <div className={`bg-black/65 backdrop-blur rounded-lg border border-white/10 flex items-center ${isTouch ? "gap-1.5 px-2 py-1" : "gap-2 px-3 py-1.5"}`}>
                  <span className={`text-emerald-300 font-bold uppercase ${isTouch ? "text-[9px]" : "text-[10px]"}`}>Team</span>
                  <span className={`text-emerald-200 font-black tabular-nums ${isTouch ? "text-xs" : "text-sm"}`}>{teamScores.own}</span>
                  <span className="text-white/30">–</span>
                  <span className={`text-rose-200 font-black tabular-nums ${isTouch ? "text-xs" : "text-sm"}`}>{teamScores.enemy}</span>
                  <span className={`text-rose-300 font-bold uppercase ${isTouch ? "text-[9px]" : "text-[10px]"}`}>Enemy</span>
                </div>
              ) : (
                <>
                  <div className={`bg-black/65 backdrop-blur rounded-lg border border-white/10 flex items-center ${isTouch ? "gap-1 px-2 py-1" : "gap-1.5 px-3 py-1.5"}`}>
                    <span className="text-white/60 text-[10px] font-bold">K</span>
                    <span className={`text-white font-black tabular-nums ${isTouch ? "text-xs" : "text-sm"}`}>{hud.kills}</span>
                  </div>
                  <div className={`bg-black/65 backdrop-blur rounded-lg border border-white/10 flex items-center ${isTouch ? "gap-1 px-2 py-1" : "gap-1.5 px-3 py-1.5"}`}>
                    <Trophy className="w-3 h-3 text-purple-300" />
                    <span className={`text-purple-200 font-black tabular-nums ${isTouch ? "text-xs" : "text-sm"}`}>#{ranking.rank}<span className="text-white/40 font-normal">/{ranking.players}</span></span>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {mode === "ctf" && hud.ctfFlags && flagLine && (
          <>
            <div className={`flex items-center justify-center flex-wrap rounded-md border border-emerald-400/20 bg-black/60 backdrop-blur ${isTouch ? "gap-x-2 px-2 py-0.5" : "gap-x-3 px-3 py-1"}`}>
              <span className="text-[10px] font-semibold uppercase text-emerald-300">Our flag <span className="text-white/85">{flagLine.own}</span></span>
              <span className="text-white/30">·</span>
              <span className="text-[10px] font-semibold uppercase text-rose-300">Enemy flag <span className="text-white/85">{flagLine.enemy}</span></span>
              {hud.orbitalCharge !== undefined && (
                <span className="text-[10px] font-semibold text-violet-300">· Core {hud.orbitalCharge}/5{hud.orbitalReaper ? " · REAPER ACTIVE" : ""}</span>
              )}
            </div>
            {hud.ctfOvertime && <div className="text-[10px] text-amber-300 font-bold uppercase">Sudden death · Next capture wins</div>}
            {hud.ctfZoneError && <div className="rounded px-2 py-1 bg-amber-950/80 border border-amber-400/40 text-amber-300 text-[10px] max-w-[85vw] text-center">{hud.ctfZoneError}</div>}
            {hud.ctfNotice && now - hud.ctfNotice.at < 2400 && (
              <div className="text-amber-200 font-black tracking-wide text-sm uppercase" style={{textShadow:"0 0 12px rgba(245,158,11,.7)"}}>{hud.ctfNotice.label}</div>
            )}
          </>
        )}

        {mode === "gungame" && hud.gungameTotal !== undefined && (
          <GunGameProgress index={hud.gungameIndex ?? 0} total={hud.gungameTotal} currentWeaponId={hud.weaponId} compact={isTouch} />
        )}

        {mode === "survival" && (
          <div className="max-w-[90vw] text-center text-[10px] tracking-wide text-amber-200 font-semibold uppercase">
            {hud.survivalTier === "default" || !hud.survivalTier ? "Standard · 30 waves" : `${hud.survivalTier} · Endless`}
            {(hud.survivalModifierNames?.length ?? 0) > 0 && <span className="text-rose-300"> · {hud.survivalModifierNames!.join(" · ")}</span>}
            {hud.survivalBossWave && <span className="text-rose-300 font-black"> · Boss wave</span>}
          </div>
        )}
      </div>

      {/* Kill Confirmed pickup callout — only shown briefly on a local pickup. */}
      {mode === "killconfirmed" && hud.tagNotice && performance.now() - hud.tagNotice.at < 1300 && (
        <div className="absolute left-1/2 top-[27%] -translate-x-1/2 px-4 py-2 rounded-lg bg-black/70 border border-cyan-500/30 text-center">
          <span className={`font-black uppercase tracking-[0.18em] ${hud.tagNotice.action === "confirm" ? "text-cyan-300" : "text-emerald-300"}`}>
            {hud.tagNotice.action === "confirm" ? "+1 KILL CONFIRMED" : hud.denialScoreEnabled ? "+1 KILL DENIED" : "KILL DENIED"}
          </span>
        </div>
      )}
      {/* Top-left transient killfeed. No persistent map/ADS banner. */}
      {/* On mobile the font is much smaller
          and padding tighter so it doesn't dominate the small screen. */}
      <div className={`absolute left-3 flex flex-col gap-1 max-w-[55vw] ${isTouch ? "top-14" : "top-[72px]"}`}>
        {hud.killFeed.slice(0, isTouch ? 4 : 5).map((k, i) => (
          <div key={i} className={`bg-black/55 backdrop-blur rounded border border-white/10 flex items-center gap-1.5 ${isTouch ? "px-1.5 py-0.5 text-[10px]" : "px-3 py-1 text-xs"}`} style={{ animation: "killfeedSlide 0.3s ease-out" }}>
            <span className={teamColor(k.killerTeam)}>{k.killer}</span>
            <span className="text-white/40">{k.headshot ? "⊚" : "›"}</span>
            <span className={teamColor(k.victimTeam)}>{k.victim}</span>
          </div>
        ))}
      </div>

      {/* Perk information stacks BELOW the radar, never across its markers.
          Minimap: top 56px, height 176px desktop / 128px touch. */}
      <div className={`absolute right-4 flex flex-col items-end gap-2 ${isTouch ? "top-[234px]" : "top-[248px]"}`}>
        {hud.perkName && (
          <div className="px-2.5 py-1 rounded-md bg-black/75 border border-amber-500/20 text-amber-200 text-[11px] max-w-44 text-right">
            Perk: {hud.perkName}
          </div>
        )}
        {hud.perkName === "Scavenger" && (hud.scavengerPacksNearby ?? 0) > 0 && (
          <div className="rounded-md bg-black/80 border border-emerald-400/50 px-3 py-1 text-emerald-200 text-xs font-bold">
            AMMO CACHE NEARBY ×{hud.scavengerPacksNearby}
          </div>
        )}
        {hud.scavengerFeedbackAt && now - hud.scavengerFeedbackAt < 2100 && (
          <div className="rounded-md bg-black/80 border border-emerald-400/50 px-3 py-1 text-emerald-200 text-xs font-semibold">
            {hud.scavengerAmmoGained ? `AMMO RECOVERED +${hud.scavengerAmmoGained}` : "AMMO FULL"}
          </div>
        )}
      </div>
      {hud.matchEnding && <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none bg-black/30">
        <div className="text-center bg-black/70 border border-amber-400/40 rounded-xl px-10 py-7 shadow-xl">
          <div className="text-3xl font-black tracking-widest text-amber-300">{hud.matchEnding}</div>
          <div className="text-white/60 text-xs mt-2 tracking-widest uppercase">Match complete · final scores loading</div>
        </div>
      </div>}
      {hud.quickMeleeAt && now - hud.quickMeleeAt < 350 && <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
        <svg width="170" height="170" viewBox="0 0 170 170" style={{opacity:Math.max(0,1-(now-hud.quickMeleeAt)/350)}}>
          <path d="M140 34 Q105 105 28 137" fill="none" stroke="#f4e0c2" strokeWidth="8" strokeLinecap="round"/>
          <path d="M148 42 Q110 111 40 147" fill="none" stroke="#e6a74c" strokeWidth="3" strokeLinecap="round"/>
        </svg>
      </div>}
      {/* top right: exit + ping */}
      <div className={`absolute right-4 flex items-center gap-2 pointer-events-auto ${isTouch ? "top-[190px]" : "top-4"}`}>
        {showPing && (
          <div className="bg-black/55 backdrop-blur px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white/60 flex items-center gap-1">
            <Zap className="w-3 h-3" /> {hud.ping}ms
          </div>
        )}
        <button onClick={onExit} className="bg-black/55 hover:bg-rose-900/70 backdrop-blur px-3 py-1.5 rounded-lg border border-white/10 text-white/80 hover:text-white text-xs flex items-center gap-1 transition-colors">
          <LogOut className="w-3 h-3" /> Leave
        </button>
      </div>

      {hud.radar && <Minimap radar={hud.radar} compact={isTouch} />}

      {/* bottom left: health + regen cooldown + sprint indicator (desktop only —
          mobile uses the centered bottom cluster below). */}
      {!isTouch && (
      <div className="absolute bottom-6 left-6">
        <div className="flex items-center gap-2 mb-1">
          <Heart className={`w-4 h-4 ${healthPct > 0.5 ? "text-emerald-400" : healthPct > 0.25 ? "text-amber-400" : "text-rose-500 animate-pulse"}`} />
          <span className="text-white text-2xl font-bold tabular-nums">{hud.health}</span>
          <span className="text-white/40 text-xs">HP</span>
          {/* Sprinting indicator (pulsing chevron) */}
          {hud.sprinting && (
            <span className="ml-2 flex items-center gap-0.5 text-cyan-300 text-xs font-bold uppercase tracking-wider animate-pulse">
              <ChevronUp className="w-3 h-3" /> Sprint
            </span>
          )}
          {/* Regen cooldown indicator: small badge showing seconds until regen starts */}
          {regenWaiting && (
            <span className="ml-2 px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" /> {regenSec}s
            </span>
          )}
        </div>
        <div className="w-56 h-2 bg-black/60 rounded-full overflow-hidden border border-white/10 relative">
          <div className={`h-full transition-all duration-200 ${healthPct > 0.5 ? "bg-emerald-500" : healthPct > 0.25 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${healthPct * 100}%` }} />
          {/* Regen cooldown shimmer overlay — shows a thin amber line at the right edge
              of the health bar while waiting for regen to kick in. */}
          {regenWaiting && (
            <div className="absolute inset-0 pointer-events-none" style={{
              background: `linear-gradient(90deg, transparent ${healthPct * 100}%, rgba(251,191,36,0.4) ${healthPct * 100}%, rgba(251,191,36,0.4) ${(healthPct + 0.04) * 100}%, transparent ${(healthPct + 0.04) * 100}%)`,
            }} />
          )}
        </div>
        {/* Regen status text under the bar */}
        {regenWaiting && (
          <div className="text-rose-300/80 text-[10px] mt-0.5 uppercase tracking-wider font-bold">Regen in {regenSec}s</div>
        )}
        {/* Sprint stamina bar: drains while sprinting, regens after a delay.
            Cyan when active, amber when exhausted (below resume threshold). */}
        <div className="mt-2 flex items-center gap-1.5">
          <Zap className={`w-3 h-3 ${(hud.stamina ?? 100) < 25 ? "text-amber-400" : "text-cyan-400"}`} />
          <div className="w-40 h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/10">
            <div
              className={`h-full transition-all duration-150 ${(hud.stamina ?? 100) < 25 ? "bg-amber-500" : "bg-cyan-400"}`}
              style={{ width: `${hud.stamina ?? 100}%` }}
            />
          </div>
          {(hud.staminaCooldownMs ?? 0) > 0 && (hud.stamina ?? 100) < 100 && (
            <span className="text-amber-300/70 text-[9px] uppercase tracking-wider">+{(hud.staminaCooldownMs ?? 0) / 1000 | 0}s</span>
          )}
        </div>
      </div>
      )}

      {/* bottom right: ammo + weapon + slot indicator (desktop only — mobile
          uses the centered bottom cluster below). */}
      {!isTouch && (
      <div className="absolute bottom-6 right-6 text-right">
        <div className="text-white/60 text-xs uppercase tracking-widest mb-0.5 flex items-center justify-end gap-1.5">
          {/* Category color dot — matches the 3D accent band on the weapon model */}
          {(() => { const w = weaponById(hud.weaponId); const ca = CATEGORY_ACCENT[w.category]; return (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-white/15 bg-black/40" style={{ color: ca.color }}>
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: ca.color, boxShadow: `0 0 4px ${ca.color}` }} />
              <span className="text-[9px] font-bold tracking-wider">{ca.label}</span>
            </span>
          ); })()}
          <CrosshairIcon className="w-3 h-3 text-amber-400" />
          {hud.weaponName}
        </div>
        {hud.heat !== undefined ? (
          <div className="mt-1">
            <div className={`text-lg font-black tracking-widest ${hud.overheated ? "text-rose-400" : "text-cyan-300"}`}>
              {hud.overheated ? "OVERHEATED" : `HEAT ${Math.round(hud.heat)}%`}
            </div>
            <div className="ml-auto h-2 w-44 overflow-hidden rounded-full bg-white/15">
              <div className={`h-full transition-all duration-100 ${hud.overheated ? "bg-rose-500" : "bg-cyan-400"}`} style={{ width: `${hud.heat}%` }} />
            </div>
            <div className="text-[10px] text-white/50 mt-1">Unlimited energy · R to vent</div>
          </div>
        ) : hud.weaponId === "wonder_turret" ? (
          <div className="flex flex-col items-end">
            <span className={`text-lg font-black tracking-widest ${hud.ammo > 0 ? "text-emerald-300" : "text-violet-300"}`}>
              {hud.turretDeployPending ? "PLANTING TURRET…" : hud.turretDeployFailed ? "PLANT FAILED — RETRY" : hud.ammo > 0 ? "TURRET READY" : "TURRET CHARGING"}
            </span>
            <span className="text-[11px] text-white/55">{hud.ammo} deployment charge · Fire to plant</span>
          </div>
        ) : (
          <div className="flex items-end justify-end gap-1">
            <span className={`text-4xl font-bold tabular-nums ${lowAmmo ? "text-rose-400 animate-pulse" : ammoPct < 0.5 ? "text-amber-300" : "text-white"}`}>{hud.ammo}</span>
            <span className="text-white/40 text-lg mb-1">/ {hud.magSize}</span>
          </div>
        )}
        {hud.reloading && <div className="text-amber-400 text-xs animate-pulse mt-1">{hud.heat !== undefined ? "VENTING…" : "RELOADING…"}</div>}
        {hud.wonderRechargeMs !== undefined && <div className="text-violet-300 text-[11px] mt-1">{hud.wonderRechargeMs > 0 ? `CHARGING · ${(hud.wonderRechargeMs / 1000).toFixed(1)}s` : hud.weaponId === "wonder_turret" ? "PLANT WITH FIRE" : "WONDER CHARGE READY"} · {hud.weaponId === "wonder_turret" ? "Placed turret lasts 25s" : "No reserve ammo"}</div>}
        {hud.boltCharges !== undefined && <div className="text-emerald-300 text-[10px] mt-1">Recovered bolts: {hud.boltCharges} · proximity pickup</div>}
        {hud.wonderRechargeMs === undefined && hud.heat === undefined && lowAmmo && !hud.reloading && <div className="text-rose-400 text-[10px] mt-1 flex items-center justify-end gap-1"><AlertTriangle className="w-2.5 h-2.5" /> LOW AMMO — RELOAD</div>}
        {/* Weapon slot indicator: 3 mini-slots showing 1=primary, 2=secondary, 3=melee.
            The active slot is highlighted; others are dim. Weapon name shows under each. */}
        <div className="mt-2 flex items-center justify-end gap-1.5">
          <SlotPip n={1} name={hud.primaryName} active={slotNum === 1} color="emerald" weaponId={hud.primaryWeaponId} />
          <SlotPip n={2} name={hud.secondaryName} active={slotNum === 2} color="amber" weaponId={hud.secondaryWeaponId} />
          <SlotPip n={3} name={hud.meleeName} active={slotNum === 3} color="rose" weaponId={hud.meleeWeaponId} />
        </div>
      </div>
      )}

      {/* ── Mobile bottom-center cluster ──
          On touch devices the bottom-left/bottom-right corners are occupied by
          the on-screen controls (Jump + weapon swap on the left; Fire + ADS +
          Reload on the right). So the health / stamina / ammo readouts move to
          a single compact pill centered at the bottom of the screen. The health
          regen countdown is intentionally omitted (per the mobile UI spec). */}
      {isTouch && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none">
          {/* Top row: weapon name + ammo (compact, single line) */}
          <div className="bg-black/55 backdrop-blur px-2.5 py-0.5 rounded-full border border-white/10 flex items-center gap-1.5">
            {/* Category color dot — matches the 3D accent band on the weapon model */}
            {(() => { const w = weaponById(hud.weaponId); const ca = CATEGORY_ACCENT[w.category]; return (
              <span className="inline-flex items-center gap-0.5" title={w.category}>
                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: ca.color, boxShadow: `0 0 4px ${ca.color}` }} />
              </span>
            ); })()}
            <CrosshairIcon className="w-2.5 h-2.5 text-amber-400" />
            <span className="text-white/70 text-[10px] uppercase tracking-wider font-semibold">{hud.weaponName}</span>
            <span className="text-white/20">·</span>
            {hud.heat !== undefined ? (
              <span className={`tabular-nums font-bold text-xs ${hud.overheated ? "text-rose-400" : "text-cyan-300"}`}>
                {Math.round(hud.heat)}% HEAT
              </span>
            ) : hud.weaponId === "wonder_turret" ? (
              <span className={`text-[10px] font-bold ${hud.ammo > 0 ? "text-emerald-300" : "text-violet-300"}`}>
                {hud.turretDeployPending ? "PLANTING…" : hud.turretDeployFailed ? "RETRY PLANT" : hud.ammo > 0 ? "PLANT READY" : "RECHARGING"}
              </span>
            ) : (
              <><span className={`tabular-nums font-bold text-xs ${lowAmmo ? "text-rose-400 animate-pulse" : ammoPct < 0.5 ? "text-amber-300" : "text-white"}`}>{hud.ammo}</span><span className="text-white/40 text-[9px]">/{hud.magSize}</span></>
            )}
            {hud.boltCharges !== undefined && <span className="text-emerald-400 text-[9px]">+{hud.boltCharges} bolts</span>}
            {hud.reloading && <span className="ml-1 text-amber-400 text-[9px] uppercase font-bold animate-pulse">{hud.heat !== undefined ? "VENT" : "RLD"}</span>}
            {hud.wonderRechargeMs !== undefined && <span className="ml-1 text-violet-300 text-[9px] font-mono">{hud.wonderRechargeMs > 0 ? `${Math.ceil(hud.wonderRechargeMs / 1000)}s` : "READY"}</span>}
          </div>
          {/* Bottom row: health + stamina bars (small, side by side) */}
          <div className="flex items-center gap-2">
            {/* Health */}
            <div className="flex items-center gap-1">
              <Heart className={`w-2.5 h-2.5 ${healthPct > 0.5 ? "text-emerald-400" : healthPct > 0.25 ? "text-amber-400" : "text-rose-500"}`} />
              <div className="w-20 h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/10">
                <div className={`h-full transition-all duration-200 ${healthPct > 0.5 ? "bg-emerald-500" : healthPct > 0.25 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${healthPct * 100}%` }} />
              </div>
              <span className="text-white/80 text-[10px] font-bold tabular-nums w-5">{hud.health}</span>
            </div>
            {/* Stamina */}
            <div className="flex items-center gap-1">
              <Zap className={`w-2.5 h-2.5 ${(hud.stamina ?? 100) < 25 ? "text-amber-400" : "text-cyan-400"}`} />
              <div className="w-14 h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/10">
                <div
                  className={`h-full transition-all duration-150 ${(hud.stamina ?? 100) < 25 ? "bg-amber-500" : "bg-cyan-400"}`}
                  style={{ width: `${hud.stamina ?? 100}%` }}
                />
              </div>
            </div>
            {/* Sprinting chevron pip (replaces the old dedicated Sprint button feedback) */}
            {hud.sprinting && (
              <span className="flex items-center gap-0.5 text-cyan-300 text-[9px] font-bold uppercase tracking-wider animate-pulse">
                <ChevronUp className="w-2.5 h-2.5" />
              </span>
            )}
          </div>
        </div>
      )}

      {/* respawn overlay */}
      {!hud.alive && (
        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
          <div className="text-rose-500 text-5xl font-black tracking-widest mb-2" style={{ textShadow: "0 0 20px rgba(239,68,68,0.6)" }}>ELIMINATED</div>
          {hud.lastDeath && (
            <div className="my-4 px-6 py-3 rounded-xl border border-white/20 bg-black/75 text-center max-w-[88vw]">
              <div className="text-white/65 uppercase text-xs tracking-widest">Eliminated by</div>
              <div className="text-white font-bold text-lg">{hud.lastDeath.killer}</div>
              <div className="text-amber-200 text-sm">{!WEAPONS.some(w=>w.id===hud.lastDeath!.weaponId)
                ? "Environment: "+hud.lastDeath.weaponId.replace(/^(hazard_|env_)/,"").replaceAll("_"," ")
                : weaponById(hud.lastDeath.weaponId).name}</div>
              {hud.lastDeath.attachments.length>0 && <div className="text-white/60 text-xs mt-1">
                {hud.lastDeath.attachments.map(id=>ATTACHMENTS.find(a=>a.id===id)?.name??id).join(" · ")}
              </div>}
            </div>
          )}
          {mode === "survival" ? (
            <div className="text-white/70 text-lg">Survival run ended</div>
          ) : (
            <div className="text-white/70 text-lg">Respawning in <span className="text-white font-bold text-2xl">{hud.respawnIn}</span>s</div>
          )}
        </div>
      )}

      {mode === "survival" && hud.survivalDowned && (
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 z-40 rounded-xl border border-amber-400/50 bg-black/80 px-7 py-5 text-center">
          <div className="text-amber-300 text-2xl font-black tracking-wider">DOWNED</div>
          <div className="text-white/75 text-sm mt-1">Secondary weapon only · Hold position</div>
          <div className="text-white/50 text-xs mt-2">Survive until your teammate clears the wave to rejoin during preparation.</div>
        </div>
      )}

      {/* ---- Round 18-b: Survival wave banner ----
          Shows "WAVE N — X enemies incoming" for ~3.5s when a new wave starts.
          Triggered by `survivalWaveBannerAt` (a timestamp set by the engine
          when startSurvivalWave fires, or when the online snapshot's wave
          number increases). The banner fades in/out via CSS animation. */}
      {mode === "survival" && hud.survivalWaveBannerAt && (performance.now() - hud.survivalWaveBannerAt < 3500) && (
        <div
          key={hud.survivalWaveBannerAt}
          className="absolute left-1/2 -translate-x-1/2 top-1/4 pointer-events-none z-30"
          style={{ animation: "waveBannerFade 3.5s ease-out forwards" }}
        >
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-black/70 backdrop-blur border-2 border-amber-500/50" style={{ boxShadow: "0 0 30px rgba(245,158,11,0.4)" }}>
              <Siren className="w-6 h-6 text-amber-400 animate-pulse" />
              <div className="flex flex-col">
                <span className="text-amber-300 font-black text-2xl tracking-wider uppercase leading-none">
                  Wave {hud.survivalWave ?? 1}
                </span>
                <span className="text-rose-300 font-bold text-sm uppercase tracking-wider mt-0.5">
                  {hud.survivalEnemiesLeft ?? 0} enemies incoming
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- Pre-match countdown overlay ----
          Shown when the engine is in the pre-match freeze phase. A big number
          (5..4..3..2..1) pulses in the center with a "GET READY" label and the
          match mode name. When the countdown reaches 0, the engine plays a
          "GO!" SFX and normal gameplay begins. The 3D scene is visible behind
          this overlay (at reduced opacity) so the player can look around and
          orient themselves during the freeze. */}
      {(hud.preMatchCountdown ?? 0) > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="text-amber-300/80 text-sm font-bold tracking-[0.4em] uppercase mb-2" style={{ animation: "countdownPulse 1s ease-in-out infinite" }}>
            Get Ready
          </div>
          <div
            key={hud.preMatchCountdown}
            className="text-white font-black leading-none mb-3"
            style={{
              fontSize: "9rem",
              textShadow: "0 0 40px rgba(245,158,11,0.7), 0 0 80px rgba(244,63,94,0.4)",
              animation: "countdownPop 0.5s ease-out",
            }}
          >
            {hud.preMatchCountdown}
          </div>
          <div className="text-white/50 text-xs uppercase tracking-[0.3em] font-semibold">
            {matchInfo.title}
            <span className="mx-2 text-white/20">·</span>
            <span className="text-cyan-300">{displayMapLabel(hud.mapName ?? "Compound")}</span>
          </div>
        </div>
      )}

      {/* scoreboard — shown only when the player explicitly holds Tab. Previously
          this also auto-showed when the pointer was unlocked (e.g., after pressing
          Escape), which caused the scoreboard to overlap the "CLICK TO PLAY"
          re-engage overlay. Now the two states are mutually exclusive: Escape
          shows the click-to-play overlay; Tab shows the scoreboard.
          In TDM mode, the scoreboard is split into two side-by-side team panels
          (Red / Blue) so friendlies and enemies are visually grouped. In all
          other modes (ffa / gungame / survival) it remains a single flat table. */}
      {showScoreboard && hud.alive !== undefined && hud.pointerLocked && (
        (mode === "tdm" || mode === "killconfirmed" || mode === "ctf") ? (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] max-w-[94vw]">
            <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden">
              {/* header bar */}
              <div className="px-4 py-2.5 bg-white/5 border-b border-white/10 flex items-center gap-2">
                <Users className="w-4 h-4 text-white/70" />
                <span className="text-white font-bold tracking-wider uppercase text-sm">{mode === "ctf" ? "Capture the Flag · Captures" : mode === "killconfirmed" ? "Kill Confirmed · Points" : "Team Deathmatch · Kills"}</span>
                <span className="ml-auto text-white/40 text-xs">Hold TAB</span>
              </div>
              {/* team panels */}
              <div className="flex flex-col sm:flex-row gap-2 p-2 max-h-[50vh] overflow-y-auto custom-scroll">
                <TeamPanel team="red" score={hud.teamScores.red} rows={hud.scoreboard.filter(r => r.team === "red")} selfTeam={selfTeam} scoreLabel={mode === "ctf" ? "Cap" : mode === "killconfirmed" ? "Pts" : "Scr"} />
                <TeamPanel team="blue" score={hud.teamScores.blue} rows={hud.scoreboard.filter(r => r.team === "blue")} selfTeam={selfTeam} scoreLabel={mode === "ctf" ? "Cap" : mode === "killconfirmed" ? "Pts" : "Scr"} />
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] max-w-[92vw]">
            <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-white/5 border-b border-white/10 flex items-center gap-2">
                <Users className="w-4 h-4 text-white/70" />
                <span className="text-white font-bold tracking-wider uppercase text-sm">{matchInfo.title}</span>
                <span className="ml-auto text-white/40 text-xs">Hold TAB</span>
              </div>
              <div className="max-h-[50vh] overflow-y-auto custom-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/40 text-xs uppercase">
                      <th className="text-left px-4 py-1.5 font-medium">Player</th>
                      <th className="text-center px-2 py-1.5 font-medium w-14">K</th>
                      <th className="text-center px-2 py-1.5 font-medium w-14">D</th>
                      <th className="text-center px-4 py-1.5 font-medium w-16">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...hud.scoreboard].sort((a, b) => b.score - a.score).map((r) => (
                      <tr key={r.id} className={`border-t border-white/5 ${r.isSelf ? "bg-emerald-500/10" : ""}`}>
                        <td className="px-4 py-1.5">
                          <span className={`inline-block w-2 h-2 rounded-full mr-2 ${teamDot(r.team)}`} />
                          <span className={r.isSelf ? "text-emerald-300 font-semibold" : "text-white/90"}>{r.name}</span>
                          {r.isBot && <span className="ml-1.5 text-white/30 text-xs">BOT</span>}
                        </td>
                        <td className="text-center px-2 py-1.5 text-white tabular-nums">{r.kills}</td>
                        <td className="text-center px-2 py-1.5 text-white/50 tabular-nums">{r.deaths}</td>
                        <td className="text-center px-4 py-1.5 text-white font-bold tabular-nums">{r.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      )}
      <style>{`
        .custom-scroll::-webkit-scrollbar{width:6px}.custom-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:3px}
        @keyframes eliminationPop { from { opacity: 0; transform: translate(-50%,8px) scale(.9); } to { opacity: 1; transform: translate(-50%,0) scale(1); } }
        @keyframes killstreakPop { 0% { transform: translate(-50%, 10px) scale(0.7); opacity: 0; } 60% { transform: translate(-50%, 0) scale(1.15); opacity: 1; } 100% { transform: translate(-50%, 0) scale(1); opacity: 1; } }
        @keyframes killfeedSlide { from { transform: translateX(-8px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes dmgDirFade { 0% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes countdownPop { 0% { transform: scale(2.2); opacity: 0; } 50% { transform: scale(1); opacity: 1; } 100% { transform: scale(1); opacity: 0.85; } }
        @keyframes countdownPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes waveBannerFade { 0% { transform: translate(-50%, -10px) scale(0.85); opacity: 0; } 15% { transform: translate(-50%, 0) scale(1); opacity: 1; } 80% { transform: translate(-50%, 0) scale(1); opacity: 1; } 100% { transform: translate(-50%, -8px) scale(0.95); opacity: 0; } }
      `}</style>
    </div>
  );
}

function teamColor(t: string) {
  return t === "red" ? "text-red-400" : t === "blue" ? "text-blue-400" : "text-white/80";
}
function teamDot(t: string) {
  return t === "red" ? "bg-red-500" : t === "blue" ? "bg-blue-500" : "bg-white/60";
}

// ---- TDM scoreboard team panel ----
// Renders one half of the Team Deathmatch scoreboard: a colored header
// (Red/Blue accent + the team's total score) followed by a compact table of
// that team's players sorted by score (desc). The local player's row is
// highlighted emerald (same as the FFA table). Every player whose team matches
// `selfTeam` (i.e. friendlies — which in a team panel is either everyone or
// no-one) gets a small Shield icon prefix so allies are visually distinct.
function TeamPanel({ team, score, rows, selfTeam, scoreLabel }: { team: "red" | "blue"; score: number; rows: ScoreRow[]; selfTeam?: string; scoreLabel: string }) {
  const accent = team === "red" ? "border-red-500/40" : "border-blue-500/40";
  const headerBg = team === "red" ? "bg-red-500/10" : "bg-blue-500/10";
  const headerText = team === "red" ? "text-red-400" : "text-blue-400";
  const dotColor = team === "red" ? "bg-red-500" : "bg-blue-500";
  const allyColor = team === "red" ? "text-red-300/80" : "text-blue-300/80";
  const sorted = [...rows].sort((a, b) => b.score - a.score || b.kills - a.kills);
  return (
    <div className={`flex-1 rounded-lg border ${accent} overflow-hidden`}>
      <div className={`px-3 py-2 ${headerBg} flex items-center gap-2`}>
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor}`} />
        <span className={`${headerText} font-bold uppercase tracking-wider text-xs`}>{team === "red" ? "Red Team" : "Blue Team"}</span>
        <span className="ml-auto text-white font-black text-lg tabular-nums">{score}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-white/40 text-[10px] uppercase">
            <th className="text-left px-3 py-1 font-medium">Player</th>
            <th className="text-center px-1 py-1 font-medium w-10">K</th>
            <th className="text-center px-1 py-1 font-medium w-10">D</th>
            <th className="text-center px-3 py-1 font-medium w-12">{scoreLabel}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className={`border-t border-white/5 ${r.isSelf ? "bg-emerald-500/15" : ""}`}>
              <td className="px-3 py-1.5">
                <span className="flex items-center gap-1">
                  {r.team === selfTeam && (
                    <Shield className={`w-3 h-3 shrink-0 ${allyColor}`} aria-label="Ally" />
                  )}
                  <span className={r.isSelf ? "text-emerald-300 font-semibold" : "text-white/90"}>{r.name}</span>
                  {r.isBot && <span className="ml-1 text-white/30 text-[10px]">BOT</span>}
                </span>
              </td>
              <td className="text-center px-1 py-1.5 text-white tabular-nums">{r.kills}</td>
              <td className="text-center px-1 py-1.5 text-white/50 tabular-nums">{r.deaths}</td>
              <td className="text-center px-3 py-1.5 text-white font-bold tabular-nums">{r.score}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-3 text-center text-white/30 text-xs italic">No players</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---- Weapon slot indicator pip ----
// Small badge showing the slot number (1/2/3) + a short weapon name. The active
// slot is highlighted with the slot's accent color; inactive slots are dim.
function SlotPip({ n, name, active, color, weaponId }: { n: number; name: string; active: boolean; color: "emerald" | "amber" | "rose"; weaponId?: string }) {
  const colorClasses = {
    emerald: active ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-200" : "border-white/10 bg-black/40 text-white/40",
    amber: active ? "border-amber-400/70 bg-amber-500/20 text-amber-200" : "border-white/10 bg-black/40 text-white/40",
    rose: active ? "border-rose-400/70 bg-rose-500/20 text-rose-200" : "border-white/10 bg-black/40 text-white/40",
  };
  // Category dot — shows the weapon's category color (matches the 3D band).
  const catDot = weaponId ? (() => {
    const w = weaponById(weaponId);
    const ca = CATEGORY_ACCENT[w.category];
    return <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ca.color, boxShadow: active ? `0 0 4px ${ca.color}` : "none", opacity: active ? 1 : 0.5 }} />;
  })() : null;
  return (
    <div className={`px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors ${colorClasses[color]}`}>
      <span className="tabular-nums opacity-80">{n}</span>
      {catDot}
      <span className="truncate max-w-[60px] text-[9px]">{name.split(" ")[0]}</span>
    </div>
  );
}

// ---- Gun Game progression indicator ----
// Shows a horizontal tier list (one cell per weapon in GUN_GAME_PROGRESSION).
// The current tier is highlighted in purple (the gungame accent color). A
// compact label shows the current tier's weapon name (e.g., "Tier 5/18 — VK-12 Assault").
function GunGameProgress({ index, total, currentWeaponId, compact }: { index: number; total: number; currentWeaponId: string; compact?: boolean }) {
  const tier = Math.max(1, Math.min(total, index + 1));
  const pct = total > 0 ? Math.min(100, tier / total * 100) : 0;
  const final = total > 0 && tier === total;
  return (
    <div className={`rounded-lg bg-black/60 backdrop-blur border border-purple-500/30 flex flex-col items-center ${compact ? "gap-0.5 px-2 py-1" : "gap-1 px-3 py-1.5"}`}>
      <div className={`flex items-center justify-center gap-2 max-w-[85vw] ${compact ? "text-[10px]" : "text-xs"}`}>
        <span className="font-black tabular-nums text-purple-200 whitespace-nowrap">Tier {tier}/{total}</span>
        <span className="text-white/25">·</span>
        <span className="font-semibold text-white/85 truncate">{weaponById(currentWeaponId).name}</span>
        {final && <span className="text-amber-300 font-black uppercase text-[9px]">Final</span>}
      </div>
      <div className={`rounded-full bg-white/15 overflow-hidden ${compact ? "w-36 h-1" : "w-52 h-1.5"}`}
           role="progressbar" aria-label="Gun Game weapon progression" aria-valuemin={0} aria-valuemax={total} aria-valuenow={tier}>
        <div className="h-full rounded-full bg-purple-400 transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ---- Scope / Reticle overlay ----
// Renders the appropriate reticle based on the equipped sight type. For 1x sights
// (iron/red_dot/holo/laser) we render the standard crosshair. For magnified sights
// (acog/hunter/thermal/nvg) we render a scope circle + reticle, with tinted overlays
// for thermal (amber) and NVG (green). Fades in/out with ADS progress.
function ScopeOrCrosshair({
  hud, crosshairColor, crosshairSize, dynamicGap, showHit, hitMarkerAge, scopeOverlay,
}: {
  hud: HudState;
  crosshairColor: string;
  crosshairSize: number;
  dynamicGap: number;   // gap from center (drives spread visualization)
  showHit: boolean;
  hitMarkerAge: number;
  scopeOverlay: boolean;
}) {
  const sightType = hud.sightType ?? "iron";
  const adsP = hud.adsProgress ?? 0;
  // Dedicated flag from the engine: true when the local player is ADS-ing with
  // a sniper-class weapon (regardless of which sight attachment is equipped).
  // When set, we force the sniper-scope overlay + mil-dot reticle.
  const isSniperScoped = !!hud.scoped;
  const isMagnified = sightType === "acog" || sightType === "hunter" || sightType === "thermal" || sightType === "nvg" || sightType === "sniper_scope";
  // Show the scope overlay only when meaningfully ADS (>0.5) AND the setting is on.
  // The dedicated `scoped` flag also triggers it for snipers with non-scope sights.
  const showScope = scopeOverlay && (isMagnified || isSniperScoped) && adsP > 0.5;
  const hasReflex = sightType === "red_dot" || sightType === "holo";
  // Reticle color per sight type. Snipers (scoped flag) use the dark sniper crosshair.
  const reticleColor =
    sightType === "thermal" ? "#ffb347" :
    sightType === "nvg" ? "#7dff8a" :
    sightType === "red_dot" ? "#ff3b3b" :
    sightType === "holo" ? "#22ff66" :
    sightType === "acog" ? "#ff2222" :
    sightType === "hunter" ? "#1a1a1a" :
    sightType === "sniper_scope" || isSniperScoped ? "#1a1a1a" :
    crosshairColor;
  // When ADS with a magnified sight, the crosshair gap closes (tighter grouping).
  // Otherwise, dynamicGap drives the spread visualization (sprint = wide, still = tight).
  const gap = adsP > 0.3 ? Math.max(1, dynamicGap * (1 - adsP * 0.7)) : dynamicGap;

  if (!showScope) {
    // Standard crosshair (1x sights, hipfire, or when scope overlay is disabled).
    // The crosshair uses a 0×0 container positioned at the exact screen center
    // (left:50%, top:50%, no translate needed since width/height are 0). Each arm
    // is positioned with explicit `left`/`right`/`top`/`bottom` offsets so the
    // inner edge of every arm is EXACTLY `gap` pixels from center — guaranteed
    // equidistant on all 4 sides. The old transform-based approach could produce
    // subpixel asymmetry because the Tailwind -translate-x-1/2 classes were
    // silently overridden by the inline `transform` property.
    return (
      <div className="absolute" style={{ left: '50%', top: '50%', width: 0, height: 0, pointerEvents: 'none' }}>
          {/* Reflex-window frame is part of the physical weapon mesh.
              HUD renders only the reticle, never a contradictory round housing. */}
          {hasReflex && sightType==="holo" && adsP>.3 && (
            <div className="absolute rounded-full border pointer-events-none"
              style={{width:29,height:29,transform:"translate(-50%,-50%)",
                borderColor:reticleColor,opacity:Math.min(.7,(adsP-.3)*1.4)}}/>
          )}
          {/* For red_dot/holo/laser, render a single dot in the reticle color instead of the crosshair */}
          {(sightType === "red_dot" || sightType === "holo" || sightType === "laser") && adsP > 0.3 ? (
            <div className="absolute rounded-full"
              style={{ width: 4, height: 4, background: reticleColor, boxShadow: `0 0 6px ${reticleColor}`, opacity: Math.min(1, adsP), transform: 'translate(-50%, -50%)' }} />
          ) : (
            <>
              {/* Center dot (2×2, centered on the 0×0 origin via translate) */}
              <div className="absolute rounded-full" style={{ width: 2, height: 2, background: crosshairColor, transform: 'translate(-50%, -50%)' }} />
              {/* LEFT arm: right edge at -gap from center, extends left by crosshairSize */}
              <div className="absolute" style={{ width: crosshairSize, height: 1.5, background: crosshairColor, right: gap, top: -0.75 }} />
              {/* RIGHT arm: left edge at +gap from center, extends right by crosshairSize */}
              <div className="absolute" style={{ width: crosshairSize, height: 1.5, background: crosshairColor, left: gap, top: -0.75 }} />
              {/* TOP arm: bottom edge at -gap from center, extends up by crosshairSize */}
              <div className="absolute" style={{ width: 1.5, height: crosshairSize, background: crosshairColor, left: -0.75, bottom: gap }} />
              {/* BOTTOM arm: top edge at +gap from center, extends down by crosshairSize */}
              <div className="absolute" style={{ width: 1.5, height: crosshairSize, background: crosshairColor, left: -0.75, top: gap }} />
            </>
          )}
          {showHit && (
            <svg className="absolute" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', opacity: 1 - hitMarkerAge / 220 }} width="34" height="34" viewBox="0 0 34 34">
              <path d="M5 5 L12 12 M29 5 L22 12 M5 29 L12 22 M29 29 L22 22" stroke="#ef4444" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            </svg>
          )}
      </div>
    );
  }

  // Magnified scope overlay: circular vignette + reticle, with tint for thermal/NVG.
  // Fade-in starts a touch earlier when the dedicated `scoped` flag is set so the
  // sniper scope overlay is visible as soon as the player is meaningfully scoped.
  const scopeOpacity = Math.min(1, (adsP - 0.5) / 0.45);  // 0..1 fade-in
  const tintBg =
    sightType === "thermal" ? "rgba(255,140,30,0.10)" :
    sightType === "nvg" ? "rgba(40,180,60,0.12)" :
    "rgba(0,0,0,0)";
  return (
    <>
      {/* Tinted full-screen wash for thermal/NVG (skipped for sniper/hunter/acog which use a clean dark scope) */}
      {sightType !== "hunter" && sightType !== "acog" && sightType !== "sniper_scope" && !isSniperScoped && (
        <div className="absolute inset-0 pointer-events-none" style={{ background: tintBg, opacity: scopeOpacity }} />
      )}
      {/* Scope vignette: black ring around the visible circle */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: scopeOpacity }}>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: "min(70vh, 70vw)", height: "min(70vh, 70vw)",
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
            border: `2px solid ${reticleColor}40`,
          }}
        />
      </div>
      {/* Reticle: crosshair lines + center mark + (for hunter/sniper) mil-dot ticks */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ opacity: scopeOpacity }}>
        <svg width="min(70vh, 70vw)" height="min(70vh, 70vw)" viewBox="-100 -100 200 200" className="block">
          {/* Crosshair lines (broken at center for acog chevron) */}
          {sightType === "acog" ? (
            <>
              {/* ACOG: vertical line top + chevron at center + stadia lines */}
              <line x1="0" y1="-90" x2="0" y2="-12" stroke={reticleColor} strokeWidth="0.6" />
              <line x1="0" y1="6" x2="0" y2="90" stroke={reticleColor} strokeWidth="0.6" />
              <path d="M-3,1 L0,-3 L3,1" fill="none" stroke={reticleColor} strokeWidth="0.75" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="-30" y1="0" x2="-15" y2="0" stroke={reticleColor} strokeWidth="0.4" />
              <line x1="15" y1="0" x2="30" y2="0" stroke={reticleColor} strokeWidth="0.4" />
            </>
          ) : sightType === "hunter" || sightType === "sniper_scope" || isSniperScoped ? (
            <>
              {/* Hunter 6x / Sniper Scope 6x: thin crosshair + mil-dot ticks */}
              <line x1="-90" y1="0" x2="90" y2="0" stroke={reticleColor} strokeWidth="0.4" />
              <line x1="0" y1="-90" x2="0" y2="90" stroke={reticleColor} strokeWidth="0.4" />
              {[-60, -40, -20, 20, 40, 60].map((d) => (
                <circle key={d} cx={d} cy="0" r="0.8" fill={reticleColor} />
              ))}
              {[-60, -40, -20, 20, 40, 60].map((d) => (
                <circle key={`v${d}`} cx="0" cy={d} r="0.8" fill={reticleColor} />
              ))}
              <circle cx="0" cy="0" r="1.2" fill={reticleColor} />
            </>
          ) : sightType === "thermal" ? (
            <>
              {/* Thermal: white-hot crosshair with thicker center */}
              <line x1="-90" y1="0" x2="-8" y2="0" stroke={reticleColor} strokeWidth="0.8" />
              <line x1="8" y1="0" x2="90" y2="0" stroke={reticleColor} strokeWidth="0.8" />
              <line x1="0" y1="-90" x2="0" y2="-8" stroke={reticleColor} strokeWidth="0.8" />
              <line x1="0" y1="8" x2="0" y2="90" stroke={reticleColor} strokeWidth="0.8" />
              <circle cx="0" cy="0" r="2.5" fill={reticleColor} />
            </>
          ) : (
            <>
              {/* NVG: green phosphor crosshair + circle */}
              <line x1="-90" y1="0" x2="90" y2="0" stroke={reticleColor} strokeWidth="0.5" />
              <line x1="0" y1="-90" x2="0" y2="90" stroke={reticleColor} strokeWidth="0.5" />
              <circle cx="0" cy="0" r="40" stroke={reticleColor} strokeWidth="0.4" fill="none" />
              <circle cx="0" cy="0" r="1.5" fill={reticleColor} />
            </>
          )}
        </svg>
      </div>
      {/* Hit marker still shows on top of the scope */}
      {showHit && (
        <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" width="34" height="34" viewBox="0 0 34 34" style={{ opacity: (1 - hitMarkerAge / 220) * scopeOpacity }}>
          <path d="M5 5 L12 12 M29 5 L22 12 M5 29 L12 22 M29 29 L22 22" stroke="#ef4444" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </svg>
      )}
    </>
  );
}
