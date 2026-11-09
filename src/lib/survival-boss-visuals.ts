import * as THREE from "three";

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

export function addSurvivalBossArmor(parts: {
  root: THREE.Group;
  torso: THREE.Object3D;
  head: THREE.Object3D;
  upperArmL: THREE.Object3D;
  upperArmR: THREE.Object3D;
  upperLegL: THREE.Object3D;
  upperLegR: THREE.Object3D;
}): SurvivalBossVisual {
  const armor = new THREE.MeshStandardMaterial({color:0x20262e,metalness:0.8,roughness:0.32});
  const edge = new THREE.MeshStandardMaterial({color:0x69737e,metalness:0.8,roughness:0.34});
  const nearBlack = new THREE.MeshStandardMaterial({color:0x11151c,metalness:0.62,roughness:0.5});
  const glow = () => new THREE.MeshBasicMaterial({color:PHASE_COLORS[0],toneMapped:false});
  const chargedParts: THREE.MeshBasicMaterial[] = [];
  const block = (
    parent: THREE.Object3D, size: [number,number,number],
    pos: [number,number,number], material: THREE.Material,
  ) => {
    const obj = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    obj.position.set(...pos);
    obj.castShadow = true;
    parent.add(obj);
    return obj;
  };
  const lit = (parent: THREE.Object3D, size: [number,number,number], pos: [number,number,number]) => {
    const mat = glow();
    chargedParts.push(mat);
    return block(parent,size,pos,mat);
  };

  // Layered slab armor extends well beyond the default half-meter chest.
  block(parts.torso,[0.83,0.58,0.42],[0,1.22,0.0],armor);
  block(parts.torso,[0.73,0.13,0.47],[0,1.44,0.015],edge);
  block(parts.torso,[0.66,0.20,0.47],[0,0.96,0],nearBlack);
  block(parts.torso,[0.56,0.22,0.05],[0,1.25,0.245],edge);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.16,0),glow());
  core.position.set(0,1.28,0.32);
  core.rotation.z=Math.PI/4;
  parts.torso.add(core);
  chargedParts.push(core.material as THREE.MeshBasicMaterial);
  for (const sign of [-1,1]) {
    block(parts.torso,[0.13,0.38,0.08],[sign*0.31,1.24,0.24],armor);
    lit(parts.torso,[0.045,0.27,0.055],[sign*0.29,1.25,0.30]);
    // Back-mounted cooling ducts / energy reactor visible from behind.
    block(parts.root,[0.27,0.62,0.33],[sign*0.27,1.21,-0.33],armor);
    lit(parts.root,[0.12,0.34,0.035],[sign*0.27,1.23,-0.51]);
    const arm = sign<0 ? parts.upperArmR : parts.upperArmL;
    block(arm,[0.42,0.26,0.52],[0,-0.085,-0.01],armor);
    block(arm,[0.40,0.07,0.57],[0,-0.03,0.0],edge);
    lit(arm,[0.23,0.045,0.055],[0,-0.09,0.275]);
    const leg = sign<0 ? parts.upperLegR : parts.upperLegL;
    block(leg,[0.26,0.35,0.26],[0,-0.19,0.065],armor);
  }
  // Oversized shoulder ramps and raised back fins give the boss a silhouette
  // that does not resemble either ordinary bots or the smaller elite class.
  for (const sign of [-1,1]) {
    block(parts.torso,[0.39,0.22,0.66],[sign*0.52,1.48,-0.02],armor);
    lit(parts.torso,[0.24,0.04,0.56],[sign*0.52,1.60,0.01]);
    block(parts.root,[0.16,0.74,0.20],[sign*0.31,1.82,-0.41],edge);
    lit(parts.root,[0.08,0.62,0.06],[sign*0.31,1.82,-0.54]);
  }
  // Heavy raised helmet with side guards and a brilliant horizontal visor.
  block(parts.head,[0.42,0.34,0.42],[0,0.025,0],armor);
  block(parts.head,[0.49,0.10,0.47],[0,0.18,-0.02],edge);
  block(parts.head,[0.09,0.25,0.44],[-0.24,0.01,-0.01],armor);
  block(parts.head,[0.09,0.25,0.44],[0.24,0.01,-0.01],armor);
  lit(parts.head,[0.34,0.085,0.038],[0,0.045,0.235]);
  for (const side of [-1,1]) {
    block(parts.head,[0.09,0.2,0.14],[side*0.18,0.30,-0.05],armor);
  }

  block(parts.head,[0.38,0.14,0.48],[0,0.36,-0.03],armor);
  lit(parts.head,[0.28,0.08,0.08],[0,0.45,0.21]);

  // Depth-tested danger telegraph. The ground ring grows during the actual
  // 2.2-second server-authoritative wind-up. A second ring sweeps outward
  // after the shockwave fires; neither raycasts nor alters collision.
  const warningRing = new THREE.Mesh(
    new THREE.TorusGeometry(1,0.055,6,40),
    new THREE.MeshBasicMaterial({
      color:0xff4969,transparent:true,opacity:0,depthWrite:false,depthTest:true,
    }),
  );
  warningRing.rotation.x=-Math.PI/2;
  warningRing.position.y=0.09;
  parts.root.add(warningRing);
  const shockwaveRing = new THREE.Mesh(
    new THREE.TorusGeometry(1,0.10,6,48),
    new THREE.MeshBasicMaterial({
      color:0xffd3b2,transparent:true,opacity:0,depthWrite:false,depthTest:true,
    }),
  );
  shockwaveRing.rotation.x=-Math.PI/2;
  shockwaveRing.position.y=0.12;
  parts.root.add(shockwaveRing);
  return {chargedParts,core,warningRing,shockwaveRing,previousCharge:0,pulseStartedAt:-Infinity};
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
