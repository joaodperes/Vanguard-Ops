import { describe, expect, test } from "bun:test";
import { getMap, roomCapacity, recommendedTeamSize, teamSizesForMap, type Vec3 } from "../src/lib/game-protocol";
import { botAirStep, botMoveBlocked } from "../src/lib/bot-physics";
import { spawnClear } from "../src/lib/spawn-selection";

const castle = getMap("emberhold");

describe("Emberhold crypt collision and decorations", () => {
  test("all crypt spawns are separated from the torch posts and stone tombs", () => {
    const dungeonSpawns = castle.spawns.ffa.filter(s => s[1] < 2);
    const cryptProps = (castle.props ?? []).filter(p => (p.y ?? 0) < 2);
    const lamps = cryptProps.filter(p => p.kind === "lamp");
    const tombs = cryptProps.filter(p => p.kind === "sarcophagus");
    expect(dungeonSpawns.length).toBeGreaterThanOrEqual(8);
    expect(lamps.length).toBeGreaterThanOrEqual(12);
    expect(tombs.length).toBeGreaterThanOrEqual(10);
    for (const sp of dungeonSpawns) {
      expect(spawnClear(castle, sp)).toBe(true);
      for (const p of cryptProps) {
        expect(Math.hypot(sp[0] - p.x, sp[2] - p.z)).toBeGreaterThan(2.5);
      }
    }
  });

  test("tombs are visible props with matching solid collision geometry", () => {
    const tombs = (castle.props ?? []).filter(p => p.kind === "sarcophagus");
    for (const p of tombs) {
      const block = castle.cover.find(c => c.kind === "cover" &&
        Math.abs(c.pos[0] - p.x) < 0.01 && Math.abs(c.pos[2] - p.z) < 0.01 &&
        Math.abs(c.pos[1] - ((p.y ?? 0) + (p.h ?? 3) / 2)) < .01);
      expect(block, `missing tomb collider at ${p.x},${p.z}`).toBeDefined();
      expect(block!.size[0]).toBeCloseTo((p.w ?? 2.2) / 2, 3);
      expect(block!.size[2]).toBeCloseTo((p.d ?? 3.1) / 2, 3);
    }
  });

  test("a bot cannot phase sideways through an actual crypt gallery wall", () => {
    const from:Vec3 = [-42, .5, -17], to:Vec3 = [-34, .5, -17];
    expect(botMoveBlocked(castle.cover, from, to, .5)).toBe(true);
    const launched = botAirStep(castle.cover, from, 8, .45, 0);
    expect(launched.pos[0]).toBeLessThan(-39);
  });

  test("a bot cannot jump through the underside of the castle courtyard ceiling", () => {
    let position:Vec3 = [-30, .5, -30];
    let hitCeiling = false;
    for (let i = 0; i < 12; i++) {
      const step = botAirStep(castle.cover, position, 0, .5, 0);
      position = step.pos;
      hitCeiling ||= step.hitCeiling;
    }
    expect(hitCeiling).toBe(true);
    expect(position[1]).toBeLessThanOrEqual(4 - 1.8);
  });

  test("a falling bot lands on the upper courtyard slab, not through it", () => {
    const fall = botAirStep(castle.cover, [-30, 5.1, -30], 0, -.6, 0);
    expect(fall.pos[1]).toBe(5);
  });
});

describe("map player-count recommendations", () => {
  test("Castle supports at most 24 combatants, regardless of mode", () => {
    for (const mode of ["ffa", "gungame", "tdm", "killconfirmed"] as const) {
      const sizes = teamSizesForMap("emberhold", mode);
      expect(sizes).toContain(12);
      expect(sizes).not.toContain(16);
      expect(Math.max(...sizes) * 2).toBe(24);
      expect(roomCapacity(mode, 12)).toBe(24);
    }
  });

  test("day and night Afterlight City recommend 18 combatants", () => {
    for (const map of ["terminal", "arena_neon"] as const) {
      for (const mode of ["ffa", "tdm", "gungame", "killconfirmed"] as const) {
        const size = recommendedTeamSize(map, mode);
        expect(size).toBe(9);
        expect(roomCapacity(mode, size)).toBe(18);
      }
    }
  });
});
