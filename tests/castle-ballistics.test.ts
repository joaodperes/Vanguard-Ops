import {describe,expect,test} from "bun:test";
import * as THREE from "three";
import {getMap,type MapDef,type Vec3} from "../src/lib/game-protocol";
import {castleBallisticId,castleSceneryBoxes,type CastleProp} from "../src/lib/castle-scenery";
import {buildCastleScenery} from "../src/lib/castle-prop-model";
import {mapPropBallisticId} from "../src/lib/map-visuals";
import {authoredBallisticCover,damageBallisticCoverOnShot} from "../src/lib/material-cover-damage";
import {traceCoverPenetration} from "../src/lib/cover-penetration";

const castle=getMap("emberhold");
const props=(castle.props??[]).filter(p=>p.kind.startsWith("castle_")) as CastleProp[];
const building=props.find(p=>p.kind==="castle_building"&&p.castleUse!=="infirmary");
if(!building)throw new Error("Emberhold must have a timber-decked building");
const timberRoof=castleSceneryBoxes(building)[6];

describe("Emberhold castle material and durability parity",()=>{
  test("stone keeps and masonry walls are protective; timber roofs carry stable ballistic identities",()=>{
    expect(timberRoof.material).toBe("thin_wood");
    expect(timberRoof.ballisticId).toBe(castleBallisticId(building,6));
    const wall=castleSceneryBoxes(building)[0];
    expect(wall.material).toBeUndefined();
    const origin:Vec3=[wall.pos[0],wall.pos[1],wall.pos[2]-wall.size[2]-2];
    expect(Number.isFinite(traceCoverPenetration([wall],origin,[0,0,1],10,20).blockedAt)).toBe(true);
    expect(castleSceneryBoxes(props.find(p=>p.kind==="castle_building"&&p.castleUse==="infirmary")??building)[6].kind).toBe("cover");
  });

  test("roof shots pierce with damage loss and repeatedly hitting timber eventually destroys it",()=>{
    const roof={...timberRoof};
    const origin:Vec3=[roof.pos[0],roof.pos[1]+roof.size[1]+2,roof.pos[2]];
    const dir:Vec3=[0,-1,0];
    const trace=traceCoverPenetration([roof],origin,dir,8,3);
    expect(trace.blockedAt).toBe(Infinity);
    expect(trace.crossings).toHaveLength(1);
    expect(trace.crossings[0].damageRetention).toBeLessThan(1);
    const gameMap:MapDef={...castle,cover:[roof]};
    const hp=new Map<string,number>(),destroyed=new Set<string>();
    for(let i=0;i<3;i++){
      const impacts=damageBallisticCoverOnShot(gameMap,hp,destroyed,origin,dir,8,3,42);
      expect(impacts).toHaveLength(1);
      expect(impacts[0].coverId).toBe(roof.ballisticId!);
      expect(impacts[0].destroyed).toBe(i===2);
    }
    expect(destroyed.has(roof.ballisticId!)).toBe(true);
    expect(gameMap.cover).toHaveLength(0);
    expect(traceCoverPenetration(gameMap.cover,origin,dir,8,0).blockedAt).toBe(Infinity);
  });

  test("all castle breakable colliders are present in the published map and uniquely addressable",()=>{
    const expected=props.flatMap(p=>castleSceneryBoxes(p).filter(c=>c.ballisticId));
    expect(expected.length).toBeGreaterThan(35);
    const ids=expected.map(box=>box.ballisticId!);
    expect(new Set(ids).size).toBe(ids.length);
    const compiled=authoredBallisticCover(castle.cover);
    const compiledIds=new Set(compiled.map(box=>box.ballisticId));
    for(const id of ids)expect(compiledIds.has(id)).toBe(true);
  });

  test("wooden furniture, market stalls, targets and barrels keep the correct materials",()=>{
    for(const p of props){
      const boxes=castleSceneryBoxes(p);
      if(p.kind==="castle_building"){
        expect(boxes.slice(0,6).every(b=>!b.ballisticId)).toBe(true);
        expect(boxes.slice(7).some(b=>b.material==="thin_wood")).toBe(true);
      }
      if(["castle_cart","castle_target","castle_barrel"].includes(p.kind))
        expect(boxes[0].material).toBe("thin_wood");
      if(p.kind==="castle_stall"){
        expect(boxes[4].material).toBe("thin_wood");
        expect(boxes[5].material).toBe("light_cover");
      }
      if(p.kind==="castle_well"||p.kind==="castle_brazier")
        expect(boxes.every(b=>!b.ballisticId)).toBe(true);
    }
  });

  test("Afterlight's wooden benches also inherit the shared ballistic and durability rules",()=>{
    for(const id of ["terminal","arena_neon"] as const){
      const map=getMap(id);
      const benches=(map.props??[]).filter(p=>p.kind==="bench");
      expect(benches.length).toBeGreaterThan(0);
      for(const bench of benches){
        const cover=map.cover.find(c=>c.ballisticId===mapPropBallisticId(bench));
        expect(cover?.kind).toBe("cover");
        expect(cover?.material).toBe("thin_wood");
      }
    }
  });

  test("every destructible castle part has an individually hideable visual group",()=>{
    for(const p of props){
      const visual=new THREE.Group();
      buildCastleScenery(visual,p);
      const visualIds=new Set<string>();
      visual.traverse(node=>{
        if(typeof node.userData.ballisticId==="string")visualIds.add(node.userData.ballisticId);
      });
      for(const box of castleSceneryBoxes(p)){
        if(box.ballisticId)expect(visualIds.has(box.ballisticId)).toBe(true);
      }
    }
  });
});
