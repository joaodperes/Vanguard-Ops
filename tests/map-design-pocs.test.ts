import {describe,expect,test} from "bun:test";
import {MAPS} from "../src/lib/game-protocol";
import {
  FOREST_CANOPY_COVER,FOREST_CANOPY_OBSTACLES,FOREST_CANOPY_SUPPORTS,
  FOREST_TREE_DECKS,FOREST_TREE_STAIRS,
} from "../src/lib/forest-warfare";
import {MAP_DOCUMENTS,validateMapDocument} from "../src/lib/map-documents";

function rectanglesTouch(a:{pos:number[];size:number[]},b:{pos:number[];size:number[]}):boolean {
  const dx=Math.max(0,Math.abs(a.pos[0]-b.pos[0])-a.size[0]-b.size[0]);
  const dz=Math.max(0,Math.abs(a.pos[2]-b.pos[2])-a.size[2]-b.size[2]);
  return dx<=.025&&dz<=.025;
}

describe("Forest Warfare and Breakwater route-design PoCs",()=>{
  test("all authored stairs use thin treads rather than solid rising wedges",()=>{
    const forest=FOREST_TREE_STAIRS;
    const breakwater=MAPS.shipyard.cover.filter(c=>c.kind==="stair");
    expect(forest.length).toBeGreaterThan(80);
    expect(breakwater.length).toBeGreaterThan(40);
    for(const tread of [...forest,...breakwater])expect(tread.size[1]).toBeLessThanOrEqual(.091);
  });

  test("Forest canopy bridges form one connected, branching route network",()=>{
    const platforms=FOREST_CANOPY_COVER;
    const reached=new Set<number>([0]),queue=[0];
    while(queue.length){
      const current=queue.shift()!;
      for(let i=0;i<platforms.length;i++){
        if(reached.has(i)||!rectanglesTouch(platforms[current],platforms[i]))continue;
        reached.add(i);queue.push(i);
      }
    }
    expect(reached.size).toBe(platforms.length);
    expect(platforms.length).toBeGreaterThanOrEqual(12);
    expect(FOREST_CANOPY_OBSTACLES.length).toBeGreaterThanOrEqual(6);
    expect(FOREST_CANOPY_SUPPORTS.length).toBeGreaterThanOrEqual(3);
  });

  test("Forest tree-deck collision covers the central playable disk",()=>{
    for(const centreX of [-94,94])for(let x=-12;x<=12;x+=.5)for(let z=-12;z<=12;z+=.5){
      if(x*x+z*z>12*12)continue;
      expect(FOREST_TREE_DECKS.some(box=>
        Math.abs(centreX+x-box.pos[0])<=box.size[0]&&Math.abs(z-box.pos[2])<=box.size[2]
      ),`unsupported treetop point ${centreX+x},${z}`).toBe(true);
    }
  });

  test("Breakwater document validates and includes authored freight/climb routes",()=>{
    expect(validateMapDocument(MAP_DOCUMENTS.shipyard)).toEqual([]);
    const map=MAPS.shipyard;
    const containers=map.props?.filter(p=>p.kind==="container")??[];
    expect(containers.length).toBeGreaterThanOrEqual(10);
    expect(containers.some(p=>(p.y??0)>=3.2)).toBe(true);
    expect(map.cover.filter(c=>c.kind==="stair").length).toBeGreaterThan(40);
    // Lower and stacked container colliders align with their visible model bases.
    expect(map.cover.some(c=>c.kind==="cover"&&Math.abs(c.pos[0]-62)<.1&&Math.abs(c.pos[2]-38)<.1&&Math.abs(c.pos[1]-1.6)<.1)).toBe(true);
    expect(map.cover.some(c=>c.kind==="cover"&&Math.abs(c.pos[0]-62)<.1&&Math.abs(c.pos[2]-38)<.1&&Math.abs(c.pos[1]-4.8)<.1)).toBe(true);
    // The playable edge is now a proper wall, not a jumpable half-height lip.
    expect(map.cover.some(c=>c.kind==="solid"&&c.size[1]>=2.4)).toBe(true);
  });
});
