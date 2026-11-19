import {db} from './db';
import {getOrCreatePlayer} from './player-service';
import {levelForXp} from './progression';
import {careerXpAfterMatch} from './career';
import {normalizeOperationProgress,recordOperation,operationById,operationFirstClearReward,operationActRewardForMission,OPERATIONS,type OperationProgress,type OperationState,type OperationFirstClearReward,type OperationActReward} from './operations';
const parse=(s:string)=>{try{return JSON.parse(s);}catch{return {};}};
export interface OperationProgressWriteResult {progress:OperationProgress;firstClearRewards:OperationFirstClearReward[];actRewards:OperationActReward[]}
export function mergeOperationProgress(a:OperationProgress,b:OperationProgress):OperationProgress {
 const next={...a};for(const [id,r] of Object.entries(b)){
  const old=next[id];const merged={stars:Math.max(old?.stars??0,r.stars),bestSeconds:Math.min(old?.bestSeconds??Infinity,r.bestSeconds),intel:!!old?.intel||r.intel,completions:Math.max(old?.completions??0,r.completions)};
  // Browser imports merge ratings only; first-clear entitlements belong to the database.
  if(old?.firstClearRewarded&&typeof old.firstClearXp==='number'&&typeof old.firstClearCredits==='number')
   Object.assign(merged,{firstClearRewarded:true,firstClearRunId:old.firstClearRunId,firstClearXp:old.firstClearXp,firstClearCredits:old.firstClearCredits});
  next[id]=merged;
 }return next;
}
async function reconcilePreviouslyCompletedActRewards(playerId:string,progress:OperationProgress){
 for(const mission of OPERATIONS){
  const reward=operationActRewardForMission(mission.id);
  if(!reward||!progress[mission.id]?.firstClearRewarded)continue;
  const player=await db.player.findUniqueOrThrow({where:{id:playerId},select:{operationsActRewards:true}});
  const stored=parse(player.operationsActRewards);
  const ids:string[]=Array.isArray(stored)?stored.filter((v):v is string=>typeof v==='string'):[];
  if(ids.includes(reward.id))continue;
  const committed=await db.$transaction(async tx=>{
   const updated=await tx.player.updateMany({where:{id:playerId,operationsActRewards:player.operationsActRewards},data:{operationsActRewards:JSON.stringify([...ids,reward.id])}});
   if(!updated.count)return false;
   if(reward.kind==='weapon')await tx.weaponUnlock.upsert({where:{playerId_weaponId:{playerId,weaponId:reward.itemId}},create:{playerId,weaponId:reward.itemId},update:{}});
   else if(reward.kind==='wonder')await tx.wonderUnlock.upsert({where:{playerId_weaponId:{playerId,weaponId:reward.itemId}},create:{playerId,weaponId:reward.itemId},update:{}});
   return true;
  });
  if(!committed)continue;
 }
}
export async function readOperationProgress(key:string){
 const p=await getOrCreatePlayer(key);
 const progress=normalizeOperationProgress(parse(p.operationsProgress));
 // Only DB-verified first-clear payout records qualify; imported browser progress
 // never carries firstClearRewarded and therefore cannot mint act rewards.
 await reconcilePreviouslyCompletedActRewards(p.id,progress);
 return progress;
}
export async function writeOperationProgress(key:string,input:{progress:OperationProgress}|{runId:string;state:OperationState;deaths:number}):Promise<OperationProgressWriteResult>{
 const player=await getOrCreatePlayer(key);
 for(let attempt=0;attempt<12;attempt++){
  const p=await db.player.findUniqueOrThrow({where:{id:player.id}});
  const old=normalizeOperationProgress(parse(p.operationsProgress));
  const parsed=parse(p.operationsRuns),runs:string[]=Array.isArray(parsed)?parsed:[];
  if('runId' in input&&(runs.includes(input.runId)||Object.values(old).some(r=>r.firstClearRunId===input.runId))){
   const firstClearRewards=Object.entries(old).flatMap(([missionId,r])=>r.firstClearRunId===input.runId&&r.firstClearRewarded&&typeof r.firstClearXp==='number'&&typeof r.firstClearCredits==='number'?[{missionId,xp:r.firstClearXp,credits:r.firstClearCredits}]:[]);
   return {progress:old,firstClearRewards,actRewards:[]};
  }
  let next:OperationProgress,firstClearRewards:OperationFirstClearReward[]=[],actRewards:OperationActReward[]=[];
  let newlyEarnedActReward:OperationActReward|undefined;
  if('progress' in input){
   next=mergeOperationProgress(old,input.progress);
  }else{
   const mission=operationById(input.state.missionId);
   if(!mission)return {progress:old,firstClearRewards:[],actRewards:[]};
   const firstClear=!old[mission.id]?.completions;
   next=recordOperation(old,input.state,input.deaths);
   if(firstClear){
    const reward=operationFirstClearReward(mission);
    next={...next,[mission.id]:{...next[mission.id],firstClearRewarded:true,firstClearRunId:input.runId,firstClearXp:reward.xp,firstClearCredits:reward.credits}};
    firstClearRewards.push({missionId:mission.id,...reward});
    const actReward=operationActRewardForMission(mission.id);
    const stored=parse(p.operationsActRewards);
    const earnedIds:string[]=Array.isArray(stored)?stored.filter((v):v is string=>typeof v==='string'):[];
    if(actReward&&!earnedIds.includes(actReward.id)){newlyEarnedActReward=actReward;actRewards.push(actReward);}
   }
  }
  const xp=firstClearRewards.reduce((sum,r)=>sum+r.xp,0),credits=firstClearRewards.reduce((sum,r)=>sum+r.credits,0);
  const stored=parse(p.operationsActRewards);
  const actRewardIds:string[]=Array.isArray(stored)?stored.filter((v):v is string=>typeof v==='string'):[];
  if(newlyEarnedActReward)actRewardIds.push(newlyEarnedActReward.id);
  const data={
   operationsProgress:JSON.stringify(next),
   operationsRuns:JSON.stringify('runId' in input?[...runs,input.runId].slice(-512):runs),
   operationsActRewards:JSON.stringify(actRewardIds),
   ...(xp>0?{xp:{increment:xp},credits:{increment:credits},level:levelForXp(p.xp+xp),careerXp:careerXpAfterMatch(p.careerXp,p.careerRank,p.xp,xp)}:{}),
  };
  const committed=await db.$transaction(async tx=>{
   const updated=await tx.player.updateMany({where:{id:p.id,operationsProgress:p.operationsProgress,operationsRuns:p.operationsRuns,operationsActRewards:p.operationsActRewards,xp:p.xp,careerXp:p.careerXp,careerRank:p.careerRank},data});
   if(!updated.count)return false;
   if(newlyEarnedActReward?.kind==='weapon'){
    await tx.weaponUnlock.upsert({where:{playerId_weaponId:{playerId:p.id,weaponId:newlyEarnedActReward.itemId}},create:{playerId:p.id,weaponId:newlyEarnedActReward.itemId},update:{}});
   }else if(newlyEarnedActReward?.kind==='wonder'){
    await tx.wonderUnlock.upsert({where:{playerId_weaponId:{playerId:p.id,weaponId:newlyEarnedActReward.itemId}},create:{playerId:p.id,weaponId:newlyEarnedActReward.itemId},update:{}});
   }
   return true;
  });
  if(committed)return {progress:next,firstClearRewards,actRewards};
 }
 throw Error('Campaign progress was updated concurrently; retry the request.');
}
