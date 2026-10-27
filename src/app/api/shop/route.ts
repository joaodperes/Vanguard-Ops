import { NextRequest,NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolvePlayerKey } from "@/lib/auth";
import { buildProfileView,getOrCreatePlayer } from "@/lib/player-service";
import { shopItemById,shopItemKey } from "@/lib/shop-catalog";
import { WEAPONS,levelForXp } from "@/lib/game-data";
import { MAX_PLAYER_LEVEL } from "@/lib/progression";
import { ownsWeapon } from "@/lib/collection-ownership";
import { cosmeticById } from "@/lib/cosmetics";

export const dynamic = "force-dynamic";
export async function POST(req:NextRequest){
  const body=await req.json().catch(()=>({}));
  const {playerKey}=await resolvePlayerKey(req,typeof body.playerKey==="string"?body.playerKey:undefined);
  if(!playerKey)return NextResponse.json({error:"playerKey required"},{status:400});
  const item=shopItemById(typeof body.itemId==="string"?body.itemId:"");
  if(!item)return NextResponse.json({error:"Unknown shop item"},{status:404});
  const player=await getOrCreatePlayer(playerKey);
  const weaponId=item.kind==="weaponSkin"&&typeof body.weaponId==="string"?body.weaponId:"";
  const weapon=WEAPONS.find(w=>w.id===weaponId && !w.wonder);
  if(item.kind==="weaponSkin"&&(!weapon||!ownsWeapon(weapon,levelForXp(player.xp),player.weaponUnlocks.map(w=>w.weaponId))))
    return NextResponse.json({error:"Select an owned regular weapon first"},{status:403});
  if(item.currency==="career"&&levelForXp(player.xp)<MAX_PLAYER_LEVEL)
    return NextResponse.json({error:"Career Shop opens at level 40"},{status:403});
  if(item.cosmeticId&&!cosmeticById(item.cosmeticId,
      item.kind==="reticle"?"reticle":item.kind==="charm"?"charm":"nameplate"))
    return NextResponse.json({error:"Invalid cosmetic catalog"},{status:500});
  const key=shopItemKey(item,weaponId);
  try{
    await db.$transaction(async tx=>{
      const owned=await tx.careerShopPurchase.findUnique({where:{playerId_itemKey:{playerId:player.id,itemKey:key}}});
      if(owned)throw new Error("OWNED");
      if(item.currency==="credits"){
        const paid=await tx.player.updateMany({
          where:{id:player.id,credits:{gte:item.cost}},
          data:{credits:{decrement:item.cost}},
        });
        if(paid.count!==1)throw new Error("NO_CREDITS");
      }else{
        const earned=await tx.careerReward.count({where:{playerId:player.id}});
        const state=await tx.player.findUniqueOrThrow({where:{id:player.id}});
        if(earned-state.careerTokensSpent<item.cost)throw new Error("NO_TOKENS");
        const locked=await tx.player.updateMany({
          where:{id:player.id,careerTokensSpent:state.careerTokensSpent},
          data:{careerTokensSpent:{increment:item.cost}},
        });
        if(locked.count!==1)throw new Error("NO_TOKENS");
      }
      if(item.kind==="weaponSkin"&&item.skinId)await tx.skinUnlock.upsert({
        where:{playerId_weaponId_skinId:{playerId:player.id,weaponId,skinId:item.skinId}},
        create:{playerId:player.id,weaponId,skinId:item.skinId},update:{},
      });
      else if(item.kind==="playerSkin"&&item.skinId)await tx.playerSkinUnlock.upsert({
        where:{playerId_skinId:{playerId:player.id,skinId:item.skinId}},
        create:{playerId:player.id,skinId:item.skinId},update:{},
      });
      await tx.careerShopPurchase.create({
        data:{playerId:player.id,itemKey:key,currency:item.currency,cost:item.cost},
      });
    });
  }catch(e){
    const code=(e as {code?:string})?.code;
    const msg=e instanceof Error?e.message:"";
    const table:Record<string,[string,number]>={
      OWNED:["Already owned",409],NO_CREDITS:["Not enough credits",403],NO_TOKENS:["Not enough Career Tokens",403],
    };
    const err=table[msg];
    if(err)return NextResponse.json({error:err[0]},{status:err[1]});
    if(code==="P2002")return NextResponse.json({error:"Already owned"},{status:409});
    throw e;
  }
  return NextResponse.json({ok:true,profile:await buildProfileView(playerKey)});
}
