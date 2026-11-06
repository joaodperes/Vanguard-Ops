import { describe, expect, test } from "bun:test";
import { stairs, type CoverBox } from "../src/lib/game-protocol";
import { botNextWaypoint, botTraversableEdge } from "../src/lib/bot-routing";

describe("shared height-aware bot navigation", () => {
  test("ground can route under a genuinely overhead bridge", () => {
    const cover: CoverBox[] = [{ pos: [0,5,0], size: [2,0.3,2], kind: "platform" }];
    expect(botTraversableEdge([-4,0,0],4,0,cover)).toBe(0);
  });

  test("cannot climb a vertical wall higher than step reach", () => {
    const cover: CoverBox[] = [{ pos:[0,2,0],size:[2,2,2],kind:"cover" }];
    expect(botTraversableEdge([0,0,5],0,0,cover)).toBeNull();
  });

  test("can follow generated half-unit stairs to a second-story roof", () => {
    const cover: CoverBox[] = [
      { pos:[0,1,0],size:[2,1,4],kind:"platform" },
      ...stairs(0,4,2,4,3,4,"z",1),
    ];
    // Discrete route must discover a real stair path, not simply snap y=2.
    const waypoint = botNextWaypoint([0,0,10],[0,2,0],cover,25);
    expect(waypoint).not.toBeNull();
    expect(waypoint![0]).toBeGreaterThanOrEqual(-4);
    expect(waypoint![0]).toBeLessThanOrEqual(4);
  });

  test("substep sampling climbs narrow high-rise stair treads", () => {
    const cover: CoverBox[] = [
      { pos:[0,5,0], size:[2,5,3], kind:"platform" },
      ...stairs(0,3,10,20,3,6,"z",1),
    ];
    const height = botTraversableEdge([0,0,10],0,2.9,cover);
    expect(height).not.toBeNull();
    expect(height!).toBeGreaterThan(9.4);
  });

  test("blocks hazard edges instead of treating them as safe geometry", () => {
    const danger = [{ type:"fire", pos:[0,0,0], size:[1.5,1,1.5] }];
    expect(botTraversableEdge([-4,0,0],4,0,[],danger)).toBeNull();
    expect(botTraversableEdge([-4,0,5],4,5,[],danger)).toBe(0);
  });

  test("cannot take a magic step onto a roof without stairs", () => {
    const cover: CoverBox[] = [{ pos:[0,2.5,0],size:[3,2.5,3],kind:"platform" }];
    const reached = botNextWaypoint([0,0,12],[0,5,0],cover,25);
    // Either reject the unreachable upper level or yield a normal ground
    // waypoint; never claim the ground route itself is elevated.
    expect(reached === null || reached[1] < 2).toBe(true);
  });
});


