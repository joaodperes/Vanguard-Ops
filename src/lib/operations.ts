/** Operations campaign rules shared by local/networked simulations and account progression. */
import type {MapDef,MapId,Vec3,BotDifficulty} from './game-protocol';
export type OperationKind='clear'|'eliminate'|'survive'|'secure'|'defend'|'recover'|'deliver'|'escort'|'extract';
/** Compact objective-type label used by the Operations mission briefing. */
export function operationObjectiveTypeLabel(kind: OperationKind): string {
 const labels: Record<OperationKind, string> = {
  clear: "CLEAR", eliminate: "ELIMINATE", survive: "SURVIVE",
  secure: "SECURE", defend: "DEFEND", recover: "RECOVER",
  deliver: "DELIVER", escort: "ESCORT", extract: "EXTRACT",
 };
 return labels[kind];
}
export interface OperationObjective {kind:OperationKind;label:string;site:number;seconds:number;killTarget?:number;startSite?:number;payload?:string;boss?:boolean}
export interface OperationMission {id:string;act:number;title:string;mapId:MapId;briefing:string;debrief:string;intensity:number;parSeconds:number;objectives:OperationObjective[];optionalObjective:{label:string;site:number};optionalChallenge?:{label:string;kills:number;seconds:number}}
const goal=(kind:OperationKind,label:string,site:number,seconds=0,killTarget?:number,extra:Pick<OperationObjective,'startSite'|'payload'|'boss'>={}):OperationObjective=>({kind,label,site,seconds,...(killTarget?{killTarget}:{}),...extra});
export const OPERATION_DEADLINE_SECONDS=30*60;
export interface OperationActReward {id:string;act:number;name:string;kind:'perk'|'weapon'|'wonder';itemId:string;missionId:string}
/** Permanent campaign rewards, granted only when the final mission of each act is first-cleared. */
export const OPERATION_ACT_REWARDS:readonly OperationActReward[]=[
 {id:'act1_wonder_weapon_perk',act:1,name:'Wonder Weapon perk',kind:'perk',itemId:'wonder_weapon',missionId:'cold_trail'},
 {id:'act2_pistol_arc',act:2,name:'Arc Pistol',kind:'weapon',itemId:'pistol_arc',missionId:'relay_siege'},
 {id:'act3_wonder_juggernaut',act:3,name:'Wonder Juggernaut',kind:'wonder',itemId:'wonder_juggernaut',missionId:'zero_hour'},
];
export function operationActRewardForMission(missionId:string):OperationActReward|undefined {
 return OPERATION_ACT_REWARDS.find(reward=>reward.missionId===missionId);
}
export interface OperationFirstClearReward {missionId:string;xp:number;credits:number}
export function operationFirstClearReward(m:Pick<OperationMission,'act'>):Omit<OperationFirstClearReward,'missionId'> {
 const act=Math.max(1,Math.min(3,Math.floor(m.act)));
 return {xp:100+act*50,credits:50+act*25};
}
export const OPERATIONS:readonly OperationMission[]=[
 {id:'silent_entry',act:1,title:'Silent Entry',mapId:'compound',intensity:1,parSeconds:600,optionalObjective:{label:'Copy the guard patrol schedule',site:14},
  briefing:'A stolen Vanguard relay has gone dark. Breach the jungle outpost, copy its dispatch records and escape with the first lead.',debrief:'The relay points to an arms pipeline running through Ridgefall.',
  objectives:[goal('eliminate','Break the outpost perimeter',0),goal('secure','Copy the dispatch records',3,45),goal('recover','Recover the encrypted relay',7,5),goal('deliver','Deliver the relay to the uplink',1,8),goal('extract','Reach the extraction zone',0,12)]},
 {id:'freight_intercept',act:1,title:'Freight Intercept',mapId:'skybridge',intensity:1,parSeconds:660,optionalObjective:{label:'Recover the convoy route sheet',site:15},optionalChallenge:{label:'Prevent the convoy alarm',kills:4,seconds:45},
  briefing:'Intercept the convoy before its cargo leaves the factory. Hold the loading area while command traces the next shipment.',debrief:'The manifest identifies a sleeper cell in Afterlight.',
  objectives:[goal('secure','Disable the convoy beacon',2,35),goal('escort','Escort the cart carrying the PC to the loading area',4,0,undefined,{startSite:6,payload:'PC'}),goal('defend','Hold the loading area for the scan',4,120),goal('recover','Recover the cargo manifest',8,5),goal('extract','Extract with the manifest',0,15)]},
 {id:'city_signal',act:1,title:'City Signal',mapId:'terminal',intensity:2,parSeconds:660,optionalObjective:{label:'Download the second transmitter log',site:13},
  briefing:'Two transmission sites are hiding the cell. Triangulate their signal and retrieve the operator cipher.',debrief:'The cipher exposes a transfer through Whiteout Depot.',
  objectives:[goal('secure','Triangulate the first transmitter',3,45),goal('secure','Triangulate the second transmitter',9,45),goal('eliminate','Eliminate the cipher escort',6),goal('recover','Recover the operator cipher',11,5),goal('extract','Reach the evacuation point',1,15)]},
 {id:'cold_trail',act:1,title:'Cold Trail',mapId:'whiteout_depot',intensity:2,parSeconds:720,optionalObjective:{label:'Recover the depot supply manifest',site:14},
  briefing:'Secure the snowbound depot, recover the cipher reader and defend the upload.',debrief:'A buried transmission leads to Emberhold. Act one is complete.',
  objectives:[goal('eliminate','Clear the rail checkpoint',2),goal('recover','Recover the cipher reader',7,6),goal('deliver','Bring the reader to the transmitter',4,10),goal('defend','Defend the decrypted upload',4,120),goal('extract','Withdraw to the rail exit',0,18)]},
 {id:'keep_secrets',act:2,title:'Keep Secrets',mapId:'emberhold',intensity:2,parSeconds:720,optionalObjective:{label:'Copy the archive personnel roster',site:15},
  briefing:'Emberhold houses the network archive. Secure its access points before recovering the command ledger.',debrief:'The archive describes a planned breach at Floodgate.',
  objectives:[goal('secure','Override the outer archive lock',3,45),goal('eliminate','Break the archive guard',8),goal('secure','Decode the archive terminal',12,60),goal('recover','Recover the command ledger',6,8),goal('extract','Escape the keep',0,18)]},
 {id:'rising_water',act:2,title:'Rising Water',mapId:'floodgate',intensity:3,parSeconds:720,optionalObjective:{label:'Retrieve the dam maintenance report',site:13},
  briefing:'The enemy is using the dam to power its uplink. Isolate both control sites and hold a secure connection through the breach.',debrief:'The uplink is routed through an orbital station.',
  objectives:[goal('secure','Isolate the first control station',3,55),goal('secure','Isolate the second control station',10,55),goal('defend','Defend the emergency uplink',6,120),goal('recover','Recover the orbital access key',12,6),goal('extract','Reach the safe evacuation zone',0,20)]},
 {id:'orbital_blackout',act:2,title:'Orbital Blackout',mapId:'orbital_nexus',intensity:3,parSeconds:780,optionalObjective:{label:'Download the reactor telemetry',site:14},
  briefing:'Board the station and restore access to its core. Deliver the access module and copy the reactor logs.',debrief:'The logs identify a second ground relay.',
  objectives:[goal('eliminate','Secure the boarding corridor',1),goal('recover','Recover the reactor access module',8,6),goal('deliver','Install the module at the service uplink',4,12),goal('defend','Hold the reactor log transfer',4,120),goal('extract','Return to the docking perimeter',0,20)]},
 {id:'relay_siege',act:2,title:'Relay Siege',mapId:'compound',intensity:3,parSeconds:720,optionalObjective:{label:'Recover the relay access codes',site:15},
  briefing:'The ground relay is the only route into the command network. Seize its terminals and survive the response force.',debrief:'Command has located the final weapons cache. Act two is complete.',
  objectives:[goal('secure','Seize the west relay',5,55),goal('secure','Seize the east relay',10,55),goal('defend','Hold the command relay and eliminate 8 hostiles',2,75,8),goal('survive','Survive the response wave',7,90),goal('extract','Evacuate the relay',0,20)]},
 {id:'last_shipment',act:3,title:'Last Shipment',mapId:'skybridge',intensity:4,parSeconds:780,optionalObjective:{label:'Secure the weapons inventory',site:13},
  briefing:'Stop the last weapons shipment. Recover the targeting package and upload its contents before the network relocates.',debrief:'The targeting package reveals an attack on the city.',
  objectives:[goal('eliminate','Break the cache defences',4),goal('recover','Recover the targeting package',9,8),goal('deliver','Carry the package to the factory uplink',2,12),goal('defend','Hold the targeting upload',2,120),goal('extract','Reach the freight extraction point',0,22)]},
 {id:'night_watch',act:3,title:'Night Watch',mapId:'arena_neon',intensity:4,parSeconds:780,optionalObjective:{label:'Recover the evacuation roster',site:14},
  briefing:'The city cells are activating. Jam command sites and retrieve the evacuation codes while the streets remain contested.',debrief:'The codes expose the final stronghold.',
  objectives:[goal('secure','Jam the northern command site',8,65),goal('defend','Hold the southern jammer',3,120),goal('recover','Recover the evacuation codes',12,8),goal('deliver','Transmit the codes to command',5,12),goal('extract','Withdraw through the evacuation zone',0,22)]},
 {id:'broken_crown',act:3,title:'Broken Crown',mapId:'emberhold',intensity:4,parSeconds:840,optionalObjective:{label:'Copy the command personnel file',site:15},
  briefing:'Return to Emberhold to cut the command network at its source. Its defenders are expecting you this time.',debrief:'The command archive gives you the master shutdown sequence.',
  objectives:[goal('eliminate','Breach the command guard',6),goal('secure','Unlock the command archive',12,75),goal('defend','Hold the shutdown sequence transfer',4,120),goal('recover','Recover the master sequence',9,10),goal('extract','Escape with the master sequence',0,25)]},
 {id:'zero_hour',act:3,title:'Zero Hour',mapId:'orbital_nexus',intensity:5,parSeconds:900,optionalObjective:{label:'Recover the network shutdown audit',site:13},
  briefing:'One final insertion. Carry the master sequence into the station, escort the Juggernaut to the command chamber, defeat the commander and make it to extraction.',debrief:'The network is offline. Operation complete. Replay missions to improve your ratings and recover every intel cache.',
  objectives:[goal('eliminate','Break the station blockade',2),goal('recover','Recover the shutdown carrier',10,10),goal('deliver','Install the master sequence',5,15),goal('defend','Defend the final shutdown',5,120),goal('escort','Escort the Juggernaut cart to the command chamber',12,0,undefined,{startSite:5,payload:'Juggernaut'}),goal('eliminate','Eliminate the final commander',12,0,undefined,{boss:true}),goal('extract','Reach the extraction zone',0,30)]},
];
export const operationById=(id:unknown)=>typeof id==='string'?OPERATIONS.find(m=>m.id===id):undefined;
export function nextOperation(id:string){const i=OPERATIONS.findIndex(m=>m.id===id);return i>=0 ? OPERATIONS[i+1]:undefined;}
/** Campaign whitelist does not alter standard Survival map availability. */
export function operationConfigValid(c:{operationId?:unknown;mode:string;mapId:string;survivalTier?:unknown}):boolean {
 const m=operationById(c.operationId);return !!m&&c.mode==='survival'&&c.mapId===m.mapId&&(c.survivalTier===undefined||c.survivalTier==='default');
}
export interface OperationState {missionId:string;difficulty:BotDifficulty;stage:number;progress:number;elapsed:number;stageElapsed:number;pulse:number;objectiveKillBaseline?:number;intel:boolean;optionalChallengeStatus?:'active'|'complete'|'failed';optionalChallengeElapsed?:number;optionalChallengeBaseline?:number;optionalChallengeKills?:number;carrierId?:string;packagePos?:Vec3;escortPos?:Vec3;escortHp?:number;escortMaxHp?:number;escortPayload?:string;escortDestination?:Vec3;escortYaw?:number;escortComplete?:boolean;status:'active'|'won'|'failed'}
const OBJECTIVE_TYPE_LABELS:Record<OperationKind,string>={clear:'ELIMINATE ALL',eliminate:'ELIMINATE ALL',survive:'SURVIVE',secure:'SECURE SITE',defend:'DEFEND AREA',recover:'RECOVER',deliver:'DELIVER',escort:'MOVE / ESCORT',extract:'EXTRACT'};
export function operationObjectiveTypeLabel(kind:OperationKind):string{return OBJECTIVE_TYPE_LABELS[kind];}
export interface OperationFeedbackEvent {kind:"objective"|"intel"|"challenge";message:string}
/** Discrete transitions only: callers can safely run this for every simulation snapshot. */
export function operationFeedbackEvents(previous:OperationState,next:OperationState):OperationFeedbackEvent[] {
 if(previous.missionId!==next.missionId)return [];
 const events:OperationFeedbackEvent[]=[];
 if(!previous.intel&&next.intel)events.push({kind:"intel",message:"OPTIONAL INTEL RECOVERED"});
 if(previous.optionalChallengeStatus!=="complete"&&next.optionalChallengeStatus==="complete")
  events.push({kind:"challenge",message:"OPTIONAL CHALLENGE COMPLETE"});
 if(next.stage>previous.stage){
  const nextGoal=operationById(next.missionId)?.objectives[next.stage];
  events.push({kind:"objective",message:nextGoal ? "OBJECTIVE COMPLETE · NEXT: " + nextGoal.label : "OPERATION COMPLETE"});
 }
 return events;
}
export const createOperationState=(missionId:string,difficulty:BotDifficulty='normal'):OperationState=>({missionId,difficulty,stage:0,progress:0,elapsed:0,stageElapsed:0,pulse:0,intel:false,...(operationById(missionId)?.optionalChallenge?{optionalChallengeStatus:'active' as const,optionalChallengeElapsed:0,optionalChallengeKills:0}:{}),status:'active'});
export interface OperationActor {id:string;pos:Vec3;alive:boolean;kills?:number}
/** Use collision-cleared authored pads, with the same positions on both simulations. */
export function operationSite(map:Pick<MapDef,'spawns'>,index:number):Vec3 {
 const p=map.spawns.ffa;return [...(p[index%p.length]??map.spawns.blue[0]??[0,0,0])] as Vec3;
}
const near=(a:Vec3,b:Vec3,r=4)=>Math.hypot(a[0]-b[0],a[2]-b[2])<=r&&Math.abs(a[1]-b[1])<2.5;
export function operationTarget(s:OperationState,map:Pick<MapDef,'spawns'>):Vec3|undefined {
 const m=operationById(s.missionId),g=m?.objectives[s.stage];if(!g)return;
 if(g.kind==='survive')return;
 if((g.kind==='clear'||g.kind==='eliminate')&&!g.boss)return;
 if(g.kind==='deliver'&&!s.carrierId)return s.packagePos??operationSite(map,m!.objectives[Math.max(0,s.stage-1)].site);
 if(g.kind==='escort')return s.escortPos??operationSite(map,g.startSite??m!.objectives[Math.max(0,s.stage-1)]?.site??g.site);
 return operationSite(map,g.site);
}
export function damageOperationEscort(s:OperationState,damage:number):OperationState {
 if(s.status!=='active'||s.escortHp===undefined||!s.escortPos)return s;
 const amount=Number.isFinite(damage)?Math.max(0,damage):0;
 return amount>0?{...s,escortHp:Math.max(0,s.escortHp-amount)}:s;
}
export function tickOperation(s:OperationState,map:Pick<MapDef,'spawns'>,actors:readonly OperationActor[],enemies:readonly OperationActor[],dt:number):OperationState {
 if(s.status!=='active')return s;
 const m=operationById(s.missionId);if(!m)return {...s,status:'failed'};
 const delta=Number.isFinite(dt)?Math.max(0,Math.min(dt,1)):0;
 const n={...s,elapsed:s.elapsed+delta,stageElapsed:s.stageElapsed+delta};
 if(n.elapsed>OPERATION_DEADLINE_SECONDS)return {...n,status:'failed'};
 const living=actors.filter(a=>a.alive),foes=enemies.filter(a=>a.alive);
 if(m.optionalChallenge&&n.optionalChallengeStatus==='active'){
  const totalKills=actors.reduce((sum,a)=>sum+(Number.isFinite(a.kills)?Math.max(0,a.kills??0):0),0);
  n.optionalChallengeBaseline??=totalKills;
  n.optionalChallengeKills=Math.max(0,totalKills-n.optionalChallengeBaseline);
  n.optionalChallengeElapsed=(n.optionalChallengeElapsed??0)+delta;
  if(n.optionalChallengeKills>=m.optionalChallenge.kills)n.optionalChallengeStatus='complete';
  else if(n.optionalChallengeElapsed>=m.optionalChallenge.seconds)n.optionalChallengeStatus='failed';
 }
 if(!n.intel&&living.some(a=>near(a.pos,operationSite(map,m.optionalObjective.site),2.5)))n.intel=true;
 const g=m.objectives[s.stage];if(!g)return {...n,status:'won'};
 if(g.kind==='escort'){
  const destination=operationSite(map,g.site),start=operationSite(map,g.startSite??m.objectives[Math.max(0,s.stage-1)]?.site??g.site);
  n.escortMaxHp??=650;n.escortHp??=n.escortMaxHp;n.escortPos??=[...start] as Vec3;n.escortPayload??=g.payload??'Escort vehicle';n.escortDestination??=[...destination] as Vec3;n.escortYaw??=Math.atan2(destination[0]-start[0],destination[2]-start[2]);
  if((n.escortHp??0)<=0)return {...n,status:'failed'};
  if(living.some(a=>near(a.pos,n.escortPos!,7))){
   const dx=destination[0]-n.escortPos[0],dz=destination[2]-n.escortPos[2],distance=Math.hypot(dx,dz),step=Math.min(distance,2.6*delta);
   if(distance>0.01)n.escortPos=[n.escortPos[0]+dx/distance*step,n.escortPos[1]+(destination[1]-n.escortPos[1])*Math.min(1,delta),n.escortPos[2]+dz/distance*step];
  }
  if(Math.hypot(destination[0]-n.escortPos[0],destination[2]-n.escortPos[2])<=1.25){
   n.stage++;n.progress=0;n.stageElapsed=0;n.pulse=0;n.objectiveKillBaseline=undefined;
   if(g.payload?.toLowerCase()==='juggernaut')n.escortComplete=true;
   else {delete n.escortPos;delete n.escortHp;delete n.escortMaxHp;delete n.escortPayload;delete n.escortDestination;delete n.escortYaw;delete n.escortComplete;}
   if(n.stage>=m.objectives.length)n.status='won';
  }
  return n;
 }
 if(g.kind==='defend')n.pulse=Math.floor(n.stageElapsed/15);
 if(g.kind==='defend'&&g.killTarget){
  const totalKills=actors.reduce((sum,a)=>sum+(Number.isFinite(a.kills)?Math.max(0,a.kills??0):0),0);
  n.objectiveKillBaseline??=totalKills;
  n.progress=Math.max(0,totalKills-n.objectiveKillBaseline);
  if(n.stageElapsed>=g.seconds&&n.progress<g.killTarget)return {...n,status:'failed'};
 }
 if(g.kind==='deliver'&&!living.some(a=>a.id===n.carrierId)){
  const fallen=actors.find(a=>a.id===n.carrierId);n.packagePos=fallen?.pos??n.packagePos;n.carrierId=undefined;
  const pickup=n.packagePos??operationSite(map,m.objectives[Math.max(0,s.stage-1)].site);
  n.carrierId=living.find(a=>near(a.pos,pickup,3))?.id;
 }
 const carrier=living.find(a=>a.id===n.carrierId);if(carrier)n.packagePos=[...carrier.pos];
 const site=operationSite(map,g.site),inside=living.filter(a=>near(a.pos,site));
 const contested=foes.some(a=>near(a.pos,site,7));
 const eligible=(g.kind==='clear'||g.kind==='eliminate')?living.length>0&&foes.length===0
  :g.kind==='survive'?living.length>0
  :g.kind==='extract'?living.length>0&&inside.length===living.length&&foes.length===0
  :g.kind==='deliver'?inside.some(a=>a.id===n.carrierId)&&!contested:g.kind==='defend'?inside.length>0:inside.length>0&&!contested;
 // Kill-target defence uses progress for kills; its deadline is tracked by stageElapsed.
 if(eligible&&!(g.kind==='defend'&&g.killTarget))n.progress=Math.min(g.seconds,n.progress+delta);else if(!eligible&&g.kind==='extract')n.progress=0;
 // Guard elimination and pending reinforcement pulses both gate stage completion.
 const objectiveComplete=g.kind==='defend'&&g.killTarget? n.progress>=g.killTarget : n.progress>=g.seconds;
 if(eligible&&objectiveComplete&&((g.kind==='defend'&&g.killTarget)||g.kind==='survive'||foes.length===0)&&n.pulse===s.pulse){
  if(g.kind==='recover'){n.carrierId=inside[0]?.id;n.packagePos=[...site];}
  if(g.kind==='deliver'){n.carrierId=undefined;n.packagePos=undefined;}
  n.stage++;n.progress=0;n.stageElapsed=0;n.pulse=0;n.objectiveKillBaseline=undefined;if(n.stage>=m.objectives.length)n.status='won';
 }
 return n;
}
/** Enemy acquisition is more assertive outside the opening stealth approach. */
export function operationAwarenessMultiplier(s:Pick<OperationState,'missionId'|'stage'>):number {
 return s.missionId==='silent_entry'&&s.stage===0?1:1.45;
}
export function operationEncounter(m:OperationMission,stage:number,selectedDifficulty?:BotDifficulty,players=1,escalated=false){
 const squadScale=players>1?1.6:1;
 const alarmScale=escalated?1.25:1;
 const boss=!!m.objectives[stage]?.boss;
 const count=boss?Math.min(12,1+Math.ceil((m.intensity+1)*squadScale*alarmScale)):Math.min(24,Math.ceil((4+m.intensity+stage)*squadScale*alarmScale));
 const difficulty=selectedDifficulty??(m.intensity<=1?'easy':m.intensity<=3?'normal':'hard');
 return {count,reinforcementCount:Math.max(2,Math.ceil(count*.35)),roleWave:stage+1+(m.intensity-1)*2,difficulty:difficulty==='mixed'?undefined:difficulty,boss};
}
export interface OperationRecord {stars:number;bestSeconds:number;intel:boolean;completions:number;firstClearRewarded?:boolean;firstClearRunId?:string;firstClearXp?:number;firstClearCredits?:number}
export type OperationProgress=Record<string,OperationRecord>;
/** Summarise authored campaign progress for an act, ignoring unknown imported records. */
export function operationActSummary(act:number,p:OperationProgress):{completed:number;total:number;stars:number;maxStars:number} {
 const missions=OPERATIONS.filter(m=>m.act===act);
 const completed=missions.filter(m=>(p[m.id]?.completions??0)>0).length;
 const stars=missions.reduce((sum,m)=>sum+Math.max(0,Math.min(3,Math.floor(p[m.id]?.stars??0))),0);
 return {completed,total:missions.length,stars,maxStars:missions.length*3};
}
export function operationUnlocked(id:string,p:OperationProgress):boolean {
 const i=OPERATIONS.findIndex(m=>m.id===id);return i>=0&&!!p[id]?.completions||i===0||i>0&&!!p[OPERATIONS[i-1].id]?.completions;
}
export function operationStarCriteria(s:OperationState,deaths:number):{label:string;earned:boolean}[] {
 const won=s.status==='won';
 return [
  {label:'Complete the mission',earned:won},
  {label:'Recover the optional intel',earned:won&&s.intel},
  {label:'Complete on Veteran without dying',earned:won&&s.difficulty==='veteran'&&deaths===0},
 ];
}
/** Compare a run against the authored replay target without affecting stars or unlocks. */
export function operationTimePerformance(m:Pick<OperationMission,'parSeconds'>,elapsed:number):{elapsedSeconds:number;parSeconds:number;withinPar:boolean;deltaSeconds:number} {
 const elapsedSeconds=Number.isFinite(elapsed)?Math.max(0,Math.ceil(elapsed)):0;
 const delta=m.parSeconds-elapsedSeconds;
 return {elapsedSeconds,parSeconds:m.parSeconds,withinPar:delta>=0,deltaSeconds:Math.abs(delta)};
}
export function formatOperationTime(seconds:number):string {
 const safe=Number.isFinite(seconds)?Math.max(0,Math.floor(seconds)):0;
 return `${Math.floor(safe/60)}:${String(safe%60).padStart(2,'0')}`;
}
export function operationStars(m:OperationMission,s:OperationState,deaths:number):number {
 return operationStarCriteria(s,deaths).filter(criterion=>criterion.earned).length;
}
export function recordOperation(p:OperationProgress,s:OperationState,deaths:number):OperationProgress {
 const m=operationById(s.missionId);if(!m||s.status!=='won')return p;
 const old=p[m.id];const record:OperationRecord={stars:Math.max(old?.stars??0,operationStars(m,s,deaths)),bestSeconds:Math.min(old?.bestSeconds??Infinity,Math.ceil(s.elapsed)),intel:s.intel||!!old?.intel,completions:(old?.completions??0)+1};
 if(old?.firstClearRewarded&&typeof old.firstClearXp==='number'&&typeof old.firstClearCredits==='number')Object.assign(record,{firstClearRewarded:true,firstClearRunId:old.firstClearRunId,firstClearXp:old.firstClearXp,firstClearCredits:old.firstClearCredits});
 return {...p,[m.id]:record};
}
export function normalizeOperationProgress(raw:unknown):OperationProgress {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};
 return Object.fromEntries(OPERATIONS.flatMap(m=>{
  const r=(raw as OperationProgress)[m.id];
  if(!r||!Number.isInteger(r.stars)||r.stars<1||r.stars>3||!Number.isInteger(r.bestSeconds)||r.bestSeconds<0||r.bestSeconds>OPERATION_DEADLINE_SECONDS||!Number.isInteger(r.completions)||r.completions<=0||r.completions>1000000)return [];
  const firstClearXp=typeof r.firstClearXp==='number'&&Number.isInteger(r.firstClearXp)&&r.firstClearXp>=0&&r.firstClearXp<=10000?r.firstClearXp:-1;
  const firstClearCredits=typeof r.firstClearCredits==='number'&&Number.isInteger(r.firstClearCredits)&&r.firstClearCredits>=0&&r.firstClearCredits<=10000?r.firstClearCredits:-1;
  const firstClear=r.firstClearRewarded===true&&firstClearXp>=0&&firstClearCredits>=0;
  const firstClearRunId=firstClear&&typeof r.firstClearRunId==='string'&&/^[a-zA-Z0-9_-]{16,100}$/.test(r.firstClearRunId)?r.firstClearRunId:undefined;
  return [[m.id,{stars:r.stars,bestSeconds:r.bestSeconds,intel:r.intel===true,completions:r.completions,...(firstClear?{firstClearRewarded:true,firstClearRunId,firstClearXp,firstClearCredits}:{})}]];
 }));
}
/** Legacy browser records are read only for migration into the player database. */
export function loadOperationProgress(key:string):OperationProgress {
 try{return normalizeOperationProgress(JSON.parse(localStorage.getItem('vanguard_operations_'+key)??'{}'));}catch{return {};}
}
