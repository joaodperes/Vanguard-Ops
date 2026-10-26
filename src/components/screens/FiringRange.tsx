"use client";

import { useEffect, useMemo, useState } from "react";
import { GameCanvas } from "@/components/game/GameCanvas";
import { useGame } from "@/lib/game-store";
import type { PlayerProfileView } from "@/lib/player-service";
import type { LoadoutWire } from "@/lib/game-protocol";
import {
  WEAPONS, WEAPON_SKINS, PLAYER_SKINS, ATTACHMENTS,
  weaponById, weaponAttachmentSlots, compatibleAttachments, type AttachmentSlot,
} from "@/lib/game-data";
import { PERKS, perkSelection, perkById } from "@/lib/perks";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Crosshair, FlaskConical, Settings2, RotateCcw, ShieldCheck } from "lucide-react";

type AttachmentMap = LoadoutWire["attachments"];
const blank = (): AttachmentMap => ({ sight: null, barrel: null, grip: null, magazine: null });
const slots: AttachmentSlot[] = ["sight", "barrel", "grip", "magazine"];
const normalize = (value?: Record<string, string | null>): AttachmentMap => ({
  sight: value?.sight ?? null, barrel: value?.barrel ?? null,
  grip: value?.grip ?? null, magazine: value?.magazine ?? null,
});

function initialTrial(profile: PlayerProfileView, requestedId: string | null): LoadoutWire {
  const saved = profile.loadout;
  const sameWeapon = !requestedId || requestedId === saved.weapon.id;
  return {
    weaponId: requestedId ?? saved.weapon.id,
    secondaryWeaponId: saved.secondary.id,
    meleeWeaponId: saved.melee.id,
    perkId: perkSelection(profile.level),
    weaponSkinId: sameWeapon ? saved.weaponSkin.id : "default",
    secondaryWeaponSkinId: saved.secondaryWeaponSkin.id,
    meleeWeaponSkinId: saved.meleeWeaponSkin.id,
    playerSkinId: saved.playerSkin.id,
    attachments: sameWeapon ? normalize(saved.attachments) : blank(),
    secondaryAttachments: normalize(saved.secondaryAttachments),
    meleeAttachments: normalize(saved.meleeAttachments),
  };
}

export function FiringRange() {
  const { profile, playerKey, rangeWeaponId, setRangeWeaponId, setScreen } = useGame();
  if (!profile) return <div className="p-8 text-white/60">Loading your equipment…</div>;
  return <RangeSession key={playerKey} profile={profile} requestedId={rangeWeaponId} onExit={() => {
    setRangeWeaponId(null);
    setScreen("armory");
  }} />;
}

