import { WONDER_MODULES, WONDER_FINISHES, WONDER_KILL_EFFECTS } from "./wonder-expansion";
export type ShopCurrency = "credits" | "career" | "wonder";
export type ShopKind = "weaponSkin" | "playerSkin" | "reticle" | "charm" | "nameplate" | "wonderModule" | "wonderSkin" | "wonderKillEffect";
export interface ShopItem {
  id:string; name:string; description:string; currency:ShopCurrency;
  cost:number; kind:ShopKind; skinId?:string; cosmeticId?:string; wonderWeaponId?:string; moduleId?:string;
}

const WONDER_SHOP_ITEMS:ShopItem[]=[
 ...WONDER_MODULES.map(m=>({id:"module_"+m.id,name:m.name,description:m.description,currency:"wonder" as const,cost:m.cost,kind:"wonderModule" as const,wonderWeaponId:m.wonderWeaponId,moduleId:m.id})),
 ...["wonder_singularity","wonder_corrosion","wonder_turret","wonder_deadlock","wonder_hellfire","wonder_stormweaver","wonder_cluster","wonder_riot_shield","wonder_phasebreaker","wonder_chrono","wonder_seismic","wonder_phantom","wonder_whiteout","wonder_ripper","wonder_juggernaut"].flatMap(wonderWeaponId=>[
   ...WONDER_FINISHES.map(f=>({id:f.id+"_"+wonderWeaponId,name:f.name,description:f.description,currency:"wonder" as const,cost:f.cost,kind:"wonderSkin" as const,skinId:f.id,wonderWeaponId})),
   ...WONDER_KILL_EFFECTS.map(e=>({id:e.id+"_"+wonderWeaponId,name:e.name,description:e.description,currency:"wonder" as const,cost:e.cost,kind:"wonderKillEffect" as const,cosmeticId:e.id,wonderWeaponId})),
 ]),
];
/** Server-authoritative fixed pricing. Existing aim settings remain free. */
export const SHOP_ITEMS: readonly ShopItem[] = [
  { id:"cobalt_alloy",name:"Cobalt Alloy",description:"Per-weapon deep-blue alloy finish.",currency:"credits",cost:3000,kind:"weaponSkin",skinId:"shop_copper" },
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
  {id:"frostbite",name:"Frostbite",description:"Frostbite cosmetic.",currency:"credits",cost:2600,kind:"weaponSkin",skinId:"shop_frostbite"},
  {id:"dune_striker",name:"Dune Striker",description:"Dune Striker cosmetic.",currency:"credits",cost:2900,kind:"weaponSkin",skinId:"shop_dune"},
  {id:"voltage_grid",name:"Voltage Grid",description:"Voltage Grid cosmetic.",currency:"credits",cost:3400,kind:"weaponSkin",skinId:"shop_voltage"},
  {id:"emberline",name:"Emberline",description:"Emberline cosmetic.",currency:"career",cost:1,kind:"weaponSkin",skinId:"shop_emberline"},
  {id:"aurora_veil",name:"Aurora Veil",description:"Aurora Veil cosmetic.",currency:"career",cost:1,kind:"weaponSkin",skinId:"shop_aurora"},
  {id:"royal_obsidian",name:"Royal Obsidian",description:"Royal Obsidian cosmetic.",currency:"career",cost:1,kind:"weaponSkin",skinId:"shop_royal"},
  {id:"ash_wraith",name:"Ash Wraith",description:"Ash Wraith cosmetic.",currency:"credits",cost:9500,kind:"playerSkin",skinId:"shop_wraith"},
  {id:"sandstorm_scout",name:"Sandstorm Scout",description:"Sandstorm Scout cosmetic.",currency:"credits",cost:10500,kind:"playerSkin",skinId:"shop_sandstorm"},
  {id:"tidebreaker",name:"Tidebreaker",description:"Tidebreaker cosmetic.",currency:"credits",cost:11500,kind:"playerSkin",skinId:"shop_tide"},
  {id:"solar_sentinel",name:"Solar Sentinel",description:"Solar Sentinel cosmetic.",currency:"career",cost:1,kind:"playerSkin",skinId:"shop_sentinel"},
  {id:"ion_phantom",name:"Ion Phantom",description:"Ion Phantom cosmetic.",currency:"career",cost:1,kind:"playerSkin",skinId:"shop_ion"},
  {id:"verdant_guard",name:"Verdant Guard",description:"Verdant Guard cosmetic.",currency:"career",cost:1,kind:"playerSkin",skinId:"shop_verdant"},
  {id:"spire_sight",name:"Spire Sight",description:"Spire Sight cosmetic.",currency:"credits",cost:2800,kind:"reticle",cosmeticId:"reticle_spire"},
  {id:"trident_reticle",name:"Trident",description:"Trident cosmetic.",currency:"credits",cost:3100,kind:"reticle",cosmeticId:"reticle_trident"},
  {id:"eclipse_halo",name:"Eclipse Halo",description:"Eclipse Halo cosmetic.",currency:"career",cost:1,kind:"reticle",cosmeticId:"reticle_eclipse"},
  {id:"helix_reticle",name:"Helix",description:"Helix cosmetic.",currency:"career",cost:1,kind:"reticle",cosmeticId:"reticle_helix"},
  {id:"boreal_unit",name:"Boreal Unit",description:"Boreal Unit cosmetic.",currency:"credits",cost:6200,kind:"nameplate",cosmeticId:"plate_boreal"},
  {id:"dusk_raider",name:"Dusk Raider",description:"Dusk Raider cosmetic.",currency:"credits",cost:7800,kind:"nameplate",cosmeticId:"plate_dusk"},
  {id:"nebula_commander",name:"Nebula Commander",description:"Nebula Commander cosmetic.",currency:"career",cost:1,kind:"nameplate",cosmeticId:"plate_nebula"},
  {id:"orbital_vanguard",name:"Orbital Vanguard",description:"Orbital Vanguard cosmetic.",currency:"career",cost:1,kind:"nameplate",cosmeticId:"plate_orbital"},
  {id:"verdant_signal",name:"Verdant Signal",description:"Emerald telemetry-grid nameplate for signal specialists.",currency:"credits",cost:9000,kind:"nameplate",cosmeticId:"plate_verdant_signal"},
  {id:"cinder_guard",name:"Cinder Guard",description:"Copper-orange frontline command pennant.",currency:"credits",cost:13500,kind:"nameplate",cosmeticId:"plate_cinder_guard"},
  {id:"umbra_cipher",name:"Umbra Cipher",description:"Career-exclusive indigo cipher-diamond frame.",currency:"career",cost:1,kind:"nameplate",cosmeticId:"plate_umbra_cipher"},
  {id:"auric_horizon",name:"Auric Horizon",description:"Career-exclusive pale-gold sunburst command frame.",currency:"career",cost:2,kind:"nameplate",cosmeticId:"plate_auric_horizon"},
  {id:"thunderbolt",name:"Thunderbolt",description:"Thunderbolt cosmetic.",currency:"credits",cost:4900,kind:"charm",cosmeticId:"charm_bolt"},
  {id:"deepwater_anchor",name:"Deepwater Anchor",description:"Deepwater Anchor cosmetic.",currency:"credits",cost:5400,kind:"charm",cosmeticId:"charm_anchor"},
  {id:"micro_rocket",name:"Micro Rocket",description:"Micro Rocket cosmetic.",currency:"career",cost:1,kind:"charm",cosmeticId:"charm_rocket"},
  {id:"lunar_crescent",name:"Lunar Crescent",description:"Lunar Crescent cosmetic.",currency:"career",cost:1,kind:"charm",cosmeticId:"charm_moon"},
  ...WONDER_SHOP_ITEMS,
] as const;
export function shopItemById(id:string):ShopItem|undefined { return SHOP_ITEMS.find(x=>x.id===id); }
export function shopItemKey(item:ShopItem,weaponId?:string):string {
  return item.id+(item.kind==="weaponSkin"?":"+(weaponId??""):"");
}

