"use client";
import { useRef, useState, useEffect } from "react";
import type { FPSEngine } from "@/lib/fps-engine";
import { Crosshair, ZoomIn, RefreshCw, ArrowUp, PocketKnife } from "lucide-react";

interface Props {
  engine: FPSEngine | null;
}

// On-screen controls for touch devices.
//
// Layout (per mobile gameplay UI adjustments):
//   • LEFT half  — floating movement joystick. Pushing the joystick past a
//     magnitude threshold auto-sprints (no dedicated Sprint button).
//   • RIGHT half — look-drag (the "aim directional control").
//   • LEFT bottom — Jump button (sits with the direction controls).
//   • RIGHT bottom — Fire + ADS + Reload (sit with the aim control).
//   • LEFT side (above Jump) — weapon swap strip (1 / 2 / 3).
//
// The joystick knob glows cyan when auto-sprint is engaged so the player has
// clear feedback that pushing harder = sprinting.
export function TouchControls({ engine }: Props) {
  // ---- Movement joystick (left half, floating) ----
  const joyBaseRef = useRef<{ x: number; y: number } | null>(null);
  const joyTouchId = useRef<number | null>(null);
  const [knob, setKnob] = useState<{ x: number; y: number } | null>(null); // knob offset from base
  const [joyBase, setJoyBase] = useState<{ x: number; y: number } | null>(null);

  // ---- Look drag (right half) ----
  const lookTouchId = useRef<number | null>(null);
  const lookLast = useRef<{ x: number; y: number } | null>(null);

  const JOY_RADIUS = 56;
  // Auto-sprint kicks in at this joystick magnitude (must match the engine's
  // 0.85 threshold — kept in sync here for the visual glow only).
  const SPRINT_MAG = 0.85;

  const onLeftTouchStart = (e: React.TouchEvent) => {
    if (joyTouchId.current !== null) return;
    const t = e.changedTouches[0];
    joyTouchId.current = t.identifier;
    joyBaseRef.current = { x: t.clientX, y: t.clientY };
    setJoyBase({ x: t.clientX, y: t.clientY });
    setKnob({ x: 0, y: 0 });
    engine?.setTouchMove(0, 0);
  };
  const onLeftTouchMove = (e: React.TouchEvent) => {
    if (joyTouchId.current === null) return;
    const base = joyBaseRef.current;
    if (!base) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier !== joyTouchId.current) continue;
      let dx = t.clientX - base.x;
      let dy = t.clientY - base.y;
      const dist = Math.hypot(dx, dy);
      if (dist > JOY_RADIUS) { dx = (dx / dist) * JOY_RADIUS; dy = (dy / dist) * JOY_RADIUS; }
      setKnob({ x: dx, y: dy });
      engine?.setTouchMove(dx / JOY_RADIUS, dy / JOY_RADIUS);
    }
  };
  const onLeftTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joyTouchId.current) {
        joyTouchId.current = null;
        joyBaseRef.current = null;
        setJoyBase(null);
        setKnob(null);
        engine?.setTouchMove(0, 0);
      }
    }
  };

  const onRightTouchStart = (e: React.TouchEvent) => {
    if (lookTouchId.current !== null) return;
    const t = e.changedTouches[0];
    lookTouchId.current = t.identifier;
    lookLast.current = { x: t.clientX, y: t.clientY };
  };
  const onRightTouchMove = (e: React.TouchEvent) => {
    if (lookTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier !== lookTouchId.current) continue;
      const last = lookLast.current;
      if (last) {
        const dx = t.clientX - last.x;
        const dy = t.clientY - last.y;
        engine?.applyTouchLook(dx, dy);
      }
      lookLast.current = { x: t.clientX, y: t.clientY };
    }
  };
  const onRightTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchId.current) {
        lookTouchId.current = null;
        lookLast.current = null;
      }
    }
  };

  // Prevent context menu / gestures
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", prevent);
    return () => document.removeEventListener("gesturestart", prevent);
  }, []);

  // Auto-sprint visual feedback: when the joystick magnitude exceeds the
  // sprint threshold AND is pushing forward (dy < 0), the knob glows cyan.
  const mag = knob ? Math.hypot(knob.x, knob.y) / JOY_RADIUS : 0;
  const sprinting = knob ? mag > SPRINT_MAG && knob.y < 0 : false;

  return (
    <div className="absolute inset-0 z-40 touch-none select-none" style={{ touchAction: "none" }}>
      {/* Left half: movement joystick (floating) */}
      <div
        className="absolute left-0 top-0 bottom-0"
        style={{ width: "45%" }}
        onTouchStart={onLeftTouchStart}
        onTouchMove={onLeftTouchMove}
        onTouchEnd={onLeftTouchEnd}
        onTouchCancel={onLeftTouchEnd}
      >
        {joyBase && (
          <div
            className={`absolute rounded-full border-2 bg-black/30 backdrop-blur-sm transition-colors ${sprinting ? "border-cyan-400/70 shadow-[0_0_18px_rgba(34,211,238,0.45)]" : "border-white/20"}`}
            style={{ width: JOY_RADIUS * 2, height: JOY_RADIUS * 2, left: joyBase.x - JOY_RADIUS, top: joyBase.y - JOY_RADIUS }}
          >
            <div
              className={`absolute rounded-full border transition-colors ${sprinting ? "bg-cyan-400/70 border-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.8)]" : "bg-white/40 border-white/50"}`}
              style={{ width: 44, height: 44, left: JOY_RADIUS - 22 + (knob?.x ?? 0), top: JOY_RADIUS - 22 + (knob?.y ?? 0) }}
            />
            {/* Tiny "SPRINT" pip that fades in when auto-sprint is engaged */}
            <div
              className={`absolute left-1/2 -translate-x-1/2 -top-5 text-[8px] font-bold uppercase tracking-wider text-cyan-300 transition-opacity ${sprinting ? "opacity-100" : "opacity-0"}`}
            >
              » Sprint
            </div>
          </div>
        )}
        {!joyBase && (
          <div className="absolute left-8 bottom-28 text-white/30 text-xs flex flex-col items-center gap-1 pointer-events-none">
            <div className="w-14 h-14 rounded-full border-2 border-white/15 flex items-center justify-center">
              <span className="text-2xl">⊕</span>
            </div>
            <span>Move · push far = sprint</span>
          </div>
        )}
      </div>

      {/* Right half: look drag (behind buttons) */}
      <div
        className="absolute right-0 top-0 bottom-0"
        style={{ width: "55%" }}
        onTouchStart={onRightTouchStart}
        onTouchMove={onRightTouchMove}
        onTouchEnd={onRightTouchEnd}
        onTouchCancel={onRightTouchEnd}
      />

      {/* ── LEFT cluster: Jump + weapon swap strip ──
          Jump sits at the bottom-left corner (with the direction controls).
          The weapon swap strip (1/2/3) stacks vertically above Jump. */}
      <div className="absolute bottom-8 left-6 flex flex-col items-start gap-3" style={{ touchAction: "none" }}>
        {/* Weapon swap strip — small square buttons (1=primary, 2=secondary, 3=melee) */}
        <div className="flex flex-col gap-1.5">
          <SwapBtn label="1" onDown={() => engine?.touchSwap("primary")} color="border-emerald-500/50 bg-emerald-500/15 text-emerald-300" />
          <SwapBtn label="2" onDown={() => engine?.touchSwap("secondary")} color="border-amber-500/50 bg-amber-500/15 text-amber-300" />
          <SwapBtn label="3" icon={<PocketKnife className="w-3.5 h-3.5" />} onDown={() => engine?.touchSwap("melee")} color="border-rose-500/50 bg-rose-500/15 text-rose-300" />
        </div>
        {/* Jump — prominent cyan button at the bottom-left */}
        <ActionBtn
          label="Jump"
          icon={<ArrowUp className="w-6 h-6" />}
          onDown={() => engine?.touchJump()}
          color="border-cyan-500/50 bg-cyan-500/20 text-cyan-200"
          big
        />
      </div>

      {/* ── RIGHT cluster: Fire + ADS + Reload ──
          Fire is the big button at the bottom-right corner; ADS sits above it;
          Reload is a small button to the LEFT of Fire so it's reachable with
          the same thumb without overlapping the look-drag area. */}
      <div className="absolute bottom-8 right-6 flex items-end gap-3" style={{ touchAction: "none" }}>
        {/* Reload — small, sits to the left of Fire */}
        <div className="flex flex-col gap-3 items-center mb-1">
          <ActionBtn
            label="Reload"
            icon={<RefreshCw className="w-5 h-5" />}
            onDown={() => engine?.touchReload()}
            color="border-amber-500/40 bg-amber-500/15 text-amber-300"
          />
        </div>
        {/* Fire + ADS stacked vertically (ADS on top, Fire below) */}
        <div className="flex flex-col gap-3 items-end">
          <HoldBtn
            label="ADS"
            icon={<ZoomIn className="w-6 h-6" />}
            onDown={() => engine?.setTouchADS(true)}
            onUp={() => engine?.setTouchADS(false)}
            color="border-white/30 bg-white/10 text-white"
          />
          <HoldBtn
            label="Fire"
            icon={<Crosshair className="w-7 h-7" />}
            onDown={() => engine?.setTouchFire(true)}
            onUp={() => engine?.setTouchFire(false)}
            color="border-rose-500/50 bg-rose-600/25 text-rose-200"
            big
          />
        </div>
      </div>
    </div>
  );
}

