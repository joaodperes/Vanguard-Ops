import { describe, expect, test } from "bun:test";
import { getMap, type CoverBox, type MapDef, type Vec3 } from "../src/lib/game-protocol";
import { makeEnvironmentMap } from "../src/lib/dynamic-environment";
import { traceCoverPenetration, selectMaterialPenetrationHits } from "../src/lib/cover-penetration";
import { authoredBallisticCover, coverMaxIntegrity, damageBallisticCoverOnShot,
  applyConfirmedCoverImpact, reconcileBallisticCover } from "../src/lib/material-cover-damage";
import { featureBoxes } from "../src/lib/map-blueprints";

const o: Vec3 = [0,1.5,0], d: Vec3 = [0,0,1];
const panel=(id:string,material:CoverBox["material"],z=5,depth=.4):CoverBox=>({
  pos:[0,1.5,z],size:[3,1.5,depth/2],kind:"cover",material,ballisticId:id,
});
const arena=(...cover:CoverBox[]):MapDef=>({...getMap("bunker"),cover});
const state=()=>({hp:new Map<string,number>(),dead:new Set<string>()});

describe("per-match destructible ballistic cover",()=>{
  test("glass cracks, breaks, and opens the bullet AND movement collider on the next shot",()=>{
    const map=arena(panel("pane","glass")),s=state();
    const first=damageBallisticCoverOnShot(map,s.hp,s.dead,o,d,20,0,16);
    expect(first).toHaveLength(1);
    expect(first[0].material).toBe("glass");
    expect(first[0].destroyed).toBe(false);
    expect(first[0].hp).toBeGreaterThan(0);
    const shotHitsBeforeBreak=selectMaterialPenetrationHits([{target:"enemy",t:8,head:false}],map.cover,o,d,20);
    expect(shotHitsBeforeBreak).toEqual([]);
    const breakingShotHits=selectMaterialPenetrationHits([{target:"enemy",t:8,head:false}],map.cover,o,d,20);
    const finish=damageBallisticCoverOnShot(map,s.hp,s.dead,o,d,20,0,16);
    expect(finish[0].destroyed).toBe(true);
    expect(s.dead.has("pane")).toBe(true);
    expect(map.cover.some(c=>c.ballisticId==="pane")).toBe(false);
    expect(breakingShotHits).toEqual([]); // the shot which broke it did not retroactively penetrate
    expect(selectMaterialPenetrationHits([{target:"enemy",t:8,head:false}],map.cover,o,d,20)
      .map(v=>v.target)).toEqual(["enemy"]);
  });

  test("wood and light cover require sustained impacts, sheet metal stays permanent",()=>{
    for(const material of ["thin_wood","light_cover"] as const){
      const map=arena(panel("obstacle",material)),s=state();
      const hp=coverMaxIntegrity(material)!;
      expect(hp).toBeGreaterThan(50);
      const one=damageBallisticCoverOnShot(map,s.hp,s.dead,o,d,20,0,20)[0];
      expect(one.hp).toBeGreaterThan(0);
      for(let i=0;i<20&&!s.dead.has("obstacle");i++)
        damageBallisticCoverOnShot(map,s.hp,s.dead,o,d,20,0,20);
      expect(s.dead.has("obstacle")).toBe(true);
    }
    const metal=arena(panel("rail","sheet_metal")),s=state();
    for(let i=0;i<25;i++){
      const evt=damageBallisticCoverOnShot(metal,s.hp,s.dead,o,d,20,0,150)[0];
      expect(evt).toMatchObject({material:"sheet_metal",hp:null,destroyed:false});
    }
    expect(metal.cover.some(c=>c.ballisticId==="rail")).toBe(true);
    expect(s.dead.size).toBe(0);
  });

  test("structural cover stays solid and can't be damaged even with huge rounds",()=>{
    const map=arena(panel("block","concrete"),panel("shield","reinforced",9),
      {...panel("fake","glass",12),kind:"solid"}),s=state();
    for(let i=0;i<50;i++)expect(damageBallisticCoverOnShot(map,s.hp,s.dead,o,d,30,100,100)).toEqual([]);
    expect(map.cover).toHaveLength(3);
  });

  test("crossed surfaces receive hits, but no impacts travel beyond a blocking wall",()=>{
    const map=arena(panel("glass","glass",3),panel("wood","thin_wood",6),panel("rear","glass",9)),s=state();
    const hits=damageBallisticCoverOnShot(map,s.hp,s.dead,o,d,20,1,10);
    expect(hits.map(i=>i.coverId)).toEqual(["glass","wood"]); // energy is spent at wood
    expect(s.hp.has("rear")).toBe(false);
    const onlyFront=damageBallisticCoverOnShot(arena(panel("first","glass",4)),new Map(),new Set(),o,d,20,3,10,2);
    expect(onlyFront).toHaveLength(0); // bullet absorbed by a body before the pane
  });

  test("per-room destruction does not modify the global map or other games",()=>{
    const template=getMap("orbital_nexus");
    const left=makeEnvironmentMap(template),right=makeEnvironmentMap(template);
    const pane=authoredBallisticCover(left.cover).find(b=>b.material==="glass")!;
    expect(pane.ballisticId).toBeTruthy();
    const s=state();
    const origin:Vec3=[pane.pos[0]-pane.size[0]-4,pane.pos[1],pane.pos[2]];
    const dir:Vec3=[1,0,0];
    damageBallisticCoverOnShot(left,s.hp,s.dead,origin,dir,10,0,100);
    expect(left.cover.some(b=>b.ballisticId===pane.ballisticId)).toBe(false);
    expect(right.cover.some(b=>b.ballisticId===pane.ballisticId)).toBe(true);
    expect(template.cover.some(b=>b.ballisticId===pane.ballisticId)).toBe(true);
  });

  test("a late joiner reconstructs destroyed cover from snapshots idempotently",()=>{
    const map=arena(panel("pane","glass"),panel("barrier","thin_wood",8)),s=state();
    expect(reconcileBallisticCover(map,s.hp,s.dead,["pane"],{pane:0,barrier:50})).toEqual(["pane"]);
    expect(s.hp.get("barrier")).toBe(50);
    expect(reconcileBallisticCover(map,s.hp,s.dead,["pane"],{pane:0})).toEqual([]);
    expect(applyConfirmedCoverImpact(map,s.hp,s.dead,{
      coverId:"barrier",material:"thin_wood",point:[0,1.5,7.8],hp:0,destroyed:true,
    })).toBe(true);
    expect(map.cover).toHaveLength(0);
    expect(traceCoverPenetration(map.cover,o,d,20,0).blockedAt).toBe(Infinity);
  });

  test("all currently authored panels have stable network IDs",()=>{
    const ids=["bunker","shipyard","skybridge","orbital_nexus","floodgate"];
    let total=0;
    for(const id of ids){
      const covered=authoredBallisticCover(getMap(id).cover);
      expect(new Set(covered.map(c=>c.ballisticId)).size).toBe(covered.length);
      expect(covered.length).toBeGreaterThan(0);
      total+=covered.length;
    }
    expect(total).toBe(19);
    const object=featureBoxes({id:"new-panel",kind:"cover",material:"glass",x:0,y:0,z:0,w:5,h:2,d:1})[0];
    expect(object.ballisticId).toBe("new-panel");
  });
});
