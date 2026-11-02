import { NextRequest,NextResponse } from "next/server";
import { resolvePlayerKey } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrCreatePlayer,buildProfileView } from "@/lib/player-service";
import { cosmeticById,cosmeticShopOwnership,type CosmeticKind } from "@/lib/cosmetics";
import { WEAPONS } from "@/lib/game-data";

export const dynamic="force-dynamic";
/** Cosmetic designs are account-owned; reticles and charms equip in active loadout slots. */
export async function POST(req:NextRequest){
  const body=await req.json().catch(()=>({}));
  const {playerKey}=await resolvePlayerKey(req,typeof body.playerKey==="string"?body.playerKey:undefined);
  if(!playerKey)return NextResponse.json({error:"playerKey required"},{status:400});
  const kind=body.kind as CosmeticKind;
  const cosmeticId=typeof body.cosmeticId==="string"?body.cosmeticId:"";
  if(!["reticle","charm","nameplate"].includes(kind)||!cosmeticById(cosmeticId,kind))
    return NextResponse.json({error:"Unknown cosmetic option"},{status:400});
  const player=await getOrCreatePlayer(playerKey);
  const purchaseKeys=await db.careerShopPurchase.findMany({
    where:{playerId:player.id},select:{itemKey:true},
  });
  const owned=cosmeticShopOwnership(purchaseKeys.map(p=>p.itemKey));
  if(!owned.includes(cosmeticId))return NextResponse.json({error:"Buy this cosmetic in the Shop before equipping"},{status:403});
  if(kind==="nameplate")await db.player.update({where:{id:player.id},data:{selectedNameplate:cosmeticId}});
  else {
    const slot=body.slot;
    if(slot!=="primary"&&slot!=="secondary")
      return NextResponse.json({error:"Choose a primary or secondary loadout slot"},{status:400});
    if(!player.loadout)return NextResponse.json({error:"Equip a loadout first"},{status:409});
    const weaponId=slot==="primary"?player.loadout.primaryWeapon:player.loadout.secondaryWeapon;
    if(body.weaponId!==undefined&&body.weaponId!==weaponId)
      return NextResponse.json({error:"Equip this weapon before customizing it"},{status:409});
    const w=WEAPONS.find(x=>x.id===weaponId);
    if(!w||w.disabled||w.category==="melee")
      return NextResponse.json({error:"This weapon cannot equip that cosmetic"},{status:403});
    const field=slot==="primary"?(kind==="charm"?"primaryCharm":"primaryReticle")
      :(kind==="charm"?"secondaryCharm":"secondaryReticle");
    await db.loadout.update({where:{playerId:player.id},data:{[field]:cosmeticId,cosmeticsMigrated:true}});
  }
  return NextResponse.json({ok:true,profile:await buildProfileView(playerKey)});
}
