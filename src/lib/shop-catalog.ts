export type ShopCurrency = "credits" | "career";
export type ShopKind = "weaponSkin" | "playerSkin" | "reticle" | "charm" | "nameplate";
export interface ShopItem {
  id:string; name:string; description:string; currency:ShopCurrency;
  cost:number; kind:ShopKind; skinId?:string; cosmeticId?:string;
}
/** Server-authoritative fixed pricing. Existing aim settings remain free. */
export const SHOP_ITEMS: readonly ShopItem[] = [
  { id:"cobalt_alloy",name:"Cobalt Alloy",description:"Per-weapon deep-blue alloy finish.",currency:"credits",cost:12000,kind:"weaponSkin",skinId:"shop_copper" },
  { id:"urban_ghost",name:"Urban Ghost",description:"Stealthy blue-grey operative uniform.",currency:"credits",cost:25000,kind:"playerSkin",skinId:"shop_urban" },
  { id:"void_circuit",name:"Void Circuit",description:"Per-weapon violet Career-exclusive finish.",currency:"career",cost:1,kind:"weaponSkin",skinId:"shop_void" },
  { id:"starlight_vanguard",name:"Starlight Vanguard",description:"Career-exclusive violet-and-lavender operative.",currency:"career",cost:2,kind:"playerSkin",skinId:"shop_phantom" },
  { id:"orbit_ring",name:"Orbit Ring",description:"Alternative cyan hipfire reticle; colors and sizing remain free.",currency:"credits",cost:3500,kind:"reticle",cosmeticId:"reticle_orbit" },
  { id:"vanguard_chevron",name:"Vanguard Chevron",description:"Alternative angular hipfire reticle.",currency:"credits",cost:3500,kind:"reticle",cosmeticId:"reticle_chevron" },
  { id:"nova_star",name:"Nova Star",description:"Exclusive celestial hipfire reticle design.",currency:"career",cost:1,kind:"reticle",cosmeticId:"reticle_nova" },
  { id:"quantum_pulse",name:"Quantum Pulse",description:"Exclusive diamond precision cosmetic reticle.",currency:"career",cost:1,kind:"reticle",cosmeticId:"reticle_pulse" },
  { id:"vanguard_dog_tag",name:"Vanguard Dog Tag",description:"Metal tag dangling from any chosen weapon.",currency:"credits",cost:6000,kind:"charm",cosmeticId:"charm_tag" },
  { id:"skull_token",name:"Skull Token",description:"Brass skull pendant for your arsenal.",currency:"credits",cost:9500,kind:"charm",cosmeticId:"charm_skull" },
  { id:"nebula_orb",name:"Nebula Orb",description:"Career-exclusive cosmic miniature orb.",currency:"career",cost:1,kind:"charm",cosmeticId:"charm_orb" },
  { id:"reactor_core",name:"Reactor Core",description:"Career-exclusive luminous reactor charm.",currency:"career",cost:1,kind:"charm",cosmeticId:"charm_reactor" },
  { id:"steel_division",name:"Steel Division",description:"Riveted silver-edged profile nameplate.",currency:"credits",cost:7500,kind:"nameplate",cosmeticId:"plate_steel" },
  { id:"crimson_command",name:"Crimson Command",description:"Scarlet banner and steel profile frame.",currency:"credits",cost:10000,kind:"nameplate",cosmeticId:"plate_crimson" },
  { id:"eventide_crest",name:"Eventide Crest",description:"Career-exclusive violet starfield nameplate.",currency:"career",cost:1,kind:"nameplate",cosmeticId:"plate_eventide" },
  { id:"vanguard_legend",name:"Vanguard Legend",description:"Career-exclusive gold champion nameplate.",currency:"career",cost:2,kind:"nameplate",cosmeticId:"plate_legend" },
  { id:"brass_casing",name:"Brass Casing",description:"Miniature brass cartridge with copper tip.",currency:"credits",cost:4200,kind:"charm",cosmeticId:"charm_casing" },
  { id:"lucky_dice",name:"Lucky Dice",description:"Ivory lucky-six die on a short chain.",currency:"credits",cost:5800,kind:"charm",cosmeticId:"charm_dice" },
  { id:"field_compass",name:"Field Compass",description:"Pocket compass with a red pointer.",currency:"credits",cost:7200,kind:"charm",cosmeticId:"charm_compass" },
  { id:"scout_drone",name:"Scout Drone",description:"Tiny quadrotor hanging from your rifle.",currency:"credits",cost:8900,kind:"charm",cosmeticId:"charm_drone" },
  { id:"phoenix_feather",name:"Phoenix Feather",description:"Bright copper-orange wing feather.",currency:"credits",cost:11500,kind:"charm",cosmeticId:"charm_phoenix" },
  { id:"void_prism",name:"Void Prism",description:"Violet faceted crystal. Career exclusive.",currency:"career",cost:1,kind:"charm",cosmeticId:"charm_prism" },
  { id:"solar_emblem",name:"Solar Emblem",description:"Gold sunburst medallion. Career exclusive.",currency:"career",cost:1,kind:"charm",cosmeticId:"charm_solar" },
  { id:"orbital_satellite",name:"Orbital Satellite",description:"Miniature satellite. Career exclusive.",currency:"career",cost:2,kind:"charm",cosmeticId:"charm_satellite" },
] as const;
export function shopItemById(id:string):ShopItem|undefined { return SHOP_ITEMS.find(x=>x.id===id); }
export function shopItemKey(item:ShopItem,weaponId?:string):string {
  return item.id+(item.kind==="weaponSkin"?":"+(weaponId??""):"");
}

// Stable Shop sections shared by Credit and Career Token tabs.
export const SHOP_CATEGORIES = [
  {id:"all",label:"All"},
  {id:"weaponSkin",label:"Weapon finishes"},
  {id:"playerSkin",label:"Operatives"},
  {id:"reticle",label:"Reticles"},
  {id:"charm",label:"Charms"},
  {id:"nameplate",label:"Nameplates"},
] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number]["id"];
export function shopItemsForCategory(currency:ShopCurrency,category:ShopCategory):ShopItem[]{
  return SHOP_ITEMS.filter(item=>item.currency===currency&&(category==="all"||item.kind===category));
}
