import { ROUND_INSERT_FRACTION } from "./incremental-reload";

/** Deterministic cosmetic animation timing. No Three.js or gameplay side effects.
 * Timelines use elapsed time from an action's own start (never the weapon's
 * catalog reload time: recoverable bolts and active venting override it).
 */
export type ReloadMotion = "magazine" | "shell" | "cylinder" | "bolt" | "vent";
export type DeployMotion = "throw" | "place" | "aim";

export interface ActionPose {
  // Weapon offsets added on top of the usual hipfire/sprint/swap pose.
  dip: number;
  pitch: number;
  roll: number;
  // Offhand's own local camera-space location (before the weapon's vmOffset).
  hand: [number, number, number];
  prop: [number, number, number];
  handRoll: number;
  propVisible: boolean;
  hideFixedMagazine: boolean;
  released: boolean;
}
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
const empty: ActionPose = { dip:0, pitch:0,roll:0,hand:[-.10,-.12,-.12],prop:[-.10,-.20,-.12],handRoll:0,propVisible:false,hideFixedMagazine:false,released:false };
export function reloadMotionFor(weaponId: string, category: string, special?: string): ReloadMotion {
  if (special === "heat") return "vent";
  if (special === "bolt") return "bolt";
  if (category === "shotgun") return "shell";
  if (weaponId === "pistol_magnum") return "cylinder";
  return "magazine";
}
export function equipmentMotionFor(id: string): DeployMotion {
  return id === "mine" ? "place" : id === "taser" ? "aim" : "throw";
}
/** Timeline point when the equipment intent is sent/applied. */
export function deployReleaseFraction(kind: DeployMotion): number {
  return kind === "place" ? .72 : kind === "aim" ? .48 : .46;
}
export function deployDurationMs(kind: DeployMotion): number {
  return kind === "place" ? 850 : kind === "aim" ? 590 : 670;
}
export function sampleReloadMotion(progress: number, kind: ReloadMotion): ActionPose {
  const p = clamp01(progress);
  // 0-.18: lower weapon, .18-.40: extract, .40-.67: align fresh prop,
  // .67-.88: insert or close, .88-1: return to ready.
  const enter = ease(p / .18);
  const leave = 1 - ease((p - .82) / .18);
  const weight = enter * leave;
  const home: [number,number,number] = [-.10,-.12,-.12];
  const atMag: [number,number,number] = [.015,-.255,.02];
  const outside: [number,number,number] = [-.19,-.47,.17];
  const support = p < .20 ? mix(home,atMag,ease(p/.20))
    : p < .43 ? mix(atMag,outside,ease((p-.20)/.23))
    : p < .63 ? outside
    : p < .85 ? mix(outside,atMag,ease((p-.63)/.22))
    : mix(atMag,home,ease((p-.85)/.15));
  if (kind === "vent") {
    const valve: [number,number,number] = [.06,.015,-.35];
    const hand = p < .25 ? mix(home,valve,ease(p/.25)) : p > .74 ? mix(valve,home,ease((p-.74)/.26)) : valve;
    return { ...empty, dip:-.095*weight,pitch:.28*weight,roll:-.12*weight,
      hand, prop:hand,handRoll:-.30*weight,propVisible:false };
  }
  if (kind === "bolt") {
    const draw: [number,number,number] = [-.05,.035,-.34];
    const pull: [number,number,number] = [-.05,.035,.02];
    const hand = p < .30 ? mix(home,draw,ease(p/.30)) : p < .61 ? mix(draw,pull,ease((p-.30)/.31))
      : p < .82 ? mix(pull,draw,ease((p-.61)/.21)) : mix(draw,home,ease((p-.82)/.18));
    return { ...empty,dip:-.09*weight,pitch:.22*weight,roll:-.08*weight,hand,prop:hand,
      handRoll:-.20*weight,propVisible:p>.29&&p<.75 };
  }
  if (kind === "shell") {
    // ONE visible shell insertion per gameplay reload cycle. The previous
    // sin(4πp) path visited the loading port twice per cycle, making it look
    // as if multiple shells had been inserted without adding ammunition.
    // The shell visibly seats at ROUND_INSERT_FRACTION, from the shared
    // gameplay timing rule, so cosmetic and ammo state cannot drift.
    const pocket: [number,number,number] = [-.23,-.47,.18];
    const port: [number,number,number] = [-.015,-.20,-.12];
    const hand = p < .24 ? pocket
      : p < ROUND_INSERT_FRACTION ? mix(pocket,port,ease((p-.24)/(ROUND_INSERT_FRACTION-.24)))
      : mix(port,pocket,ease((p-ROUND_INSERT_FRACTION)/(1-ROUND_INSERT_FRACTION)));
    const insert = ease((p-.24)/(ROUND_INSERT_FRACTION-.24));
    return {...empty,dip:-.10*weight,pitch:.33*weight,roll:-.16*weight,hand,prop:hand,
      handRoll:.24*(1-insert),propVisible:p>.08&&p<ROUND_INSERT_FRACTION};
  }
  if (kind === "cylinder") {
    return {...empty,dip:-.11*weight,pitch:.30*weight,roll:-.35*weight,
      hand:support,prop:support,handRoll:.55*weight,propVisible:p>.25&&p<.83,
      hideFixedMagazine:p>.25&&p<.83};
  }
  return {...empty,dip:-.14*weight,pitch:.40*weight,roll:-.28*weight,
    hand:support,prop:[support[0],support[1]-.06,support[2]-.015],handRoll:.26*weight,
    propVisible:p>.20&&p<.84,hideFixedMagazine:p>.22&&p<.76};
}
export function sampleDeployMotion(progress: number, kind: DeployMotion): ActionPose {
  const p = clamp01(progress);
  const release = deployReleaseFraction(kind);
  const ready: [number,number,number] = [.37,-.37,-.24];
  const centre: [number,number,number] = [.06,-.14,-.38];
  const cast: [number,number,number] = [-.10,.18,-.68];
  const floor: [number,number,number] = [.05,-.58,-.63];
  let hand: [number,number,number];
  if (kind === "place") {
    hand = p < .18 ? mix(ready,centre,ease(p/.18)) : p < release ? mix(centre,floor,ease((p-.18)/(release-.18)))
      : mix(floor,ready,ease((p-release)/(1-release)));
  } else if (kind === "aim") {
    hand = p < .30 ? mix(ready,centre,ease(p/.30)) : p < release ? centre
      : mix(centre,ready,ease((p-release)/(1-release)));
  } else {
    const windup: [number,number,number] = [.45,-.36,.02];
    hand = p < .26 ? mix(ready,windup,ease(p/.26)) : p < release ? mix(windup,cast,ease((p-.26)/(release-.26)))
      : mix(cast,ready,ease((p-release)/(1-release)));
  }
  const gunWeight = Math.sin(Math.PI * Math.min(1,p/.82));
  return { ...empty,dip:-.25*gunWeight,pitch:.55*gunWeight,roll:.30*gunWeight,
    hand,prop:hand,handRoll:kind==="place" ? -.45 : kind==="throw" ? -.70*Math.sin(p*Math.PI) : -.25,
    propVisible:p<release,released:p>=release };
}
