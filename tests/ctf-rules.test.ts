import { describe, expect, test } from "bun:test";
import { createCtfFlags, ctfBase, ctfHome, ctfDrop, ctfTouch, ctfReturnExpired, CTF_DROP_RETURN_MS, ctfBotGoal, CTF_TREE_X, CTF_TREE_TOP } from "../src/lib/ctf-rules";
import { getMap, mapAllowedForMode } from "../src/lib/game-protocol";
import { FOREST_TREE_STAIRS, FOREST_TREE_DECKS, FOREST_PERIMETER, FOREST_REGIONS } from "../src/lib/forest-warfare";
import { botGroundHeight, botPositionEmbedded, BOT_STEP_HEIGHT } from "../src/lib/bot-physics";
import { insideRegions } from "../src/lib/map-blueprints";

describe("Capture the Flag objective rules", () => {
  test("Forest Warfare is the only CTF map and is exclusive", () => {
    expect(mapAllowedForMode("ctf", "forest_warfare")).toBe(true);
    expect(mapAllowedForMode("ctf", "compound")).toBe(false);
    expect(mapAllowedForMode("tdm", "forest_warfare")).toBe(false);
    expect(getMap("forest_warfare").spawns.red.length).toBeGreaterThan(0);
    expect(getMap("forest_warfare").spawns.blue.length).toBeGreaterThan(0);
  });

  test("pickup needs a player from the other team on the treetop", () => {
    const flags=createCtfFlags();
    expect(ctfTouch(flags,{id:"red-defender",team:"red",pos:ctfHome("red")})).toBeNull();
    expect(ctfTouch(flags,{id:"blue-raider",team:"blue",pos:ctfHome("red")})).toEqual({kind:"pickup",flag:"red"});
    expect(flags.red.carrierId).toBe("blue-raider");
    expect(flags.red.dropped).toBe(false);
  });

  test("carrier drops on death, owner returns and enemy can reclaim", () => {
    const flags=createCtfFlags();
    ctfTouch(flags,{id:"red-raider",team:"red",pos:ctfHome("blue")});
    expect(ctfDrop(flags,"red-raider",[5,0,7])).toBe("blue");
    expect(flags.blue.dropped).toBe(true);
    expect(ctfTouch(flags,{id:"red-wing",team:"red",pos:[5,0,7]})).toEqual({kind:"pickup",flag:"blue"});
    expect(ctfDrop(flags,"red-wing",[12,0,3])).toBe("blue");
    expect(ctfTouch(flags,{id:"blue-defender",team:"blue",pos:[12,0,3]})).toEqual({kind:"return",flag:"blue"});
    expect(flags.blue).toEqual({team:"blue",pos:ctfHome("blue"),carrierId:null,dropped:false});
  });

  test("captures occur at team base only with own flag safely home", () => {
    const flags=createCtfFlags();
    ctfTouch(flags,{id:"red-raider",team:"red",pos:ctfHome("blue")});
    expect(ctfTouch(flags,{id:"red-raider",team:"red",pos:[0,0,0]})).toBeNull();
    ctfTouch(flags,{id:"blue-raider",team:"blue",pos:ctfHome("red")});
    expect(ctfTouch(flags,{id:"red-raider",team:"red",pos:ctfBase("red")})).toBeNull();
    ctfDrop(flags,"blue-raider",[4,0,5]);
    expect(ctfTouch(flags,{id:"red-defender",team:"red",pos:[4,0,5]})).toEqual({kind:"return",flag:"red"});
    expect(ctfTouch(flags,{id:"red-raider",team:"red",pos:ctfBase("red")})).toEqual({kind:"capture",flag:"blue"});
    expect(flags.blue).toEqual({team:"blue",pos:ctfHome("blue"),carrierId:null,dropped:false});
  });
  test("dropped flags return after 30 seconds, not prematurely", () => {
    const flags = createCtfFlags();
    ctfTouch(flags,{id:"raider",team:"blue",pos:ctfHome("red")});
    expect(ctfDrop(flags,"raider",[1,0,2],10_000)).toBe("red");
    expect(ctfReturnExpired(flags,10_000+CTF_DROP_RETURN_MS-1)).toEqual([]);
    expect(flags.red.dropped).toBe(true);
    expect(ctfReturnExpired(flags,10_000+CTF_DROP_RETURN_MS)).toEqual(["red"]);
    expect(flags.red).toEqual({team:"red",pos:ctfHome("red"),carrierId:null,dropped:false});
    expect(ctfReturnExpired(flags,10_000+CTF_DROP_RETURN_MS+5000)).toEqual([]);
  });

  test("tree platforms are wide, separated and have climbable shared collision", () => {
    expect(CTF_TREE_X*2).toBeGreaterThan(160);
    expect(CTF_TREE_TOP).toBeGreaterThanOrEqual(10);
    const cover=getMap("forest_warfare").cover;
    for (const side of [-1,1]) {
      const x=side*CTF_TREE_X;
      expect(FOREST_TREE_DECKS.some(c=>c.pos[0]===x && c.size[0]>=11)).toBe(true);
      for(const approach of [-1,1]) {
        const stairs=FOREST_TREE_STAIRS.filter(c=>c.pos[0]===x && Math.sign(c.pos[2])===approach)
          .sort((a,b)=>a.pos[1]-b.pos[1]);
        expect(stairs.length).toBe(24);
        let feetY=0;
        for(const stair of stairs) {
          const next=botGroundHeight(cover,stair.pos[0],stair.pos[2],feetY);
          expect(next-feetY).toBeGreaterThanOrEqual(0);
          expect(next-feetY).toBeLessThanOrEqual(BOT_STEP_HEIGHT+0.001);
          expect(next).toBeGreaterThan(feetY);
          feetY=next;
        }
        expect(feetY).toBeCloseTo(CTF_TREE_TOP);
        expect(botGroundHeight(cover,x,approach*10,feetY)).toBeCloseTo(CTF_TREE_TOP);
      }
    }
  });

  test("woodland corridor and both tree approaches sit on visible floor regions", () => {
    const forest=getMap("forest_warfare");
    expect(forest.regions).toEqual(FOREST_REGIONS);
    expect(FOREST_PERIMETER.length).toBeGreaterThan(4);
    for(let x=-108;x<=108;x+=6) for(let z=-40;z<=40;z+=8)
      expect(insideRegions(x,z,forest.regions!)).toBe(true);
    for(const team of ["red","blue"] as const) for(const point of forest.spawns[team]) {
      expect(insideRegions(point[0],point[2],forest.regions!)).toBe(true);
      expect(botPositionEmbedded(forest.cover,point)).toBe(false);
    }
  });

  test("CTF objective bots target staircase entry then the raised flag", () => {
    const flags=createCtfFlags();
    expect(ctfBotGoal(flags,"red","r",[-30,0,-6])).toEqual([CTF_TREE_X,0,-34.5]);
    expect(ctfBotGoal(flags,"red","r",[CTF_TREE_X,0,-32])).toEqual([CTF_TREE_X,CTF_TREE_TOP,-8.7]);
    expect(ctfBotGoal(flags,"red","r",[CTF_TREE_X,CTF_TREE_TOP,-8])).toEqual(ctfHome("blue"));
    ctfTouch(flags,{id:"r",team:"red",pos:ctfHome("blue")});
    expect(ctfBotGoal(flags,"red","r",[CTF_TREE_X,CTF_TREE_TOP,0])).toEqual(ctfBase("red"));
  });

});
