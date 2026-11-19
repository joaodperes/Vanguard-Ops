"use client";
import {useGame} from './game-store';
import {toast} from 'sonner';
import {loadOperationProgress,normalizeOperationProgress,operationById,type OperationState,type OperationProgress,type OperationFirstClearReward} from './operations';
type Pending={runId:string;state:OperationState;deaths:number};
type SyncResult={progress:OperationProgress;firstClearRewards:OperationFirstClearReward[];actRewards:import("./operations").OperationActReward[]};
const queueKey=(key:string)=>'vanguard_operations_pending_'+key;
function pending(key:string):Pending[]{try{const p=JSON.parse(localStorage.getItem(queueKey(key))??'[]');return Array.isArray(p)?p.filter(v=>v&&typeof v.runId==='string'&&v.state&&typeof v.state==='object').map(v=>{const mission=operationById(v.state.missionId);const challengeStatus=mission?.optionalChallenge&&!['complete','failed'].includes(v.state.optionalChallengeStatus??'')?'failed':v.state.optionalChallengeStatus;return {...v,state:{...v.state,difficulty:['easy','normal','hard','veteran','mixed'].includes(v.state.difficulty)?v.state.difficulty:'normal',...(mission?.optionalChallenge?{optionalChallengeStatus:challengeStatus,optionalChallengeElapsed:v.state.optionalChallengeElapsed??mission.optionalChallenge.seconds,optionalChallengeKills:v.state.optionalChallengeKills??0}:{})}};}):[];}catch{return [];}}
async function send(key:string,payload:object):Promise<SyncResult>{
 if(useGame.getState().playerKey!==key)throw Error('Player account changed; sync cancelled.');
 const r=await fetch('/api/operations/progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({playerKey:key,...payload})});
 if(!r.ok)throw Error('Campaign progress could not sync. It will retry when you open Operations.');
 const data=await r.json().catch(()=>null);
 const firstClearRewards=Array.isArray(data?.firstClearRewards)?data.firstClearRewards.filter((v:any)=>typeof v?.missionId==='string'&&Number.isInteger(v.xp)&&v.xp>=0&&Number.isInteger(v.credits)&&v.credits>=0):[];
 const actRewards=Array.isArray(data?.actRewards)?data.actRewards.filter((v:any)=>Number.isInteger(v?.act)&&typeof v?.id==="string"&&typeof v?.name==="string"):[];
 return {progress:normalizeOperationProgress(data?.progress??data),firstClearRewards,actRewards};
}
export async function syncOperationProgress(key:string):Promise<SyncResult>{
 const rewards:OperationFirstClearReward[]=[];const actRewards:import("./operations").OperationActReward[]=[];let lastProgress:OperationProgress|undefined;
 const legacy=loadOperationProgress(key);
 if(Object.keys(legacy).length){const result=await send(key,{kind:'import',progress:legacy});lastProgress=result.progress;rewards.push(...result.firstClearRewards);actRewards.push(...result.actRewards);localStorage.removeItem('vanguard_operations_'+key);}
 for(const item of pending(key)){
  const result=await send(key,{kind:'complete',...item});lastProgress=result.progress;rewards.push(...result.firstClearRewards);actRewards.push(...result.actRewards);
  localStorage.setItem(queueKey(key),JSON.stringify(pending(key).filter(p=>p.runId!==item.runId)));
 }
 const unique=[...new Map(rewards.map(reward=>[reward.missionId,reward])).values()];
 try{
  const response=await fetch('/api/operations/progress?playerKey='+encodeURIComponent(key),{cache:'no-store'});
  if(!response.ok)throw Error('Unable to load account campaign progress.');
  return {progress:normalizeOperationProgress(await response.json()),firstClearRewards:unique,actRewards:[...new Map(actRewards.map(reward=>[reward.id,reward])).values()]};
 }catch(error){if(lastProgress)return {progress:lastProgress,firstClearRewards:unique,actRewards:[...new Map(actRewards.map(reward=>[reward.id,reward])).values()]};throw error;}
}
export async function saveAccountOperation(key:string,state:OperationState,deaths:number):Promise<OperationFirstClearReward[]>{
 const runId=typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
 const item={runId,state,deaths};
 try{localStorage.setItem(queueKey(key),JSON.stringify([...pending(key),item]));}
 catch{
  const result=await send(key,{kind:'complete',...item});
  for(const reward of result.actRewards)toast.success(`Act ${reward.act} reward unlocked`,{description:reward.name});
  return result.firstClearRewards;
 }
 const result=await syncOperationProgress(key);
 for(const reward of result.actRewards)toast.success(`Act ${reward.act} reward unlocked`,{description:reward.name});
 return result.firstClearRewards;
}
