"use client";
import { useState } from "react";
import { useGame } from "@/lib/game-store";
import { Button } from "@/components/ui/button";
import { Award, Coins } from "lucide-react";

export function CareerProgress() {
  const { profile, playerKey, refreshProfile } = useGame();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const career = profile?.career;
  if (!career) return null;
  async function promote() {
    if (busy || !career?.canPromote) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/profile/career", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerKey, rank: career.rank }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? "Unable to promote");
      await refreshProfile();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to promote"); }
    finally { setBusy(false); }
  }
  const progress = Math.min(100, career.currentXp / career.requiredXp * 100);
  return (
    <section aria-label="Career progression" className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/25 to-zinc-950 p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-white font-bold flex items-center gap-2"><Award className="w-5 h-5 text-amber-400" />Career Rank {career.rank}</h2>
        <span className="text-xs text-amber-300">{career.unlocked ? `Next: Rank ${career.rank + 1}` : `Opens at level ${career.unlockLevel}`}</span>
      </div>
      <p className="text-sm text-white/65 mt-2">Optional post-level-36 progression: earn fresh match XP and spend credits for repeatable promotions and exclusive nameplate titles. Career does not reset weapons, mastery or level, and grants no combat advantage.</p>
      {career.unlocked ? <>
        <div className="flex justify-between text-xs text-white/70 mt-4 mb-1"><span>Fresh Career XP</span><span>{career.currentXp.toLocaleString()} / {career.requiredXp.toLocaleString()}</span></div>
        <div role="progressbar" aria-label="Fresh Career XP" aria-valuenow={career.currentXp} aria-valuemin={0} aria-valuemax={career.requiredXp} className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-amber-500 to-rose-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex flex-wrap justify-between items-center gap-3 mt-4">
          <p className="text-xs text-white/50">Each promotion starts a fresh XP goal. A full meter holds no extra XP.</p>
          <Button disabled={busy || !career.canPromote} onClick={() => void promote()} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold disabled:opacity-50">
            <Coins className="w-4 h-4 mr-2" />{busy ? "Promoting…" : `Promote · ${career.creditCost.toLocaleString()} CR`}
          </Button>
        </div>
        {career.currentXp >= career.requiredXp && !career.canPromote && <p className="text-xs text-amber-300 mt-2">Earn {Math.max(0, career.creditCost - (profile?.credits ?? 0)).toLocaleString()} more credits to promote.</p>}
      </> : <p className="text-xs text-white/50 mt-3">After level {career.unlockLevel}, newly earned match and quest XP fills your first Career goal. Earlier XP stays in your lifetime total.</p>}
      {career.nextTitle && <p className="text-xs text-amber-300/80 mt-3">Next title: {career.nextTitle.title} · Career Rank {career.nextTitle.rank}</p>}
      {error && <p role="alert" className="text-sm text-rose-400 mt-3">{error}</p>}
    </section>
  );
}
