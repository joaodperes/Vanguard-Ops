import { combatIdentity } from "./combat-identity";
/** Distinct, procedural FIRST-PERSON weapon receivers, furniture and silhouettes.
 * Uses visible profile geometry, not merely a tint or a small attachment.
 * All positions are camera-local (the muzzle points toward negative Z).
 * The engine owns mesh parenting/animation and disposes all geometry on swap.
 */
import * as THREE from "three";
import { BASTION_CYLINDER_CENTER, BASTION_CHAMBER_RADIUS, BASTION_CYLINDER_HALF_LENGTH, BASTION_CARTRIDGE_SEATED_Z, BASTION_TOPSTRAP } from "./bastion-revolver-rig";

type Magazine = "curved" | "straight" | "drum" | "box" | "belt" | "tube" | "revolver" | "grip" | "rocket" | "none";
type Stock = "fixed" | "wire" | "folding" | "bullpup" | "precision" | "heavy" | "none";
type Shape = "angular" | "tapered" | "slim" | "block" | "ribbed";
type Feature = "carry" | "bipod" | "pump" | "dual" | "vent" | "rail" | "brake" | "scope" | "muzzle" | "shells" | "guard" | "shield";
interface Profile {
  // Receiver width/height/length. Long guns use a visibly longer platform.
  receiver: [number, number, number];
  guardLength: number;
  barrelLength: number;
  bore: number;
  stock: Stock;
  magazine: Magazine;
  body: Shape;
  features: Feature[];
  signature: number;
}

