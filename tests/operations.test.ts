import {describe,expect,test} from 'bun:test';
import {OPERATIONS,createOperationState,operationById,nextOperation,operationConfigValid,operationSite,operationTarget,tickOperation,operationEncounter,operationStars,recordOperation,operationUnlocked,loadOperationProgress,saveOperationProgress,type OperationActor,type OperationState} from '../src/lib/operations';
import {getMap,type Vec3} from '../src/lib/game-protocol';
import {makeEnvironmentMap} from '../src/lib/dynamic-environment';
import {botPositionEmbedded} from '../src/lib/bot-physics';
import {survivalRoleForSlot} from '../src/lib/survival-encounters';
import {roomMapCandidates,quickPlayRoom} from '../src/lib/room-flow';
import {makeEngineStub} from './helpers/engine-stub';
const actor=(pos:Vec3,id='human',alive=true):OperationActor=>({id,pos,alive});
const first=OPERATIONS[0],map=getMap(first.mapId,'survival');
function advance(s:OperationState,actors:OperationActor[],enemies:OperationActor[]=[],seconds=1){for(let i=0;i<seconds;i++)s=tickOperation(s,map,actors,enemies,1);return s;}
describe('Operations campaign',()=>{
 test('all missions have stable IDs, valid configurations and collision-clear sites',()=>{
  expect(new Set(OPERATIONS.map(m=>m.id)).size).toBe(OPERATIONS.length);expect(new Set(OPERATIONS.map(m=>m.act))).toEqual(new Set([1,2,3]));
  for(const m of OPERATIONS){
   expect(operationConfigValid({operationId:m.id,mode:'survival',mapId:m.mapId})).toBe(true);
   expect(operationConfigValid({operationId:m.id,mode:'ctf',mapId:m.mapId})).toBe(false);
   expect(operationConfigValid({operationId:m.id,mode:'survival',mapId:m.mapId,survivalTier:'elite'})).toBe(false);
   expect(getMap(m.mapId).id).toBe(m.mapId);const compiled=makeEnvironmentMap(getMap(m.mapId,'survival'));
   expect(m.objectives.at(-1)?.kind).toBe('extract');
   for(const g of [...m.objectives,{site:15}]){const p=operationSite(compiled,g.site);expect(p.every(Number.isFinite)).toBe(true);expect(botPositionEmbedded(compiled.cover,p)).toBe(false);}
   expect(operationEncounter(m,0,2).count).toBeGreaterThan(operationEncounter(m,0,1).count);
  }
  expect(operationById('__proto__')).toBeUndefined();expect(operationConfigValid({operationId:'missing',mode:'survival',mapId:'compound'})).toBe(false);
 });
 test('later campaign encounters reuse all specialist behaviours',()=>{
  const m=operationById('zero_hour')!,e=operationEncounter(m,0,2);
  const roles=new Set(Array.from({length:e.count},(_,i)=>survivalRoleForSlot(e.roleWave,i)).filter(Boolean));
  expect(roles.has('engineer')).toBe(true);expect(roles.has('disruptor')).toBe(true);
 });
 test('objectives reject empty squads, live guards, contesting enemies and other floors',()=>{
  const s={...createOperationState(first.id),stage:1},p=operationTarget(s,map)!;
  expect(advance(s,[]).progress).toBe(0);expect(advance(s,[actor([p[0],p[1]+8,p[2]])]).progress).toBe(0);
  expect(advance(s,[actor(p)],[actor(p,'guard')]).progress).toBe(0);expect(advance(s,[actor(p)],[],45).stage).toBe(2);
  expect(advance(s,[actor(p)],[actor([p[0]+40,p[1],p[2]],'guard')],50).stage).toBe(1);
 });
 test('packages need the carrier and a partner can recover a death drop',()=>{
  let s={...createOperationState(first.id),stage:2};const pickup=operationTarget(s,map)!;
  s=advance(s,[actor(pickup,'carrier')],[],5);expect(s.stage).toBe(3);expect(s.carrierId).toBe('carrier');const delivery=operationTarget(s,map)!;
  s=advance(s,[actor(pickup,'carrier'),actor(delivery,'partner')],[],10);expect(s.stage).toBe(3);expect(s.progress).toBe(0);
  s=advance(s,[actor(pickup,'carrier',false),actor(pickup,'partner')]);expect(s.carrierId).toBe('partner');
  s=advance(s,[actor(delivery,'partner')],[],8);expect(s.stage).toBe(4);expect(s.carrierId).toBeUndefined();
 });
 test('a disconnected carrier leaves the package at their last position',()=>{
  let s={...createOperationState(first.id),stage:3,carrierId:'carrier'};const p:Vec3=[22,0,11];
  s=advance(s,[actor(p,'carrier')]);s=advance(s,[actor([80,0,80],'partner')]);expect(s.carrierId).toBeUndefined();expect(s.packagePos).toEqual(p);
  s=advance(s,[actor(p,'partner')]);expect(s.carrierId).toBe('partner');
 });
 test('extraction needs all survivors and an uninterrupted timer',()=>{
  let s={...createOperationState(first.id),stage:4};const p=operationTarget(s,map)!,away:Vec3=[p[0]+20,p[1],p[2]];
  expect(advance(s,[actor(p),actor(away,'p2')],[],20).status).toBe('active');s=advance(s,[actor(p),actor(p,'p2')],[],6);expect(s.progress).toBe(6);
  s=advance(s,[actor(p),actor(away,'p2')]);expect(s.progress).toBe(0);s=advance(s,[actor(p),actor(away,'p2',false)],[],12);expect(s.status).toBe('won');expect(tickOperation(s,map,[],[],1)).toBe(s);
 });
 test('every mission has a valid solo and co-op completion path',()=>{
  for(const mission of OPERATIONS)for(const count of [1,2]){
   const m=getMap(mission.mapId,'survival');let s=createOperationState(mission.id),budget=2000;
   while(s.status==='active'&&budget-->0){const p=operationTarget(s,m)!;s=tickOperation(s,m,Array.from({length:count},(_,i)=>actor(p,'p'+i)),[],1);}
   expect(s.status).toBe('won');expect(s.stage).toBe(mission.objectives.length);
  }
 });
 test('defence pressure is bounded and a new pulse cannot be skipped by completion',()=>{
  const m=operationById('freight_intercept')!,mp=getMap(m.mapId);let s={...createOperationState(m.id),stage:2,stageElapsed:24.99,progress:74.99};const p=operationTarget(s,mp)!;
  s=tickOperation(s,mp,[actor(p)],[],.05);expect(s.pulse).toBe(1);expect(s.stage).toBe(2);
  s=tickOperation(s,mp,[actor(p)],[actor([p[0]+30,p[1],p[2]],'reinforcement')],1);expect(s.stage).toBe(2);
  s=tickOperation(s,mp,[actor(p)],[],1);expect(s.stage).toBe(3);expect(s.pulse).toBe(0);expect(s.stageElapsed).toBe(0);
  expect(tickOperation({...createOperationState(m.id),stage:2,stageElapsed:200},mp,[],[],1).pulse).toBe(3);
 });
 test('abort deadlines cannot award unlocks or stars',()=>{
  const s=tickOperation({...createOperationState(first.id),elapsed:first.parSeconds*2},map,[actor([0,0,0])],[actor([20,0,0],'guard')],1);
  expect(s.status).toBe('failed');expect(operationStars(first,s,0)).toBe(0);expect(recordOperation({},s,0)).toEqual({});
 });
 test('best ratings persist and only completed missions unlock successors',()=>{
  expect(operationUnlocked(first.id,{})).toBe(true);expect(operationUnlocked(OPERATIONS[1].id,{})).toBe(false);
  const won={...createOperationState(first.id),status:'won' as const,intel:true,elapsed:200};expect(operationStars(first,won,0)).toBe(3);let p=recordOperation({},won,0);expect(operationUnlocked(OPERATIONS[1].id,p)).toBe(true);
  p=recordOperation(p,{...won,elapsed:300,intel:false},2);expect(p[first.id]).toEqual({stars:3,bestSeconds:200,intel:true,completions:2});
  const guestProgress=recordOperation({}, {...won,missionId:'orbital_blackout'},0);expect(operationUnlocked('orbital_blackout',guestProgress)).toBe(true);expect(operationUnlocked('relay_siege',guestProgress)).toBe(true);
  expect(nextOperation(first.id)?.id).toBe(OPERATIONS[1].id);expect(nextOperation('missing')).toBeUndefined();expect(nextOperation(OPERATIONS.at(-1)!.id)).toBeUndefined();
 });
 test('storage validates records, isolates player keys, and exposes quota failure',()=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),storage=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)}});
  try{
   storage.set('vanguard_operations_p','null');expect(loadOperationProgress('p')).toEqual({});expect(saveOperationProgress('p',{...createOperationState(first.id),status:'won',elapsed:200,intel:true},0)).toBe(true);
   expect(loadOperationProgress('p')[first.id].stars).toBe(3);expect(loadOperationProgress('other')).toEqual({});storage.set('vanguard_operations_p',JSON.stringify({[first.id]:{stars:99,bestSeconds:-2,completions:1}}));expect(loadOperationProgress('p')).toEqual({});
   Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null,setItem:()=>{throw Error('quota');}}});expect(saveOperationProgress('p',createOperationState(first.id),0)).toBe(false);
  }finally{if(original)Object.defineProperty(globalThis,'localStorage',original);else Reflect.deleteProperty(globalThis,'localStorage');}
 });
 test('campaign maps stay fixed and Quick Play cannot select campaign rooms',()=>{
  expect(roomMapCandidates('survival','orbital_nexus',5,0,'orbital_blackout')).toEqual(['orbital_nexus']);
  expect(quickPlayRoom([{id:'campaign',mode:'survival',operationId:first.id,humans:1,capacity:2,hasPassword:false,state:'playing'} as any],'survival')).toBeUndefined();
 });
 test('offline play cannot auto-clear a mission after the last guard dies',()=>{
  const e=makeEngineStub();Object.assign(e,{opts:{mode:'survival',online:false},operation:{...createOperationState(first.id),stage:1},map,survivalWaveActive:true,survivalPrepLeft:0,survivalDowned:false,combatants:new Map(),selfId:'p',alive:true,survivalWave:2,matchEnded:false,bulletSpitters:new Map()});
  e.pos.set(1000,0,1000);e.updateSurvival(1);expect(e.survivalWaveActive).toBe(true);expect(e.operation.stage).toBe(1);
 });
});
