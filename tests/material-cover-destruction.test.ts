import { describe, expect, test } from "bun:test";
import { getMap, type CoverBox, type MapDef, type Vec3 } from "../src/lib/game-protocol";
import { makeEnvironmentMap } from "../src/lib/dynamic-environment";
import { traceCoverPenetration, selectMaterialPenetrationHits } from "../src/lib/cover-penetration";
import { authoredBallisticCover, coverMaxIntegrity, damageBallisticCoverOnShot,
  applyConfirmedCoverImpact, reconcileBallisticCover, damageBallisticCoverFromExplosion,
  materialCoverBlastProfile } from "../src/lib/material-cover-damage";
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
    const first=damageBallisticCoverOnShot(map,s.hp,s.dead,o,d,20,0,40);
    expect(first).toHaveLength(1);
    expect(first[0].material).toBe("glass");
    expect(first[0].destroyed).toBe(false);
    expect(first[0].hp).toBeGreaterThan(0);
    const shotHitsBeforeBreak=selectMaterialPenetrationHits([{target:"enemy",t:8,head:false}],map.cover,o,d,20);
    expect(shotHitsBeforeBreak).toEqual([]);
    const breakingShotHits=selectMaterialPenetrationHits([{target:"enemy",t:8,head:false}],map.cover,o,d,20);
    const finish=damageBallisticCoverOnShot(map,s.hp,s.dead,o,d,20,0,40);
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
    const hits=damageBallisticCoverOnShot(map,s.hp,s.dead,o,d,20,.3,10);
    expect(hits.map(i=>i.coverId)).toEqual(["glass","wood"]); // wood absorbs the remaining energy
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


  test("frag shatters nearby glass and wood while light cover needs sustained blast",()=>{
    const map=arena(panel("pane","glass",3),panel("plank","thin_wood",6),
      panel("crate","light_cover",8)),s=state();
    const origin:Vec3=[0,1.5,4.8];
    const impacts=damageBallisticCoverFromExplosion(map,s.hp,s.dead,origin,6,140);
    expect(impacts.map(i=>i.coverId)).toEqual(["pane","plank","crate"]);
    expect(impacts.map(i=>i.destroyed)).toEqual([true,true,false]);
    expect(map.cover.map(i=>i.ballisticId)).toEqual(["crate"]);
    const next=damageBallisticCoverFromExplosion(map,s.hp,s.dead,origin,6,140);
    expect(next.map(i=>i.coverId)).toEqual(["crate"]);
    expect(next[0].destroyed).toBe(true);
    expect(map.cover).toHaveLength(0);
  });

  test("a wide window takes near-face damage, but high and distant cover does not",()=>{
    const wide=panel("wide","glass",5);wide.pos=[50,1.5,5];wide.size=[50,1,.2];
    const high=panel("high","glass",4);high.pos=[0,15,4];
    const map=arena(wide,high,panel("far","glass",30)),s=state();
    const impacts=damageBallisticCoverFromExplosion(map,s.hp,s.dead,[0,1.5,4],4,100);
    expect(impacts.map(i=>i.coverId)).toEqual(["wide"]);
    expect(impacts[0].point[0]).toBe(0);
    expect(map.cover.map(i=>i.ballisticId)).toEqual(["high","far"]);
  });

  test("concrete, reinforced cover and sheet metal protect panels behind them",()=>{
    const wall:CoverBox={pos:[0,1.5,5],size:[4,3,.4],kind:"solid",material:"concrete"};
    const map=arena(panel("metal","sheet_metal",3),wall,panel("rear","glass",8)),s=state();
    expect(damageBallisticCoverFromExplosion(map,s.hp,s.dead,[0,1.5,1],12,200)).toEqual([]);
    expect(map.cover).toHaveLength(3);
    expect(s.dead.size).toBe(0);
    const reinforced=arena(panel("structural","reinforced",3),panel("rear","glass",8));
    const s2=state();
    expect(damageBallisticCoverFromExplosion(reinforced,s2.hp,s2.dead,[0,1.5,1],12,200)).toEqual([]);
  });

  test("thin cover passes blast pressure; each explosion is resolved once",()=>{
    const map=arena(panel("front","glass",4),panel("back","thin_wood",6)),s=state();
    const impacts=damageBallisticCoverFromExplosion(map,s.hp,s.dead,[0,1.5,3],6,160);
    expect(impacts.map(i=>i.coverId)).toEqual(["front","back"]);
    expect(impacts.every(i=>i.destroyed)).toBe(true);
    expect(map.cover).toHaveLength(0);
    expect(damageBallisticCoverFromExplosion(map,s.hp,s.dead,[0,1.5,3],6,160)).toEqual([]);
    expect(damageBallisticCoverFromExplosion(map,s.hp,s.dead,[0,1.5,3],0,160)).toEqual([]);
    expect(damageBallisticCoverFromExplosion(map,s.hp,s.dead,[0,1.5,3],6,NaN)).toEqual([]);
  });


  test("frag breaks light cover in one close blast, without turning its entire fragmentation radius into demolition",()=>{
    const near=arena(panel("near","light_cover",5)),nearState=state();
    const frag=materialCoverBlastProfile("frag",140,12);
    expect(frag).toEqual({damage:196,radius:6});
    const hit=damageBallisticCoverFromExplosion(near,nearState.hp,nearState.dead,[0,1.5,4.5],12,140,"frag");
    expect(hit).toHaveLength(1);
    expect(hit[0].destroyed).toBe(true);
    const far=arena(panel("far","light_cover",5)),farState=state();
    const distant=damageBallisticCoverFromExplosion(far,farState.hp,farState.dead,[0,1.5,-4],12,140,"frag");
    expect(distant).toEqual([]);
    expect(farState.dead.size).toBe(0);
  });

  test("RL-7 tears down light cover on direct impact; Swarm-3 takes three direct micro-rocket hits",()=>{
    const origin:Vec3=[0,1.5,4.8];
    const rl=arena(panel("rl","light_cover")),rlState=state();
    const single=damageBallisticCoverFromExplosion(rl,rlState.hp,rlState.dead,origin,1.9,176,"launcher_rocket");
    expect(single).toHaveLength(1);
    expect(single[0].destroyed).toBe(true);
    expect(rl.cover).toHaveLength(0);
    const swarm=arena(panel("swarm","light_cover")),swarmState=state();
    const first=damageBallisticCoverFromExplosion(swarm,swarmState.hp,swarmState.dead,origin,9.5,52,"launcher_swarm");
    expect(first[0].destroyed).toBe(false);
    expect(first[0].hp).toBeGreaterThan(85);
    const second=damageBallisticCoverFromExplosion(swarm,swarmState.hp,swarmState.dead,origin,9.5,52,"launcher_swarm");
    expect(second[0].destroyed).toBe(false);
    const third=damageBallisticCoverFromExplosion(swarm,swarmState.hp,swarmState.dead,origin,9.5,52,"launcher_swarm");
    expect(third[0].destroyed).toBe(true);
    expect(swarm.cover).toHaveLength(0);
  });

  test("Breach-2 and proximity mines have different cover strength without altering combatant damage",()=>{
    const weapon=arena(panel("breach","light_cover")),weaponState=state();
    const mine=arena(panel("mine","light_cover")),mineState=state();
    const impact:Vec3=[0,1.5,4.8];
    const weak=damageBallisticCoverFromExplosion(weapon,weaponState.hp,weaponState.dead,impact,2.9,74,"launcher_breach");
    const trap=damageBallisticCoverFromExplosion(mine,mineState.hp,mineState.dead,impact,2.4,140,"mine");
    expect(weak[0].destroyed).toBe(false);
    expect(trap[0].destroyed).toBe(false);
    expect(trap[0].hp).toBeLessThan(weak[0].hp);
    expect(damageBallisticCoverFromExplosion(weapon,weaponState.hp,weaponState.dead,impact,2.9,74,"launcher_breach")[0].destroyed).toBe(true);
    expect(damageBallisticCoverFromExplosion(mine,mineState.hp,mineState.dead,impact,2.4,140,"mine")[0].destroyed).toBe(true);
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
