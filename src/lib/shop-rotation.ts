import {WEAPONS} from "./game-data";
import {SHOP_CATEGORIES,SHOP_ITEMS,type ShopCurrency,type ShopKind,type ShopItem} from "./shop-catalog";

export const DAILY_SHOP_SLOTS=3;
/** Each offer is an exact product. Weapon finishes include the assigned weapon.
 * Clients cannot choose the weapon attached to a daily finish offer. */
export interface DailyShopOffer {itemId:string;weaponId?:string;}
export interface DailyShopRotation {dayKey:string;refreshAt:string;itemIds:string[];offers:DailyShopOffer[];}
function hash(input:string):number{
  let value=2166136261;
  for(let i=0;i<input.length;i++)value=Math.imul(value^input.charCodeAt(i),16777619);
  return value>>>0;
}
function candidates(currency:ShopCurrency,kind:ShopKind):ShopItem[]{
  return SHOP_ITEMS.filter(item=>item.currency===currency&&item.kind===kind)
    .sort((a,b)=>hash(a.id+"|shop-v1")-hash(b.id+"|shop-v1")||a.id.localeCompare(b.id));
}
const eligibleWeapons=WEAPONS.filter(w=>!w.wonder&&!w.disabled&&w.category!=="melee")
  .map(w=>w.id).sort((a,b)=>hash(a+"|weapon-offers")-hash(b+"|weapon-offers")||a.localeCompare(b));
export function dailyShopRotation(now:Date=new Date()):DailyShopRotation{
  const year=now.getUTCFullYear(),month=now.getUTCMonth(),day=now.getUTCDate();
  const dayNumber=Math.floor(Date.UTC(year,month,day)/86400000);
  const offers:DailyShopOffer[]=[];
  for(const currency of ["credits","career"] as const){
    for(const section of SHOP_CATEGORIES){
      if(section.id==="all")continue;
      const pool=candidates(currency,section.id);
      if(pool.length===0)continue;
      const offset=hash(currency+":"+section.id)%pool.length;
      const start=((dayNumber+offset)%pool.length+pool.length)%pool.length;
      for(let i=0;i<Math.min(DAILY_SHOP_SLOTS,pool.length);i++){
        const item=pool[(start+i)%pool.length];
        if(item.kind==="weaponSkin"){
          // Rotate weapon assignments independently of the skin catalog.
          // Every player receives the SAME weapon+finish pair on a given day.
          const seed=hash(item.id+"|"+currency+"|weapon-rotation");
          const weaponIndex=(seed+dayNumber*3+i)%eligibleWeapons.length;
          offers.push({itemId:item.id,weaponId:eligibleWeapons[(weaponIndex+eligibleWeapons.length)%eligibleWeapons.length]});
        }else offers.push({itemId:item.id});
      }
    }
  }
  return {
    dayKey:`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`,
    refreshAt:new Date(Date.UTC(year,month,day+1)).toISOString(),
    itemIds:offers.map(o=>o.itemId),offers,
  };
}
export function isShopOfferFeatured(id:string,weaponId:string|undefined,now:Date=new Date()):boolean{
  return dailyShopRotation(now).offers.some(o=>o.itemId===id&&o.weaponId===weaponId);
}
export function isShopItemFeatured(id:string,now:Date=new Date()):boolean{
  return dailyShopRotation(now).itemIds.includes(id);
}
