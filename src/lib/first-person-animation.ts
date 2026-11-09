import { ROUND_INSERT_FRACTION } from "./incremental-reload";
import { bastionReloadFrame, bastionLoaderContact } from "./bastion-revolver-rig";

/** Deterministic cosmetic animation timing. No Three.js or gameplay side effects.
 * Timelines use elapsed time from an action's own start (never the weapon's
 * catalog reload time: recoverable bolts and active venting override it).
 */
export type ReloadMotion = "magazine" | "shell" | "cylinder" | "cylinder_speedloader" | "side_bolt" | "bolt" | "vent";
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

/** Nominal camera-space upper arm and forearm lengths (for the FPS rig). */
export const SUPPORT_UPPER_ARM_LENGTH = .37;
export const SUPPORT_FOREARM_LENGTH = .34;

// Long rifles need a deeper torso anchor and a substantial forearm. The
// original sniper pose put the elbow nearly on the glove because its root was
// too far forward; keep legacy lengths for regular guns and launchers.
export const SUPPORT_LONG_UPPER_ARM_LENGTH = .42;
export const SUPPORT_LONG_FOREARM_LENGTH = .51;

// Camera-relative lengths for a compact, two-handed sidearm grip. A full rifle
// arm would fold past the pistol and stick an elbow in front of the hand.
export const SUPPORT_SIDEARM_UPPER_LENGTH = .40;
export const SUPPORT_SIDEARM_FOREARM_LENGTH = .43;

/** Compact pistol/PDW/SMG viewmodels need their support elbow behind the wrist.
 * A rifle's camera-local shoulder is moved forward for hip-fire framing, but
 * reusing that shoulder for small guns puts the elbow beside or ahead of the
 * pistol grip, causing the arm to appear to fold backwards.
 * The Bulwark keeps its shield pose while intact and uses the compact pistol
 * arm only once the shield is destroyed.
 */
export function usesCompactSupportArm(
  category: string, shieldEquipped: boolean, shieldUsable: boolean,
): boolean {
  if (shieldEquipped) return !shieldUsable;
  return category === "pistol" || category === "pdw" || category === "smg";
}

/** Camera-local *tucked* arm pose, not a screen-space elbow highlight.
 * The upper arm retreats under the view while the forearm supports the gun.
 * Keep the bend toward the torso and slightly downward: forcing the elbow
 * high into the viewport creates a visibly broken, backward-looking arm.
 */
/** Long receiver weapon class: ordinary rifles/shotguns keep their old arm. */
export function usesLongSupportArm(category: string, receiverLength: number, shieldEquipped: boolean): boolean {
  return !shieldEquipped && category !== "launcher"
    && (category === "sniper" || receiverLength >= .55);
}

/** Rest shoulder and elbow-hint pose, independent of weapon-hand animation.
 * A pole is a bend *direction*, never a screen-space target. */
export function supportArmFraming(aspect: number, compact = false, longGun = false): {
  shoulder: [number, number, number];
  pole: [number, number, number];
} {
  const narrow = Math.max(0, Math.min(1, (1.1 - aspect) / (1.1 - 9/16)));
  if (compact) {
    return {
      shoulder: [-.34 + .025 * narrow, -.50, .10],
      pole: [-.50 + .03 * narrow, -.30, .30],
    };
  }
  if (longGun) {
    // Annihilator and other snipers: torso behind the rear grip, elbow well
    // behind the support glove, without pulling it artificially into frame.
    return {
      shoulder: [-.36 + .016 * narrow, -.50, .03],
      pole: [-.60 + .05 * narrow, -.25, .25],
    };
  }
  return {
    shoulder: [-.30 + .035 * narrow, -.45, -.25],
    pole: [-.55 + .08 * narrow, -.10, -.50],
  };
}

/** Solve the elbow by two-bone inverse kinematics, keeping a consistent
 * outward/downward bend pole and the hand firmly on its moving weapon grip.
 * Normal poses preserve fixed segment lengths; exceptional targets stretch
 * both uniformly rather than disconnect from the shoulder or wrist. */
