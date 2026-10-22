"use client";
import { useEffect, useState, useMemo } from "react";
import { useGame } from "@/lib/game-store";
import { PERKS, PERK_STORAGE_KEY, DEFAULT_PERK_ID, perkSelection, perkById, perkUnlocked, type PerkId } from "@/lib/perks";
import { WeaponStatsPreview, EMPTY_ATTACHMENTS, type AttachmentMap } from "./WeaponStatsPreview";
import {
  WEAPONS,
  weaponById,
  isPrimaryWeaponCategory,
  type WeaponCategory, type WeaponSlot, type WeaponDef,
} from "@/lib/game-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Coins, Save, Crosshair, Zap, Swords, ChevronDown, Package } from "lucide-react";
import { toast } from "sonner";

// ============================================================================
// LoadoutSelector — compact weapon-picker used at the top of the Armory.
// Replaces the former standalone Loadout screen (Task 17-B).
//
// Shows the player's currently equipped Primary / Secondary / Melee weapons
// in a 3-card row. Each card has a dropdown to swap between owned weapons for
// that slot. A Save button persists changes via POST /api/loadout.
//
// Skins, attachments, and per-weapon challenges are handled by the per-weapon
// "Customize" modal in the Armory — NOT here. This component only handles
// weapon-slot selection.
// ============================================================================

const PRIMARY_CATEGORIES: WeaponCategory[] = ["assault", "smg", "shotgun", "dmr", "sniper", "lmg"];

interface LoadoutSelectorProps {
  // Optional callback invoked after a successful save. Defaults to refreshing
  // the profile via the game store.
  onSaved?: () => void;
  onCustomize?: (weapon: WeaponDef, slot: WeaponSlot) => void;
  // Optional compact mode (smaller cards). Defaults to false.
  compact?: boolean;
}

