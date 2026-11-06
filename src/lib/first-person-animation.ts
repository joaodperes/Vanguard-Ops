import { ROUND_INSERT_FRACTION } from "./incremental-reload";

/** Deterministic cosmetic animation timing. No Three.js or gameplay side effects.
 * Timelines use elapsed time from an action's own start (never the weapon's
 * catalog reload time: recoverable bolts and active venting override it).
 */
export type ReloadMotion = "magazine" | "shell" | "cylinder" | "side_bolt" | "bolt" | "vent";
export type DeployMotion = "throw" | "place" | "aim";

/** Cosmetic viewmodel swap only. Weapon readiness and Gun Game progression
 * are controlled elsewhere and MUST NOT depend on this visual timeline. */
export const WEAPON_SWAP_VISUAL_MS = 450;
export const WEAPON_SWAP_HANDOFF = 0.5;
export interface WeaponSwapPose {
  x: number; y: number; z: number;
  pitch: number; roll: number;
  incoming: boolean;
}

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
/** The offhand supports guns in normal play, but never a melee weapon.
 * When the Bulwark shield breaks, it returns to supporting the sidearm. */
export function supportHandRestMode(
  category: string, shieldEquipped: boolean, shieldUsable: boolean,
): "weapon" | "shield" | "none" {
  if (category === "melee") return "none";
  return shieldEquipped && shieldUsable ? "shield" : "weapon";
}

/** Blend the shared support hand smoothly out of the grip and back after an
 * action. At 0 and 1 it is fully attached to the weapon; between the ramps it
 * follows the reload/deploy animation without a duplicated stationary hand. */
/** Camera-local elbow for the support arm. Both sleeve segments are placed
 * between the shoulder -> elbow -> wrist every frame. Unlike a static sleeve
 * attached to the glove, this keeps the arm connected even when a long
 * sniper, launcher, or recoil pose moves the hand far from the body. */
export function supportElbowPosition(
  shoulder: readonly [number, number, number],
  wrist: readonly [number, number, number],
): [number, number, number] {
  const dx = wrist[0] - shoulder[0];
  const dy = wrist[1] - shoulder[1];
  const dz = wrist[2] - shoulder[2];
  const reach = Math.hypot(dx, dy, dz);
  // Prefer an outward/downward elbow. Scale the bend for short weapons and
  // action poses, so the arm never folds into a spike near its shoulder.
  const bend = Math.min(.18, reach * .16);
  return [
    shoulder[0] + dx * .50 - bend * .62,
    shoulder[1] + dy * .50 - bend * .67,
    shoulder[2] + dz * .50 + bend * .36,
  ];
}

export function supportActionWeight(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  const smooth = (t: number) => {
    const c = Math.max(0, Math.min(1, t));
    return c * c * (3 - 2 * c);
  };
  return smooth(p / .16) * (1 - smooth((p - .84) / .16));
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
const empty: ActionPose = { dip:0, pitch:0,roll:0,hand:[-.10,-.12,-.12],prop:[-.10,-.20,-.12],handRoll:0,propVisible:false,hideFixedMagazine:false,released:false };
/** The OLD weapon moves down/right into a holster, muzzle pointing DOWN.
 * Only when it is fully below the camera do we reveal the NEW weapon, which
 * is drawn up from below. This differs from reload's muzzle-up magazine pose.
 * The model handoff is cosmetic: gameplay switches weapons immediately. */
export function sampleWeaponSwapMotion(progress: number): WeaponSwapPose {
  const p = clamp01(progress);
  // Exact zero rest transforms (avoid signed negative zero at the endpoints).
  if (p === 0 || p === 1) {
    return { x: 0, y: 0, z: 0, pitch: 0, roll: 0, incoming: p === 1 };
  }
  if (p < WEAPON_SWAP_HANDOFF) {
    const t = ease(p / WEAPON_SWAP_HANDOFF);
    return { x: .32 * t, y: -.80 * t, z: .19 * t,
      pitch: -.58 * t, roll: -.30 * t, incoming: false };
  }
  const t = ease((p - WEAPON_SWAP_HANDOFF) / (1 - WEAPON_SWAP_HANDOFF));
  return { x: .26 * (1 - t), y: -.80 * (1 - t), z: .17 * (1 - t),
    pitch: -.42 * (1 - t), roll: .22 * (1 - t), incoming: true };
}


/** The Bulwark shield is a separate, tall camera rig rather than a gun part.
 * Keep its existing holster pose, but DRAW it from behind the left shoulder:
 * entirely off-screen at the cosmetic weapon handoff, then swing forward and
 * up into its normal left-side guard. The shield's gameplay collision/raised
 * state does not use this pose. */
export function sampleRiotShieldSwapMotion(progress: number): {
  x: number; y: number; z: number; pitch: number; yaw: number; roll: number;
} {
  const p = clamp01(progress);
  if (p === 0 || p === 1) {
    return { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };
  }
  if (p < WEAPON_SWAP_HANDOFF) {
    const gun = sampleWeaponSwapMotion(p);
    return { x: gun.x, y: gun.y * 1.45, z: gun.z,
      pitch: gun.pitch * .5, yaw: 0, roll: gun.roll };
  }
  // Ease OUT of the shoulder draw so most of the distance is travelled early.
  // As the tall panel enters the left edge, its broad face turns toward camera.
  const t = (p - WEAPON_SWAP_HANDOFF) / (1 - WEAPON_SWAP_HANDOFF);
  const remaining = (1 - t) * (1 - t);
  return {
    x: -1.65 * remaining, y: -.68 * remaining, z: .26 * remaining,
    pitch: .18 * remaining, yaw: -.75 * remaining, roll: .35 * remaining,
  };
}

export function reloadMotionFor(weaponId: string, category: string, special?: string): ReloadMotion {
  if (special === "heat") return "vent";
  if (weaponId === "sniper_heavy") return "side_bolt";
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
  if (kind === "side_bolt") {
    const port: [number,number,number] = [-.16,-.035,-.18];
    const back: [number,number,number] = [-.21,-.035,.10];
    const hand=p<.22?mix(home,port,ease(p/.22)):p<.5?mix(port,back,ease((p-.22)/.28)):p<.78?mix(back,port,ease((p-.5)/.28)):mix(port,home,ease((p-.78)/.22));
    return {...empty,dip:-.07*weight,pitch:.08*weight,roll:-.18*weight,hand,prop:hand,handRoll:.35*weight,propVisible:p>.28&&p<.7};
  }
  if (kind === "bolt") {
    // The offhand slides an arrow horizontally ALONG the crossbow's upper
    // flight rail, not vertically through its underside.
    const draw: [number,number,number] = [0,.075,-.38];
    const pull: [number,number,number] = [0,.075,.06];
    const hand = p < .30 ? mix(home,draw,ease(p/.30)) : p < .61 ? mix(draw,pull,ease((p-.30)/.31))
      : p < .82 ? mix(pull,draw,ease((p-.61)/.21)) : mix(draw,home,ease((p-.82)/.18));
    return { ...empty,dip:-.035*weight,pitch:.045*weight,roll:0,hand,
      prop:[hand[0],hand[1]+.025,hand[2]-.02],
      handRoll:0,propVisible:p>.29&&p<.75 };
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
