import type { AttachmentSlot } from "./game-data";
/** Persisted per-weapon customization. IDs are validated by the loadout API
 * before being restored; this module never grants ownership or entitlements. */
export type WeaponSetup = {
  skin:string;
  /** Optional Wonder-exclusive customization, persisted with the weapon itself. */
  moduleId?:string;
  killEffectId?:string;
  attachments:Record<AttachmentSlot,string|null>;
};
export type WeaponSetups = Record<string,WeaponSetup>;
export function parseWeaponSetups(raw:string|null|undefined):WeaponSetups {
  try{
    const obj=JSON.parse(raw||"{}");
    if(!obj||typeof obj!=="object"||Array.isArray(obj))return {};
    const out:WeaponSetups={};
    for(const [id,v] of Object.entries(obj)){
      if(!/^[a-z][a-z0-9_:.-]{0,63}$/.test(id)||!v||typeof v!=="object"||Array.isArray(v))continue;
      const input=v as Record<string,unknown>;
      const att=(input.attachments&&typeof input.attachments==="object"&&!Array.isArray(input.attachments)
        ?input.attachments:{}) as Record<string,unknown>;
      const safe=(k:AttachmentSlot)=>typeof att[k]==="string"?String(att[k]).slice(0,80):null;
      out[id]={skin:typeof input.skin==="string"?input.skin.slice(0,80):"default",
        moduleId:typeof input.moduleId==="string"?input.moduleId.slice(0,80):"",
        killEffectId:typeof input.killEffectId==="string"?input.killEffectId.slice(0,80):"",
        attachments:{sight:safe("sight"),barrel:safe("barrel"),grip:safe("grip"),magazine:safe("magazine")}};
    }
    return out;
  }catch{return {};}
}
export function rememberSetup(
  setups:WeaponSetups,id:string,skin:string,atts:string,
):void{
  let parsed:unknown;try{parsed=JSON.parse(atts)}catch{parsed={};}
  const value=parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:{} as Record<string,unknown>;
  const x=value as Record<string,unknown>;
  setups[id]={skin,attachments:{
    sight:typeof x.sight==="string"?x.sight:null,
    barrel:typeof x.barrel==="string"?x.barrel:null,
    grip:typeof x.grip==="string"?x.grip:null,
    magazine:typeof x.magazine==="string"?x.magazine:null,
  }};
}