export function LoadoutSelector({ onSaved, compact, onCustomize }: LoadoutSelectorProps) {
  const { profile, refreshProfile, playerKey } = useGame();
  const [saving, setSaving] = useState(false);
  const current = profile?.loadout ?? null;
  const level = profile?.level ?? 1;
  const [primary, setPrimary] = useState(current?.weapon.id ?? "rifle_ar");
  const [secondary, setSecondary] = useState(current?.secondary.id ?? "pistol_side");
  const [melee, setMelee] = useState(current?.melee.id ?? "knife_tactical");
  // Which slot's dropdown is currently open. Only one can be open at a time.
  const [openSlot, setOpenSlot] = useState<WeaponSlot | "perk" | null>(null);
  const [perkId, setPerkId] = useState<PerkId>(DEFAULT_PERK_ID);
  const [savedPerk, setSavedPerk] = useState<PerkId>(DEFAULT_PERK_ID);
  useEffect(() => { const selected = perkSelection(level); setPerkId(selected); setSavedPerk(selected); }, [level]);

  // Sync local state when the profile changes (e.g. after a save round-trip).
  // Hook is called unconditionally (before any early return) so React's
  // rules-of-hooks are satisfied.
  useEffect(() => {
    if (current) {
      setPrimary(current.weapon.id);
      setSecondary(current.secondary.id);
      setMelee(current.melee.id);
    }
  }, [current?.weapon.id, current?.secondary.id, current?.melee.id]);

  // Close dropdown when clicking outside. Simple mousedown listener — the
  // dropdown is small enough that a full Popper install isn't warranted.
  // Hook is unconditional (before the early return) per React's rules-of-hooks.
  useEffect(() => {
    if (!openSlot) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-slot-dropdown]")) setOpenSlot(null);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [openSlot]);

  // Owned weapons: free-by-level + purchased. Computed unconditionally so the
  // hook order is stable; the early return below handles the missing-profile
  // case (renders a loading placeholder).
  const ownedWeaponIds = useMemo(() => new Set<string>([
    ...WEAPONS.filter((w) => !w.wonder && w.unlockLevel <= level && w.unlockCost === 0).map((w) => w.id),
    ...(profile?.unlocks.weapons ?? []),
    ...(profile?.prestige?.wonderWeapons ?? []),
  ]), [level, profile?.unlocks.weapons, profile?.prestige?.wonderWeapons]);

  if (!profile || !current) {
    return <div className="text-white/60 text-sm">Loading loadout…</div>;
  }

  const ownedForSlot = (slot: WeaponSlot): WeaponDef[] => {
    if (slot === "primary") return WEAPONS.filter((w) => PRIMARY_CATEGORIES.includes(w.category));
    if (slot === "secondary") return WEAPONS.filter((w) =>
      w.category === "sidearm" || (perkId === "well_prepared" &&
        isPrimaryWeaponCategory(w.category) && !w.wonder && w.id !== primary));
    return WEAPONS.filter((w) => w.category === "melee");
  };

  // Has the user made unsaved changes?
  const dirty = current && (
    primary !== current.weapon.id ||
    secondary !== current.secondary.id ||
    melee !== current.melee.id ||
    perkId !== savedPerk
  );

  const save = async () => {
    if (!perkUnlocked(perkId, level)) { toast.error(`Unlock this perk at level ${perkById(perkId).unlockLevel}`); return; }
    setSaving(true);
    // Perks are account-agnostic, free passive choices persisted locally.
    const saveLocalPerk = () => {
      try { localStorage.setItem(PERK_STORAGE_KEY, perkId); } catch {}
      setSavedPerk(perkId);
    };
    const validSecondary = perkId === "well_prepared" || !isPrimaryWeaponCategory(weaponById(secondary).category);
    const savedSecondary = validSecondary && secondary !== primary ? secondary : "pistol_side";
    if (primary === current?.weapon.id && savedSecondary === current?.secondary.id && melee === current?.melee.id) {
      saveLocalPerk();
      toast.success("Perk equipped");
      setSaving(false);
      onSaved?.();
      return;
    }
    try {
      const res = await fetch("/api/loadout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerKey,
          primaryWeapon: primary,
          secondaryWeapon: savedSecondary,
          perkId,
          meleeWeapon: melee,
        }),
      });
      if (res.ok) {
        saveLocalPerk();
        toast.success("Loadout saved");
        await refreshProfile();
        onSaved?.();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Save failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/60 to-black/40 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-amber-400" />
          <h2 className="text-white font-bold tracking-wider uppercase text-sm">Current Loadout</h2>
          <span className="text-white/40 text-xs hidden sm:inline">
            Pick your Primary, Secondary, and Melee weapons. Customize attachments &amp; skins per weapon below.
          </span>
        </div>
        <Button
          onClick={save}
          disabled={saving || !dirty}
          className="bg-amber-500 hover:bg-amber-400 text-black font-semibold disabled:opacity-50"
          size="sm"
        >
          <Save className="w-3.5 h-3.5 mr-1.5" /> {saving ? "Saving…" : "Save Loadout"}
        </Button>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <SlotCard
          slot="primary"
          label="Primary"
          icon={<Zap className="w-4 h-4 text-amber-400" />}
          weapon={weaponById(primary)}
          ownedWeaponIds={ownedWeaponIds}
          ownedForSlot={ownedForSlot}
          open={openSlot === "primary"}
          onToggle={() => setOpenSlot(openSlot === "primary" ? null : "primary")}
          onSelect={(id) => { setPrimary(id); if (id === secondary) setSecondary("pistol_side"); setOpenSlot(null); }}
          compact={compact}

          attachments={primary === current.weapon.id ? current.attachments : EMPTY_ATTACHMENTS}
          onCustomize={onCustomize ? () => onCustomize(weaponById(primary), "primary") : undefined}
          canCustomize={primary === current.weapon.id}
        />
        <SlotCard
          slot="secondary"
          label={perkId === "well_prepared" ? "Secondary / Primary" : "Secondary"}
          icon={<Crosshair className="w-4 h-4 text-amber-400" />}
          weapon={weaponById(perkId !== "well_prepared" && isPrimaryWeaponCategory(weaponById(secondary).category) ? "pistol_side" : secondary)}
          ownedWeaponIds={ownedWeaponIds}
          ownedForSlot={ownedForSlot}
          open={openSlot === "secondary"}
          onToggle={() => setOpenSlot(openSlot === "secondary" ? null : "secondary")}
          onSelect={(id) => { setSecondary(id); setOpenSlot(null); }}
          compact={compact}

          attachments={secondary === current.secondary.id ? current.secondaryAttachments : EMPTY_ATTACHMENTS}
          onCustomize={onCustomize ? () => onCustomize(weaponById(secondary), "secondary") : undefined}
          canCustomize={secondary === current.secondary.id && (perkId === "well_prepared" || !isPrimaryWeaponCategory(weaponById(secondary).category))}
        />
        <SlotCard
          slot="melee"
          label="Melee"
          icon={<Swords className="w-4 h-4 text-amber-400" />}
          weapon={weaponById(melee)}
          ownedWeaponIds={ownedWeaponIds}
          ownedForSlot={ownedForSlot}
          open={openSlot === "melee"}
          onToggle={() => setOpenSlot(openSlot === "melee" ? null : "melee")}
          onSelect={(id) => { setMelee(id); setOpenSlot(null); }}
          compact={compact}

          attachments={melee === current.melee.id ? current.meleeAttachments : EMPTY_ATTACHMENTS}
          onCustomize={onCustomize ? () => onCustomize(weaponById(melee), "melee") : undefined}
          canCustomize={melee === current.melee.id}
        />
        <div className="relative" data-slot-dropdown>
          <div className={`rounded-xl border border-white/10 bg-black/40 overflow-hidden ${compact ? "p-2.5" : "p-3"}`}>
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-amber-400" />
              <span className="text-white/70 text-xs uppercase tracking-widest font-semibold">Passive Perk</span>
              <Badge variant="outline" className="ml-auto border-white/15 text-white/50 text-[10px]">Always active</Badge>
            </div>
            <div className={`relative ${compact ? "h-12" : "h-16"} rounded-lg mb-2 overflow-hidden flex items-center justify-center bg-gradient-to-br from-zinc-800 to-black`}>
              <Zap className="w-7 h-7 text-amber-400/70" />
              <span className="absolute left-2 top-1.5 text-[10px] uppercase tracking-wider text-white/40">Specialization</span>
            </div>
            <div className="text-white font-bold text-sm truncate mb-1">{perkById(perkId).name}</div>
            <div className="text-white/40 text-[10px] mb-2 min-h-7 leading-snug line-clamp-2">{perkById(perkId).description}</div>
            <button type="button" onClick={() => setOpenSlot(openSlot === "perk" ? null : "perk")}
              className="w-full px-2.5 py-1.5 rounded-md border border-white/10 bg-black/40 hover:bg-white/5 text-white/80 text-xs flex items-center justify-center gap-1.5 transition-colors">
              <Check className="w-3 h-3 text-emerald-400" /> Swap Perk
              <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${openSlot === "perk" ? "rotate-180" : ""}`} />
            </button>
          </div>
          {openSlot === "perk" && (
            <div className="absolute z-40 left-0 right-0 mt-1 rounded-lg border border-white/15 bg-zinc-900/95 backdrop-blur shadow-2xl max-h-72 overflow-y-auto">
              {PERKS.map(perk => <button key={perk.id} type="button" disabled={level < perk.unlockLevel} onClick={() => {
                  setPerkId(perk.id);
                  if (perk.id !== "well_prepared" && isPrimaryWeaponCategory(weaponById(secondary).category)) setSecondary("pistol_side");
                  setOpenSlot(null);
                }}
                className={`w-full text-left px-3 py-2.5 text-xs flex flex-col gap-1 ${level < perk.unlockLevel ? "opacity-45 cursor-not-allowed" : "hover:bg-white/5"} ${perkId === perk.id ? "bg-amber-500/15 text-amber-300" : "text-white/80"}`}>
                <span className="font-semibold flex items-center justify-between gap-2">{perk.name}<span className={level >= perk.unlockLevel ? "text-emerald-300 text-[10px]" : "text-amber-300 text-[10px]"}>{perk.unlockLevel === 1 ? "Default" : `LVL ${perk.unlockLevel}`}</span></span>
                <span className="text-white/40 leading-relaxed">{perk.description}</span>
              </button>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Single slot card — shows the equipped weapon + a dropdown to swap.
// ----------------------------------------------------------------------------
interface SlotCardProps {
  slot: WeaponSlot;
  label: string;
  icon: React.ReactNode;
  weapon: WeaponDef;
  ownedWeaponIds: Set<string>;
  ownedForSlot: (slot: WeaponSlot) => WeaponDef[];
  open: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  compact?: boolean;
  attachments: AttachmentMap;
  onCustomize?: () => void;
  canCustomize?: boolean;
}

function SlotCard({ slot, label, icon, weapon, ownedWeaponIds, ownedForSlot, open, onToggle, onSelect, compact, attachments, onCustomize, canCustomize }: SlotCardProps) {
  const skinColor = "#2b2f36"; // fallback — actual skin color comes from the equipped weaponSkinId (handled in modal)
  const candidates = ownedForSlot(slot).slice().sort((a, b) => a.unlockLevel - b.unlockLevel || a.name.localeCompare(b.name));
  const ownedCount = candidates.filter((w) => ownedWeaponIds.has(w.id)).length;
  return (
    <div className="relative" data-slot-dropdown>
      <div className={`rounded-xl border border-white/10 bg-black/40 overflow-hidden ${compact ? "p-2.5" : "p-3"}`}>
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-white/70 text-xs uppercase tracking-widest font-semibold">{label}</span>
          <Badge variant="outline" className="ml-auto border-white/15 text-white/50 text-[10px]">
            {ownedCount} owned
          </Badge>
        </div>
        {/* weapon preview strip */}
        <div className={`relative ${compact ? "h-12" : "h-16"} rounded-lg mb-2 overflow-hidden flex items-center justify-center`}
          style={{ background: `linear-gradient(135deg, ${skinColor}, #0a0a0a)` }}>
          <div className="absolute left-2 top-1.5 text-[10px] uppercase tracking-wider text-white/40">{weapon.category}</div>
          <div className="w-24 h-2 rounded-sm" style={{ background: skinColor }} />
          <div className="absolute bottom-1.5 left-2 text-[10px] text-white/60 font-mono">
            DMG {weapon.stats.damage} · RoF {weapon.stats.fireRate}
          </div>
        </div>
        <div className="flex items-center justify-between mb-1">
          <div className="text-white font-bold text-sm truncate">{weapon.name}</div>
        </div>
        <div className="text-white/40 text-[10px] uppercase mb-2">{weapon.category} · LVL {weapon.unlockLevel}</div>
        <div className="rounded-md bg-zinc-950/60 border border-white/5 px-2 py-2 mb-3">
          <WeaponStatsPreview weapon={weapon} equipped={attachments} compact />
        </div>
        {canCustomize && onCustomize && (
          <button type="button" onClick={onCustomize}
            className="w-full mb-2 px-2.5 py-1.5 rounded-md border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 text-xs font-semibold">
            Customize this slot
          </button>
        )}
        <button
          onClick={onToggle}
          className="w-full px-2.5 py-1.5 rounded-md border border-white/10 bg-black/40 hover:bg-white/5 text-white/80 text-xs flex items-center justify-center gap-1.5 transition-colors"
        >
          <Check className="w-3 h-3 text-emerald-400" />
          Swap {label}
          <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {/* Dropdown list of owned weapons for this slot */}
      {open && (
        <div className="absolute z-40 left-0 right-0 mt-1 rounded-lg border border-white/15 bg-zinc-900/95 backdrop-blur shadow-2xl max-h-72 overflow-y-auto">
          {candidates.map((w) => {
            const isOwned = ownedWeaponIds.has(w.id);
            const selected = w.id === weapon.id;
            return (
              <button
                key={w.id}
                disabled={!isOwned}
                onClick={() => onSelect(w.id)}
                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                  selected ? "bg-amber-500/15 text-amber-300" : isOwned ? "text-white/80 hover:bg-white/5" : "text-white/30 cursor-not-allowed"
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {selected && <Check className="w-3 h-3 shrink-0" />}
                  <span className="font-semibold truncate">{w.name}</span>
                  <span className="text-white/40 text-[10px] uppercase shrink-0">{w.category}</span>
                </span>
                {!isOwned && (
                  <span className="text-rose-400/70 text-[10px] shrink-0">LVL {w.unlockLevel}</span>
                )}
                {isOwned && !selected && w.unlockCost > 0 && (
                  <span className="text-amber-300/60 text-[10px] shrink-0 flex items-center gap-0.5">
                    <Coins className="w-2.5 h-2.5" /> {w.unlockCost}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Legacy standalone Loadout screen — REMOVED in Task 17-B.
// The Loadout tab was merged INTO the Armory. The Armory renders <LoadoutSelector/>
// at the top of its weapons tab. The `loadout` screen route was also removed
// from src/app/page.tsx and the main menu navigation.
//
// This file is kept as the home of the LoadoutSelector component (imported by
// Armory.tsx) so the import path `@/components/screens/Loadout` still resolves.
// ----------------------------------------------------------------------------
export default LoadoutSelector;
