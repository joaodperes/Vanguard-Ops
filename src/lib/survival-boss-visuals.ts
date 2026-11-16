import * as THREE from "three";
import { JUGGERNAUT_VISUAL_PALETTE } from "./wonder-models";

// A silhouette made of solid armor, NOT a larger collision body.
// Every piece is attached to an existing humanoid joint so weapon IK,
// walking, head tracking and hit detection are unchanged.
export interface SurvivalBossVisual {
  chargedParts: THREE.MeshBasicMaterial[];
  core: THREE.Mesh;
  warningRing: THREE.Mesh;
  shockwaveRing: THREE.Mesh;
  previousCharge: number;
  pulseStartedAt: number;
}

const PHASE_COLORS = [0xff3856, 0xffae39, 0x9d73ff] as const;

export function survivalBossPhase(weaponId: string): number {
  if (weaponId === "shotgun_auto") return 1;
  if (weaponId === "rifle_heavy") return 2;
  return 0;
}

/**
 * An articulated, boss-sized version of the Juggernaut chassis. Armor follows
 * the real bot joints so movement, weapon IK and death poses still animate.
 * It deliberately adds no hitbox or collider: combat rules remain unchanged.
 * Unlike the normal operator skins, this shell hides the undersuit.
 */
export function addSurvivalBossArmor(parts: {
  root: THREE.Group;
  torso: THREE.Object3D;
  head: THREE.Object3D;
  upperArmL: THREE.Object3D;
  upperArmR: THREE.Object3D;
  upperLegL: THREE.Object3D;
  upperLegR: THREE.Object3D;
  lowerLegL: THREE.Object3D;
  lowerLegR: THREE.Object3D;
}): SurvivalBossVisual {
  // Exact base metal palette of the player's Juggernaut drop, with separate
  // phase lights to preserve the existing shotgun/rifle boss tells.
  const armor = new THREE.MeshStandardMaterial({
    color: JUGGERNAUT_VISUAL_PALETTE.armor, metalness: 0.72, roughness: 0.3,
  });
  const shadow = new THREE.MeshStandardMaterial({
    color: JUGGERNAUT_VISUAL_PALETTE.shadow, metalness: 0.52, roughness: 0.32,
  });
  const edge = new THREE.MeshStandardMaterial({ color: 0x7591a2, metalness: 0.72, roughness: 0.34 });
  const blue = new THREE.MeshStandardMaterial({
    color: JUGGERNAUT_VISUAL_PALETTE.visor, emissive: 0x137dd1,
    emissiveIntensity: 0.7, metalness: 0.42, roughness: 0.3,
  });
  const chargedParts: THREE.MeshBasicMaterial[] = [];
  const block = (
    parent: THREE.Object3D, name: string, size: [number, number, number],
    pos: [number, number, number], material: THREE.Material,
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.name = `survival_boss_${name}`;
    mesh.position.set(...pos);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const lit = (
    parent: THREE.Object3D, name: string, size: [number, number, number],
    pos: [number, number, number],
  ) => {
    const material = new THREE.MeshBasicMaterial({ color: PHASE_COLORS[0], toneMapped: false });
    chargedParts.push(material);
    return block(parent, name, size, pos, material);
  };

  // Wide squared-off chest and shoulder span echo the actual Juggernaut suit.
  // A front-facing breastplate wraps the bot's original small chest without
  // moving or scaling the underlying humanoid skeleton.
  block(parts.torso, "chassis", [1.08, 0.70, 0.55], [0, 1.28, 0], armor);
  block(parts.torso, "abdomen", [0.78, 0.26, 0.54], [0, 0.91, 0], shadow);
  block(parts.torso, "chest_front", [0.92, 0.50, 0.10], [0, 1.33, 0.30], armor);
  block(parts.torso, "chest_bridge", [0.75, 0.12, 0.15], [0, 1.56, 0.29], edge);
  block(parts.torso, "chest_belt", [0.92, 0.12, 0.54], [0, 0.98, 0], shadow);
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? "right" : "left";
    block(parts.torso, `chest_plate_${side}`, [0.34, 0.32, 0.10], [sign * 0.25, 1.29, 0.39], shadow);
    block(parts.torso, `shoulder_${side}`, [0.55, 0.38, 0.74], [sign * 0.69, 1.51, -0.02], armor);
    block(parts.torso, `shoulder_ridge_${side}`, [0.59, 0.10, 0.80], [sign * 0.69, 1.73, -0.02], edge);
    block(parts.torso, `shoulder_light_${side}`, [0.38, 0.08, 0.07], [sign * 0.69, 1.65, 0.38], blue);

    // Exposed rear radiator housings are a Juggernaut signature even when
    // approached from behind. Their small red/amber/purple strips signal phase.
    block(parts.root, `reactor_pod_${side}`, [0.32, 0.66, 0.42], [sign * 0.35, 1.31, -0.40], armor);
    block(parts.root, `reactor_vent_${side}`, [0.22, 0.42, 0.06], [sign * 0.35, 1.32, -0.65], shadow);
    lit(parts.root, `reactor_light_${side}`, [0.10, 0.32, 0.065], [sign * 0.35, 1.32, -0.70]);
    block(parts.root, `reactor_fin_${side}`, [0.17, 0.42, 0.22], [sign * 0.35, 1.90, -0.43], edge);

    const arm = sign < 0 ? parts.upperArmR : parts.upperArmL;
    block(arm, `upper_arm_${side}`, [0.39, 0.42, 0.42], [0, -0.17, 0], armor);
    block(arm, `gauntlet_${side}`, [0.32, 0.20, 0.46], [0, -0.36, 0.015], shadow);
    block(arm, `arm_stripe_${side}`, [0.28, 0.055, 0.065], [0, -0.16, 0.24], blue);

    const thigh = sign < 0 ? parts.upperLegR : parts.upperLegL;
    block(thigh, `thigh_${side}`, [0.33, 0.42, 0.40], [0, -0.19, 0.04], armor);
    block(thigh, `knee_${side}`, [0.35, 0.17, 0.46], [0, -0.40, 0.07], edge);
    const shin = sign < 0 ? parts.lowerLegR : parts.lowerLegL;
    block(shin, `shin_${side}`, [0.32, 0.37, 0.35], [0, -0.20, 0.01], armor);
    block(shin, `boot_${side}`, [0.40, 0.15, 0.52], [0, -0.39, 0.11], shadow);
    block(shin, `boot_toe_${side}`, [0.34, 0.09, 0.17], [0, -0.40, 0.35], edge);
  }
  block(parts.torso, "chest_indicator", [0.66, 0.045, 0.065], [0, 1.53, 0.39], blue);
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.145, 0),
    new THREE.MeshBasicMaterial({ color: PHASE_COLORS[0], toneMapped: false }),
  );
  core.name = "survival_boss_reactor_core";
  core.position.set(0, 1.30, 0.47);
  core.rotation.z = Math.PI / 4;
  parts.torso.add(core);
  chargedParts.push(core.material as THREE.MeshBasicMaterial);

  // Fully enclosed rectangular helmet: same dark faceplate, luminous blue
  // visor and armored brow as the deployable Juggernaut (bot forward is +Z).
  block(parts.head, "helmet", [0.59, 0.44, 0.55], [0, 0.07, 0], armor);
  block(parts.head, "helmet_brow", [0.67, 0.15, 0.60], [0, 0.27, 0.02], edge);
  block(parts.head, "helmet_face", [0.52, 0.23, 0.075], [0, 0.05, 0.30], shadow);
  block(parts.head, "helmet_visor", [0.46, 0.10, 0.085], [0, 0.105, 0.355], blue);
  block(parts.head, "helmet_jaw", [0.54, 0.11, 0.50], [0, -0.18, 0.015], shadow);
  for (const sign of [-1, 1]) {
    block(parts.head, `helmet_guard_${sign}`, [0.10, 0.33, 0.58], [sign * 0.30, 0.02, 0], armor);
  }

  // Depth-tested wind-up warning and shockwave. Neither affects collision.
  const warningRing = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.055, 6, 40),
    new THREE.MeshBasicMaterial({
      color: PHASE_COLORS[0], transparent: true, opacity: 0, depthWrite: false, depthTest: true,
    }),
  );
  warningRing.name = "survival_boss_shockwave_warning";
  warningRing.rotation.x = -Math.PI / 2;
  warningRing.position.y = 0.09;
  parts.root.add(warningRing);
  const shockwaveRing = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.10, 6, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffd3b2, transparent: true, opacity: 0, depthWrite: false, depthTest: true,
    }),
  );
  shockwaveRing.name = "survival_boss_shockwave_pulse";
  shockwaveRing.rotation.x = -Math.PI / 2;
  shockwaveRing.position.y = 0.12;
  parts.root.add(shockwaveRing);
  return { chargedParts, core, warningRing, shockwaveRing, previousCharge: 0, pulseStartedAt: -Infinity };
}

