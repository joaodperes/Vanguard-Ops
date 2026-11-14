import {test,expect} from 'bun:test';
import {useGame} from '../src/lib/game-store';
import {saveAccountOperation,syncOperationProgress} from '../src/lib/operations-client';
import {createOperationState,OPERATIONS} from '../src/lib/operations';
test('campaign sync migrates legacy records and retains failed uploads for idempotent retry',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),oldFetch=globalThis.fetch,oldKey=useGame.getState().playerKey;
 const values=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)}});
 useGame.setState({playerKey:'test-player'});let fail=true;const writes:any[]=[];
 globalThis.fetch=(async(_url:any,init:any)=>{if(init?.body){const body=JSON.parse(init.body);writes.push(body);if(fail)return new Response('{}',{status:503});}return Response.json({});}) as typeof fetch;
 try{
  const state={...createOperationState(OPERATIONS[0].id),status:'won' as const,stage:5,elapsed:123,intel:true};
  await expect(saveAccountOperation('test-player',state,0)).rejects.toThrow();
  const queued=JSON.parse(values.get('vanguard_operations_pending_test-player')!);expect(queued).toHaveLength(1);
  fail=false;await syncOperationProgress('test-player');expect(JSON.parse(values.get('vanguard_operations_pending_test-player')!)).toEqual([]);
  expect(writes[0].runId).toBe(writes[1].runId);
  values.set('vanguard_operations_test-player',JSON.stringify({silent_entry:{stars:3,bestSeconds:123,intel:true,completions:2}}));
  await syncOperationProgress('test-player');expect(values.has('vanguard_operations_test-player')).toBe(false);expect(writes.at(-1).kind).toBe('import');
 }finally{globalThis.fetch=oldFetch;useGame.setState({playerKey:oldKey});if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage');}
});
