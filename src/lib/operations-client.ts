"use client";
import {useGame} from './game-store';
import {loadOperationProgress,normalizeOperationProgress,type OperationState,type OperationProgress} from './operations';
type Pending={runId:string;state:OperationState;deaths:number};
const queueKey=(key:string)=>'vanguard_operations_pending_'+key;
function pending(key:string):Pending[]{try{const p=JSON.parse(localStorage.getItem(queueKey(key))??'[]');return Array.isArray(p)?p:[];}catch{return [];}}
async function send(key:string,payload:object):Promise<OperationProgress>{
 if(useGame.getState().playerKey!==key)throw Error('Player account changed; sync cancelled.');
 const r=await fetch('/api/operations/progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({playerKey:key,...payload})});
 if(!r.ok)throw Error('Campaign progress could not sync. It will retry when you open Operations.');return normalizeOperationProgress(await r.json());
}
export async function syncOperationProgress(key:string):Promise<OperationProgress>{
 const legacy=loadOperationProgress(key);
 if(Object.keys(legacy).length){await send(key,{kind:'import',progress:legacy});localStorage.removeItem('vanguard_operations_'+key);}
 for(const item of pending(key)){
  await send(key,{kind:'complete',...item});
  localStorage.setItem(queueKey(key),JSON.stringify(pending(key).filter(p=>p.runId!==item.runId)));
 }
 const response=await fetch('/api/operations/progress?playerKey='+encodeURIComponent(key),{cache:'no-store'});
 if(!response.ok)throw Error('Unable to load account campaign progress.');return normalizeOperationProgress(await response.json());
}
export async function saveAccountOperation(key:string,state:OperationState,deaths:number){
 const runId=typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
 const item={runId,state,deaths};
 // Keep only an upload retry queue locally; the database owns campaign records.
 try{localStorage.setItem(queueKey(key),JSON.stringify([...pending(key),item]));}
 catch{await send(key,{kind:'complete',...item});return;}
 await syncOperationProgress(key);
}
