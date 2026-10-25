/** Distinct, procedural FIRST-PERSON weapon receivers, furniture and silhouettes.
 * Uses visible profile geometry, not merely a tint or a small attachment.
 * All positions are camera-local (the muzzle points toward negative Z).
 * The engine owns mesh parenting/animation and disposes all geometry on swap.
 */
import * as THREE from "three";

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
  wonder_deadlock: { receiver:[.105,.13,.27],guardLength:.08,barrelLength:.18,bore:.02,stock:"none",magazine:"grip",body:"angular",features:["scope","muzzle","rail"],signature:0xff476f },
  wonder_hellfire: { receiver:[.24,.24,.52],guardLength:.49,barrelLength:.45,bore:.15,stock:"heavy",magazine:"drum",body:"ribbed",features:["dual","vent","shield"],signature:0xff7424 },
  wonder_stormweaver: { receiver:[.14,.18,.33],guardLength:.16,barrelLength:.23,bore:.075,stock:"none",magazine:"revolver",body:"tapered",features:["vent","muzzle","rail"],signature:0x48d6ff },
  wonder_bogfather: { receiver:[.23,.19,.48],guardLength:.4,barrelLength:.29,bore:.12,stock:"heavy",magazine:"drum",body:"block",features:["shield","dual","vent"],signature:0x86e042 },
  rifle_electron:   { receiver: [.180,.175,.48], guardLength:.32, barrelLength:.27, bore:.042, stock:"bullpup", magazine:"none", body:"ribbed", features:["vent","rail","muzzle"], signature:0x29d9fa },
  crossbow_reclaimer:{ receiver: [.125,.115,.34], guardLength:.42, barrelLength:.18, bore:.012, stock:"precision", magazine:"none", body:"slim", features:["rail","guard"], signature:0x8bd36a },
  pistol_arc:       { receiver: [.120,.135,.26], guardLength:.085, barrelLength:.11, bore:.027, stock:"none", magazine:"grip", body:"tapered", features:["muzzle","vent"], signature:0xac82ff },
  rifle_falcon:    { receiver: [.108,.125,.47], guardLength:.43, barrelLength:.41, bore:.025, stock:"precision", magazine:"straight", body:"slim", features:["rail","brake"], signature:0xd19b63 },
  rifle_hydra:     { receiver: [.17,.145,.32], guardLength:.27, barrelLength:.18, bore:.025, stock:"bullpup", magazine:"curved", body:"ribbed", features:["dual","vent"], signature:0x4d99b1 },
  dmr_cyclone:     { receiver: [.135,.15,.50], guardLength:.40, barrelLength:.38, bore:.030, stock:"fixed", magazine:"box", body:"angular", features:["brake","rail"], signature:0xb78bdd },
  dmr_whisper:     { receiver: [.092,.10,.55], guardLength:.48, barrelLength:.47, bore:.019, stock:"precision", magazine:"straight", body:"tapered", features:["scope","muzzle"], signature:0x9abe8e },
  rifle_ar:        { receiver: [.115,.128,.42], guardLength:.35, barrelLength:.24, bore:.023, stock:"fixed",     magazine:"curved",   body:"angular", features:["carry","rail"], signature:0x5378aa },
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
  pistol_ghost:    { receiver: [.087,.088,.18],guardLength:.04, barrelLength:.07,bore:.016, stock:"none",magazine:"grip",body:"slim",features:["rail"],signature:0x8fe7bf },
  pistol_bastion:  { receiver: [.115,.13,.30],guardLength:.07, barrelLength:.22,bore:.033, stock:"none",magazine:"grip",body:"angular",features:["brake","muzzle"],signature:0xcaa07a },
  pdw_mamba:       { receiver: [.112,.115,.25],guardLength:.075,barrelLength:.09,bore:.018, stock:"none",magazine:"straight",body:"ribbed",features:["vent","muzzle"],signature:0xd5db4a },
  pdw_sentinel:    { receiver: [.13,.125,.29],guardLength:.12, barrelLength:.13,bore:.026, stock:"wire",magazine:"straight",body:"block",features:["rail","guard"],signature:0x6fe2b7 },
  launcher_breach: { receiver: [.25,.22,.48],guardLength:.20, barrelLength:.46,bore:.105, stock:"none",magazine:"rocket",body:"angular",features:["shield","muzzle"],signature:0xb48b53 },
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