describe("Emberhold Castle bot routes",()=>{
  const {getMap}=require("../src/lib/game-protocol") as typeof import("../src/lib/game-protocol");
  const {MAP_BLUEPRINTS,stairFeatureBoxes}=require("../src/lib/map-blueprints") as typeof import("../src/lib/map-blueprints");
  const {spawnClear}=require("../src/lib/spawn-selection") as typeof import("../src/lib/spawn-selection");
  const {castleDungeonEntrances,botMapRouteGoal}=require("../src/lib/bot-routing") as typeof import("../src/lib/bot-routing");
  const {chooseBotPatrolPoint,botPatrolDistance}=require("../src/lib/bot-patrol") as typeof import("../src/lib/bot-patrol");
  const map=getMap("emberhold"),entrances=castleDungeonEntrances();

  test("safe dungeon and battlement spawns with four physical entrances",()=>{
    expect(entrances.map(e=>e.id).sort()).toEqual(["chapel-stairs","donjon-crypt-stair","east-sally-stairs","west-sally-stairs"]);
    const dungeon=map.spawns.ffa.filter(p=>p[1]<2),battlement=map.spawns.ffa.filter(p=>p[1]>8);
    expect(dungeon.length).toBeGreaterThanOrEqual(8);
    expect(battlement.length).toBeGreaterThanOrEqual(2);
    for(const p of [...dungeon,...battlement])expect(spawnClear(map,p)).toBe(true);
  });

  test("patrols visit the dungeon, but underground bots deliberately return upstairs",()=>{
    const rng=(v:number)=>()=>v;
    expect(chooseBotPatrolPoint("ffa","ffa",[-40,5,0],[],[],map.spawns.ffa,rng(0),"emberhold")[1]).toBe(.5);
    expect(chooseBotPatrolPoint("ffa","ffa",[-40,.5,0],[],[],map.spawns.ffa,rng(0),"emberhold")[1]).toBe(5);
    expect(chooseBotPatrolPoint("ffa","ffa",[-40,5,0],[],[],map.spawns.ffa,rng(.4),"emberhold")[1]).toBe(12);
    expect(botPatrolDistance([-24,5,1],[-24,.5,1])).toBeGreaterThan(2.5);
  });

  for(const entrance of entrances){
    test(entrance.id+" has traversable ascending and descending treads",()=>{
      const f=MAP_BLUEPRINTS.maps.emberhold.features.find(f=>f.id===entrance.id)!;
      const steps=stairFeatureBoxes(f);
      expect(steps.length).toBeGreaterThan(10);
      for(const trip of [steps,[...steps].reverse()]){
        let position:[number,number,number]=[trip[0].pos[0],trip[0].pos[1]+trip[0].size[1],trip[0].pos[2]];
        for(const next of trip.slice(1)){
          const height=botTraversableEdge(position,next.pos[0],next.pos[2],map.cover);
          expect(height).not.toBeNull();
          position=[next.pos[0],height!,next.pos[2]];
        }
      }
      expect(botMapRouteGoal("emberhold",entrance.upper,entrance.lower)).toEqual(entrance.lower);
      expect(botMapRouteGoal("emberhold",entrance.lower,entrance.upper)).toEqual(entrance.upper);
    });
  }

  for(const e of entrances){
    test(e.id+" produces collision-valid A* steps at either end",()=>{
      for(const [from,to] of [[e.upper,e.lower],[e.lower,e.upper]] as const){
        const waypoint=botNextWaypoint(from,to,map.cover,map.size,3,map.environment,map.regions);
        expect(waypoint).not.toBeNull();
        expect(botTraversableEdge(from,waypoint![0],waypoint![2],map.cover,map.environment)).not.toBeNull();
      }
    });
  }

  test("central keep AI can follow successive A* steps between courtyard and crypt",()=>{
    const entrance=entrances.find(e=>e.id==="donjon-crypt-stair")!;
    for(const [initial,goal] of [[entrance.upper,entrance.lower],[entrance.lower,entrance.upper]] as const){
      let position:[number,number,number]=[...initial];
      const close=()=>Math.hypot(position[0]-goal[0],position[2]-goal[2])<2.5&&Math.abs(position[1]-goal[1])<1;
      for(let step=0;step<45&&!close();step++){
        const navigation=botMapRouteGoal("emberhold",position,goal);
        const next=botNextWaypoint(position,navigation,map.cover,map.size,3,map.environment,map.regions);
        if(!next)throw Error("Castle A* missing route at "+JSON.stringify(position));
        const height=botTraversableEdge(position,next[0],next[2],map.cover,map.environment);
        if(height===null)throw Error("Castle A* selected blocked edge at "+JSON.stringify(position));
        if(Math.hypot(position[0]-next[0],position[2]-next[2])<.1)throw Error("Castle A* stalled at "+JSON.stringify(position));
        position=[next[0],height,next[2]];
      }
      expect(close(), "failed to reach castle level at "+JSON.stringify(position)).toBe(true);
    }
  },30000);

  test("cross-floor targets stage at a real stair and other maps stay unchanged",()=>{
    const from:[number,number,number]=[40,5,20],goal:[number,number,number]=[-24,.5,1];
    const staged=botMapRouteGoal("emberhold",from,goal);
    expect(entrances.some(e=>e.upper.join(",")===staged.join(","))).toBe(true);
    expect(botMapRouteGoal("bunker",from,goal)).toEqual(goal);
  });
});
