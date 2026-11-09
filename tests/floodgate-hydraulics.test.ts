import {describe,expect,test} from "bun:test";
import {MAP_LIST,PLAYER_HEIGHT,rayBox} from "../src/lib/game-protocol";
import {MAP_BLUEPRINTS} from "../src/lib/map-blueprints";
import {makeEnvironmentMap} from "../src/lib/dynamic-environment";
import {botGroundHeight,botMoveBlocked,botPositionEmbedded} from "../src/lib/bot-physics";
import {botTraversableEdge,botNextWaypoint,botFloodFallbackWaypoint} from "../src/lib/bot-routing";
import {
  FLOODGATE_SURGE_SECONDS,floodgateSurgeFront,floodgateWaterEffect,
  floodgateRouteNeedsDetour,
} from "../src/lib/map-battle-events";
import {
  FLOODGATE_FREIGHT,FLOODGATE_TOPPLE_SECONDS,FLOODGATE_ROOF_STEPS,FLOODGATE_ROOF_HEIGHT,freightContactAge,
  freightStage,setFloodgateFreightStage,
} from "../src/lib/floodgate-topple";

describe("Floodgate hydraulic progression",()=>{
  test("current is gentler, limited to the advancing front, and remains ground-only",()=>{
    expect(floodgateWaterEffect(0,0,-70,null).flooded).toBe(false);
    expect(floodgateWaterEffect(0,0,-70,1).flooded).toBe(false);
    const surgeAge=(-70+103)/(67)*FLOODGATE_SURGE_SECONDS;
    const surge=floodgateWaterEffect(0,0,-70,surgeAge);
    expect(surge.surge).toBe(true);
    expect(surge.pushZ).toBeLessThanOrEqual(10);
    expect(surge.speedMultiplier).toBeGreaterThanOrEqual(.5);
    const settled=floodgateWaterEffect(0,0,-70,30);
    expect(settled.flooded).toBe(true);
    expect(settled.pushZ).toBeLessThan(3);
    expect(floodgateWaterEffect(0,3.4,-70,30).flooded).toBe(false);
    // A jump through the wave is not ground contact.
    expect(floodgateWaterEffect(0,1.2,-70,30).flooded).toBe(false);
    expect(floodgateWaterEffect(140,0,-70,30).flooded).toBe(false);
  });

  test("stair treads remain immune while adjoining ground is flooded",()=>{
    const tread={pos:[0,.21,-70] as [number,number,number],
      size:[2,.21,1] as [number,number,number],kind:"stair" as const};
    expect(floodgateWaterEffect(0,.42,-70,30,[tread]).flooded).toBe(false);
    expect(floodgateWaterEffect(0,.42,-70,30,[tread]).pushZ).toBe(0);
    expect(floodgateWaterEffect(0,0,-70,30,[tread]).flooded).toBe(true);
    expect(floodgateWaterEffect(3,0,-70,30,[tread]).flooded).toBe(true);
    const shallow={pos:[0,.075,-70] as [number,number,number],
      size:[2,.075,1] as [number,number,number],kind:"stair" as const};
    expect(floodgateWaterEffect(0,.15,-70,30,[shallow]).flooded).toBe(false);
    expect(floodgateWaterEffect(0,0,-70,30,[shallow]).flooded).toBe(true);
  });

  test("water contacts each column before its collision and visual stages change",()=>{
    const base=MAP_LIST.find(m=>m.id==="floodgate")!;
    const map=makeEnvironmentMap(base);
    expect(map.cover.filter(c=>c.environmentId?.endsWith(":upright"))).toHaveLength(4);
    for(const pillar of FLOODGATE_FREIGHT){
      const at=freightContactAge(pillar);
      expect(at).toBeGreaterThan(0);
      expect(at).toBeLessThan(FLOODGATE_SURGE_SECONDS);
      expect(floodgateSurgeFront(at)).toBeCloseTo(pillar.z-1.4,5);
      expect(freightStage(at-.001,pillar)).toBe("upright");
      expect(freightStage(at,pillar)).toBe("falling");
      expect(freightStage(at+FLOODGATE_TOPPLE_SECONDS+.01,pillar)).toBe("fallen");
    }
    const contact=Math.min(...FLOODGATE_FREIGHT.map(freightContactAge));
    expect(setFloodgateFreightStage(map,contact-.01)).toBe(false);
    expect(setFloodgateFreightStage(map,contact+.01)).toBe(true);
    expect(map.cover.filter(c=>c.environmentId?.startsWith("floodgate-freight:"))).toHaveLength(0);
    expect(setFloodgateFreightStage(map,contact+FLOODGATE_TOPPLE_SECONDS+.01)).toBe(true);
    expect(map.cover.filter(c=>c.environmentId?.includes(":step-"))).toHaveLength(32);
    expect(map.cover.filter(c=>c.environmentId?.endsWith(":bridge"))).toHaveLength(4);
    expect(setFloodgateFreightStage(map,contact+FLOODGATE_TOPPLE_SECONDS+.2)).toBe(false);
  });

  test("post-flood pillars grant new access to four formerly stairless overlooks",()=>{
    const features=MAP_BLUEPRINTS.maps.floodgate.features;
    for(const [index,pillar] of FLOODGATE_FREIGHT.entries()){
      const deck=features.find(f=>f.id==="spillway-overlook-"+(index===0?2:index===1?3:index===2?1:4))!;
      expect(deck.kind).toBe("platform");
      expect(deck.autoStairs).toBe(false);
      expect(features.some(f=>f.id===deck.id+"-single-access")).toBe(false);
      const bridgeX=[pillar.x-4.15,pillar.x+4.15],deckX=[deck.x-deck.w/2,deck.x+deck.w/2];
      const bridgeZ=[-59.3-4.1,-59.3+4.1],deckZ=[deck.z-deck.d/2,deck.z+deck.d/2];
      expect(Math.min(bridgeX[1],deckX[1])-Math.max(bridgeX[0],deckX[0])).toBeGreaterThan(2);
      expect(Math.min(bridgeZ[1],deckZ[1])-Math.max(bridgeZ[0],deckZ[0])).toBeGreaterThan(0);
      expect(Math.abs(deck.h-3.36)).toBeLessThan(.1);
    }
  });

  test("freight routes physically ascend from overlook to central turbine roof",()=>{
    const map=makeEnvironmentMap(MAP_LIST.find(m=>m.id==="floodgate")!);
    setFloodgateFreightStage(map,30);
    for(const pillar of FLOODGATE_FREIGHT){
      const roof=map.cover.filter(c=>c.environmentId?.startsWith("floodgate-freight:"+pillar.id+":roof-step-"));
      expect(roof).toHaveLength(FLOODGATE_ROOF_STEPS);
      expect(Math.max(...roof.map(b=>b.pos[1]+b.size[1]))).toBeCloseTo(FLOODGATE_ROOF_HEIGHT);
      // The continuation is physical, so bots and players can actually climb it.
      expect(botTraversableEdge([pillar.x,3.4,-49],pillar.x,-27,map.cover)).toBeCloseTo(FLOODGATE_ROOF_HEIGHT);
    }
  });

  test("fallen roof stairs and bridge have real, shootable underpasses without losing climbable treads",()=>{
    const map=makeEnvironmentMap(MAP_LIST.find(m=>m.id==="floodgate")!);
    setFloodgateFreightStage(map,30);
    for(const pillar of FLOODGATE_FREIGHT){
      const prefix="floodgate-freight:"+pillar.id+":";
      const roof=map.cover.filter(c=>c.environmentId?.startsWith(prefix+"roof-step-"));
      const bridge=map.cover.find(c=>c.environmentId===prefix+"bridge")!;
      expect(roof).toHaveLength(FLOODGATE_ROOF_STEPS);
      expect(roof.every(c=>c.pos[1]-c.size[1]>PLAYER_HEIGHT)).toBe(true);
      // Player-height underpass across the middle of the high flight.
      const z=-39.5,from:[number,number,number]=[pillar.x-4,0,z];
      const to:[number,number,number]=[pillar.x+4,0,z];
      expect(botMoveBlocked(roof,from,to,0)).toBe(false);
      expect(botPositionEmbedded(roof,[pillar.x,0,z])).toBe(false);
      expect(botGroundHeight(roof,pillar.x,z,0)).toBe(0);
      expect(roof.some(c=>rayBox([pillar.x-5,1.6,z],[1,0,0],c.pos,c.size)!==null)).toBe(false);
      // The upper treads still collide with shots fired at deck height.
      const middle=roof[Math.floor(roof.length/2)];
      const top=middle.pos[1]+middle.size[1];
      expect(rayBox([pillar.x-5,top-.06,middle.pos[2]],[1,0,0],middle.pos,middle.size)).not.toBeNull();
      expect(botGroundHeight(roof,pillar.x,middle.pos[2],top-.25)).toBeCloseTo(top);
      // Bridge used to be a solid 3.36-high block despite rendering as sheet metal.
      expect(bridge.pos[1]-bridge.size[1]).toBeGreaterThan(PLAYER_HEIGHT);
      expect(botMoveBlocked([bridge],[pillar.x-5,0,-59.3],[pillar.x+5,0,-59.3],0)).toBe(false);
      expect(rayBox([pillar.x-5,1.6,-59.3],[1,0,0],bridge.pos,bridge.size)).toBeNull();
      // The lower fallen container body remains visibly solid, so its
      // corresponding low ramp is intentionally not an underpass.
      expect(map.cover.filter(c=>c.environmentId?.startsWith(prefix+"step-"))
        .every(c=>c.pos[1]-c.size[1]===0)).toBe(true);
    }
  });

  test("flood route fallback enters water instead of looping at its shoreline",()=>{
    const start:[number,number,number]=[0,0,-90],goal:[number,number,number]=[0,0,-45];
    const immediate=botFloodFallbackWaypoint(start,goal,[]);
    expect(immediate).not.toBeNull();
    expect(immediate![2]).toBeGreaterThan(start[2]);
    const fromLimitedSearch=botNextWaypoint(start,goal,[],176,3,[],[],undefined,1,30);
    expect(fromLimitedSearch).not.toBeNull();
    expect(fromLimitedSearch![2]).toBeGreaterThan(start[2]);
    const obstacle=[{pos:[0,2,-87],size:[3,2,1],kind:"cover" as const}];
    const detour=botFloodFallbackWaypoint(start,goal,obstacle);
    expect(detour===null || Math.abs(detour[0])>0).toBe(true);
  });

  test("bot route planning detects water, but never penalizes elevated access",()=>{
    expect(floodgateRouteNeedsDetour([0,0,-95],[0,0,-40],30)).toBe(true);
    expect(floodgateRouteNeedsDetour([140,0,-95],[140,0,-40],30)).toBe(false);
    expect(floodgateRouteNeedsDetour([0,4,-95],[0,4,-40],30)).toBe(false);
    expect(floodgateRouteNeedsDetour([0,0,-95],[0,0,-40],null)).toBe(false);
  });
});
