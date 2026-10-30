/** Deterministic map events shared by browser and multiplayer server. */
export const FLOODGATE_CORE_ID = "floodgate_dam_core";
export const FLOODGATE_DAM_PANELS = ["floodgate_dam_west_outer","floodgate_dam_west","floodgate_dam_east","floodgate_dam_east_outer"] as const;
/** Every gate section shares the same finite structural health pool. A bullet
 * hitting any large panel must damage the same core instead of a fake 100k HP wall. */
export function floodgateDamageTarget(id:string):string {
  return id===FLOODGATE_CORE_ID||FLOODGATE_DAM_PANELS.some(panel=>panel===id)
    ? FLOODGATE_CORE_ID : id;
}
/** One finite structural HP pool, reflected on every linked segment.
 * Returns the changed IDs so a server can remove each collider on collapse.
 * A non-Floodgate breakable remains an independent destructible. */
export function applyLinkedWallDamage(
  walls:Map<string,number>,hitId:string,damage:number,
):{ids:string[];hp:number}|null{
  const target=floodgateDamageTarget(hitId);
  const previous=walls.get(target);
  if(previous===undefined||previous<=0||!Number.isFinite(damage)||damage<=0)return null;
  const hp=Math.max(0,previous-damage);
  const ids=target===FLOODGATE_CORE_ID
    ?[target,...FLOODGATE_DAM_PANELS].filter(id=>walls.has(id))
    :[target];
  for(const id of ids)walls.set(id,hp);
  return {ids,hp};
}
export function floodgateBreachTargets(id:string):readonly string[] {
  return id===FLOODGATE_CORE_ID ? FLOODGATE_DAM_PANELS : [];
}
export function floodgateBreached(walls:ReadonlyMap<string,number>):boolean {
  return (walls.get(FLOODGATE_CORE_ID)??Infinity)<=0;
}
/** Breach is a one-time map-changing hydro event. Water spreads from the
 * northern boundary (-103) into the spillway (-36); the side spawns and
 * elevated service decks remain dry, so CTF never loses all crossings. */
export const FLOODGATE_DAM_HP=3000;
export const FLOODGATE_SURGE_SECONDS=14;
export const FLOODGATE_FLOOD_START_Z=-103;
export const FLOODGATE_FLOOD_END_Z=-36;
export const FLOODGATE_FLOOD_HALF_WIDTH=132;
export const FLOODGATE_FLOOD_DRY_HEIGHT=2.2;
export function floodgateSurgeFront(age:number):number{
  return FLOODGATE_FLOOD_START_Z+
    (FLOODGATE_FLOOD_END_Z-FLOODGATE_FLOOD_START_Z)*
      Math.min(1,Math.max(0,age/FLOODGATE_SURGE_SECONDS));
}
/** Collision-independent effect sampled identically by server, offline bots,
 * human movement and visual effects. Null age means the dam is intact. */
export function floodgateWaterEffect(
  x:number,y:number,z:number,age:number|null,
):{flooded:boolean;surge:boolean;speedMultiplier:number;pushZ:number}{
  const safe={flooded:false,surge:false,speedMultiplier:1,pushZ:0};
  if(age===null||age<0||Math.abs(x)>FLOODGATE_FLOOD_HALF_WIDTH||
    y>FLOODGATE_FLOOD_DRY_HEIGHT||
    z<FLOODGATE_FLOOD_START_Z||z>FLOODGATE_FLOOD_END_Z)return safe;
  const front=floodgateSurgeFront(age);
  // The hydraulic front is fast and dangerous for ~14s; after it passes,
  // low ground is persistently flooded, slows movement and pushes south.
  const surge=age<FLOODGATE_SURGE_SECONDS&&Math.abs(z-front)<10;
  const flooded=z<=front+2;
  if(!flooded&&!surge)return safe;
  return {flooded,surge,speedMultiplier:surge?.36:.64,pushZ:surge?15:3.8};
}

export const WHITEOUT_CYCLE_SECONDS=98;
export function whiteoutIntensity(seconds:number):number {
  const t=Math.max(0,seconds-10)%WHITEOUT_CYCLE_SECONDS;
  if(t<20)return 0;
  if(t<28)return (t-20)/8;
  if(t<55)return 1;
  if(t<65)return (65-t)/10;
  return 0;
}
/** Freight sheds and the southern service galleries shelter infantry from wind. */
export function whiteoutExposure(x:number,z:number):number {
  const shed=Math.abs(z)<17&&Math.abs(x)>10&&Math.abs(x)<72;
  const gallery=z>31&&z<57&&Math.abs(x)<80;
  return shed||gallery ? .25 : 1;
}
export function whiteoutVisibility(seconds:number,pos?:readonly number[]):number {
  return 160-122*whiteoutIntensity(seconds)*(pos?whiteoutExposure(pos[0],pos[2]):1);
}
export function whiteoutWindow(seconds:number):{phase:"idle"|"warning"|"active";secondsLeft:number}{
  const t=Math.max(0,seconds-10)%WHITEOUT_CYCLE_SECONDS;
  if(seconds<10)return {phase:"idle",secondsLeft:0};
  if(t>=20&&t<65)return {phase:"active",secondsLeft:Math.max(1,Math.ceil(65-t))};
  if(t>=10&&t<20)return {phase:"warning",secondsLeft:Math.max(1,Math.ceil(20-t))};
  return {phase:"idle",secondsLeft:0};
}
