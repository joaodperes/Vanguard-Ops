import {db} from './db';
import {getOrCreatePlayer} from './player-service';
import {normalizeOperationProgress,recordOperation,type OperationProgress,type OperationState} from './operations';
const parse=(s:string)=>{try{return JSON.parse(s);}catch{return {};}};
export function mergeOperationProgress(a:OperationProgress,b:OperationProgress):OperationProgress {
 const next={...a};for(const [id,r] of Object.entries(b)){
  const old=next[id];next[id]=old?{stars:Math.max(old.stars,r.stars),bestSeconds:Math.min(old.bestSeconds,r.bestSeconds),intel:old.intel||r.intel,completions:Math.max(old.completions,r.completions)}:r;
 }return next;
}
export async function readOperationProgress(key:string){
 const p=await getOrCreatePlayer(key);return normalizeOperationProgress(parse(p.operationsProgress));
}
export async function writeOperationProgress(key:string,input:{progress:OperationProgress}|{runId:string;state:OperationState;deaths:number}){
 const player=await getOrCreatePlayer(key);
 for(let attempt=0;attempt<12;attempt++){
  const p=await db.player.findUniqueOrThrow({where:{id:player.id}});
  const old=normalizeOperationProgress(parse(p.operationsProgress));
  const parsed=parse(p.operationsRuns),runs:string[]=Array.isArray(parsed)?parsed:[];
  if('runId' in input&&runs.includes(input.runId))return old;
  const next='progress' in input?mergeOperationProgress(old,input.progress):recordOperation(old,input.state,input.deaths);
  const updated=await db.player.updateMany({where:{id:p.id,operationsProgress:p.operationsProgress,operationsRuns:p.operationsRuns},data:{operationsProgress:JSON.stringify(next),operationsRuns:JSON.stringify('runId' in input?[...runs,input.runId].slice(-512):runs)}});
  if(updated.count)return next;
 }throw Error('Campaign progress was updated concurrently; retry the request.');
}
