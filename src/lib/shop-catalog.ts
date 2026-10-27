export type ShopCurrency = "credits" | "career";
export type ShopKind = "weaponSkin" | "playerSkin";
export interface ShopItem {
  id:string; name:string; description:string; currency:ShopCurrency;
  cost:number; kind:ShopKind; skinId:string;
}
/** Server-authoritative fixed pricing. No gameplay stats or paid reticle selection. */
export const SHOP_ITEMS: readonly ShopItem[] = [
  { id:"cobalt_alloy",name:"Cobalt Alloy",description:"Per-weapon deep-blue alloy finish.",currency:"credits",cost:12000,kind:"weaponSkin",skinId:"shop_copper" },
  { id:"urban_ghost",name:"Urban Ghost",description:"Stealthy blue-grey operative uniform.",currency:"credits",cost:25000,kind:"playerSkin",skinId:"shop_urban" },
  { id:"void_circuit",name:"Void Circuit",description:"Per-weapon violet Career-exclusive finish.",currency:"career",cost:1,kind:"weaponSkin",skinId:"shop_void" },
  { id:"starlight_vanguard",name:"Starlight Vanguard",description:"Career-exclusive violet-and-lavender operative.",currency:"career",cost:2,kind:"playerSkin",skinId:"shop_phantom" },
] as const;
export function shopItemById(id:string):ShopItem|undefined { return SHOP_ITEMS.find(x=>x.id===id); }
export function shopItemKey(item:ShopItem,weaponId?:string):string {
  return item.id+(item.kind==="weaponSkin"?":"+(weaponId??""):"");
}
