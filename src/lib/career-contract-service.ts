import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { careerContractOffer, careerContractDelta, freshCareerXp, CAREER_REQUIRED_COMPLETIONS, type CareerMatchEvidence } from "./career-contracts";
import { levelForXp, MAX_PLAYER_LEVEL } from "./progression";

export class CareerContractError extends Error {
  constructor(message:string, public status=403){super(message);}
}
type CareerDatabase = typeof db | Prisma.TransactionClient;
export async function ensureCareerContracts(client:CareerDatabase,playerId:string,cycle:number) {
  const defs=careerContractOffer(cycle);
  // Unique upserts allow concurrent profile refreshes without duplicate tasks.
  for(const def of defs)await client.careerContract.upsert({
    where:{playerId_cycle_contractId:{playerId,cycle,contractId:def.id}},
    create:{playerId,cycle,contractId:def.id,goal:def.goal},update:{},
  });
}
export async function careerContractsView(player:{id:string;xp:number;careerTokensSpent:number}) {
  const unlocked=levelForXp(player.xp)>=MAX_PLAYER_LEVEL;
  const earned=await db.careerReward.count({where:{playerId:player.id}});
  if(unlocked)await ensureCareerContracts(db,player.id,earned);
  const saved=unlocked ? await db.careerContract.findMany({
    where:{playerId:player.id,cycle:earned},orderBy:{contractId:"asc"},
  }):[];
  const defs=careerContractOffer(earned);
  const contracts=defs.map(d=>{
    const row=saved.find(x=>x.contractId===d.id);
    const progress=Math.max(0,Math.min(row?.progress??0,row?.goal??d.goal));
    return {...d,progress,completed:row?.completed??false};
  });
  const completed=contracts.filter(c=>c.completed).length;
  return {
    unlocked,unlockLevel:MAX_PLAYER_LEVEL,cycle:earned+1,
    tokens:Math.max(0,earned-player.careerTokensSpent),earnedTokens:earned,
    completed,required:CAREER_REQUIRED_COMPLETIONS,canClaim:unlocked&&completed>=CAREER_REQUIRED_COMPLETIONS,
    contracts,
  };
}
/** Only completed matches update active contracts. A recorded claim is never
 * recalculated from a mutable XP total, nor can progress count twice. */
export async function recordCareerMatch(
  tx:Prisma.TransactionClient,playerId:string,previousXp:number,earnedXp:number,evidence:CareerMatchEvidence,
) {
  if(levelForXp(previousXp+earnedXp)<MAX_PLAYER_LEVEL)return;
  const cycle=await tx.careerReward.count({where:{playerId}});
  await ensureCareerContracts(tx,playerId,cycle);
  const contracts=await tx.careerContract.findMany({where:{playerId,cycle,completed:false}});
  const freshXp=freshCareerXp(previousXp,earnedXp);
  for(const contract of contracts){
    const delta=careerContractDelta(contract.contractId,evidence,freshXp);
    if(!delta)continue;
    const progress=Math.min(contract.goal,contract.progress+delta);
    await tx.careerContract.updateMany({
      where:{id:contract.id,completed:false},
      data:{progress,completed:progress>=contract.goal},
    });
  }
}
export async function claimCareerContractToken(playerId:string) {
  await db.$transaction(async tx=>{
    const player=await tx.player.findUniqueOrThrow({where:{id:playerId}});
    if(levelForXp(player.xp)<MAX_PLAYER_LEVEL)throw new CareerContractError("Reach level 40 before Career Contracts");
    const cycle=await tx.careerReward.count({where:{playerId}});
    const completed=await tx.careerContract.count({where:{playerId,cycle,completed:true}});
    if(completed<CAREER_REQUIRED_COMPLETIONS)throw new CareerContractError("Complete three active Career Contracts first");
    try{await tx.careerReward.create({data:{playerId,cycle}});}
    catch(e){if((e as {code?:string})?.code==="P2002")throw new CareerContractError("Career Token already claimed",409);throw e;}
  });
}
