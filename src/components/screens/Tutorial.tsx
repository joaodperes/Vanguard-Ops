"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Crosshair, GraduationCap, Backpack, Shield, Swords, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GameCanvas } from "@/components/game/GameCanvas";
import { useGame } from "@/lib/game-store";
import type { LoadoutWire } from "@/lib/game-protocol";
import { perkById } from "@/lib/perks";
import {
  advancePractice, loadTutorialProgress, newTutorialProgress, saveTutorialProgress,
  PRACTICE_TASKS, TUTORIAL_PHASES, COMPETITIVE_MODE_IDS, COMPETITIVE_MODE_GUIDES,
  type PracticeSample, type PracticeState, type TutorialPhase,
} from "@/lib/tutorial";

// Always train with an ordinary starter kit. The range never equips, purchases,
// saves matches, or changes permanent equipment/progression.
const emptyAttachments = { sight: null, barrel: null, grip: null, magazine: null };
const trainingLoadout: LoadoutWire = {
  weaponId: "rifle_ar", secondaryWeaponId: "pistol_side", meleeWeaponId: "knife_tactical",
  perkId: "battle_hardened", weaponSkinId: "default", secondaryWeaponSkinId: "default",
  meleeWeaponSkinId: "default", playerSkinId: "default", equipmentId: "frag", attachments: emptyAttachments,
  secondaryAttachments: emptyAttachments, meleeAttachments: emptyAttachments,
};

