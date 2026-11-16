import {describe,expect,test} from 'bun:test';
import {OPERATIONS,OPERATION_DEADLINE_SECONDS,operationFirstClearReward,createOperationState,operationById,nextOperation,operationConfigValid,operationSite,operationTarget,tickOperation,operationEncounter,operationAwarenessMultiplier,operationStars,operationStarCriteria,recordOperation,operationUnlocked,loadOperationProgress,type OperationActor,type OperationState} from '../src/lib/operations';
import {getMap,type Vec3} from '../src/lib/game-protocol';
import {makeEnvironmentMap} from '../src/lib/dynamic-environment';
import {botPositionEmbedded} from '../src/lib/bot-physics';
import {survivalRoleForSlot} from '../src/lib/survival-encounters';
import {makeEngineStub} from './helpers/engine-stub';
const actor=(pos:Vec3,id='human',alive=true,kills=0):OperationActor=>({id,pos,alive,kills});
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
   expect(operationEncounter(m,0).count).toBe(4+m.intensity);
  }
  expect(operationById('__proto__')).toBeUndefined();expect(operationConfigValid({operationId:'missing',mode:'survival',mapId:'compound'})).toBe(false);
 });
 test('every mission has a distinct authored optional intel objective at a valid site',()=>{
  const labels=OPERATIONS.map(m=>m.optionalObjective.label);
  expect(new Set(labels).size).toBe(OPERATIONS.length);
  for(const mission of OPERATIONS){
   expect(mission.optionalObjective.label.length).toBeGreaterThan(0);
   const compiled=makeEnvironmentMap(getMap(mission.mapId,'survival'));
   const site=operationSite(compiled,mission.optionalObjective.site);
   expect(mission.objectives.some(objective=>objective.site===mission.optionalObjective.site)).toBe(false);
   expect(site.every(Number.isFinite)).toBe(true);
   expect(botPositionEmbedded(compiled.cover,site)).toBe(false);
   let state=createOperationState(mission.id);
   state=tickOperation(state,compiled,[actor(site)],[],1);
   expect(state.intel).toBe(true);
  }
 });
 test('later campaign encounters reuse all specialist behaviours',()=>{
  const m=operationById('zero_hour')!,e=operationEncounter(m,0);
  const roles=new Set(Array.from({length:e.count},(_,i)=>survivalRoleForSlot(e.roleWave,i)).filter(Boolean));
  expect(roles.has('engineer')).toBe(true);expect(roles.has('disruptor')).toBe(true);
 });
 test('objectives reject empty squads, live guards, contesting enemies and other floors',()=>{
  const s={...createOperationState(first.id),stage:1},p=operationTarget(s,map)!;
  expect(advance(s,[]).progress).toBe(0);expect(advance(s,[actor([p[0],p[1]+8,p[2]])]).progress).toBe(0);
  expect(advance(s,[actor(p)],[actor(p,'guard')]).progress).toBe(0);expect(advance(s,[actor(p)],[],45).stage).toBe(2);
  expect(advance(s,[actor(p)],[actor([p[0]+40,p[1],p[2]],'guard')],50).stage).toBe(1);
 });
 test('solo carrier can recover their own dropped package and deliver it',()=>{
  let s={...createOperationState(first.id),stage:2};const pickup=operationTarget(s,map)!;
  s=advance(s,[actor(pickup,'solo')],[],5);expect(s.stage).toBe(3);expect(s.carrierId).toBe('solo');
  s=advance(s,[actor(pickup,'solo',false)]);expect(s.carrierId).toBeUndefined();expect(s.packagePos).toEqual(pickup);
  s=advance(s,[actor(pickup,'solo')]);expect(s.carrierId).toBe('solo');
  const delivery=operationTarget(s,map)!;s=advance(s,[actor(delivery,'solo')],[],8);expect(s.stage).toBe(4);expect(s.carrierId).toBeUndefined();
 });
 test('solo extraction needs the operator at the site for an uninterrupted timer',()=>{
  let s={...createOperationState(first.id),stage:4};const p=operationTarget(s,map)!,away:Vec3=[p[0]+20,p[1],p[2]];
  expect(advance(s,[actor(away)],[],20).status).toBe('active');s=advance(s,[actor(p)],[],6);expect(s.progress).toBe(6);
  s=advance(s,[actor(away)]);expect(s.progress).toBe(0);s=advance(s,[actor(p)],[],12);expect(s.status).toBe('won');
  expect(tickOperation(s,map,[],[],1)).toBe(s);
 });
 test('co-op squads share intel and extraction requires every living operative',()=>{
  const mission=OPERATIONS[0],compiled=getMap(mission.mapId,'survival');
  const intel=operationSite(compiled,mission.optionalObjective.site);
  let s=createOperationState(mission.id);
  s=tickOperation(s,compiled,[actor([intel[0]+20,intel[1],intel[2]],'host'),actor(intel,'partner')],[],1);
  expect(s.intel).toBe(true);
  s={...createOperationState(mission.id),stage:4};
  const exit=operationTarget(s,compiled)!,away:Vec3=[exit[0]+20,exit[1],exit[2]];
  s=advance(s,[actor(exit,'host'),actor(away,'partner')],[],12);
  expect(s.status).toBe('active');expect(s.progress).toBe(0);
  s=advance(s,[actor(exit,'host'),actor(exit,'partner')],[],12);
  expect(s.status).toBe('won');
 });
 test('every mission has a valid solo completion path',()=>{
  for(const mission of OPERATIONS){
   const m=getMap(mission.mapId,'survival');let s=createOperationState(mission.id),budget=2000;
   while(s.status==='active'&&budget-->0){const p=operationTarget(s,m)!;s=tickOperation(s,m,[actor(p,'solo')],[],1);}
   expect(s.status).toBe('won');expect(s.stage).toBe(mission.objectives.length);
  }
 });
 test('every defence objective holds for two minutes under seven reinforcement pulses',()=>{
  const stages=OPERATIONS.flatMap(m=>m.objectives.flatMap((objective,index)=>objective.kind==='defend'?[{mission:m,index}]:[]));
  expect(stages.length).toBeGreaterThan(0);
  for(const {mission,index} of stages){
   const mp=getMap(mission.mapId,'survival'),base={...createOperationState(mission.id),stage:index},p=operationTarget(base,mp)!;
   const guard=actor([p[0]+2,p[1],p[2]],'guard');let s=base;const pulses=new Set<number>();
   for(let second=1;second<=120;second++){
    s=tickOperation(s,mp,[actor(p)],[guard],1);
    pulses.add(s.pulse);
    expect(s.stage).toBe(index);
    expect(s.stageElapsed).toBe(second);
    expect(s.progress).toBe(second);
    expect(s.pulse).toBe(Math.min(7,Math.floor(second/15)));
   }
   expect([...pulses]).toEqual([0,1,2,3,4,5,6,7]);
   expect(s.pulse).toBe(7);
   // The hold is complete, but a living defender still blocks stage completion.
   s=tickOperation(s,mp,[actor(p)],[guard],1);
   expect(s.stage).toBe(index);
   // Clearing the final guard completes the hold without another timer delay.
   s=tickOperation(s,mp,[actor(p)],[],1);
   expect(s.stage).toBe(index+1);
   expect(s.pulse).toBe(0);
   expect(s.stageElapsed).toBe(0);
  }
 });
 test('abort deadlines cannot award unlocks or stars',()=>{
  const s=tickOperation({...createOperationState(first.id),elapsed:OPERATION_DEADLINE_SECONDS},map,[actor([0,0,0])],[actor([20,0,0],'guard')],1);
  expect(s.status).toBe('failed');expect(operationStars(first,s,0)).toBe(0);expect(recordOperation({},s,0)).toEqual({});
 });
 test('Freight Intercept alarm challenge rewards fast kills and escalates later encounters when missed',()=>{
  const m=operationById('freight_intercept')!,mp=getMap(m.mapId);let s=createOperationState(m.id);
  s=tickOperation(s,mp,[actor([0,0,0],'squad',true,2)],[],1);expect(s.optionalChallengeStatus).toBe('active');
  s=tickOperation(s,mp,[actor([0,0,0],'squad',true,6)],[],1);expect(s.optionalChallengeStatus).toBe('complete');expect(s.optionalChallengeKills).toBe(4);
  let missed=createOperationState(m.id);missed=tickOperation(missed,mp,[actor([0,0,0],'squad',true,0)],[],1);
  missed=tickOperation({...missed,optionalChallengeElapsed:44},mp,[actor([0,0,0],'squad',true,0)],[],1);
  expect(missed.optionalChallengeStatus).toBe('failed');
  expect(operationEncounter(m,1,'normal',1,true).count).toBeGreaterThan(operationEncounter(m,1,'normal',1,false).count);
 });
 test('enemy awareness is raised except during the opening Silent Entry approach',()=>{
  expect(operationAwarenessMultiplier({missionId:'silent_entry',stage:0})).toBe(1);
  expect(operationAwarenessMultiplier({missionId:'silent_entry',stage:1})).toBe(1.45);
  expect(operationAwarenessMultiplier({missionId:'zero_hour',stage:0})).toBe(1.45);
 });
 test('selected Operations difficulty overrides the mission default and Veteran is required for the third star',()=>{
  const m=OPERATIONS[0];expect(operationEncounter(m,0,'veteran').difficulty).toBe('veteran');expect(operationEncounter(m,0,'easy').difficulty).toBe('easy');expect(operationEncounter(m,0,'mixed').difficulty).toBeUndefined();
  expect(operationEncounter(m,0,'normal',2).count).toBe(Math.ceil(operationEncounter(m,0,'normal',1).count*1.6));
  const won={...createOperationState(m.id,'veteran'),status:'won' as const,intel:true,elapsed:600};expect(operationStars(m,won,0)).toBe(3);expect(operationStars(m,{...won,difficulty:'hard'},0)).toBe(2);expect(operationStars(m,won,1)).toBe(2);
 });
 test('star criteria explain exactly which campaign objectives were earned',()=>{
  const base={...createOperationState(first.id,'veteran'),status:'won' as const,intel:true,elapsed:600};
  expect(operationStarCriteria(base,0).map(c=>c.earned)).toEqual([true,true,true]);
  expect(operationStarCriteria({...base,difficulty:'hard'},0).map(c=>c.earned)).toEqual([true,true,false]);
  expect(operationStarCriteria(base,1).map(c=>c.earned)).toEqual([true,true,false]);
  expect(operationStarCriteria({...base,intel:false},0).map(c=>c.earned)).toEqual([true,false,true]);
  expect(operationStarCriteria({...base,status:'failed'},0).map(c=>c.earned)).toEqual([false,false,false]);
  expect(operationStars(first,base,0)).toBe(3);
 });
 test('first-clear payouts scale by campaign act',()=>{
  expect(operationFirstClearReward(OPERATIONS[0])).toEqual({xp:150,credits:75});
  expect(operationFirstClearReward(OPERATIONS[4])).toEqual({xp:200,credits:100});
  expect(operationFirstClearReward(OPERATIONS[8])).toEqual({xp:250,credits:125});
 });
 test('the 30-minute deadline is inclusive but fails immediately after it',()=>{
  let s=tickOperation({...createOperationState(first.id),elapsed:OPERATION_DEADLINE_SECONDS-1},map,[actor([0,0,0])],[],1);
  expect(s.elapsed).toBe(OPERATION_DEADLINE_SECONDS);
  expect(s.status).toBe('active');
  s=tickOperation(s,map,[actor([0,0,0])],[],0.001);
  expect(s.status).toBe('failed');
 });
 test('all missions share a fixed 30-minute active deadline',()=>{
  expect(OPERATION_DEADLINE_SECONDS).toBe(1800);
  for(const mission of OPERATIONS){const m=getMap(mission.mapId,'survival');const s=tickOperation({...createOperationState(mission.id),elapsed:OPERATION_DEADLINE_SECONDS},m,[actor([0,0,0])],[],1);expect(s.status).toBe('failed');}
 });
 test('best ratings persist and only completed missions unlock successors',()=>{
  expect(operationUnlocked(first.id,{})).toBe(true);expect(operationUnlocked(OPERATIONS[1].id,{})).toBe(false);
  const won={...createOperationState(first.id,'veteran'),status:'won' as const,intel:true,elapsed:200};expect(operationStars(first,won,0)).toBe(3);expect(operationStars(first,{...won,difficulty:'normal'},0)).toBe(2);let p=recordOperation({},won,0);expect(operationUnlocked(OPERATIONS[1].id,p)).toBe(true);
  p=recordOperation(p,{...won,elapsed:300,intel:false},2);expect(p[first.id]).toEqual({stars:3,bestSeconds:200,intel:true,completions:2});
  const guestProgress=recordOperation({}, {...won,missionId:'orbital_blackout'},0);expect(operationUnlocked('orbital_blackout',guestProgress)).toBe(true);expect(operationUnlocked('relay_siege',guestProgress)).toBe(true);
  expect(nextOperation(first.id)?.id).toBe(OPERATIONS[1].id);expect(nextOperation('missing')).toBeUndefined();expect(nextOperation(OPERATIONS.at(-1)!.id)).toBeUndefined();
 });
 test('legacy storage validates records and isolates player keys',()=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),storage=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)}});
  try{
   storage.set('vanguard_operations_p','null');expect(loadOperationProgress('p')).toEqual({});localStorage.setItem('vanguard_operations_p',JSON.stringify(recordOperation({}, {...createOperationState(first.id,'veteran'),status:'won',elapsed:200,intel:true},0)));
   expect(loadOperationProgress('p')[first.id].stars).toBe(3);expect(loadOperationProgress('other')).toEqual({});storage.set('vanguard_operations_p',JSON.stringify({[first.id]:{stars:99,bestSeconds:-2,completions:1}}));expect(loadOperationProgress('p')).toEqual({});storage.set('vanguard_operations_p',JSON.stringify({[first.id]:{stars:3,bestSeconds:1801,completions:1}}));expect(loadOperationProgress('p')).toEqual({});

  }finally{if(original)Object.defineProperty(globalThis,'localStorage',original);else Reflect.deleteProperty(globalThis,'localStorage');}
 });
 test('offline play cannot auto-clear a mission after the last guard dies',()=>{
  const e=makeEngineStub();Object.assign(e,{opts:{mode:'survival',online:false},operation:{...createOperationState(first.id),stage:1},map,survivalWaveActive:true,survivalPrepLeft:0,survivalDowned:false,combatants:new Map(),selfId:'p',alive:true,survivalWave:2,matchEnded:false,bulletSpitters:new Map()});
  e.pos.set(1000,0,1000);e.updateSurvival(1);expect(e.survivalWaveActive).toBe(true);expect(e.operation.stage).toBe(1);
 });
});
