import type { EnvironmentObject } from "./game-protocol";
import {periodicHazardPhase} from "./dynamic-environment";

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