export function Tutorial() {
  const { profile, playerKey, setScreen } = useGame();
  const [progress, setProgress] = useState(() => {
    const saved = loadTutorialProgress(playerKey);
    return saved?.status === "in_progress" ? saved : newTutorialProgress();
  });
  const [touch] = useState(() => typeof window !== "undefined" &&
    (navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches));
  const [equipment, setEquipment] = useState<"primary" | "secondary" | "melee" | "tactical" | "perk">("primary");
  const [mode, setMode] = useState<"pvp" | "survival">("pvp");
  const practice = useRef<PracticeState>({ step: progress.practiceStep, distance: 0 });

  useEffect(() => { saveTutorialProgress(playerKey, progress); }, [playerKey, progress]);
  useEffect(() => {
    if (progress.phase !== "practice") return;
    const unlock = (event: KeyboardEvent) => { if (event.code === "Escape") document.exitPointerLock?.(); };
    document.addEventListener("keydown", unlock);
    return () => document.removeEventListener("keydown", unlock);
  }, [progress.phase]);

  const observePractice = useCallback((sample: PracticeSample) => {
    const previous = practice.current;
    const next = advancePractice(previous, sample);
    practice.current = next;
    if (next.step !== previous.step) setProgress(p => ({ ...p, practiceStep: next.step }));
  }, []);
  const goTo = (phase: TutorialPhase) => {
    if (phase === "practice") practice.current = { step: progress.practiceStep, distance: 0 };
    setProgress(p => ({ ...p, phase }));
  };
  const leave = (status: "in_progress" | "skipped" | "completed", screen: "menu" | "play" = "menu") => {
    // Save synchronously before unmount, including immediately after Skip.
    saveTutorialProgress(playerKey, { ...progress, status });
    setScreen(screen);
  };

  if (!profile) return <div className="p-8 text-white/60">Preparing your tutorial…</div>;
  const done = progress.practiceStep >= PRACTICE_TASKS.length;
  const task = PRACTICE_TASKS[Math.min(progress.practiceStep, PRACTICE_TASKS.length - 1)];
  const phaseIndex = TUTORIAL_PHASES.indexOf(progress.phase);

  if (progress.phase === "practice") return (
    <div>
      <GameCanvas firingRange tutorial loadout={trainingLoadout} mode="ffa" botCount={0} botDifficulty="easy"
        online={false} playerName={profile.name} playerKey={playerKey} scoreLimit={0} timeLimitMin={0}
        mapId="compound" onMatchEnd={() => {}} onExit={() => leave("in_progress")}
        onPracticeSample={observePractice} />
      <aside className="fixed top-16 left-3 z-[72] w-[min(19rem,calc(100vw-1.5rem))] rounded-xl border border-amber-500/40 bg-black/85 p-3 sm:p-4 text-white shadow-xl pointer-events-none">
        <p className="text-[10px] uppercase tracking-widest text-amber-300">Tutorial · Private practice · {Math.min(progress.practiceStep + 1, PRACTICE_TASKS.length)} / {PRACTICE_TASKS.length}</p>
        <div className="mt-2 flex gap-1" aria-label={`${progress.practiceStep} of ${PRACTICE_TASKS.length} drills complete`}>
          {PRACTICE_TASKS.map((t, i) => <span key={t.title} className={`h-1 flex-1 rounded ${i < progress.practiceStep ? "bg-emerald-400" : "bg-white/20"}`} />)}
        </div>
        <div role="status" aria-live="polite" aria-atomic="true">
          <h1 className="mt-3 text-lg font-bold">{done ? "Drills complete!" : task.title}</h1>
          <p className="mt-1 text-xs leading-relaxed text-white/70">{done ? "You have the basics. Continue to your loadout briefing." : touch ? task.touch : task.desktop}</p>
        </div>
        <p className="mt-2 text-[10px] text-white/45">{touch ? "Use the controls below to leave or continue." : "Press Escape to use the tutorial buttons."}</p>
        <div className="mt-3 flex flex-wrap gap-2 pointer-events-auto" onPointerDown={e => e.stopPropagation()}>
          <Button size="sm" variant="outline" onClick={() => leave("in_progress")} className="border-white/20 bg-zinc-900 text-white text-xs">Save &amp; leave</Button>
          <Button size="sm" onClick={() => goTo("loadout")} className="bg-amber-500 text-black hover:bg-amber-400 text-xs">
            {done ? "Continue" : "Skip practice"}<ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </aside>
    </div>
  );

  const equipmentDetails = {
    primary: { title: profile.loadout.weapon.name, text: "Your main weapon. In Armory, select a weapon to see its stats, unlock requirements, attachments and per-weapon camos." },
    secondary: { title: profile.loadout.secondary.name, text: "Swap to your sidearm when your primary runs dry. Q quick-swaps between your last two weapons." },
    melee: { title: profile.loadout.melee.name, text: "Use slot 3 for melee or F for a quick strike. Melee weapons help you move faster and excel up close." },
    perk: { title: perkById(profile.loadout.perkId).name, text: "Perks unlock as you level. Equip one in Armory to suit your playstyle, then save a named loadout to switch builds later." },
    tactical: { title: "Frag Grenade", text: "Unlocked at Level 1. Press G to throw a grenade on desktop or tap Tactical on touch controls. You have two charges per life; they refill on respawn. Choose other tactical equipment from Armory as you level up. Gun Game disables tactical gear." },
  };
  const detail = equipmentDetails[equipment];

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.10),transparent_60%)]">
      <header className="border-b border-white/10 bg-black/50">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-4">
          <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-amber-300"><GraduationCap className="h-5 w-5" /> Field Training</span>
          <Button variant="ghost" size="sm" onClick={() => leave("skipped")} className="text-white/60 hover:text-white">Skip tutorial</Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <ol aria-label="Tutorial progress" className="mb-8 grid grid-cols-5 gap-1.5">
          {["Welcome", "Practice", "Loadout", "Modes", "Ready"].map((label, i) => <li key={label} aria-current={i === phaseIndex ? "step" : undefined}>
            <div className={`mb-2 h-1 rounded ${i <= phaseIndex ? "bg-amber-400" : "bg-white/10"}`} />
            <span className={`text-[10px] sm:text-xs ${i === phaseIndex ? "text-amber-300" : "text-white/40"}`}>{label}</span>
          </li>)}
        </ol>
        <section className="rounded-2xl border border-white/10 bg-zinc-900/80 p-5 sm:p-8">
          {progress.phase === "welcome" && <>
            <Crosshair className="mb-5 h-12 w-12 text-amber-400" />
            <p className="mb-2 text-xs uppercase tracking-widest text-white/45">Welcome, {profile.name}</p>
            <h1 className="text-3xl font-black sm:text-4xl">Your first mission starts here.</h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/65">Learn the controls in a private firing range, explore your loadout, and choose your first game mode. Take it at your own pace — about 3 minutes.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[{ icon: Crosshair, title: "Learn by playing", text: "Six short drills with live feedback." }, { icon: Backpack, title: "Build your kit", text: "Weapons, tactical gear, attachments and one perk." }, { icon: Shield, title: "Find your fight", text: "Competitive modes or Survival." }].map(({ icon: Icon, title, text }) => <div key={title} className="rounded-xl border border-white/10 bg-black/30 p-4"><Icon className="mb-2 h-5 w-5 text-amber-300" /><h2 className="text-sm font-bold">{title}</h2><p className="mt-1 text-xs leading-relaxed text-white/50">{text}</p></div>)}
            </div>
            <p className="mt-5 text-xs text-white/45">Practice is free and does not affect your stats. Your progress is saved on this device; resume from Profile at any time.</p>
          </>}
          {progress.phase === "loadout" && <>
            <Backpack className="mb-4 h-9 w-9 text-amber-400" />
            <h1 className="text-2xl font-black">Get to know your loadout.</h1>
            <p className="mt-3 text-sm text-white/60">Choose a slot below to inspect your current kit. Armory is where you change and save it.</p>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5" role="group" aria-label="Equipment slots">
              {(["primary", "secondary", "melee", "tactical", "perk"] as const).map(slot => <button key={slot} aria-pressed={equipment === slot} onClick={() => setEquipment(slot)} className={`rounded-lg border p-3 text-sm capitalize transition-colors ${equipment === slot ? "border-amber-400/70 bg-amber-500/15 text-amber-200" : "border-white/10 bg-black/30 text-white/60 hover:border-white/30"}`}>{slot}</button>)}
            </div>
            <div className="mt-4 min-h-32 rounded-xl border border-white/10 bg-black/30 p-5" aria-live="polite"><h2 className="font-bold text-amber-200">{detail.title}</h2><p className="mt-2 text-sm leading-relaxed text-white/60">{detail.text}</p></div>
            <p className="mt-5 text-xs leading-relaxed text-white/50">XP opens level gates. Weapon challenges make attachments and camos eligible; credits buy them. Try equipment at the Firing Range before buying.</p>
          </>}
          {progress.phase === "modes" && <>
            <Swords className="mb-4 h-9 w-9 text-amber-400" />
            <h1 className="text-2xl font-black">Choose your kind of fight.</h1>
            <p className="mt-3 text-sm text-white/60">Play opens the lobby: choose offline bots, create a room, or join other players.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2" role="group" aria-label="Explore game modes">
              <button aria-pressed={mode === "pvp"} onClick={() => setMode("pvp")} className={`rounded-xl border p-5 text-left ${mode === "pvp" ? "border-rose-400/60 bg-rose-500/10" : "border-white/10 bg-black/30"}`}><Swords className="mb-2 h-6 w-6 text-rose-300" /><h2 className="font-bold">Competitive modes</h2><p className="mt-2 text-xs leading-relaxed text-white/55">Free-for-all, team battles, weapon progression and objective modes. Practise against bots before joining others.</p></button>
              <button aria-pressed={mode === "survival"} onClick={() => setMode("survival")} className={`rounded-xl border p-5 text-left ${mode === "survival" ? "border-emerald-400/60 bg-emerald-500/10" : "border-white/10 bg-black/30"}`}><Shield className="mb-2 h-6 w-6 text-emerald-300" /><h2 className="font-bold">Survival</h2><p className="mt-2 text-xs leading-relaxed text-white/55">Fight escalating waves solo or in co-op. Clear the default 30 waves, then tackle tougher difficulties.</p></button>
            </div>
            {mode === "pvp" ? (
              <div className="mt-4" aria-live="polite">
                <p className="mb-3 text-xs text-white/50">Five competitive modes, five different ways to win:</p>
                <ul className="grid gap-2 sm:grid-cols-2" aria-label="Competitive mode rules">
                  {COMPETITIVE_MODE_IDS.map(id => {
                    const guide = COMPETITIVE_MODE_GUIDES[id];
                    return <li key={id} className="rounded-lg border border-white/10 bg-black/30 p-4">
                      <h3 className="text-sm font-bold text-amber-200">{guide.label}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-white/70">{guide.objective}</p>
                      <p className="mt-2 text-xs leading-relaxed text-white/45"><span className="font-semibold text-white/60">Tip:</span> {guide.tip}</p>
                    </li>;
                  })}
                </ul>
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-white/10 bg-black/30 p-4 text-sm leading-relaxed text-white/65" aria-live="polite">In Solo Survival, dying ends the run. In co-op, help a downed teammate get back into the fight. Keep moving and watch your ammunition.</p>
            )}
          </>}
          {progress.phase === "ready" && <>
            <Trophy className="mb-4 h-10 w-10 text-amber-400" />
            <h1 className="text-3xl font-black">You’re ready, operative.</h1>
            <ul className="mt-5 space-y-4 text-sm text-white/65">
              {["Play: pick a mode, map and difficulty, then start a match.", "Armory: inspect equipment, finish unlock challenges and save your builds.", "Profile: track achievements and equip titles earned at the end of achievement chains.", "Daily and weekly quests: check the main menu for fresh goals and rewards."].map(text => <li key={text} className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{text}</li>)}
            </ul>
            <p className="mt-5 text-xs text-white/45">Replay this tutorial from Profile. Adjust sensitivity, field of view and audio in Settings.</p>
          </>}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
            {phaseIndex > 0 ? <Button variant="ghost" onClick={() => goTo(TUTORIAL_PHASES[phaseIndex - 1])} className="text-white/60"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Button> : <span className="text-xs text-white/40">Step 1 of 5</span>}
            {progress.phase === "ready" ? <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => leave("completed")} className="border-white/20 text-white">Main menu</Button>
              <Button onClick={() => leave("completed", "play")} className="bg-amber-500 text-black hover:bg-amber-400">Finish &amp; play<ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div> : <Button onClick={() => goTo(TUTORIAL_PHASES[phaseIndex + 1])} className="bg-amber-500 text-black hover:bg-amber-400">
              {progress.phase === "welcome" ? "Start training" : "Continue"}<ArrowRight className="ml-2 h-4 w-4" />
            </Button>}
          </div>
        </section>
      </main>
    </div>
  );
}
