"use client";
import { Settings } from "@/components/screens/Settings";
import { SavedLoadoutPicker } from "./SavedLoadoutPicker";
import type { PlayerProfileView } from "@/lib/player-service";
import { QuestPanel } from "./QuestPanel";
import type { GameMode } from "@/lib/game-protocol";
import { ArrowLeft, DoorOpen, LogOut, Play, Settings2, Backpack, AlertTriangle, ScrollText } from "lucide-react";

export type InGameMenuPage = "main" | "settings" | "loadout" | "quests" | "quit";

interface Props {
  page: InGameMenuPage;
  onPageChange: (page: InGameMenuPage) => void;
  onResume: () => void;
  onQuit: () => void;
  onLoadoutSaved: (profile: PlayerProfileView, presetId: string) => void;
  queuedPresetId: string | null;
  online: boolean;
  mode: GameMode;
}

export function InGameMenu({ page, onPageChange, onResume, onQuit, onLoadoutSaved, queuedPresetId, online, mode }: Props) {
  return (
    <div role="dialog" aria-modal="true" aria-label="In-game menu"
      className="absolute inset-0 z-[65] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 text-white pointer-events-auto"
      onPointerDown={event => event.stopPropagation()}>
      <div className={`w-full ${page === "loadout" ? "max-w-3xl" : page === "quests" ? "max-w-5xl" : "max-w-3xl"} max-h-[92vh] overflow-y-auto overscroll-contain rounded-2xl border border-amber-500/25 bg-zinc-950 shadow-2xl shadow-black/70`}>
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/10 bg-zinc-950/95 backdrop-blur px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-rose-600">
            <Settings2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-black uppercase tracking-[0.18em]">
              {page === "main" ? "In-Game Menu" : page === "settings" ? "Settings" : page === "loadout" ? "Change Loadout" : page === "quests" ? "Quests" : "Leave Match"}
            </div>
            <div className="text-xs text-white/45">{mode.toUpperCase()} · {online ? "Online match" : "Local match"}</div>
          </div>
          {page !== "main" && <button type="button" onClick={() => onPageChange("main")}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10">
            <ArrowLeft className="mr-1 inline h-4 w-4" /> Back
          </button>}
          <button type="button" onClick={onResume}
            className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-black hover:bg-amber-400">
            <Play className="mr-1 inline h-4 w-4" /> Resume
          </button>
        </div>
        {page === "main" && (
          <div className="space-y-3 p-5 sm:p-8">
            <MenuButton icon={<Settings2 className="h-5 w-5" />} title="Settings" help="Display, controls and audio · changes apply immediately" onClick={() => onPageChange("settings")} />
            <MenuButton icon={<Backpack className="h-5 w-5" />} title="Change Loadout" help={mode === "gungame" ? "Choose a saved preset for your next match" : "Switch to a saved preset on your next respawn"} onClick={() => onPageChange("loadout")} />
            <MenuButton icon={<ScrollText className="h-5 w-5" />} title="Quests" help="Daily and weekly challenges · progress and rewards" onClick={() => onPageChange("quests")} />
            <MenuButton icon={<DoorOpen className="h-5 w-5" />} title="Quit Match" help="Leave and collect any earned match progression" onClick={() => onPageChange("quit")} danger />
            <div className="pt-2 text-xs text-white/35">Esc: close menu · Tab: scoreboard while playing</div>
          </div>
        )}
        {page === "settings" && <div className="p-4 sm:p-6"><Settings embedded /></div>}
        {page === "loadout" && (
          <div className="p-4 sm:p-6">
            <SavedLoadoutPicker mode={mode} queuedPresetId={queuedPresetId} onPresetEquipped={onLoadoutSaved} />
          </div>
        )}
        {page === "quests" && <div className="p-4 sm:p-6"><QuestPanel /></div>}
        {page === "quit" && <div className="space-y-5 p-6 sm:p-8">
          <div className="flex items-center gap-3 text-rose-300">
            <AlertTriangle className="h-6 w-6" />
            <h2 className="text-xl font-bold">Leave this match?</h2>
          </div>
          <p className="text-sm text-white/65">
            You will disconnect from the active match. Progress earned so far is submitted when possible.
            You cannot immediately resume this session from the menu.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => onPageChange("main")} className="rounded-lg border border-white/20 px-5 py-3 text-sm text-white hover:bg-white/10">Stay in Match</button>
            <button type="button" onClick={onQuit} className="rounded-lg bg-rose-600 px-5 py-3 text-sm font-bold text-white hover:bg-rose-500">
              <LogOut className="mr-2 inline h-4 w-4" /> Quit Match
            </button>
          </div>
        </div>}
      </div>
    </div>
  );
}

function MenuButton({ icon, title, help, onClick, danger = false }: {
  icon: React.ReactNode; title: string; help: string; onClick: () => void; danger?: boolean;
}) {
  return <button type="button" onClick={onClick}
    className="flex w-full items-center gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left hover:border-amber-500/40 hover:bg-white/[0.08]">
    <span className={danger ? "text-rose-400" : "text-amber-400"}>{icon}</span>
    <span className="flex-1">
      <span className="block font-semibold">{title}</span>
      <span className="block text-xs text-white/45">{help}</span>
    </span>
  </button>;
}
