/** Melee-slot throwing knives (the persistent legacy ID is `baton`).
 * They are distinct from the tactical `knives` consumable. Only the melee
 * catalog controls this weapon's magazine and range. Don't merge inventories.
 */
import weaponsData from "../data/catalogs/weapons.json";
export const THROWING_KNIVES_ID = "baton";
const meleeKnife = weaponsData.find(w=>w.id===THROWING_KNIVES_ID);
if(!meleeKnife || meleeKnife.special?.kind!=="throwing_knife")
  throw new Error("Missing melee-slot throwing knife weapon definition");
export const THROWING_KNIFE_RANGE: number = meleeKnife.stats.range;
export const THROWING_KNIFE_MAX_CHARGES: number = meleeKnife.stats.magSize;
export const THROWING_KNIFE_GUNGAME_RECHARGE_MS = 5000;
export const THROWING_KNIFE_SPEED = 30;
export const isThrowingKnife = (id:string):boolean => id===THROWING_KNIVES_ID;
export interface ThrowingKnifeCharges {charges:number;nextAt:number}
export const fullThrowingKnives = ():ThrowingKnifeCharges => ({charges:THROWING_KNIFE_MAX_CHARGES,nextAt:0});
/** Normal matches refill only on death. Gun Game restores one charge per timer. */
export function tickThrowingKnives(state:ThrowingKnifeCharges,now:number,gunGame:boolean):ThrowingKnifeCharges{
  if(!gunGame||state.charges>=THROWING_KNIFE_MAX_CHARGES||!state.nextAt||now<state.nextAt)return state;
  const restored=Math.min(THROWING_KNIFE_MAX_CHARGES-state.charges,1+Math.floor((now-state.nextAt)/THROWING_KNIFE_GUNGAME_RECHARGE_MS));
  const charges=state.charges+restored;
  return {charges,nextAt:charges>=THROWING_KNIFE_MAX_CHARGES?0:state.nextAt+restored*THROWING_KNIFE_GUNGAME_RECHARGE_MS};
}
export function spendThrowingKnife(state:ThrowingKnifeCharges,now:number,gunGame:boolean):ThrowingKnifeCharges|null{
  const ready=tickThrowingKnives(state,now,gunGame);
  if(ready.charges<=0)return null;
  return {charges:ready.charges-1,nextAt:gunGame&&!ready.nextAt?now+THROWING_KNIFE_GUNGAME_RECHARGE_MS:ready.nextAt};
}
export const throwingKnifeRemainingMs=(state:ThrowingKnifeCharges,now:number,gunGame:boolean):number =>
  gunGame&&state.charges<THROWING_KNIFE_MAX_CHARGES?Math.max(0,state.nextAt-now):0;
