"use client";
import { useGame } from "@/lib/game-store";
import { displayLabel, weaponCategoryLabel } from "@/lib/display-labels";
import { WEAPONS, weaponById, attachmentById, RARITY_COLORS, rankForLevel, nextRank } from "@/lib/game-data";
import {
  Crosshair, Trophy, Backpack, Zap, ChevronRight, Target,
  Crown, Sparkles, Calendar, TrendingUp, Skull, Play as PlayIcon, Star, Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";

interface ChallengeView {
  challengeId: string; title: string; description: string; icon: string;
  goal: number; progress: number; completed: boolean; awarded: boolean;
  rewardXp: number; rewardCredits: number;
  // 17-C: true if this is an elite-promoted variant (3× goal, 3× reward,
  // purple/pink UI treatment). Optional for backward-compat with older
  // API responses that didn't include the flag.
  isElite?: boolean;
}
interface WeeklyChallengeView extends ChallengeView {
  weekKey: string;
}

export function MainMenu() {
  const { profile, setScreen } = useGame();
  const [challenges, setChallenges] = useState<ChallengeView[]>([]);
  const [weekly, setWeekly] = useState<WeeklyChallengeView[]>([]);

  useEffect(() => {
    useGame.getState().refreshProfile();
    // load daily + weekly challenges in one fetch (elite variants are embedded
    // in each array with isElite=true — no separate lifetime elite list anymore)
    const key = useGame.getState().playerKey;
    fetch(`/api/challenges?playerKey=${encodeURIComponent(key)}`).then((r) => r.json()).then((d) => {
      if (d?.challenges) setChallenges(d.challenges);
      if (d?.weekly) setWeekly(d.weekly);
    }).catch(() => {});
  }, []);

  const equipped = profile?.loadout;
  const equippedWeapon = equipped ? weaponById(equipped.weapon.id) : WEAPONS[0];
  const lvl = profile?.level ?? 1;
  const xp = profile?.xpProgress ?? { current: 0, needed: 100 };
  const rank = rankForLevel(lvl);
  const next = nextRank(lvl);
  const xpPct = Math.min(100, xp.needed ? (xp.current / xp.needed) * 100 : 100);

  return (
    <div className="min-h-screen flex flex-col">
      {/* header */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <div className="relative w-9 h-9 rounded-md bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-900/40">
              <Crosshair className="w-5 h-5 text-white" />
              <div className="absolute inset-0 rounded-md ring-1 ring-white/20" />
            </div>
            <div>
              <div className="font-black tracking-[0.2em] text-white text-sm leading-none">VANGUARD</div>
              <div className="text-[10px] tracking-[0.3em] text-amber-400/80 leading-none mt-0.5">OPS</div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-0.5 sm:gap-1.5">
            <Button
              onClick={() => setScreen("play")}
              className="bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-bold h-9 px-4 shadow-lg shadow-amber-900/30"
            >
              <PlayIcon className="w-4 h-4 mr-1.5" /> Play
            </Button>
            <NavBtn onClick={() => setScreen("armory")} icon={<Backpack className="w-4 h-4" />} label="Armory" />
            <NavBtn onClick={() => setScreen("profile")} icon={<Trophy className="w-4 h-4" />} label="Profile" />
            <NavBtn onClick={() => setScreen("settings")} icon={<Sparkles className="w-4 h-4" />} label="Settings" />

          </div>
        </div>
      </header>

      {/* news ticker removed per user request — navigation is via the header menu */}

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* player banner */}
        <div className="grid lg:grid-cols-[1fr_360px] gap-5 mb-6">
          {/* profile card */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-900/80 to-black p-6">
            <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full blur-3xl" style={{ background: `${rank.color}15` }} />
            <div className="absolute -bottom-24 -left-10 w-60 h-60 bg-emerald-600/10 rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-4 mb-5">
                {/* rank insignia */}
                <div className="relative">
                  <div className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl font-black border-2"
                    style={{ background: `linear-gradient(135deg, ${rank.color}25, ${rank.color}05)`, borderColor: `${rank.color}60`, color: rank.color, boxShadow: `0 0 20px ${rank.color}30` }}>
                    {rank.insignia}
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-black border border-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg" style={{ color: rank.color }}>
                    {rank.shortName}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white/50 text-xs uppercase tracking-widest flex items-center gap-2">
                    <span>{rank.name}</span>
                    <span className="text-white/30">·</span>
                    <span>LVL {lvl}</span>
                  </div>
                  <div className="text-2xl font-bold text-white truncate">{profile?.name ?? "Recruit"}</div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-white/50">
                    <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-amber-400" /> <span className="text-amber-300 font-semibold">{profile?.credits ?? 0}</span> CR</span>
                    <span className="flex items-center gap-1"><Target className="w-3 h-3 text-emerald-400" /> <span className="text-white/80">{profile?.kills ?? 0}</span> kills</span>
                    <span className="flex items-center gap-1"><Trophy className="w-3 h-3 text-rose-400" /> <span className="text-white/80">{profile?.matchesWon ?? 0}</span> wins</span>
                    <span className="flex items-center gap-1"><Skull className="w-3 h-3 text-white/40" /> <span className="text-white/80">{profile?.deaths ?? 0}</span> deaths</span>
                  </div>
                </div>
              </div>
              {/* xp bar */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-white/60 flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3 text-amber-400" />
                    {next ? `Next: ${next.name} (LVL ${next.level})` : "Max rank reached"}
                  </span>
                  <span className="text-white/70 tabular-nums">{xp.needed ? `${xp.current} / ${xp.needed} XP` : "Level cap · Career Contracts"}</span>
                </div>
                <div className="relative h-2.5 bg-black/60 rounded-full overflow-hidden border border-white/5">
                  <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-500" style={{ width: `${xpPct}%` }}>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_linear_infinite]" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* equipped loadout card */}
          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/50 text-xs uppercase tracking-widest flex items-center gap-1.5">
                <Crosshair className="w-3 h-3 text-amber-400" /> Equipped Loadout
              </span>
              <Button size="sm" variant="outline" onClick={() => setScreen("armory")} className="border-white/10 text-white/70 hover:text-white hover:bg-white/5 h-7 text-xs">
                Edit <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
            {/* weapon preview thumbnail */}
            <div className="relative h-24 rounded-xl mb-3 overflow-hidden border border-white/10 flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${equipped?.weaponSkin.color ?? "#2b2f36"}, ${equipped?.weaponSkin.emissive ?? "#0a0a0a"})` }}>
              {equipped?.weaponSkin.emissive && <div className="absolute inset-0" style={{ boxShadow: `inset 0 0 30px ${equipped.weaponSkin.emissive}` }} />}
              <div className="absolute left-2 top-2 text-[10px] uppercase tracking-wider text-white/50 font-mono">{weaponCategoryLabel(equippedWeapon.category)}</div>
              <div className="absolute right-2 top-2 text-[10px] uppercase tracking-wider font-bold" style={{ color: RARITY_COLORS[equipped?.weaponSkin.rarity ?? "common"] }}>
                {displayLabel(equipped?.weaponSkin.rarity)}
              </div>
              {/* weapon silhouette */}
              <div className="w-32 h-2.5 rounded-sm" style={{ background: equipped?.weaponSkin.color ?? "#2b2f36", boxShadow: equipped?.weaponSkin.emissive ? `0 0 16px ${equipped.weaponSkin.emissive}` : "none" }} />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/90 font-bold text-xs sm:text-sm tracking-wide drop-shadow-lg text-center leading-snug max-w-[88%] w-max px-3 py-2 rounded-md border border-white/20 bg-black/75 break-words">
                {equippedWeapon.name}
              </div>
            </div>
            <div className="space-y-2">
              <Row label="Weapon Skin" value={equipped?.weaponSkin.name ?? "Standard"} color={RARITY_COLORS[equipped?.weaponSkin.rarity ?? "common"]} />
              <Row label="Operative" value={equipped?.playerSkin.name ?? "Operative"} color={RARITY_COLORS[equipped?.playerSkin.rarity ?? "common"]} />
              <div className="pt-1.5 border-t border-white/5">
                <div className="text-white/40 text-xs mb-1.5 flex items-center gap-1.5">
                  <Wrench className="w-3 h-3" /> Attachments
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {equipped ? (
                    (["sight", "barrel", "grip", "magazine"] as const).map((slot) => {
                      const id = equipped.attachments[slot];
                      const attDef = id ? attachmentById(id) : null;
                      return (
                        <div key={slot} className="text-[10px] flex items-center gap-1 px-1.5 py-1 rounded bg-black/40 border border-white/5">
                          <span className="text-white/40 uppercase">{slot.slice(0, 3)}</span>
                          <span className={attDef ? "text-amber-300 truncate" : "text-white/30"}>{attDef ? attDef.name : "—"}</span>
                        </div>
                      );
                    })
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* daily challenges */}
        {challenges.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/60 to-black/40 p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span className="text-white font-bold tracking-wide uppercase text-sm">Daily Challenges</span>
                <span className="text-white/40 text-xs">Resets at midnight</span>
              </div>
              {challenges.some((c) => c.isElite) && (
                <Badge variant="outline" className="border-purple-500/40 text-purple-300/80 text-[10px] uppercase">
                  <Sparkles className="w-3 h-3 mr-1" /> Elite Active
                </Badge>
              )}
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {challenges.map((c) => {
                const pct = Math.min(100, (c.progress / c.goal) * 100);
                const elite = c.isElite === true;
                return (
                  <div
                    key={c.challengeId}
                    className={`relative rounded-xl border p-3 overflow-hidden ${
                      c.completed
                        ? elite
                          ? "border-purple-500/50 bg-purple-500/10"
                          : "border-emerald-500/40 bg-emerald-500/5"
                        : elite
                          ? "border-purple-500/40 bg-purple-900/15"
                          : "border-white/10 bg-black/30"
                    }`}
                  >
                    {elite && (
                      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: "linear-gradient(90deg, #a855f7, #ec4899)" }} />
                    )}
                    <div className="flex items-start justify-between mb-1">
                      <div className="text-white font-semibold text-sm flex items-center gap-1.5">
                        {elite && <Sparkles className="w-3.5 h-3.5 text-purple-300" />}
                        {c.title}
                      </div>
                      {elite && (
                        <Badge variant="outline" className="border-purple-500/50 text-purple-300 text-[9px] uppercase px-1 py-0">Elite</Badge>
                      )}
                      {c.completed && <Crown className={`w-3.5 h-3.5 ${elite ? "text-purple-300" : "text-emerald-400"}`} />}
                    </div>
                    <div className="text-white/50 text-xs mb-2">{c.description}</div>
                    <div className="h-1.5 bg-black/60 rounded-full overflow-hidden mb-1.5">
                      <div
                        className={`h-full ${c.completed ? (elite ? "bg-purple-500" : "bg-emerald-500") : elite ? "bg-gradient-to-r from-purple-500 to-pink-500" : "bg-gradient-to-r from-amber-500 to-rose-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className={`flex items-center justify-between text-[10px] ${elite ? "text-purple-200" : "text-white/50"}`}>
                      <span className="tabular-nums">{c.progress} / {c.goal}</span>
                      <span className={`flex items-center gap-0.5 ${elite ? "text-purple-200 font-bold" : "text-amber-300"}`}>
                        <Zap className={elite ? "w-3 h-3" : "w-2.5 h-2.5"} />{c.rewardXp} · {c.rewardCredits} CR
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* weekly challenges — 2 rotating objectives with bigger rewards + elite variants */}
        {weekly.length > 0 && (
          <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/60 to-black/40 p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-purple-400" />
                <span className="text-white font-bold tracking-wide uppercase text-sm">Weekly Challenges</span>
                <span className="text-white/40 text-xs">Resets every Monday · Week {weekly[0]?.weekKey}</span>
              </div>
              {weekly.some((c) => c.isElite) && (
                <Badge variant="outline" className="border-purple-500/40 text-purple-300/80 text-[10px] uppercase">
                  <Sparkles className="w-3 h-3 mr-1" /> Elite Active
                </Badge>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {weekly.map((c) => {
                const pct = Math.min(100, (c.progress / c.goal) * 100);
                const elite = c.isElite === true;
                return (
                  <div
                    key={c.challengeId}
                    className={`relative rounded-xl border p-4 overflow-hidden ${
                      c.completed
                        ? elite
                          ? "border-purple-500/50 bg-purple-500/10"
                          : "border-emerald-500/40 bg-emerald-500/5"
                        : elite
                          ? "border-purple-500/50 bg-purple-900/20"
                          : "border-purple-500/30 bg-purple-900/10"
                    }`}
                  >
                    {elite && (
                      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: "linear-gradient(90deg, #a855f7, #ec4899)" }} />
                    )}
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="text-white font-semibold text-sm flex items-center gap-1.5">
                        {elite && <Sparkles className="w-4 h-4 text-purple-300" />}
                        {c.title}
                      </div>
                      {elite && (
                        <Badge variant="outline" className="border-purple-500/50 text-purple-300 text-[9px] uppercase px-1 py-0">Elite</Badge>
                      )}
                      {c.completed && <Crown className={`w-4 h-4 ${elite ? "text-purple-300" : "text-emerald-400"}`} />}
                    </div>
                    <div className="text-white/50 text-xs mb-2.5">{c.description}</div>
                    <div className="h-2 bg-black/60 rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full ${c.completed ? (elite ? "bg-purple-500" : "bg-emerald-500") : elite ? "bg-gradient-to-r from-purple-500 to-pink-500" : "bg-gradient-to-r from-purple-500 to-pink-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className={`flex items-center justify-between text-[11px] ${elite ? "text-purple-200" : "text-white/60"}`}>
                      <span className="tabular-nums">{c.progress} / {c.goal}</span>
                      <span className={`flex items-center gap-0.5 ${elite ? "text-purple-200 font-bold" : "text-purple-300 font-semibold"}`}>
                        <Zap className={elite ? "w-3.5 h-3.5" : "w-3 h-3"} />{c.rewardXp} XP · {c.rewardCredits} CR
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </main>

      <footer className="mt-auto border-t border-white/10 bg-black/40 py-4">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between text-xs text-white/40">
          <span>VANGUARD OPS · Browser FPS · v1.0</span>
          <span className="hidden sm:inline">WASD · Mouse · Shift · Space · R · Tab</span>
        </div>
      </footer>

      <style>{`
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
      `}</style>
    </div>
  );
}

function NavBtn({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} aria-label={label} className="text-white/70 hover:text-white hover:bg-white/5 transition-colors">
      {icon}
      <span className="ml-1.5 hidden sm:inline">{label}</span>
    </Button>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/40 text-xs">{label}</span>
      <span className="text-sm font-medium truncate ml-2" style={{ color }}>{value}</span>
    </div>
  );
}
