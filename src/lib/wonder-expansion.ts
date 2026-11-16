/** Permanent Wonder-specific sidegrades. One active module per Wonder.
 * Owned modules are not conventional attachments: they never apply to ordinary firearms. */
export type WonderModule = {
  id:string; wonderWeaponId:string; name:string; description:string; cost:1|2;
  damageMul?:number; radiusMul?:number; rangeMul?:number; mobilityMul?:number;
  durationMul?:number; rechargeMul?:number; targets?:number;
  pullMul?:number; knockbackMul?:number; scanMul?:number; chainMul?:number; armMul?:number; durabilityMul?:number;
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
  {id:"magnetized_rounds",wonderWeaponId:"wonder_phasebreaker",name:"Magnetized Rounds",description:"Longer effective rail range with reduced impact damage.",cost:1,damageMul:.83,rangeMul:1.23},
  {id:"overcharged_coil",wonderWeaponId:"wonder_phasebreaker",name:"Overcharged Coil",description:"Higher rail impact damage with shorter effective range.",cost:1,damageMul:1.22,rangeMul:.78},
  {id:"extended_recall",wonderWeaponId:"wonder_chrono",name:"Extended Recall",description:"Anchor survives longer but restores more slowly.",cost:1,durationMul:1.5,rechargeMul:1.2},
  {id:"quick_relay",wonderWeaponId:"wonder_chrono",name:"Quick Relay",description:"Faster recharge, shorter anchor lifetime.",cost:1,durationMul:.7,rechargeMul:.8},
  {id:"wide_shock",wonderWeaponId:"wonder_seismic",name:"Wide Shock",description:"Wider shockwave, reduced knockback damage.",cost:1,damageMul:.8,radiusMul:1.4},
  {id:"shatter_pulse",wonderWeaponId:"wonder_seismic",name:"Shatter Pulse",description:"Harder impact against cover in a narrower cone.",cost:1,damageMul:1.25,radiusMul:.75},
  {id:"false_squadron",wonderWeaponId:"wonder_phantom",name:"False Squadron",description:"Two fragile holograms instead of one resilient decoy.",cost:1,targets:2,durationMul:.75},
  {id:"lasting_echo",wonderWeaponId:"wonder_phantom",name:"Lasting Echo",description:"Longer-lived single decoy.",cost:1,durationMul:1.5},
  {id:"chilling_mist",wonderWeaponId:"wonder_whiteout",name:"Chilling Mist",description:"Wide slowdown cone, reduced damage.",cost:1,damageMul:.75,radiusMul:1.4},
  {id:"crystal_burst",wonderWeaponId:"wonder_whiteout",name:"Crystal Burst",description:"More damage in a narrow freezing stream.",cost:1,damageMul:1.3,radiusMul:.75},
  {id:"serrated_edge",wonderWeaponId:"wonder_ripper",name:"Serrated Edge",description:"More damage, fewer usable ricochets.",cost:1,damageMul:1.24,targets:2},
  {id:"quick_return",wonderWeaponId:"wonder_ripper",name:"Quick Return",description:"One extra wall bounce, reduced damage.",cost:1,damageMul:.76,targets:5},
  {id:"siegebreaker",wonderWeaponId:"wonder_juggernaut",name:"Siegebreaker",description:"Extra armor, less agility and slower minigun spin-up.",cost:2,mobilityMul:.8},
  {id:"raider_configuration",wonderWeaponId:"wonder_juggernaut",name:"Raider Configuration",description:"Lighter armor, faster stride and shotgun cycling.",cost:2,mobilityMul:1.22},
  {id:"guardian_protocol",wonderWeaponId:"wonder_juggernaut",name:"Guardian Protocol",description:"Forward shield, smaller ammunition reserves.",cost:2},
  {id:"swarm_pod",wonderWeaponId:"wonder_juggernaut",name:"Swarm Pod",description:"Replace right-click shotgun with three-rocket Swarm-3 area-control launcher.",cost:2},
  {id:"munitions_mule",wonderWeaponId:"wonder_juggernaut",name:"Munitions Mule",description:"+60% minigun and +50% shotgun ammunition at 10% lower movement speed.",cost:2,mobilityMul:.9},
  {"id":"tidal_lock","wonderWeaponId":"wonder_singularity","name":"Tidal Lock","description":"Faster gravitational pull with a shorter-lived well and weaker blast.","cost":1,"damageMul":0.9,"durationMul":0.7,"pullMul":1.4},
  {"id":"spore_relay","wonderWeaponId":"wonder_corrosion","name":"Spore Relay","description":"A poisoned victim spreads brief weakened poison on death; initial impact damage -25%.","cost":1,"damageMul":0.75},
  {"id":"targeting_uplink","wonderWeaponId":"wonder_turret","name":"Targeting Uplink","description":"Prioritizes attackers of its owner; turret durability -20%.","cost":1,"durabilityMul":0.8},
  {"id":"backdraft_valve","wonderWeaponId":"wonder_hellfire","name":"Backdraft Valve","description":"Initial flame bursts hit harder but fuel recharges 25% slower.","cost":1,"damageMul":1.2,"rechargeMul":1.25},
  {"id":"grounding_array","wonderWeaponId":"wonder_stormweaver","name":"Grounding Array","description":"Mines arm faster, but lightning chains jump fewer times.","cost":1,"chainMul":0.5,"armMul":0.55},
  {"id":"fuse_programmer","wonderWeaponId":"wonder_cluster","name":"Fuse Programmer","description":"Faster primary detonation and stronger main blast; only three bomblets.","cost":1,"damageMul":1.18,"targets":3,"durationMul":0.65},
  {"id":"tag_relay","wonderWeaponId":"wonder_deadlock","name":"Tag Relay","description":"A defeated marked enemy transfers a tag to another nearby exposed enemy; shots -20% damage.","cost":1,"damageMul":0.8},
  {"id":"counterbrace","wonderWeaponId":"wonder_riot_shield","name":"Counterbrace","description":"Blocked hits briefly stabilize the P-9; shield recharge takes 20% longer.","cost":1,"rechargeMul":1.2},
  {"id":"capacitor_siphon","wonderWeaponId":"wonder_phasebreaker","name":"Capacitor Siphon","description":"A kill through penetrable cover accelerates charge recovery; impact -10% damage.","cost":1,"damageMul":0.9},
  {"id":"residual_beacon","wonderWeaponId":"wonder_chrono","name":"Residual Beacon","description":"Recall reveals exposed enemies near the anchor; anchor duration -25%.","cost":1,"durationMul":0.75},
  {"id":"kinetic_redirector","wonderWeaponId":"wonder_seismic","name":"Kinetic Redirector","description":"50% stronger pushback, at the cost of 30% less damage.","cost":1,"damageMul":0.7,"knockbackMul":1.5},
  {"id":"mimic_signal","wonderWeaponId":"wonder_phantom","name":"Mimic Signal","description":"More frequent convincing fake gunshots, but decoys last 20% less time.","cost":1,"durationMul":0.8},
  {"id":"cryo_seal","wonderWeaponId":"wonder_whiteout","name":"Cryo Seal","description":"Longer chilling slowdown duration within a narrower beam.","cost":1,"radiusMul":0.75,"durationMul":1.5},
  {"id":"return_catch","wonderWeaponId":"wonder_ripper","name":"Return Catch","description":"Catch a disc returning near your position to accelerate its next charge; damage -20%.","cost":1,"damageMul":0.8},
  {"id":"emergency_ejection","wonderWeaponId":"wonder_juggernaut","name":"Emergency Ejection","description":"Keep at least 30 health on safe ejection, but mech operation ends 20% sooner.","cost":2,"durationMul":0.8},
  {"id":"silent_survey","wonderWeaponId":"wonder_harbinger","name":"Silent Survey","description":"Drone scans 25% farther, but its rounds deal 35% less damage.","cost":1,"scanMul":1.25,"damageMul":0.65},
  {"id":"hunter_killer","wonderWeaponId":"wonder_harbinger","name":"Hunter-Killer","description":"Drone rounds hit 40% harder but scan and firing radii shrink 25%.","cost":1,"scanMul":0.75,"damageMul":1.4},
];
export const WONDER_MODULES:readonly WonderModule[]=modules;
export const wonderModulesFor=(wonderWeaponId:string)=>WONDER_MODULES.filter(m=>m.wonderWeaponId===wonderWeaponId);
export const wonderModuleById=(id:string)=>WONDER_MODULES.find(m=>m.id===id);
/** Numeric, human-readable sidegrade changes shared by the Armory and firing range. */
export function wonderModuleModifiers(module:WonderModule|undefined,weaponId=""):{
  label:string;value:string
}[]{
  if(!module)return [];
  const fields:[keyof WonderModule,string][]=[
    ["damageMul","Damage"],["radiusMul","Area"],["rangeMul","Range"],["mobilityMul","Mobility"],
    ["durationMul","Duration"],["rechargeMul","Recharge time"],["pullMul","Pull strength"],
    ["knockbackMul","Knockback"],["scanMul","Scan range"],["chainMul","Chain jumps"],
    ["armMul","Arm time"],["durabilityMul","Durability"]
  ];
  const changes=fields.flatMap(([key,label])=>{
    const value=module[key];
    if(typeof value!=="number")return [];
    return [{label,value:`${value>=1?"+":""}${Math.round((value-1)*100)}%`}];
  });
  if(module.targets!==undefined)changes.push({
    label:weaponId==="wonder_ripper"?"Max ricochets":"Target count",value:String(module.targets)
  });
  return changes;
}
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
  pullMul:module?.pullMul??1,knockbackMul:module?.knockbackMul??1,
  scanMul:module?.scanMul??1,chainMul:module?.chainMul??1,armMul:module?.armMul??1,durabilityMul:module?.durabilityMul??1,
 };
}
/** All prices and special-effect IDs live in the shared catalog, not client input. */
export const WONDER_FINISHES=[
 {id:"wonder_nebula",name:"Nebula Reactor",description:"Animated nebula glows across the Wonder casing.",cost:1,color:"#986af5"},
 {id:"wonder_molten",name:"Molten Core",description:"A heat-shimmering animated molten-metal finish.",cost:1,color:"#ff9234"},
 {id:"wonder_prismatic",name:"Prismatic Flux",description:"Shifting rainbow energy panels and luminous edges.",cost:2,color:"#74e7fa"},
 {id:"wonder_abyssal_core",wonderWeaponId:"wonder_singularity",name:"Abyssal Core",description:"A miniature gravitational vortex spirals across the casing.",cost:1,color:"#7750d6"},
 {id:"wonder_living_plague",wonderWeaponId:"wonder_corrosion",name:"Living Plague",description:"Pulsing organic veins and a translucent acid reservoir.",cost:1,color:"#81d347"},
 {id:"wonder_war_machine",wonderWeaponId:"wonder_turret",name:"War Machine",description:"Mechanical hazard stripes and animated targeting indicators.",cost:1,color:"#e8ab4a"},
 {id:"wonder_ghost_signal",wonderWeaponId:"wonder_deadlock",name:"Ghost Signal",description:"Flickering targeting grids and holographic code.",cost:1,color:"#ba70ef"},
 {id:"wonder_infernal_engine",wonderWeaponId:"wonder_hellfire",name:"Infernal Engine",description:"Molten metal with glowing magma seams.",cost:1,color:"#ff7024"},
 {id:"wonder_stormglass",wonderWeaponId:"wonder_stormweaver",name:"Stormglass",description:"Transparent coils enclosing living electric arcs.",cost:1,color:"#54ccff"},
 {id:"wonder_stormfront",wonderWeaponId:"wonder_cluster",name:"Stormfront",description:"Amber warning beacons and moving thundercloud tracers.",cost:1,color:"#e7aa42"},
 {id:"wonder_iron_bastion",wonderWeaponId:"wonder_riot_shield",name:"Iron Bastion",description:"Illuminated armor edges and impact-reactive shielding.",cost:1,color:"#8eacc3"},
 {id:"wonder_ion_accelerator",wonderWeaponId:"wonder_phasebreaker",name:"Ion Accelerator",description:"Flickering coils and pulsing high-voltage rails.",cost:1,color:"#62e2eb"},
 {id:"wonder_time_fracture",wonderWeaponId:"wonder_chrono",name:"Time Fracture",description:"Shifting time rings and distorted temporal reflections.",cost:1,color:"#c38adf"},
 {id:"wonder_faultline",wonderWeaponId:"wonder_seismic",name:"Faultline",description:"Energy cracks ripple across the shockwave housing.",cost:1,color:"#dca76a"},
 {id:"wonder_spectral_circuit",wonderWeaponId:"wonder_phantom",name:"Spectral Circuit",description:"Phase-shifting translucent circuitry and signal interference.",cost:1,color:"#7da8e9"},
 {id:"wonder_absolute_zero",wonderWeaponId:"wonder_whiteout",name:"Absolute Zero",description:"Slowly growing frost crystals cover the casing.",cost:1,color:"#a5edff"},
 {id:"wonder_razorstorm",wonderWeaponId:"wonder_ripper",name:"Razorstorm",description:"Moving sawtooth patterns and blazing edge lines.",cost:1,color:"#fc6d73"},
 {id:"wonder_titan_protocol",wonderWeaponId:"wonder_juggernaut",name:"Titan Protocol",description:"Luminous armor seams and moving hydraulic warnings.",cost:1,color:"#f3b86d"},
 {id:"wonder_signal_ghost",wonderWeaponId:"wonder_harbinger",name:"Signal Ghost",description:"Radar sweeps and pale holographic drone circuits.",cost:1,color:"#4de1c4"},
] as const;
export const WONDER_KILL_EFFECTS=[
 {id:"wonder_kill_nova",name:"Supernova",description:"Defeated opponents dissolve in a brief violet energy burst.",cost:1,color:"#bd83fb"},
 {id:"wonder_kill_shatter",name:"Crystal Shatter",description:"A quick scatter of icy shards on a Wonder elimination.",cost:1,color:"#83eafa"},
 {id:"wonder_kill_disintegrate",name:"Disintegration",description:"A fleeting amber particle disintegration.",cost:2,color:"#ffa75b"},
 {id:"wonder_kill_event_collapse",wonderWeaponId:"wonder_singularity",name:"Event Collapse",description:"Enemy implodes into a violet singularity.",cost:1,color:"#9c69ff",pattern:"event_collapse"},
 {id:"wonder_kill_toxic_bloom",wonderWeaponId:"wonder_corrosion",name:"Toxic Bloom",description:"A fleeting bloom of corrosive spores.",cost:1,color:"#98d843",pattern:"toxic_bloom"},
 {id:"wonder_kill_brass_storm",wonderWeaponId:"wonder_turret",name:"Brass Storm",description:"Brass and steel fragments scatter at elimination.",cost:1,color:"#e5b66d",pattern:"brass_storm"},
 {id:"wonder_kill_system_failure",wonderWeaponId:"wonder_deadlock",name:"System Failure",description:"Target collapses into flickering digital particles.",cost:1,color:"#b780ff",pattern:"system_failure"},
 {id:"wonder_kill_ashes_to_ashes",wonderWeaponId:"wonder_hellfire",name:"Ashes to Ashes",description:"A swift eruption of glowing ember particles.",cost:1,color:"#ff873a",pattern:"ashes_to_ashes"},
 {id:"wonder_kill_thunderstruck",wonderWeaponId:"wonder_stormweaver",name:"Thunderstruck",description:"Lightning silhouette and tiny violet arcs.",cost:1,color:"#77ddff",pattern:"thunderstruck"},
 {id:"wonder_kill_chain_reaction",wonderWeaponId:"wonder_cluster",name:"Chain Reaction",description:"Short successive orange explosive bursts.",cost:1,color:"#ffae5b",pattern:"chain_reaction"},
 {id:"wonder_kill_last_stand",wonderWeaponId:"wonder_riot_shield",name:"Last Stand",description:"Angular shield-like fragments crack apart.",cost:1,color:"#a1bbd1",pattern:"last_stand"},
 {id:"wonder_kill_rail_fracture",wonderWeaponId:"wonder_phasebreaker",name:"Rail Fracture",description:"Electric streaks cut through the defeated target.",cost:1,color:"#6bf0ff",pattern:"rail_fracture"},
 {id:"wonder_kill_temporal_echo",wonderWeaponId:"wonder_chrono",name:"Temporal Echo",description:"Translucent afterimages scatter into the past.",cost:1,color:"#c8a0f2",pattern:"temporal_echo"},
 {id:"wonder_kill_earthshatter",wonderWeaponId:"wonder_seismic",name:"Earthshatter",description:"Crystalline stone fragments erupt outward.",cost:1,color:"#c9b38b",pattern:"earthshatter"},
 {id:"wonder_kill_false_reality",wonderWeaponId:"wonder_phantom",name:"False Reality",description:"Glitching hologram shards dissolve.",cost:1,color:"#93c6fa",pattern:"false_reality"},
 {id:"wonder_kill_deep_freeze",wonderWeaponId:"wonder_whiteout",name:"Deep Freeze",description:"A crystal ice silhouette shatters into small shards.",cost:1,color:"#acf3ff",pattern:"deep_freeze"},
 {id:"wonder_kill_razor_divide",wonderWeaponId:"wonder_ripper",name:"Razor Divide",description:"Rotating razor-shaped polygons briefly appear.",cost:1,color:"#ff748a",pattern:"razor_divide"},
 {id:"wonder_kill_heavy_metal",wonderWeaponId:"wonder_juggernaut",name:"Heavy Metal",description:"Mechanical fragments and sparks disperse.",cost:1,color:"#f2c383",pattern:"heavy_metal"},
 {id:"wonder_kill_digital_erasure",wonderWeaponId:"wonder_harbinger",name:"Digital Erasure",description:"Pixelated signal blocks dissolve into the air.",cost:1,color:"#70ebcf",pattern:"digital_erasure"},
] as const;
export const wonderFinishById=(id:string)=>WONDER_FINISHES.find(x=>x.id===id);
export const wonderKillEffectById=(id:string)=>WONDER_KILL_EFFECTS.find(x=>x.id===id);
export const wonderFinishesFor=(weaponId:string)=>WONDER_FINISHES.filter(f=>!("wonderWeaponId" in f)||f.wonderWeaponId===weaponId);
export const wonderKillEffectsFor=(weaponId:string)=>WONDER_KILL_EFFECTS.filter(f=>!("wonderWeaponId" in f)||f.wonderWeaponId===weaponId);
export const validWonderFinish=(weaponId:string,id:string)=>!id||wonderFinishesFor(weaponId).some(f=>f.id===id);
export const validWonderKillEffect=(weaponId:string,id:string)=>!id||wonderKillEffectsFor(weaponId).some(f=>f.id===id);
