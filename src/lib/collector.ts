import { WEAPONS, ATTACHMENTS, WEAPON_SKINS, PLAYER_SKINS, compatibleAttachments, weaponAttachmentSlots } from "./game-data";
import { ownsWeapon, ownsOperativeSkin, ownsWeaponSkin } from "./collection-ownership";
type CollectionProfile = {
  level:number; unlockedWeapons:readonly string[];
  ownedAttachments:Readonly<Record<string,readonly string[]>>;
  ownedWeaponSkins:Readonly<Record<string,readonly string[]>>;
  ownedOperators:readonly string[];
};
export interface CollectorProgress {
  total:number; owned:number; percent:number;
  weapons:{owned:number;total:number};
  attachments:{owned:number;total:number};
  weaponSkins:{owned:number;total:number};
  operatorSkins:{owned:number;total:number};
}
/** Count individual usable (weapon, attachment) and (weapon, skin) combinations.
 * Exclude all token-only content, including Wonder weapons and Career-only shop
 * variants, from BOTH numerator and denominator. Standard default finishes
 * count only when the corresponding regular weapon is owned.
 */
export function collectorProgress(p:CollectionProfile):CollectorProgress {
  const regularWeapons=WEAPONS.filter(w=>!w.wonder);
  const collectibleSkins=WEAPON_SKINS.filter(s=>s.shopCurrency!=="career");
  const collectibleOperators=PLAYER_SKINS.filter(s=>s.shopCurrency!=="career");
  const weapons={total:regularWeapons.length,owned:0};
  const attachments={total:0,owned:0};
  const weaponSkins={total:0,owned:0};
  const operatorSkins={total:collectibleOperators.length,owned:0};
  for(const weapon of regularWeapons){
    const owned=ownsWeapon(weapon,p.level,p.unlockedWeapons);
    if(owned)weapons.owned++;
    const possible=new Set<string>();
    for(const slot of weaponAttachmentSlots(weapon)){
      for(const id of compatibleAttachments(weapon.id,slot)){
        const def=ATTACHMENTS.find(a=>a.id===id);
        if(def)possible.add(id);
      }
    }
    attachments.total+=possible.size;
    if(owned)attachments.owned+=(p.ownedAttachments[weapon.id]??[]).filter(id=>possible.has(id)).length;
    weaponSkins.total+=collectibleSkins.length;
    if(owned)weaponSkins.owned+=collectibleSkins.filter(s=>ownsWeaponSkin(weapon.id,s.id,p.level,p.unlockedWeapons,p.ownedWeaponSkins,WEAPONS)).length;
  }
  operatorSkins.owned=collectibleOperators.filter(s=>ownsOperativeSkin(s,p.level,p.ownedOperators)).length;
  const total=weapons.total+attachments.total+weaponSkins.total+operatorSkins.total;
  const obtained=weapons.owned+attachments.owned+weaponSkins.owned+operatorSkins.owned;
  return {total,owned:obtained,percent:total>0?Math.floor(obtained/total*100):0,
    weapons,attachments,weaponSkins,operatorSkins};
}
