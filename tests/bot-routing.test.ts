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
