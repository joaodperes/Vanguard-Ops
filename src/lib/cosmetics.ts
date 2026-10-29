import {SHOP_ITEMS} from "./shop-catalog";
/** Cosmetic IDs and public presentation data. No reticle alters gameplay ballistics. */
export type CosmeticKind = "reticle" | "charm" | "nameplate";
export interface CosmeticDefinition { id:string; name:string; kind:CosmeticKind; color:string; symbol:string; description:string; }
export const COSMETICS:readonly CosmeticDefinition[]=[
  {id:"classic",name:"Classic Cross",kind:"reticle",color:"#22c55e",symbol:"+",description:"Standard four-armed hipfire sight. Always free."},
  {id:"dot",name:"Precision Dot",kind:"reticle",color:"#22c55e",symbol:"•",description:"Minimal central-dot hipfire sight. Always free."},
  {id:"reticle_orbit",name:"Orbit Ring",kind:"reticle",color:"#06b6d4",symbol:"◎",description:"Thin concentric targeting ring."},
  {id:"reticle_chevron",name:"Vanguard Chevron",kind:"reticle",color:"#fb923c",symbol:"⌃",description:"Angular chevron with two side ticks."},
  {id:"reticle_nova",name:"Nova Star",kind:"reticle",color:"#c084fc",symbol:"✧",description:"Elegant four-point luminous targeting star."},
  {id:"reticle_pulse",name:"Quantum Pulse",kind:"reticle",color:"#34d399",symbol:"◇",description:"Nested diamond around a precision center dot."},
  {id:"none",name:"No Charm",kind:"charm",color:"#94a3b8",symbol:"—",description:"Remove the decorative weapon charm."},
  {id:"charm_tag",name:"Vanguard Dog Tag",kind:"charm",color:"#94a3b8",symbol:"▣",description:"Metal identification tag on a short chain."},
  {id:"charm_skull",name:"Skull Token",kind:"charm",color:"#fbbf24",symbol:"☠",description:"Brass skull talisman and hanging mount."},
  {id:"charm_orb",name:"Nebula Orb",kind:"charm",color:"#a78bfa",symbol:"◉",description:"Iridescent cosmic orb in a steel clasp."},
  {id:"charm_reactor",name:"Reactor Core",kind:"charm",color:"#67e8f9",symbol:"⬡",description:"Tiny luminous hexagonal reactor module."},
  {id:"charm_casing",name:"Brass Casing",kind:"charm",color:"#eabf63",symbol:"▰",description:"Polished shell casing with a copper nose."},
  {id:"charm_dice",name:"Lucky Dice",kind:"charm",color:"#f8fafc",symbol:"⚄",description:"Ivory die with contrasting black pips."},
  {id:"charm_compass",name:"Field Compass",kind:"charm",color:"#62d0b0",symbol:"◈",description:"Pocket compass with a red direction needle."},
  {id:"charm_drone",name:"Scout Drone",kind:"charm",color:"#7dd3fc",symbol:"✣",description:"Miniature reconnaissance quadrotor."},
  {id:"charm_phoenix",name:"Phoenix Feather",kind:"charm",color:"#fb923c",symbol:"♨",description:"Copper-orange feather on a steel mount."},
  {id:"charm_prism",name:"Void Prism",kind:"charm",color:"#a78bfa",symbol:"◊",description:"Violet crystal suspended inside a clasp."},
  {id:"charm_solar",name:"Solar Emblem",kind:"charm",color:"#fbbf24",symbol:"☼",description:"Golden miniature sunburst medallion."},
  {id:"charm_satellite",name:"Orbital Satellite",kind:"charm",color:"#67e8f9",symbol:"✧",description:"Tiny satellite with twin solar panels."},
  {id:"reticle_spire",name:"Spire Sight",kind:"reticle",color:"#93c5fd",symbol:"^",description:"Upright precision sight."},
  {id:"standard",name:"Standard Nameplate",kind:"nameplate",color:"#94a3b8",symbol:"▭",description:"Unadorned readable player label. Always free."},
  {id:"plate_steel",name:"Steel Division",kind:"nameplate",color:"#cbd5e1",symbol:"⬒",description:"Riveted graphite frame and silver trim."},
  {id:"plate_crimson",name:"Crimson Command",kind:"nameplate",color:"#fb7185",symbol:"◆",description:"Deep scarlet command banner with steel edges."},
  {id:"plate_eventide",name:"Eventide Crest",kind:"nameplate",color:"#c4b5fd",symbol:"✦",description:"Celestial purple frame with star accents."},
  {id:"plate_legend",name:"Vanguard Legend",kind:"nameplate",color:"#fbbf24",symbol:"★",description:"Gold-enamel champion nameplate with a crown motif."},
];
export const DEFAULT_COSMETICS={reticle:"classic",charm:"none",nameplate:"standard"} as const;
export function cosmeticById(id:string,kind?:CosmeticKind):CosmeticDefinition|undefined{
 return COSMETICS.find(c=>c.id===id&&(!kind||c.kind===kind));
}
export function parseEquippedCharms(raw:unknown):Record<string,string>{
 try{
   const obj=typeof raw==="string"?JSON.parse(raw):raw;
   if(!obj||typeof obj!=="object"||Array.isArray(obj))return {};
   return Object.fromEntries(Object.entries(obj).filter(([weaponId,id])=>
     /^[a-z][a-z0-9_]{1,63}$/.test(weaponId)&&typeof id==="string"&&!!cosmeticById(id,"charm")).slice(0,90)) as Record<string,string>;
 }catch{return {};}
}
export function cosmeticShopOwnership(keys:readonly string[]):string[]{
 const owned=new Set(["classic","dot","none","standard"]);
 for(const item of SHOP_ITEMS)if(["reticle","charm","nameplate"].includes(item.kind)&&keys.includes(item.id)&&item.cosmeticId)owned.add(item.cosmeticId);
 return [...owned];
}
