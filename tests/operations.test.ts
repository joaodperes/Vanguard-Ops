import {describe,expect,test} from 'bun:test';
import {OPERATIONS,OPERATION_DEADLINE_SECONDS,operationFirstClearReward,createOperationState,operationById,nextOperation,operationConfigValid,operationSite,operationTarget,tickOperation,operationEncounter,operationAwarenessMultiplier,operationObjectiveTypeLabel,damageOperationEscort,operationStars,operationStarCriteria,operationTimePerformance,formatOperationTime,operationActSummary,recordOperation,operationUnlocked,operationActRewardForMission,OPERATION_ACT_REWARDS,loadOperationProgress,operationFeedbackEvents,type OperationActor,type OperationState} from '../src/lib/operations';
import {getMap,type Vec3} from '../src/lib/game-protocol';
import {makeEnvironmentMap} from '../src/lib/dynamic-environment';
import {botPositionEmbedded} from '../src/lib/bot-physics';
import {survivalRoleForSlot} from '../src/lib/survival-encounters';
import {makeEngineStub} from './helpers/engine-stub';
const actor=(pos:Vec3,id='human',alive=true,kills=0):OperationActor=>({id,pos,alive,kills});
const first=OPERATIONS[0],map=makeEnvironmentMap(getMap(first.mapId,'survival'));
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
   for(const g of [...m.objectives,{site:15}]){const p=operationSite(compiled,g.site);expect(p.every(Number.isFinite)).toBe(true);expect(botPositionEmbedded(compiled.cover,p)).toBe(false);if('startSite' in g&&g.startSite!==undefined){const start=operationSite(compiled,g.startSite);expect(start.every(Number.isFinite)).toBe(true);expect(botPositionEmbedded(compiled.cover,start)).toBe(false);}}
   expect(operationEncounter(m,0).count).toBe(4+m.intensity);
  }
  expect(operationTarget(createOperationState(first.id),map)).toBeUndefined(); // Elimination objectives have no defend/escort waypoint.
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
 test('operation transitions announce optional rewards and completed defence tasks',()=>{
  const freight=operationById('freight_intercept')!;
  const stageThree={...createOperationState(freight.id),stage:2};
  expect(operationFeedbackEvents(stageThree,{...stageThree,stage:3})).toEqual([
   {kind:'objective',message:'OBJECTIVE COMPLETE · NEXT: Recover the cargo manifest'},
  ]);
  expect(operationFeedbackEvents(stageThree,{...stageThree,progress:12})).toEqual([]);
  expect(operationFeedbackEvents(stageThree,{...stageThree,intel:true})).toEqual([
   {kind:'intel',message:'OPTIONAL INTEL RECOVERED'},
  ]);
  const challenge=createOperationState(freight.id);
  expect(operationFeedbackEvents(challenge,{...challenge,optionalChallengeStatus:'complete'})).toEqual([
   {kind:'challenge',message:'OPTIONAL CHALLENGE COMPLETE'},
  ]);
 });
 test('later campaign encounters reuse all specialist behaviours',()=>{
  const m=operationById('zero_hour')!,e=operationEncounter(m,0);
  const roles=new Set(Array.from({length:e.count},(_,i)=>survivalRoleForSlot(e.roleWave,i)).filter(Boolean));
  expect(roles.has('engineer')).toBe(true);expect(roles.has('disruptor')).toBe(true);
  const commander=m.objectives.findIndex(objective=>objective.boss);
  expect(commander).toBeGreaterThanOrEqual(0);expect(operationEncounter(m,commander).boss).toBe(true);expect(operationEncounter(m,0).boss).toBe(false);
 });
 test('objectives reject empty squads, live guards, contesting enemies and other floors',()=>{
  const s={...createOperationState(first.id),stage:1},p=operationTarget(s,map)!;
  expect(advance(s,[]).progress).toBe(0);expect(advance(s,[actor([p[0],p[1]+8,p[2]])]).progress).toBe(0);
  expect(advance(s,[actor(p)],[actor(p,'guard')]).progress).toBe(0);expect(advance(s,[actor(p)],[],45).stage).toBe(2);
  expect(advance(s,[actor(p)],[actor([p[0]+40,p[1],p[2]],'guard')],50).stage).toBe(2);
 });
 test('escort objectives move a durable cart only with a nearby operative and enemies damage it',()=>{
  const mission=operationById('freight_intercept')!,compiled=makeEnvironmentMap(getMap(mission.mapId,'survival'));
  const index=mission.objectives.findIndex(objective=>objective.kind==='escort'),objective=mission.objectives[index]!;
  const start=operationSite(compiled,objective.startSite),destination=objective.destination??operationSite(compiled,objective.site);
  let s:OperationState={...createOperationState(mission.id),stage:index,escortPos:[...start],escortHp:450,escortMaxHp:450};
  const distance=(p:Vec3)=>Math.hypot(destination[0]-p[0],destination[2]-p[2]);
  const before=[...s.escortPos!];
  s=tickOperation(s,compiled,[actor([start[0]+30,start[1],start[2]])],[],1);
  expect(s.escortPos).toEqual(before);
  s=tickOperation(s,compiled,[actor(s.escortPos!,'escort')],[],1);
  expect(distance(s.escortPos!)).toBeLessThan(distance(before));
  const hp=s.escortHp!;
  s=tickOperation(s,compiled,[actor(s.escortPos!,'escort')],[actor(s.escortPos!,'guard')],1);
  expect(s.escortHp).toBeLessThan(hp);
  expect(s.escortMaxHp).toBeGreaterThan(100);
 });
 test('escort destruction fails the operation',()=>{
  const mission=operationById('cold_trail')!,compiled=getMap(mission.mapId,'survival');
  const index=mission.objectives.findIndex(objective=>objective.kind==='escort'),objective=mission.objectives[index]!;
  const start=operationSite(compiled,objective.startSite);
  let escort:OperationState={...createOperationState(mission.id),stage:index,escortPos:[...start],escortHp:1,escortMaxHp:450};
  escort=tickOperation(escort,compiled,[actor(start)],[actor(start,'guard')],1);
  expect(escort.status).toBe('failed');
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
 test('objective categories distinguish holding, surviving, clearing and moving objects',()=>{
  expect(operationObjectiveTypeLabel('defend')).toBe('DEFEND AREA');
  expect(operationObjectiveTypeLabel('survive')).toBe('SURVIVE');
  expect(operationObjectiveTypeLabel('eliminate')).toBe('ELIMINATE ALL');
  expect(operationObjectiveTypeLabel('escort')).toBe('MOVE / ESCORT');
  const clearMission=operationById('silent_entry')!,eliminate=clearMission.objectives.findIndex(objective=>objective.kind==='eliminate');
  expect(eliminate).toBeGreaterThanOrEqual(0);
  expect(operationTarget({...createOperationState(clearMission.id),stage:eliminate},getMap(clearMission.mapId,'survival'))).toBeUndefined();
  const finale=operationById('zero_hour')!,bossIndex=finale.objectives.findIndex(objective=>objective.boss);
  expect(operationTarget({...createOperationState(finale.id),stage:bossIndex},getMap(finale.mapId,'survival'))).toEqual(operationSite(getMap(finale.mapId,'survival'),finale.objectives[bossIndex].site));
 });
 test('survival objectives advance on time without requiring a location hold or clearing enemies',()=>{
  const mission=operationById('relay_siege')!,index=mission.objectives.findIndex(objective=>objective.kind==='survive'),mp=makeEnvironmentMap(getMap(mission.mapId,'survival'));
  expect(index).toBeGreaterThanOrEqual(0);
  let state={...createOperationState(mission.id),stage:index};
  expect(operationTarget(state,mp)).toBeUndefined();
  for(let second=0;second<90;second++)state=tickOperation(state,mp,[actor([25,0,-25])],[actor([-25,0,25],'guard')],1);
  expect(state.stage).toBe(index+1);expect(state.status).toBe('active');
 });
 test('escort vehicles move only with a nearby operative, take damage and can be destroyed',()=>{
  const mission=operationById('freight_intercept')!,index=mission.objectives.findIndex(objective=>objective.kind==='escort'),mp=makeEnvironmentMap(getMap(mission.mapId,'survival'));
  let state={...createOperationState(mission.id),stage:index};
  const objective=mission.objectives[index]!;
  const start=operationSite(mp,objective.startSite??mission.objectives[index-1]!.site);
  state=tickOperation(state,mp,[actor(start)],[],.1);
  expect(state.escortHp).toBe(650);expect(state.escortMaxHp).toBe(650);expect(state.escortPayload).toBe('PC');expect(Number.isFinite(state.escortYaw)).toBe(true);
  expect(state.escortPos).not.toEqual(start);
  const parked=state.escortPos!;
  state=tickOperation(state,mp,[actor([parked[0]+20,parked[1],parked[2]])],[],1);
  expect(state.escortPos).toEqual(parked);
  state=damageOperationEscort(state,180);expect(state.escortHp).toBe(470);
  state=damageOperationEscort(state,1000);expect(state.escortHp).toBe(0);
  state=tickOperation(state,mp,[actor(parked)],[],1);expect(state.status).toBe('failed');
 });
 test('the Juggernaut escort remains at the command chamber for the final commander encounter',()=>{
  const mission=operationById('zero_hour')!,index=mission.objectives.findIndex(objective=>objective.kind==='escort'),mp=makeEnvironmentMap(getMap(mission.mapId,'survival'));
  let state={...createOperationState(mission.id),stage:index},budget=200;
  while(state.stage===index&&budget-->0){const cart=operationTarget(state,mp)!;state=tickOperation(state,mp,[actor(cart)],[],1);}
  expect(state.stage).toBe(index+1);expect(state.escortComplete).toBe(true);expect(state.escortPayload).toBe('Juggernaut');
  expect(state.escortPos).toBeDefined();expect(state.escortHp).toBe(650);expect(Number.isFinite(state.escortYaw)).toBe(true);
  expect(mission.objectives[state.stage].boss).toBe(true);
 });
 test('every mission has a valid solo completion path',()=>{
  for(const mission of OPERATIONS){
   const m=makeEnvironmentMap(getMap(mission.mapId,'survival'));let s=createOperationState(mission.id),budget=2000,kills=0;
   while(s.status==='active'&&budget-->0){const goal=mission.objectives[s.stage];const p=goal?.kind==='deliver'?(s.escortPos??s.packagePos??operationSite(m,mission.objectives[Math.max(0,s.stage-1)].site)):(operationTarget(s,m)??operationSite(m,goal?.site??0));if(goal?.kind==='defend'&&goal.killTarget)kills=(s.objectiveKillBaseline??0)+goal.killTarget;s=tickOperation(s,m,[actor(p,'solo',true,kills)],[],1);}
   if(s.status!=='won')throw new Error(`${mission.id} failed at stage ${s.stage}/${mission.objectives.length} after ${s.elapsed}s`);
    expect(s.stage).toBe(mission.objectives.length);
  }
 });
 test('every defence objective holds for two minutes with continuous 15-second reinforcement pulses',()=>{
  const stages=OPERATIONS.flatMap(m=>m.objectives.flatMap((objective,index)=>objective.kind==='defend'&&!objective.killTarget?[{mission:m,index}]:[]));
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
    expect(s.pulse).toBe(Math.floor(second/15));
   }
   expect([...pulses]).toEqual([0,1,2,3,4,5,6,7,8]);
   expect(s.pulse).toBe(8);
   // The hold completes on the next pulse boundary even with hostiles alive.
   s=tickOperation(s,mp,[actor(p)],[guard],1);
   expect(s.stage).toBe(index+1);
   expect(s.pulse).toBe(0);
   expect(s.stageElapsed).toBe(0);
  }
 });
 test('kill-target defence objectives require the squad to hold the site and reach the kill target before timeout',()=>{
  const mission=operationById('relay_siege')!,index=mission.objectives.findIndex(g=>g.killTarget),mp=getMap(mission.mapId,'survival');
  expect(index).toBeGreaterThanOrEqual(0);
  const base={...createOperationState(mission.id),stage:index},p=operationTarget(base,mp)!;
  let s=tickOperation(base,mp,[actor(p,'solo',true,3)],[],1);
  expect(s.progress).toBe(0); // First tick establishes the squad kill baseline.
  s=tickOperation(s,mp,[actor(p,'solo',true,7)],[],1);
  expect(s.progress).toBe(4);expect(s.stage).toBe(index);expect(s.stageElapsed).toBe(2);
  s=tickOperation(s,mp,[actor(p,'solo',true,11)],[],1);
  expect(s.progress).toBe(0);expect(s.stage).toBe(index+1);
  let failed=tickOperation(base,mp,[actor(p,'solo',true,0)],[],1);
  failed=tickOperation({...failed,stageElapsed:74},mp,[actor(p,'solo',true,7)],[],1);
  failed=tickOperation(failed,mp,[actor(p,'solo',true,7)],[],1);
  expect(failed.status).toBe('failed');
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
 test('mission par targets provide consistent replay pace feedback without changing star rules',()=>{
  const mission=operationById('silent_entry')!;
  expect(operationTimePerformance(mission,mission.parSeconds-1)).toEqual({elapsedSeconds:mission.parSeconds-1,parSeconds:mission.parSeconds,withinPar:true,deltaSeconds:1});
  expect(operationTimePerformance(mission,mission.parSeconds+1)).toEqual({elapsedSeconds:mission.parSeconds+1,parSeconds:mission.parSeconds,withinPar:false,deltaSeconds:1});
  expect(operationTimePerformance(mission,Number.NaN)).toEqual({elapsedSeconds:0,parSeconds:mission.parSeconds,withinPar:true,deltaSeconds:mission.parSeconds});
  expect(formatOperationTime(599)).toBe('9:59');
  expect(formatOperationTime(600)).toBe('10:00');
  expect(formatOperationTime(-5)).toBe('0:00');
 });
 test('act completion rewards are attached only to each act finale',()=>{
  expect(operationActRewardForMission('cold_trail')).toEqual(OPERATION_ACT_REWARDS[0]);
  expect(operationActRewardForMission('relay_siege')).toEqual(OPERATION_ACT_REWARDS[1]);
  expect(operationActRewardForMission('zero_hour')).toEqual(OPERATION_ACT_REWARDS[2]);
  expect(operationActRewardForMission('silent_entry')).toBeUndefined();
  expect(OPERATION_ACT_REWARDS.map(reward=>reward.itemId)).toEqual(['wonder_weapon','pistol_arc','wonder_juggernaut']);
 });
 test('act summaries count only that act and aggregate earned stars',()=>{
  const p=recordOperation({}, {...createOperationState('silent_entry','veteran'),status:'won',elapsed:300,intel:true},0);
  const next=recordOperation(p,{...createOperationState('freight_intercept','hard'),status:'won',elapsed:400,intel:false},1);
  expect(operationActSummary(1,next)).toEqual({completed:2,total:4,stars:4,maxStars:12});
  expect(operationActSummary(2,next)).toEqual({completed:0,total:4,stars:0,maxStars:12});
  expect(operationActSummary(3,next)).toEqual({completed:0,total:4,stars:0,maxStars:12});
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
