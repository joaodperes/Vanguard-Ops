/** A Wonder Weapon has NO reserve ammo. Each spent charge refills only after
 * its own timer; the timer survives death and can be shortened by ordinary kills.
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
