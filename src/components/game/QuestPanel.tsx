"use client";
import { useCallback, useEffect, useState } from "react";
import { useGame } from "@/lib/game-store";
import { Badge } from "@/components/ui/badge";
import { Calendar, Crown, RefreshCw, Sparkles, Star, Zap } from "lucide-react";

export interface ChallengeView {
  challengeId: string;
  title: string;
  description: string;
  icon: string;
  goal: number;
  progress: number;
  completed: boolean;
  awarded: boolean;
  rewardXp: number;
  rewardCredits: number;
  isElite?: boolean;
}
export interface WeeklyChallengeView extends ChallengeView {
  weekKey: string;
}

interface ChallengesResponse {
  challenges: ChallengeView[];
  weekly: WeeklyChallengeView[];
}

/** Fetch current daily/weekly progress whenever the pause-menu Quests tab opens. */
export function QuestPanel() {
  const playerKey = useGame((s) => s.playerKey);
  const [data, setData] = useState<ChallengesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const retry = useCallback(() => setRefresh((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/challenges?playerKey=${encodeURIComponent(playerKey)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not retrieve your quests.");
        return response.json() as Promise<Partial<ChallengesResponse>>;
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(result.challenges) || !Array.isArray(result.weekly))
          throw new Error("Quest data is unavailable.");
        setData({ challenges: result.challenges, weekly: result.weekly });
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load quests.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [playerKey, refresh]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-white/50">Track your daily and weekly objectives.</p>
        <button type="button" onClick={retry} disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>
      {loading && !data && <div role="status" className="py-12 text-center text-sm text-white/50">Loading quests…</div>}
      {error && <div role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error} <button type="button" className="underline" onClick={retry}>Try again</button></div>}
      {data && <div className={loading ? "opacity-60" : ""}>
        <QuestSections daily={data.challenges} weekly={data.weekly} />
      </div>}
    </div>
  );
}

/** Shared cards ensure pause-menu quests and home-screen challenges always agree. */
export function QuestSections({ daily, weekly }: { daily: ChallengeView[]; weekly: WeeklyChallengeView[] }) {
  if (daily.length === 0 && weekly.length === 0) {
    return <div className="rounded-xl border border-white/10 bg-black/30 p-6 text-center text-white/50 text-sm">No active quests at the moment.</div>;
  }
  const challenges = daily;
  return (
    <>
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

    </>
  );
}