// Small weapon-swap button (compact square — sits in a vertical strip).
function SwapBtn({ label, icon, onDown, color }: { label: string; icon?: React.ReactNode; onDown: () => void; color: string }) {
  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); onDown(); }}
      className={`w-11 h-11 rounded-lg border-2 backdrop-blur flex items-center justify-center active:scale-95 transition-transform ${color}`}
      aria-label={`Swap to slot ${label}`}
    >
      {icon ?? <span className="text-sm font-bold tabular-nums">{label}</span>}
    </button>
  );
}

function ActionBtn({ label, icon, onDown, color, big }: { label: string; icon: React.ReactNode; onDown: () => void; color: string; big?: boolean }) {
  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); onDown(); }}
      className={`${big ? "w-16 h-16" : "w-14 h-14"} rounded-full border-2 backdrop-blur flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform ${color}`}
      aria-label={label}
    >
      {icon}
      <span className="text-[9px] uppercase tracking-wider opacity-80">{label}</span>
    </button>
  );
}

function HoldBtn({ label, icon, onDown, onUp, color, big }: { label: string; icon: React.ReactNode; onDown: () => void; onUp: () => void; color: string; big?: boolean }) {
  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); onDown(); }}
      onPointerUp={(e) => { e.preventDefault(); onUp(); }}
      onPointerCancel={() => onUp()}
      onPointerLeave={() => onUp()}
      className={`${big ? "w-20 h-20" : "w-16 h-16"} rounded-full border-2 backdrop-blur flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform ${color}`}
      aria-label={label}
    >
      {icon}
      <span className="text-[9px] uppercase tracking-wider opacity-80">{label}</span>
    </button>
  );
}
