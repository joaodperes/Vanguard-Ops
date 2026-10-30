/** Deterministic map events shared by browser and multiplayer server. */
export const FLOODGATE_CORE_ID = "floodgate_dam_core";
export const FLOODGATE_DAM_PANELS = ["floodgate_dam_west_outer","floodgate_dam_west","floodgate_dam_east","floodgate_dam_east_outer"] as const;
/** Every gate section shares the same finite structural health pool. A bullet
 * hitting any large panel must damage the same core instead of a fake 100k HP wall. */
export function floodgateDamageTarget(id:string):string {
  return id===FLOODGATE_CORE_ID||FLOODGATE_DAM_PANELS.some(panel=>panel===id)
    ? FLOODGATE_CORE_ID : id;
}
export function floodgateBreachTargets(id:string):readonly string[] {
  return id===FLOODGATE_CORE_ID ? FLOODGATE_DAM_PANELS : [];
}
export function floodgateBreached(walls:ReadonlyMap<string,number>):boolean {
  return (walls.get(FLOODGATE_CORE_ID)??Infinity)<=0;
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
