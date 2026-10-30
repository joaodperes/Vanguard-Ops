import { describe, expect, test } from "bun:test";
import { matchHudInfo } from "../src/lib/match-hud";
import { roomCapacity, teamSizeAllowed, teamSizesForMap, isAfterlightCityMap, MAP_LIST } from "../src/lib/game-protocol";
import { getMap } from "../src/lib/game-protocol";
import { expandCitySpawnPositions } from "../src/lib/city-spawn-layout";

describe("Top-of-screen HUD identity and scoring", () => {
  test("every game mode displays its actual name, never an FFA fallback", () => {
    const expected = {
      ffa: ["Free-For-All", "FFA", false, "K", "D"],
      tdm: ["Team Deathmatch", "TDM", true, "K", "D"],
      killconfirmed: ["Kill Confirmed", "KC", true, "PTS", "DENIED"],
      ctf: ["Capture the Flag", "CTF", true, "CAP", "K"],
      gungame: ["Gun Game", "GG", false, "K", "D"],
      survival: ["Standard Survival · 30 Waves", "SURV", false, "K", "D"],
    } as const;
    for (const [mode, [title, short, teamBased, primary, secondary]] of Object.entries(expected)) {
      const hud = matchHudInfo(mode as keyof typeof expected);
      expect(hud.title).toBe(title);
      expect(hud.short).toBe(short);
      expect(hud.teamBased).toBe(teamBased);
      expect(hud.personalPrimary).toBe(primary);
      expect(hud.personalSecondary).toBe(secondary);
    }
    expect(matchHudInfo("ctf").teamObjective).toBe("CAPTURES");
    expect(matchHudInfo("tdm").teamObjective).toBe("KILLS");
    expect(matchHudInfo("killconfirmed").teamObjective).toBe("POINTS");
    expect(matchHudInfo("ffa").personalGoal).toBe(true);
    expect(matchHudInfo("ctf").personalGoal).toBe(false);
  });
  test("survival tiers retain their proper objective text", () => {
    expect(matchHudInfo("survival", "hard").title).toBe("Hard Survival · Endless");
    expect(matchHudInfo("survival", "nightmare").title).toBe("Nightmare Survival · Endless");
  });
});

describe("Afterlight City room capacity", () => {
  test("day/night city maps have 32 slots or 16v16 teams", () => {
    for (const id of ["terminal", "arena_neon"] as const) {
      expect(isAfterlightCityMap(id)).toBe(true);
      expect(teamSizesForMap(id)).toContain(16);
      expect(teamSizeAllowed(id, 16)).toBe(true);
      for (const mode of ["ffa", "tdm", "killconfirmed", "gungame"] as const)
        expect(roomCapacity(mode, 16)).toBe(32);
    }
  });
  test("medium arenas support 9v9 while compact rooms stay restricted", () => {
    for (const map of MAP_LIST) {
      if (isAfterlightCityMap(map.id)||map.id==="floodgate"||map.id==="bunker") continue;
      expect(teamSizeAllowed(map.id, 16)).toBe(false);
      expect(teamSizesForMap(map.id)).toEqual(["compound","skybridge"].includes(map.id)?[3,5,7,9]:[3,5,7]);
      expect(teamSizeAllowed(map.id, 7)).toBe(true);
    }
    expect(roomCapacity("survival", 16, 2)).toBe(2);
    expect(teamSizeAllowed("terminal", 32)).toBe(false);
    expect(teamSizeAllowed("terminal", 0)).toBe(false);
  });
  test("large city matches have enough distinct spawn locations for every slot", () => {
    for (const id of ["terminal", "arena_neon"] as const) {
      const map = getMap(id);
      expect(map.spawns.red.length).toBeGreaterThanOrEqual(16);
      expect(map.spawns.blue.length).toBeGreaterThanOrEqual(16);
      expect(map.spawns.ffa.length).toBeGreaterThanOrEqual(32);
      for (const team of ["red", "blue", "ffa"] as const) {
        const points = map.spawns[team];
        expect(new Set(points.map(p => `${p[0].toFixed(2)}:${p[2].toFixed(2)}`)).size).toBe(points.length);
      }
    }
  });
  test("spawn expansion keeps authored spots and only adds walkable, collision-safe points", () => {
    const authored: [number,number,number][] = [[0,0,0]];
    const regions = [{x:0,z:0,w:120,d:120}];
    const cover = [{ pos:[10,1,0] as [number,number,number],
      size:[2,1,2] as [number,number,number], kind:"cover" as const }];
    const expanded = expandCitySpawnPositions(authored, regions, cover, 16);
    expect(expanded).toHaveLength(16);
    expect(expanded[0]).toEqual([0,0,0]);
    for (const pos of expanded.slice(1)) {
      expect(Math.abs(pos[0]) < 8 && Math.abs(pos[2]) < 3).toBe(false);
      expect(Math.abs(pos[0] - 10) < 3.3 && Math.abs(pos[2]) < 3.3).toBe(false);
    }
  });

});
