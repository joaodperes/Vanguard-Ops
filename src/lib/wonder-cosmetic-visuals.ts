import * as THREE from "three";
import { wonderFinishById, wonderKillEffectById } from "./wonder-expansion";

/**
 * Procedural Wonder cosmetics. Textures are generated once when a viewmodel is
 * equipped; all movement afterwards is a cheap UV transform. Kill animations
 * use instancing (one draw call per particle shape), never one mesh per shard.
 */
const SIZE = 256;
type FinishKind =
  | "nebula" | "molten" | "prism" | "vortex" | "plague" | "hazard"
  | "code" | "lava" | "electric" | "storm" | "armor" | "rail"
  | "clock" | "fracture" | "circuit" | "ice" | "saw" | "hydraulic" | "radar";
const FINISH_KINDS: Record<string, FinishKind> = {
  wonder_nebula: "nebula", wonder_molten: "molten", wonder_prismatic: "prism",
  wonder_abyssal_core: "vortex", wonder_living_plague: "plague",
  wonder_war_machine: "hazard", wonder_ghost_signal: "code",
  wonder_infernal_engine: "lava", wonder_stormglass: "electric",
  wonder_stormfront: "storm", wonder_iron_bastion: "armor",
  wonder_ion_accelerator: "rail", wonder_time_fracture: "clock",
  wonder_faultline: "fracture", wonder_spectral_circuit: "circuit",
  wonder_absolute_zero: "ice", wonder_razorstorm: "saw",
  wonder_titan_protocol: "hydraulic", wonder_signal_ghost: "radar",
};
export const wonderFinishVisualKinds = FINISH_KINDS;

