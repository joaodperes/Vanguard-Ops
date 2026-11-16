"use client";

import { titledDisplayName } from "@/lib/achievement-titles";

import { useEffect, useMemo, useRef, useState } from "react";
import { GameCanvas } from "@/components/game/GameCanvas";
import { RANGE_MOVING_TARGETS, RANGE_SPAWN } from "@/lib/firing-range";
import { useGame } from "@/lib/game-store";
import type { PlayerProfileView } from "@/lib/player-service";
import type { LoadoutWire } from "@/lib/game-protocol";
import {
  WEAPONS, ATTACHMENTS, WEAPON_SKINS,
  weaponById, weaponAttachmentSlots, compatibleAttachments, type AttachmentSlot,
} from "@/lib/game-data";
import { PERKS, perkById } from "@/lib/perks";
import {COSMETICS} from "@/lib/cosmetics";
import {rangeWonderWeapons, rangePrimarySelection, selectRangePrimary} from "@/lib/firing-range-loadout";
import {wonderModulesFor,wonderModuleById,wonderModuleModifiers,WONDER_FINISHES,WONDER_KILL_EFFECTS} from "@/lib/wonder-expansion";
import { EQUIPMENT } from "@/lib/equipment";
import {
  emptyRangeAttachments, normalizeRangeLoadout, rangePrimaryWeapons,
  rangeMeleeWeapons, rangeSecondaryWeapons, rangeWeaponSlot, selectRangeWeapon, groupedRangeWeapons,
} from "@/lib/firing-range-loadout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Crosshair, FlaskConical, Settings2, RotateCcw, Play as PlayIcon } from "lucide-react";

type AttachmentMap = LoadoutWire["attachments"];
const slots: AttachmentSlot[] = ["sight", "barrel", "grip", "magazine"];
const normalize = (value?: Record<string, string | null>): AttachmentMap => ({
  sight: value?.sight ?? null, barrel: value?.barrel ?? null,
  grip: value?.grip ?? null, magazine: value?.magazine ?? null,
});