/** All ranged weapons have their own silhouette recipe, even within a class. */
export const WEAPON_VISUALS: Record<string, Profile> = {
  // Experimental platforms deliberately have different physical silhouettes, not just new colours.
  // Different silhouette, powerplant and emitter for each mechanical family.
  wonder_singularity: { receiver:[.115,.12,.26],guardLength:.075,barrelLength:.15,bore:.027,stock:"none",magazine:"grip",body:"tapered",features:["muzzle"],signature:0x748094 },
  wonder_corrosion: { receiver:[.18,.16,.38],guardLength:.29,barrelLength:.24,bore:.052,stock:"folding",magazine:"tube",body:"ribbed",features:["vent","muzzle"],signature:0x587047 },
  wonder_deadlock: { receiver:[.135,.15,.32],guardLength:.15,barrelLength:.18,bore:.028,stock:"none",magazine:"grip",body:"tapered",features:["muzzle","vent"],signature:0xb154d4 },
  wonder_hellfire: { receiver:[.24,.24,.52],guardLength:.49,barrelLength:.45,bore:.15,stock:"heavy",magazine:"drum",body:"ribbed",features:["dual","vent","shield"],signature:0xff7424 },
  wonder_stormweaver: { receiver:[.14,.18,.33],guardLength:.16,barrelLength:.23,bore:.075,stock:"none",magazine:"revolver",body:"tapered",features:["vent","muzzle","rail"],signature:0x48d6ff },
  wonder_phasebreaker: { receiver:[.17,.16,.68],guardLength:.56,barrelLength:.66,bore:.035,stock:"precision",magazine:"box",body:"angular",features:["scope","vent","rail","brake"],signature:0x6de3fc },
  wonder_chrono: { receiver:[.11,.06,.23],guardLength:0,barrelLength:0,bore:0,stock:"none",magazine:"none",body:"block",features:[],signature:0x9d8bf3 },
  wonder_seismic: { receiver:[.13,.15,.37],guardLength:.15,barrelLength:.5,bore:.02,stock:"none",magazine:"none",body:"slim",features:[],signature:0xffaf5d },
  wonder_phantom: { receiver:[.12,.065,.23],guardLength:0,barrelLength:0,bore:0,stock:"none",magazine:"none",body:"block",features:[],signature:0x73b4c3 },
  wonder_whiteout: { receiver:[.13,.14,.50],guardLength:.35,barrelLength:.4,bore:.025,stock:"precision",magazine:"straight",body:"slim",features:["scope","vent","rail"],signature:0x97e8fa },
  wonder_ripper: { receiver:[.25,.14,.48],guardLength:.3,barrelLength:.18,bore:.02,stock:"folding",magazine:"none",body:"angular",features:["guard"],signature:0xff913e },
  wonder_juggernaut: { receiver:[.17,.07,.29],guardLength:0,barrelLength:0,bore:0,stock:"none",magazine:"none",body:"block",features:[],signature:0xeebc75 },
  wonder_bogfather: { receiver:[.23,.19,.48],guardLength:.4,barrelLength:.29,bore:.12,stock:"heavy",magazine:"drum",body:"block",features:["shield","dual","vent"],signature:0x86e042 },
  rifle_electron:   { receiver: [.180,.175,.48], guardLength:.32, barrelLength:.27, bore:.042, stock:"bullpup", magazine:"none", body:"ribbed", features:["vent","rail","muzzle"], signature:0x29d9fa },
  crossbow_reclaimer:{ receiver: [.125,.115,.34], guardLength:.42, barrelLength:.18, bore:.012, stock:"precision", magazine:"none", body:"slim", features:["rail","guard"], signature:0x84919a },
  pistol_arc:       { receiver: [.120,.135,.26], guardLength:.085, barrelLength:.11, bore:.027, stock:"none", magazine:"grip", body:"tapered", features:["muzzle","vent"], signature:0xac82ff },
  rifle_falcon:    { receiver: [.108,.125,.47], guardLength:.43, barrelLength:.41, bore:.025, stock:"precision", magazine:"straight", body:"slim", features:["rail","brake"], signature:0xd19b63 },
  rifle_hydra:     { receiver: [.17,.145,.32], guardLength:.27, barrelLength:.18, bore:.025, stock:"bullpup", magazine:"curved", body:"ribbed", features:["dual","vent"], signature:0x4d99b1 },
  dmr_cyclone:     { receiver: [.135,.15,.50], guardLength:.40, barrelLength:.38, bore:.030, stock:"fixed", magazine:"box", body:"angular", features:["brake","rail"], signature:0xb78bdd },
  dmr_whisper:     { receiver: [.092,.10,.55], guardLength:.48, barrelLength:.47, bore:.019, stock:"precision", magazine:"straight", body:"tapered", features:["scope","muzzle"], signature:0x9abe8e },
  rifle_ar:        { receiver: [.115,.128,.42], guardLength:.35, barrelLength:.24, bore:.023, stock:"fixed",     magazine:"curved",   body:"angular", features:["guard"], signature:0x5378aa },
  rifle_burst:     { receiver: [.145,.15,.38],  guardLength:.23, barrelLength:.17, bore:.026, stock:"bullpup",   magazine:"straight", body:"tapered", features:["guard","brake"],signature:0x12b7a4 },
  rifle_heavy:     { receiver: [.17,.175,.57],  guardLength:.42, barrelLength:.30, bore:.037, stock:"heavy",     magazine:"box",      body:"block",   features:["brake","vent","rail"],signature:0xb66a55 },
  smg_kp:          { receiver: [.102,.112,.29],guardLength:.19, barrelLength:.13, bore:.018, stock:"folding",   magazine:"curved",   body:"angular", features:["rail","muzzle"],signature:0x2ac0b4 },
  smg_vector:      { receiver: [.16,.17,.30],  guardLength:.13, barrelLength:.08, bore:.026, stock:"none",      magazine:"straight", body:"tapered", features:["guard","shield"],signature:0x9757dc },
  smg_compact:     { receiver: [.105,.105,.19],guardLength:.09,barrelLength:.065,bore:.027, stock:"wire",      magazine:"grip",     body:"block",   features:["muzzle"],signature:0x9ebd4a },
  shotgun_br:      { receiver: [.13,.14,.43],  guardLength:.36, barrelLength:.26, bore:.042, stock:"fixed",     magazine:"tube",     body:"angular", features:["pump","shells"],signature:0xd3a16e },
  shotgun_auto:    { receiver: [.17,.18,.47],  guardLength:.39, barrelLength:.27, bore:.033, stock:"heavy",     magazine:"drum",     body:"block",   features:["dual","vent"],signature:0xb35c57 },
  shotgun_combat:  { receiver: [.14,.16,.39],  guardLength:.32, barrelLength:.24, bore:.035, stock:"folding",   magazine:"box",      body:"ribbed",  features:["vent","rail"],signature:0x70a8ba },
  rifle_dm:        { receiver: [.123,.13,.57], guardLength:.42, barrelLength:.34, bore:.025, stock:"precision", magazine:"straight", body:"slim",   features:["scope","rail"],signature:0xb48a60 },
  dmr_scout:       { receiver: [.105,.115,.39],guardLength:.36, barrelLength:.36, bore:.021, stock:"wire",      magazine:"straight", body:"tapered",features:["rail"],signature:0x70a66c },
  dmr_heavy:       { receiver: [.17,.17,.65],  guardLength:.48, barrelLength:.42, bore:.035, stock:"heavy",     magazine:"box",      body:"block", features:["scope","bipod","brake"],signature:0x657dd2 },
  sniper_lr:       { receiver: [.115,.13,.60], guardLength:.46, barrelLength:.56, bore:.025, stock:"precision", magazine:"straight", body:"slim",features:["scope","bipod"],signature:0x678da1 },
  sniper_scout:    { receiver: [.095,.105,.40],guardLength:.25, barrelLength:.38, bore:.019, stock:"wire",      magazine:"straight", body:"tapered", features:["scope"],signature:0x78ac9f },
  sniper_heavy:    { receiver: [.205,.21,.75], guardLength:.48, barrelLength:.66, bore:.048, stock:"heavy",     magazine:"box",      body:"block",features:["scope","bipod","brake","vent"],signature:0xc0704a },
  lmg_hv:          { receiver: [.165,.18,.55], guardLength:.39, barrelLength:.32, bore:.037, stock:"heavy",     magazine:"belt",     body:"block",features:["carry","bipod","vent"],signature:0xa99f68 },
  lmg_light:       { receiver: [.12,.14,.40],  guardLength:.32, barrelLength:.27, bore:.026, stock:"wire",      magazine:"curved",   body:"slim",features:["rail","bipod"],signature:0x83bd74 },
  lmg_heavy:       { receiver: [.205,.22,.69], guardLength:.51, barrelLength:.42, bore:.045, stock:"heavy",     magazine:"belt",     body:"ribbed",features:["shield","carry","bipod","vent"],signature:0xd9a14b },
  pistol_side:     { receiver: [.09,.095,.19], guardLength:.045,barrelLength:.065,bore:.017, stock:"none",      magazine:"grip",     body:"slim", features:[],signature:0x879aaa },
  pistol_magnum:   { receiver: [.12,.14,.29],  guardLength:.08, barrelLength:.28, bore:.031, stock:"none",      magazine:"revolver", body:"angular",features:["muzzle"],signature:0xd7a55b },
  pistol_burst:    { receiver: [.105,.12,.28], guardLength:.11, barrelLength:.12, bore:.019, stock:"none",      magazine:"grip",     body:"ribbed",features:["brake"],signature:0x66b3d0 },
  pistol_machine:  { receiver: [.105,.115,.29],guardLength:.13, barrelLength:.13, bore:.022, stock:"wire",      magazine:"straight", body:"block",features:["guard","rail"],signature:0xc85c5c },
  launcher_rocket: { receiver: [.23,.24,.61],  guardLength:.26, barrelLength:.70, bore:.115, stock:"none",      magazine:"rocket",   body:"block",features:["shield","carry","muzzle"],signature:0x93aa67 },
  pistol_ghost:    { receiver: [.087,.088,.18],guardLength:.04, barrelLength:.07,bore:.016, stock:"none",magazine:"grip",body:"slim",features:[],signature:0x8fe7bf },
  pistol_bastion:  { receiver: [.125,.14,.25],guardLength:.065,barrelLength:.28,bore:.038,stock:"none",magazine:"revolver",body:"tapered",features:["muzzle"],signature:0xcaa07a },
  pdw_mamba:       { receiver: [.112,.115,.25],guardLength:.075,barrelLength:.09,bore:.018, stock:"none",magazine:"straight",body:"ribbed",features:["vent","muzzle"],signature:0xd5db4a },
  pdw_sentinel:    { receiver: [.13,.125,.29],guardLength:.12, barrelLength:.13,bore:.026, stock:"wire",magazine:"straight",body:"block",features:["rail","guard"],signature:0x6fe2b7 },
  launcher_breach: { receiver: [.25,.22,.48],guardLength:.20, barrelLength:.46,bore:.105, stock:"none",magazine:"rocket",body:"angular",features:["shield","muzzle"],signature:0xb48b53 },
  wonder_cluster: { receiver:[.20,.20,.35],guardLength:.22,barrelLength:.30,bore:.10,stock:"folding",magazine:"drum",body:"ribbed",features:["guard","muzzle"],signature:0xe5a538 },
  wonder_riot_shield: { receiver:[.09,.095,.19],guardLength:.045,barrelLength:.065,bore:.017,stock:"none",magazine:"grip",body:"slim",features:[],signature:0x879aaa },
  launcher_swarm:  { receiver: [.20,.18,.40],guardLength:.16, barrelLength:.34,bore:.076, stock:"none",magazine:"rocket",body:"ribbed",features:["rail","muzzle"],signature:0x58b9d3 },
};

/**
 * First-person-model-local hand contacts for third-person soldiers.
 * `buildFirstPersonWeapon` uses -Z as its muzzle direction. The FPS engine
 * rotates the same meshes 180 degrees about Y for bots, so it must rotate
 * and scale these exact contact points as well.
 */
export function weaponHoldPoints(id: string): {
  trigger: [number, number, number];
  support: [number, number, number];
} {
  const p = WEAPON_VISUALS[id] ?? WEAPON_VISUALS.rifle_ar;
  if (id === "wonder_juggernaut" || id === "wonder_chrono" || id === "wonder_phantom")
    return { trigger:[.08,-.16,.07], support:[-.08,-.065,-.13] };
  const centerZ = -0.12;

  if (p.magazine === "rocket") {
    return {
      trigger: [0.12, -0.19, centerZ + 0.09],
      support: [-0.14, -0.07, centerZ - 0.36],
    };
  }

  const pistol = id.startsWith("pistol_");
  const gripZ = centerZ + (pistol ? 0.08 : 0.20);
  if (pistol) {
    // Support hand wraps around the firing hand in a two-handed pistol grip.
    return {
      trigger: [0.075, -0.15, gripZ],
      support: [-0.075, -0.15, gripZ - 0.015],
    };
  }

  // Hold the REAR part of the handguard so even heavy sniper rifles and LMGs
  // are reachable by the soldier's arms. Keep it tied to the profile dimensions.
  const guardCenterZ = centerZ - p.receiver[2] / 2 - p.guardLength / 2 + 0.02;
  return {
    trigger: [0.105, -0.14, gripZ],
    support: [-0.105, -0.085, guardCenterZ + p.guardLength * 0.42],
  };
}

