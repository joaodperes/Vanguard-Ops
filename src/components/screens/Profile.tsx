"use client";
import { useEffect, useState } from "react";
import { useGame } from "@/lib/game-store";
import { ownsWeapon, ownsOperativeSkin, ownsWeaponSkin } from "@/lib/collection-ownership";
import { WEAPONS, ATTACHMENTS, WEAPON_SKINS, PLAYER_SKINS, RARITY_COLORS, ACHIEVEMENT_TIER_COLORS, ACHIEVEMENTS, rankForLevel, nextRank, weaponById, compatibleAttachments, weaponAttachmentSlots } from "@/lib/game-data";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { perkSelection, PERK_STORAGE_KEY } from "@/lib/perks";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Trophy, Target, Skull, Zap, Coins, TrendingUp, Award, Crown, Star, Clock, Crosshair, Flame, Swords, Shield, Users, Sparkles, Calendar, Save, Trash2, Pencil, Check } from "lucide-react";

interface MatchRecordView {
  id: string; mode: string; online: boolean; kills: number; deaths: number;
  headshots: number; score: number; placement: number; won: boolean;
  durationSec: number; weaponId: string; playedAt: string;
}
interface AchievementView {
  id: string; title: string; description: string; icon: string; tier: string;
  metric: string; goal: number; currentValue: number; earned: boolean; earnedAt?: string;
  rewardXp: number; rewardCredits: number;
}
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Droplet: Zap, Crosshair, Target, Trophy, Crown, Swords, TrendingUp, Star, Flame, Shield, Skull, Sparkles, Calendar,
};