/** Purple-lit, shoulder-plated elite silhouette; never affects hitboxes. */
export function addSurvivalEliteArmor(parts:{
  torso:THREE.Object3D;head:THREE.Object3D;
  upperArmL:THREE.Object3D;upperArmR:THREE.Object3D;
}):void {
  const plate=new THREE.MeshStandardMaterial({color:0x26253c,metalness:.68,roughness:.38});
  const glow=new THREE.MeshBasicMaterial({color:0xba8cff,toneMapped:false});
  const block=(parent:THREE.Object3D,size:[number,number,number],pos:[number,number,number],mat:THREE.Material)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);
    mesh.position.set(...pos);mesh.castShadow=true;parent.add(mesh);
  };
  block(parts.torso,[.66,.19,.38],[0,1.46,0],plate);
  block(parts.torso,[.52,.065,.40],[0,1.47,.012],glow);
  for(const sign of [-1,1]){
    block(parts.torso,[.24,.18,.36],[sign*.36,1.47,0],plate);
    block(parts.torso,[.17,.035,.32],[sign*.36,1.57,.005],glow);
    const arm=sign<0?parts.upperArmR:parts.upperArmL;
    block(arm,[.21,.22,.24],[0,-.07,0],plate);
  }
  block(parts.head,[.32,.14,.31],[0,.17,0],plate);
  block(parts.head,[.26,.055,.045],[0,.04,.16],glow);
}

export function updateSurvivalBossArmor(visual: SurvivalBossVisual, weaponId:string, charge:number, now:number):void {
  const phaseColor=PHASE_COLORS[survivalBossPhase(weaponId)];
  const strength=Math.max(0,Math.min(1,charge));
  for(const mat of visual.chargedParts) mat.color.setHex(phaseColor);
  visual.core.scale.setScalar(1+strength*0.50+0.075*Math.sin(now*0.008));
  const warningMat=visual.warningRing.material as THREE.MeshBasicMaterial;
  warningMat.color.setHex(phaseColor);
  warningMat.opacity=strength>0?0.18+strength*0.63:0;
  visual.warningRing.scale.setScalar(1.15+strength*1.85);
  if(visual.previousCharge>=0.70 && strength<0.15) visual.pulseStartedAt=now;
  visual.previousCharge=strength;
  const pulseAge=now-visual.pulseStartedAt;
  const mat=visual.shockwaveRing.material as THREE.MeshBasicMaterial;
  if(pulseAge>=0&&pulseAge<600) {
    mat.opacity=0.8*(1-pulseAge/600);
    visual.shockwaveRing.scale.setScalar(1+pulseAge/600*10);
  } else {
    mat.opacity=0;
  }
}
