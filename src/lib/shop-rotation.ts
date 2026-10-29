import {SHOP_CATEGORIES,SHOP_ITEMS,type ShopCurrency,type ShopKind,type ShopItem} from "./shop-catalog";

export const DAILY_SHOP_SLOTS=3;
/** All players share this UTC rotation, regardless of login, time zone or server node. */
export interface DailyShopRotation {dayKey:string;refreshAt:string;itemIds:string[];}
function hash(input:string):number {
  let value=2166136261;
  for(let i=0;i<input.length;i++) value=Math.imul(value^input.charCodeAt(i),16777619);
  return value>>>0;
}
function candidates(currency:ShopCurrency,kind:ShopKind):ShopItem[]{
  return SHOP_ITEMS.filter(item=>item.currency===currency&&item.kind===kind)
    .sort((a,b)=>hash(a.id+"|shop-v1")-hash(b.id+"|shop-v1")||a.id.localeCompare(b.id));
}
export function dailyShopRotation(now:Date=new Date()):DailyShopRotation {
  const year=now.getUTCFullYear(),month=now.getUTCMonth(),day=now.getUTCDate();
  const dayNumber=Math.floor(Date.UTC(year,month,day)/86400000);
  const itemIds:string[]=[];
  for(const currency of ["credits","career"] as const){
    for(const section of SHOP_CATEGORIES){
      if(section.id==="all")continue;
      const pool=candidates(currency,section.id);
      if(pool.length===0)continue;
      const offset=hash(currency+":"+section.id)%pool.length;
      const start=((dayNumber+offset)%pool.length+pool.length)%pool.length;
      for(let i=0;i<Math.min(DAILY_SHOP_SLOTS,pool.length);i++){
        itemIds.push(pool[(start+i)%pool.length].id);
      }
    }
  }
  return {
    dayKey:`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`,
    refreshAt:new Date(Date.UTC(year,month,day+1)).toISOString(),
    itemIds
  };
}
export function isShopItemFeatured(id:string,now:Date=new Date()):boolean{
  return dailyShopRotation(now).itemIds.includes(id);
}
