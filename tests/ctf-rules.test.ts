import { describe, expect, test } from "bun:test";
import { createCtfFlags, ctfBase, ctfHome, ctfDrop, ctfTouch } from "../src/lib/ctf-rules";
import { getMap, mapAllowedForMode } from "../src/lib/game-protocol";

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
});
