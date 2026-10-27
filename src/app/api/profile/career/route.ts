import { NextRequest, NextResponse } from "next/server";
import { resolvePlayerKey } from "@/lib/auth";
import { buildProfileView, getOrCreatePlayer } from "@/lib/player-service";
import { CareerContractError, claimCareerContractToken } from "@/lib/career-contract-service";

export const dynamic = "force-dynamic";
/** Claim one earned Career Token after three of five long-term contracts. */
export async function POST(req:NextRequest){
  const body=await req.json().catch(()=>({}));
  const {playerKey}=await resolvePlayerKey(req,typeof body.playerKey==="string"?body.playerKey:undefined);
  if(!playerKey)return NextResponse.json({error:"playerKey required"},{status:400});
  const player=await getOrCreatePlayer(playerKey);
  try{await claimCareerContractToken(player.id);}
  catch(e){if(e instanceof CareerContractError)return NextResponse.json({error:e.message},{status:e.status});throw e;}
  return NextResponse.json(await buildProfileView(playerKey));
}
