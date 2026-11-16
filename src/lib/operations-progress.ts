import {db} from './db';
import {getOrCreatePlayer} from './player-service';
import {levelForXp} from './progression';
import {careerXpAfterMatch} from './career';
import {normalizeOperationProgress,recordOperation,operationById,operationFirstClearReward,type OperationProgress,type OperationState,type OperationFirstClearReward} from './operations';
const parse=(s:string)=>{try{return JSON.parse(s);}catch{return {};}};
export interface OperationProgressWriteResult {progress:OperationProgress;firstClearRewards:OperationFirstClearReward[]}
export function mergeOperationProgress(a:OperationProgress,b:OperationProgress):OperationProgress {
 const next={...a};for(const [id,r] of Object.entries(b)){
  const old=next[id];const merged={stars:Math.max(old?.stars??0,r.stars),bestSeconds:Math.min(old?.bestSeconds??Infinity,r.bestSeconds),intel:!!old?.intel||r.intel,completions:Math.max(old?.completions??0,r.completions)};
  // Browser imports merge ratings only; first-clear entitlements belong to the database.
  if(old?.firstClearRewarded&&typeof old.firstClearXp==='number'&&typeof old.firstClearCredits==='number')
   Object.assign(merged,{firstClearRewarded:true,firstClearRunId:old.firstClearRunId,firstClearXp:old.firstClearXp,firstClearCredits:old.firstClearCredits});
  next[id]=merged;
 }return next;
}
export async function readOperationProgress(key:string){
 const p=await getOrCreatePlayer(key);return normalizeOperationProgress(parse(p.operationsProgress));
}
export async function writeOperationProgress(key:string,input:{progress:OperationProgress}|{runId:string;state:OperationState;deaths:number}):Promise<OperationProgressWriteResult>{
 const player=await getOrCreatePlayer(key);
 for(let attempt=0;attempt<12;attempt++){
  const p=await db.player.findUniqueOrThrow({where:{id:player.id}});
  const old=normalizeOperationProgress(parse(p.operationsProgress));
  const parsed=parse(p.operationsRuns),runs:string[]=Array.isArray(parsed)?parsed:[];
  if('runId' in input&&(runs.includes(input.runId)||Object.values(old).some(r=>r.firstClearRunId===input.runId))){
   const firstClearRewards=Object.entries(old).flatMap(([missionId,r])=>r.firstClearRunId===input.runId&&r.firstClearRewarded&&typeof r.firstClearXp==='number'&&typeof r.firstClearCredits==='number'?[{missionId,xp:r.firstClearXp,credits:r.firstClearCredits}]:[]);
   return {progress:old,firstClearRewards};
  }
  let next:OperationProgress,firstClearRewards:OperationFirstClearReward[]=[];
  if('progress' in input){
   next=mergeOperationProgress(old,input.progress);
  }else{
   const mission=operationById(input.state.missionId);
   if(!mission)return {progress:old,firstClearRewards:[]};
   const firstClear=!old[mission.id]?.completions;
   next=recordOperation(old,input.state,input.deaths);
   if(firstClear){
    const reward=operationFirstClearReward(mission);
    next={...next,[mission.id]:{...next[mission.id],firstClearRewarded:true,firstClearRunId:input.runId,firstClearXp:reward.xp,firstClearCredits:reward.credits}};
    firstClearRewards.push({missionId:mission.id,...reward});
   }
  }
  const xp=firstClearRewards.reduce((sum,r)=>sum+r.xp,0),credits=firstClearRewards.reduce((sum,r)=>sum+r.credits,0);
  const data={
   operationsProgress:JSON.stringify(next),
   operationsRuns:JSON.stringify('runId' in input?[...runs,input.runId].slice(-512):runs),
   ...(xp>0?{xp:{increment:xp},credits:{increment:credits},level:levelForXp(p.xp+xp),careerXp:careerXpAfterMatch(p.careerXp,p.careerRank,p.xp,xp)}:{}),
  };
  const updated=await db.player.updateMany({where:{id:p.id,operationsProgress:p.operationsProgress,operationsRuns:p.operationsRuns},data});
  if(updated.count)return {progress:next,firstClearRewards};
 }
 throw Error('Campaign progress was updated concurrently; retry the request.');
}
