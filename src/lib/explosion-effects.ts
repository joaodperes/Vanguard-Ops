/** Bounded cosmetic explosion effects. No combat state or damage rules live here.
 * Point-light count stays constant: changing it recompiles every lit material.
 */
import * as THREE from "three";
export const MAX_EXPLOSION_EFFECTS=12;
export const EXPLOSION_DRAW_DISTANCE=120;
export const EXPLOSION_SOUND_INTERVAL_MS=100;
export type ExplosionStyle="ordinary"|"singularity"|"corrosion"|"swarm";
const STYLES={
  ordinary:{color:0xff6622,lightColor:0xff6622,life:500,intensity:4},
  singularity:{color:0x9370ff,lightColor:0x6e42ea,life:650,intensity:7},
  corrosion:{color:0x597940,lightColor:0x557040,life:500,intensity:7},
  swarm:{color:0x3df9ef,lightColor:0x21f1db,life:750,intensity:4},
} as const;
interface Slot {
  mesh:THREE.Mesh<THREE.SphereGeometry,THREE.MeshBasicMaterial>;
  active:boolean;born:number;life:number;radius:number;style:ExplosionStyle;
}

export class ExplosionEffects {
  private readonly geometry=new THREE.SphereGeometry(.3,12,8);
  private readonly slots:Slot[]=[];
  // Always present and visible, even at zero intensity. Never creates shader variants in combat.
  private readonly light=new THREE.PointLight(0xff6622,0,12);
  private lastSoundAt=-Infinity;
  private disposed=false;
  constructor(private readonly scene:THREE.Scene){
    this.light.castShadow=false;
    this.light.name="pooled_explosion_light";
    scene.add(this.light);
    for(let i=0;i<MAX_EXPLOSION_EFFECTS;i++){
      const mesh=new THREE.Mesh(this.geometry,new THREE.MeshBasicMaterial({
        color:0xff6622,transparent:true,opacity:0,depthWrite:false,
      }));
      mesh.name="pooled_explosion";mesh.visible=false;mesh.castShadow=false;
      scene.add(mesh);
      this.slots.push({mesh,active:false,born:0,life:500,radius:1,style:"ordinary"});
    }
  }
  get activeCount():number {return this.slots.reduce((n,s)=>n+Number(s.active),0);}
  /** Cosmetic admission only: callers must always resolve the detonation's damage. */
  spawn(pos:THREE.Vector3,style:ExplosionStyle,radius:number,now:number,listener:THREE.Vector3):boolean {
    if(this.disposed||pos.distanceToSquared(listener)>EXPLOSION_DRAW_DISTANCE**2)return false;
    this.expire(now);
    let slot=this.slots.find(s=>!s.active);
    if(!slot){
      const importance=(s:Slot)=>(1-Math.min(1,(now-s.born)/s.life))/(1+s.mesh.position.distanceToSquared(listener)/225);
      let least=this.slots[0],score=importance(least);
      for(const s of this.slots){const value=importance(s);if(value<score){least=s;score=value;}}
      if(1/(1+pos.distanceToSquared(listener)/225)<=score)return false;
      slot=least;
    }
    slot.active=true;slot.born=now;slot.life=STYLES[style].life;slot.radius=radius;slot.style=style;
    slot.mesh.position.copy(pos);slot.mesh.scale.setScalar(.3);slot.mesh.material.color.setHex(STYLES[style].color);
    slot.mesh.material.opacity=.85;slot.mesh.visible=true;
    return true;
  }
  /** Closely spaced bomblets share audible reports instead of building overlapping audio graphs. */
  soundDue(pos:THREE.Vector3,listener:THREE.Vector3,now:number):boolean {
    if(this.disposed||pos.distanceToSquared(listener)>=90**2||now-this.lastSoundAt<EXPLOSION_SOUND_INTERVAL_MS)return false;
    this.lastSoundAt=now;return true;
  }
  private expire(now:number):void {
    for(const slot of this.slots)if(slot.active&&now-slot.born>=slot.life){
      slot.active=false;slot.mesh.visible=false;slot.mesh.material.opacity=0;
    }
  }
  update(now:number,listener:THREE.Vector3):void {
    if(this.disposed)return;
    this.expire(now);
    let chosen:Slot|undefined,best=0,intensity=0;
    for(const slot of this.slots){
      if(!slot.active)continue;
      const t=Math.max(0,Math.min(1,(now-slot.born)/slot.life));
      const scale=slot.life>500?.3+t*(slot.radius/.3-.3):.3+t*2.2;
      slot.mesh.scale.setScalar(scale);slot.mesh.material.opacity=.85*(1-t);
      const brightness=STYLES[slot.style].intensity*(1-t)*(1-t);
      const score=brightness/(1+slot.mesh.position.distanceToSquared(listener)/225);
      if(score>best){chosen=slot;best=score;intensity=brightness;}
    }
    this.light.intensity=chosen?intensity:0;
    if(chosen){
      this.light.position.copy(chosen.mesh.position);this.light.color.setHex(STYLES[chosen.style].lightColor);
      this.light.distance=chosen.style==="singularity"?chosen.radius*2:chosen.style==="corrosion"?20:12;
    }
  }
  dispose():void {
    if(this.disposed)return;this.disposed=true;
    for(const slot of this.slots){slot.mesh.removeFromParent();slot.mesh.material.dispose();slot.active=false;}
    this.geometry.dispose();this.light.removeFromParent();this.light.dispose();
  }
}
