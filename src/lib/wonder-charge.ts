/** Charge-based Wonder Weapons have no reserve ammo or manual reload.
 * Ordinary kills accelerate charges; time advances across death and while holstered.
 * Matches and loadout changes begin empty with a fresh cooldown; deaths do not refill.
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

/** On a genuine in-match loadout change, the new Wonder must recharge from zero. */
export function drainedWonderCharges(rules: WonderChargeRules, now: number): WonderChargeState {
  return { charges: 0, nextAt: now + rules.rechargeMs };
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
/** Refund an already-spent shot on a confirmed precision headshot.
 * Preserve the next recharge deadline unless this restores full capacity. */
export function refundWonderCharge(state: WonderChargeState, rules: WonderChargeRules, now: number): WonderChargeState {
  const current=tickWonderCharges(state,rules,now);
  const charges=Math.min(rules.maxCharges,current.charges+1);
  return {charges,nextAt:charges===rules.maxCharges?0:current.nextAt};
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
