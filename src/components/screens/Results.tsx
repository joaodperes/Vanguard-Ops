"use client";
import { useGame } from "@/lib/game-store";
import { Button } from "@/components/ui/button";
import { Trophy, RotateCcw, Home, Zap, Coins, TrendingUp, Star, Crown, Award, Target, Skull, Flame, Clock, Crosshair } from "lucide-react";
import { toast } from "sonner";
import { weaponById } from "@/lib/game-data";
import { SURVIVAL_TIER_INFO } from "@/lib/survival";

export function Results() {
  const { matchResult, profile, setScreen, playConfig } = useGame();
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
  const isMvp = placement === 1;
  const durationMin = r.durationSec ? Math.floor(r.durationSec / 60) : 0;
  const durationSec = r.durationSec ? r.durationSec % 60 : 0;
  const w = weaponById(r.weaponId ?? "rifle_ar");
  const kd = r.deaths === 0 ? r.kills.toFixed(2) : (r.kills / r.deaths).toFixed(2);
  const hsPct = r.kills > 0 ? Math.round((r.headshots / r.kills) * 100) : 0;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-zinc-950 to-black">
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* banner */}
        <div className="text-center mb-8">
          {/* placement medal */}
          <div className="inline-flex flex-col items-center mb-3">
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
              {r.won ? "Victory" : "Defeat"}
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
            {playConfig.mode === "survival" ? `${SURVIVAL_TIER_INFO[r.survivalTier ?? playConfig.survivalTier ?? "default"].label} Survival` : playConfig.mode === "gungame" ? "Gun Game" : playConfig.mode === "tdm" ? "Team Deathmatch" : "Free-For-All"} · Match Over
          </h1>
          <p className="text-white/50 mt-2">
            {playConfig.mode === "survival" ? `${r.survivalWaves ?? 0} waves cleared` : playConfig.online ? "Online Match" : "vs Bots"} · <span className="text-amber-400 font-bold">#{placement}</span> placement
            {r.durationSec ? <> · <Clock className="inline w-3 h-3" /> {durationMin}:{durationSec.toString().padStart(2, "0")}</> : null}
          </p>
        </div>

        {playConfig.mode === "survival" && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 mb-4 text-center">
            <div className="text-amber-300 font-bold text-lg">
              {r.won ? "STANDARD SURVIVAL CONQUERED" : `WAVES CLEARED · ${r.survivalWaves ?? 0}`}
            </div>
            <div className="text-white/50 text-xs mt-1">
              {r.won ? "30-wave victory bonus awarded · Hard mode unlocked"
                : r.survivalTier === "hard" && (r.survivalWaves ?? 0)>=20 ? "Elite unlocked"
                : r.survivalTier === "elite" && (r.survivalWaves ?? 0)>=20 ? "Nightmare unlocked"
                : "Your longest completed run is saved to your profile"}
            </div>
          </div>
        )}

        {/* personal stats */}
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 mb-4">
          <h3 className="text-white/50 text-xs uppercase tracking-widest mb-3 flex items-center gap-1.5"><Target className="w-3 h-3" /> Your Performance</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <StatBox icon={<Target className="w-4 h-4" />} value={r.kills} label="Kills" color="text-emerald-400" />
            <StatBox icon={<Skull className="w-4 h-4" />} value={r.deaths} label="Deaths" color="text-rose-400" />
            <StatBox icon={<TrendingUp className="w-4 h-4" />} value={kd} label="K/D" color="text-amber-400" />
            <StatBox icon={<Crosshair className="w-4 h-4" />} value={`${r.headshots} (${hsPct}%)`} label="Headshots" color="text-purple-400" />
          </div>
          {(r.multikills ?? 0) > 0 && (
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-center gap-2 text-xs text-white/60">
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              Achieved <span className="text-rose-300 font-bold">{r.multikills}</span> multi-kill{(r.multikills ?? 0) > 1 ? "s" : ""} this match
            </div>
          )}
        </div>

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
                    <div className="text-2xl font-black text-white tabular-nums">+{rewards.creditsGained}</div>
                    <div className="text-white/50 text-xs uppercase tracking-wider">Credits</div>
                  </div>
                </div>
              </div>

              {(rewards.bonusXp ?? 0) > 0 && (
                <div className="text-xs text-white/40 flex items-center gap-1.5">
                  <Star className="w-3 h-3 text-amber-400" /> Bonus: <span className="text-amber-300">+{rewards.bonusXp} XP</span> · <span className="text-amber-300">+{rewards.bonusCredits} CR</span> from achievements &amp; challenges
                </div>
              )}

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
                        <span className="text-white/80 flex items-center gap-1.5"><Star className="w-3 h-3 text-amber-400" /> {a.title}</span>
                        <span className="text-emerald-300">+{a.rewardXp} XP · +{a.rewardCredits} CR</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {rewards.challengeAwards?.length > 0 && (
                <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20">
                  <div className="text-purple-300 font-bold text-sm mb-2 flex items-center gap-1.5"><Trophy className="w-4 h-4" /> Daily Challenge Complete</div>
                  <div className="space-y-1.5">
                    {rewards.challengeAwards.map((c: any) => (
                      <div key={c.challengeId} className="flex items-center justify-between text-xs">
                        <span className="text-white/80 flex items-center gap-1.5"><Trophy className="w-3 h-3 text-purple-400" /> {c.title}</span>
                        <span className="text-purple-300">+{c.rewardXp} XP · +{c.rewardCredits} CR</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {rewards.newUnlocks && (rewards.newUnlocks.weapons.length || rewards.newUnlocks.weaponSkins.length || rewards.newUnlocks.attachments.length) > 0 && (
                <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20">
                  <div className="text-rose-300 font-bold text-sm mb-2 flex items-center gap-1.5"><Crown className="w-4 h-4" /> New Gear Unlocked</div>
                  <div className="flex flex-wrap gap-1.5">
                    {[...rewards.newUnlocks.weapons, ...rewards.newUnlocks.weaponSkins, ...rewards.newUnlocks.attachments].map((id: string) => (
                      <span key={id} className="text-xs px-2 py-1 rounded-md bg-rose-500/15 text-rose-200 border border-rose-500/20">{id}</span>
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
          <div className="max-h-80 overflow-y-auto custom-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 text-xs uppercase">
                  <th className="text-left px-5 py-2 w-12">#</th>
                  <th className="text-left px-2 py-2">Player</th>
                  <th className="text-center px-2 py-2 w-16">Kills</th>
                  <th className="text-center px-2 py-2 w-16">Deaths</th>
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
                      <td className="text-center px-5 py-2 text-white font-bold tabular-nums">{s.score}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => setScreen("play")}
            className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold h-12"
          >
            <RotateCcw className="w-4 h-4 mr-2" /> Play Again
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
