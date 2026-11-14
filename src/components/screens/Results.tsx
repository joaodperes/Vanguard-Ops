"use client";
import {formatCredits} from "@/lib/format-credits";
import { achievementTitle, achievementRequirement } from "@/lib/achievement-titles";
import { useGame } from "@/lib/game-store";
import { RoomRoundPanel } from "@/components/game/RoomRoundPanel";
import { Button } from "@/components/ui/button";
import { Trophy, RotateCcw, Home, Zap, Coins, TrendingUp, Star, Crown, Award, Target, Skull, Flame, Clock, Crosshair } from "lucide-react";
import { toast } from "sonner";
import { weaponById, WEAPONS, WEAPON_SKINS, ATTACHMENTS, PLAYER_SKINS } from "@/lib/game-data";
import { displayLabel } from "@/lib/display-labels";
import { perkById } from "@/lib/perks";
import { operationById, operationStars } from "@/lib/operations";
import { SURVIVAL_TIER_INFO } from "@/lib/survival";

function unlockedGearLabel(id: string): string {
  return WEAPONS.find(w => w.id === id)?.name
    ?? WEAPON_SKINS.find(s => s.id === id)?.name
    ?? ATTACHMENTS.find(a => a.id === id)?.name
    ?? PLAYER_SKINS.find(s => s.id === id)?.name
    ?? displayLabel(id);
}

