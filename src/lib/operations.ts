/** Campaign rules shared by local play and authoritative co-op. */
import type {MapDef,MapId,Vec3,BotDifficulty} from './game-protocol';
export type OperationKind='clear'|'secure'|'defend'|'recover'|'deliver'|'extract';
export interface OperationObjective {kind:OperationKind;label:string;site:number;seconds:number}
export interface OperationMission {id:string;act:number;title:string;mapId:MapId;briefing:string;debrief:string;intensity:number;parSeconds:number;objectives:OperationObjective[]}
const goal=(kind:OperationKind,label:string,site:number,seconds=0):OperationObjective=>({kind,label,site,seconds});
export const OPERATIONS:readonly OperationMission[]=[
 {id:'silent_entry',act:1,title:'Silent Entry',mapId:'compound',intensity:1,parSeconds:600,
  briefing:'A stolen Vanguard relay has gone dark. Breach the jungle outpost, copy its dispatch records and escape with the first lead.',debrief:'The relay points to an arms pipeline running through Ridgefall.',
  objectives:[goal('clear','Break the outpost perimeter',0),goal('secure','Copy the dispatch records',3,45),goal('recover','Recover the encrypted relay',7,5),goal('deliver','Deliver the relay to the uplink',1,8),goal('extract','Reach the extraction zone',0,12)]},
 {id:'freight_intercept',act:1,title:'Freight Intercept',mapId:'skybridge',intensity:1,parSeconds:660,
  briefing:'Intercept the convoy before its cargo leaves the factory. Hold the loading area while command traces the next shipment.',debrief:'The manifest identifies a sleeper cell in Afterlight.',
  objectives:[goal('secure','Disable the convoy beacon',2,35),goal('clear','Clear the freight escort',6),goal('defend','Hold the loading area for the scan',4,75),goal('recover','Recover the cargo manifest',8,5),goal('extract','Extract with the manifest',0,15)]},
 {id:'city_signal',act:1,title:'City Signal',mapId:'terminal',intensity:2,parSeconds:660,
  briefing:'Two transmission sites are hiding the cell. Triangulate their signal and retrieve the operator cipher.',debrief:'The cipher exposes a transfer through Whiteout Depot.',
  objectives:[goal('secure','Triangulate the first transmitter',3,45),goal('secure','Triangulate the second transmitter',9,45),goal('clear','Eliminate the cipher escort',6),goal('recover','Recover the operator cipher',11,5),goal('extract','Reach the evacuation point',1,15)]},
 {id:'cold_trail',act:1,title:'Cold Trail',mapId:'whiteout_depot',intensity:2,parSeconds:720,
  briefing:'Secure the snowbound depot, recover the cipher reader and defend the upload.',debrief:'A buried transmission leads to Emberhold. Act one is complete.',
  objectives:[goal('clear','Clear the rail checkpoint',2),goal('recover','Recover the cipher reader',7,6),goal('deliver','Bring the reader to the transmitter',4,10),goal('defend','Defend the decrypted upload',4,90),goal('extract','Withdraw to the rail exit',0,18)]},
 {id:'keep_secrets',act:2,title:'Keep Secrets',mapId:'emberhold',intensity:2,parSeconds:720,
  briefing:'Emberhold houses the network archive. Secure its access points before recovering the command ledger.',debrief:'The archive describes a planned breach at Floodgate.',
  objectives:[goal('secure','Override the outer archive lock',3,45),goal('clear','Break the archive guard',8),goal('secure','Decode the archive terminal',12,60),goal('recover','Recover the command ledger',6,8),goal('extract','Escape the keep',0,18)]},
 {id:'rising_water',act:2,title:'Rising Water',mapId:'floodgate',intensity:3,parSeconds:720,
  briefing:'The enemy is using the dam to power its uplink. Isolate both control sites and hold a secure connection through the breach.',debrief:'The uplink is routed through an orbital station.',
  objectives:[goal('secure','Isolate the first control station',3,55),goal('secure','Isolate the second control station',10,55),goal('defend','Defend the emergency uplink',6,90),goal('recover','Recover the orbital access key',12,6),goal('extract','Reach the safe evacuation zone',0,20)]},
 {id:'orbital_blackout',act:2,title:'Orbital Blackout',mapId:'orbital_nexus',intensity:3,parSeconds:780,
  briefing:'Board the station and restore access to its core. Deliver the access module and copy the reactor logs.',debrief:'The logs identify a second ground relay.',
  objectives:[goal('clear','Secure the boarding corridor',1),goal('recover','Recover the reactor access module',8,6),goal('deliver','Install the module at the service uplink',4,12),goal('defend','Hold the reactor log transfer',4,100),goal('extract','Return to the docking perimeter',0,20)]},
 {id:'relay_siege',act:2,title:'Relay Siege',mapId:'compound',intensity:3,parSeconds:720,
  briefing:'The ground relay is the only route into the command network. Seize its terminals and survive the response force.',debrief:'Command has located the final weapons cache. Act two is complete.',
  objectives:[goal('secure','Seize the west relay',5,55),goal('secure','Seize the east relay',10,55),goal('defend','Defend the command handshake',2,100),goal('clear','Destroy the response force',7),goal('extract','Evacuate the relay',0,20)]},
 {id:'last_shipment',act:3,title:'Last Shipment',mapId:'skybridge',intensity:4,parSeconds:780,
  briefing:'Stop the last weapons shipment. Recover the targeting package and upload its contents before the network relocates.',debrief:'The targeting package reveals an attack on the city.',
  objectives:[goal('clear','Break the cache defences',4),goal('recover','Recover the targeting package',9,8),goal('deliver','Carry the package to the factory uplink',2,12),goal('defend','Hold the targeting upload',2,110),goal('extract','Reach the freight extraction point',0,22)]},
 {id:'night_watch',act:3,title:'Night Watch',mapId:'arena_neon',intensity:4,parSeconds:780,
  briefing:'The city cells are activating. Jam command sites and retrieve the evacuation codes while the streets remain contested.',debrief:'The codes expose the final stronghold.',
  objectives:[goal('secure','Jam the northern command site',8,65),goal('defend','Hold the southern jammer',3,100),goal('recover','Recover the evacuation codes',12,8),goal('deliver','Transmit the codes to command',5,12),goal('extract','Withdraw through the evacuation zone',0,22)]},
 {id:'broken_crown',act:3,title:'Broken Crown',mapId:'emberhold',intensity:4,parSeconds:840,
  briefing:'Return to Emberhold to cut the command network at its source. Its defenders are expecting you this time.',debrief:'The command archive gives you the master shutdown sequence.',
  objectives:[goal('clear','Breach the command guard',6),goal('secure','Unlock the command archive',12,75),goal('defend','Hold the shutdown sequence transfer',4,110),goal('recover','Recover the master sequence',9,10),goal('extract','Escape with the master sequence',0,25)]},
 {id:'zero_hour',act:3,title:'Zero Hour',mapId:'orbital_nexus',intensity:5,parSeconds:900,
  briefing:'One final insertion. Carry the master sequence into the station, hold the shutdown and get your squad home.',debrief:'The network is offline. Operation complete. Replay missions to improve your ratings and recover every intel cache.',
  objectives:[goal('clear','Break the station blockade',2),goal('recover','Recover the shutdown carrier',10,10),goal('deliver','Install the master sequence',5,15),goal('defend','Defend the final shutdown',5,120),goal('clear','Eliminate the remaining command guard',12),goal('extract','Extract the entire surviving squad',0,30)]},
];
export const operationById=(id:unknown)=>typeof id==='string'?OPERATIONS.find(m=>m.id===id):undefined;
export function nextOperation(id:string){const i=OPERATIONS.findIndex(m=>m.id===id);return i>=0 ? OPERATIONS[i+1]:undefined;}
/** Campaign whitelist does not alter standard Survival map availability. */
export function operationConfigValid(c:{operationId?:unknown;mode:string;mapId:string;survivalTier?:unknown}):boolean {
 const m=operationById(c.operationId);return !!m&&c.mode==='survival'&&c.mapId===m.mapId&&(c.survivalTier===undefined||c.survivalTier==='default');
}
export interface OperationState {missionId:string;stage:number;progress:number;elapsed:number;stageElapsed:number;pulse:number;intel:boolean;carrierId?:string;packagePos?:Vec3;status:'active'|'won'|'failed'}
export const createOperationState=(missionId:string):OperationState=>({missionId,stage:0,progress:0,elapsed:0,stageElapsed:0,pulse:0,intel:false,status:'active'});
export interface OperationActor {id:string;pos:Vec3;alive:boolean}
/** Use collision-cleared authored pads, with the same positions on both simulations. */
export function operationSite(map:Pick<MapDef,'spawns'>,index:number):Vec3 {
 const p=map.spawns.ffa;return [...(p[index%p.length]??map.spawns.blue[0]??[0,0,0])] as Vec3;
}
const near=(a:Vec3,b:Vec3,r=4)=>Math.hypot(a[0]-b[0],a[2]-b[2])<=r&&Math.abs(a[1]-b[1])<2.5;
export function operationTarget(s:OperationState,map:Pick<MapDef,'spawns'>):Vec3|undefined {
 const m=operationById(s.missionId),g=m?.objectives[s.stage];if(!g)return;
 if(g.kind==='deliver'&&!s.carrierId)return s.packagePos??operationSite(map,m!.objectives[Math.max(0,s.stage-1)].site);
 return operationSite(map,g.site);
}
export function tickOperation(s:OperationState,map:Pick<MapDef,'spawns'>,actors:readonly OperationActor[],enemies:readonly OperationActor[],dt:number):OperationState {
 if(s.status!=='active')return s;
 const m=operationById(s.missionId);if(!m)return {...s,status:'failed'};
 const delta=Number.isFinite(dt)?Math.max(0,Math.min(dt,1)):0;
 const n={...s,elapsed:s.elapsed+delta,stageElapsed:s.stageElapsed+delta};
 if(n.elapsed>m.parSeconds*2)return {...n,status:'failed'};
 const living=actors.filter(a=>a.alive),foes=enemies.filter(a=>a.alive);
 if(!n.intel&&living.some(a=>near(a.pos,operationSite(map,15),2.5)))n.intel=true;
 const g=m.objectives[s.stage];if(!g)return {...n,status:'won'};
 if(g.kind==='defend')n.pulse=Math.min(3,Math.floor(n.stageElapsed/25));
 if(g.kind==='deliver'&&!living.some(a=>a.id===n.carrierId)){
  const fallen=actors.find(a=>a.id===n.carrierId);n.packagePos=fallen?.pos??n.packagePos;n.carrierId=undefined;
  const pickup=n.packagePos??operationSite(map,m.objectives[Math.max(0,s.stage-1)].site);
  n.carrierId=living.find(a=>near(a.pos,pickup,3))?.id;
 }
 const carrier=living.find(a=>a.id===n.carrierId);if(carrier)n.packagePos=[...carrier.pos];
 const site=operationSite(map,g.site),inside=living.filter(a=>near(a.pos,site));
 const contested=foes.some(a=>near(a.pos,site,7));
 const eligible=g.kind==='clear'?living.length>0&&foes.length===0
  :g.kind==='extract'?living.length>0&&inside.length===living.length&&foes.length===0
  :g.kind==='deliver'?inside.some(a=>a.id===n.carrierId)&&!contested:inside.length>0&&!contested;
 if(eligible)n.progress=Math.min(g.seconds,n.progress+delta);else if(g.kind==='extract')n.progress=0;
 // Guard elimination and pending reinforcement pulses both gate stage completion.
 if(eligible&&n.progress>=g.seconds&&foes.length===0&&n.pulse===s.pulse){
  if(g.kind==='recover'){n.carrierId=inside[0]?.id;n.packagePos=[...site];}
  if(g.kind==='deliver'){n.carrierId=undefined;n.packagePos=undefined;}
  n.stage++;n.progress=0;n.stageElapsed=0;n.pulse=0;if(n.stage>=m.objectives.length)n.status='won';
 }
 return n;
}
export function operationEncounter(m:OperationMission,stage:number,players:number){
 const count=Math.min(18,4+m.intensity+stage+Math.max(0,players-1)*3);
 return {count,reinforcementCount:Math.max(2,Math.ceil(count*.35)),roleWave:stage+1+(m.intensity-1)*2,difficulty:(m.intensity<=1?'easy':m.intensity<=3?'normal':'hard') as Exclude<BotDifficulty,'mixed'>};
}
export interface OperationRecord {stars:number;bestSeconds:number;intel:boolean;completions:number}
export type OperationProgress=Record<string,OperationRecord>;
export function operationUnlocked(id:string,p:OperationProgress):boolean {
 const i=OPERATIONS.findIndex(m=>m.id===id);return i>=0&&!!p[id]?.completions||i===0||i>0&&!!p[OPERATIONS[i-1].id]?.completions;
}
export function operationStars(m:OperationMission,s:OperationState,deaths:number):number {
 return s.status==='won'?1+Number(s.intel)+Number(deaths===0&&s.elapsed<=m.parSeconds):0;
}
export function recordOperation(p:OperationProgress,s:OperationState,deaths:number):OperationProgress {
 const m=operationById(s.missionId);if(!m||s.status!=='won')return p;
 const old=p[m.id];return {...p,[m.id]:{stars:Math.max(old?.stars??0,operationStars(m,s,deaths)),bestSeconds:Math.min(old?.bestSeconds??Infinity,Math.ceil(s.elapsed)),intel:s.intel||!!old?.intel,completions:(old?.completions??0)+1}};
}
export function loadOperationProgress(key:string):OperationProgress {
 try{
  const raw=JSON.parse(localStorage.getItem('vanguard_operations_'+key)??'{}');
  return Object.fromEntries(OPERATIONS.flatMap(m=>{const r=raw?.[m.id];return r&&Number.isInteger(r.stars)&&r.stars>=1&&r.stars<=3&&Number.isFinite(r.bestSeconds)&&r.bestSeconds>=0&&Number.isInteger(r.completions)&&r.completions>0?[[m.id,{stars:r.stars,bestSeconds:r.bestSeconds,intel:r.intel===true,completions:r.completions}]]:[];}));
 }catch{return {};}
}
export function saveOperationProgress(key:string,s:OperationState,deaths:number):boolean {
 try{localStorage.setItem('vanguard_operations_'+key,JSON.stringify(recordOperation(loadOperationProgress(key),s,deaths)));return true;}catch{return false;}
}