export function supportElbowPosition(
  shoulder: readonly [number, number, number],
  wrist: readonly [number, number, number],
  pole: readonly [number, number, number] = [-.55, -.10, -.50],
  upperLength = SUPPORT_UPPER_ARM_LENGTH,
  forearmLength = SUPPORT_FOREARM_LENGTH,
): [number, number, number] {
  let dx = wrist[0] - shoulder[0], dy = wrist[1] - shoulder[1], dz = wrist[2] - shoulder[2];
  const reach = Math.hypot(dx,dy,dz);
  if (reach < 1e-6) return [shoulder[0] - upperLength, shoulder[1], shoulder[2]];
  dx/=reach; dy/=reach; dz/=reach;
  const total = upperLength + forearmLength;
  const stretch = Math.max(1, reach / (total * .998));
  const upper = upperLength * stretch, forearm = forearmLength * stretch;
  const along = (upper*upper - forearm*forearm + reach*reach)/(2*reach);
  const side = Math.sqrt(Math.max(0,upper*upper-along*along));
  // The bend pole stays tucked toward the body, with no forced upward elbow.
  // It remains camera-relative, preventing a sudden flip on weapon recoil.
  let px=pole[0],py=pole[1],pz=pole[2];
  let dot=px*dx+py*dy+pz*dz;
  px-=dot*dx;py-=dot*dy;pz-=dot*dz;
  let mag=Math.hypot(px,py,pz);
  if(mag<1e-5){
    px=0;py=-1;pz=0;
    dot=py*dy;
    px-=dot*dx;py-=dot*dy;pz-=dot*dz;
    mag=Math.hypot(px,py,pz);
  }
  return [
    shoulder[0]+dx*along+px*side/mag,
    shoulder[1]+dy*along+py*side/mag,
    shoulder[2]+dz*along+pz*side/mag,
  ];
}

/** Solve the WHOLE arm as the hand leaves the forward grip for a reload.
 * Moving the tip alone while leaving the shoulder locked made the forearm
 * scrape rearward while the upper arm looked frozen. Shift the torso-side root
 * slightly with the wrist and carry the elbow hint with the action, then solve
 * both fixed-length bones to the actual animated cuff. The root movement is
 * clamped so extreme deploy/throw poses never drag the torso into the gun.
 * This is a camera-local visual rig and has no gameplay side effects. */
export function animatedSupportArm(
  frame: {shoulder: readonly [number,number,number]; pole: readonly [number,number,number]},
  restWrist: readonly [number,number,number],
  wrist: readonly [number,number,number],
  actionWeight: number,
  upperLength = SUPPORT_UPPER_ARM_LENGTH,
  forearmLength = SUPPORT_FOREARM_LENGTH,
): {shoulder: [number,number,number]; elbow: [number,number,number]} {
  const weight = Math.max(0,Math.min(1,actionWeight));
  const dx = (wrist[0]-restWrist[0])*weight;
  const dy = (wrist[1]-restWrist[1])*weight;
  const dz = (wrist[2]-restWrist[2])*weight;
  const clamp = (v:number,limit:number)=>Math.max(-limit,Math.min(limit,v));
  const shoulder: [number,number,number] = [
    frame.shoulder[0] + clamp(dx*.25,.08),
    frame.shoulder[1] + clamp(dy*.28,.065),
    frame.shoulder[2] + clamp(dz*.32,.12),
  ];
  // A stable elbow hint tracks the wrist's reload motion at lower weight.
  // Using only the static camera-space pole produced an almost motionless
  // elbow even while the hand swept the Annihilator bolt.
  const neutral = supportElbowPosition(frame.shoulder,restWrist,frame.pole,upperLength,forearmLength);
  const hint: [number,number,number] = [
    neutral[0]+dx*.55-shoulder[0],
    neutral[1]+dy*.55-shoulder[1],
    neutral[2]+dz*.55-shoulder[2],
  ];
  return {shoulder, elbow:supportElbowPosition(shoulder,wrist,hint,upperLength,forearmLength)};
}

/** Blend the shared support hand smoothly out of the grip and back after an
 * action. At 0 and 1 it is fully attached to the weapon; between the ramps it
 * follows the reload/deploy animation without a duplicated stationary hand. */
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
  if (weaponId === "pistol_bastion") return "cylinder_speedloader";
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
  if (kind === "cylinder_speedloader") {
    const frame=bastionReloadFrame(p);
    const cylinder=bastionLoaderContact(p,1.20);
    const pocket:[number,number,number]=[-.24,-.43,.14];
    const grip:[number,number,number]=[cylinder[0]-.055,cylinder[1]-.035,cylinder[2]+.030];
    const hand=p<.22?mix(home,grip,ease(p/.22))
      : p<.41?mix(grip,pocket,ease((p-.22)/.19))
      : p<.51?mix(pocket,grip,ease((p-.41)/.10))
      : p<.79?grip:mix(grip,home,ease((p-.79)/.21));
    // Contact is authored on the actual six-chamber rear face. Both this
    // prop and the cylinder are transformed by the same weapon quaternion.
    return {...empty,dip:-.10*weight,pitch:.22*weight,roll:-.40*weight,
      hand,prop:cylinder,handRoll:0,propVisible:frame.loaderVisible};
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
