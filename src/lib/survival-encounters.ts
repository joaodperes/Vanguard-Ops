/** Shared Survival encounter rules. Countdown time advances only with simulation. */
import type { Vec3 } from './game-protocol';
export type SurvivalRole = 'shield' | 'medic' | 'engineer' | 'disruptor';
export const SURVIVAL_ROLE_INFO: Record<SurvivalRole, {label:string;color:number;hint:string}> = {
  shield:{label:'SHIELD',color:0xfbbf24,hint:'Flank the frontal armor or aim for the head'},
  medic:{label:'MEDIC',color:0x4ade80,hint:'Heals nearby allies; eliminate first'},
  engineer:{label:'ENGINEER',color:0x38bdf8,hint:'Deploys a destructible sentry; kill its owner to disable it'},
  disruptor:{label:'DISRUPTOR',color:0xc084fc,hint:'Leave the warning ring before its pulse'},
};
export function survivalRoleForSlot(wave:number,slot:number,boss=false,elite=false):SurvivalRole|undefined {
  if(boss||elite||wave<3||slot%4!==0)return;
  const available:SurvivalRole[]=wave<5?['shield']:wave<7?['shield','medic']:wave<9?['shield','medic','engineer']:['shield','medic','engineer','disruptor'];
  return available[(Math.floor(slot/4)+wave)%available.length];
}
export const survivalRoleHealthMultiplier=(role?:SurvivalRole)=>role==='shield'?1.5:1;
export function survivalFrontalArmor(role:SurvivalRole|undefined,yaw:number,victim:Vec3,source:Vec3,head:boolean):number {
  if(role!=='shield'||head)return 1;
  const dx=source[0]-victim[0],dz=source[2]-victim[2],distance=Math.hypot(dx,dz);
  return distance>0&&(dx*Math.sin(yaw)+dz*Math.cos(yaw))/distance>.5 ? .35 : 1;
}
export interface SurvivalActor {
  id:string;pos:Vec3;alive:boolean;health:number;maxHealth:number;role?:SurvivalRole;abilityLeft?:number;
}
export const survivalDistance=(a:Vec3,b:Vec3)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
export interface SurvivalAbility {ownerId:string;kind:'heal'|'sentry'|'pulse';targetId?:string;amount?:number;}
export function tickSurvivalSpecialists(actors:SurvivalActor[],dt:number,visible:(a:Vec3,b:Vec3)=>boolean):SurvivalAbility[] {
  const events:SurvivalAbility[]=[];
  for(const actor of actors){
    if(!actor.alive||!actor.role||actor.role==='shield')continue;
    actor.abilityLeft=(actor.abilityLeft??(actor.role==='engineer'?6:4))-Math.max(0,dt);
    if(actor.abilityLeft>0)continue;
    actor.abilityLeft=actor.role==='engineer'?18:actor.role==='disruptor'?9:5;
    if(actor.role==='medic'){
      for(const ally of actors)
        if(ally.alive&&ally.id!==actor.id&&ally.health<ally.maxHealth&&survivalDistance(actor.pos,ally.pos)<=9&&visible(actor.pos,ally.pos))
          events.push({ownerId:actor.id,kind:'heal',targetId:ally.id,amount:Math.min(18,ally.maxHealth-ally.health)});
    }else events.push({ownerId:actor.id,kind:actor.role==='engineer'?'sentry':'pulse'});
  }
  return events;
}
export type SurvivalObjectiveKind='defend'|'supplies'|'terminals';
export interface SurvivalObjective {
  kind:SurvivalObjectiveKind;sites:Vec3[];progress:number;target:number;complete:boolean;contested:boolean;carrierId?:string;
}
/** Authored spawns provide reachable sites without adding a second map catalog. */
export function createSurvivalObjective(wave:number,boss:boolean,spawns:Vec3[]):SurvivalObjective|undefined {
  if(boss||wave<4||wave%4||!spawns.length)return;
  const first=spawns[(wave/4-1)%spawns.length];
  const others=spawns.filter(p=>survivalDistance(first,p)>8).sort((a,b)=>survivalDistance(first,b)-survivalDistance(first,a));
  const kind=others.length?(['defend','supplies','terminals'] as const)[(wave/4-1)%3]:'defend';
  const sites:Vec3[]=[first];
  if(kind!=='defend')sites.push(others[0]);
  return {kind,sites:sites.map(p=>[...p] as Vec3),progress:0,target:kind==='defend'?15:kind==='supplies'?1:6,complete:false,contested:false};
}
export function survivalObjectiveSite(objective:SurvivalObjective):Vec3 {
  return objective.sites[objective.kind==='supplies'?(objective.carrierId?1:0):objective.kind==='terminals'&&objective.progress>=3?1:0];
}
export function tickSurvivalObjective(objective:SurvivalObjective|undefined,players:SurvivalActor[],enemies:SurvivalActor[],dt:number,visible:(a:Vec3,b:Vec3)=>boolean=()=>true):void {
  if(!objective||objective.complete)return;
  const living=players.filter(p=>p.alive);
  if(objective.carrierId&&!living.some(p=>p.id===objective.carrierId))objective.carrierId=undefined;
  const site=survivalObjectiveSite(objective);
  const present=living.filter(p=>survivalDistance(p.pos,site)<=3&&visible(p.pos,site));
  objective.contested=enemies.some(enemy=>enemy.alive&&survivalDistance(enemy.pos,site)<=5);
  if(objective.kind==='supplies'){
    if(!objective.carrierId&&present.length)objective.carrierId=present[0].id;
    else if(present.some(p=>p.id===objective.carrierId)){objective.progress=1;objective.complete=true;}
  }else if(present.length&&!objective.contested){
    const progress=objective.progress+Math.max(0,dt);
    objective.progress=Math.min(objective.target,objective.kind==='terminals'&&objective.progress<3?Math.min(3,progress):progress);
    objective.complete=objective.progress>=objective.target;
  }
}
export function survivalObjectiveText(objective:SurvivalObjective):string {
  if(objective.complete)return 'Objective complete · eliminate remaining enemies';
  if(objective.kind==='supplies')return objective.carrierId?'Deliver supplies to B':'Collect supplies at A, then deliver to B';
  return (objective.kind==='defend'?'Defend relay A':'Activate terminal '+(objective.progress<3?'A':'B'))+' · '+Math.floor(objective.progress)+'/'+objective.target+'s'+(objective.contested?' · CONTESTED':'');
}
