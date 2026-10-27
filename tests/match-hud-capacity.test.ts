import { describe, expect, test } from "bun:test";
import { matchHudInfo } from "../src/lib/match-hud";
import { roomCapacity, teamSizeAllowed, teamSizesForMap, isAfterlightCityMap, MAP_LIST } from "../src/lib/game-protocol";

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
  test("small arenas and CTF-only maps retain a 14 combatant maximum", () => {
    for (const map of MAP_LIST) {
      if (isAfterlightCityMap(map.id)) continue;
      expect(teamSizeAllowed(map.id, 16)).toBe(false);
      expect(teamSizesForMap(map.id)).toEqual([3,5,7]);
      expect(teamSizeAllowed(map.id, 7)).toBe(true);
    }
    expect(roomCapacity("survival", 16, 2)).toBe(2);
    expect(teamSizeAllowed("terminal", 32)).toBe(false);
    expect(teamSizeAllowed("terminal", 0)).toBe(false);
  });
});
