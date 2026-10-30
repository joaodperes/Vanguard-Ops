/** Typed objective data and mode contracts shared by authoring and both simulations.
 * New mechanics require an explicit kind + shared runtime handler, never JSON scripts. */
import type {GameMode,Vec3} from "./game-protocol";
import orbital from "../data/maps/orbital_nexus.json";
import floodgate from "../data/maps/floodgate.json";
import compound from "../data/maps/compound.json";
import skybridge from "../data/maps/skybridge.json";
import forest from "../data/maps/forest-objectives.json";
export type ObjectiveTeam="red"|"blue";
interface ObjectiveBase {
  id:string; pos:Vec3; radius:number; verticalTolerance:number;
  /** Ground-level entrance points for elevated objectives. Geometry remains separate. */
  approaches?:Vec3[];
  /** Optional matching upper landings for multi-stage stair routes. */
  approachLandings?:Vec3[];
}
export type MapObjective =
  | (ObjectiveBase & {kind:"flag"|"capture_zone";team:ObjectiveTeam})
  | (ObjectiveBase & {kind:"reactor";chargeRadius:number;killsRequired:number});
export interface ObjectiveMap {objectives?:MapObjective[];modes?:GameMode[];gravityScale?:number}
export type ObjectiveSource=string|ObjectiveMap;
export const OBJECTIVE_KINDS=["flag","capture_zone","reactor"] as const;
/** Counts are mode contracts, independent of map IDs. Future modes extend this table. */
export const MODE_OBJECTIVES:Record<GameMode,readonly {kind:MapObjective["kind"];team?:ObjectiveTeam}[]>={
  ffa:[],tdm:[],survival:[],gungame:[],killconfirmed:[],
  ctf:[{kind:"flag",team:"red"},{kind:"flag",team:"blue"},
    {kind:"capture_zone",team:"red"},{kind:"capture_zone",team:"blue"}],
};
export const DEFAULT_COMBAT_MODES:GameMode[]=["ffa","tdm","survival","gungame","killconfirmed"];
/** Compatibility for old API callers and pre-objective editor saves only. */
export function legacyObjectiveMap(id:string):ObjectiveMap {
  const authored=({orbital_nexus:orbital,floodgate,compound,skybridge} as Record<string,{blueprint:unknown}>)[id]?.blueprint as ObjectiveMap|undefined;
  if(authored)return {objectives:authored.objectives,modes:authored.modes,gravityScale:authored.gravityScale};
  if(id==="forest_warfare")return forest as unknown as ObjectiveMap;
  return {};
}
export const objectiveMap=(source:ObjectiveSource):ObjectiveMap=>typeof source==="string"?legacyObjectiveMap(source):source;
export const mapObjectives=(source:ObjectiveSource):MapObjective[]=>objectiveMap(source).objectives??[];
export function teamObjective(source:ObjectiveSource,kind:"flag"|"capture_zone",team:ObjectiveTeam){
  return mapObjectives(source).find(o=>o.kind===kind&&"team" in o&&o.team===team);
}
export function reactorObjective(source:ObjectiveSource){
  return mapObjectives(source).find((o):o is Extract<MapObjective,{kind:"reactor"}>=>o.kind==="reactor");
}
export function supportsMapMode(map:ObjectiveMap,mode:GameMode):boolean {
  return Object.hasOwn(MODE_OBJECTIVES,mode)&&(map.modes??DEFAULT_COMBAT_MODES).includes(mode)&&MODE_OBJECTIVES[mode].every(req=>
    (map.objectives??[]).filter(o=>o.kind===req.kind&&(!req.team||"team" in o&&o.team===req.team)).length===1);
}
/** Approach the nearest saved entrance before targeting an elevated landing. */
export function objectiveApproach(objective:MapObjective,pos:Vec3):Vec3 {
  if(pos[1]>=objective.pos[1]-.85||!objective.approaches?.length)return [...objective.pos];
  const entry=[...objective.approaches].sort((a,b)=>Math.hypot(a[0]-pos[0],a[2]-pos[2])-Math.hypot(b[0]-pos[0],b[2]-pos[2]))[0];
  const landing=objective.approachLandings?.[objective.approaches.indexOf(entry)]??objective.pos;
  return Math.hypot(pos[0]-entry[0],pos[2]-entry[2])<=3||pos[1]>entry[1]+.5?[...landing]:[...entry];
}
export function objectiveDistance(source:ObjectiveSource,pos:readonly number[]):number {
  const target=reactorObjective(source)?.pos??[0,0,0];
  return Math.hypot(pos[0]-target[0],pos[2]-target[2]);
}
/** Accept unknown at import boundaries: malformed JSON must yield diagnostics, not throw. */
export function validateObjectives(map:ObjectiveMap,inside?:(p:Vec3)=>boolean):string[]{
  const issues:string[]=[],ids=new Set<string>(),slots=new Set<string>();
  const raw=map.objectives;
  if(raw!==undefined&&!Array.isArray(raw))return ["Objectives must be an array"];
  const point=(p:unknown):p is Vec3=>Array.isArray(p)&&p.length===3&&p.every(n=>typeof n==="number"&&Number.isFinite(n));
  for(const o of raw??[]){
    if(!o||typeof o!=="object"){issues.push("Invalid objective record");continue;}
    const label=`Objective ${o.id??"?"}`;
    if(typeof o.id!=="string"||!o.id||o.id.length>160||ids.has(o.id))issues.push(label+" missing/duplicate ID");
    ids.add(o.id);
    if(!OBJECTIVE_KINDS.includes(o.kind)){issues.push(label+" unsupported kind");continue;}
    if(!point(o.pos)||inside&&!inside(o.pos))issues.push(label+" needs a finite position inside walkable space");
    if(!Number.isFinite(o.radius)||o.radius<=0||o.radius>256||!Number.isFinite(o.verticalTolerance)||o.verticalTolerance<=0||o.verticalTolerance>64)issues.push(label+" invalid trigger size");
    if(o.approaches!==undefined&&(!Array.isArray(o.approaches)||o.approaches.length>16||o.approaches.some(p=>!point(p)||inside&&!inside(p))))issues.push(label+" invalid approach points");
    if(o.approachLandings!==undefined&&(!Array.isArray(o.approachLandings)||o.approachLandings.length!==o.approaches?.length||o.approachLandings.some(p=>!point(p)||inside&&!inside(p))))issues.push(label+" invalid approach landings");
    const allowed=["id","kind","pos","radius","verticalTolerance","approaches","approachLandings",...(o.kind==="reactor"?["chargeRadius","killsRequired"]:["team"])];
    if(Object.keys(o).some(k=>!allowed.includes(k)))issues.push(label+" unsupported fields");
    const slot=o.kind+(o.kind!=="reactor"?":"+o.team:"");
    if(slots.has(slot))issues.push(label+" duplicates an objective role (one reactor and one flag/zone per team supported)");
    slots.add(slot);
    if(o.kind==="reactor"){
      if(!Number.isSafeInteger(o.killsRequired)||o.killsRequired<1||o.killsRequired>1000||!Number.isFinite(o.chargeRadius)||o.chargeRadius<o.radius||o.chargeRadius>512)issues.push(label+" invalid reactor charge rules");
    }else if(o.team!=="red"&&o.team!=="blue")issues.push(label+" invalid team");
  }
  if(map.gravityScale!==undefined&&(!Number.isFinite(map.gravityScale)||map.gravityScale<.1||map.gravityScale>3))issues.push("Gravity scale must be within 0.1–3");
  if(map.modes!==undefined){
    if(!Array.isArray(map.modes)||!map.modes.length)issues.push("Choose at least one supported mode");
    else {
      const seen=new Set<string>();
      for(const mode of map.modes){
        if(!Object.hasOwn(MODE_OBJECTIVES,mode)||seen.has(mode)){issues.push("Unknown or duplicate mode "+mode);continue;}
        seen.add(mode);
        for(const req of MODE_OBJECTIVES[mode])if(!(raw??[]).some(o=>o?.kind===req.kind&&(!req.team||"team" in o&&o.team===req.team)))issues.push(`${mode} requires ${req.team??""} ${req.kind}`);
      }
    }
  }
  return issues;
}