/**
 * Camera viewmodel-only support grip. Long receivers (snipers, battle rifles
 * and heavy LMGs) used to carry the left glove too far down the fore-end,
 * creating an unnaturally long visible arm once the shoulder was connected.
 *
 * Place the palm against the *forward portion of the receiver* instead.
 * The receiver is centered at z=-.12, so this stays on real geometry while
 * shortening the reach; the weapon still moves as one rigid assembly.
 * World-model bot contact points deliberately remain unchanged.
 */
export function firstPersonSupportGrip(id: string): [number, number, number] {
  const original = weaponHoldPoints(id).support;
  const profile = WEAPON_VISUALS[id];
  if (!profile || ( !id.startsWith("sniper_") && profile.receiver[2] < .55 )
      || profile.magazine === "rocket" || id.startsWith("pistol_")) return original;

  const [width,height,length]=profile.receiver;
  // The 15%-receiver contact put hands much too close to the trigger and
  // made the forearm appear missing on long DMRs, LMGs and snipers.
  // Support the forward third of the receiver next to the handguard.
  return [
    -Math.max(.105,width/2+.021),
    -Math.max(.085,height*.42),
    Math.max(original[2],-.12-length*.36),
  ];
}

/** Gameplay-independent first-person weapon presentation.
 *
 * Bot weapons already use 0.72, but the old first-person viewmodel used
 * 1.20 for EVERY weapon. That made even an ordinary carbine ~1.43 model
 * units long and an anti-material rifle ~2.49 (before camera perspective).
 * Preserve pistols/PDWs/SMGs, which are intentionally close-up and already
 * proportionate, while matching full-sized rifles to their world models.
 *
 * The transition for unusually short futuristic weapons is continuous;
 * there is no receiver-length threshold that suddenly changes the pose.
 * Never apply this to bot geometry, collision, ballistic range or damage.
 */
export const FIRST_PERSON_COMPACT_SCALE = 1.20;
export const WORLD_WEAPON_VISUAL_SCALE = .72;

export function proceduralWeaponOverallLength(id: string): number {
  const p = WEAPON_VISUALS[id];
  if (!p) return 0;
  const receiverLength = p.receiver[2];
  const c = -.12;
  // Mirrored from buildFirstPersonWeapon's receiver, handguard, stock and
  // muzzle positions. This is a nominal longitudinal span, not a hitbox.
  const muzzle = c - receiverLength/2 - p.guardLength - p.barrelLength + .04;
  const rearZ = c + receiverLength/2 + .05;
  let rear = c + receiverLength/2;
  switch(p.stock) {
    case "fixed": rear=rearZ+.07+.20/2; break;
    case "heavy": rear=Math.max(rearZ+.055+.23/2,rearZ+.16+.037/2); break;
    case "wire":
    case "folding": rear=rearZ+.17+.035/2; break;
    case "bullpup": rear=rearZ+.075+.12/2; break;
    case "precision": rear=rearZ+.18+.038/2; break;
    case "none": rear=Math.max(rear,c+.08+.083/2); break;
  }
  return rear-muzzle;
}

export function firstPersonPresentationScale(id: string, category: string): number {
  if (!["assault","dmr","sniper","lmg","shotgun","launcher"].includes(category))
    return FIRST_PERSON_COMPACT_SCALE;
  const p=WEAPON_VISUALS[id];
  if (!p || id==="wonder_turret" || id==="wonder_harbinger") return FIRST_PERSON_COMPACT_SCALE;
  if(p.magazine==="rocket"||category==="launcher")return WORLD_WEAPON_VISUAL_SCALE;
  const length=proceduralWeaponOverallLength(id);
  // The tiny experimental emitters in rifle/DMR/shotgun classes can be
  // comparable to compact PDWs, so keep their existing size. Standard
  // long guns converge on the 0.72 scale already used by other players.
  const t=Math.max(0,Math.min(1,(length-.62)/.33));
  return FIRST_PERSON_COMPACT_SCALE+
    (WORLD_WEAPON_VISUAL_SCALE-FIRST_PERSON_COMPACT_SCALE)*t;
}

/** Camera-local hipfire offset after the long-gun proportion pass.
 * Full-length firearms were shrunk from 1.20 to 0.72 world-model scale but
 * remained at the old distance from the camera. Pull them up to 6cm closer
 * to the player without scaling the mesh, changing gameplay, or shifting ADS.
 * Intermediate-length models interpolate; compact firearms stay untouched.
 */
export function firstPersonHipPull(presentationScale: number): number {
  const reduction = (FIRST_PERSON_COMPACT_SCALE - presentationScale) /
    (FIRST_PERSON_COMPACT_SCALE - WORLD_WEAPON_VISUAL_SCALE);
  return 0.06 * Math.max(0, Math.min(1, reduction));
}

/** The Bastion uses a rear U-notch with an actual open centre and a narrow
 * front blade; no opaque plate covers the aim line. Geometry stays fixed to the
 * weapon; scope/reticle switching is still handled by the FPS engine. */
export function buildBastionIronSights(material: THREE.Material) {
  const rear=new THREE.Group();
  rear.name="bastion_rear_u_notch";
  const component=(w:number,h:number,d:number,x:number,y:number)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,0);
    rear.add(mesh);
  };
  // The notch is open at and above y=0: only two slim side posts and a
  // low, recessed bridge. No "solid grey block" between them.
  component(.010,.035,.018,-.037,.002);
  component(.010,.035,.018, .037,.002);
  component(.083,.008,.020,0,-.024);
  const front=new THREE.Mesh(new THREE.BoxGeometry(.009,.055,.012),material);
  front.name="bastion_front_blade";
  return {rear,front};
}

/** Per-model shotgun loading port and shell pocket, in viewmodel units.
 * The same weapon pivot/rotation/translation is applied by the FPS renderer.
 * Gameplay insertion time and incremental ammunition rules do not change. */
export function firstPersonShellContacts(
  id:string, scale=1.2,
):{pocket:[number,number,number];port:[number,number,number]} {
  const p=WEAPON_VISUALS[id]??WEAPON_VISUALS.shotgun_br;
  const [w,h,l]=p.receiver;
  const port:[number,number,number]=[
    -Math.max(.105,w/2+.045)*scale,
    -Math.max(.18,h*.78+.08)*scale,
    (-.12+Math.min(.095,l*.18))*scale,
  ];
  return {port,pocket:[
    port[0]-.18*scale,port[1]-.25*scale,port[2]+.27*scale,
  ]};
}

export type WeaponPartAdder = (mesh: THREE.Object3D, x: number, y: number, z: number) => void;

