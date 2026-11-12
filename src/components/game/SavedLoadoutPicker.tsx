"use client";
import { useState } from "react";
import { useGame } from "@/lib/game-store";
import type { PlayerProfileView } from "@/lib/player-service";
import type { GameMode } from "@/lib/game-protocol";
import { weaponById } from "@/lib/game-data";
import { perkById } from "@/lib/perks";
import { equipmentById } from "@/lib/equipment";
import { Backpack, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  mode: GameMode;
  queuedPresetId: string | null;
  onPresetEquipped: (profile: PlayerProfileView, presetId: string) => void;
}

/** In-match loadout changes are restricted to previously saved Armory presets.
 * No weapon, perk, cosmetic or tactical editing is available in this menu.
 * The server resolves each preset ID against the player's saved snapshots and
 * validates ownership before this component queues the confirmed kit.
 */
export function SavedLoadoutPicker({ mode, queuedPresetId, onPresetEquipped }: Props) {
  const { playerKey, profile, setProfile } = useGame();
  const [busyId, setBusyId] = useState<string | null>(null);
  const presets = profile?.savedLoadouts ?? [];
  const gunGame = mode === "gungame";

  const equip = async (presetId: string) => {
    if (busyId || queuedPresetId === presetId) return;
    setBusyId(presetId);
    try {
      const response = await fetch("/api/loadout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerKey, presetId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error ?? "Could not equip saved loadout");
      if (!result?.loadout || !Array.isArray(result.savedLoadouts)) {
        throw new Error("Invalid response while equipping loadout");
      }
      // Use the validated server response, not a potentially stale profile
      // from the store. This keeps the next-respawn kit and account in sync.
      const updatedProfile = result as PlayerProfileView;
      setProfile(updatedProfile);
      onPresetEquipped(updatedProfile, presetId);
      toast.success(gunGame
        ? "Preset equipped for future matches"
        : "Preset queued for your next respawn");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not equip saved loadout");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section aria-label="Saved loadout presets" className="space-y-4">
      <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-100">
        {gunGame
          ? "Gun Game controls your weapons. Choosing a preset only changes the kit used in future matches."
          : "Choose an existing saved loadout to be equipped on your next respawn."}
        <p className="mt-1 text-xs text-amber-200/65">Create and edit presets in the Armory outside a match.</p>
      </div>
      {presets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/20 bg-white/[0.03] px-5 py-8 text-center">
          <Backpack className="mx-auto mb-3 h-7 w-7 text-white/35" />
          <p className="font-semibold text-white/85">No saved loadouts</p>
          <p className="mt-2 text-sm text-white/50">
            Save a loadout in Armory → Current Loadout → Saved Loadouts before joining a match.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {presets.map(preset => {
            const selected = queuedPresetId === preset.id;
            return (
              <button key={preset.id} type="button" onClick={() => void equip(preset.id)}
                disabled={busyId !== null || selected} aria-pressed={selected}
                className={`w-full rounded-xl border p-4 text-left transition-colors disabled:cursor-default ${selected
                  ? "border-emerald-500/50 bg-emerald-500/10"
                  : "border-white/15 bg-white/[0.04] hover:border-amber-500/50 hover:bg-amber-500/[0.08]"}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-bold text-white">{preset.name}</span>
                  <span className={`shrink-0 text-xs font-semibold ${selected ? "text-emerald-300" : "text-amber-300"}`}>
                    {busyId === preset.id ? <><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Equipping…</>
                      : selected ? <><Check className="mr-1 inline h-3.5 w-3.5" /> {gunGame ? "Selected" : "Queued"}</>
                      : gunGame ? "Use next match" : "Queue for respawn"}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-white/60">
                  {weaponById(preset.primaryWeapon).name} · {weaponById(preset.secondaryWeapon).name} · {weaponById(preset.meleeWeapon).name}
                </p>
                <p className="mt-1 text-xs text-white/40">
                  {perkById(preset.perkId).name} · {equipmentById(preset.equipmentId).name}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