export type WeaponPartAdder = (mesh: THREE.Object3D, x: number, y: number, z: number) => void;

/** Returns exact camera-local muzzle Z, used by existing flash/suppressor code. */
export function buildFirstPersonWeapon(
  id: string,
  bodyMat: THREE.Material,
  darkMat: THREE.Material,
  add: WeaponPartAdder,
  fullSkinMaterial?: THREE.Material,
): number {
  // Bullet Spitter is a deployable tool rather than a conventional LMG.
  // Show a compact placement controller in both first-person and world models;
  // the actual machine is a separate turret mesh anchored on the map.
  if (id === "wonder_turret") {
    const body = new THREE.Mesh(new THREE.BoxGeometry(.19,.11,.32), bodyMat);
    add(body,0,-.07,-.12);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(.10,.16,.11),darkMat);
    add(grip,0,-.19,-.03);
    const indicator = new THREE.Mesh(new THREE.BoxGeometry(.12,.015,.17),fullSkinMaterial ?? new THREE.MeshBasicMaterial({color:0xffad33}));
    add(indicator,0,.0,-.13);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.21,8),darkMat);
    add(antenna,.08,.045,-.23);
    return -.3;
  }
  const p = WEAPON_VISUALS[id] ?? WEAPON_VISUALS.rifle_ar;
  const [w,h,l] = p.receiver;
  const c = -0.12;
  // Legendary finishes also cover the signature inserts, colored rails,
  // magazine trim and bespoke energy parts. Ordinary skins retain each gun's
  // recognizable colored furniture.
  const sig = fullSkinMaterial ?? new THREE.MeshBasicMaterial({ color: p.signature });
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
  add(receiver,-w/2,-.013,c);
  // Grips, firing controls, rails and side-mounted panels are large enough to read in hip-fire.
  if(p.magazine!=="rocket") {
    const pistol = id.startsWith("pistol_") || id === "launcher_rocket";
    const gripZ = pistol ? c+.08 : c + .20;
    const grip = box(0,-.105,gripZ,.068,.16,.095,darkMat);
    grip.rotation.x = -.27;
    box(w/2+.009,.012,c,.018,h*.60,l*.55,darkMat); // left/right receiver plate
    box(-w/2-.009,.012,c,.018,h*.60,l*.55,darkMat);
    box(w/2+.020,.025,c-.025,.008,.025,l*.25,sig);
    // Trigger-guard silhouette under the grip/receiver.
    box(0,-.112,gripZ-.08,.013,.014,.16,edge);
  }
  const guardZ = c-l/2-p.guardLength/2+.02;
  const guardFront=guardZ-p.guardLength/2;
  if (p.magazine!=="rocket") {
    box(0,-.006,guardZ,w*.88,h*.88,p.guardLength,bodyMat);
    // Offset vent ribs along the fore-end: visible on both sides.
    const vents = id.includes("heavy") || p.features.includes("vent") ? 5 : 3;
    for(let i=0;i<vents;i++) {
      const vz=guardZ-p.guardLength*.37+(i/(vents-1))*p.guardLength*.74;
      box(w*.45,.044,vz,.013,.034,.022,darkMat);
      box(-w*.45,.044,vz,.013,.034,.022,darkMat);
    }
  }
  const muzzle = c-l/2-p.guardLength-p.barrelLength+.04;
  const barrelCenter=(guardFront+muzzle)/2;
  const barrelLength=Math.max(.08,guardFront-muzzle);
  if (p.magazine==="rocket") {
    tube(0,.0,c-.29,p.bore,.95,bodyMat,18);
    tube(0,.0,c+.14,.134,.11,darkMat,18); // rear exhaust
    tube(0,.0,c-.80,.128,.055,sig,18);      // forward muzzle ring
    box(0,.16,c-.22,.11,.03,.38,darkMat);
    box(0,-.20,c+.09,.09,.17,.12,darkMat);
    // Oversized fluted launch tube, shoulder cheek rest and side safety housing.
    for (let i=0;i<4;i++) box(.16,.035,c-.57+i*.12,.035,.075,.052,darkMat);
    box(-.135,.03,c-.26,.045,.14,.28,sig);
    box(.135,-.075,c-.08,.052,.125,.23,darkMat);
    tube(0,.0,c-.66,.125,.05,edge,18);
    tube(0,.0,c-.89,.115,.045,metal,18);
    return c-.91;
  }
  tube(0,.0,barrelCenter,p.bore,barrelLength,metal,14);
  tube(0,.0,muzzle+.02,p.bore*1.22,.06,edge,14);
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
    const green = fullSkinMaterial ?? new THREE.MeshBasicMaterial({ color: 0xa8f26c });
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
  } else if (id === "pistol_arc") {
    const violet = fullSkinMaterial ?? new THREE.MeshBasicMaterial({ color: 0xc2a3ff });
    // Concentric emitter coils around an unmistakably wide front capacitor.
    for (const z of [muzzle+.015, muzzle+.080, muzzle+.145]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.063,.012,7,20), violet);
      add(ring, 0, .017, z);
    }
    box(-w*.62,.010,c,.025,.050,.145,violet);
    box(w*.62,.010,c,.025,.050,.145,violet);
    const cell = new THREE.Mesh(new THREE.SphereGeometry(.046,10,8), violet);
    add(cell, 0,-.125,c+.055);
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
    box(0,h*.64,c-.12,.045,.025,Math.min(.48,l+.12),darkMat);
    for (let i=0;i<5;i++) box(0,h*.78,c-.31+i*.07,.065,.014,.026,edge);
  }
  if (p.features.includes("carry")) {
    // Big raised carry arch: horizontal bridge with two support posts.
    box(-w*.39,h*.77,c+.04,.027,.12,.045,darkMat);
    box(w*.39,h*.77,c+.04,.027,.12,.045,darkMat);
    box(0,h*1.16,c+.04,w*.9,.03,.16,darkMat);
  }
  if (p.features.includes("guard")) box(0,-.15,guardZ+.07,.075,.12,.055,darkMat);
  if (p.features.includes("pump")) {
    box(0,-.069,guardZ,.13,.085,.24,sig);  // moving pump grip
    tube(0,-.062,guardZ,.026,p.guardLength*.90,metal);
  }
  if (p.features.includes("shells")) {
    for(let i=0;i<5;i++) tube(w*.72,-.05,c-.16+i*.06,.016,.07,sig,9);
  }
  if (p.features.includes("bipod")) {
    const legZ=guardFront+.07;
    for (const sign of [-1,1]) {
      const leg=box(sign*.075,-.14,legZ,.027,.28,.026,metal);
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
    case "straight": magBox(0,-.17,magZ,.069,.22,.085,darkMat); magBox(0,-.28,magZ,.080,.02,.091,sig);break;
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
      const drum=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.11,12),sig);
      drum.rotation.z=Math.PI/2;add(drum,0,-.034,c-.05);
      for(let i=0;i<6;i++) {
        const a=2*Math.PI*i/6;
        tube(w*.55, -.034+.045*Math.sin(a),c-.05+.045*Math.cos(a),.010,.015,metal,6);
      }
      break;
    }
    case "grip":box(0,-.18,c+.08,.067,.18,.083,darkMat);break;
  }
  // Rear furniture — unmistakable skeletons, heavy stocks, bullpup cheek pads, etc.
  const rearZ=c+l/2+.05;
  switch (p.stock) {
    case "fixed":box(0,-.025,rearZ+.07,.115,.135,.20,darkMat);box(0,.05,rearZ+.07,.085,.02,.17,sig);break;
    case "heavy":box(0,-.035,rearZ+.055,w*.96,.18,.23,darkMat);box(0,-.07,rearZ+.16,w*1.05,.20,.037,sig);break;
    case "wire":
    case "folding": {
      for(const sign of [-1,1]) box(sign*.054,-.035,rearZ+.065,.025,.027,.22,metal);
      box(0,-.065,rearZ+.17,.13,.11,.035,sig);
      break;
    }
    case "bullpup":box(0,.052,rearZ-.035,w*1.05,.12,.19,bodyMat);box(0,-.065,rearZ+.075,w*1.08,.08,.12,darkMat);break;
    case "precision": {
      for(const sign of [-1,1]) box(sign*.048,-.013,rearZ+.075,.022,.036,.23,metal);
      box(0,.005,rearZ+.075,.12,.025,.19,sig);
      box(0,-.13,rearZ+.18,.10,.21,.038,darkMat);
      break;
    }
  }
  return muzzle;
}
