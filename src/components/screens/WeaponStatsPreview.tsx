"use client";
import { computeEffectiveStats, effectiveHeatConfig, sightDefForAttachments, type AttachmentSlot, type WeaponDef, type WeaponStats } from "@/lib/game-data";
import { formatSpreadMrad, weaponStatDelta } from "@/lib/weapon-numbers";

export type AttachmentMap = Record<AttachmentSlot, string | null>;
export const EMPTY_ATTACHMENTS: AttachmentMap = { sight: null, barrel: null, grip: null, magazine: null };

const STAT_DEFS: { key: keyof WeaponStats; label: string; unit: string; max: number; decimals: number; lowerBetter?: boolean }[] = [
  { key: "damage", label: "Damage", unit: "", max: 180, decimals: 0 },
  { key: "fireRate", label: "Rate / sec", unit: "", max: 18, decimals: 1 },
  { key: "magSize", label: "Magazine", unit: "", max: 100, decimals: 0 },
  { key: "range", label: "Range", unit: "m", max: 200, decimals: 0 },
  { key: "coverPenetration", label: "Bullet Penetration", unit: "", max: 6, decimals: 1 },
  { key: "recoil", label: "Recoil", unit: "", max: 3, decimals: 2, lowerBetter: true },
  { key: "spread", label: "Hip spread", unit: "", max: 0.08, decimals: 1, lowerBetter: true },
  { key: "adsSpread", label: "ADS spread", unit: "", max: 0.05, decimals: 1, lowerBetter: true },
  { key: "adsTime", label: "ADS time", unit: "s", max: 0.8, decimals: 2, lowerBetter: true },
  { key: "reloadTime", label: "Reload", unit: "s", max: 5, decimals: 2, lowerBetter: true },
  { key: "moveSpeed", label: "Mobility", unit: "×", max: 1.5, decimals: 2 },
];

