"use client";
import { useEffect } from "react";
import { useGame } from "@/lib/game-store";
import { useSettings, CROSSHAIR_PRESETS } from "@/lib/settings-store";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Sliders, Crosshair, Eye, MousePointer2, Volume2, RotateCcw, Check, ToggleLeft } from "lucide-react";

export function Settings({ embedded = false }: { embedded?: boolean }) {
  const { setScreen } = useGame();
  const { settings, update, reset, load } = useSettings();
  useEffect(() => { load(); }, [load]);

  return (
    <div className={embedded ? "flex flex-col" : "min-h-screen flex flex-col"}>
      {!embedded && <header className="border-b border-white/10 bg-black/40 backdrop-blur sticky top-14 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setScreen("menu")} className="text-white/70 hover:text-white hover:bg-white/5">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
          <div className="flex items-center gap-2 ml-2">
            <Sliders className="w-5 h-5 text-amber-400" />
            <h1 className="text-white font-bold tracking-wider uppercase">Settings</h1>
          </div>
          <Button variant="outline" size="sm" onClick={reset} className="ml-auto border-white/10 text-white/70 hover:text-white hover:bg-white/5">
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset
          </Button>
        </div>
      </header>}

      <main className={embedded ? "w-full space-y-5 py-2" : "flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-5"}>
        {embedded && <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={reset} className="border-white/10 text-white/70 hover:text-white hover:bg-white/5">
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset to Defaults
          </Button>
        </div>}
        {/* Crosshair */}
        <Section icon={<Crosshair className="w-4 h-4" />} title="Crosshair" desc="Global color and size. Equip each weapon’s reticle in Armory → Customize → Reticles.">
          <div className="flex items-center gap-6">
            {/* live preview */}
            <div className="w-32 h-32 rounded-xl bg-gradient-to-br from-zinc-900 to-black border border-white/10 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.04), transparent 60%)" }} />
              <CrosshairPreview color={settings.crosshairColor} size={settings.crosshairSize} shape="classic" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <div className="text-white/60 text-xs uppercase tracking-wider mb-2">Color Presets</div>
                <div className="flex flex-wrap gap-2">
                  {CROSSHAIR_PRESETS.map((p) => (
                    <button
                      key={p.color}
                      onClick={() => update({ crosshairColor: p.color })}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        settings.crosshairColor === p.color ? "border-white/40 bg-white/10 text-white" : "border-white/10 bg-black/30 text-white/60 hover:border-white/25 hover:text-white"
                      }`}
                      style={settings.crosshairColor === p.color ? { boxShadow: `0 0 12px ${p.color}55` } : {}}
                    >
                      <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle" style={{ background: p.color }} />
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-white/50 mb-1">
                  <span>Size</span>
                  <span className="tabular-nums">{settings.crosshairSize}px</span>
                </div>
                <Slider value={[settings.crosshairSize]} min={4} max={14} step={1} onValueChange={(v) => update({ crosshairSize: v[0] })} />
              </div>
            </div>
          </div>
        </Section>

        {/* Field of view */}
        <Section icon={<Eye className="w-4 h-4" />} title="Field of View" desc="Wider FOV lets you see more, but distorts the edges">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-white/50 mb-1">
                <span>FOV</span>
                <span className="tabular-nums text-amber-300 font-semibold">{settings.fov}°</span>
              </div>
              <Slider value={[settings.fov]} min={70} max={110} step={1} onValueChange={(v) => update({ fov: v[0] })} />
              <div className="flex justify-between items-center text-[10px] text-white/30 mt-1">
                <span>Narrow (zoom)</span>
                <span className="text-white/50">90° (default)</span>
                <span>Wide (peripheral)</span>
              </div>
            </div>
            {/* visual */}
            <div className="w-20 h-20 rounded-full border-2 border-white/10 flex items-center justify-center relative" style={{ background: "radial-gradient(circle, rgba(245,158,11,0.1), transparent)" }}>
              <div className="rounded-full border border-amber-400/60" style={{ width: `${50 + (settings.fov - 70) * 1.0}%`, height: `${50 + (settings.fov - 70) * 1.0}%` }} />
            </div>
          </div>
        </Section>

        {/* Sensitivity */}
        <Section icon={<MousePointer2 className="w-4 h-4" />} title="Mouse Sensitivity" desc="Multiplier applied to base look sensitivity">
          <div>
            <div className="flex justify-between text-xs text-white/50 mb-1">
              <span>Sensitivity</span>
              <span className="tabular-nums text-amber-300 font-semibold">{settings.sensitivity.toFixed(2)}×</span>
            </div>
            <Slider value={[Math.round(settings.sensitivity * 100)]} min={30} max={250} step={5} onValueChange={(v) => update({ sensitivity: v[0] / 100 })} />
            <div className="flex justify-between text-[10px] text-white/30 mt-1">
              <span>0.30× (precise)</span>
              <span>1.0× (default)</span>
              <span>2.50× (flick)</span>
            </div>
          </div>
        </Section>

        {/* Display toggles */}
        <Section icon={<Eye className="w-4 h-4" />} title="HUD Display" desc="Toggle optional HUD elements">
          <div className="grid sm:grid-cols-2 gap-3">
            <Toggle label="Show Ping" desc="Display network latency" value={settings.showPing} onChange={(v) => update({ showPing: v })} />
            <Toggle label="Player Health Bars" desc="Show floating health bars above other operatives, including enemies and teammates" value={settings.showHealthBars} onChange={(v) => update({ showHealthBars: v })} />
          </div>
        </Section>

        {/* Combat / Aiming */}
        <Section icon={<ToggleLeft className="w-4 h-4" />} title="Combat & Aiming" desc="Tune how firing and aiming behave">
          <div className="grid sm:grid-cols-2 gap-3">
            <Toggle
              label="Auto ADS on Fire"
              desc="Automatically aim-down-sights while firing. Ideal on mobile — one less button to hold."
              value={settings.autoAdsOnFire}
              onChange={(v) => update({ autoAdsOnFire: v })}
            />
            <Toggle
              label="Invert Vertical Look"
              desc="Push up to look down (flight-sim style). Off = push up to look up."
              value={settings.invertY}
              onChange={(v) => update({ invertY: v })}
            />
            <Toggle
              label="Scope Reticle Overlay"
              desc="Render the optic reticle (chevron / mil-dot / thermal / NVG) when ADS with a magnified sight."
              value={settings.scopeOverlay}
              onChange={(v) => update({ scopeOverlay: v })}
            />
          </div>
        </Section>

        {/* Master scales footsteps and sound effects independently. */}
        <Section icon={<Volume2 className="w-4 h-4" />} title="Audio Mixer" desc="Louder baseline with peak protection. Master scales footsteps and combat effects together.">
          <div className="space-y-5">
            {([
              { key: "masterVolume", label: "Master Volume", help: "Overall game volume" },
              { key: "footstepVolume", label: "Footsteps", help: "Your footsteps and nearby players" },
              { key: "fxVolume", label: "Sound Effects", help: "Gunfire, explosions, hits and UI sounds" },
            ] as const).map(({ key, label, help }) => (
              <div key={key}>
                <div className="flex justify-between gap-3 text-xs mb-1">
                  <div><span className="text-white/75">{label}</span><span className="text-white/40 ml-2">{help}</span></div>
                  <span className="tabular-nums text-amber-300 font-semibold">{settings[key]}%</span>
                </div>
                <Slider value={[settings[key]]} min={0} max={100} step={5}
                  aria-label={label}
                  onValueChange={(v) => update({ [key]: v[0] })} />
              </div>
            ))}
          </div>
        </Section>

        <div className="flex items-center justify-center gap-2 text-xs text-white/40 py-2">
          <Check className="w-3 h-3 text-emerald-400" />
          Settings auto-save to your browser
        </div>
      </main>

      {!embedded && <footer className="mt-auto border-t border-white/10 bg-black/40 py-4">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-xs text-white/40">Settings persist locally. Display, control and audio changes apply immediately in matches.</div>
      </footer>}
    </div>
  );
}

function Section({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5 backdrop-blur">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">{icon}</div>
        <div>
          <h3 className="text-white font-bold tracking-wide uppercase text-sm">{title}</h3>
          <p className="text-white/40 text-xs mt-0.5">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`text-left p-3 rounded-xl border transition-all ${
        value ? "border-amber-500/40 bg-amber-500/10" : "border-white/10 bg-black/30 hover:border-white/25"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-white font-semibold text-sm">{label}</span>
        <span className={`w-9 h-5 rounded-full p-0.5 transition-colors ${value ? "bg-amber-500" : "bg-white/15"}`}>
          <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${value ? "translate-x-4" : ""}`} />
        </span>
      </div>
      <div className="text-white/40 text-xs mt-0.5">{desc}</div>
    </button>
  );
}

function CrosshairPreview({color,size,shape}:{color:string;size:number;shape:string}){
 const view=shape==="dot"?"•":shape==="reticle_orbit"?"◎":shape==="reticle_chevron"?"⌃":shape==="reticle_nova"?"✧":shape==="reticle_pulse"?"◇":null;
 if(view)return <span aria-hidden className="font-mono" style={{color,fontSize:size*3,textShadow:`0 0 8px ${color}66`}}>{view}</span>;
 return <div className="relative" style={{width:size*3,height:size*3}}>
  <span className="absolute inset-0 flex items-center justify-center font-thin" style={{color,fontSize:size*3}}>+</span>
 </div>;
}