function initialTrial(profile: PlayerProfileView, requestedId: string | null): LoadoutWire {
  const saved = profile.loadout;
  const equipped: LoadoutWire = {
    weaponId: saved.weapon.id,
    secondaryWeaponId: saved.secondary.id,
    meleeWeaponId: saved.melee.id,
    equipmentId: saved.equipmentId,
    perkId: saved.perkId,
    wonderWeaponId: saved.wonderWeaponId,
    wonderModuleId: saved.wonderModuleId,
    wonderSkinId: saved.wonderSkinId,
    wonderKillEffectId: saved.wonderKillEffectId,
    weaponSkinId: saved.weaponSkin.id,
    secondaryWeaponSkinId: saved.secondaryWeaponSkin.id,
    meleeWeaponSkinId: saved.meleeWeaponSkin.id,
    playerSkinId: saved.playerSkin.id,
    primaryReticleId: saved.primaryReticle,
    secondaryReticleId: saved.secondaryReticle,
    primaryCharmId: saved.primaryCharm,
    secondaryCharmId: saved.secondaryCharm,
    nameplateId: profile.selectedNameplate,
    attachments: normalize(saved.attachments),
    secondaryAttachments: normalize(saved.secondaryAttachments),
    meleeAttachments: normalize(saved.meleeAttachments),
  };
  return requestedId ? selectRangeWeapon(equipped, requestedId) : normalizeRangeLoadout(equipped);
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
  const [editorTab, setEditorTab] = useState<"equipment"|"visuals">("equipment");
  const primaryIsWonder = draft.perkId === "wonder_weapon" && rangeWonderWeapons.some(w => w.id === draft.wonderWeaponId);
  const selectedPrimary = rangePrimarySelection(draft);
  const ownedIds = useMemo(() => new Set([
    ...profile.unlocks.weapons,
    ...profile.prestige.wonderWeapons,
    ...WEAPONS.filter(w => !w.wonder && w.unlockCost === 0 && w.unlockLevel <= profile.level).map(w => w.id),
  ]), [profile.unlocks.weapons, profile.prestige.wonderWeapons, profile.level]);

  // Browsers may consume Escape while pointer lock is active. Handle both
  // the key and the ensuing pointer-lock release so the editor reliably opens.
  const editingRef = useRef(editing);
  useEffect(() => {
    let wasLocked = !!document.pointerLockElement;
    const onPointerLockChange = () => {
      const locked = !!document.pointerLockElement;
      if (wasLocked && !locked && !editingRef.current) {
        editingRef.current = true;
        setEditing(true);
      }
      wasLocked = locked;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || editingRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      editingRef.current = true;
      setEditing(true);
      if (document.pointerLockElement) document.exitPointerLock();
    };
    document.addEventListener("pointerlockchange", onPointerLockChange);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);
  useEffect(() => {
    editingRef.current = editing;
    if (editing && document.pointerLockElement) document.exitPointerLock();
  }, [editing]);

  function changeWeapon(field: "weaponId" | "secondaryWeaponId" | "meleeWeaponId", id: string) {
    setDraft(prev => {
      const valid = field === "weaponId" ? rangeWeaponSlot(id) === "primary"
        : field === "secondaryWeaponId" ? rangeSecondaryWeapons(prev.perkId, prev.weaponId).some(w => w.id === id)
        : rangeWeaponSlot(id) === "melee";
      if (!valid) return prev;
      if (field === "weaponId") return selectRangePrimary(prev, id);
      const attachmentField = field === "secondaryWeaponId" ? "secondaryAttachments" : "meleeAttachments";
      const skinField = field === "secondaryWeaponId" ? "secondaryWeaponSkinId" : "meleeWeaponSkinId";
      return normalizeRangeLoadout({ ...prev, [field]: id, [skinField]:"default", [attachmentField]: emptyRangeAttachments() });
    });
  }

  function loadPreset(id: string) {
    if (id === "current") { setDraft(initialTrial(profile, null)); return; }
    const preset = profile.savedLoadouts.find(p => p.id === id);
    if (!preset) return;
    setDraft(normalizeRangeLoadout({
      weaponId: preset.primaryWeapon,
      secondaryWeaponId: preset.secondaryWeapon,
      meleeWeaponId: preset.meleeWeapon,
      equipmentId: preset.equipmentId,
      weaponSkinId: draft.weaponSkinId,
      secondaryWeaponSkinId: draft.secondaryWeaponSkinId,
      meleeWeaponSkinId: draft.meleeWeaponSkinId,
      playerSkinId: draft.playerSkinId,
      primaryReticleId: draft.primaryReticleId,
      secondaryReticleId: draft.secondaryReticleId,
      primaryCharmId: draft.primaryCharmId,
      secondaryCharmId: draft.secondaryCharmId,
      wonderWeaponId: draft.wonderWeaponId,
      wonderModuleId: draft.wonderModuleId,
      wonderSkinId: draft.wonderSkinId,
      wonderKillEffectId: draft.wonderKillEffectId,
      perkId: perkById(preset.perkId).id,
      attachments: normalize(preset.attachments),
      secondaryAttachments: normalize(preset.secondaryAttachments),
      meleeAttachments: normalize(preset.meleeAttachments),
    }));
  }

  function launch() {
    setApplied(normalizeRangeLoadout(draft));
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
        playerName={titledDisplayName(profile.name,profile.selectedTitle)}
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
          <div className="w-full max-w-6xl h-[min(92dvh,850px)] flex flex-col overflow-hidden rounded-2xl border border-amber-500/35 bg-zinc-900 shadow-2xl p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2 text-amber-300 font-black uppercase tracking-widest text-lg"><Crosshair className="w-5 h-5" /> Firing Range</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {session > 0 && <Button size="sm" variant="outline" onClick={() => setEditing(false)}
                  className="border-cyan-500/40 text-cyan-200">
                  <PlayIcon className="w-4 h-4 mr-1" /> Resume
                </Button>}
                <Button size="sm" variant="outline" onClick={onExit} className="border-white/30 text-white">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Leave
                </Button>
              </div>
            </div>
            <div className="flex gap-2 mb-3 border-b border-white/10 pb-3" role="tablist" aria-label="Firing range customization">
              <button role="tab" aria-selected={editorTab==="equipment"} onClick={()=>setEditorTab("equipment")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${editorTab==="equipment"?"bg-amber-500 text-black":"border border-white/15 text-white/70 hover:bg-white/10"}`}>Weapons &amp; Equipment</button>
              <button role="tab" aria-selected={editorTab==="visuals"} onClick={()=>setEditorTab("visuals")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${editorTab==="visuals"?"bg-violet-500 text-white":"border border-white/15 text-white/70 hover:bg-white/10"}`}>Visual customization</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {editorTab==="equipment" && <>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {RANGE_MOVING_TARGETS.map(target => (
                <div key={target.id} className="rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-2 text-center">
                  <div className="text-[11px] font-semibold text-cyan-200">{target.id.toUpperCase()} · {target.center[2] - RANGE_SPAWN[2]}m</div>
                  <div className="text-[10px] text-white/55">{target.speed.toFixed(1)} m/s sideways</div>
                </div>
              ))}
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
                ["weaponId", "Primary (Wonder uses 4)", [...rangePrimaryWeapons, ...rangeWonderWeapons]],
                ["secondaryWeaponId", "Secondary (2)", rangeSecondaryWeapons(draft.perkId, draft.weaponId)],
                ["meleeWeaponId", "Melee (3)", rangeMeleeWeapons],
              ] as const).map(([field, label, weapons]) => (
                <div key={field}>
                  <label className={labelClass} htmlFor={field}>{label}</label>
                  <select id={field} className={selectClass} value={field==="weaponId" ? selectedPrimary : (draft[field] ?? "")} onChange={e => changeWeapon(field, e.target.value)}>
                    {groupedRangeWeapons(weapons).map(group=>(
                      <optgroup key={group.type} label={group.label}>
                        {group.weapons.map(w=><option key={w.id} value={w.id}>
                          {w.name}{ownedIds.has(w.id) || (w.unlockCost === 0 && !w.wonder) ? "" : " · Locked"}
                        </option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              {([
                ["weaponId", "attachments", "Primary"],
                ["secondaryWeaponId", "secondaryAttachments", "Secondary"],
              ] as const).map(([weaponField, attField, label]) => {
                const weapon = weaponById(draft[weaponField] ?? "");
                return <div key={weaponField} className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-3">
                  <div className="font-bold text-sm text-white">{label}: <span className="text-amber-200">{weaponField==="weaponId"&&primaryIsWonder?weaponById(draft.wonderWeaponId??"").name:weapon.name}</span></div>
                  {weaponField==="weaponId" && primaryIsWonder ? (
                    <div className="space-y-2">
                      <label className={labelClass} htmlFor="trial-wonder-module">Wonder customization module</label>
                      <select id="trial-wonder-module" className={selectClass} value={draft.wonderModuleId ?? ""}
                        onChange={e=>setDraft(prev=>normalizeRangeLoadout({...prev,wonderModuleId:e.target.value}))}>
                        <option value="">Standard configuration</option>
                        {wonderModulesFor(draft.wonderWeaponId ?? "").map(module=>(
                          <option key={module.id} value={module.id}>{module.name}</option>
                        ))}
                      </select>

                      <div className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-3" aria-live="polite">
                        <div className="text-sm font-semibold text-violet-100">{wonderModuleById(draft.wonderModuleId??"")?.name??"Standard configuration"}</div>
                        <p className="text-xs text-white/60 mt-1">{wonderModuleById(draft.wonderModuleId??"")?.description??weaponById(draft.wonderWeaponId??"").description}</p>
                        <div className="text-[11px] text-white/55 mt-2">Base: {weaponById(draft.wonderWeaponId??"").stats.damage} damage · {weaponById(draft.wonderWeaponId??"").stats.range}m range · {weaponById(draft.wonderWeaponId??"").wonder?.maxCharges} charges</div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {wonderModuleModifiers(wonderModuleById(draft.wonderModuleId??""),draft.wonderWeaponId??"").map(mod=>(
                            <span key={mod.label} className="rounded border border-violet-500/25 bg-black/30 px-2 py-1 text-[11px] text-violet-200">{mod.label}: {mod.value}</span>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-violet-200/70">Wonder Weapons use modules rather than standard attachments. Fire with 4 during the test.</p>
                    </div>
                  ) : slots.filter(slot => weaponAttachmentSlots(weapon).includes(slot)).map(slot => (
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
                  {(weaponField!=="weaponId" || !primaryIsWonder) && weaponAttachmentSlots(weapon).length === 0 && <p className="text-xs text-white/40">No compatible attachments.</p>}
                </div>;
              })}
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className={labelClass} htmlFor="trial-tactical">Tactical (G / touch)</label>
              <select id="trial-tactical" className={selectClass} value={draft.equipmentId ?? "frag"}
                onChange={e => setDraft(prev => normalizeRangeLoadout({ ...prev, equipmentId: e.target.value as typeof prev.equipmentId }))}>
                {EQUIPMENT.map(item => <option key={item.id} value={item.id}>{item.name} · {item.charges} charges · LVL {item.unlockLevel} in matches</option>)}
              </select>
              <p className="mt-1.5 text-[11px] text-white/45">All tactics available for free trials. Apply &amp; Restart Test restores full charges; trials never change your real loadout.</p>
            </div>
            <div>
              <label className={labelClass} htmlFor="trial-perk">Passive perk</label>
              <div className="space-y-2">
                <select id="trial-perk" disabled={primaryIsWonder} className={selectClass} value={draft.perkId ?? "battle_hardened"}
                  onChange={e => setDraft(prev => normalizeRangeLoadout({ ...prev, perkId: perkById(e.target.value).id }))}>
                  {PERKS.filter(perk=>perk.id!=="wonder_weapon"||primaryIsWonder).map(perk => <option key={perk.id} value={perk.id}>{perk.name}</option>)}
                </select>
                {!primaryIsWonder&&<p aria-live="polite" className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/85 leading-relaxed">
                  {perkById(draft.perkId).description}
                </p>}
              </div>
            </div>
            </div>
            </>}
            {editorTab==="visuals" && <>
            <div className="mb-3 rounded-xl border border-violet-500/25 bg-violet-500/5 p-4">
              <div className="flex items-center gap-2 mb-1 font-bold text-violet-200 text-sm">Visual trials</div>
              <p className="text-xs text-white/55 mb-4">Optional: preview weapon finishes, reticles, charms and Wonder effects. These never change your saved loadout or balance.</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {([
                  ["weaponSkinId","Primary weapon finish",WEAPON_SKINS],
                  ["secondaryWeaponSkinId","Secondary weapon finish",WEAPON_SKINS],
                  ["meleeWeaponSkinId","Melee weapon finish",WEAPON_SKINS],
                ] as const).map(([field,label,items])=><div key={field}>
                  <label className={labelClass} htmlFor={"trial-"+field}>{label}</label>
                  <select id={"trial-"+field} className={selectClass} value={draft[field]}
                    onChange={e=>setDraft(prev=>({...prev,[field]:e.target.value}))}>
                    {items.map(skin=><option key={skin.id} value={skin.id}>{skin.name}</option>)}
                  </select>
                </div>)}
                {([
                  ["primaryReticleId","Primary reticle","reticle"],
                  ["secondaryReticleId","Secondary reticle","reticle"],
                  ["primaryCharmId","Primary charm","charm"],
                  ["secondaryCharmId","Secondary charm","charm"],
                ] as const).map(([field,label,kind])=><div key={field}>
                  <label className={labelClass} htmlFor={"trial-"+field}>{label}</label>
                  <select id={"trial-"+field} className={selectClass} value={draft[field]??(kind==="reticle"?"classic":"none")}
                    onChange={e=>setDraft(prev=>({...prev,[field]:e.target.value}))}>
                    {COSMETICS.filter(c=>c.kind===kind).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>)}
              </div>
            </div>
            {primaryIsWonder && <div className="mb-3 rounded-xl border border-violet-500/25 bg-black/30 p-4">
              <div className="font-bold text-violet-200 text-sm mb-3">Wonder visuals · {weaponById(draft.wonderWeaponId??"").name}</div>
              <div className="grid sm:grid-cols-2 gap-3">
                {([
                  ["wonderSkinId","Animated finish",WONDER_FINISHES],
                  ["wonderKillEffectId","Kill effect",WONDER_KILL_EFFECTS],
                ] as const).map(([field,label,items])=><div key={field}>
                  <label className={labelClass} htmlFor={"trial-"+field}>{label}</label>
                  <select id={"trial-"+field} className={selectClass} value={draft[field]??""}
                    onChange={e=>setDraft(prev=>({...prev,[field]:e.target.value}))}>
                    <option value="">Default</option>
                    {items.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </div>)}
              </div>
            </div>}
            </>}
            </div>
            <div className="flex flex-wrap gap-2 items-center justify-between border-t border-white/10 pt-3 mt-3">
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
