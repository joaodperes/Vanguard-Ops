import {describe,expect,test} from "bun:test";
import {MAP_LIST} from "../src/lib/game-protocol";
import {MAP_BLUEPRINTS} from "../src/lib/map-blueprints";
import {makeEnvironmentMap} from "../src/lib/dynamic-environment";
import {
  FLOODGATE_SURGE_SECONDS,floodgateSurgeFront,floodgateWaterEffect,
  floodgateRouteNeedsDetour,
} from "../src/lib/map-battle-events";
import {
  FLOODGATE_FREIGHT,FLOODGATE_TOPPLE_SECONDS,freightContactAge,
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

  test("bot route planning detects water, but never penalizes elevated access",()=>{
    expect(floodgateRouteNeedsDetour([0,0,-95],[0,0,-40],30)).toBe(true);
    expect(floodgateRouteNeedsDetour([140,0,-95],[140,0,-40],30)).toBe(false);
    expect(floodgateRouteNeedsDetour([0,4,-95],[0,4,-40],30)).toBe(false);
    expect(floodgateRouteNeedsDetour([0,0,-95],[0,0,-40],null)).toBe(false);
  });
});