/** Returns exact camera-local muzzle Z, used by existing flash/suppressor code. */
export function buildFirstPersonWeapon(
  id: string,
  bodyMat: THREE.Material,
  darkMat: THREE.Material,
  add: WeaponPartAdder,
  fullSkinMaterial?: THREE.Material,
  signatureMaterial?: THREE.Material,
): number {
  // Bullet Spitter is a deployable tool rather than a conventional LMG.
  // Show a compact placement controller in both first-person and world models;
  // the actual machine is a separate turret mesh anchored on the map.
  if (id === "wonder_juggernaut" || id === "wonder_chrono" || id === "wonder_phantom") {
    // Handheld deployment devices: no gun receiver, barrel, stock or magazine.
    const tablet=id==="wonder_juggernaut";
    const chrono=id==="wonder_chrono";
    const panel=new THREE.Mesh(new THREE.BoxGeometry(tablet?.32:.15,tablet?.22:.18,.055),bodyMat);
    panel.rotation.x=-.22;add(panel,0,-.035,-.13);
    const rubber=new THREE.Mesh(new THREE.BoxGeometry(tablet?.35:.18,tablet?.035:.025,.07),darkMat);
    rubber.rotation.x=-.22;add(rubber,0,-.16,-.115);
    const display=new THREE.Mesh(new THREE.BoxGeometry(tablet?.255:.105,tablet?.155:.12,.008),
      new THREE.MeshBasicMaterial({color:combatIdentity(id).color}));
    display.name="wonder_controller_display";display.rotation.x=-.22;
    add(display,0,-.017,-.17);
    if(tablet){
      for(let i=0;i<4;i++){
        const line=new THREE.Mesh(new THREE.BoxGeometry(.15-i*.016,.006,.01),new THREE.MeshBasicMaterial({color:i===0?0xbef6ff:0x7ebbb7}));
        line.rotation.x=-.22;add(line,-.035,-.052+i*.024,-.183);
      }
      const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.008,.011,.22,8),darkMat);
      antenna.rotation.z=.18;add(antenna,.14,.13,-.14);
    }else if(chrono){
      const dial=new THREE.Mesh(new THREE.TorusGeometry(.041,.011,8,24),
        new THREE.MeshBasicMaterial({color:0xddd0ff}));
      add(dial,0,-.025,-.195);
      const button=new THREE.Mesh(new THREE.SphereGeometry(.018,10,8),darkMat);
      add(button,0,-.027,-.20);
    }else{
      for(const x of [-.037,.037])add(new THREE.Mesh(new THREE.BoxGeometry(.021,.021,.012),
        new THREE.MeshBasicMaterial({color:0xa8efff})),x,-.028,-.197);
      const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,.15,8),darkMat);
      add(antenna,.065,.09,-.12);
    }
    return -.25;
  }
  if (id === "wonder_turret" || id === "wonder_harbinger") {
    const body = new THREE.Mesh(new THREE.BoxGeometry(.19,.11,.32), bodyMat);
    add(body,0,-.07,-.12);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(.10,.16,.11),darkMat);
    add(grip,0,-.19,-.03);
    // Unskinned utilitarian remote; only a plain status stripe is visible.
    const indicator = new THREE.Mesh(new THREE.BoxGeometry(.12,.015,.17),new THREE.MeshBasicMaterial({color:combatIdentity(id).color}));
    add(indicator,0,.0,-.13);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.21,8),darkMat);
    add(antenna,.08,.045,-.23);
    if(id==="wonder_harbinger"){
      const scanner=new THREE.Mesh(new THREE.TorusGeometry(.063,.011,8,22),new THREE.MeshBasicMaterial({color:0x4de1c4}));
      scanner.rotation.x=Math.PI/2;add(scanner,0,.03,-.19);
      const lens=new THREE.Mesh(new THREE.SphereGeometry(.038,10,8),new THREE.MeshBasicMaterial({color:0x9ffff1}));add(lens,0,.04,-.19);
    }
    return -.3;
  }
  const p = WEAPON_VISUALS[id] ?? WEAPON_VISUALS.rifle_ar;
  const [w,h,l] = p.receiver;
  const c = -0.12;
  // Full-coating finishes may cover furniture; plated finishes like Gold retain
  // colored signature inserts, dark rails, magazine trim and energy details.
  // Non-default skins recolor every signature insert (stock butt, magazine foot
  // and rail badges), avoiding the original weapon's gold/yellow accent bleeding through.
  const sig = fullSkinMaterial ?? signatureMaterial ?? new THREE.MeshBasicMaterial({ color: p.signature });
  const metal = fullSkinMaterial ?? new THREE.MeshBasicMaterial({ color: 0x29313b });
  const edge = fullSkinMaterial ?? new THREE.MeshBasicMaterial({ color: 0x69737e });
  const box = (x:number,y:number,z:number,ww:number,hh:number,ll:number,material:THREE.Material=bodyMat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(ww,hh,ll),material);
    add(m,x,y,z);
    return m;
  };
  const tube = (x:number,y:number,z:number,r:number,length:number,material:THREE.Material=darkMat,sides=12) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r,r,length,sides),material);
    m.rotation.x=Math.PI/2;
    add(m,x,y,z);
    return m;
  };
  // The receiver has a genuinely different cut-out/top-line according to the weapon.
  // It is an extruded polygon across X (width), not a uniform rectangle.
  const shoulders: Record<Shape,[number,number][]> = {
    angular: [[-0.5,-0.30],[-0.49,0.22],[-0.29,0.53],[0.28,0.53],[0.49,0.18],[0.5,-0.45],[-0.36,-0.5]],
    tapered: [[-0.5,-0.38],[-0.44,0.20],[-0.28,0.53],[0.31,0.29],[0.5,-0.18],[0.5,-0.46]],
    slim:    [[-0.5,-0.33],[-0.5,0.23],[-0.26,0.34],[0.43,0.34],[0.5,-0.35]],
    block:   [[-0.5,-0.5],[-0.5,0.43],[0.45,0.43],[0.5,0.1],[0.5,-0.5]],
    ribbed:  [[-0.5,-0.5],[-0.5,0.35],[-0.34,0.52],[-0.13,0.35],[0.10,0.52],[0.32,0.35],[0.5,0.30],[0.5,-0.5]],
  };
  const shape = new THREE.Shape();
  const silhouette = shoulders[p.body];
  shape.moveTo(silhouette[0][0]*l, silhouette[0][1]*h);
  for(const [sx,sy] of silhouette.slice(1)) shape.lineTo(sx*l,sy*h);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape,{depth:w, bevelEnabled:true, bevelThickness:.006, bevelSize:.006, bevelSegments:1,steps:1});
  geo.rotateY(Math.PI/2); // polygon's local x becomes -Z; extrusion depth becomes +X
  const receiver = new THREE.Mesh(geo,bodyMat);
  receiver.name = "weapon_receiver";
  // A conventional pistol's extruded receiver fills the cylinder aperture
  // and hides the rounded chamber profile. Bastion instead uses an OPEN,
  // curved frame with topstrap, breech, trigger guard and rounded butt.
  if(id!=="pistol_bastion")add(receiver,-w/2,-.013,c);
  else geo.dispose();
  if(id==="pistol_bastion"){
    const top=box(BASTION_TOPSTRAP.x,BASTION_TOPSTRAP.y,BASTION_TOPSTRAP.z,
      BASTION_TOPSTRAP.width,BASTION_TOPSTRAP.height,BASTION_TOPSTRAP.length,bodyMat);
    top.name="bastion_topstrap";
    // A revolver needs an actual REAR FRAME, not just a top rail and six
    // floating chambers. The previous tiny square recoil-shield ended before
    // the cylinder's rear face and was disconnected from the grip.
    // This circular, fully capped breech plate is directly BEHIND the cylinder
    // (rear of cylinder: z=-.099; front of shield: z=-.096), while remaining
    // fixed to the frame when the cylinder swings sideways for reloading.
    const recoilShield=new THREE.Mesh(
      new THREE.CylinderGeometry(.089,.084,.066,24),bodyMat);
    recoilShield.name="bastion_recoil_shield";
    recoilShield.rotation.x=Math.PI/2; // circular XY silhouette, barrel-parallel axis
    add(recoilShield,0,-.027,-.063);
    // Continuous rounded backstrap connects the upper frame, recoil shield,
    // hammer housing and wooden grip. Unlike the removed generic receiver,
    // this fills the rear void WITHOUT swallowing the exposed cylinder.
    const backstrap=new THREE.Mesh(new THREE.CapsuleGeometry(.054,.126,8,16),bodyMat);
    backstrap.name="bastion_solid_backstrap";
    backstrap.rotation.x=-.18;
    add(backstrap,0,-.128,-.006);
    const lowerBridge=box(0,-.126,-.091,.075,.030,.112,bodyMat);
    lowerBridge.name="bastion_lower_frame_bridge";
    // Cast side cheeks are thick, closed plates, not skinny wire outlines.
    // They overlap the round recoil shield and topstrap at their upper edge,
    // then join the grip tang below, closing the conspicuous rear holes.
    // Leave the trigger opening below and FORWARD of the grip.
    const cheekOutline:[number,number][]=[
      [-.096,.048],[-.023,.050],[.047,.031],[.079,-.042],
      [.077,-.126],[.048,-.199],[.014,-.226],[-.022,-.195],
      [-.028,-.137],[-.081,-.104],[-.096,-.031],
    ];
    for(const side of [-1,1]){
      const shape=new THREE.Shape();
      shape.moveTo(-cheekOutline[0][0],cheekOutline[0][1]);
      for(const [z,y] of cheekOutline.slice(1))shape.lineTo(-z,y);
      shape.closePath();
      const geo=new THREE.ExtrudeGeometry(shape,{
        depth:.022,bevelEnabled:true,bevelThickness:.004,
        bevelSize:.003,bevelSegments:2,steps:1,
      });
      geo.rotateY(Math.PI/2); // authored z/y outline -> weapon Z/Y, extrude along X
      const cheek=new THREE.Mesh(geo,bodyMat);
      cheek.name=side>0?"bastion_right_frame_cheek":"bastion_left_frame_cheek";
      add(cheek,side>0?.049:-.071,0,0);
      // Barrel-to-frame yoke rails curve around the cylinder and terminate IN
      // the recoil shield instead of ending as disconnected, floating arcs.
      const arc=new THREE.CatmullRomCurve3([
        new THREE.Vector3(side*.032,.050,-.324),
        new THREE.Vector3(side*.071,.018,-.291),
        new THREE.Vector3(side*.084,-.069,-.263),
        new THREE.Vector3(side*.081,-.122,-.204),
        new THREE.Vector3(side*.079,-.117,-.128),
        new THREE.Vector3(side*.065,-.057,-.068),
      ]);
      const rail=new THREE.Mesh(new THREE.TubeGeometry(arc,24,.012,8,false),edge);
      rail.name="bastion_curved_frame_rail";
      add(rail,0,0,0);
    }
    const grip=new THREE.Mesh(new THREE.CapsuleGeometry(.045,.13,6,14),darkMat);
    grip.name="bastion_rounded_grip";
    grip.rotation.x=-.22;
    add(grip,0,-.183,.025);
    // A separately curved trigger guard connects the frame to the grip.
    const triggerLoop=new THREE.CatmullRomCurve3([
      new THREE.Vector3(-.012,-.115,-.115),
      new THREE.Vector3(-.012,-.184,-.145),
      new THREE.Vector3(-.012,-.220,-.121),
      new THREE.Vector3(-.012,-.217,-.015),
      new THREE.Vector3(-.012,-.136,.023),
    ]);
    add(new THREE.Mesh(new THREE.TubeGeometry(triggerLoop,20,.007,7,false),metal),0,0,0);
    // Slim contrasting oval grip panels reinforce the hammer-fired silhouette.
    for(const side of [-1,1]){
      const inlay=new THREE.Mesh(new THREE.CapsuleGeometry(.019,.075,4,10),metal);
      inlay.rotation.x=-.22;
      add(inlay,side*.040,-.198,.031);
    }
  }
  // Grips, firing controls, rails and side-mounted panels are large enough to read in hip-fire.
  if(p.magazine!=="rocket"&&id!=="pistol_bastion") {
    const pistol = id.startsWith("pistol_") || id === "launcher_rocket";
    const gripZ = pistol ? c+.08 : c + .20;
    const grip = box(0,-.105,gripZ,.068,.16,.095,darkMat);
    grip.name = "weapon_grip";
    grip.rotation.x = -.27;
    // Compact receivers end ahead of the standard trigger/grip anchor.
    // Add a solid lower-frame tang so the grip never appears to float behind
    // SMGs, PDWs and compact experimental weapons. Keep hold/hand coordinates.
    const receiverRear = c + l / 2;
    const gripFront = gripZ - .095 / 2;
    if (gripFront > receiverRear - .02) {
      const start = receiverRear - .035;
      const end = gripFront + .045;
      const tang = box(0,-.085,(start + end) / 2,.065,.095,end-start,darkMat);
      tang.name = "weapon_grip_tang";
    }
    box(w/2+.009,.012,c,.018,h*.60,l*.55,darkMat); // left/right receiver plate
    box(-w/2-.009,.012,c,.018,h*.60,l*.55,darkMat);
    box(w/2+.020,.025,c-.025,.008,.025,l*.25,sig);
    // Trigger-guard silhouette under the grip/receiver.
    box(0,-.112,gripZ-.08,.013,.014,.16,edge);
  }
  const guardZ = c-l/2-p.guardLength/2+.02;
  const guardFront=guardZ-p.guardLength/2;
  if (p.magazine!=="rocket") {
    if(id==="pistol_bastion"){
      // The short round forcing cone meets the six-shot drum at the front;
      // rectangular pistol-style handguards would conceal the chamber rim.
      tube(0,-.004,guardZ,.048,p.guardLength+.035,bodyMat,18);
    }else{
      const handguard = box(0,-.006,guardZ,w*.88,h*.88,p.guardLength,bodyMat);
      handguard.name = "weapon_handguard";
      const vents = id.includes("heavy") || p.features.includes("vent") ? 5 : 3;
      for(let i=0;i<vents;i++) {
        const vz=guardZ-p.guardLength*.37+(i/(vents-1))*p.guardLength*.74;
        box(w*.45,.044,vz,.013,.034,.022,darkMat);
        box(-w*.45,.044,vz,.013,.034,.022,darkMat);
      }
    }
  }
  const muzzle = c-l/2-p.guardLength-p.barrelLength+.04;
  // Seat the barrel 2 cm inside its handguard. Previously the barrel and
  // handguard only met at a coplanar face, which could expose a hairline seam.
  const barrelCenter=(guardFront+muzzle)/2+.01;
  const barrelLength=Math.max(.08,guardFront-muzzle)+.02;
  if (p.magazine==="rocket") {
    // One continuous launch tube must run THROUGH both muzzle collars.
    // The old .95-length core stopped 7.5 mm short of the first collar,
    // with another 4 cm gap before the outer ring.
    const core=tube(0,.0,c-.37,p.bore,1.11,bodyMat,18);
    core.name = "weapon_launcher_tube";
    tube(0,.0,c+.14,.134,.11,darkMat,18); // rear exhaust
    const collar=tube(0,.0,c-.80,.128,.055,sig,18);
    collar.name = "weapon_launcher_front_ring";
    box(0,.16,c-.22,.11,.03,.38,darkMat);
    box(0,-.20,c+.09,.09,.17,.12,darkMat);
    // Oversized fluted launch tube, shoulder cheek rest and side safety housing.
    for (let i=0;i<4;i++) box(.16,.035,c-.57+i*.12,.035,.075,.052,darkMat);
    box(-.135,.03,c-.26,.045,.14,.28,sig);
    box(.135,-.075,c-.08,.052,.125,.23,darkMat);
    tube(0,.0,c-.66,.125,.05,edge,18);
    const muzzleCollar=tube(0,.0,c-.89,.115,.045,metal,18);
    muzzleCollar.name = "weapon_launcher_muzzle_ring";
    return c-.91;
  }
  const mainBarrel=tube(0,.0,barrelCenter,p.bore,barrelLength,metal,14);
  mainBarrel.name = "weapon_barrel";
  tube(0,.0,muzzle+.02,p.bore*1.22,.06,edge,14);
  if(id==="pistol_bastion"){
    // Thick, circular heavy-revolver barrel shroud (not a square slide).
    const shroud=tube(0,-.003,barrelCenter,.052,barrelLength*.92,bodyMat,20);
    shroud.name="bastion_round_barrel_shroud";
    const rim=new THREE.Mesh(new THREE.TorusGeometry(.052,.007,7,20),edge);
    rim.name="bastion_barrel_collar";
    add(rim,0,-.003,muzzle+.070);
    // Low front sight foot actually TOUCHES the round barrel shroud.
    box(0,.046,muzzle+.08,.021,.020,.034,metal);
  }
  // Three experimental weapon platforms. All meshes use the normal `add`
  // callback so the FPS engine can animate them and dispose them on swap.
  if (id === "rifle_electron") {
    const cyan = fullSkinMaterial ?? new THREE.MeshBasicMaterial({ color: 0x65eaff });
    for (const side of [-1, 1]) {
      box(side * (w/2 + .025), .030, guardZ, .024, .069, p.guardLength * .84, cyan);
      for (let k = 0; k < 4; k++)
        box(side * (w/2 + .045), .060, guardZ - .12 + k * .072, .022, .029, .030, darkMat);
    }
    // Visible exposed reactor / energy coil, in place of a regular magazine.
    tube(0, -.145, c + .07, .070, .19, cyan, 14);
    for (const z of [c - .03, c + .025, c + .08]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.085, .015, 6, 18), darkMat);
      add(ring, 0, -.145, z);
    }
  } else if (id === "crossbow_reclaimer") {
    // Wide compound-crossbow limbs and actual string, rather than a rifle barrel
    // with a new tint. All coordinates are local to the camera (-Z forward).
    const green = fullSkinMaterial ?? new THREE.MeshBasicMaterial({ color: 0x7f8994 }); // bare metal fletching, no neon-green base
    const addRod = (a: [number,number,number], b: [number,number,number], radius: number, material: THREE.Material) => {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
      const d = vb.clone().sub(va);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, d.length(), 7), material);
      rod.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), d.clone().normalize());
      const mid = va.add(vb).multiplyScalar(.5);
      add(rod, mid.x, mid.y, mid.z);
    };
    const limbZ = guardFront - .015;
    for (const side of [-1,1]) {
      addRod([side*.055, .025, limbZ+.10], [side*.35, .045, limbZ-.065], .022, darkMat);
      addRod([side*.35, .045, limbZ-.065], [side*.51, .025, limbZ-.11], .016, green);
      // String converges to a small trigger cradle at the center of the weapon.
      addRod([side*.51,.025,limbZ-.11], [0,.022,c+.10], .0035, edge);
    }
    // Loaded bolt, rail groove, and visible fletching.
    addRod([0,.060,c+.11], [0,.060,muzzle-.10], .008, metal);
    const head = new THREE.Mesh(new THREE.ConeGeometry(.020,.085,6), green);
    head.rotation.x = -Math.PI/2;
    add(head, 0,.060,muzzle-.12);
    for (const s of [-1,1]) box(s*.024,.061,c+.065,.045,.012,.06,green);
  } else if (id === "pistol_bastion") {
    // Offset exposed hammer and narrow ejector rod, clear of the rear notch.
    const hammer=new THREE.Mesh(new THREE.CapsuleGeometry(.014,.015,4,8),darkMat);
    hammer.rotation.x=-.38;
    add(hammer,.046,.067,c+l*.47);
    tube(0,-.057,muzzle+.08,.009,.22,edge,8);
  } else if (id === "pistol_arc") {
    const violet = fullSkinMaterial ?? new THREE.MeshBasicMaterial({ color: 0xc2a3ff });
    // Concentric emitter coils around an unmistakably wide front capacitor.
    // A continuous emitter shroud ties the three visible coils to the
    // barrel: they are mechanical rings, not free-floating energy effects.
    const coilSleeve=tube(0,.017,muzzle+.08,.056,.21,darkMat,16);
    coilSleeve.name = "weapon_arc_coil_sleeve";
    for (const z of [muzzle+.015, muzzle+.080, muzzle+.145]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.063,.012,7,20), violet);
      ring.name = "weapon_arc_coil";
      add(ring, 0, .017, z);
    }
    box(-w*.62,.010,c,.025,.050,.145,violet);
    box(w*.62,.010,c,.025,.050,.145,violet);
    const cell = new THREE.Mesh(new THREE.SphereGeometry(.046,10,8), violet);
    add(cell, 0,-.125,c+.055);
  }
  // Wonder-only reactor architecture. Each emitter silhouette is physically
  // distinct and uses its own emissive colour on top of the animated body skin.
  if(id.startsWith("wonder_")){
    const energy=fullSkinMaterial??new THREE.MeshBasicMaterial({color:combatIdentity(id).color});
    const orb=(x:number,y:number,z:number,r:number)=>{
      add(new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),energy),x,y,z);
    };
    if(id==="wonder_singularity"){
      // Gravity generator: concentric offset field coils and a recessed core.
      // Eventide still covers the whole receiver when it is actually equipped.
      for(const z of [muzzle+.035,muzzle+.095,muzzle+.155]){
        const ring=new THREE.Mesh(new THREE.TorusGeometry(.06,.013,8,22),energy);
        add(ring,0,.015,z);
      }
      for(const side of [-1,1]){
        box(side*(w*.70),.012,c-.015,.025,.065,.15,energy);
        box(side*(w*.53),.085,c-.07,.03,.022,.19,metal);
      }
      orb(0,.015,muzzle-.03,.046);
    }else if(id==="wonder_deadlock"){
      // Smart-targeting sidearm: paired asymmetric fins, three target-acquisition
      // modules and a glowing vented barrel. Not a stock pistol silhouette.
      for(const side of [-1,1]){
        box(side*(w*.73),.055,c-.075,.032,.10,.24,energy);
        box(side*(w*.85),.10,c-.16,.022,.045,.075,metal);
      }
      for(let n=0;n<3;n++)orb((n-1)*.053,.105,c-.065,.022);
      const emitter=new THREE.Mesh(new THREE.TorusGeometry(.051,.016,7,18),energy);
      add(emitter,0,.015,muzzle+.025);
      box(0,-.13,c+.04,.087,.06,.14,energy);
    }else if(id==="wonder_turret"){
      // Bullet Spitter is built as a separate, grounded turret prop.
    }else if(id==="wonder_corrosion"){
      const olive=fullSkinMaterial??new THREE.MeshBasicMaterial({color:0x4c6840});
      for(const side of [-1,1]){
        tube(side*.095,-.025,c-.11,.036,.26,olive,10);
      }
    }else if(id==="wonder_hellfire"){
      const yellow=fullSkinMaterial??new THREE.MeshBasicMaterial({color:0xffc12b});
      const red=fullSkinMaterial??new THREE.MeshBasicMaterial({color:0xc31e0c});
      for(const side of [-1,1]){
        tube(side*.11,.03,barrelCenter,.065,barrelLength*.78,red,14);
        orb(side*.11,.03,muzzle,.075);
        for(let k=0;k<4;k++)box(side*.12,.13,c-.25+k*.10,.045,.032,.06,yellow);
      }
      box(0,.14,c-.15,.19,.055,.31,energy);
      box(0,-.09,c+.12,.18,.06,.11,red);
    }else if(id==="wonder_stormweaver"){
      for(let n=0;n<5;n++){
        const ring=new THREE.Mesh(new THREE.TorusGeometry(.076,.015,6,20),energy);
        add(ring,0,.055,c-.08-n*.085);
      }
      for(const side of [-1,1])box(side*.175,.07,guardZ,.025,.14,.49,energy);
      orb(0,.09,muzzle,.10);
    }else if(id==="wonder_bogfather"){
      for(const side of [-1,1])orb(side*.11,.08,c-.1,.09);
    }else if(id==="wonder_phasebreaker"){
      // Twin floating-inset conduction rails make the sniper unlike a conventional rifle.
      for(const side of [-1,1]){
        box(side*.11,.055,guardZ,.025,.035,p.guardLength*.95,energy);
        for(let i=0;i<5;i++)box(side*.12,.09,guardZ+(i-2)*.08,.038,.035,.024,metal);
      }
      orb(0,.045,muzzle+.03,.055);
    }else if(id==="wonder_whiteout"){
      for(let i=0;i<3;i++){
        const ring=new THREE.Mesh(new THREE.TorusGeometry(.057,.012,7,20),energy);
        add(ring,0,.015,muzzle+.05+i*.082);
      }
      box(0,.095,guardZ,.085,.034,.25,energy);
    }else if(id==="wonder_ripper"){
      // Visible exposed saw in the launcher itself. It also fires a full 3D disc.
      box(0,.10,c-.22,.32,.045,.34,metal);
      const blade=new THREE.Group();blade.name="wonder_ripper_carried_saw";
      const disc=new THREE.Mesh(new THREE.CylinderGeometry(.17,.17,.035,16),energy);
      // Horizontal disc plane (XZ), parallel to the launcher's forward body.
      blade.add(disc);
      for(let i=0;i<12;i++){
        const a=i*Math.PI/6;
        const tooth=new THREE.Mesh(new THREE.BoxGeometry(.065,.035,.045),metal);
        tooth.position.set(Math.cos(a)*.18,0,Math.sin(a)*.18);
        tooth.rotation.y=-a;blade.add(tooth);
      }
      add(blade,0,.125,c-.31);
    }
  }
  if (p.features.includes("dual")) {
    tube(-.050,-.035,barrelCenter,p.bore*.80,barrelLength,metal,12);
    tube(.050,-.035,barrelCenter,p.bore*.80,barrelLength,metal,12);
  }
  if (p.features.includes("brake")) {
    tube(0,0,muzzle+.005,p.bore*2,.12,metal,12);
    for(let i=0;i<3;i++) box(w*.04,.030,muzzle-.04+i*.028,.095,.009,.01,edge);
  }
  if (p.features.includes("muzzle")) tube(0,0,muzzle+.015,p.bore*1.45,.075,sig,14);
  if (p.features.includes("shield")) box(0,.075,guardZ,.19,.085,p.guardLength*.72,bodyMat);
  if (p.features.includes("rail") || p.features.includes("scope")) {
    // The previous h*.64 rail sat ABOVE short/slim receivers with no mount.
    // Seat it against the actual roof of this weapon's polygonal receiver.
    const roofY = -.013 + Math.max(...silhouette.map(([,y]) => y)) * h;
    const railY = roofY + .007;
    const rail = box(0,railY,c-.12,.045,.025,Math.min(.48,l+.12),darkMat);
    rail.name = "weapon_top_rail";
    for (let i=0;i<5;i++) box(0,railY+.016,c-.31+i*.07,.065,.014,.026,edge);
  }
  if (p.features.includes("carry")) {
    // Taller posts overlap both the receiver roof and the crossbar, including
    // on heavy LMGs where the old posts stopped short of the bridge.
    for (const side of [-1,1]) {
      const post=box(side*w*.39,h*.77,c+.04,.027,.16,.045,darkMat);
      post.name="weapon_carry_post";
    }
    const bridge=box(0,h*1.16,c+.04,w*.9,.03,.16,darkMat);
    bridge.name="weapon_carry_bridge";
  }
  if (p.features.includes("guard")) {
    // This lower guard used to stop below the handguard (and behind it on
    // short PDWs). Move it into the handguard volume to make a solid mount.
    const lowerGuard=box(0,-.115,guardZ+Math.min(.07,p.guardLength*.20),.075,.19,.055,darkMat);
    lowerGuard.name="weapon_under_guard";
  }
  if (p.features.includes("pump")) {
    const pump=box(0,-.069,guardZ,.13,.085,.24,sig);  // moving pump grip
    pump.name="weapon_pump_foregrip";
    tube(0,-.062,guardZ,.026,p.guardLength*.90,metal);
  }
  if (p.features.includes("shells")) {
    // Side-saddle bracket reaches the receiver AND every spare shell.
    // Without the bracket the shotgun's shell row floated off its flank.
    const saddle=box(w*.59,-.05,c-.04,.055,.095,.34,darkMat);
    saddle.name="weapon_shell_holder";
    for(let i=0;i<5;i++){
      const shell=tube(w*.72,-.05,c-.16+i*.06,.016,.07,sig,9);
      shell.name="weapon_shell";
    }
  }
  if (p.features.includes("bipod")) {
    const legZ=guardFront+.07;
    // A cross-mount joins the legs to narrow DMR/sniper/LMG handguards.
    const mount=box(0,-.04,legZ,.21,.095,.045,darkMat);
    mount.name="weapon_bipod_mount";
    for (const sign of [-1,1]) {
      const leg=box(sign*.075,-.14,legZ,.027,.28,.026,metal);
      leg.name="weapon_bipod_leg";
      leg.rotation.z=sign*.25;
    }
  }
  // Distinctive magazine profiles (size and position are visible in the FPS silhouette).
  const magZ=c+.025;
  // The first-person animator can hide the fitted magazine only while the
  // support hand visibly removes/replaces it. No reliance on mesh ordering.
  const magBox = (x:number,y:number,z:number,ww:number,hh:number,ll:number,mat:THREE.Material) => {
    const piece = box(x,y,z,ww,hh,ll,mat);
    piece.userData.fpMagazine = true;
    return piece;
  };
  switch (p.magazine) {
    case "curved": {
      const top=magBox(0,-.12,magZ,.082,.16,.11,darkMat);
      top.rotation.x=-.20;
      const foot=magBox(0,-.23,magZ-.05,.087,.12,.11,darkMat);
      foot.rotation.x=-.44;
      magBox(0,-.29,magZ-.065,.091,.02,.13,sig);
      break;
    }
    case "straight": magBox(0,-.15,magZ,.069,.22,.085,darkMat); magBox(0,-.25,magZ,.080,.02,.091,sig);break;
    case "drum": {
      const drum=new THREE.Mesh(new THREE.CylinderGeometry(.15,.15,.10,18),darkMat);
      drum.rotation.z=Math.PI/2;drum.userData.fpMagazine = true; add(drum,0,-.16,magZ);
      const cap=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.103,18),sig);
      cap.rotation.z=Math.PI/2;cap.userData.fpMagazine = true; add(cap,0,-.16,magZ);
      break;
    }
    case "box":magBox(0,-.20,magZ,.12,.25,.14,darkMat);magBox(w*.36,-.18,magZ,.018,.18,.09,sig);break;
    case "belt": {
      magBox(w*.65,-.15,magZ,.18,.25,.21,darkMat);
      magBox(w*.65+.098,-.16,magZ,.012,.17,.15,sig);
      for(let k=0;k<5;k++)tube(w*.27,-.035,magZ-.08+k*.039,.012,.055,edge,6);
      break;
    }
    case "tube":tube(0,-.068,guardZ,.032,p.guardLength*.9,darkMat);break;
    case "revolver": {
      // The chamber and cartridge axes MUST follow local Z, like the barrel.
      // Rotating a Y-axis cylinder about Z (the old implementation) pointed it
      // across the weapon and made the swing-out animation look diagonal.
      const cylinder=new THREE.Group();
      cylinder.userData.fpRevolverCylinder=id==="pistol_bastion";
      // Front web and axle hold six OPEN chamber sleeves together. A single
      // capped solid drum hid cartridges while they were being inserted.
      const drum=new THREE.Mesh(new THREE.CylinderGeometry(.023,.023,BASTION_CYLINDER_HALF_LENGTH*2,12),sig);
      drum.name="revolver_cylinder_body";
      drum.rotation.x=Math.PI/2;
      cylinder.add(drum);
      const frontWeb=new THREE.Mesh(new THREE.CylinderGeometry(id==="pistol_bastion"?.081:.066,id==="pistol_bastion"?.081:.066,.013,16),sig);
      frontWeb.name="revolver_cylinder_front_web";
      frontWeb.rotation.x=Math.PI/2;
      frontWeb.position.z=-BASTION_CYLINDER_HALF_LENGTH+.009;
      cylinder.add(frontWeb);
      const brass=new THREE.MeshBasicMaterial({color:0xcaa05a});
      const primer=new THREE.MeshBasicMaterial({color:0xecc98b});
      for(let i=0;i<6;i++){
        const angle=2*Math.PI*i/6;
        const x=BASTION_CHAMBER_RADIUS*Math.cos(angle);
        const y=BASTION_CHAMBER_RADIUS*Math.sin(angle);
        // Open-ended six tubes provide real empty chamber mouths. Bullets can
        // visibly travel down their Z-aligned bores instead of disappearing
        // behind an opaque capped cylinder surface.
        const sleeve=new THREE.Mesh(
          new THREE.CylinderGeometry(id==="pistol_bastion"?.023:.020,id==="pistol_bastion"?.023:.020,BASTION_CYLINDER_HALF_LENGTH*2,12,1,true),sig);
        sleeve.name="revolver_chamber_sleeve_"+i;
        sleeve.rotation.x=Math.PI/2;
        sleeve.position.set(x,y,0);
        cylinder.add(sleeve);
        const mouth=new THREE.Mesh(new THREE.RingGeometry(.010,.020,12),darkMat);
        mouth.position.set(x,y,BASTION_CYLINDER_HALF_LENGTH+.001);
        cylinder.add(mouth);
        if(id==="pistol_bastion"){
          const cartridge=new THREE.Group();
          cartridge.name="revolver_cartridge_"+i;
          cartridge.userData.fpRevolverCartridgeIndex=i;
          cartridge.position.set(x,y,BASTION_CARTRIDGE_SEATED_Z);
          const casing=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,.078,10),brass);
          casing.rotation.x=Math.PI/2;
          cartridge.add(casing);
          const cap=new THREE.Mesh(new THREE.CylinderGeometry(.011,.011,.009,10),primer);
          cap.rotation.x=Math.PI/2;
          cap.position.z=.044;
          cartridge.add(cap);
          cylinder.add(cartridge);
        }
      }
      if(id==="pistol_bastion"){
        // Crane/yoke telescopes into view during the lateral swing. It links
        // the released cylinder to the revolver frame instead of floating.
        const yoke=new THREE.Mesh(new THREE.BoxGeometry(.17,.015,.028),metal);
        yoke.name="bastion_cylinder_yoke";
        yoke.userData.fpRevolverYoke=true;
        yoke.position.set(.085,-.045,0);
        yoke.visible=false;
        cylinder.add(yoke);
      }else{
        brass.dispose();primer.dispose();
      }
      add(cylinder,...BASTION_CYLINDER_CENTER);
      break;
    }
    case "grip":box(0,-.18,c+.08,.067,.18,.083,darkMat);break;
  }
  // Rear furniture — unmistakable skeletons, heavy stocks, bullpup cheek pads, etc.
  const rearZ=c+l/2+.05;
  switch (p.stock) {
    case "fixed":{
      // Preserve the butt position while extending the stock into the receiver.
      const stem=box(0,-.025,rearZ+.05,.115,.135,.24,darkMat);
      stem.name="weapon_stock_stem";
      box(0,.05,rearZ+.07,.085,.02,.17,sig);
      break;
    }
    case "heavy":{
      const stem=box(0,-.035,rearZ+.055,w*.96,.18,.23,darkMat);
      stem.name="weapon_stock_stem";
      box(0,-.07,rearZ+.16,w*1.05,.20,.037,sig);
      break;
    }
    case "wire":
    case "folding": {
      for(const sign of [-1,1]) {
        // Lengthen forward without moving the butt, closing the old 5 mm gap.
        const stem=box(sign*.054,-.035,rearZ+.04,.025,.027,.27,metal);
        stem.name="weapon_stock_stem";
      }
      box(0,-.065,rearZ+.17,.13,.11,.035,sig);
      break;
    }
    case "bullpup":{
      const stem=box(0,.052,rearZ-.035,w*1.05,.12,.19,bodyMat);
      stem.name="weapon_stock_stem";
      const lower=box(0,-.065,rearZ+.075,w*1.08,.08,.12,darkMat);
      lower.name="weapon_stock_lower";
      const bridge=box(0,-.015,rearZ+.075,w*.75,.07,.055,bodyMat);
      bridge.name="weapon_stock_bridge";
      break;
    }
    case "precision": {
      for(const sign of [-1,1]){
        const stem=box(sign*.048,-.013,rearZ+.045,.022,.036,.29,metal);
        stem.name="weapon_stock_stem";
      }
      box(0,.005,rearZ+.075,.12,.025,.19,sig);
      box(0,-.13,rearZ+.18,.10,.21,.038,darkMat);
      break;
    }
  }
  return muzzle;
}