export function Results() {
  const { matchResult, profile, setScreen, playConfig, roomConnect } = useGame();
  if (!matchResult) {
    setScreen("menu");
    return null;
  }
  const r = matchResult;
  // Dedupe standings by name+isBot so a player never appears twice (which
  // previously caused them to show up in both 1st and 2nd place). Bots can
  // share names with each other but never with the local human player.
  const rawStandings = r.standings ?? [];
  const seenKeys = new Set<string>();
  const standings = rawStandings.filter((s) => {
    const key = `${s.isBot ? "bot" : "human"}::${s.name}::${s.id}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });
  const myStanding = standings.findIndex((s) => !s.isBot && s.name === profile?.name);
  const placement = r.placement ?? (myStanding >= 0 ? myStanding + 1 : 1);
  const rewards = r.rewards;
  const leftEarly = r.completed === false;
  const isMvp = placement === 1 && !leftEarly && playConfig.mode !== "survival" && (r.participants ?? 0) >= 2;
  const durationMin = r.durationSec ? Math.floor(r.durationSec / 60) : 0;
  const durationSec = r.durationSec ? r.durationSec % 60 : 0;
  const w = weaponById(r.weaponId ?? "rifle_ar");
  const kd = r.deaths === 0 ? r.kills.toFixed(2) : (r.kills / r.deaths).toFixed(2);
  const hsPct = r.kills > 0 ? Math.round((r.headshots / r.kills) * 100) : 0;
  const mission=operationById(r.operation?.missionId);
  const isSurvival = playConfig.mode === "survival"&&!mission;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-zinc-950 to-black">
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* banner */}
        <div className="text-center mb-8">
          {/* placement medal */}
          <div className={mission ? "hidden":"inline-flex flex-col items-center mb-3"}>
            <div className={`relative w-20 h-20 rounded-full flex items-center justify-center text-4xl font-black border-2 ${
              placement === 1 ? "border-amber-400 bg-amber-500/15 text-amber-300" :
              placement === 2 ? "border-zinc-300 bg-zinc-400/10 text-zinc-200" :
              placement === 3 ? "border-amber-700 bg-amber-800/10 text-amber-600" :
              "border-white/15 bg-white/5 text-white/60"
            }`} style={placement <= 3 ? { boxShadow: "0 0 30px rgba(245,158,11,0.3)" } : {}}>
              {placement === 1 ? <Crown className="w-9 h-9" /> : `#${placement}`}
              {isMvp && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg">MVP</div>}
            </div>
          </div>
          <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-full border mb-3 ${r.won ? "border-amber-500/40 bg-amber-500/10" : "border-white/10 bg-white/5"}`}>
            {r.won ? <Crown className="w-5 h-5 text-amber-400" /> : <Trophy className="w-5 h-5 text-white/60" />}
            <span className={`font-bold tracking-widest uppercase text-sm ${r.won ? "text-amber-300" : "text-white/70"}`}>
              {leftEarly ? "Left Match" : r.won ? "Victory" : "Defeat"}
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
            {mission ? `Operations · ${mission.title}` : isSurvival
              ? `${SURVIVAL_TIER_INFO[r.survivalTier ?? playConfig.survivalTier ?? "default"].label} Survival`
              : `${playConfig.mode === "ctf" ? "Capture the Flag" : playConfig.mode === "gungame" ? "Gun Game" : playConfig.mode === "tdm" ? "Team Deathmatch" : playConfig.mode === "killconfirmed" ? "Kill Confirmed" : "Free-For-All"} · ${leftEarly ? "Match Left" : "Match Over"}`}
          </h1>
          {!isSurvival&&!mission && (
            <p className="text-white/50 mt-2">
              {playConfig.online ? "Online Match" : "vs Bots"} · <span className="text-amber-400 font-bold">#{placement}</span> placement
              {r.durationSec ? <> · <Clock className="inline w-3 h-3" /> {durationMin}:{durationSec.toString().padStart(2, "0")}</> : null}
            </p>
          )}
        </div>

        {mission&&r.operation&&<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 mb-4 text-center">
          <h2 className="text-xl font-bold text-amber-200">{r.won ? "OPERATION COMPLETE":leftEarly ? "OPERATION ABORTED":"OPERATION FAILED"}</h2>
          <p className="text-amber-300 text-2xl my-2" aria-label={`${operationStars(mission,r.operation,r.deaths)} of 3 stars`}>{"★".repeat(operationStars(mission,r.operation,r.deaths))}{"☆".repeat(3-operationStars(mission,r.operation,r.deaths))}</p>
          <p className="text-white/70">{r.won ? mission.debrief:"Regroup, adjust your loadout and try again. Completed missions remain available."}</p>
          <p className="text-white/50 text-sm mt-2">Intel {r.operation.intel ? "recovered":"not recovered"} · Objectives {r.operation.stage}/{mission.objectives.length} · Campaign progress syncs to your player account.</p>
        </div>}
        {isSurvival && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 mb-4 text-center">
            <div className="text-amber-300 font-bold text-lg">
              {r.won ? "STANDARD SURVIVAL CONQUERED" : `WAVES CLEARED · ${r.survivalWaves ?? 0}`}
            </div>
            {r.won && <div className="text-amber-200/80 text-sm mt-1">WAVES CLEARED · {r.survivalWaves ?? 0}</div>}
            <div className="text-white/60 text-xs mt-2 inline-flex items-center justify-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Duration · {durationMin}:{durationSec.toString().padStart(2, "0")}
            </div>
            {(r.won || (r.survivalTier === "hard" && (r.survivalWaves ?? 0) >= 20)
              || (r.survivalTier === "elite" && (r.survivalWaves ?? 0) >= 20)) && (
              <div className="text-white/50 text-xs mt-1">
                {r.won ? "30-wave victory bonus awarded · Hard mode unlocked"
                  : r.survivalTier === "hard" ? "Elite unlocked" : "Nightmare unlocked"}
              </div>
            )}
          </div>
        )}

        {/* rewards */}
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 mb-4">
          <h3 className="text-white/50 text-xs uppercase tracking-widest mb-3 flex items-center gap-1.5"><Coins className="w-3 h-3" /> Rewards Earned</h3>
          {rewards ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-cyan-500/5 border border-cyan-500/20 p-3 flex items-center gap-3">
                  <Zap className="w-5 h-5 text-cyan-400" />
                  <div>
                    <div className="text-2xl font-black text-white tabular-nums">+{rewards.xpGained}</div>
                    <div className="text-white/50 text-xs uppercase tracking-wider">XP Gained</div>
                  </div>
                </div>
                <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3 flex items-center gap-3">
                  <Coins className="w-5 h-5 text-amber-400" />
                  <div>
                    <div className="text-2xl font-black text-white tabular-nums">+{formatCredits(rewards.creditsGained)}</div>
                    <div className="text-white/50 text-xs uppercase tracking-wider">Credits</div>
                  </div>
                </div>
              </div>

              {rewards.breakdown ? (
                <div className="rounded-xl border border-white/10 overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-5 border-b border-white/10 bg-white/5 px-4 py-2 text-[10px] uppercase tracking-widest text-white/45">
                    <span>Reward category</span><span className="w-16 text-right">XP</span><span className="w-16 text-right">Credits</span>
                  </div>
                  {([
                    ["combat", "Combat"],
                    ["objectives", "Objectives"],
                    ["matchPerformance", "Match Performance"],
                    ["challenges", "Challenges"],
                    ["achievements", "Achievements"],
                    ["survival", "Survival"],
                  ] as const).filter(([key]) => (rewards.breakdown?.[key]?.xp ?? 0) > 0 ||
                    (rewards.breakdown?.[key]?.credits ?? 0) > 0).map(([key, label]) => (
                    <div key={key} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-5 border-b border-white/5 px-4 py-3 text-sm last:border-b-0">
                      <span className="text-white/80 font-medium">{label}</span>
                      <span className="w-16 text-right tabular-nums text-cyan-300">+{rewards.breakdown?.[key]?.xp ?? 0}</span>
                      <span className="w-16 text-right tabular-nums text-amber-300">+{formatCredits(rewards.breakdown?.[key]?.credits ?? 0)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-white/45">Category breakdown unavailable for this match.</div>
              )}
              {!isSurvival && leftEarly && (
                <p className="text-xs text-white/45">Early exit: no match completion or placement bonuses. Earned combat and objective rewards are retained.</p>
              )}
              <div className="pt-2 text-xs uppercase tracking-widest text-white/50">Progression &amp; Unlocks</div>

              {rewards.leveledUp && (
                <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/15 to-rose-500/15 border border-amber-500/30 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <Star className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-amber-300 font-bold">Level Up!</div>
                    <div className="text-amber-400/70 text-xs">You reached Level {rewards.newLevel}</div>
                  </div>
                </div>
              )}

              {rewards.newAchievements?.length > 0 && (
                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                  <div className="text-emerald-300 font-bold text-sm mb-2 flex items-center gap-1.5"><Award className="w-4 h-4" /> Achievement Unlocked</div>
                  <div className="space-y-1.5">
                    {rewards.newAchievements.map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between text-xs">
                        <div className="min-w-0">
                          <span className="text-white/80 flex items-center gap-1.5"><Star className="w-3 h-3 text-amber-400" /> {a.title}</span>
                          <p className="mt-1 text-white/60">{achievementRequirement(a.id, a.description) ?? "Achievement conditions met"}</p>
                          {achievementTitle(a.id) && <p className="mt-1 text-amber-300">Title unlocked: {achievementTitle(a.id)}</p>}
                        </div>
                        <span className="text-emerald-300">Unlocked</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(rewards.challengeProgress?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4">
                  <h4 className="font-bold text-cyan-200 text-sm mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4" /> Challenge progress this match
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    {rewards.challengeProgress?.map((c: { id: string; kind: string; title: string; description?: string; before: number; progress: number; goal: number; completed: boolean }) => {
                      const isWeapon = c.kind === "weapon";
                      const isElite = c.kind === "elite";
                      const color = isWeapon ? "text-violet-200 border-violet-500/30 bg-violet-500/10" :
                        isElite ? "text-amber-200 border-amber-500/30 bg-amber-500/10" :
                        c.kind === "weekly" ? "text-blue-200 border-blue-500/30 bg-blue-500/10" :
                        "text-cyan-200 border-cyan-500/30 bg-cyan-500/10";
                      return <div key={c.id} className={`rounded-lg border p-3 ${color}`}>
                        <div className="flex justify-between gap-2 text-[10px] uppercase tracking-wider font-semibold">
                          <span>{isWeapon ? "Weapon mastery" : isElite ? "Elite challenge" : `${displayLabel(c.kind)} challenge`}</span>
                          {c.completed ? <span className="text-emerald-300">Completed ✓</span> : <span>+{c.progress-c.before}</span>}
                        </div>
                        <div className="text-white font-semibold text-xs mt-1">{c.title}</div>
                        <div className="text-white/65 text-[11px] mb-2">{c.description ?? `Progress toward ${c.goal} required actions`}</div>
                        <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
                          <div className="h-full bg-current" style={{width: `${Math.min(100,100*c.progress/Math.max(1,c.goal))}%`}} />
                        </div>
                        <div className="text-[11px] font-mono mt-1.5 text-right">{c.before} → {c.progress}/{c.goal}</div>
                      </div>;
                    })}
                  </div>
                </div>
              )}

              {rewards.challengeAwards?.length > 0 && (
                <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20">
                  <div className="text-purple-300 font-bold text-sm mb-2 flex items-center gap-1.5"><Trophy className="w-4 h-4" /> Challenge Complete</div>
                  <div className="space-y-1.5">
                    {rewards.challengeAwards.map((c: any) => (
                      <div key={c.challengeId} className="flex items-center justify-between text-xs">
                        <span className="text-white/80 flex items-center gap-1.5"><Trophy className="w-3 h-3 text-purple-400" /> {c.title}</span>
                        <span className="text-purple-300">Completed</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(rewards.newUnlocks?.perks?.length ?? 0) > 0 && (
                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/25">
                  <div className="text-emerald-300 font-bold text-sm mb-2 flex items-center gap-2"><Zap className="w-4 h-4" /> New Perk Available</div>
                  <div className="flex flex-wrap gap-2">
                    {rewards.newUnlocks.perks.map((id: string) => <span key={id} className="text-xs border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 rounded-md px-2 py-1">
                      {perkById(id).name} · LVL {perkById(id).unlockLevel}
                    </span>)}
                  </div>
                </div>
              )}
              {(rewards.newUnlocks?.purchasableWeapons?.length ?? 0) > 0 && (
                <div className="p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
                  <div className="text-cyan-300 font-bold text-sm mb-2"><Crosshair className="w-4 h-4 inline mr-1" /> Now Available in the Armory</div>
                  <div className="flex flex-wrap gap-2">
                    {rewards.newUnlocks.purchasableWeapons.map((id: string) => <span key={id} className="text-xs border border-cyan-500/20 bg-cyan-500/10 text-cyan-100 rounded-md px-2 py-1">
                      {weaponById(id).name} · {formatCredits(weaponById(id).unlockCost)} CR
                    </span>)}
                  </div>
                </div>
              )}
              {rewards.newUnlocks && (rewards.newUnlocks.weapons.length || rewards.newUnlocks.weaponSkins.length || rewards.newUnlocks.attachments.length || rewards.newUnlocks.playerSkins.length) > 0 && (
                <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20">
                  <div className="text-rose-300 font-bold text-sm mb-2 flex items-center gap-1.5"><Crown className="w-4 h-4" /> New Gear Unlocked</div>
                  <div className="flex flex-wrap gap-1.5">
                    {[...rewards.newUnlocks.weapons, ...rewards.newUnlocks.weaponSkins, ...rewards.newUnlocks.attachments, ...rewards.newUnlocks.playerSkins].map((id: string) => (
                      <span key={id} className="text-xs px-2 py-1 rounded-md bg-rose-500/15 text-rose-200 border border-rose-500/20">{unlockedGearLabel(id)}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-white/40 text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Rewards applied to your profile.</div>
          )}
        </div>

        {/* standings */}
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-white font-bold tracking-wide uppercase text-sm">Final Standings</span>
            <span className="ml-auto text-white/40 text-xs">Weapon: {w.name}</span>
          </div>
          <div className="max-h-96 overflow-x-auto overflow-y-auto custom-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 text-xs uppercase">
                  <th className="text-left px-5 py-2 w-12">#</th>
                  <th className="text-left px-2 py-2">Player</th>
                  <th className="text-center px-2 py-2 w-16">Kills</th>
                  <th className="text-center px-2 py-2 w-16">Deaths</th>
                  <th className="text-center px-2 py-2 w-16">Assists</th>
                  <th className="text-center px-2 py-2 w-16">K/D</th>
                  <th className="text-center px-2 py-2">Headshots</th>
                  <th className="text-center px-2 py-2">Multi</th>
                  {r.mode==="killconfirmed"&&<><th className="text-center px-2 py-2">Tags +</th><th className="text-center px-2 py-2">Tags −</th></>}
                  <th className="text-center px-5 py-2 w-16">Score</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => {
                  const isMe = !s.isBot && s.name === profile?.name;
                  return (
                    <tr key={s.id} className={`border-t border-white/5 ${isMe ? "bg-emerald-500/10" : ""}`}>
                      <td className="px-5 py-2">
                        <span className={`font-bold ${i === 0 ? "text-amber-400" : i === 1 ? "text-zinc-300" : i === 2 ? "text-amber-700" : "text-white/40"}`}>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${s.team === "red" ? "bg-red-500" : s.team === "blue" ? "bg-blue-500" : "bg-white/60"}`} />
                        <span className={isMe ? "text-emerald-300 font-semibold" : "text-white/90"}>{s.name}</span>
                        {s.isBot && <span className="ml-1.5 text-white/30 text-xs">BOT</span>}
                      </td>
                      <td className="text-center px-2 py-2 text-white tabular-nums">{s.kills}</td>
                      <td className="text-center px-2 py-2 text-white/50 tabular-nums">{s.deaths}</td>
                      <td className="text-center px-2 py-2 text-white/80 tabular-nums">{s.assists??(isMe?r.assists??0:"—")}</td>
                      <td className="text-center px-2 py-2 tabular-nums">{(s.kills/Math.max(1,s.deaths)).toFixed(2)}</td>
                      <td className="text-center px-2 py-2 text-violet-200 tabular-nums">{isMe?`${r.headshots} (${hsPct}%)`:"—"}</td>
                      <td className="text-center px-2 py-2 text-rose-200 tabular-nums">{isMe?r.multikills??0:"—"}</td>
                      {r.mode==="killconfirmed"&&<><td className="text-center px-2 py-2 text-cyan-200">{isMe?r.confirmations??r.score:"—"}</td>
                        <td className="text-center px-2 py-2 text-emerald-200">{isMe?r.denials??0:"—"}</td></>}
                      <td className="text-center px-5 py-2 text-white font-bold tabular-nums">{s.score}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <RoomRoundPanel results />
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => setScreen(mission ? "operations":"play")}
            className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold h-12"
          >
            <RotateCcw className="w-4 h-4 mr-2" /> {mission ? "Campaign menu":roomConnect ? "Leave room · Match setup":"Play Again"}
          </Button>
          <Button onClick={() => setScreen("menu")} variant="outline" className="flex-1 border-white/15 bg-black/30 text-white hover:bg-white/10 h-12">
            <Home className="w-4 h-4 mr-2" /> Main Menu
          </Button>
          <Button onClick={() => { toast.success("Opening armory"); setScreen("armory"); }} variant="outline" className="border-white/15 bg-black/30 text-white hover:bg-white/10 h-12">
            <Star className="w-4 h-4 mr-2" /> Armory
          </Button>
        </div>
      </main>
      <footer className="mt-auto border-t border-white/10 py-4">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-xs text-white/40">Match complete · Progress saved</div>
      </footer>
      <style>{`.custom-scroll::-webkit-scrollbar{width:6px}.custom-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:3px}`}</style>
    </div>
  );
}

function StatBox({ icon, value, label, color }: { icon: React.ReactNode; value: number | string; label: string; color: string }) {
  return (
    <div>
      <div className={`${color} mb-1 flex justify-center`}>{icon}</div>
      <div className="text-2xl sm:text-3xl font-black text-white tabular-nums">{value}</div>
      <div className="text-white/40 text-xs uppercase tracking-wide">{label}</div>
    </div>
  );
}
