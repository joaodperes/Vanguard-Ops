import type { WeaponCategory, WeaponStats } from "./game-data";

/** Shared distance-aware AI stance. These choices are identical in the offline
 * simulation and on the authoritative multiplayer server. */
export interface BotCombatDecision {
  idealDistance: number;
  sprinting: boolean;
  aiming: boolean;
}

export function botIdealDistance(category: WeaponCategory): number {
  switch (category) {
    case "shotgun": return 8;    // get close enough for pellets to matter
    case "smg":
    case "pdw": return 11;
    case "sniper": return 25;   // retain sightlines instead of rushing a target
    case "dmr": return 21;
    case "melee": return 2.5;
    default: return 14;
  }
}

/** Sprint when traveling or closing a gap, not while holding a firing lane.
 * Shotguns/SMGs can rush into effective range; precision weapons instead
 * settle and shoot at distances where their shots are useful. */
export function botCombatDecision(
  category: WeaponCategory,
  distance: number,
  clearShot: boolean,
  reacted: boolean,
  adsSettled: boolean,
  hasAmmo: boolean,
  reloading: boolean,
): BotCombatDecision {
  const idealDistance = botIdealDistance(category);
  const closingGap = distance > idealDistance + 5;
  const closeRangeRush = (category === "shotgun" && distance > 15)
    || ((category === "smg" || category === "pdw" || category === "melee") && distance > 20);
  const sprinting = hasAmmo && !reloading && closingGap
    && (!clearShot || closeRangeRush || distance > (category === "sniper" ? 65 : category === "dmr" ? 52 : 38));

  const aimsAtRange = category === "sniper" ? distance >= 7
    : category === "dmr" ? distance >= 10
    : category === "shotgun" ? distance >= 9 && distance <= 26
    : category === "assault" || category === "lmg" ? distance >= 17
    : category === "smg" || category === "pdw" ? distance >= 19
    : category === "pistol" ? distance >= 16
    : false;
  return {
    idealDistance,
    sprinting,
    aiming: aimsAtRange && clearShot && reacted && adsSettled
      && hasAmmo && !reloading && !sprinting,
  };
}

export function botPatrolSprint(distanceToWaypoint: number): boolean {
  return distanceToWaypoint > 8;
}

/** ADS only changes the weapon's mechanical spread. Per-bot reaction time,
 * drift, distance penalty and deliberate miss chance remain separate. */
export function botShotSpread(stats: Pick<WeaponStats, "spread" | "adsSpread">, aiming: boolean): number {
  return aiming ? stats.adsSpread : stats.spread;
}
