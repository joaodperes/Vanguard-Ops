import { describe, test, expect } from "bun:test";
import { roomMapCandidates, roomTeamSizeForMap, winningRoomMap, roomInviteUrl } from "../src/lib/room-flow";
import { MAP_LIST, mapAllowedForMode, teamSizeAllowed, roomCapacity, type GameMode, type RoomSummary } from "../src/lib/game-protocol";
const summary = (extra: Partial<RoomSummary> = {}): RoomSummary => ({ id:"open",name:"Room",hostName:"Host",mode:"tdm",mapId:"compound",mapName:"Compound",teamSize:3,fillWithBots:true,hasPassword:false,humans:1,capacity:6,hasStarted:false,state:"lobby",createdAt:1,...extra });
describe("room flow", () => {
  test("alternative arenas support the room mode and capacity", () => {
    for(const mode of ["ffa","tdm","killconfirmed","ctf","survival","gungame"] as GameMode[]) {
      for(const map of MAP_LIST.filter(m=>mapAllowedForMode(mode,m.id))) {
        const requiredCapacity=roomCapacity(mode,7,1);
        const candidates=roomMapCandidates(mode,map.id,7,0,undefined,requiredCapacity,1);
        expect(candidates[0]).toBe(map.id); expect(new Set(candidates).size).toBe(candidates.length);
        for(const id of candidates.slice(1)) {
          expect(mapAllowedForMode(mode,id)).toBe(true);
          const size=roomTeamSizeForMap(mode,id,7,requiredCapacity,1);
          expect(size).toBeDefined(); expect(teamSizeAllowed(id,size!,mode)).toBe(true);
          expect(roomCapacity(mode,size!,1)).toBeGreaterThanOrEqual(requiredCapacity);
        }
      }
    }
  });
  test("Emberhold still offers two alternatives when its configured team size is map-specific",()=>{
    const candidates=roomMapCandidates("tdm","emberhold",12,0,undefined,1);
    expect(candidates).toHaveLength(3); expect(candidates[0]).toBe("emberhold");
    for(const id of candidates.slice(1)){
      const size=roomTeamSizeForMap("tdm",id,12,1);
      expect(size).toBeDefined(); expect(teamSizeAllowed(id,size!,"tdm")).toBe(true);
    }
    expect(roomMapCandidates("survival","emberhold",7,0,undefined,1,1)).toHaveLength(3);
    expect(roomMapCandidates("survival","emberhold",7,0,"keep_secrets")).toEqual(["emberhold"]);
  });
  test("one changeable vote per human; departed humans and invalid maps do not count; ties keep rematch",()=>{
    const candidates=["compound","skybridge","shipyard"] as const;
    const votes={a:"skybridge",b:"compound",departed:"shipyard"} as const;
    expect(winningRoomMap(candidates,votes,["a","b"])).toBe("compound");
    expect(winningRoomMap(candidates,{...votes,b:"skybridge"},["a","b"])).toBe("skybridge");
    expect(winningRoomMap(candidates,{},["a"])).toBe("compound");
    expect(winningRoomMap(candidates,{a:"bunker"},["a"])).toBe("compound");
  });
  test("invite links preserve deployments and omit passwords",()=>{
    const url=new URL(roomInviteUrl("https://example.org/game?foo=bar&password=secret#play","match_123"));
    expect(url.pathname).toBe("/game"); expect(url.searchParams.get("room")).toBe("match_123");
    expect(url.searchParams.get("foo")).toBe("bar"); expect(url.hash).toBe(""); expect(url.searchParams.has("password")).toBe(false);
  });
});
