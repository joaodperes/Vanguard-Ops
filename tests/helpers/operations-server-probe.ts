// Isolated room-lifecycle fixture: real sockets and server validation, scripted wins.
// Combat/objective rules are covered separately by operations.test.ts.
import {mock} from 'bun:test';
const ops=await import('../../src/lib/operations');
const tick=ops.tickOperation;
mock.module('../../src/lib/operations',()=>({...ops,tickOperation:(...args:Parameters<typeof tick>)=>{
 const state=tick(...args);
 return state.status==='active'&&state.elapsed>=1
  ? {...state,status:'won',stage:ops.operationById(state.missionId)!.objectives.length}:state;
}}));
const interval=globalThis.setInterval;
globalThis.setInterval=((fn:any,ms:number,...args:any[])=>interval(fn,ms===50?2:ms,...args)) as typeof setInterval;
const {startGameServer}=await import('../../src/lib/game-server');
await startGameServer(Number(process.env.OPERATIONS_TEST_PORT));
