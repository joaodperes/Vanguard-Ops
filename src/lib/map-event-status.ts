import type { EnvironmentObject } from "./game-protocol";
import {periodicHazardPhase} from "./dynamic-environment";
import {whiteoutWindow} from "./map-battle-events";

export interface MapEventStatus {phase:"idle"|"warning"|"active";label:string;secondsLeft:number}

/** Derived from the same authoritative environment clock used for trap damage.
 * The first vent owns the shared cycle; every Floodgate vent is synchronized. */
export function steamPurgeStatus(environment:readonly EnvironmentObject[],seconds:number):MapEventStatus|undefined {
  const vent=environment.find(o=>o.type==="spikes"&&o.visual==="steam");
  if(!vent||vent.type!=="spikes")return undefined;
  const phase=periodicHazardPhase(vent,seconds);
  const cycle=((seconds+(vent.offset??0))%vent.period+vent.period)%vent.period;
  const secondsLeft=Math.max(1,Math.ceil(phase==="active"?vent.activeFor-cycle:vent.period-cycle));
  const label=phase==="active"?`Spillway purging · ${secondsLeft}s · use covered routes`:
    phase==="warning"?`Pressure purge in ${secondsLeft}s · clear the grates`:
    `Spillway purge in ${secondsLeft}s`;
  return {phase,label,secondsLeft};
}

/** A permanent dam failure takes precedence over the former vent countdown. */
export function damBreachStatus(breached:boolean,environment:readonly EnvironmentObject[],seconds:number):MapEventStatus|undefined {
  if(breached)return {phase:"active",label:"DAM BREACHED · northern spillway opened",secondsLeft:0};
  return steamPurgeStatus(environment,seconds);
}
export function whiteoutWeatherStatus(seconds:number):MapEventStatus {
  const event=whiteoutWindow(seconds);
  return {phase:event.phase,secondsLeft:event.secondsLeft,
    label:event.phase==="active"?"BLIZZARD · visibility reduced":event.phase==="warning"
      ?`Blizzard arriving in ${event.secondsLeft}s`:"Clear skies"};
}

/** Only show structural progress after the first confirmed hit. No idle timers. */
export function floodgateIntegrityStatus(currentHp:number,maxHp:number):MapEventStatus|undefined {
  if(currentHp<=0)return {phase:"active",label:"DAM BREACHED · northern spillway opened",secondsLeft:0};
  if(!Number.isFinite(currentHp)||!Number.isFinite(maxHp)||maxHp<=0||currentHp>=maxHp)return undefined;
  const pct=Math.max(1,Math.ceil(100*currentHp/maxHp));
  return {phase:"warning",label:`DAM INTEGRITY ${pct}% · keep firing at the orange panels`,secondsLeft:0};
}
