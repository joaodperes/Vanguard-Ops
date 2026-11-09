/** Permanent Wonder-specific sidegrades. One active module per Wonder.
 * Owned modules are not conventional attachments: they never apply to ordinary firearms. */
export type WonderModule = {
  id:string; wonderWeaponId:string; name:string; description:string; cost:1|2;
  damageMul?:number; radiusMul?:number; rangeMul?:number; mobilityMul?:number;
  durationMul?:number; rechargeMul?:number; targets?:number;
};
const modules:WonderModule[]=[
  {id:"compression_core",wonderWeaponId:"wonder_singularity",name:"Compression Core",description:"Smaller gravity field, greater detonation damage.",cost:1,damageMul:1.28,radiusMul:.72},
  {id:"gravity_well",wonderWeaponId:"wonder_singularity",name:"Gravity Well",description:"Wider pull field with reduced damage.",cost:1,damageMul:.76,radiusMul:1.33},
  {id:"caustic_cloud",wonderWeaponId:"wonder_corrosion",name:"Caustic Cloud",description:"Wider corrosive splash, weaker initial hit.",cost:1,damageMul:.76,radiusMul:1.4},
  {id:"concentrated_acid",wonderWeaponId:"wonder_corrosion",name:"Concentrated Acid",description:"Concentrated damage with smaller splash.",cost:1,damageMul:1.2,radiusMul:.68},
  {id:"long_watch",wonderWeaponId:"wonder_turret",name:"Long Watch",description:"Longer sentry lifetime with slower rate of fire.",cost:1,durationMul:1.45,damageMul:.82},
  {id:"overclock_motor",wonderWeaponId:"wonder_turret",name:"Overclock Motor",description:"Shorter deployment, much faster suppressive fire.",cost:1,durationMul:.7,damageMul:1.12},
  {id:"precision_strike",wonderWeaponId:"wonder_deadlock",name:"Precision Strike",description:"One high-impact marked target instead of multiple.",cost:1,damageMul:1.7,targets:1},
  {id:"wide_lock",wonderWeaponId:"wonder_deadlock",name:"Wide Lock",description:"Mark more opponents, with weaker individual shots.",cost:1,damageMul:.78,targets:4},
  {id:"focused_jet",wonderWeaponId:"wonder_hellfire",name:"Focused Jet",description:"Narrower, longer-range flame stream.",cost:1,rangeMul:1.35,radiusMul:.65},
  {id:"firestorm",wonderWeaponId:"wonder_hellfire",name:"Firestorm",description:"Wider burn cone, shorter effective range.",cost:1,rangeMul:.76,radiusMul:1.22},
  {id:"chain_reactor",wonderWeaponId:"wonder_stormweaver",name:"Chain Reactor",description:"Longer electrical jumps; less damage per contact.",cost:1,damageMul:.86,rangeMul:1.25},
  {id:"mine_layer",wonderWeaponId:"wonder_stormweaver",name:"Mine Layer",description:"Emphasizes area denial with stronger mines.",cost:1,damageMul:.85,durationMul:1.35},
  {id:"concentrated_cluster",wonderWeaponId:"wonder_cluster",name:"Concentrated Cluster",description:"Tighter and stronger secondary explosions.",cost:1,damageMul:1.2,radiusMul:.75},
  {id:"wide_cluster",wonderWeaponId:"wonder_cluster",name:"Wide Cluster",description:"Spread submunitions over a wider zone.",cost:1,damageMul:.82,radiusMul:1.35},
  {id:"heavy_plating",wonderWeaponId:"wonder_riot_shield",name:"Heavy Plating",description:"Stronger shield, slower repositioning.",cost:1,damageMul:.8,mobilityMul:.83},
  {id:"agile_rig",wonderWeaponId:"wonder_riot_shield",name:"Agile Rig",description:"Lighter shield for better mobility.",cost:1,damageMul:1.15,mobilityMul:1.14},
  {id:"magnetized_rounds",wonderWeaponId:"wonder_phasebreaker",name:"Magnetized Rounds",description:"Better accuracy but weaker impact.",cost:1,damageMul:.83,rangeMul:1.23},
  {id:"overcharged_coil",wonderWeaponId:"wonder_phasebreaker",name:"Overcharged Coil",description:"Stronger penetration but less effective range.",cost:1,damageMul:1.22,rangeMul:.78},
  {id:"extended_recall",wonderWeaponId:"wonder_chrono",name:"Extended Recall",description:"Anchor survives longer but restores more slowly.",cost:1,durationMul:1.5,rechargeMul:1.2},
  {id:"quick_relay",wonderWeaponId:"wonder_chrono",name:"Quick Relay",description:"Faster recharge, shorter anchor lifetime.",cost:1,durationMul:.7,rechargeMul:.8},
  {id:"wide_shock",wonderWeaponId:"wonder_seismic",name:"Wide Shock",description:"Wider shockwave, reduced knockback damage.",cost:1,damageMul:.8,radiusMul:1.4},
  {id:"shatter_pulse",wonderWeaponId:"wonder_seismic",name:"Shatter Pulse",description:"Harder impact against cover in a narrower cone.",cost:1,damageMul:1.25,radiusMul:.75},
  {id:"false_squadron",wonderWeaponId:"wonder_phantom",name:"False Squadron",description:"Two fragile holograms instead of one resilient decoy.",cost:1,targets:2,durationMul:.75},
  {id:"lasting_echo",wonderWeaponId:"wonder_phantom",name:"Lasting Echo",description:"Longer-lived single decoy.",cost:1,durationMul:1.5},
  {id:"chilling_mist",wonderWeaponId:"wonder_whiteout",name:"Chilling Mist",description:"Wide slowdown cone, reduced damage.",cost:1,damageMul:.75,radiusMul:1.4},
  {id:"crystal_burst",wonderWeaponId:"wonder_whiteout",name:"Crystal Burst",description:"More damage in a narrow freezing stream.",cost:1,damageMul:1.3,radiusMul:.75},
  {id:"serrated_edge",wonderWeaponId:"wonder_ripper",name:"Serrated Edge",description:"More damage, fewer usable ricochets.",cost:1,damageMul:1.24,targets:2},
  {id:"quick_return",wonderWeaponId:"wonder_ripper",name:"Quick Return",description:"Extra wall bounce, reduced damage.",cost:1,damageMul:.76,targets:4},
  {id:"siegebreaker",wonderWeaponId:"wonder_juggernaut",name:"Siegebreaker",description:"Extra armor, less agility and slower minigun spin-up.",cost:2,mobilityMul:.8},
  {id:"raider_configuration",wonderWeaponId:"wonder_juggernaut",name:"Raider Configuration",description:"Lighter armor, faster stride and shotgun cycling.",cost:2,mobilityMul:1.22},
  {id:"guardian_protocol",wonderWeaponId:"wonder_juggernaut",name:"Guardian Protocol",description:"Forward shield, smaller ammunition reserves.",cost:2},
  {id:"swarm_pod",wonderWeaponId:"wonder_juggernaut",name:"Swarm Pod",description:"Replace right-click shotgun with three-rocket Swarm-3 area-control launcher.",cost:2},
  {id:"munitions_mule",wonderWeaponId:"wonder_juggernaut",name:"Munitions Mule",description:"+60% minigun and +50% shotgun ammunition at 10% lower movement speed.",cost:2,mobilityMul:.9},
];
export const WONDER_MODULES:readonly WonderModule[]=modules;
export const wonderModulesFor=(wonderWeaponId:string)=>WONDER_MODULES.filter(m=>m.wonderWeaponId===wonderWeaponId);
export const wonderModuleById=(id:string)=>WONDER_MODULES.find(m=>m.id===id);
export function validWonderModule(wonderWeaponId:string,moduleId:string):boolean{
 return !moduleId||!!WONDER_MODULES.find(m=>m.id===moduleId&&m.wonderWeaponId===wonderWeaponId);
}
export function wonderModuleEffects(wonderWeaponId:string,moduleId?:string){
 const module=WONDER_MODULES.find(m=>m.id===moduleId&&m.wonderWeaponId===wonderWeaponId);
 return {
  damageMul:module?.damageMul??1,radiusMul:module?.radiusMul??1,
  rangeMul:module?.rangeMul??1,mobilityMul:module?.mobilityMul??1,
  durationMul:module?.durationMul??1,rechargeMul:module?.rechargeMul??1,
  targets:module?.targets??0,
 };
}
/** All prices and special-effect IDs live in the shared catalog, not client input. */
export const WONDER_FINISHES=[
 {id:"wonder_nebula",name:"Nebula Reactor",description:"Animated nebula glows across the Wonder casing.",cost:1,color:"#986af5"},
 {id:"wonder_molten",name:"Molten Core",description:"A heat-shimmering animated molten-metal finish.",cost:1,color:"#ff9234"},
 {id:"wonder_prismatic",name:"Prismatic Flux",description:"Shifting rainbow energy panels and luminous edges.",cost:2,color:"#74e7fa"},
] as const;
export const WONDER_KILL_EFFECTS=[
 {id:"wonder_kill_nova",name:"Supernova",description:"Defeated opponents dissolve in a brief violet energy burst.",cost:1,color:"#bd83fb"},
 {id:"wonder_kill_shatter",name:"Crystal Shatter",description:"A quick scatter of icy shards on a Wonder elimination.",cost:1,color:"#83eafa"},
 {id:"wonder_kill_disintegrate",name:"Disintegration",description:"A fleeting amber particle disintegration.",cost:2,color:"#ffa75b"},
] as const;
export const wonderFinishById=(id:string)=>WONDER_FINISHES.find(x=>x.id===id);
export const wonderKillEffectById=(id:string)=>WONDER_KILL_EFFECTS.find(x=>x.id===id);