function seeded(seed: number): () => number {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
function line(ctx: CanvasRenderingContext2D, coords: number[], color: string, width = 2): void {
  ctx.beginPath();
  ctx.moveTo(coords[0], coords[1]);
  for (let i = 2; i < coords.length; i += 2) ctx.lineTo(coords[i], coords[i + 1]);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, width = 2): void {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke();
}

/** Distinct, repeatable surface pattern for all 19 Wonder finishes. */
export function createWonderFinishTexture(id: string): THREE.CanvasTexture | null {
  const finish = wonderFinishById(id);
  const kind = FINISH_KINDS[id];
  if (!finish || !kind || typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const c = new THREE.Color(finish.color);
  const bright = c.clone().lerp(new THREE.Color("#ffffff"), .4).getStyle();
  const mid = c.clone().multiplyScalar(.62).getStyle();
  const dark = c.clone().multiplyScalar(.12).getStyle();
  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, "#080d17"); grad.addColorStop(.5, dark); grad.addColorStop(1, "#111827");
  ctx.fillStyle = grad; ctx.fillRect(0, 0, SIZE, SIZE);
  const random = seeded(id.split("").reduce((n, char) => (Math.imul(n, 31) + char.charCodeAt(0)) >>> 0, 17));
  ctx.lineCap = "round"; ctx.lineJoin = "round";

  if (kind === "nebula" || kind === "vortex") {
    for (let i = 0; i < 28; i++) {
      const x = random() * 256, y = random() * 256, radius = 8 + random() * 60;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
      glow.addColorStop(0, c.clone().multiplyScalar(.7).getStyle());
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = .08 + random() * .2; ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (kind === "vortex") {
      for (let a = 0; a < 5; a++) {
        ctx.beginPath(); ctx.strokeStyle = a % 2 ? mid : bright; ctx.lineWidth = 1.4 + a * .3;
        for (let j = 0; j <= 70; j++) {
          const t = j / 70 * Math.PI * 3 + a * 1.26, r = 4 + j * 1.52;
          const x = 128 + Math.cos(t) * r, y = 128 + Math.sin(t) * r;
          if (!j) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        } ctx.stroke();
      }
    }
    for (let i = 0; i < 90; i++) {
      const x = random() * 256, y = random() * 256;
      ctx.fillStyle = i % 4 ? bright : "#ffffff";
      ctx.globalAlpha = .25 + random() * .7; ctx.fillRect(x, y, random() * 2 + .5, random() * 2 + .5);
    } ctx.globalAlpha = 1;
  } else if (kind === "molten" || kind === "lava" || kind === "fracture" || kind === "plague") {
    for (let i = 0; i < (kind === "fracture" ? 17 : 22); i++) {
      let x = random() * 320 - 32, y = random() * 320 - 32;
      const coords = [x, y];
      for (let j = 0; j < 7; j++) {
        x += (random() - .5) * 46; y += (random() - .4) * 30;
        coords.push(x, y);
      }
      line(ctx, coords, kind === "plague" ? mid : bright, kind === "fracture" ? 2 : 3.5);
      if (kind !== "fracture") line(ctx, coords, c.getStyle(), 1.2);
      if (kind === "plague") ring(ctx, x, y, 4 + random() * 9, bright, 2);
    }
  } else if (kind === "prism") {
    for (let i = -4; i < 12; i++) {
      const hue = ((i * 43 + 360) % 360);
      ctx.fillStyle = `hsla(${hue},95%,60%,0.55)`;
      ctx.beginPath();
      ctx.moveTo(i * 40, 0); ctx.lineTo(i * 40 + 36, 0);
      ctx.lineTo(i * 40 - 52, 256); ctx.lineTo(i * 40 - 88, 256);
      ctx.closePath(); ctx.fill();
      line(ctx, [i * 40, 0, i * 40 - 88, 256], "#d6ffff", 2);
    }
  } else if (kind === "hazard" || kind === "hydraulic") {
    for (let i = 0; i < 9; i++) {
      const y = i * 32;
      ctx.fillStyle = i % 2 ? mid : "#202833"; ctx.fillRect(0, y, 256, 14);
      line(ctx, [0, y + 15, 256, y + 15], bright, 2);
      for (let j = 0; j < 9; j++) {
        const x = j * 34 + (i % 2) * 13;
        if (kind === "hazard") line(ctx, [x, y, x + 15, y + 14], bright, 4);
        else { ring(ctx, x, y + 8, 3, bright); line(ctx, [x + 6, y + 2, x + 21, y + 13], mid, 3); }
      }
    }
  } else if (kind === "code" || kind === "circuit" || kind === "radar") {
    ctx.strokeStyle = mid; ctx.lineWidth = 1;
    for (let v = 0; v <= 256; v += 32) {
      line(ctx, [v, 0, v, 256], mid, .6); line(ctx, [0, v, 256, v], mid, .6);
    }
    for (let i = 0; i < 34; i++) {
      const x = Math.floor(random() * 8) * 32, y = Math.floor(random() * 8) * 32;
      line(ctx, [x, y, x + 16, y, x + 16, y + 16, x + 31, y + 16], bright, 1.6);
      ctx.fillStyle = bright; ctx.fillRect(x + 29, y + 14, 4, 4);
      if (kind === "code") ctx.fillRect(x + 4, y + 7, 3, 8);
    }
    if (kind === "radar") for (let r = 32; r <= 150; r += 32) ring(ctx, 128, 128, r, bright, 1.2);
  } else if (kind === "electric" || kind === "rail" || kind === "storm") {
    for (let i = 0; i < 12; i++) {
      const y = i * 24 + 7;
      if (kind === "rail") {
        line(ctx, [0, y, 256, y], mid, 5);
        for (let x = 8; x < 256; x += 28) ring(ctx, x, y, 6, bright, 1.5);
      } else {
        const coords = [0, y];
        for (let x = 16; x <= 256; x += 16) coords.push(x, y + (random() - .5) * (kind === "storm" ? 25 : 34));
        line(ctx, coords, bright, kind === "electric" ? 1.8 : 2.8);
      }
    }
    if (kind === "storm") for (let i = 0; i < 6; i++) ring(ctx, 25 + i * 42, 36 + (i % 3) * 72, 6, bright, 3);
  } else if (kind === "armor" || kind === "clock" || kind === "ice" || kind === "saw") {
    for (let y = -32; y < 288; y += 48) for (let x = -32; x < 288; x += 48) {
      const cx = x + (Math.floor(y / 48) % 2) * 24, cy = y;
      if (kind === "armor") {
        line(ctx, [cx,cy - 19,cx + 20,cy - 9,cx + 20,cy + 10,cx,cy + 20,cx - 20,cy + 10,cx - 20,cy - 9,cx,cy - 19], mid, 2.4);
        ring(ctx,cx,cy,2,bright);
      } else if (kind === "clock") {
        ring(ctx,cx,cy,19,bright,1.5);ring(ctx,cx,cy,11,mid,1);
        line(ctx,[cx,cy,cx + 11,cy - 9],bright,2);
      } else if (kind === "ice") {
        for (let a = 0; a < 6; a++) {
          const angle = a * Math.PI / 3;
          line(ctx,[cx,cy,cx + Math.cos(angle)*22,cy + Math.sin(angle)*22],bright,1.7);
          ring(ctx,cx + Math.cos(angle)*19,cy + Math.sin(angle)*19,2,bright,1.4);
        }
      } else {
        ring(ctx,cx,cy,17,mid,2.2);
        for(let a=0;a<9;a++){
          const t=a*2*Math.PI/9;
          line(ctx,[cx+Math.cos(t)*13,cy+Math.sin(t)*13,
            cx+Math.cos(t+.2)*25,cy+Math.sin(t+.2)*25],bright,3);
        }
      }
    }
  }
  // Thin luminous panel seams make the finish readable on small weapon parts.
  for (let i = 0; i < 5; i++) line(ctx, [0, i * 60 + 2, 256, i * 60 + 2], mid, .7);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.4, 1.4);
  return texture;
}

/** Moves only UV coordinates: no canvas redraw, texture upload, or allocations. */
export function updateWonderFinishTexture(texture: THREE.Texture, id: string, seconds: number): void {
  const kind = FINISH_KINDS[id];
  const speed = kind === "radar" || kind === "clock" ? .025 : kind === "prism" ? .085 : .038;
  texture.offset.set((seconds * speed) % 1, (seconds * (kind === "rail" ? .01 : .018)) % 1);
  if (kind === "vortex" || kind === "clock" || kind === "saw" || kind === "radar") {
    texture.center.set(.5, .5);
    texture.rotation = seconds * (kind === "saw" ? -.22 : .065);
  }
}

type Shape = "shard" | "pixel" | "ring" | "spark" | "plate" | "spore";
interface Particle {
  x:number; y:number; z:number; vx:number; vy:number; vz:number;
  size:number; spin:number; delay:number;
}
interface Batch {
  mesh:THREE.InstancedMesh; particles:Particle[]; shape:Shape;
  material:THREE.MeshBasicMaterial;
}
export interface WonderKillVisual {
  group:THREE.Group;
  duration:number;
  update:(fraction:number)=>void;
  dispose:()=>void;
}
function geometry(shape: Shape): THREE.BufferGeometry {
  switch (shape) {
    case "pixel": return new THREE.BoxGeometry(1,1,1);
    case "ring": return new THREE.TorusGeometry(.5,.07,5,22);
    case "spark": return new THREE.CylinderGeometry(.05,.05,1,5);
    case "plate": return new THREE.BoxGeometry(1,.12,1);
    case "spore": return new THREE.IcosahedronGeometry(.5,0);
    default: return new THREE.OctahedronGeometry(.5,0);
  }
}

/**
 * Each theme has its own layout, movement and shape. Per-shape instancing keeps
 * large Survival / high-bot-count matches from spawning dozens of draw calls
 * per elimination. Effects are non-interactive and capped by the engine.
 */
export function createWonderKillVisual(id: string, pos: readonly [number,number,number]): WonderKillVisual | null {
  const effect = wonderKillEffectById(id);
  if (!effect) return null;
  const pattern = "pattern" in effect ? effect.pattern : id;
  const group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  const batches = new Map<Shape, Particle[]>();
  const seed = seeded(id.split("").reduce((n, char) => (Math.imul(n, 33) + char.charCodeAt(0)) >>> 0, 23));
  const add = (shape:Shape,x:number,y:number,z:number,vx:number,vy:number,vz:number,size:number,delay=0):void => {
    const particles=batches.get(shape) ?? [];
    particles.push({x,y,z,vx,vy,vz,size,spin:seed()*Math.PI*2,delay});
    batches.set(shape,particles);
  };
  const polar=(i:number,n:number,r:number):[number,number]=>{
    const a=i*Math.PI*2/n;return [Math.cos(a)*r,Math.sin(a)*r];
  };
  if (pattern==="event_collapse") {
    for(let i=0;i<3;i++)add("ring",0,.95,0,0,0,0,2.5-i*.55,i*.1);
    for(let i=0;i<22;i++){const [x,z]=polar(i,22,1.15);add("shard",x,.4+seed()*1.2,z,-x*1.4,(.95-seed())*.5,-z*1.4,.12);}
  } else if (pattern==="toxic_bloom") {
    for(let i=0;i<26;i++){const [x,z]=polar(i,26,.08+seed()*.9);add("spore",x,.3+seed()*1.4,z,x*.9,.4+seed()*1.2,z*.9,.11+seed()*.12,i%3*.04);}
    add("ring",0,.4,0,0,.3,0,1.4);
  } else if(pattern==="brass_storm"||pattern==="heavy_metal"){
    for(let i=0;i<24;i++){const [x,z]=polar(i,24,.15+seed()*.4);add(i%3===0?"spark":"plate",x,.4+seed()*1.2,z,x*2.8,seed()*1.5,z*2.8,.15+seed()*.18);}
  } else if(pattern==="system_failure"||pattern==="false_reality"||pattern==="digital_erasure"){
    for(let i=0;i<30;i++){const x=(i%6-2.5)*.22,y=.35+Math.floor(i/6)*.28;
      add(pattern==="false_reality"?"shard":"pixel",x,y,(seed()-.5)*.3,(seed()-.5)*1.25,.2+seed(),(seed()-.5)*.8,.14,i%6*.035);}
  } else if(pattern==="ashes_to_ashes"){
    for(let i=0;i<28;i++){const [x,z]=polar(i,28,seed()*.45);add("spark",x,.15+seed()*.9,z,x*.5,1.3+seed()*1.8,z*.5,.12+seed()*.13,i%4*.03);}
  } else if(pattern==="thunderstruck"||pattern==="rail_fracture"){
    for(let i=0;i<20;i++){
      const y=.18+i*.085,x=Math.sin(i*2.7)*.18;
      add("spark",x,y,0,Math.sin(i*2.7)*.35,(seed()-.5)*.5,(seed()-.5)*.7,.12,i%3*.02);
    }
    if(pattern==="rail_fracture"){add("ring",0,.9,0,0,0,0,.65);add("ring",0,1.25,0,0,0,0,.6,.1);}
  } else if(pattern==="chain_reaction"){
    for(let i=0;i<4;i++){
      const [x,z]=polar(i,4,.3); add("ring",x,.7,z,0,0,0,.6,i*.12);
      for(let j=0;j<5;j++){const [dx,dz]=polar(j,5,.15);add("spark",x+dx,.65,z+dz,dx*2,.5,dz*2,.14,i*.12);}
    }
  } else if(pattern==="last_stand"||pattern==="earthshatter"){
    for(let i=0;i<24;i++){const [x,z]=polar(i,24,.1+seed()*.48);add("plate",x,.18+seed()*1.1,z,x*2,.65+seed()*1.3,z*2,.18+seed()*.25);}
  } else if(pattern==="temporal_echo"){
    for(let i=0;i<3;i++)add("ring",0,1,0,0,0,0,1.3+i*.5,i*.12);
    // Three offset humanoid outlines become staggered translucent echoes.
    const silhouette:[number,number][]=[
      [-.09,1.55],[.09,1.55],[-.2,1.22],[.2,1.22],
      [-.18,.92],[.18,.92],[-.13,.51],[.13,.51],
    ];
    for(let echo=0;echo<3;echo++){
      const offset=(echo-1)*.36;
      for(const [x,y] of silhouette)
        add("pixel",x+offset,y,0,offset*.7,.08,0,.15,echo*.1);
    }
    for(let i=0;i<20;i++){const [x,z]=polar(i,20,.4+seed()*.28);add("shard",x,.25+seed()*1.6,z,x*.4,.1,z*.4,.09,i%4*.05);}
  } else if(pattern==="deep_freeze"){
    // A frost outline holds briefly, then explodes into crystalline shards.
    const icyOutline:[number,number][]=[
      [-.08,1.64],[.08,1.64],[-.2,1.42],[.2,1.42],
      [-.22,1.19],[.22,1.19],[-.22,.95],[.22,.95],
      [-.16,.75],[.16,.75],[-.15,.5],[.15,.5],[-.13,.24],[.13,.24],
    ];
    for(const [x,y] of icyOutline)add("pixel",x,y,0,x*1.5,.6,(seed()-.5)*.7,.16,.24);
    for(let i=0;i<28;i++){const [x,z]=polar(i,28,.1+seed()*.32);add("shard",x,.2+seed()*1.65,z,x*1.9,.65+seed(),z*1.9,.15+seed()*.18,i%5*.03);}
    add("ring",0,.95,0,0,0,0,1.2);
  } else if(pattern==="razor_divide"){
    for(let i=0;i<4;i++){add("ring",0,.6+i*.23,0,0,0,0,.9+i*.17,i*.035);}
    for(let i=0;i<18;i++){const [x,z]=polar(i,18,.15+seed()*.5);add("shard",x,.35+seed()*1.3,z,x*1.5,.2,z*1.5,.2);}
  } else if(id==="wonder_kill_nova"){
    for(let i=0;i<3;i++)add("ring",0,.9,0,0,0,0,1.3+i*.5,i*.08);
    for(let i=0;i<16;i++){const [x,z]=polar(i,16,.3);add("spark",x,.3+seed()*1.2,z,x*2,.7,z*2,.16);}
  } else {
    // Universal Crystal Shatter and Disintegration have separate silhouettes.
    const crystal=id==="wonder_kill_shatter";
    for(let i=0;i<(crystal?22:30);i++){const [x,z]=polar(i,crystal?22:30,seed()*.4);add(crystal?"shard":"pixel",x,.2+seed()*1.55,z,x*2,(crystal?.6:1.3)+seed(),z*2,crystal?.2:.12,i%4*.025);}
  }

  const color = new THREE.Color(effect.color);
  const rendered:Batch[]=[];
  const dummy=new THREE.Object3D();
  for(const [shape,particles] of batches){
    const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.94,depthWrite:false,
      blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
    const mesh=new THREE.InstancedMesh(geometry(shape),material,particles.length);
    mesh.frustumCulled=false; // short-lived localized effect; avoids per-instance bounds calculations
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(mesh); rendered.push({mesh,particles,shape,material});
  }
  const duration=pattern==="event_collapse"||pattern==="deep_freeze" ? 850 : 730;
  const update=(fraction:number):void=>{
    const p=Math.max(0,Math.min(1,fraction));
    for(const {mesh,particles,shape,material} of rendered){
      material.opacity=.94*Math.pow(1-p,1.3);
      for(let i=0;i<particles.length;i++){
        const a=particles[i],u=Math.max(0,Math.min(1,(p-a.delay)/(1-a.delay)));
        const travel=u*(2-u);
        dummy.position.set(a.x+a.vx*travel,a.y+a.vy*travel,a.z+a.vz*travel);
        const scale=a.size*(shape==="ring"
          ? (pattern==="event_collapse" ? Math.max(.04,1.9*(1-u)) : .4+u*2.1)
          : Math.max(.02,1-u*.82));
        const frostHolding=pattern==="deep_freeze"&&shape==="pixel";
        dummy.scale.setScalar(u===0&&a.delay>p&&!frostHolding ? .0001 : scale);
        if(shape==="ring"){dummy.rotation.set(Math.PI/2,0,a.spin+u*3);}
        else {dummy.rotation.set(a.spin+u*3,a.spin*.4+u*6,a.spin*.2+u*4);}
        dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate=true;
    }
  };
  update(0);
  return {group,duration,update,dispose:()=>{
    group.removeFromParent();
    for(const {mesh,material} of rendered){mesh.geometry.dispose();material.dispose();}
  }};
}
