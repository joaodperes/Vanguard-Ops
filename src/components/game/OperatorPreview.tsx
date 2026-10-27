"use client";
import {useEffect,useRef,useState} from "react";
import * as THREE from "three";
import {PLAYER_SKINS} from "@/lib/game-data";

/** Solo preview uses the same body palette and proportions as the combatant
 * mesh builder in fps-engine. No fake player, network peer or dev cheat needed. */
export function OperatorPreview({equippedId="default"}:{equippedId?:string}){
  const mount=useRef<HTMLDivElement>(null);
  const [selected,setSelected]=useState(equippedId);
  useEffect(()=>setSelected(equippedId),[equippedId]);
  useEffect(()=>{
    const host=mount.current;
    if(!host)return;
    const skin=PLAYER_SKINS.find(s=>s.id===selected)??PLAYER_SKINS[0];
    const width=Math.max(240,host.clientWidth),height=268;
    const scene=new THREE.Scene();
    scene.background=new THREE.Color("#0a1020");
    const camera=new THREE.PerspectiveCamera(34,width/height,.1,30);
    camera.position.set(2.9,1.7,4.6);camera.lookAt(0,1.05,0);
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.setSize(width,height);host.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff,0x29384d,2.1));
    const light=new THREE.DirectionalLight(0xffffff,2.4);
    light.position.set(-3,5,4);scene.add(light);
    const armor=new THREE.MeshStandardMaterial({color:skin.color,metalness:.3,roughness:.6,emissive:skin.emissive??"#000",emissiveIntensity:skin.emissive?.4:0});
    const accents=new THREE.MeshStandardMaterial({color:skin.accent,metalness:.4,roughness:.5,emissive:skin.emissive??skin.accent,emissiveIntensity:.3});
    const dark=new THREE.MeshStandardMaterial({color:0x1a1a1a,roughness:.7,metalness:.2});
    const steel=new THREE.MeshStandardMaterial({color:0x485563,roughness:.5,metalness:.5});
    const root=new THREE.Group();scene.add(root);
    function box(w:number,h:number,d:number,x:number,y:number,z:number,material:THREE.Material,parent:THREE.Object3D=root){
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
      mesh.position.set(x,y,z);parent.add(mesh);return mesh;
    }
    box(.5,.55,.28,0,1.2,0,armor);
    box(.52,.08,.30,0,1.35,0,accents);
    box(.45,.2,.25,0,.85,0,dark);
    box(.26,.28,.26,0,1.62,0,armor);
    box(.22,.08,.02,0,1.64,.14,accents);
    for(const side of [-1,1]){
      box(.13,.33,.13,side*.30,1.24,0,armor);
      box(.11,.30,.11,side*.31,.92,.15,dark);
      box(.13,.115,.14,side*.31,.75,.15,dark);
      box(.18,.42,.18,side*.13,.59,0,dark);
      box(.16,.40,.16,side*.13,.2,0,dark);
      box(.18,.08,.28,side*.13,.03,.05,armor);
    }
    // Same third-person gun-in-hands visual role as an actual combatant.
    box(.32,.13,.72,-.08,1.27,.39,steel);
    box(.12,.10,.45,-.08,1.26,.88,dark);
    box(.1,.24,.13,-.08,1.09,.38,dark);
    box(.12,.16,.26,-.08,1.27,.04,dark);
    box(.10,.03,.25,-.08,1.35,.42,accents);
    const floor=new THREE.Mesh(new THREE.CylinderGeometry(.78,.83,.05,48),new THREE.MeshStandardMaterial({color:0x182333,roughness:.8}));
    floor.position.set(0,-.035,0);scene.add(floor);
    let frame=0,angle=0;
    const animate=()=>{frame=requestAnimationFrame(animate);angle+=.005;root.rotation.y=angle;renderer.render(scene,camera);};
    animate();
    const observer=new ResizeObserver(()=>{const w=Math.max(240,host.clientWidth);camera.aspect=w/height;camera.updateProjectionMatrix();renderer.setSize(w,height);});
    observer.observe(host);
    return ()=>{cancelAnimationFrame(frame);observer.disconnect();host.removeChild(renderer.domElement);scene.traverse(obj=>{if(obj instanceof THREE.Mesh){obj.geometry.dispose();const m=obj.material;if(Array.isArray(m))m.forEach(x=>x.dispose());else m.dispose();}});renderer.dispose();};
  },[selected]);
  return <section aria-label="Solo 3D operative preview" className="mb-6 rounded-2xl border border-cyan-500/20 bg-zinc-900/50 p-4">
    <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
      <h2 className="text-white font-semibold">Operative Preview · Solo</h2>
      <select aria-label="Preview operative skin" value={selected} onChange={e=>setSelected(e.target.value)} className="rounded-lg bg-zinc-950 border border-white/20 px-3 py-2 text-white text-sm">
        {PLAYER_SKINS.map(s=><option value={s.id} key={s.id}>{s.name}{s.id===equippedId?" (equipped)":""}</option>)}
      </select>
    </div>
    <div ref={mount} className="w-full rounded-xl overflow-hidden border border-white/10" style={{minHeight:268}}/>
    <p className="text-white/50 text-xs mt-2">Preview any operative skin without another player. This shows the current in-game soldier's blocky proportions, body palette, visor and armor; weapon geometry and combat animations are simplified. Bots use the same in-match humanoid model and can spawn with different operative skins. Previewing does not unlock or equip a skin.</p>
  </section>;
}
