import {describe,expect,test} from "bun:test";
import * as THREE from "three";
import {WONDER_FINISHES,WONDER_KILL_EFFECTS,wonderFinishesFor,wonderKillEffectsFor} from "../src/lib/wonder-expansion";
import {createWonderKillVisual,createWonderFinishTexture,updateWonderFinishTexture,wonderFinishVisualKinds} from "../src/lib/wonder-cosmetic-visuals";
import {WEAPONS} from "../src/lib/game-data";

describe("Wonder cosmetic rendering",()=>{
  const active=WEAPONS.filter(w=>w.wonder&&!w.disabled);

  test("every available finish uses a distinct supported procedural theme",()=>{
    expect(WONDER_FINISHES.length).toBe(19);
    expect(new Set(Object.values(wonderFinishVisualKinds)).size).toBe(WONDER_FINISHES.length);
    for(const finish of WONDER_FINISHES){
      expect(wonderFinishVisualKinds[finish.id]).toBeDefined();
    }
    for(const weapon of active){
      expect(wonderFinishesFor(weapon.id).length).toBe(4);
      expect(wonderKillEffectsFor(weapon.id).length).toBe(4);
    }
    // Headless runs must never try to create a browser canvas.
    if(typeof document==="undefined")expect(createWonderFinishTexture(WONDER_FINISHES[0].id)).toBeNull();
  });

  test("all kill effects produce bounded, instanced and disposable geometry",()=>{
    expect(WONDER_KILL_EFFECTS.length).toBe(19);
    for(const effect of WONDER_KILL_EFFECTS){
      const visual=createWonderKillVisual(effect.id,[1,2,3]);
      expect(visual).not.toBeNull();
      if(!visual)continue;
      expect(visual.group.position.toArray()).toEqual([1,2,3]);
      const meshes=visual.group.children as THREE.InstancedMesh[];
      expect(meshes.length).toBeGreaterThan(0);
      expect(meshes.length).toBeLessThanOrEqual(3);
      expect(meshes.every(m=>m.isInstancedMesh&&m.count<=32&&m.count>0)).toBe(true);
      const m0=meshes[0],before=new THREE.Matrix4(),after=new THREE.Matrix4();
      m0.getMatrixAt(0,before);
      visual.update(.58);
      m0.getMatrixAt(0,after);
      expect(after.equals(before)).toBe(false);
      visual.update(1);
      const disposed=new Set<THREE.BufferGeometry>();
      for(const m of meshes)m.geometry.addEventListener("dispose",()=>disposed.add(m.geometry));
      visual.dispose();
      expect(disposed.size).toBe(meshes.length);
    }
  });

  test("the exclusive effects have recognizable pattern differences",()=>{
    const examples=["wonder_kill_event_collapse","wonder_kill_ashes_to_ashes",
      "wonder_kill_chain_reaction","wonder_kill_digital_erasure"];
    const signatures=examples.map(id=>{
      const visual=createWonderKillVisual(id,[0,0,0])!;
      const signature=visual.group.children.map(o=>{
        const mesh=o as THREE.InstancedMesh;
        return `${mesh.geometry.type}:${mesh.count}`;
      }).join("|");
      visual.dispose();
      return signature;
    });
    expect(new Set(signatures).size).toBe(examples.length);
    expect(createWonderKillVisual("not-an-effect",[0,0,0])).toBeNull();
    const texture=new THREE.Texture();
    updateWonderFinishTexture(texture,"wonder_razorstorm",3);
    expect(texture.rotation).not.toBe(0);
    texture.dispose();
  });
});
