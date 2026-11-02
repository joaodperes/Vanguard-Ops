/** Charge-based Wonder Weapons have no reserve ammo or manual reload.
 * Charges replenish over time (accelerated by ordinary kills) during each life.
 * Every actual respawn/recovery restores the full capacity and clears cooldowns.
 * Functions are deterministic, shared by client, server and tests.
 */
export interface WonderChargeState { charges: number; nextAt: number }
export interface WonderChargeRules {
  maxCharges: number;
  rechargeMs: number;
  killBonusMs: number;
}
export function fullWonderCharges(rules: WonderChargeRules): WonderChargeState {
  return { charges: rules.maxCharges, nextAt: 0 };
}

/** Restore full ammo at the start of a new life, without touching other players.
 * Client maps use unprefixed weapon IDs; the server uses `${playerId}:` as prefix.
 * Removing all prior entries for this owner also discards stale recharge timers
 * from previously equipped Wonders. Bulwark has no charge state (rules = null).
 */
export function resetWonderChargesOnRespawn(
  states: Map<string, WonderChargeState>,
  ownerPrefix: string,
  primaryWeaponId: string,
  rules: WonderChargeRules | null,
): WonderChargeState | null {
  for (const key of states.keys()) {
    if (key.startsWith(ownerPrefix)) states.delete(key);
  }
  if (!rules) return null;
  const full = fullWonderCharges(rules);
  states.set(ownerPrefix + primaryWeaponId, full);
  return full;
}
export function tickWonderCharges(state: WonderChargeState, rules: WonderChargeRules, now: number): WonderChargeState {
  let { charges, nextAt } = state;
  if (charges >= rules.maxCharges) return fullWonderCharges(rules);
  // Time may have advanced through several recharge cycles, even while dead.
  while (charges < rules.maxCharges && nextAt > 0 && now >= nextAt) {
    charges++;
    nextAt = charges < rules.maxCharges ? nextAt + rules.rechargeMs : 0;
  }
  return { charges, nextAt };
}
export function spendWonderCharge(state: WonderChargeState, rules: WonderChargeRules, now: number): WonderChargeState | null {
  const current = tickWonderCharges(state, rules, now);
  if (current.charges <= 0) return null;
  return {
    charges: current.charges - 1,
    nextAt: current.nextAt || now + rules.rechargeMs,
  };
}
export function accelerateWonderCharge(state: WonderChargeState, rules: WonderChargeRules, now: number): WonderChargeState {
  const current = tickWonderCharges(state, rules, now);
  if (current.charges === rules.maxCharges) return current;
  return tickWonderCharges(
    { ...current, nextAt: Math.max(now, current.nextAt - rules.killBonusMs) }, rules, now,
  );
}
export function wonderCooldownMs(state: WonderChargeState, rules: WonderChargeRules, now: number): number {
  const current = tickWonderCharges(state, rules, now);
  return current.charges === rules.maxCharges ? 0 : Math.max(0, current.nextAt - now);
}

/** Hellfire's three fuel-seconds must be available together before ignition.
 * On ignition, all fuel is committed; each second recharges sequentially.
 */
export function spendFullWonderCharge(
 state:WonderChargeState,rules:WonderChargeRules,now:number,
):WonderChargeState|null {
 const current=tickWonderCharges(state,rules,now);
 if(current.charges!==rules.maxCharges)return null;
 return {charges:0,nextAt:now+rules.rechargeMs};
}

/** One fuel-second is paid on demand by a real Hellfire shot.
 * Releasing the trigger calls nothing, so reserve charges cannot drain while
 * idle. A held 8Hz stream reuses its already-paid slice.
 */
export function spendHellfireFuelOnShot(
  state: WonderChargeState, rules: WonderChargeRules, now: number, paidThrough: number,
  stepMs=1000,
): { state: WonderChargeState; paidThrough: number } | null {
  const current=tickWonderCharges(state,rules,now);
  if(now<paidThrough)return {state:current,paidThrough};
  const next=spendWonderCharge(current,rules,now);
  return next?{state:next,paidThrough:now+stepMs}:null;
}