function RangeSession({ profile, requestedId, onExit }: {
  profile: PlayerProfileView; requestedId: string | null; onExit: () => void;
}) {
  const [draft, setDraft] = useState<LoadoutWire>(() => initialTrial(profile, requestedId));
  const [applied, setApplied] = useState<LoadoutWire>(() => initialTrial(profile, requestedId));
  const [session, setSession] = useState(0);
  const [editing, setEditing] = useState(true);
  const ownedIds = useMemo(() => new Set(profile.unlocks.weapons), [profile.unlocks.weapons]);
  useEffect(() => {
    if (editing && typeof document !== "undefined" && document.pointerLockElement) document.exitPointerLock();
  }, [editing]);

  function changeWeapon(field: "weaponId" | "secondaryWeaponId" | "meleeWeaponId", id: string) {
    const attField = field === "weaponId" ? "attachments" : field === "secondaryWeaponId" ? "secondaryAttachments" : "meleeAttachments";
    const skinField = field === "weaponId" ? "weaponSkinId" : field === "secondaryWeaponId" ? "secondaryWeaponSkinId" : "meleeWeaponSkinId";
    setDraft(prev => ({ ...prev, [field]: id, [attField]: blank(), [skinField]: "default" }));
  }

  function loadPreset(id: string) {
    if (id === "current") { setDraft(initialTrial(profile, null)); return; }
    const preset = profile.savedLoadouts.find(p => p.id === id);
    if (!preset) return;
    setDraft({
      weaponId: preset.primaryWeapon,
      secondaryWeaponId: preset.secondaryWeapon,
      meleeWeaponId: preset.meleeWeapon,
      weaponSkinId: preset.weaponSkin,
      secondaryWeaponSkinId: preset.secondaryWeaponSkin,
      meleeWeaponSkinId: preset.meleeWeaponSkin,
      playerSkinId: preset.playerSkin,
      perkId: perkById(preset.perkId).id,
      attachments: normalize(preset.attachments),
      secondaryAttachments: normalize(preset.secondaryAttachments),
      meleeAttachments: normalize(preset.meleeAttachments),
    });
  }

  function launch() {
    setApplied({
      ...draft,
      attachments: { ...draft.attachments },
      secondaryAttachments: { ...draft.secondaryAttachments },
      meleeAttachments: { ...draft.meleeAttachments },
    });
    setSession(value => value + 1);
    setEditing(false);
  }

  const selectClass = "w-full rounded-lg border border-white/20 bg-zinc-950/90 px-3 py-2 text-sm text-white outline-none focus:border-amber-400";
  const labelClass = "block text-[11px] font-semibold uppercase tracking-wider text-white/55 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <GameCanvas
        key={session}
        firingRange
        loadout={applied}
        mode="ffa"
        botCount={0}
        botDifficulty="easy"
        online={false}
        playerName={profile.name}
        playerKey={profile.playerKey}
        scoreLimit={0}
        timeLimitMin={0}
        mapId="compound"
        onMatchEnd={() => {}}
        onExit={onExit}
      />
      <div className="fixed top-3 left-3 z-[72] flex flex-wrap gap-2 items-center pointer-events-auto">
        <Button size="sm" onClick={onExit} variant="outline" className="bg-black/80 border-white/30 text-white hover:bg-zinc-800">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Armory
        </Button>
        <Button size="sm" onClick={() => setEditing(true)} variant="outline" className="bg-black/80 border-amber-500/50 text-amber-200 hover:bg-zinc-800">
          <Settings2 className="w-4 h-4 mr-1.5" /> Trial Loadout
        </Button>
        {!editing && <span className="rounded-md bg-black/70 px-3 py-2 text-xs text-emerald-200 border border-emerald-500/30">PRACTICE ONLY · NO COST</span>}
      </div>
      {editing && (
        <div className="fixed inset-0 z-[75] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-3xl max-h-[94vh] overflow-y-auto rounded-2xl border border-amber-500/35 bg-zinc-900 shadow-2xl p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2 text-amber-300 font-black uppercase tracking-widest text-lg"><Crosshair className="w-5 h-5" /> Firing Range</div>
                <p className="text-white/60 text-sm mt-1">Try any weapon, skin or compatible attachment—even locked equipment—before purchasing.</p>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-300 text-xs border border-emerald-500/25 bg-emerald-500/10 rounded-lg px-3 py-2">
                <ShieldCheck className="w-4 h-4" /> No purchases or profile changes
              </div>
            </div>
            <div className="mb-4">
              <label className={labelClass} htmlFor="trial-preset">Start from saved equipment</label>
              <select id="trial-preset" className={selectClass} defaultValue="" onChange={e => loadPreset(e.target.value)}>
                <option value="" disabled>Choose a preset or keep current trial</option>
                <option value="current">Currently equipped loadout</option>
                {profile.savedLoadouts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 mb-4">
              {([
                ["weaponId", "Trial weapon", WEAPONS],
                ["secondaryWeaponId", "Secondary (2)", WEAPONS.filter(w => w.category !== "melee" && !w.wonder)],
                ["meleeWeaponId", "Melee (3)", WEAPONS.filter(w => w.category === "melee")],
              ] as const).map(([field, label, weapons]) => (
                <div key={field}>
                  <label className={labelClass} htmlFor={field}>{label}</label>
                  <select id={field} className={selectClass} value={draft[field] ?? ""} onChange={e => changeWeapon(field, e.target.value)}>
                    {weapons.map(w => <option key={w.id} value={w.id}>{w.name}{ownedIds.has(w.id) || (w.unlockCost === 0 && !w.wonder) ? "" : " · Locked"}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              {([
                ["weaponId", "attachments", "weaponSkinId", "Trial weapon"],
                ["secondaryWeaponId", "secondaryAttachments", "secondaryWeaponSkinId", "Secondary"],
              ] as const).map(([weaponField, attField, skinField, label]) => {
                const weapon = weaponById(draft[weaponField] ?? "");
                return <div key={weaponField} className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-3">
                  <div className="font-bold text-sm text-white">{label}: <span className="text-amber-200">{weapon.name}</span></div>
                  <div>
                    <label className={labelClass}>Weapon finish (preview only)</label>
                    <select className={selectClass} value={draft[skinField] ?? "default"} onChange={e => setDraft(prev => ({ ...prev, [skinField]: e.target.value }))}>
                      {WEAPON_SKINS.map(skin => <option key={skin.id} value={skin.id}>{skin.name}</option>)}
                    </select>
                  </div>
                  {slots.filter(slot => weaponAttachmentSlots(weapon).includes(slot)).map(slot => (
                    <div key={slot}>
                      <label className={labelClass}>{slot}</label>
                      <select className={selectClass} value={draft[attField]?.[slot] ?? ""}
                        onChange={e => setDraft(prev => ({ ...prev, [attField]: { ...prev[attField], [slot]: e.target.value || null } }))}>
                        <option value="">No attachment</option>
                        {compatibleAttachments(weapon.id, slot).map(id => (
                          <option key={id} value={id}>{ATTACHMENTS.find(a => a.id === id)?.name ?? id}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                  {weaponAttachmentSlots(weapon).length === 0 && <p className="text-xs text-white/40">No compatible attachments.</p>}
                </div>;
              })}
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mb-5">
              <div>
                <label className={labelClass}>Operator appearance</label>
                <select className={selectClass} value={draft.playerSkinId} onChange={e => setDraft(prev => ({ ...prev, playerSkinId: e.target.value }))}>
                  {PLAYER_SKINS.map(skin => <option key={skin.id} value={skin.id}>{skin.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Passive perk</label>
                <select className={selectClass} value={draft.perkId ?? "battle_hardened"} onChange={e => setDraft(prev => ({ ...prev, perkId: perkById(e.target.value).id }))}>
                  {PERKS.map(perk => <option key={perk.id} value={perk.id}>{perk.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center justify-between border-t border-white/10 pt-4">
              <div className="text-xs text-white/50 max-w-sm">Four stationary targets respawn automatically. Use WASD and mouse to move and shoot, 1/2/3 to swap guns, and Escape to release the cursor. Nothing is saved.</div>
              <div className="flex gap-2">
                <Button variant="outline" className="border-white/20 text-white" onClick={() => setDraft(initialTrial(profile, requestedId))}>
                  <RotateCcw className="w-4 h-4 mr-1.5" /> Reset
                </Button>
                <Button className="bg-amber-500 hover:bg-amber-400 text-black font-bold" onClick={launch}>
                  <FlaskConical className="w-4 h-4 mr-1.5" /> {session ? "Apply & Restart Test" : "Start Testing"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
