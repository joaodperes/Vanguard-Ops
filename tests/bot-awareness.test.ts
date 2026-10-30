import {describe,expect,test} from "bun:test";
import {botRememberSighting,botInvestigation,botMemoryDuration} from "../src/lib/bot-awareness";

describe("bot last-seen memory (offline and online shared)",()=>{
  test("copies sightings instead of tracking hidden enemies by reference",()=>{
    const position:[number,number,number]=[9,0,7];
    const seen=botRememberSighting("player",position,1000);
    position[0]=99;position[2]=-77;
    expect(seen.lastSeen).toEqual([9,0,7]);
    expect(botInvestigation(seen,[0,0,0],1300,"normal","rusher",true,"bot")?.goal).toEqual([9,0,7]);
  });
  test("memory expires by difficulty, never persists indefinitely",()=>{
    const seen=botRememberSighting("player",[20,0,0],1000);
    expect(botMemoryDuration("veteran","rusher")).toBeGreaterThan(botMemoryDuration("normal","rusher"));
    expect(botMemoryDuration("normal","rusher")).toBeGreaterThan(botMemoryDuration("easy","rusher"));
    expect(botInvestigation(seen,[0,0,0],1100,"normal","rusher",true,"bot")).not.toBeNull();
    expect(botInvestigation(seen,[0,0,0],1001+botMemoryDuration("normal","rusher"),"normal","rusher",true,"bot")).toBeNull();
  });
  test("discards dead targets and future-dated stale sightings",()=>{
    const seen=botRememberSighting("enemy",[14,0,1],1000);
    expect(botInvestigation(seen,[0,0,0],1100,"hard","rifleman",false,"bot")).toBeNull();
    expect(botInvestigation(seen,[0,0,0],900,"hard","rifleman",true,"bot")).toBeNull();
  });
  test("search phase stays stable rather than ping-ponging between last-seen and search point",()=>{
    const seen=botRememberSighting("enemy",[12,0,0],1000);
    expect(botInvestigation(seen,[0,0,0],1100,"hard","rusher",true,"bot")?.kind).toBe("approach");
    const first=botInvestigation(seen,[12,0,1],1300,"hard","rusher",true,"bot");
    expect(first?.kind).toBe("search");
    expect(seen.searchStartedAt).toBe(1300);
    expect(botInvestigation(seen,first!.goal,1600,"hard","rusher",true,"bot")?.goal).toEqual(first?.goal);
  });
  test("marksmen observe the last sightline rather than charging around a blind corner",()=>{
    const seen=botRememberSighting("enemy",[35,2,13],1000);
    const action=botInvestigation(seen,[0,2,0],1400,"hard","marksman",true,"sniper");
    expect(action?.kind).toBe("watch");
    expect(action?.goal).toEqual([0,2,0]);
    expect(action?.lookAt).toEqual([35,2,13]);
    expect(seen.searchStartedAt).toBeUndefined();
  });
  test("squad bots use differing nearby search offsets without invented enemy movement",()=>{
    const seen=botRememberSighting("enemy",[10,0,12],1000);
    const one=botInvestigation({...seen},[10,0,12],1400,"veteran","rusher",true,"bot-1");
    const two=botInvestigation({...seen},[10,0,12],1400,"veteran","rusher",true,"bot-2");
    expect(one?.goal).not.toEqual(two?.goal);
    for(const action of [one,two]){
      expect(Math.hypot(action!.goal[0]-10,action!.goal[2]-12)).toBeLessThanOrEqual(4.001);
    }
  });
});
