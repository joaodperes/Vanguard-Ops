import { describe, expect, test } from "bun:test";
import { MAP_LIST, mapAllowedForMode, resolveRoomSelection } from "../src/lib/game-protocol";
import { insideRegions, MAP_BLUEPRINTS } from "../src/lib/map-blueprints";
import {
  createHardpointState, hardpointZonesForMap, HARDPOINT_RULES, tickHardpoint,
} from "../src/lib/game-mode-rules";

describe("Hardpoint map layouts and rotation", () => {
  test("replaces Blacksite with a larger Hardpoint arena", () => {
    expect(mapAllowedForMode("hardpoint", "bunker")).toBe(false);
    expect(mapAllowedForMode("hardpoint", "emberhold")).toBe(true);
    expect(mapAllowedForMode("hardpoint", "dustwater")).toBe(true);
    expect(mapAllowedForMode("hardpoint", "floodgate")).toBe(true);
    expect(resolveRoomSelection("hardpoint", "bunker", 5).mapId).toBe("emberhold");
  });

  test("all selectable Hardpoint zones fit fully inside each map footprint", () => {
    const maps = MAP_LIST.filter(map => mapAllowedForMode("hardpoint", map.id));
    expect(maps.map(map => map.id).sort()).toEqual(["dustwater", "emberhold", "floodgate"]);
    for (const map of maps) {
      const regions = MAP_BLUEPRINTS.maps[map.id].regions;
      const zones = hardpointZonesForMap(map.id);
      expect(zones).toHaveLength(HARDPOINT_RULES.zoneCount);
      for (const zone of zones) {
        expect(insideRegions(zone.pos[0], zone.pos[2], regions, zone.radius ?? 6)).toBe(true);
      }
    }
  });

  test("the current point keeps scoring throughout the rotation countdown", () => {
    const zones = hardpointZonesForMap("dustwater");
    const state = createHardpointState(0, HARDPOINT_RULES.zoneCount);
    const player = { id: "red-player", team: "red" as const, alive: true, pos: zones[0].pos };

    const transition = tickHardpoint(
      state, zones, [player], HARDPOINT_RULES.rotationSeconds * 1000, 50,
    );
    expect(transition.state.phase).toBe("transition");
    expect(transition.state.activeIndex).toBe(0);
    expect(transition.state.owner).toBe("red");
    expect(transition.state.scores.red).toBeGreaterThan(0);

    const rotated = tickHardpoint(
      state, zones, [player],
      (HARDPOINT_RULES.rotationSeconds + HARDPOINT_RULES.transitionSeconds) * 1000, 50,
    );
    expect(rotated.rotated).toBe(true);
    expect(rotated.state.phase).toBe("active");
    expect(rotated.state.activeIndex).toBe(1);
  });
});
