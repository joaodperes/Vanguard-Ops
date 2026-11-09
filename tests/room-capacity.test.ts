import { describe, expect, test } from "bun:test";
import {
  mapAllowedForMode,
  roomCapacity,
  recommendedTeamSize,
  resolveRoomSelection,
  teamSizeAllowed,
  teamSizesForMap,
} from "../src/lib/game-protocol";

describe("room-size validation and map selection", () => {
  for (const mode of ["ffa", "gungame"] as const) {
    test(`Emberhold Castle supports 24-player ${mode} rooms`, () => {
      expect(mapAllowedForMode(mode, "emberhold")).toBe(true);
      expect(teamSizesForMap("emberhold", mode)).toContain(12);
      expect(teamSizeAllowed("emberhold", 12, mode)).toBe(true);
      expect(roomCapacity(mode, 12)).toBe(24);
      expect(resolveRoomSelection(mode, "emberhold", 12)).toEqual({
        mapId: "emberhold",
        teamSize: 12,
      });
    });

    test(`Emberhold Castle never exposes 32-player ${mode} rooms`, () => {
      expect(teamSizeAllowed("emberhold", 16, mode)).toBe(false);
      expect(teamSizesForMap("emberhold", mode).at(-1)).toBe(12);
      expect(resolveRoomSelection(mode, "emberhold", 16)).toEqual({
        mapId: "emberhold",
        teamSize: recommendedTeamSize("emberhold", mode),
      });
    });
  }

  test("unsupported Castle CTF selection resets map and its team size together", () => {
    expect(mapAllowedForMode("ctf", "emberhold")).toBe(false);
    const selection = resolveRoomSelection("ctf", "emberhold", 12);
    expect(selection.mapId).toBe("forest_warfare");
    expect(teamSizeAllowed(selection.mapId, selection.teamSize, "ctf")).toBe(true);
    expect(roomCapacity("ctf", selection.teamSize)).toBe(10);
  });

  test("switching to another map does not carry over Castle's 24-player size", () => {
    const selection = resolveRoomSelection("ffa", "bunker", 12);
    expect(selection.mapId).toBe("bunker");
    expect(selection.teamSize).toBe(3);
    expect(roomCapacity("ffa", selection.teamSize)).toBe(6);
  });

  test("Afterlight's 18-player recommendation remains available", () => {
    for (const mapId of ["terminal", "arena_neon"] as const) {
      expect(recommendedTeamSize(mapId, "ffa")).toBe(9);
      expect(teamSizeAllowed(mapId, 9, "ffa")).toBe(true);
      expect(roomCapacity("ffa", 9)).toBe(18);
    }
  });
});
