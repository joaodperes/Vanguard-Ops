import { describe, test, expect } from "bun:test";
import { roomMapCandidates, winningRoomMap, roomInviteUrl } from "../src/lib/room-flow";
import { MAP_LIST, mapAllowedForMode, teamSizeAllowed, type GameMode, type RoomSummary } from "../src/lib/game-protocol";
const summary = (extra: Partial<RoomSummary> = {}): RoomSummary => ({ id:"open",name:"Room",hostName:"Host",mode:"tdm",mapId:"compound",mapName:"Compound",teamSize:3,fillWithBots:true,hasPassword:false,humans:1,capacity:6,hasStarted:false,state:"lobby",createdAt:1,...extra });
describe("room flow", () => {
  test("alternative arenas support the room mode and capacity", () => {
    for(const mode of ["ffa","tdm","killconfirmed","ctf","survival","gungame"] as GameMode[]) {
      for(const map of MAP_LIST.filter(m=>mapAllowedForMode(mode,m.id))) {
        const candidates=roomMapCandidates(mode,map.id,7);
        expect(candidates[0]).toBe(map.id); expect(new Set(candidates).size).toBe(candidates.length);
        for(const id of candidates.slice(1)) { expect(mapAllowedForMode(mode,id)).toBe(true); expect(teamSizeAllowed(id,7,mode)).toBe(true); }
      }
    }
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
