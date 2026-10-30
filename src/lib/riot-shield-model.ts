import * as THREE from "three";
import { shieldPanel, RIOT_SHIELD_HP } from "./riot-shield";
/** A bulletproof viewport remains transparent; it has exactly the same collision as the plate. */
export function createRiotShieldModel(unlit=false): THREE.Group {
  const root=new THREE.Group();
  const plate=unlit?new THREE.MeshBasicMaterial({color:0x344655}):new THREE.MeshStandardMaterial({color:0x344655,metalness:.7,roughness:.4});
  const trim=unlit?new THREE.MeshBasicMaterial({color:0xb69d5c}):new THREE.MeshStandardMaterial({color:0xb69d5c,metalness:.6,roughness:.35});
  const glass=new THREE.MeshStandardMaterial({color:0xb5e5ee,transparent:true,opacity:.16,metalness:.1,roughness:.15,side:THREE.DoubleSide,depthWrite:false});
  const box=(x:number,y:number,w:number,h:number,mat:THREE.Material)=>{
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,.065),mat);m.position.set(x,y,0);root.add(m);
  };
  // Normalized to the raised collision rectangle. Hip pose scales to its dimensions.
  const p=shieldPanel(true), w=p.width,h=p.height;
  box(0,-.30,w,h-.60,plate);
  box(0,.95,w,.22,plate);
  box(-w/2+.06,.65,.12,.60,plate);box(w/2-.06,.65,.12,.60,plate);
  box(0,.64,w-.24,.39,glass);
  box(0,.36,w,.045,trim);box(0,-.70,w*.6,.06,trim);
  for(const x of [-.52,.52])box(x,-.22,.045,.46,trim);
  // Fixed, lightweight geometry for three damage tiers; only opacity and
  // visibility change per frame. Scratches sit on BOTH faces, including the
  // transparent visor, so the player and observers read durability directly.
  const damageGroups: THREE.Group[] = [];
  const scars: number[][] = [
    [-.52,-.48,-.37,-.31, -.37,-.31,-.30,-.39, .32,.68,.44,.58],
    [-.30,.67,-.18,.78, -.18,.78,-.04,.61, -.04,.61,.09,.74,
      .09,.74,.21,.64, -.37,-.12,-.23,.04, -.23,.04,-.11,-.05],
    [.10,.37,.25,.20, .25,.20,.40,.29, .40,.29,.51,.09,
      -.57,-.72,-.40,-.57, -.40,-.57,-.25,-.68,
      .05,-.50,.21,-.33, .21,-.33,.37,-.42],
  ];
  for(const [index, segments] of scars.entries()){
    const stage=new THREE.Group();
    const coords: number[]=[];
    for(let i=0;i<segments.length;i+=4){
      const [x,y,x2,y2]=segments.slice(i,i+4);
      for(const z of [-.044,.044])coords.push(x,y,z,x2,y2,z);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute("position",new THREE.Float32BufferAttribute(coords,3));
    const lines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({
      color:index===2?0xffb59a:index===1?0xffd69a:0xc6dce5,
      transparent:true,opacity:.65,depthTest:true,depthWrite:false,
    }));
    lines.renderOrder=6+index;
    stage.add(lines);stage.visible=false;root.add(stage);damageGroups.push(stage);
  }
  root.userData.damageGroups=damageGroups;
  root.userData.damageStage=0;
  return root;
}

/** Show progressive bullet scoring/cracks on the actual shield. No geometry or
 * materials are created per-frame. Hit flashes are handled separately by HUD. */
export function applyRiotShieldDamageVisual(model:THREE.Group,hp:number):number {
  const pct=Math.max(0,Math.min(1,hp/RIOT_SHIELD_HP));
  const stage=hp<=0?3:pct<=.20?3:pct<=.48?2:pct<=.78?1:0;
  const groups=model.userData.damageGroups as THREE.Group[]|undefined;
  if(groups){
    for(const [i,g] of groups.entries()){
      g.visible=stage>i;
      const line=g.children[0] as THREE.LineSegments;
      const mat=line.material as THREE.LineBasicMaterial;
      mat.opacity=Math.min(.96,.35+(1-pct)*.8);
    }
  }
  model.userData.damageStage=stage;
  return stage;
}