export function Profile() {
  const { profile, setScreen, playerKey, refreshProfile } = useGame();
  const [presetName, setPresetName] = useState("");
  const [editingPreset, setEditingPreset] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [presetBusy, setPresetBusy] = useState(false);
  const [matches, setMatches] = useState<MatchRecordView[]>([]);
  const [achievements, setAchievements] = useState<AchievementView[]>([]);

  useEffect(() => {
    if (!playerKey) return;
    fetch(`/api/match-history?playerKey=${encodeURIComponent(playerKey)}&limit=10`).then((r) => r.json()).then((d) => {
      if (d?.matches) setMatches(d.matches);
    }).catch(() => {});
    fetch(`/api/achievements?playerKey=${encodeURIComponent(playerKey)}`).then((r) => r.json()).then((d) => {
      if (d?.achievements) setAchievements(d.achievements);
    }).catch(() => {});
  }, [playerKey]);


  const managePreset = async (action: "save" | "rename" | "delete", id?: string) => {
    if (presetBusy) return;
    const name = action === "save" ? presetName.trim() : editName.trim();
    if (action !== "delete" && !name) { toast.error("Enter a loadout name"); return; }
    setPresetBusy(true);
    try {
      const response = await fetch("/api/loadout/presets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerKey, action, id, name, perkId: perkSelection(profile?.level ?? 1) }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? "Could not save loadout");
      await refreshProfile();
      setPresetName("");
      setEditingPreset(null);
      toast.success(action === "save" ? "Loadout saved to your profile" : action === "rename" ? "Loadout renamed" : "Loadout deleted");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update loadout"); }
    finally { setPresetBusy(false); }
  };

  const equipPreset = async (id: string, perkId: string) => {
    if (presetBusy) return;
    setPresetBusy(true);
    try {
      const response = await fetch("/api/loadout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerKey, presetId: id }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? "Could not equip loadout");
      // The Armory and match setup read the selected passive perk from here.
      localStorage.setItem(PERK_STORAGE_KEY, perkId);
      await refreshProfile();
      toast.success("Saved loadout equipped");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not equip loadout"); }
    finally { setPresetBusy(false); }
  };

  if (!profile) return <div className="min-h-screen flex items-center justify-center text-white/60">Loading…</div>;
  const lvl = profile.level;
  const rank = rankForLevel(lvl);
  const next = nextRank(lvl);
  const totalWeapons = WEAPONS.length;
  const totalWSkins = WEAPON_SKINS.length * WEAPONS.length;
  const totalPSkins = PLAYER_SKINS.length;
  // Attachments unlock PER-WEAPON (AttachmentUnlock is keyed by playerId+weaponId+attachmentId).
  // So the meaningful totals count (weapon, attachment) PAIRS, not distinct attachment types.
  //   - totalAttachmentPairs: every valid (weapon, attachment) combo across all weapons
  //     that take attachments (melee weapons take none).
  //   - ownedAttachmentPairs: every (weapon, attachment) pair the player has unlocked,
  //     summed from profile.unlocks.attachmentsByWeapon.
  // We also precompute per-attachment compatibility counts so the collection grid can
  // show "unlocked on N / M weapons" instead of a misleading binary owned/locked.
  const compatWeaponsByAttachment: Record<string, number> = {};
  let totalAttachmentPairs = 0;
  for (const w of WEAPONS) {
    const slots = weaponAttachmentSlots(w);
    if (slots.length === 0) continue; // melee — no attachments
    const validForWeapon = new Set<string>();
    for (const slot of slots) {
      for (const aid of compatibleAttachments(w.id, slot)) validForWeapon.add(aid);
    }
    totalAttachmentPairs += validForWeapon.size;
    for (const aid of validForWeapon) {
      compatWeaponsByAttachment[aid] = (compatWeaponsByAttachment[aid] ?? 0) + 1;
    }
  }
  const attachmentsByWeapon = profile.unlocks.attachmentsByWeapon ?? {};
  let ownedAttachmentPairs = 0;
  for (const w of WEAPONS) {
    ownedAttachmentPairs += (attachmentsByWeapon[w.id]?.length ?? 0);
  }
  const ownedW = WEAPONS.filter(w => ownsWeapon(w, lvl, profile.unlocks.weapons)).length;
  const ownedA = ownedAttachmentPairs;
  const skinPairs = WEAPONS.flatMap(w => WEAPON_SKINS.map(s => ({
    id: `${w.id}:${s.id}`, name: s.name, sub: w.name,
    owned: ownsWeaponSkin(w.id, s.id, lvl, profile.unlocks.weapons, profile.unlocks.skinsByWeapon ?? {}, WEAPONS),
    color: RARITY_COLORS[s.rarity],
  })));
  const ownedWS = skinPairs.filter(pair => pair.owned).length;
  const ownedPS = PLAYER_SKINS.filter(s => ownsOperativeSkin(s, lvl, profile.unlocks.playerSkins)).length;
  const earnedAchievements = achievements.filter((a) => a.earned).length;
  const totalAchievements = achievements.length || 1;
  const xpPct = Math.min(100, (profile.xpProgress.current / profile.xpProgress.needed) * 100);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-white/10 bg-black/40 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setScreen("menu")} className="text-white/70 hover:text-white hover:bg-white/5">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
          <div className="flex items-center gap-2 ml-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h1 className="text-white font-bold tracking-wider uppercase">Operative Profile</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* hero banner */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-900/80 to-black p-6 mb-6">
          <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full blur-3xl" style={{ background: `${rank.color}20` }} />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* rank insignia */}
            <div className="relative shrink-0">
              <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-5xl font-black border-2"
                style={{ background: `linear-gradient(135deg, ${rank.color}25, ${rank.color}05)`, borderColor: `${rank.color}60`, color: rank.color, boxShadow: `0 0 30px ${rank.color}40` }}>
                {rank.insignia}
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black border border-white/20 text-[10px] font-bold px-2 py-0.5 rounded shadow-lg whitespace-nowrap" style={{ color: rank.color }}>
                {rank.shortName}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white/50 text-xs uppercase tracking-widest">{rank.name}</div>
              <div className="text-3xl font-bold text-white">{profile.name}</div>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300">
                  <Star className="w-3 h-3" /> LVL {lvl}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                  <Zap className="w-3 h-3" /> {profile.credits} CR
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                  <Target className="w-3 h-3" /> {profile.kills} kills
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300">
                  <Trophy className="w-3 h-3" /> {profile.matchesWon} wins
                </span>
              </div>
              {/* xp bar */}
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white/60">{next ? `Next rank: ${next.name} (LVL ${next.level})` : "Max rank achieved"}</span>
                  <span className="text-white/60 tabular-nums">{profile.xpProgress.current} / {profile.xpProgress.needed} XP</span>
                </div>
                <div className="relative h-2.5 bg-black/60 rounded-full overflow-hidden border border-white/5">
                  <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-500" style={{ width: `${xpPct}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Saved loadouts are persistent, named snapshots of the equipped kit. */}
        <section className="mb-6 rounded-2xl border border-amber-500/25 bg-zinc-900/60 p-5" aria-label="Saved loadouts">
          <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
            <div>
              <h2 className="text-white font-bold uppercase tracking-wider flex items-center gap-2">
                <Save className="w-4 h-4 text-amber-400" /> Saved Loadouts
                <span className="text-xs text-white/40 font-normal normal-case">{(profile.savedLoadouts ?? []).length} / 5</span>
              </h2>
              <p className="text-xs text-white/50 mt-1">Save your current Armory setup, name it, and equip it before a match.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setScreen("armory")} className="border-white/20 text-white">Customize in Armory</Button>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
              placeholder="Name this loadout"
              maxLength={24}
              aria-label="New loadout name"
              className="flex-1 min-w-40 rounded-lg bg-black/40 border border-white/20 text-white px-3 py-2 text-sm outline-none focus:border-amber-400"
            />
            <Button
              disabled={presetBusy || !presetName.trim() || (profile.savedLoadouts ?? []).length >= 5}
              onClick={() => managePreset("save")}
              className="bg-amber-500 hover:bg-amber-400 text-black"
            ><Save className="w-4 h-4 mr-1.5" /> Save Current</Button>
          </div>
          {(profile.savedLoadouts ?? []).length === 0 ? (
            <div className="text-sm text-white/40 py-3">No saved loadouts yet. Equip your preferred kit in the Armory, then save it here.</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {(profile.savedLoadouts ?? []).map(preset => (
                <div key={preset.id} className="rounded-xl border border-white/10 bg-black/35 p-3 space-y-2">
                  {editingPreset === preset.id ? (
                    <div className="flex gap-2">
                      <input value={editName} maxLength={24} onChange={e => setEditName(e.target.value)}
                        aria-label="Rename saved loadout"
                        className="min-w-0 flex-1 rounded bg-zinc-800 border border-white/20 text-white px-2 py-1 text-sm" />
                      <Button size="sm" disabled={presetBusy || !editName.trim()} onClick={() => managePreset("rename", preset.id)}><Check className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingPreset(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-amber-200 font-semibold text-sm truncate">{preset.name}</h3>
                      <div className="flex gap-1">
                        <button aria-label={`Rename ${preset.name}`} title="Rename" className="p-1.5 text-white/60 hover:text-white"
                          onClick={() => { setEditingPreset(preset.id); setEditName(preset.name); }}><Pencil className="w-3.5 h-3.5" /></button>
                        <button aria-label={`Delete ${preset.name}`} title="Delete" disabled={presetBusy}
                          className="p-1.5 text-white/60 hover:text-rose-400" onClick={() => managePreset("delete", preset.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-white/50">{weaponById(preset.primaryWeapon).name} · {weaponById(preset.secondaryWeapon).name} · {weaponById(preset.meleeWeapon).name}</div>
                  <Button size="sm" variant="outline" disabled={presetBusy} onClick={() => equipPreset(preset.id, preset.perkId)}
                    className="w-full border-amber-500/30 text-amber-200 hover:bg-amber-500/10">Equip Loadout</Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <Tabs defaultValue="stats">
          <TabsList className="bg-zinc-900/60 border border-white/10">
            <TabsTrigger value="stats" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300 text-white/60"><TrendingUp className="w-4 h-4 mr-1.5" /> Stats</TabsTrigger>
            <TabsTrigger value="achievements" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300 text-white/60"><Award className="w-4 h-4 mr-1.5" /> Achievements <span className="ml-1 text-[10px] tabular-nums">({earnedAchievements}/{totalAchievements})</span></TabsTrigger>
            <TabsTrigger value="matches" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300 text-white/60"><Clock className="w-4 h-4 mr-1.5" /> History</TabsTrigger>
            <TabsTrigger value="collection" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300 text-white/60"><Crosshair className="w-4 h-4 mr-1.5" /> Collection</TabsTrigger>
          </TabsList>

          {/* STATS */}
          <TabsContent value="stats" className="mt-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={<Target className="w-5 h-5" />} label="Kills" value={profile.kills} color="text-emerald-400" />
              <StatCard icon={<Skull className="w-5 h-5" />} label="Deaths" value={profile.deaths} color="text-rose-400" />
              <StatCard icon={<TrendingUp className="w-5 h-5" />} label="K/D" value={profile.kd} color="text-amber-400" />
              <StatCard icon={<Trophy className="w-5 h-5" />} label="Wins" value={profile.matchesWon} color="text-purple-400" />
              <StatCard icon={<Crosshair className="w-5 h-5" />} label="Matches" value={profile.matchesPlayed} color="text-blue-400" />
              <StatCard icon={<Coins className="w-5 h-5" />} label="Credits" value={profile.credits} color="text-amber-400" />
              <StatCard icon={<Zap className="w-5 h-5" />} label="Total XP" value={profile.xp} color="text-cyan-400" />
              <StatCard icon={<Award className="w-5 h-5" />} label="Win Rate" value={`${profile.matchesPlayed ? Math.round((profile.matchesWon / profile.matchesPlayed) * 100) : 0}%`} color="text-emerald-400" />
            </div>

            {/* collection summary */}
            <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5 mt-5">
              <h3 className="text-white font-bold tracking-wide uppercase text-sm mb-4 flex items-center gap-2"><Award className="w-4 h-4 text-amber-400" /> Collection Progress</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <Progress label="Weapons" value={ownedW} total={totalWeapons} color="from-rose-500 to-amber-500" />
                <Progress label="Owned Attachments" value={ownedA} total={totalAttachmentPairs} color="from-amber-500 to-yellow-500" sub="Owned per-weapon" />
                <Progress label="Weapon Skins" value={ownedWS} total={totalWSkins} color="from-purple-500 to-pink-500" />
                <Progress label="Operative Skins" value={ownedPS} total={totalPSkins} color="from-emerald-500 to-cyan-500" />
              </div>
            </div>
          </TabsContent>

          {/* ACHIEVEMENTS — split into Quest, PvP, and PvE sections */}
          <TabsContent value="achievements" className="mt-5">
            {/* Quest Completion Achievements (17-C) */}
            <div className="mb-5">
              <h3 className="text-white font-bold tracking-wide uppercase text-sm mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" /> Quest Achievements
                <span className="text-white/30 text-xs normal-case tracking-normal">Daily / Weekly / Elite completion milestones</span>
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {achievements
                  .filter((a) => ["quest_daily_10", "quest_weekly_5", "quest_elite_3", "quest_total_50"].includes(a.id))
                  .map((a) => {
                    const tierColor = ACHIEVEMENT_TIER_COLORS[a.tier] ?? "#9ca3af";
                    const Icon = ICON_MAP[a.icon] ?? Award;
                    const pct = Math.min(100, (a.currentValue / a.goal) * 100);
                    return (
                      <div key={a.id} className={`relative rounded-xl border p-4 overflow-hidden ${a.earned ? "border-purple-500/40 bg-purple-500/5" : "border-white/10 bg-zinc-900/40"}`}>
                        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: "linear-gradient(90deg, #a855f7, #ec4899)", opacity: 0.8 }} />
                        <div className="flex items-start gap-3 mb-2">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${a.earned ? "bg-purple-500/15 text-purple-300" : "bg-white/5 text-white/40"}`} style={a.earned ? { boxShadow: `0 0 16px ${tierColor}40` } : {}}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-bold text-sm flex items-center gap-1.5">
                              {a.title}
                              {a.earned && <Crown className="w-3 h-3 text-purple-300" />}
                            </div>
                            <div className="text-white/40 text-xs">{a.description}</div>
                            <div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: tierColor }}>{a.tier}</div>
                          </div>
                        </div>
                        {!a.earned && (
                          <div>
                            <div className="flex justify-between text-[10px] text-white/50 mb-1 tabular-nums">
                              <span>{a.currentValue} / {a.goal}</span>
                              <span>{Math.round(pct)}%</span>
                            </div>
                            <div className="h-1.5 bg-black/60 rounded-full overflow-hidden">
                              <div className="h-full transition-all" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #a855f7, #ec4899)" }} />
                            </div>
                          </div>
                        )}
                        {a.earned && (
                          <div className="text-[10px] text-purple-300/80 mt-1 flex items-center gap-1">
                            <Coins className="w-3 h-3" /> +{a.rewardCredits.toLocaleString()} CR · <Zap className="w-3 h-3" /> +{a.rewardXp.toLocaleString()} XP
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* PvP Achievements */}
            <div className="mb-5">
              <h3 className="text-white font-bold tracking-wide uppercase text-sm mb-3 flex items-center gap-2">
                <Swords className="w-4 h-4 text-rose-400" /> PvP Achievements
                <span className="text-white/30 text-xs normal-case tracking-normal">FFA &amp; TDM</span>
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {achievements.filter((a) => (ACHIEVEMENTS.find((d) => d.id === a.id)?.category ?? "pvp") === "pvp" && !["quest_daily_10", "quest_weekly_5", "quest_elite_3", "quest_total_50"].includes(a.id)).map((a) => {
                  const tierColor = ACHIEVEMENT_TIER_COLORS[a.tier] ?? "#9ca3af";
                  const Icon = ICON_MAP[a.icon] ?? Award;
                  const pct = Math.min(100, (a.currentValue / a.goal) * 100);
                  return (
                    <div key={a.id} className={`relative rounded-xl border p-4 overflow-hidden ${a.earned ? "border-rose-500/40 bg-rose-500/5" : "border-white/10 bg-zinc-900/40"}`}>
                      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: tierColor, opacity: 0.7 }} />
                      <div className="flex items-start gap-3 mb-2">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${a.earned ? "bg-rose-500/15 text-rose-400" : "bg-white/5 text-white/40"}`} style={a.earned ? { boxShadow: `0 0 16px ${tierColor}40` } : {}}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-bold text-sm flex items-center gap-1.5">
                            {a.title}
                            {a.earned && <Crown className="w-3 h-3 text-rose-400" />}
                          </div>
                          <div className="text-white/40 text-xs">{a.description}</div>
                          <div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: tierColor }}>{a.tier}</div>
                        </div>
                      </div>
                      {!a.earned && (
                        <div>
                          <div className="flex justify-between text-[10px] text-white/50 mb-1 tabular-nums">
                            <span>{a.currentValue} / {a.goal}</span>
                            <span>{Math.round(pct)}%</span>
                          </div>
                          <div className="h-1.5 bg-black/60 rounded-full overflow-hidden">
                            <div className="h-full transition-all" style={{ width: `${pct}%`, background: tierColor }} />
                          </div>
                        </div>
                      )}
                      {a.earned && (
                        <div className="text-[10px] text-rose-300/80 mt-1 flex items-center gap-1">
                          <Coins className="w-3 h-3" /> +{a.rewardCredits} CR · <Zap className="w-3 h-3" /> +{a.rewardXp} XP
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PvE Achievements */}
            <div>
              <h3 className="text-white font-bold tracking-wide uppercase text-sm mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" /> PvE Achievements
                <span className="text-white/30 text-xs normal-case tracking-normal">Survival</span>
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {achievements.filter((a) => ACHIEVEMENTS.find((d) => d.id === a.id)?.category === "pve").map((a) => {
                  const tierColor = ACHIEVEMENT_TIER_COLORS[a.tier] ?? "#9ca3af";
                  const Icon = ICON_MAP[a.icon] ?? Award;
                  const pct = Math.min(100, (a.currentValue / a.goal) * 100);
                  return (
                    <div key={a.id} className={`relative rounded-xl border p-4 overflow-hidden ${a.earned ? "border-emerald-500/40 bg-emerald-500/5" : "border-white/10 bg-zinc-900/40"}`}>
                      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: tierColor, opacity: 0.7 }} />
                      <div className="flex items-start gap-3 mb-2">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${a.earned ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-white/40"}`} style={a.earned ? { boxShadow: `0 0 16px ${tierColor}40` } : {}}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-bold text-sm flex items-center gap-1.5">
                            {a.title}
                            {a.earned && <Crown className="w-3 h-3 text-emerald-400" />}
                          </div>
                          <div className="text-white/40 text-xs">{a.description}</div>
                          <div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: tierColor }}>{a.tier}</div>
                        </div>
                      </div>
                      {!a.earned && (
                        <div>
                          <div className="flex justify-between text-[10px] text-white/50 mb-1 tabular-nums">
                            <span>{a.currentValue} / {a.goal}</span>
                            <span>{Math.round(pct)}%</span>
                          </div>
                          <div className="h-1.5 bg-black/60 rounded-full overflow-hidden">
                            <div className="h-full transition-all" style={{ width: `${pct}%`, background: tierColor }} />
                          </div>
                        </div>
                      )}
                      {a.earned && (
                        <div className="text-[10px] text-emerald-300/80 mt-1 flex items-center gap-1">
                          <Coins className="w-3 h-3" /> +{a.rewardCredits} CR · <Zap className="w-3 h-3" /> +{a.rewardXp} XP
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* MATCH HISTORY */}
          <TabsContent value="matches" className="mt-5">
            {matches.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-10 text-center">
                <Clock className="w-10 h-10 mx-auto text-white/20 mb-2" />
                <div className="text-white/60 font-semibold">No matches yet</div>
                <div className="text-white/40 text-sm">Deploy from the main menu to start your record.</div>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-zinc-900/40 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/40 text-xs uppercase border-b border-white/10">
                      <th className="text-left px-4 py-2 font-medium">Mode</th>
                      <th className="text-center px-2 py-2 font-medium">Result</th>
                      <th className="text-center px-2 py-2 font-medium">K / D</th>
                      <th className="text-center px-2 py-2 font-medium">HS</th>
                      <th className="text-center px-2 py-2 font-medium">Place</th>
                      <th className="text-center px-2 py-2 font-medium">Weapon</th>
                      <th className="text-right px-4 py-2 font-medium">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((m) => {
                      const Icon = m.mode === "tdm" ? Shield : m.mode === "survival" ? Skull : m.mode === "gungame" ? Swords : Users;
                      const w = weaponById(m.weaponId);
                      const ago = formatAgo(new Date(m.playedAt));
                      const modeLabel = m.mode === "tdm" ? "TDM" : m.mode === "survival" ? "SURV" : m.mode === "gungame" ? "GUN" : "FFA";
                      return (
                        <tr key={m.id} className="border-t border-white/5 hover:bg-white/5">
                          <td className="px-4 py-2">
                            <span className="inline-flex items-center gap-1.5 text-white/80">
                              <Icon className={`w-3.5 h-3.5 ${m.mode === "tdm" ? "text-blue-400" : m.mode === "survival" ? "text-amber-400" : m.mode === "gungame" ? "text-purple-400" : "text-rose-400"}`} />
                              <span className="uppercase text-xs">{modeLabel}</span>
                              {m.online && <span className="text-[9px] text-emerald-400 px-1 rounded bg-emerald-500/10">ONLINE</span>}
                            </span>
                          </td>
                          <td className="text-center px-2 py-2">
                            <span className={`text-xs font-bold ${m.won ? "text-emerald-400" : "text-rose-400"}`}>
                              {m.won ? "WIN" : "LOSS"}
                            </span>
                          </td>
                          <td className="text-center px-2 py-2 text-white tabular-nums">
                            <span className="text-emerald-400">{m.kills}</span> / <span className="text-rose-400">{m.deaths}</span>
                          </td>
                          <td className="text-center px-2 py-2 text-amber-300 tabular-nums">{m.headshots}</td>
                          <td className="text-center px-2 py-2">
                            <span className={`font-bold tabular-nums ${m.placement === 1 ? "text-amber-400" : "text-white/70"}`}>#{m.placement}</span>
                          </td>
                          <td className="text-center px-2 py-2 text-white/60 text-xs">{w.name}</td>
                          <td className="text-right px-4 py-2 text-white/40 text-xs tabular-nums">{ago}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* COLLECTION */}
          <TabsContent value="collection" className="mt-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <CollectionGrid title="Weapons" items={WEAPONS.map((w) => ({ id: w.id, name: w.name, owned: ownsWeapon(w, lvl, profile.unlocks.weapons), color: RARITY_COLORS[w.unlockCost >= 3500 ? "legendary" : w.unlockCost >= 2000 ? "epic" : w.unlockCost >= 800 ? "rare" : "common"] }))} />
              <CollectionGrid
                title="Attachments"
                total={totalAttachmentPairs}
                items={ATTACHMENTS.map((a) => {
                  const compatCount = compatWeaponsByAttachment[a.id] ?? 0;
                  // Count weapons this attachment is unlocked for (from per-weapon unlock map).
                  let unlockedCount = 0;
                  for (const w of WEAPONS) {
                    if ((attachmentsByWeapon[w.id] ?? []).includes(a.id)) unlockedCount++;
                  }
                  return {
                    id: a.id,
                    name: a.name,
                    owned: unlockedCount > 0,
                    color: RARITY_COLORS[a.unlockCost >= 1600 ? "epic" : a.unlockCost >= 800 ? "rare" : "common"],
                    sub: `${unlockedCount}/${compatCount} weapons`,
                  };
                })}
              />
              <CollectionGrid title="Weapon Skins" items={skinPairs} />
              <CollectionGrid title="Operative Skins" items={PLAYER_SKINS.map((s) => ({ id: s.id, name: s.name, owned: ownsOperativeSkin(s, lvl, profile.unlocks.playerSkins), color: RARITY_COLORS[s.rarity] }))} />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="mt-auto border-t border-white/10 bg-black/40 py-4">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-xs text-white/40">Collection displays gear you own (purchased, earned, or freely granted at your level).</div>
      </footer>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 hover:border-white/20 transition-all">
      <div className={`mb-1 ${color}`}>{icon}</div>
      <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
      <div className="text-white/40 text-xs uppercase tracking-wide">{label}</div>
    </div>
  );
}

function Progress({ label, value, total, color, sub }: { label: string; value: number; total: number; color: string; sub?: string }) {
  const pct = total ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-white/60">{label}{sub ? <span className="text-white/30 ml-1.5 normal-case tracking-normal">· {sub}</span> : null}</span>
        <span className="text-white/80 tabular-nums">{value} / {total}</span>
      </div>
      <div className="h-2 bg-black/60 rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CollectionGrid({ title, items, total }: { title: string; items: { id: string; name: string; owned: boolean; color: string; sub?: string }[]; total?: number }) {
  const owned = total !== undefined && title === "Attachments"
    ? items.reduce((sum, item) => sum + Number(item.sub?.split("/")[0] ?? 0), 0)
    : items.filter(i => i.owned).length;
  const headerTotal = total ?? items.length;
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-bold tracking-wide uppercase text-sm">{title}</h3>
        <span className="text-xs text-white/50 tabular-nums">{owned} / {headerTotal}</span>
      </div>
      <div className={`grid grid-cols-2 gap-2 ${title === "Weapon Skins" ? "max-h-[28rem] overflow-y-auto pr-1" : ""}`}>
        {items.map((i) => (
          <div key={i.id} className={`p-2 rounded-lg border text-xs flex items-center gap-2 ${i.owned ? "border-white/10 bg-black/30" : "border-white/5 bg-black/20 opacity-50"}`}>
            <span className="w-1 h-4 rounded-full" style={{ background: i.owned ? i.color : "#333" }} />
            <div className="min-w-0 flex-1">
              <div className={`truncate ${i.owned ? "text-white/80" : "text-white/40"}`}>{i.name}</div>
              {i.sub && <div className="text-[9px] text-white/30 truncate">{i.sub}</div>}
            </div>
            {!i.owned && <Skull className="w-3 h-3 text-white/30 ml-auto shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatAgo(d: Date): string {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}
