"use client";
import type { HudState } from "@/lib/fps-engine";

/** North-up tactical radar: allies persist, enemy positions track movement only while nearby gunfire reveals them. */
export function Minimap({ radar, compact }: { radar: NonNullable<HudState["radar"]>; compact?: boolean }) {
  const clamp = (n: number) => Math.max(2, Math.min(98, n));
  const selfX = clamp(50 + 50 * radar.playerX / Math.max(1, radar.size));
  const selfZ = clamp(50 + 50 * radar.playerZ / Math.max(1, radar.size));
  const heading = 180 - radar.yaw * (180 / Math.PI);
  return (
    <div className={`absolute top-14 right-4 overflow-hidden rounded-xl border border-white/25 bg-zinc-950/90 backdrop-blur-md shadow-xl ${compact ? "w-32 h-32" : "w-44 h-44"}`}
      aria-label="Minimap">
      <svg viewBox="0 0 100 100" className="w-full h-full" role="img" aria-label="Minimap: green allies, red temporarily tracked enemies revealed by gunfire, yellow player">
        <rect x="1" y="1" width="98" height="98" rx="3" fill="#101923" stroke="#64748b" strokeWidth="1" />
        {[20, 40, 60, 80].map(v => <g key={v} stroke="#475569" strokeOpacity="0.35" strokeWidth="0.55"><path d={`M${v} 0 V100 M0 ${v} H100`} /></g>)}
        {radar.regions?.map((r,i)=><rect key={i} x={r.x} y={r.z} width={r.w} height={r.h}
          fill="#155e50" fillOpacity="0.24" stroke="#2dd4bf" strokeOpacity=".48" strokeWidth=".45"/>)}
        {radar.cover.map((wall, i) => <rect key={i} x={wall.x} y={wall.z} width={wall.w} height={wall.h} rx="0.6" fill="#64748b" fillOpacity="0.42" stroke="#94a3b8" strokeOpacity="0.36" strokeWidth="0.3" />)}
        {radar.markers.map(marker => marker.kind === "ally" ? (
          <circle key={marker.id} cx={clamp(marker.x)} cy={clamp(marker.z)} r="2.7" fill="#34d399" stroke="#064e3b" strokeWidth="0.9" />
        ) : (
          <g key={marker.id}>
            <circle cx={clamp(marker.x)} cy={clamp(marker.z)} r="5" fill="#fb7185" fillOpacity="0.2" stroke="#fb7185" strokeWidth="0.8" />
            <circle cx={clamp(marker.x)} cy={clamp(marker.z)} r="2.2" fill="#fb7185" />
          </g>
        ))}
        <g transform={`translate(${selfX} ${selfZ}) rotate(${heading})`}>
          <path d="M0,-5 L3.6,4 L0,1.7 L-3.6,4 Z" fill="#fde68a" stroke="#111827" strokeWidth="0.8" />
        </g>
        <text x="50" y="8" textAnchor="middle" fontSize="5.5" fill="#cbd5e1" fontWeight="bold">N</text>
      </svg>
      <div className="absolute bottom-1 left-1.5 text-[8px] font-semibold tracking-widest text-white/65">RADAR</div>
    </div>
  );
}
