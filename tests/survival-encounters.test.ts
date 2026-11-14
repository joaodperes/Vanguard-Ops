import {describe,expect,test} from 'bun:test';
import {createSurvivalObjective,survivalObjectiveSite,survivalRoleForSlot,survivalFrontalArmor,tickSurvivalObjective,tickSurvivalSpecialists,type SurvivalActor} from '../src/lib/survival-encounters';
import {makeEngineStub} from './helpers/engine-stub';
import {LAVA_DEATH_SOURCE} from '../src/lib/dynamic-environment';
import type {Vec3} from '../src/lib/game-protocol';
const sites:Vec3[]=[[0,0,0],[20,0,0],[0,0,15]];
const actor=(id:string,pos:Vec3=[0,0,0],extra:Partial<SurvivalActor>={}):SurvivalActor=>({id,pos,health:100,maxHealth:100,alive:true,...extra});
describe('Survival encounter decisions',()=>{
 test('specialists arrive gradually and never replace bosses or elites',()=>{
  expect(survivalRoleForSlot(2,0)).toBeUndefined();
  const roles=new Set<string>();for(let w=3;w<=30;w++)for(let n=0;n<40;n++){
   const r=survivalRoleForSlot(w,n);if(r)roles.add(r);
   expect(survivalRoleForSlot(w,n,true)).toBeUndefined();expect(survivalRoleForSlot(w,n,false,true)).toBeUndefined();
   if(w<5)expect(r==='medic').toBe(false);if(w<7)expect(r==='engineer').toBe(false);if(w<9)expect(r==='disruptor').toBe(false);
  }
  expect([...roles].sort()).toEqual(['disruptor','engineer','medic','shield']);
 });
 test('shield counterplay rewards flanking and headshots',()=>{
  expect(survivalFrontalArmor('shield',0,[0,0,0],[0,0,5],false)).toBe(.35);
  expect(survivalFrontalArmor('shield',0,[0,0,0],[0,0,-5],false)).toBe(1);
  expect(survivalFrontalArmor('shield',0,[0,0,0],[5,0,0],false)).toBe(1);
  expect(survivalFrontalArmor('shield',0,[0,0,0],[0,0,5],true)).toBe(1);
 });
 test('actual offline damage applies frontal protection but does not armor against lava',()=>{
  const e=makeEngineStub();Object.assign(e,{opts:{mode:'survival',online:false,team:'blue'},offlineAssistDamage:new Map(),survivalUpgradeRanks:{},health:100,survivalLastKillAt:-Infinity,survivalLastHeadshotKillAt:-Infinity});
  e.pos.set(0,0,5);
  const victim={...actor('shield'),team:'red',isBot:true,survivalRole:'shield',yaw:0,health:1000};
  e.applyDamageLocal(victim,100,false,'rifle_ar');expect(victim.health).toBe(965);
  e.applyDamageLocal(victim,100,true,'rifle_ar');expect(victim.health).toBe(865);
  e.applyDamageLocal(victim,100,false,LAVA_DEATH_SOURCE);expect(victim.health).toBe(765);
 });
 test('medic cannot heal itself, dead allies, through walls, or above original HP',()=>{
  const actors=[actor('medic',[0,0,0],{role:'medic',health:10,abilityLeft:0}),actor('wounded',[1,0,0],{health:95}),actor('dead',[1,0,0],{alive:false}),actor('far',[20,0,0],{health:1})];
  expect(tickSurvivalSpecialists(actors,.05,()=>true)).toEqual([{kind:'heal',ownerId:'medic',targetId:'wounded',amount:5}]);
  actors[0].abilityLeft=0;expect(tickSurvivalSpecialists(actors,.05,()=>false)).toEqual([]);
 });
 test('engineer deployment and disruptor pulses are bounded and stop on death',()=>{
  const actors=[actor('engineer',sites[0],{role:'engineer',abilityLeft:0}),actor('disruptor',sites[1],{role:'disruptor',abilityLeft:0})];
  expect(tickSurvivalSpecialists(actors,.05,()=>true).map(e=>e.kind)).toEqual(['sentry','pulse']);
  expect(tickSurvivalSpecialists(actors,.05,()=>true)).toEqual([]);
  actors.forEach(a=>{a.alive=false;a.abilityLeft=0;});expect(tickSurvivalSpecialists(actors,30,()=>true)).toEqual([]);
 });
 test('objective rotation skips bosses and handles empty and tiny maps',()=>{
  expect(createSurvivalObjective(4,true,sites)).toBeUndefined();expect(createSurvivalObjective(4,false,[])).toBeUndefined();
  expect([4,8,12].map(w=>createSurvivalObjective(w,false,sites)?.kind)).toEqual(['defend','supplies','terminals']);
  expect(createSurvivalObjective(8,false,[[0,0,0]])?.kind).toBe('defend');
 });
 test('relay requires presence, respects floors and cover, and stops while contested',()=>{
  const o=createSurvivalObjective(4,false,sites)!;
  tickSurvivalObjective(o,[actor('p',[0,10,0])],[],10);expect(o.progress).toBe(0);
  tickSurvivalObjective(o,[actor('p')],[],10,()=>false);expect(o.progress).toBe(0);
  tickSurvivalObjective(o,[actor('p')],[actor('enemy')],10);expect(o.contested).toBe(true);expect(o.progress).toBe(0);
  tickSurvivalObjective(o,[actor('p')],[],10);expect(o.complete).toBe(false);
  tickSurvivalObjective(o,[actor('p')],[],5);expect(o.complete).toBe(true);
 });
 test('supplies require the living carrier at destination; partner cannot deliver remotely',()=>{
  const o=createSurvivalObjective(8,false,sites)!;
  tickSurvivalObjective(o,[actor('p',o.sites[0])],[],.1);expect(o.carrierId).toBe('p');
  tickSurvivalObjective(o,[actor('p',o.sites[0]),actor('partner',o.sites[1])],[],.1);expect(o.complete).toBe(false);
  tickSurvivalObjective(o,[actor('p',o.sites[0],{alive:false})],[],.1);expect(o.carrierId).toBeUndefined();
  tickSurvivalObjective(o,[actor('partner',o.sites[0])],[],.1);
  tickSurvivalObjective(o,[actor('partner',o.sites[1])],[],.1);expect(o.complete).toBe(true);
 });
 test('terminals require both sites, retain work, and do not multiply with co-op count',()=>{
  const o=createSurvivalObjective(12,false,sites)!;
  tickSurvivalObjective(o,[actor('p',o.sites[0]),actor('q',o.sites[0])],[],10);expect(o.progress).toBe(3);expect(o.complete).toBe(false);
  expect(survivalObjectiveSite(o)).toEqual(o.sites[1]);
  tickSurvivalObjective(o,[actor('p',o.sites[0])],[],10);expect(o.complete).toBe(false);
  tickSurvivalObjective(o,[actor('p',o.sites[1])],[],3);expect(o.complete).toBe(true);
 });
 test('offline wave cannot clear until the objective is finished',()=>{
  const e=makeEngineStub();Object.assign(e,{opts:{mode:'survival'},matchEnded:false,survivalWave:4,survivalWaveActive:true,survivalPrepLeft:0,survivalTier:'default',survivalUpgradeRanks:{},survivalRerolls:1,combatants:new Map(),survivalObjective:createSurvivalObjective(4,false,sites),tickSurvivalEncounters:()=>{}});
  e.updateSurvival(.1);expect(e.survivalWaveActive).toBe(true);
  e.survivalObjective.complete=true;e.updateSurvival(.1);expect(e.survivalWaveActive).toBe(false);expect(e.survivalPrepLeft).toBeGreaterThan(0);
 });
});
