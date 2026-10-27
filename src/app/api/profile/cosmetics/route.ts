import { NextRequest,NextResponse } from "next/server";
import { resolvePlayerKey } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrCreatePlayer,buildProfileView } from "@/lib/player-service";
import { cosmeticById,DEFAULT_COSMETICS,parseEquippedCharms,cosmeticShopOwnership,type CosmeticKind } from "@/lib/cosmetics";
import { WEAPONS,levelForXp } from "@/lib/game-data";
import { ownsWeapon } from "@/lib/collection-ownership";

export const dynamic="force-dynamic";
/** Cosmetics are permanent account purchases, with a separate selection for
 * each owned weapon's dangling charm. Never accept a client price or currency.
 * Reset/clear is always free; only catalog-owned items may be equipped. */
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
  if(kind==="reticle")await db.player.update({where:{id:player.id},data:{selectedReticle:cosmeticId}});
  if(kind==="nameplate")await db.player.update({where:{id:player.id},data:{selectedNameplate:cosmeticId}});
  if(kind==="charm"){
    const weaponId=typeof body.weaponId==="string"?body.weaponId:"";
    const w=WEAPONS.find(w=>w.id===weaponId);
    if(!w||w.wonder||w.category==="melee"||!ownsWeapon(w,levelForXp(player.xp),player.weaponUnlocks.map(row=>row.weaponId)))
      return NextResponse.json({error:"Equip an owned regular ranged weapon to attach a charm"},{status:403});
    // A per-player transaction serializes this RMW update so other equipped
    // weapons retain their charms when changing a single weapon.
    await db.$transaction(async tx=>{
      const current=await tx.player.findUniqueOrThrow({where:{id:player.id},select:{equippedCharms:true}});
      const mapping=parseEquippedCharms(current.equippedCharms);
      if(cosmeticId===DEFAULT_COSMETICS.charm)delete mapping[weaponId];
      else mapping[weaponId]=cosmeticId;
      await tx.player.update({where:{id:player.id},data:{equippedCharms:JSON.stringify(mapping)}});
    });
  }
  return NextResponse.json({ok:true,profile:await buildProfileView(playerKey)});
}
