"use client";
import {useGame} from './game-store';
import {loadOperationProgress,normalizeOperationProgress,type OperationState,type OperationProgress,type OperationFirstClearReward} from './operations';
type Pending={runId:string;state:OperationState;deaths:number};
type SyncResult={progress:OperationProgress;firstClearRewards:OperationFirstClearReward[]};
const queueKey=(key:string)=>'vanguard_operations_pending_'+key;
function pending(key:string):Pending[]{try{const p=JSON.parse(localStorage.getItem(queueKey(key))??'[]');return Array.isArray(p)?p:[];}catch{return [];}}
async function send(key:string,payload:object):Promise<SyncResult>{
 if(useGame.getState().playerKey!==key)throw Error('Player account changed; sync cancelled.');
 const r=await fetch('/api/operations/progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({playerKey:key,...payload})});
 if(!r.ok)throw Error('Campaign progress could not sync. It will retry when you open Operations.');
 const data=await r.json().catch(()=>null);
 const firstClearRewards=Array.isArray(data?.firstClearRewards)?data.firstClearRewards.filter((v:any)=>typeof v?.missionId==='string'&&Number.isInteger(v.xp)&&v.xp>=0&&Number.isInteger(v.credits)&&v.credits>=0):[];
 return {progress:normalizeOperationProgress(data?.progress??data),firstClearRewards};
}
export async function syncOperationProgress(key:string):Promise<SyncResult>{
 const rewards:OperationFirstClearReward[]=[];let lastProgress:OperationProgress|undefined;
 const legacy=loadOperationProgress(key);
 if(Object.keys(legacy).length){const result=await send(key,{kind:'import',progress:legacy});lastProgress=result.progress;rewards.push(...result.firstClearRewards);localStorage.removeItem('vanguard_operations_'+key);}
 for(const item of pending(key)){
  const result=await send(key,{kind:'complete',...item});lastProgress=result.progress;rewards.push(...result.firstClearRewards);
  localStorage.setItem(queueKey(key),JSON.stringify(pending(key).filter(p=>p.runId!==item.runId)));
 }
 const unique=[...new Map(rewards.map(reward=>[reward.missionId,reward])).values()];
 const response=await fetch('/api/operations/progress?playerKey='+encodeURIComponent(key),{cache:'no-store'});
 if(!response.ok){if(lastProgress)return {progress:lastProgress,firstClearRewards:unique};throw Error('Unable to load account campaign progress.');}
 try{return {progress:normalizeOperationProgress(await response.json()),firstClearRewards:unique};}
 catch{if(lastProgress)return {progress:lastProgress,firstClearRewards:unique};throw Error('Unable to load account campaign progress.');}
}
export async function saveAccountOperation(key:string,state:OperationState,deaths:number):Promise<OperationFirstClearReward[]>{
 const runId=typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
 const item={runId,state,deaths};
 try{localStorage.setItem(queueKey(key),JSON.stringify([...pending(key),item]));}
 catch{const result=await send(key,{kind:'complete',...item});return result.firstClearRewards;}
 return (await syncOperationProgress(key)).firstClearRewards;
}
