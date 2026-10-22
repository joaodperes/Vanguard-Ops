"use client";
import { computeEffectiveStats, sightDefForAttachments, type AttachmentSlot, type WeaponDef, type WeaponStats } from "@/lib/game-data";

export type AttachmentMap = Record<AttachmentSlot, string | null>;
export const EMPTY_ATTACHMENTS: AttachmentMap = { sight: null, barrel: null, grip: null, magazine: null };

const STAT_DEFS: { key: keyof WeaponStats; label: string; unit: string; max: number; decimals: number; lowerBetter?: boolean }[] = [
  { key: "damage", label: "Damage", unit: "", max: 180, decimals: 0 },
  { key: "fireRate", label: "Rate / sec", unit: "", max: 18, decimals: 1 },
  { key: "magSize", label: "Magazine", unit: "", max: 100, decimals: 0 },
  { key: "range", label: "Range", unit: "m", max: 200, decimals: 0 },
  { key: "recoil", label: "Recoil", unit: "", max: 3, decimals: 2, lowerBetter: true },
  { key: "spread", label: "Hip spread", unit: "", max: 0.08, decimals: 3, lowerBetter: true },
  { key: "adsSpread", label: "ADS spread", unit: "", max: 0.05, decimals: 3, lowerBetter: true },
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
  const hasPreview = !!preview && (currentSight.type !== shownSight.type || STAT_DEFS.some(s => current[s.key] !== displayed[s.key]));
  const baseline = computeEffectiveStats(weapon, EMPTY_ATTACHMENTS);
  const rows = STAT_DEFS;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-widest font-bold text-amber-300">{hasPreview ? "Attachment preview" : "Final weapon stats"}</span>
        <span className="text-[10px] text-white/40">{hasPreview ? "Compared to equipped" : "Including attachments"}</span>
      </div>
      <div className="flex items-center justify-between gap-2 rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-[11px]">
        <span className="text-white/55">Optic</span>
        <span className="text-white font-mono">{shownSight.name} · {shownSight.zoom}×</span>
      </div>
      <div className={compact ? "grid grid-cols-2 gap-x-4 gap-y-2" : "grid grid-cols-1 gap-y-2.5"}>
        {rows.map(s => {
          const val = displayed[s.key] as number;
          const previous = (hasPreview ? current[s.key] : baseline[s.key]) as number;
          const change = val - previous;
          const isGood = s.lowerBetter ? change < 0 : change > 0;
          const difference = Math.abs(change) > 0.000001;
          const fmt = (n: number) => n.toFixed(s.decimals);
          const pct = Math.min(100, Math.max(0, val / s.max * 100));
          const delta = previous !== 0 ? Math.round(Math.abs(change / previous * 100)) : 0;
          return <div key={s.key} className="min-w-0">
            <div className="flex justify-between gap-2 items-baseline text-[11px]">
              <span className="text-white/55">{s.label}</span>
              <span className="tabular-nums font-mono whitespace-nowrap">
                <span className="text-white font-semibold">{fmt(val)}{s.unit}</span>
                {difference && <span className={`ml-1 ${isGood ? "text-emerald-300" : "text-rose-300"}`}>
                  {isGood ? "▲" : "▼"} {delta ? `${delta}%` : fmt(Math.abs(change))}
                </span>}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 mt-1 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-150 ${difference ? isGood ? "bg-emerald-400" : "bg-rose-400" : "bg-amber-400/70"}`} style={{ width: `${pct}%` }} />
            </div>
          </div>;
        })}
      </div>
      {!compact && <p className="text-[10px] text-white/35 leading-relaxed">Green indicates an improvement; red indicates a trade-off. Hover or focus an attachment to compare before equipping it.</p>}
    </div>
  );
}