export function WeaponStatsPreview({ weapon, equipped, preview, compact = false }: {
  weapon: WeaponDef;
  equipped?: AttachmentMap;
  preview?: AttachmentMap;
  compact?: boolean;
}) {
  const current = computeEffectiveStats(weapon, equipped ?? EMPTY_ATTACHMENTS);
  const displayed = preview ? computeEffectiveStats(weapon, preview) : current;
  const currentSight = sightDefForAttachments(equipped ?? EMPTY_ATTACHMENTS, weapon.baseSightType);
  const shownSight = sightDefForAttachments(preview ?? equipped ?? EMPTY_ATTACHMENTS, weapon.baseSightType);
  const currentHeat = effectiveHeatConfig(weapon,equipped ?? EMPTY_ATTACHMENTS);
  const shownHeat = effectiveHeatConfig(weapon,preview ?? equipped ?? EMPTY_ATTACHMENTS);
  const hasPreview = !!preview && (
    currentSight.type !== shownSight.type ||
    STAT_DEFS.some(s => current[s.key] !== displayed[s.key]) ||
    current.bodyPenetration?.maxTargets !== displayed.bodyPenetration?.maxTargets ||
    current.bodyPenetration?.damageRetention !== displayed.bodyPenetration?.damageRetention ||
    currentHeat?.heatPerShot !== shownHeat?.heatPerShot ||
    currentHeat?.coolPerSecond !== shownHeat?.coolPerSecond ||
    currentHeat?.ventSeconds !== shownHeat?.ventSeconds
  );
  const baseline = computeEffectiveStats(weapon, EMPTY_ATTACHMENTS);
  // Melee has no magazine, reload, recoil or aiming optics. Keep only relevant stats.
  const rows = weapon.category === "melee" ? STAT_DEFS.filter(s => ["damage", "fireRate", "range", "moveSpeed"].includes(s.key)) :
    shownHeat ? STAT_DEFS.filter(s => !["magSize","reloadTime"].includes(s.key)) : STAT_DEFS;
  return (
    <div className="space-y-2">
      {!compact && <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-widest font-bold text-amber-300">{hasPreview ? "Attachment preview" : "Final weapon stats"}</span>
        <span className="text-[10px] text-white/40">{hasPreview ? "Compared to equipped" : "Including attachments"}</span>
      </div>}
      {!compact && weapon.category !== "melee" && <div className="flex items-center justify-between gap-2 rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-[11px]">
        <span className="text-white/55">Optic</span>
        <span className="text-white font-mono">{shownSight.name} · {shownSight.zoom}×</span>
      </div>}
      {shownHeat && <div className="rounded-md border border-cyan-500/20 bg-cyan-500/5 p-2 text-[11px] space-y-1">
        <div className="text-cyan-200 font-semibold">Heat system · {Math.ceil(shownHeat.overheatAt/shownHeat.heatPerShot)} pulses from cold</div>
        <div className="text-white/70">Heat / pulse: {shownHeat.heatPerShot.toFixed(1)} · Cooling: {shownHeat.coolPerSecond.toFixed(1)}/s</div>
        <div className="text-white/70">Cooling delay: {(shownHeat.coolDelayMs/1000).toFixed(2)}s · Manual vent: {shownHeat.ventSeconds.toFixed(2)}s</div>
        {hasPreview && currentHeat && <div className="text-white/45">Current: {currentHeat.heatPerShot.toFixed(1)} heat/pulse, {currentHeat.coolPerSecond.toFixed(1)} cooling/s, {currentHeat.ventSeconds.toFixed(2)}s vent</div>}
      </div>}
      <div className={compact ? "flex flex-col gap-1" : "grid grid-cols-1 gap-y-2.5"}>
        {rows.map(s => {
          // PEN is optional for non-ballistic weapons; render 0 for ordinary weapons without it.
          const val = (displayed[s.key] ?? 0) as number;
          const previous = ((hasPreview ? current[s.key] : baseline[s.key]) ?? 0) as number;
          const change = val - previous;
          const { changed: difference, improved: isGood, arrow, percent: delta } = weaponStatDelta(previous, val, s.lowerBetter);
          const fmt = (n: number) => (s.key === "spread" || s.key === "adsSpread") ? formatSpreadMrad(n) : n.toFixed(s.decimals);
          const pct = Math.min(100, Math.max(0, val / s.max * 100));
          const label = (
            <span className="text-white/55 text-[11px] leading-tight" title={s.key === "coverPenetration" ? "Ammunition penetration energy for bodies and soft cover; solid barriers still block shots." : undefined}>
              {weapon.category === "melee" && s.key === "fireRate" ? "Swings / sec" : weapon.category === "melee" && s.key === "range" ? "Reach" : s.label}
            </span>
          );
          const value = (
            <span className="tabular-nums font-mono text-[11px] whitespace-nowrap text-right">
              <span className="text-white font-semibold">{fmt(val)}{s.unit}</span>
              {difference && <span className={`ml-1 ${isGood ? "text-emerald-300" : "text-rose-300"}`}>
                {arrow} {delta ? `${delta}%` : fmt(Math.abs(change))}
              </span>}
            </span>
          );
          const bar = (
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden min-w-0">
              <div className={`h-full rounded-full transition-all duration-150 ${difference ? isGood ? "bg-emerald-400" : "bg-rose-400" : "bg-amber-400/70"}`} style={{ width: `${pct}%` }} />
            </div>
          );
          return (
            <div key={s.key} className="min-w-0">
              {compact ? (
                <div className="grid grid-cols-[112px_minmax(24px,1fr)_86px] items-center gap-x-2 min-h-6">
                  {label}
                  {bar}
                  {value}
                </div>
              ) : (
                <>
                  <div className="flex justify-between gap-2 items-baseline">{label}{value}</div>
                  <div className="mt-1">{bar}</div>
                </>
              )}
            </div>
          );
        })}
      </div>
      {!compact && weapon.category !== "melee" && <p className="text-[10px] text-white/45 leading-relaxed">Lower spread means tighter grouping. These are base weapon values; movement, sustained fire and category-specific accuracy limits affect actual shots.</p>}
      {!compact && <p className="text-[10px] text-white/35 leading-relaxed">Arrows show whether the value increases (▲) or decreases (▼). Green means better performance; red means a trade-off. Hover or focus an attachment to compare before equipping it.</p>}
    </div>
  );
}