// Shop category taxonomy; only matching currency groups appear in each sidebar.
export const SHOP_CATEGORIES = [
  {id:"all",label:"All"},
  {id:"weaponSkin",label:"Weapon finishes"},
  {id:"playerSkin",label:"Operatives"},
  {id:"reticle",label:"Reticles"},
  {id:"charm",label:"Charms"},
  {id:"nameplate",label:"Nameplates"},
  {id:"wonderModule",label:"Wonder modules"},
  {id:"wonderSkin",label:"Wonder finishes"},
  {id:"wonderKillEffect",label:"Wonder kill effects"},
] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number]["id"];
/** Only display categories with stock in the selected shop. */
export function shopCategoriesForCurrency(currency:ShopCurrency){
  return SHOP_CATEGORIES.filter(group=>(group.id==="all"&&currency!=="wonder")||
    SHOP_ITEMS.some(item=>item.currency===currency&&item.kind===group.id));
}
export function shopCategoryLabel(currency:ShopCurrency,category:ShopCategory):string{
  if(currency==="wonder")return ({
    all:"All",wonderModule:"Modules",wonderSkin:"Finishes",wonderKillEffect:"Kill effects",
  } as Partial<Record<ShopCategory,string>>)[category]??category;
  return SHOP_CATEGORIES.find(group=>group.id===category)?.label??category;
}
export function shopItemsForCategory(currency:ShopCurrency,category:ShopCategory):ShopItem[]{
  return SHOP_ITEMS.filter(item=>item.currency===currency&&(category==="all"||item.kind===category));
}

/** Purchase states are mutually exclusive, with ownership taking precedence. */
export type ShopPurchaseStatus = "owned" | "weapon-locked" | "career-locked" |
  "credits-short" | "tokens-short" | "available";
export function shopPurchaseStatus(item:ShopItem,options:{
  owned:boolean;weaponOwned:boolean;careerUnlocked:boolean;credits:number;careerTokens:number;wonderTokens?:number;
}):ShopPurchaseStatus{
  if(options.owned)return "owned";
  if((item.kind==="weaponSkin"||item.kind==="wonderModule"||item.kind==="wonderSkin"||item.kind==="wonderKillEffect")&&!options.weaponOwned)return "weapon-locked";
  if(item.currency==="career"&&!options.careerUnlocked)return "career-locked";
  if(item.currency==="credits"&&options.credits<item.cost)return "credits-short";
  if(item.currency==="career"&&options.careerTokens<item.cost)return "tokens-short";
  if(item.currency==="wonder"&&(options.wonderTokens??0)<item.cost)return "tokens-short";
  return "available";
}
