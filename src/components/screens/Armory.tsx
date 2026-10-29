"use client";
import { useEffect, useRef, useState } from "react";
import { useGame } from "@/lib/game-store";
import { displayLabel, weaponCategoryLabel } from "@/lib/display-labels";
import { formatWeaponNumber } from "@/lib/weapon-numbers";
import { shotSpread } from "@/lib/weapon-accuracy";
import { enqueueAttachmentSave } from "@/lib/attachment-save-queue";
import { emptyAttachmentMap } from "@/lib/loadout-attachments";
import { attachmentViewPermissions, showPendingAttachmentChallenge } from "@/lib/armory-attachment-browse";
import { COSMETICS } from "@/lib/cosmetics";
import {
  WEAPONS, ATTACHMENTS, WEAPON_SKINS, PLAYER_SKINS, RARITY_COLORS,
  SIGHT_DEFS,
  weaponAttachmentSlots, compatibleAttachments, computeEffectiveStats,
  weaponSkinById, weaponById,
  type WeaponCategory, type WeaponSlot, type AttachmentSlot, type WeaponDef, type WeaponChallengeMetric,
} from "@/lib/game-data";
import type { ResolvedLoadout } from "@/lib/game-data";
import { attachmentChallenge, armoryChallengeProgress, weaponMasteryProgress, weaponChallengeProgress, allSkinChallengesForWeapon, type WeaponConditionStats } from "@/lib/armory-challenges";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Lock, Check, Coins, Zap, Crosshair, Wrench, Palette, Shirt, Sparkles, Target, TrendingUp, Wind, ZoomIn, ScanLine, ChevronDown, ChevronRight, Swords, X, TestTube2, Save, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { LoadoutSelector } from "@/components/screens/Loadout";
import { wonderUnlockChallenge } from "@/lib/weapon-prestige";
import { perkById } from "@/lib/perks";
import { WeaponStatsPreview, type AttachmentMap } from "@/components/screens/WeaponStatsPreview";
import { OperatorPreview } from "@/components/game/OperatorPreview";

// ----------------------------------------------------------------------------
// Per-weapon progress + challenges view (fetched from /api/weapon-progress).
// ----------------------------------------------------------------------------
interface WeaponProgressMap {
  [weaponId: string]: { weaponId: string; kills: number; headshots: number; conditionStats?: Partial<WeaponConditionStats> };
}
interface WeaponChallengeView {
  challengeId: string;
  weaponId: string;
  skinId: string;
  metric: WeaponChallengeMetric;
  goal: number;
  progress: number;
  completed: boolean;
  requirements?: { metric: WeaponChallengeMetric; goal: number; progress: number; completed: boolean }[];
  title: string;
  description: string;
}
interface WeaponChallengesMap {
  [weaponId: string]: WeaponChallengeView[];
}

// Short label for an attachment effect key (used in the +/- chips).
function effectLabelShort(key: string): string {
  switch (key) {
    case "damage": return "DMG";
    case "recoil": return "recoil";
    case "spread": return "hipfire";
    case "adsSpread": return "ADS spread";
    case "adsTime": return "ADS time";
    case "magSize": return "mag";
    case "reloadTime": return "reload";
    case "moveSpeed": return "mobility";
    case "range": return "range";
    default: return key;
  }
}

// Determine whether an attachment stat bonus is BENEFICIAL for the player.
// For stats where LOWER is better (recoil, ADS time, spread, ADS spread,
// reload time), a negative bonus (reduction) is GOOD and should be shown in
// green. For stats where HIGHER is better (damage, fireRate, magSize, range,
// moveSpeed, headshotMult), a positive bonus is GOOD. Zero is treated as
// neutral/good so a 0% bonus doesn't show as red.
const LOWER_IS_BETTER_STATS = new Set([
  "recoil", "adsTime", "spread", "adsSpread", "reloadTime",
]);
function isBonusGood(statKey: string, value: number): boolean {
  return LOWER_IS_BETTER_STATS.has(statKey) ? value <= 0 : value >= 0;
}

const PRIMARY_CATEGORIES: WeaponCategory[] = ["assault", "smg", "shotgun", "dmr", "sniper", "lmg"];

const CATEGORY_LABELS: Record<WeaponCategory, string> = {
  assault: "Assault Rifles",
  smg: "SMGs",
  shotgun: "Shotguns",
  dmr: "DMRs",
  sniper: "Sniper Rifles",
  lmg: "LMGs",
  pistol: "Pistols",
  pdw: "PDWs / Compact SMGs",
  launcher: "Launchers",
  melee: "Melee",
};

export function Armory() {
  const { profile, setScreen, refreshProfile, playerKey, setRangeWeaponId } = useGame();
  const enterFiringRange = () => { setRangeWeaponId(null); setScreen("range"); };
  const [presetName, setPresetName] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [editingPreset, setEditingPreset] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const [presetBusy, setPresetBusy] = useState(false);
  const [unconfirmedLoadout, setUnconfirmedLoadout] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<WeaponProgressMap>({});
  const [challenges, setChallenges] = useState<WeaponChallengesMap>({});
  // Currently open customize modal: { weapon, slot }. Null when closed.
  const [customizing, setCustomizing] = useState<{ weapon: WeaponDef; slot: WeaponSlot } | null>(null);
  // Serialize attachment writes. Rapidly clearing several slots must not send
  // concurrent full-map updates built from an obsolete profile snapshot.
  const latestAttachmentMaps = useRef<Record<string, Record<AttachmentSlot, string | null>>>({});
  const level = profile?.level ?? 1;
  const credits = profile?.credits ?? 0;

  // Per-weapon unlock maps (new shape from buildProfileView).
  const attachmentsByWeapon = profile?.unlocks.attachmentsByWeapon ?? {};
  const skinsByWeapon = profile?.unlocks.skinsByWeapon ?? {};
  const ownedWeaponIds = new Set<string>([
    ...WEAPONS.filter((w) => !w.wonder && w.unlockLevel <= level && w.unlockCost === 0).map((w) => w.id),
    ...(profile?.unlocks.weapons ?? []),
    ...(profile?.prestige?.wonderWeapons ?? []),
  ]);

  // Fetch per-weapon progress (kills / headshots) and challenge completion.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/weapon-progress?playerKey=${encodeURIComponent(playerKey)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setProgress(data.progress ?? {});
        setChallenges(data.challenges ?? {});
      } catch {
        // Network errors are non-fatal — UI falls back to 0 progress.
      }
    })();
    return () => { cancelled = true; };
  }, [playerKey, profile?.matchesPlayed]);

  const purchase = async (
    kind: "weapon" | "attachment" | "playerSkin" | "weaponSkin" | "wonderWeapon",
    itemId: string,
    cost: number,
    name: string,
    weaponId?: string,
  ) => {
    setBusy(itemId + (weaponId ? `:${weaponId}` : ""));
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerKey, kind, itemId, weaponId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Purchase failed");
      } else {
        toast.success(`Unlocked ${name}!`, { description: kind === "wonderWeapon" ? "1 Wonder entitlement redeemed" : `-${cost} CR` });
        await refreshProfile();
        // Re-fetch weapon progress to refresh challenge completion tiles.
        try {
          const pr = await fetch(`/api/weapon-progress?playerKey=${encodeURIComponent(playerKey)}`);
          if (pr.ok) {
            const d = await pr.json();
            setProgress(d.progress ?? {});
            setChallenges(d.challenges ?? {});
          }
        } catch {}
      }
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(null);
    }
  };

  /** Equip the card weapon immediately; slot matches the section being viewed. */
  const equipWeapon = async (weapon: WeaponDef, slot: WeaponSlot) => {
    if (!profile) return;
    const field = slot === "primary" ? "primaryWeapon" : slot === "secondary" ? "secondaryWeapon" : "meleeWeapon";
    const body: Record<string, string> = { playerKey, [field]: weapon.id };
    // Well Prepared cannot equip the same primary in both slots.
    if (slot === "primary" && profile.loadout.secondary.id === weapon.id) body.secondaryWeapon = "pistol_side";
    setBusy("equip:" + weapon.id);
    try {
      // Weapon switches and attachment edits must share one write order:
      // otherwise a late attachment POST can land on the newly selected gun.
      await enqueueAttachmentSave(async () => {
        const response = await fetch("/api/loadout", { method: "POST",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!response.ok) throw new Error((await response.json()).error || "Could not equip weapon");
        await refreshProfile();
      });
      toast.success(`Equipped ${weapon.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Equip failed");
    } finally { setBusy(null); }
  };

  // Equip an attachment (or unequip by passing null) for the given slot. Saves
  // immediately via /api/loadout. The slot determines which field is updated:
  //   primary  -> attachments
  //   secondary -> secondaryAttachments
  //   melee    -> meleeAttachments (always empty — melee weapons don't take attachments)
  const equipAttachment = async (
    slot: WeaponSlot,
    attSlot: AttachmentSlot,
    attId: string | null,
  ) => {
    if (!profile?.loadout) return;
    const equippedWeaponId = slot === "primary" ? profile.loadout.weapon.id
      : slot === "secondary" ? profile.loadout.secondary.id : profile.loadout.melee.id;
    // Do not apply a different weapon's customizations to the currently held gun.
    if (customizing?.weapon.id !== equippedWeaponId) {
      toast.error("Equip this weapon in your loadout before changing its attachments.");
      return;
    }
    const current = slot === "primary" ? profile.loadout.attachments
      : slot === "secondary" ? profile.loadout.secondaryAttachments
      : profile.loadout.meleeAttachments;
    const key = slot + ":" + equippedWeaponId;
    const next = { ...(latestAttachmentMaps.current[key] ?? current), [attSlot]: attId };
    latestAttachmentMaps.current[key] = next;
    const field = slot === "primary" ? "attachments" : slot === "secondary" ? "secondaryAttachments" : "meleeAttachments";
    const save = async () => {
      const res = await fetch("/api/loadout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerKey, [field]: next }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Equip failed");
      }
      await refreshProfile();
      toast.success(attId ? `Equipped ${ATTACHMENTS.find((a) => a.id === attId)?.name ?? attId}` : "Attachment removed", { duration: 1500 });
    };
    try {
      await enqueueAttachmentSave(save);
    } catch (error) {
      // An unsuccessful update must not become the base for later edits.
      delete latestAttachmentMaps.current[key];
      toast.error(error instanceof Error ? error.message : "Network error");
    }
  };

  // Equip a weapon skin. Skins are PER-WEAPON (like attachments): the skin is
  // applied to the slot of the weapon whose Customize modal is open (primary /
  // secondary / melee). The API stores separate columns for each slot.
  const equipSkin = async (skinId: string) => {
    if (!profile?.loadout || !customizing) return;
    const slot = customizing.slot;
    const field = slot === "secondary" ? "secondaryWeaponSkin"
      : slot === "melee" ? "meleeWeaponSkin"
      : "weaponSkin";
    try {
      const res = await fetch("/api/loadout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerKey, [field]: skinId }),
      });
      if (res.ok) {
        await refreshProfile();
        toast.success(`Equipped ${weaponSkinById(skinId).name} skin`, { duration: 1500 });
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "Equip failed");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const managePreset = async (action: "save" | "rename" | "delete" | "replace", id?: string) => {
    if (presetBusy) return;
    const name = action === "save" ? presetName.trim() : action === "rename" ? editName.trim() : undefined;
    if ((action === "save" || action === "rename") && !name) { toast.error("Enter a loadout name"); return; }
    setPresetBusy(true);
    try {
      const response = await fetch("/api/loadout/presets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerKey, action, id, name }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? "Could not save loadout");
      await refreshProfile();
      setPresetName("");
      setEditingPreset(null);
      setReplaceTargetId(null);
      toast.success(action === "save" ? "Loadout saved to your profile" : action === "rename" ? "Loadout renamed" : action === "replace" ? "Saved loadout replaced with current equipment" : "Loadout deleted");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update loadout"); }
    finally { setPresetBusy(false); }
  };

  const equipPreset = async (id: string) => {
    if (presetBusy) return;
    setPresetBusy(true);
    try {
      const response = await fetch("/api/loadout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerKey, presetId: id }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? "Could not equip loadout");
      await refreshProfile();
      toast.success("Saved loadout equipped");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not equip loadout"); }
    finally { setPresetBusy(false); }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-white/10 bg-black/40 backdrop-blur sticky top-14 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setScreen("menu")} className="text-white/70 hover:text-white hover:bg-white/5">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
          <div className="flex items-center gap-2 ml-2">
            <Crosshair className="w-5 h-5 text-amber-400" />
            <h1 className="text-white font-bold tracking-wider uppercase">Armory</h1>
          </div>
          <div className="ml-auto flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-lg">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="text-amber-300 font-bold tabular-nums">{credits}</span>
            <span className="text-amber-500/60 text-xs">CR</span>
          </div>
          <div className="flex items-center gap-2 border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 rounded-lg">
            <Sparkles className="w-4 h-4 text-violet-300" />
            <span className="text-violet-200 font-bold">{profile?.prestige?.tokens ?? 0}</span>
            <span className="text-violet-300/70 text-xs">Tokens</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        <div className="rounded-xl border border-amber-500/25 bg-gradient-to-r from-amber-500/10 to-zinc-900/70 p-4 mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-white font-bold tracking-wide flex items-center gap-2"><TestTube2 className="w-5 h-5 text-amber-300" /> Firing Range</h2>
          </div>
          <Button onClick={enterFiringRange} className="bg-amber-500 text-black hover:bg-amber-400 font-semibold">
            <Crosshair className="w-4 h-4 mr-1.5" /> Enter Firing Range
          </Button>
        </div>
        {/* Single current-loadout box owns both confirmation and named snapshots. */}
        <div className="mb-6">
          <LoadoutSelector onDirtyChange={setUnconfirmedLoadout} onCustomize={(weapon, slot) => setCustomizing({ weapon, slot })}>
            <details className="mt-5 rounded-xl border border-amber-500/25 bg-black/30 group" aria-label="Saved loadouts">
              <summary className="cursor-pointer select-none p-4 text-amber-200 font-semibold flex items-center gap-2">
                <Save className="w-4 h-4" /> Saved Loadouts
                <span className="text-xs text-white/40 font-normal">({(profile?.savedLoadouts ?? []).length} / 5)</span>
                <ChevronDown className="w-4 h-4 ml-auto group-open:rotate-180 transition-transform" />
              </summary>
              <div className="px-4 pb-4">
                <p className="text-xs text-white/50 mb-3">Saved loadouts preserve weapons, skins, attachments, perks, reticles and charms. Confirm weapon or perk changes above before saving or replacing a slot.</p>
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
              disabled={presetBusy || unconfirmedLoadout || !presetName.trim() || (profile?.savedLoadouts ?? []).length >= 5}
              onClick={() => managePreset("save")}
              className="bg-amber-500 hover:bg-amber-400 text-black"
            ><Save className="w-4 h-4 mr-1.5" /> Save Current</Button>
          </div>
          {(profile?.savedLoadouts ?? []).length === 0 ? (
            <div className="text-sm text-white/40 py-3">No saved loadouts yet. Equip your preferred kit in the Armory, then save it here.</div>
          ) : (
            <div className="space-y-3">
              <select aria-label="Choose saved loadout" value={(profile?.savedLoadouts ?? []).some(p=>p.id===selectedPresetId) ? selectedPresetId : (profile?.savedLoadouts?.[0]?.id ?? "")}
                onChange={e => { setSelectedPresetId(e.target.value); setEditingPreset(null); setReplaceTargetId(null); }}
                className="w-full rounded-lg bg-zinc-900 border border-white/20 p-2 text-white text-sm">
                {(profile?.savedLoadouts ?? []).map(preset => <option key={preset.id} value={preset.id}>{preset.name} · {perkById(preset.perkId).name}</option>)}
              </select>
              {(profile?.savedLoadouts ?? []).filter(p=>p.id===(selectedPresetId && profile?.savedLoadouts?.some(x=>x.id===selectedPresetId) ? selectedPresetId : profile?.savedLoadouts?.[0]?.id)).map(preset => (
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
                  <div className="text-xs text-white/50">{weaponById(preset.primaryWeapon).name} · {weaponById(preset.secondaryWeapon).name} · {weaponById(preset.meleeWeapon).name} · {perkById(preset.perkId).name}</div>
                  <div className="text-xs text-white/40">Reticles: {COSMETICS.find(c=>c.id===preset.primaryReticle)?.name ?? "Classic Cross"} / {COSMETICS.find(c=>c.id===preset.secondaryReticle)?.name ?? "Classic Cross"} · Charms: {COSMETICS.find(c=>c.id===preset.primaryCharm)?.name ?? "No Charm"} / {COSMETICS.find(c=>c.id===preset.secondaryCharm)?.name ?? "No Charm"}</div>
                  {replaceTargetId === preset.id ? (
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 bg-amber-500 hover:bg-amber-400 text-black" disabled={presetBusy || unconfirmedLoadout} onClick={() => void managePreset("replace",preset.id)}>Confirm Replace</Button>
                      <Button size="sm" variant="ghost" onClick={() => setReplaceTargetId(null)}>Cancel</Button>
                    </div>
                  ) : <Button size="sm" variant="outline" className="w-full border-white/20 text-white/80" disabled={presetBusy || unconfirmedLoadout} onClick={() => setReplaceTargetId(preset.id)}>Replace With Current Equipment</Button>}
                  <Button size="sm" variant="outline" disabled={presetBusy} onClick={() => equipPreset(preset.id)}
                    className="w-full border-amber-500/30 text-amber-200 hover:bg-amber-500/10">Equip Loadout</Button>
                </div>
              ))}
            </div>
          )}

              </div>
            </details>
          </LoadoutSelector>
        </div>

        <div id="armory-weapons" />
        <Tabs defaultValue="weapons">
          <TabsList className="bg-zinc-900/60 border border-white/10">
            <TabsTrigger value="weapons" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300 text-white/60"><Zap className="w-4 h-4 mr-1.5" /> Weapons</TabsTrigger>
            <TabsTrigger value="wonders" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-200 text-white/60"><Sparkles className="w-4 h-4 mr-1.5" /> Wonders</TabsTrigger>
            <TabsTrigger value="pskins" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300 text-white/60"><Shirt className="w-4 h-4 mr-1.5" /> Operatives</TabsTrigger>
          </TabsList>

          <TabsContent value="wonders" className="mt-5">
            <div className="mb-4 rounded-lg border border-violet-500/25 bg-violet-500/5 p-4">
              <h3 className="text-violet-200 font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4" /> Prestige Arsenal</h3>
              <p className="mt-1 text-white/60 text-sm">Complete the seven cosmetic challenges to unlock Viridian Blight. Reach Weapon Mastery rank 5/5 to unlock Eventide independently. Completing BOTH earns one Wonder Weapon unlock. Redeem a Wonder unlock entitlement for one permanent Wonder Weapon. Charge-based Wonders recharge over time. Bulwark uses a P-9 magazine and a separate 250 HP shield that restores on respawn.</p>
              <p className="text-xs text-violet-300 mt-2">Prestiged weapons: {profile?.prestige?.masteredWeapons.length ?? 0} · Wonder-qualified weapons: {profile?.prestige?.tokenReadyWeapons.length ?? 0} · Wonder unlocks available: {profile?.prestige?.tokens ?? 0}</p>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {WEAPONS.filter(w => !!w.wonder && !w.disabled).map(w => {
                const owned = profile?.prestige?.wonderWeapons.includes(w.id) ?? false;
                const ready = (profile?.prestige?.tokens ?? 0) > 0;
                return <div key={w.id} className="rounded-xl border border-violet-500/25 bg-black/40 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-violet-100">{w.name}</h3>
                    <Badge variant="outline" className="border-violet-400/40 text-violet-300">Wonder Weapon</Badge>
                  </div>
                  <p className="text-white/60 text-sm">{w.description}</p>
                  <div className="flex gap-3 text-xs font-mono text-violet-300">
                    <span>{w.wonder!.kind === "shield" ? "250 HP shield · P-9 magazine" : w.wonder!.kind === "flame" ? `${w.wonder!.maxCharges}s fuel · full tank required` : `${w.wonder!.maxCharges} max shots`}</span>
                    <span>{w.wonder!.kind === "shield" ? "Hold ADS: frontal cover, P-9 lowered" : `${w.wonder!.rechargeMs / 1000}s per ${w.wonder!.kind === "flame" ? "fuel-second" : "charge"}`}</span>
                    <span>{w.wonder!.kind === "shield" ? "Shield restores on respawn" : `-${w.wonder!.killBonusMs / 1000}s per regular kill`}</span>
                  </div>
                  {owned
                    ? <Button variant="outline" disabled={profile?.loadout.weapon.id === w.id || busy === "equip:" + w.id}
                      onClick={() => equipWeapon(w, "primary")}
                      className="w-full border-violet-400/40 text-violet-200 hover:bg-violet-500/15">
                      {profile?.loadout.weapon.id === w.id ? <><Check className="w-4 h-4 mr-1.5" /> Equipped</> : "Equip as Primary"}
                    </Button>
                    : <Button disabled={!ready || busy === w.id} onClick={() => purchase("wonderWeapon", w.id, 0, w.name)} className="bg-violet-500 hover:bg-violet-400 text-white disabled:opacity-40">
                        <Sparkles className="w-4 h-4 mr-1.5" /> {ready ? "Redeem · 1 Wonder unlock" : "Requires 1 Wonder unlock"}
                      </Button>}
                </div>;
              })}
            </div>
          </TabsContent>

          {/* WEAPONS — organized into 3 collapsible slot sections.
              Within each section, weapons are sorted by unlock level (ascending)
              so the expected unlock order is clear. */}
          <TabsContent value="weapons" className="mt-5">
            <WeaponSlotSection
              slot="primary"
              label="Primary"
              weapons={WEAPONS.filter((w) => !w.wonder && PRIMARY_CATEGORIES.includes(w.category)).sort((a, b) => a.unlockLevel - b.unlockLevel || a.unlockCost - b.unlockCost)}
              level={level}
              credits={credits}
              ownedWeaponIds={ownedWeaponIds}
              attachmentsByWeapon={attachmentsByWeapon}
              skinsByWeapon={skinsByWeapon}
              progress={progress}
              challenges={challenges}
              busy={busy}
              onPurchase={purchase}
              onCustomize={(w) => setCustomizing({ weapon: w, slot: "primary" })}
              onEquip={equipWeapon}
              equippedId={profile?.loadout.weapon.id ?? ""}
              defaultOpen
            />
            <WeaponSlotSection
              slot="secondary"
              label="Secondary"
              weapons={WEAPONS.filter((w) => !w.wonder && ["pistol", "pdw", "launcher"].includes(w.category)).sort((a, b) => a.unlockLevel - b.unlockLevel || a.unlockCost - b.unlockCost)}
              level={level}
              credits={credits}
              ownedWeaponIds={ownedWeaponIds}
              attachmentsByWeapon={attachmentsByWeapon}
              skinsByWeapon={skinsByWeapon}
              progress={progress}
              challenges={challenges}
              busy={busy}
              onPurchase={purchase}
              onCustomize={(w) => setCustomizing({ weapon: w, slot: "secondary" })}
              onEquip={equipWeapon}
              equippedId={profile?.loadout.secondary.id ?? ""}
            />
            <WeaponSlotSection
              slot="melee"
              label="Melee"
              weapons={WEAPONS.filter((w) => w.category === "melee").sort((a, b) => a.unlockLevel - b.unlockLevel || a.unlockCost - b.unlockCost)}
              level={level}
              credits={credits}
              ownedWeaponIds={ownedWeaponIds}
              attachmentsByWeapon={attachmentsByWeapon}
              skinsByWeapon={skinsByWeapon}
              progress={progress}
              challenges={challenges}
              busy={busy}
              onPurchase={purchase}
              onCustomize={(w) => setCustomizing({ weapon: w, slot: "melee" })}
              onEquip={equipWeapon}
              equippedId={profile?.loadout.melee.id ?? ""}
              defaultOpen
            />
          </TabsContent>

          {/* PLAYER SKINS */}
          <TabsContent value="pskins" className="mt-5">
            <OperatorPreview equippedId={profile?.loadout.playerSkin.id??"default"} level={level} ownedIds={profile?.unlocks.playerSkins??[]} />
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {PLAYER_SKINS.map((s) => {
                const isOwned = (profile?.unlocks.playerSkins ?? []).includes(s.id) || (!s.shopCurrency && s.unlockLevel <= level && s.unlockCost === 0);
                const contract = profile?.operatorContracts.find(c => c.rewardId === s.id);
                const challengeReady = s.id === "default" || !!contract?.completed;
                const canBuy = !s.shopCurrency && !isOwned && challengeReady && credits >= s.unlockCost;
                const rarityColor = RARITY_COLORS[s.rarity];
                const equipped = profile?.loadout.playerSkin.id === s.id;
                return (
                  <div key={s.id} className={`relative rounded-xl border bg-zinc-900/60 p-4 flex flex-col items-center overflow-hidden transition-all ${isOwned ? "border-white/10" : "border-white/10 hover:border-white/20"}`}
                    style={s.emissive ? { boxShadow: `inset 0 0 30px ${s.emissive}15` } : {}}>
                    <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: rarityColor, opacity: 0.7 }} />
                    {(isOwned || equipped) && (
                      <div className="absolute top-2 right-2 z-10">
                        {equipped
                          ? <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40"><Check className="w-3 h-3 mr-1" />Equipped</Badge>
                          : <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30"><Check className="w-3 h-3" /></Badge>}
                      </div>
                    )}
                    <div className="w-full h-28 rounded-lg mb-3 relative overflow-hidden flex items-center justify-center" style={{ background: `radial-gradient(circle at 50% 40%, ${s.accent}33, #000)` }}>
                      <div className="w-14 h-20 rounded-t-full relative" style={{ background: s.color, boxShadow: s.emissive ? `0 0 20px ${s.emissive}` : "none" }}>
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full" style={{ background: s.color, boxShadow: s.emissive ? `0 0 12px ${s.emissive}` : "none" }} />
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-9 h-1.5 rounded-full" style={{ background: s.accent }} />
                      </div>
                    </div>
                    <div className="text-white font-bold text-sm">{s.name}</div>
                    <div className="text-[10px] uppercase tracking-wide mb-2 font-semibold" style={{ color: rarityColor }}>{displayLabel(s.rarity)}</div>
                    {!isOwned && contract && (
                      <div className="w-full mb-2">
                        <div className="text-[10px] text-white/60 mb-1">{contract.description}</div>
                        <div className="h-1.5 rounded bg-black/60 overflow-hidden">
                          <div className={contract.completed ? "h-full bg-emerald-500" : "h-full bg-amber-500"}
                            style={{ width: `${Math.min(100, contract.progress / contract.goal * 100)}%` }} />
                        </div>
                        <div className="mt-1 text-[10px] text-white/50">{contract.progress}/{contract.goal} · {contract.completed ? "Available to purchase" : "Contract in progress"}</div>
                      </div>
                    )}
                    {isOwned
                      ? (equipped
                          ? <Badge variant="outline" className="border-amber-500/30 text-amber-300 text-xs">In Use</Badge>
                          : <Button size="sm" onClick={async () => {
                              try {
                                const r = await fetch("/api/loadout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerKey, playerSkin: s.id }) });
                                if (r.ok) { await refreshProfile(); toast.success(`Equipped ${s.name}`); }
                              } catch {}
                            }} className="bg-amber-500/80 hover:bg-amber-400 text-black font-semibold w-full">Equip</Button>)
                      : <Button size="sm" disabled={!canBuy || busy === s.id} onClick={() => purchase("playerSkin", s.id, s.unlockCost, s.name)} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold w-full disabled:opacity-50">
                          {s.shopCurrency ? "Exclusive · Shop" : busy === s.id ? "…" : !challengeReady ? "Locked" : <><Coins className="w-3.5 h-3.5 mr-1" />{s.unlockCost}</>}
                        </Button>}
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Customize modal — opens when the user clicks "Customize" on a weapon card. */}
      <CustomizeModal
        weapon={customizing?.weapon ?? null}
        slot={customizing?.slot ?? null}
        open={!!customizing}
        onOpenChange={(o) => { if (!o) setCustomizing(null); }}
        profile={profile?.loadout ?? null}
        weaponOwned={!!customizing && ownedWeaponIds.has(customizing.weapon.id)}
        level={level}
        credits={credits}
        attachmentsByWeapon={attachmentsByWeapon}
        skinsByWeapon={skinsByWeapon}
        progress={customizing ? (progress[customizing.weapon.id] ?? { weaponId: customizing.weapon.id, kills: 0, headshots: 0 }) : null}
        challengeViews={customizing ? (challenges[customizing.weapon.id] ?? allSkinChallengesForWeapon(customizing.weapon.id).map((c) => {
          const state = weaponChallengeProgress(c, { kills: 0, headshots: 0 });
          return {
            challengeId: c.id, weaponId: c.weaponId, skinId: c.skinId, metric: c.metric,
            goal: state.goal, progress: 0, completed: false,
            requirements: c.requirements ? state.steps : undefined,
            title: c.title, description: c.description,
          };
        })) : []}
        busy={busy}
        prestiged={!!customizing && (profile?.prestige?.masteredWeapons.includes(customizing.weapon.id) ?? false)}
        onPurchase={purchase}
        onEquipAttachment={equipAttachment}
        onEquipSkin={equipSkin}
      />
    </div>
  );
}

// ============================================================================
// Collapsible section for a single WeaponSlot (primary/secondary/melee).
// ============================================================================
interface WeaponSlotSectionProps {
  slot: WeaponSlot;
  label: string;
  weapons: WeaponDef[];
  level: number;
  credits: number;
  ownedWeaponIds: Set<string>;
  attachmentsByWeapon: Record<string, string[]>;
  skinsByWeapon: Record<string, string[]>;
  progress: WeaponProgressMap;
  challenges: WeaponChallengesMap;
  busy: string | null;
  onPurchase: (kind: "weapon" | "attachment" | "playerSkin" | "weaponSkin" | "wonderWeapon", itemId: string, cost: number, name: string, weaponId?: string) => void;
  onCustomize: (w: WeaponDef) => void;
  onEquip: (w: WeaponDef, slot: WeaponSlot) => void;
  equippedId: string;
  defaultOpen?: boolean;
}

function WeaponSlotSection(props: WeaponSlotSectionProps) {
  const { slot, label, weapons, defaultOpen } = props;
  const [open, setOpen] = useState(defaultOpen ?? false);
  const slotIcon = slot === "primary" ? <Zap className="w-4 h-4" /> : slot === "secondary" ? <Crosshair className="w-4 h-4" /> : <Swords className="w-4 h-4" />;
  // Two-level hierarchy: group weapons by category (preserving canonical
  // order per slot), then sort within each group by unlock level + cost.
  const categoryOrder: WeaponCategory[] = slot === "primary"
    ? PRIMARY_CATEGORIES
    : slot === "secondary"
      ? ["pistol", "pdw", "launcher"]
      : ["melee"];
  const groups = categoryOrder
    .map((cat) => ({
      cat,
      weapons: weapons
        .filter((w) => w.category === cat)
        .sort((a, b) => a.unlockLevel - b.unlockLevel || a.unlockCost - b.unlockCost),
    }))
    .filter((g) => g.weapons.length > 0);
  return (
    <div className="mb-5">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="rounded-xl border border-white/10 bg-zinc-900/60 overflow-hidden">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left">
              <span className="text-amber-400">{slotIcon}</span>
              <h2 className="text-white font-bold tracking-wider uppercase text-sm">{label}</h2>
              <Badge variant="outline" className="border-white/15 text-white/60 text-[10px]">{weapons.length} weapon{weapons.length === 1 ? "" : "s"}</Badge>
              <span className="ml-auto text-white/40 text-xs">
                {weapons.filter((w) => props.ownedWeaponIds.has(w.id)).length}/{weapons.length} owned
              </span>
              <span className="text-white/40">
                {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-white/10 p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group) => (
                <WeaponCategoryGroup key={group.cat} group={group} parent={props} />
              ))}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}

/** Expand/collapse each weapon type independently within the Primary slot. */
function WeaponCategoryGroup({ group, parent }: {
  group: { cat: WeaponCategory; weapons: WeaponDef[] };
  parent: WeaponSlotSectionProps;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="col-span-full">
      <CollapsibleTrigger asChild>
        <button type="button" className="w-full flex items-center gap-2 mt-1 rounded-lg px-3 py-3 text-left bg-white/[0.035] hover:bg-white/[0.075] border border-white/10 transition-colors">
          {open ? <ChevronDown className="w-4 h-4 text-amber-300" /> : <ChevronRight className="w-4 h-4 text-white/50" />}
          <span className="text-white/75 text-xs font-bold uppercase tracking-wider">{CATEGORY_LABELS[group.cat]}</span>
          <span className="text-white/35 text-[11px]">({group.weapons.length})</span>
          <span className="text-white/40 text-[10px] ml-auto">{group.weapons.filter(w => parent.ownedWeaponIds.has(w.id)).length} owned</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-3">
          {group.weapons.map(w => <WeaponCard key={w.id} weapon={w} {...parent} />)}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// Weapon card — top section is the always-visible summary (name, stats, buy
// button). The "Customize" button (visible when owned) opens the modal.
// ============================================================================
interface WeaponCardProps extends WeaponSlotSectionProps {
  weapon: WeaponDef;
}

function WeaponCard(props: WeaponCardProps) {
  const { weapon: w, level, credits, ownedWeaponIds, busy, onPurchase, onCustomize, slot, onEquip, equippedId } = props;
  const isOwned = ownedWeaponIds.has(w.id);
  const lockedByLevel = level < w.unlockLevel;
  const canBuy = !isOwned && !lockedByLevel && credits >= w.unlockCost;
  const rarityColor = w.unlockCost >= 3500 ? RARITY_COLORS.legendary : w.unlockCost >= 2000 ? RARITY_COLORS.epic : w.unlockCost >= 800 ? RARITY_COLORS.rare : RARITY_COLORS.common;
  const supportedSlots = weaponAttachmentSlots(w);

  return (
    <div
      className={`relative rounded-xl border bg-zinc-900/60 p-4 flex flex-col overflow-hidden transition-all ${
        isOwned
          ? "border-emerald-500/20 hover:border-emerald-500/40"
          : "border-white/10 hover:border-white/20 opacity-70"
      }`}
    >
      {isOwned ? (
        <div className="absolute top-3 right-3 z-10">
          <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30"><Check className="w-3 h-3 mr-1" />Owned</Badge>
        </div>
      ) : (
        <div className="absolute top-3 right-3 z-10" title="Locked">
          <div className="w-7 h-7 rounded-full bg-black/60 border border-white/15 flex items-center justify-center">
            <Lock className="w-3.5 h-3.5 text-white/60" />
          </div>
        </div>
      )}
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: rarityColor, opacity: 0.6 }} />
      <div className="mb-2 pr-20">
        <div className="text-white font-bold text-base">{w.name}</div>
        <div className="text-white/40 text-xs uppercase tracking-wide">{weaponCategoryLabel(w.category)} · LVL {w.unlockLevel}</div>
      </div>
      <p className="text-white/50 text-xs mb-2 flex-1">{w.description}</p>
      {/* stat bars */}
      <div className="space-y-1.5 mb-3">
        <StatBar label="DMG" value={w.stats.damage} max={120} color="bg-rose-500" />
        <StatBar label="RoF" value={w.stats.fireRate} max={16} color="bg-amber-500" />
        <StatBar label={w.special?.kind === "heat" ? "HEAT" : "MAG"} value={w.stats.magSize} max={100} color="bg-emerald-500" />
        <StatBar label="RNG" value={w.stats.range} max={200} color="bg-emerald-500" />
      </div>
      {/* handling stats */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        <HandlingStat icon={<Wind className="w-3 h-3" />} label="HIP" value={fmtSpread(shotSpread(w.stats, w.category, false, 0, 0, false))} />
        <HandlingStat icon={<Target className="w-3 h-3" />} label="ADS" value={fmtSpread(shotSpread(w.stats, w.category, true, 0, 0, true))} />
        <HandlingStat icon={<TrendingUp className="w-3 h-3" />} label="RECOIL" value={w.stats.recoil.toFixed(1)} />
        <HandlingStat icon={<ZoomIn className="w-3 h-3" />} label="ADS-t" value={`${Math.round(w.stats.adsTime * 1000)}ms`} />
        <HandlingStat icon={<Crosshair className="w-3 h-3" />} label="HS×" value={`${w.stats.headshotMult}×`} />
        <HandlingStat icon={<Zap className="w-3 h-3" />} label="MOVE" value={`${Math.round(w.stats.moveSpeed * 100)}%`} />
      </div>
      {/* Both owned and locked cards reserve the same two action rows. Keeping
          the spacing on the container (rather than only on Equip) aligns Buy,
          Equip, and Customize across adjacent cards regardless of ownership. */}
      <div className="mt-auto flex flex-col gap-2">
        {!isOwned ? (
          <Button disabled={!canBuy || busy === w.id} onClick={() => onPurchase("weapon", w.id, w.unlockCost, w.name)}
            className="h-9 w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold disabled:opacity-50">
            {busy === w.id ? "…" : lockedByLevel ? <><Lock className="w-4 h-4 mr-1.5" />Requires LVL {w.unlockLevel}</> : <><Coins className="w-4 h-4 mr-1.5" />{w.unlockCost} CR</>}
          </Button>
        ) : (
          <Button variant="outline" disabled={equippedId === w.id || busy === "equip:" + w.id}
            onClick={() => onEquip(w, slot)}
            className={`h-9 w-full font-semibold ${equippedId === w.id ? "border-emerald-500/40 text-emerald-300" : "border-amber-400/40 text-amber-300 hover:bg-amber-500/10"}`}>
            {equippedId === w.id ? <><Check className="w-4 h-4 mr-1.5" />Equipped</> : "Equip weapon"}
          </Button>
        )}
        <Button
          onClick={() => onCustomize(w)}
          className="h-9 w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold"
        >
          <Wrench className="w-4 h-4 mr-1.5" /> {w.category === "melee" ? "Skins & Challenges" : isOwned ? "Customize" : "View Customization"}
          {w.category === "melee" && <span className="ml-1.5 text-[10px] opacity-70 normal-case">· 7 skin trials</span>}
          {supportedSlots.length > 0 && (
            <span className="ml-1.5 text-[10px] opacity-70 normal-case">
              · {supportedSlots.length} slot{supportedSlots.length === 1 ? "" : "s"}
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// CustomizeModal — Dialog with Tabs (Attachments / Skins / Challenges).
// Opens when the user clicks "Customize" on a weapon card.
// ============================================================================
interface CustomizeModalProps {
  weapon: WeaponDef | null;
  slot: WeaponSlot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ResolvedLoadout | null;
  weaponOwned: boolean;
  level: number;
  credits: number;
  attachmentsByWeapon: Record<string, string[]>;
  skinsByWeapon: Record<string, string[]>;
  progress: { weaponId: string; kills: number; headshots: number; conditionStats?: Partial<WeaponConditionStats> } | null;
  challengeViews: WeaponChallengeView[];
  prestiged: boolean;
  busy: string | null;
  onPurchase: (kind: "weapon" | "attachment" | "playerSkin" | "weaponSkin" | "wonderWeapon", itemId: string, cost: number, name: string, weaponId?: string) => void;
  onEquipAttachment: (slot: WeaponSlot, attSlot: AttachmentSlot, attId: string | null) => Promise<void>;
  onEquipSkin: (skinId: string) => Promise<void>;
}

function CustomizeModal(props: CustomizeModalProps) {
  const { weapon: w, slot, open, onOpenChange, profile, weaponOwned, level, credits, attachmentsByWeapon, skinsByWeapon, progress, challengeViews, prestiged, busy, onPurchase, onEquipAttachment, onEquipSkin } = props;
  const [tab, setTab] = useState<string>("attachments");
  const {profile: account,playerKey,refreshProfile} = useGame();
  const [cosmeticBusy,setCosmeticBusy]=useState(false);
  async function equipCosmetic(kind:"reticle"|"charm",cosmeticId:string){
    if(!w||!slot||slot==="melee"||cosmeticBusy)return;
    setCosmeticBusy(true);
    try{
      const r=await fetch("/api/profile/cosmetics",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({playerKey,kind,cosmeticId,slot,weaponId:w.id})});
      if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error??"Could not equip cosmetic");
      await refreshProfile();
      toast.success(kind==="reticle"?"Loadout reticle updated":"Loadout charm updated");
    }catch(e){toast.error(e instanceof Error?e.message:"Could not equip cosmetic");}
    finally{setCosmeticBusy(false);}
  }
  const [previewAttachment, setPreviewAttachment] = useState<{ slot: AttachmentSlot; id: string | null } | null>(null);
  const [activeAttachmentSlot, setActiveAttachmentSlot] = useState<AttachmentSlot | null>(null);
  // Track which weapon the modal is currently showing. When the parent passes
  // a different weapon (or re-opens the modal), reset the active tab to
  // "attachments". Using the "adjust state during render" pattern (see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  // avoids the setState-in-effect lint warning and is the React-recommended
  // way to derive state from a changing prop.
  const [prevKey, setPrevKey] = useState<string | null>(null);
  const currentKey = open && w ? `${w.id}:${slot}` : null;
  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    setTab(w?.category === "melee" ? "skins" : "attachments");
    setPreviewAttachment(null);
    setActiveAttachmentSlot(null);
  }

  if (!w || !slot || !profile) {
    return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="bg-zinc-950 border-white/10" /></Dialog>;
  }

  const supportedSlots = weaponAttachmentSlots(w);
  // The weapon's currently-equipped attachments for THIS slot (primary uses
  // loadout.attachments; secondary uses loadout.secondaryAttachments; melee
  // uses loadout.meleeAttachments which is always empty).
  const currentlyEquippedWeapon = slot === "primary" ? profile.weapon.id
    : slot === "secondary" ? profile.secondary.id : profile.melee.id;
  const { canEquip: canEditAttachments, canPurchase: canPurchaseAttachments } = attachmentViewPermissions(w.id, currentlyEquippedWeapon, weaponOwned);
  // Never show the attachment configuration of a different weapon just because
  // it occupies the same primary/secondary slot in the saved loadout.
  const equippedAttsForSlot: Record<AttachmentSlot, string | null> = !canEditAttachments
    ? emptyAttachmentMap()
    : slot === "primary" ? profile.attachments
      : slot === "secondary" ? profile.secondaryAttachments : profile.meleeAttachments;
  const unlockedForWeapon = attachmentsByWeapon[w.id] ?? [];
  const statPreview: AttachmentMap | undefined = previewAttachment ? { ...equippedAttsForSlot, [previewAttachment.slot]: previewAttachment.id } : undefined;
  const currentEffectiveStats = computeEffectiveStats(w, equippedAttsForSlot);
  // Per-weapon equipped skin: read the skin for the slot whose modal is open.
  // Skins are per-weapon (like attachments) — each slot has its own skin.
  const equippedSkinId = slot === "secondary"
    ? (profile.secondaryWeaponSkin?.id ?? "default")
    : slot === "melee"
      ? (profile.meleeWeaponSkin?.id ?? "default")
      : profile.weaponSkin.id;
  const unlockedSkinsForWeapon = new Set(skinsByWeapon[w.id] ?? ["default"]);
  // Previously this was restricted to primary-only, which was confusing:
  // users opened the knife's modal, saw "Unlocked" on a skin, but couldn't
  // find an Equip button.
  const canEquipSkin = canEditAttachments;
  const mastery = weaponMasteryProgress(progress?.kills ?? 0, progress?.headshots ?? 0, w.id);
  const wonderChallenge = wonderUnlockChallenge(w.id,prestiged,progress?.kills ?? 0,progress?.headshots ?? 0);
  const rarityColor = w.unlockCost >= 3500 ? RARITY_COLORS.legendary : w.unlockCost >= 2000 ? RARITY_COLORS.epic : w.unlockCost >= 800 ? RARITY_COLORS.rare : RARITY_COLORS.common;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-white/10 !max-w-[1120px] sm:!max-w-[1120px] w-[min(96vw,1120px)] h-[min(91vh,900px)] max-h-[91vh] flex flex-col gap-3 overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-3 pr-8">
            <div className="w-1 h-12 rounded-full" style={{ background: rarityColor }} />
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-white text-xl">{w.name}</DialogTitle>
              <DialogDescription className="text-white/50">
                {weaponCategoryLabel(w.category).toUpperCase()} · {slot.toUpperCase()} SLOT · LVL {w.unlockLevel}
              </DialogDescription>
            </div>
          </div>
          {/* Stat bars */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
            <ModalStatBar label="DMG" value={currentEffectiveStats.damage} max={120} color="bg-rose-500" />
            <ModalStatBar label="RoF" value={currentEffectiveStats.fireRate} max={16} color="bg-amber-500" />
            <ModalStatBar label={w.special?.kind === "heat" ? "HEAT" : "MAG"} value={currentEffectiveStats.magSize} max={100} color="bg-emerald-500" />
            <ModalStatBar label="RNG" value={currentEffectiveStats.range} max={200} color="bg-emerald-500" />
          </div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => { setTab(v); setPreviewAttachment(null); }} className="flex flex-col flex-1 min-h-0">
          <TabsList className="bg-zinc-900/60 border border-white/10 w-full">
            <TabsTrigger value="attachments" className="flex-1 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300 text-white/60">
              <Wrench className="w-3.5 h-3.5 mr-1.5" /> Attachments
            </TabsTrigger>
            <TabsTrigger value="skins" className="flex-1 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300 text-white/60">
              <Palette className="w-3.5 h-3.5 mr-1.5" /> Skins
            </TabsTrigger>
            <TabsTrigger value="challenges" className="flex-1 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300 text-white/60">
              <Target className="w-3.5 h-3.5 mr-1.5" /> Challenges
            </TabsTrigger>
            {w.category!=="melee" && <TabsTrigger value="reticles" className="flex-1 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300 text-white/60">
              <Crosshair className="w-3.5 h-3.5 mr-1.5" /> Reticles
            </TabsTrigger>}
            {w.category!=="melee" && !w.wonder && <TabsTrigger value="charms" className="flex-1 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300 text-white/60">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Charms
            </TabsTrigger>}
          </TabsList>

          <div className="grid grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,180px)] lg:grid-rows-1 lg:grid-cols-[minmax(0,1fr)_310px] gap-4 min-h-0 flex-1">
          <div className="min-h-0 overflow-y-auto pr-1 lg:pr-2">
          {/* ATTACHMENTS TAB */}
          <TabsContent value="attachments" className="mt-4">
            {!canEditAttachments && (
              <p className="mb-3 text-xs text-white/50">
                Previewing compatible attachments for {w.name}. {weaponOwned ? "Equip the weapon to apply them." : "Purchase the weapon to unlock attachment purchases and equipment changes."}
              </p>
            )}
            {supportedSlots.length === 0 ? (
              <div className="text-white/40 text-sm italic py-6 text-center">
                This weapon does not accept attachments.
              </div>
            ) : (
              <div className="space-y-3">
                {activeAttachmentSlot === null ? (
                  <>
                    <div className="mb-3 text-xs text-white/50 leading-relaxed">Select a slot to browse compatible attachments, challenge progress and prices.</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {supportedSlots.filter(aSlot => compatibleAttachments(w.id, aSlot).length > 0).map((aSlot) => {
                        const equippedId = equippedAttsForSlot[aSlot];
                        const equipped = ATTACHMENTS.find(a => a.id === equippedId);
                        const options = compatibleAttachments(w.id, aSlot).length;
                        return (
                          <button key={aSlot} type="button"
                            onClick={() => { setActiveAttachmentSlot(aSlot); setPreviewAttachment(null); }}
                            className="text-left group rounded-xl border border-white/15 bg-white/[0.035] hover:bg-amber-500/10 hover:border-amber-500/50 focus-visible:outline-2 focus-visible:outline-amber-400 transition-colors p-4 min-h-[110px]"
                          >
                            <div className="flex items-center gap-2 mb-3">
                              <span className="font-bold uppercase tracking-wider text-xs text-amber-300">{aSlot}</span>
                              <span className="text-[10px] text-white/35 ml-auto">{options} options</span>
                              <ChevronRight className="w-4 h-4 text-white/45 group-hover:text-amber-300" />
                            </div>
                            <div className="flex items-center gap-2">
                              {equipped ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <X className="w-4 h-4 text-white/35 shrink-0" />}
                              <span className={`text-sm font-semibold truncate ${equipped ? "text-white" : "text-white/45"}`}>{canEditAttachments ? (equipped?.name ?? "None equipped") : "Browse available options"}</span>
                            </div>
                            <div className="text-[11px] text-white/40 mt-2">{canEditAttachments ? "Click to browse or change" : "Click to inspect attachments"}</div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => { setActiveAttachmentSlot(null); setPreviewAttachment(null); }}
                      className="flex items-center gap-2 rounded-md text-amber-300 hover:text-amber-100 text-xs font-semibold px-2 py-2 hover:bg-white/5">
                      <ArrowLeft className="w-4 h-4" /> All attachment slots
                    </button>
                    <div className="rounded-xl border border-white/10 bg-black/30 p-3 sm:p-4">
                      <ModalAttachmentSlot
                        key={activeAttachmentSlot}
                        attSlot={activeAttachmentSlot}
                        weaponId={w.id}
                        equippedId={equippedAttsForSlot[activeAttachmentSlot]}
                        canEquip={canEditAttachments}
                        canPurchase={canPurchaseAttachments}
                        unlockedForWeapon={unlockedForWeapon}
                        progress={progress}
                        level={level}
                        credits={credits}
                        busy={busy}
                        slot={slot}
                        onPurchase={onPurchase}
                        onPreview={(id) => setPreviewAttachment({ slot: activeAttachmentSlot, id })}
                        onClearPreview={() => setPreviewAttachment(null)}
                        onEquip={(attId) => onEquipAttachment(slot, activeAttachmentSlot, attId)}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </TabsContent>

          {/* SKINS TAB — all standard skins are available on every weapon */}
          <TabsContent value="skins" className="mt-4">
            <div className="grid sm:grid-cols-2 gap-2">
              {WEAPON_SKINS.map((s) => {
                const isUnlocked = unlockedSkinsForWeapon.has(s.id);
                const challenge = challengeViews.find((c) => c.skinId === s.id);
                const isBaseline = s.id === "default";
                const isEquipped = canEquipSkin && equippedSkinId === s.id;
                const rarityColor = RARITY_COLORS[s.rarity];
                const pct = challenge ? Math.min(100, (challenge.progress / challenge.goal) * 100) : isUnlocked ? 100 : 0;
                // Visual state classification for the skin card:
                //   - Owned: unlocked via challenge OR baseline (always available)
                //   - Unlockable: not owned but a challenge exists (player can earn it)
                //   - Hard-locked: not owned with no challenge path (unreachable)
                const isOwned = isUnlocked || isBaseline;
                const isUnlockable = !isOwned && !!challenge;
                const isHardLocked = !isOwned && !challenge;
                const canBuySkin = !isOwned && !!challenge?.completed && credits >= s.unlockCost;
                const skinBusyKey = `${s.id}:${w.id}`;
                return (
                  <div
                    key={s.id}
                    className={`relative rounded-lg border p-2.5 flex flex-wrap sm:flex-nowrap items-center gap-2.5 min-w-0 transition-colors ${
                      isEquipped
                        ? "border-amber-500/50 bg-amber-500/5"
                        : isOwned
                          ? "border-emerald-500/30 bg-black/30"
                          : "border-white/10 bg-black/30"
                    }`}
                    style={s.emissive && isOwned ? { boxShadow: `inset 0 0 16px ${s.emissive}20` } : {}}
                  >
                    {/* Color preview swatch — dimmed to 50% opacity when not owned.
                        Owned skins show a checkmark in the bottom-right corner; locked
                        and unlockable skins show a lock icon overlay instead. */}
                    <div
                      className="w-9 h-9 rounded shrink-0 relative overflow-hidden"
                      style={{
                        background: s.prestige === "cosmic" ? "linear-gradient(110deg,#05071c,#42318e,#060b24,#8eb9ff,#05071c)"
                          : s.prestige === "toxic" ? "linear-gradient(110deg,#021b0a,#57a218,#0c2b16,#b4e12f,#021b0a)"
                          : `linear-gradient(135deg, ${s.color}, ${s.emissive ?? "#000"})`,
                        ...(s.prestige ? { backgroundSize: "300% 300%", animation: "prestige-camo-drift 6s linear infinite" } : {}),
                        boxShadow: s.emissive && isOwned ? `0 0 8px ${s.emissive}` : "none",
                        opacity: isOwned ? 1 : 0.5,
                      }}
                    >
                      {isOwned ? (
                        <div className="absolute bottom-0 right-0 w-3 h-3 rounded-tl bg-emerald-500 flex items-center justify-center">
                          <Check className="w-2 h-2 text-black" />
                        </div>
                      ) : (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Lock className="w-3.5 h-3.5 text-white/80" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 break-words">
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0">
                        <span className="text-white text-xs font-semibold break-words min-w-0">{s.name}</span>
                        <span className="text-[9px] uppercase font-semibold" style={{ color: rarityColor }}>{displayLabel(s.rarity)}</span>
                        
                        {/* Owned badge — small green pill to make ownership status
                            unmistakable. Only shown when owned, not baseline (baseline
                            has its own "Standard issue" label below), and not equipped
                            (equipped status shows in the action slot on the right). */}
                        {isOwned && !isBaseline && !isEquipped && (
                          <span className="text-[8px] uppercase font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded px-1 py-px flex items-center gap-0.5 leading-none">
                            <Check className="w-2 h-2" />Owned
                          </span>
                        )}
                      </div>
                      <div className="text-white/50 text-[11px] leading-snug mt-1">{s.artBrief}</div>
                      {isBaseline ? (
                        <div className="text-white/40 text-[11px]">Standard issue</div>
                      ) : isUnlockable ? (
                        <>
                          {/* "UNLOCK" label above the progress bar — clear callout
                              that this skin is locked-but-earnable via the challenge. */}
                          {!challenge?.completed && <div className="text-amber-400/80 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />Locked
                          </div>}
                          {!challenge!.completed && <div className="mt-1 space-y-1 rounded-md border border-amber-500/20 bg-amber-500/5 px-2.5 py-2">
                            <div className="text-amber-200 text-xs font-semibold">{challenge!.title}</div>
                            <div className="text-amber-100/80 text-[12px] leading-relaxed">{challenge!.description}</div>
                            {challenge!.requirements?.map(step => (
                              <div key={step.metric} className="flex justify-between gap-2 text-[11px] font-mono text-white/65">
                                <span>{step.metric.replaceAll("_", " ")}</span>
                                <span className={step.completed ? "text-emerald-300" : "text-amber-300"}>{step.progress}/{step.goal}</span>
                              </div>
                            ))}
                          </div>}
                          {!challenge!.completed && <div className="mt-1 flex items-center gap-2">
                            <div className="flex-1 h-1 bg-black/60 rounded-full overflow-hidden">
                              <div className={`h-full ${challenge!.completed ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[9px] font-mono tabular-nums text-white/60">
                              {challenge!.progress}/{challenge!.goal} {challenge!.requirements ? "objectives" : challenge!.metric.replaceAll("_", " ")}
                            </span>
                          </div>}
                        </>
                      ) : isHardLocked ? (
                        <div className="text-white/40 text-[10px] italic flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />{s.shopCurrency ? `Exclusive · ${s.shopCurrency === "career" ? "Career Token" : "Credit"} Shop` : s.prestige === "cosmic" ? "Reach Weapon Mastery 5/5 to earn" : s.prestige === "toxic" ? "Complete Weapon Prestige to earn" : "No unlock path"}
                        </div>
                      ) : null}
                    </div>
                    {isEquipped ? (
                      <Badge variant="outline" className="border-amber-500/40 text-amber-300 text-[9px] shrink-0">
                        <Check className="w-2.5 h-2.5 mr-0.5" />Equipped
                      </Badge>
                    ) : isOwned ? (
                      <Button size="sm" disabled={!canEquipSkin} onClick={() => onEquipSkin(s.id)}
                        className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-[10px] h-7 px-2 shrink-0">
                        Equip
                      </Button>
                    ) : !isOwned && !!challenge ? (
                      <Button size="sm" disabled={!canBuySkin || busy === skinBusyKey}
                        onClick={() => onPurchase("weaponSkin", s.id, s.unlockCost, s.name, w.id)}
                        className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-[10px] h-7 px-2 shrink-0 disabled:opacity-50">
                        {busy === skinBusyKey ? "…" : challenge.completed ? <><Coins className="w-3 h-3 mr-1"/>{s.unlockCost}</> : "Locked"}
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* RETICLES TAB — chosen independently per equipped loadout slot. */}
          <TabsContent value="reticles" className="mt-4">
            <p className="text-xs text-white/50 mb-3">Pick the hipfire reticle for this loadout slot. Optic/ADS reticles remain unchanged. Color and size are adjusted in Settings.</p>
            {!canEditAttachments && <p className="text-sm text-amber-300 mb-3">Equip {w.name} in the {slot} slot before customizing it.</p>}
            <div className="grid sm:grid-cols-2 gap-2">
              {COSMETICS.filter(c=>c.kind==="reticle").map(c=>{
                const owned=account?.ownedCosmetics.includes(c.id)??["classic","dot"].includes(c.id);
                const selected=canEditAttachments&&(slot==="primary"?profile.primaryReticle:profile.secondaryReticle)===c.id;
                return <div key={c.id} className={`p-3 rounded-lg border ${selected?"border-amber-400/60 bg-amber-500/10":"border-white/10 bg-black/30"}`}>
                  <div className="flex gap-2 items-center"><span className="text-2xl w-9 text-center" style={{color:c.color}}>{c.symbol}</span>
                    <div className="flex-1 min-w-0"><div className="text-sm text-white font-semibold">{c.name}</div><p className="text-xs text-white/45">{c.description}</p></div></div>
                  <Button size="sm" className="mt-2 w-full" disabled={!canEditAttachments||!owned||selected||cosmeticBusy} onClick={()=>void equipCosmetic("reticle",c.id)}>
                    {selected?"Equipped":owned?"Equip":"Locked · Shop"}
                  </Button>
                </div>;
              })}
            </div>
          </TabsContent>
          {/* CHARMS TAB — permanent account cosmetics, selected per weapon. */}
          <TabsContent value="charms" className="mt-4">
            {!canEditAttachments && <p className="text-sm text-amber-300 mb-3">Equip {w.name} in the {slot} slot before customizing it.</p>}
            <div className="grid sm:grid-cols-2 gap-2">
              {COSMETICS.filter(c=>c.kind==="charm").map(c=>{
                const owned=account?.ownedCosmetics.includes(c.id)??c.id==="none";
                const selected=canEditAttachments&&(slot==="primary"?profile.primaryCharm:profile.secondaryCharm)===c.id;
                return <div key={c.id} className={`p-3 rounded-lg border ${selected?"border-amber-400/60 bg-amber-500/10":"border-white/10 bg-black/30"}`}>
                  <div className="flex gap-2 items-center"><span className="text-2xl w-9 text-center" style={{color:c.color}}>{c.symbol}</span>
                    <div className="flex-1 min-w-0"><div className="text-sm text-white font-semibold">{c.name}</div>
                      <p className="text-xs text-white/45">{c.description}</p></div></div>
                  <Button size="sm" className="mt-2 w-full" disabled={!canEditAttachments||!owned||selected||cosmeticBusy}
                    onClick={()=>void equipCosmetic("charm",c.id)}>
                    {selected?"Equipped":owned?"Equip":"Locked · Shop"}
                  </Button>
                </div>;
              })}
            </div>
          </TabsContent>

          {/* CHALLENGES TAB — per-weapon skin challenges with progress */}
          <TabsContent value="challenges" className="mt-4">
            <div className={`mb-3 rounded-lg border p-3 text-xs ${prestiged ? "border-violet-400/40 bg-violet-500/10" : "border-white/10 bg-black/30"}`}>
              <div className="flex justify-between gap-2 items-center mb-2">
                <span className={prestiged ? "font-bold text-violet-200" : "font-bold text-white/70"}>
                  {prestiged ? "✦ PRESTIGED — Viridian Blight earned" : `Prestige: ${challengeViews.filter(ch => ch.completed).length}/${challengeViews.length} challenges`}
                </span>
                {prestiged ? <Sparkles className="w-4 h-4 text-violet-300" /> : <span className="text-white/40">Reward: Viridian Blight</span>}
              </div>
              <div className="h-1 bg-black/60 rounded overflow-hidden mb-2">
                <div className={prestiged ? "h-full bg-violet-400" : "h-full bg-amber-400"} style={{ width: `${prestiged ? 100 : challengeViews.length ? 100 * challengeViews.filter(ch => ch.completed).length / challengeViews.length : 0}%` }} />
              </div>
              <p className="text-white/50">{prestiged ? "Viridian Blight earned." : "Complete every regular cosmetic challenge to earn Viridian Blight."}</p>
            </div>
            <div className="mb-3 rounded-lg border border-white/10 bg-black/30 p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-amber-300">Weapon Mastery · {mastery.title}</span>
                <span className="text-white/50">Rank {mastery.rank}/5 · Reward: Eventide</span>
              </div>
              <div className="mt-1 text-white/50">
                {progress?.kills ?? 0} kills {w.category === "melee" ? "(melee mastery requires kills only)" : `· ${progress?.headshots ?? 0} headshots`}
                {mastery.next && ` · Next: ${mastery.next.kills} kills (${Math.max(0, mastery.next.kills - (progress?.kills ?? 0))} remaining)${w.category === "melee" ? "" : ` · ${mastery.next.headshots} headshots ${(progress?.headshots ?? 0) >= mastery.next.headshots ? "✓" : `(${mastery.next.headshots - (progress?.headshots ?? 0)} remaining)`}`}`}
              </div>
              
            </div>
            {/* Wonder is a separate challenge, outside the seven Prestige trials. */}
            {!w.wonder && (
              <div className={`mb-3 rounded-lg border p-3 text-xs ${wonderChallenge.completed?"border-emerald-500/40 bg-emerald-500/10":"border-violet-500/30 bg-violet-500/5"}`} aria-label="Wonder Weapon Unlock challenge">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-violet-200 text-sm font-bold flex items-center gap-2"><Sparkles className="w-4 h-4" />{wonderChallenge.title}</span>
                  <span className={wonderChallenge.completed?"text-emerald-300 font-semibold":"text-white/60"}>
                    {wonderChallenge.completed?"✓ Completed":`${wonderChallenge.progress}/${wonderChallenge.goal} objectives`}
                  </span>
                </div>
                <p className="mt-1 text-white/55">Reward: {wonderChallenge.reward}.</p>
                <div className="mt-3 h-1.5 rounded bg-black/50 overflow-hidden">
                  <div className={wonderChallenge.completed?"h-full bg-emerald-400":"h-full bg-violet-400"} style={{width:`${wonderChallenge.progress/wonderChallenge.goal*100}%`}} />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {wonderChallenge.requirements.map(req=>(
                    <div key={req.id} className={`flex items-center justify-between gap-2 rounded-md border p-2 ${req.completed?"border-emerald-500/30 text-emerald-200":"border-white/10 text-white/70"}`}>
                      <span>{req.completed?"✓":"○"} {req.title}</span>
                      <span className="font-mono tabular-nums shrink-0">{req.progress}/{req.goal}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {challengeViews.filter(c => !c.completed).length === 0 ? (
              <div className="text-white/40 text-sm italic py-6 text-center">{challengeViews.length ? "All challenges completed." : "No challenges defined for this weapon."}</div>
            ) : (
              <div className="space-y-2">
                {challengeViews.filter(c => !c.completed).map((c) => {
                  const skin = weaponSkinById(c.skinId);
                  const pct = Math.min(100, (c.progress / c.goal) * 100);
                  const rarityColor = RARITY_COLORS[skin.rarity];
                  return (
                    <div key={c.challengeId} className="rounded-lg border border-white/10 bg-black/30 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 rounded shrink-0" style={{ background: `linear-gradient(135deg, ${skin.color}, ${skin.emissive ?? "#000"})` }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-white text-sm font-semibold">{c.title}</span>
                            
                          </div>
                          <div className="text-amber-100/80 text-[13px] leading-relaxed mt-1">{c.description}</div>
                           {c.requirements && (
                             <div className="mt-1.5 space-y-0.5 text-[10px] text-white/50">
                               {c.requirements.map(step => (
                                 <div key={step.metric} className={step.completed ? "text-emerald-300" : ""}>
                                   {step.completed ? "✓" : "○"} {step.metric.replaceAll("_", " ")}: {step.progress}/{step.goal}
                                 </div>
                               ))}
                             </div>
                           )}
                          <div className="text-white/45 text-[11px] mt-2">Reward: <span className="font-semibold" style={{ color: rarityColor }}>{skin.name} Skin</span></div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-black/60 rounded-full overflow-hidden">
                          <div className={`h-full ${c.completed ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-mono font-semibold tabular-nums text-amber-200">
                          {c.progress}/{c.goal} {c.requirements ? "objectives" : c.metric.replaceAll("_", " ")}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
          </div>
          <aside className="min-h-0 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-4">
            <WeaponStatsPreview weapon={w} equipped={equippedAttsForSlot} preview={statPreview} />
            <p className="mt-5 border-t border-white/10 pt-3 text-[11px] text-white/45 leading-relaxed">Hover, focus or tap Preview on an attachment to compare the weapon's final stats against the currently equipped configuration.</p>
          </aside>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------------------
// Attachment slot row inside the customize modal. Shows compatible attachments
// for this (weapon, slot) pair with equip / buy actions. Locked attachments
// (not yet purchased) show a lock icon + level requirement.
// ----------------------------------------------------------------------------
interface ModalAttachmentSlotProps {
  attSlot: AttachmentSlot;
  weaponId: string;
  equippedId: string | null;
  canEquip: boolean;
  canPurchase: boolean;
  unlockedForWeapon: string[];
  progress: { weaponId: string; kills: number; headshots: number; conditionStats?: Partial<WeaponConditionStats> } | null;
  level: number;
  credits: number;
  busy: string | null;
  slot: WeaponSlot;
  onPurchase: (kind: "weapon" | "attachment" | "playerSkin" | "weaponSkin" | "wonderWeapon", itemId: string, cost: number, name: string, weaponId?: string) => void;
  onEquip: (attId: string | null) => void;
  onPreview: (id: string | null) => void;
  onClearPreview: () => void;
}

function ModalAttachmentSlot({ attSlot, weaponId, equippedId, canEquip, canPurchase, unlockedForWeapon, progress, credits, busy, onPurchase, onEquip, onPreview, onClearPreview }: ModalAttachmentSlotProps) {
  // compatibleAttachments already filters by weaponCategories — so this list
  // contains ONLY attachments that fit this weapon. If empty, the slot is
  // hidden entirely by the parent (AttachmentSlotSection).
  const allowedIds = compatibleAttachments(weaponId, attSlot);
  const attachments = ATTACHMENTS.filter((a) => a.slot === attSlot && allowedIds.includes(a.id));
  if (attachments.length === 0) return null; // hide slots with no compatible attachments

  return (
    <div>
      <div className="text-white/50 text-xs uppercase tracking-wide mb-2 capitalize flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        {attSlot}
        <span className="text-white/30 normal-case ml-1">· {attachments.length} compatible</span>
      </div>
      <div className="space-y-1.5">
        {/* "None" only changes a currently equipped weapon; browsing remains read-only. */}
        {canEquip && <button
          onClick={() => onEquip(null)} onMouseEnter={() => onPreview(null)} onMouseLeave={onClearPreview} onFocus={() => onPreview(null)}
          className={`w-full text-left rounded-lg border px-2.5 py-2 flex items-center gap-2 transition-colors ${
            equippedId === null ? "border-amber-500 bg-amber-500/15 text-amber-300" : "border-white/10 bg-black/30 text-white/60 hover:bg-white/5"
          }`}
        >
          <div className="w-7 h-7 rounded bg-black/40 border border-white/10 flex items-center justify-center shrink-0">
            <X className="w-3.5 h-3.5 text-white/40" />
          </div>
          <span className="text-xs font-semibold">None</span>
          {equippedId === null && <Check className="w-3.5 h-3.5 ml-auto" />}
        </button>}
        {attachments.map((a) => {
          const isOwned = unlockedForWeapon.includes(a.id);
          const ch = attachmentChallenge(weaponId, a.id);
          const chProgress = ch ? armoryChallengeProgress(ch, {
            kills: progress?.kills ?? 0, headshots: progress?.headshots ?? 0,
            conditionStats: progress?.conditionStats,
            matches: 0, wins: 0, totalKills: 0, totalHeadshots: 0,
          }) : null;
          const canBuy = canPurchase && !isOwned && !!chProgress?.completed && credits >= a.unlockCost;
          const showChallenge = showPendingAttachmentChallenge(isOwned, chProgress?.completed);
          const sightInfo = a.sightType ? SIGHT_DEFS[a.sightType] : null;
          const rarityColor = a.unlockCost >= 1600 ? RARITY_COLORS.epic : a.unlockCost >= 800 ? RARITY_COLORS.rare : RARITY_COLORS.common;
          const busyKey = `${a.id}:${weaponId}`;
          const isEquipped = canEquip && equippedId === a.id;
          return (
            <div key={a.id} onMouseEnter={() => onPreview(a.id)} onMouseLeave={onClearPreview} onFocus={() => onPreview(a.id)} className={`relative rounded-lg border px-2.5 py-2 flex items-start gap-2.5 transition-colors ${isEquipped ? "border-amber-500/60 bg-amber-500/10" : isOwned ? "border-white/10 bg-black/30 hover:border-white/20" : "border-white/10 bg-black/30 opacity-80"}`}>
              <div className="absolute top-0 left-0 bottom-0 w-0.5 rounded-l" style={{ background: rarityColor, opacity: 0.7 }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  {sightInfo && <ScanLine className="w-3 h-3 text-cyan-400" />}
                  <span className="text-white text-xs font-semibold truncate">{a.name}</span>
                  {sightInfo && <span className="text-[10px] text-cyan-400/80">{sightInfo.zoom}×</span>}
                </div>
                <div className="text-white/45 text-[11px] mb-1">{a.description}</div>
                <div className="text-[11px] text-white/65 mb-2 flex flex-wrap gap-x-3 gap-y-1">
                  <span>{isOwned ? "Owned for this weapon" : `Price: ${a.unlockCost} CR`}</span>
                  {!canPurchase && !isOwned && <span className="text-amber-300/80">Weapon purchase required</span>}
                </div>
                {showChallenge && chProgress && (
                  <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2 text-[12px] text-amber-100/80 mb-2 leading-relaxed">
                    <div className="text-[10px] font-bold uppercase tracking-wide mb-1 text-amber-300">Locked · Challenge</div>
                    {chProgress.description}
                    <span className="block mt-1 font-mono text-amber-200 font-bold">{chProgress.progress}/{chProgress.goal} {chProgress.metric.replaceAll("_", " ")}</span>
                    
                  </div>
                )}
                <div className="flex flex-wrap gap-1">
                  {Object.entries(a.effects).map(([k, v]) => (
                    <span key={k} className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${isBonusGood(k, v!) ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20" : "bg-rose-500/15 text-rose-300 border border-rose-500/20"}`}>
                      {v! > 0 ? "+" : ""}{v}% {effectLabelShort(k)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {isEquipped ? (
                  <Button size="sm" variant="outline" disabled={!canEquip} onClick={() => onEquip(null)}
                    className="border-amber-500/40 text-amber-300 text-[10px] h-7 px-2">Unequip</Button>
                ) : isOwned ? (
                  <Button
                    size="sm"
                    onClick={() => onEquip(a.id)}
                    disabled={!canEquip}
                    className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-[10px] h-7 px-2"
                  >
                    Equip
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={!canBuy || busy === busyKey}
                    onClick={() => onPurchase("attachment", a.id, a.unlockCost, a.name, weaponId)}
                    className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-[10px] h-7 px-2 disabled:opacity-50"
                  >
                    {busy === busyKey ? "…" : !canPurchase ? "Weapon required" : !chProgress?.completed ? <><Lock className="w-3 h-3 mr-0.5" />Locked</> : <><Coins className="w-3 h-3 mr-0.5" />{a.unlockCost}</>}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-white/40 text-[10px] font-mono w-8 uppercase">{label}</span>
      <div className="flex-1 h-1.5 bg-black/60 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-white/60 text-[10px] font-mono tabular-nums w-9 text-right">{formatWeaponNumber(value)}</span>
    </div>
  );
}

function ModalStatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-white/40 text-[10px] font-mono uppercase">{label}</span>
        <span className="text-white/80 text-xs font-mono tabular-nums">{formatWeaponNumber(value)}</span>
      </div>
      <div className="h-1 bg-black/60 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Format a spread value (radians) as a compact "accuracy" percentage — lower spread = higher accuracy.
function fmtSpread(rad: number): string {
  if (rad <= 0) return "100%";
  const acc = Math.max(0, Math.round((1 - rad / 0.09) * 100));
  return `${acc}%`;
}

// Compact handling stat tile.
function HandlingStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/40 px-1.5 py-1 flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-1 text-white/40">
        {icon}
        <span className="text-[9px] font-mono uppercase tracking-wide">{label}</span>
      </div>
      <span className="text-white/80 text-[11px] font-mono font-semibold tabular-nums">{value}</span>
    </div>
  );
}
