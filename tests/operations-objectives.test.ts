import { describe, expect, test } from "bun:test";
import type { MapDef } from "../src/lib/game-protocol";
import { createOperationState, damageOperationEscort, operationById, operationEncounter, operationSite, operationTarget, tickOperation } from "../src/lib/operations";

const map = {
  spawns: {
    ffa: [
      [20, 0, 20], [24, 0, 20], [28, 0, 20], [32, 0, 20],
      [10, 0, 0], [40, 0, 20], [0, 0, 0], [44, 0, 20],
      [48, 0, 20], [52, 0, 20], [56, 0, 20], [60, 0, 20],
      [64, 0, 20], [68, 0, 20], [72, 0, 20], [76, 0, 20],
    ],
    blue: [[0, 0, 0]],
  },
} as unknown as Pick<MapDef, "spawns">;

describe("Operations objective types", () => {
  test("eliminate objectives remain gated on every hostile being defeated", () => {
    const state = { ...createOperationState("silent_entry"), stage: 0 };
    const operative = { id: "p1", pos: [20, 0, 20] as [number, number, number], alive: true };
    const hostile = { id: "b1", pos: [30, 0, 30] as [number, number, number], alive: true };
    const waiting = tickOperation(state, map, [operative], [hostile], 1);
    expect(waiting.stage).toBe(0);
    const cleared = tickOperation(state, map, [operative], [], 1);
    expect(cleared.stage).toBe(1);
  });

  test("survive objectives advance after the timer even while enemies remain", () => {
    const state = { ...createOperationState("relay_siege"), stage: 3 };
    const operative = { id: "p1", pos: [100, 0, 100] as [number, number, number], alive: true };
    const hostile = { id: "b1", pos: [110, 0, 110] as [number, number, number], alive: true };
    let next = state;
    for (let i = 0; i < 90; i++) next = tickOperation(next, map, [operative], [hostile], 1);
    expect(next.stage).toBe(4);
    expect(next.status).toBe("active");
  });

  test("escort cart moves only while an operative stays close", () => {
    const state = { ...createOperationState("freight_intercept"), stage: 1 };
    const start = operationSite(map, operationById("freight_intercept")!.objectives[1].startSite!);
    const first = tickOperation(state, map, [{ id: "p1", pos: start, alive: true }], [], 1);
    expect(first.escortPos).toBeDefined();
    expect(Math.hypot(first.escortPos![0] - start[0], first.escortPos![2] - start[2])).toBeCloseTo(2.6);
    expect(first.escortHp).toBe(650);
    const unattended = tickOperation(first, map, [{ id: "p1", pos: [100, 0, 100], alive: true }], [], 1);
    expect(unattended.escortPos).toEqual(first.escortPos);
  });

  test("escort reaches the destination and completes the stage", () => {
    let state = { ...createOperationState("freight_intercept"), stage: 1 };
    for (let i = 0; i < 10 && state.stage === 1; i++) {
      const pos = state.escortPos ?? operationSite(map, 6);
      state = tickOperation(state, map, [{ id: "p1", pos, alive: true }], [], 1);
    }
    expect(state.stage).toBe(2);
    expect(state.escortPos).toBeUndefined();
  });

  test("destroyed escort fails the mission", () => {
    const state = { ...createOperationState("freight_intercept"), stage: 1,
      escortPos: [0, 0, 0] as [number, number, number], escortHp: 0, escortMaxHp: 650 };
    const next = tickOperation(state, map, [{ id: "p1", pos: [0, 0, 0], alive: true }], [], 1);
    expect(next.status).toBe("failed");
  });

  test("escort waypoint tracks the cart rather than a static marker", () => {
    const state = { ...createOperationState("freight_intercept"), stage: 1,
      escortPos: [3, 0, 4] as [number, number, number] };
    expect(operationTarget(state, map)).toEqual([3, 0, 4]);
  });
  test("player and hostile hits reduce shared escort health and destruction fails the mission", () => {
    const state = { ...createOperationState("freight_intercept"), stage: 1 };
    const operative = { id: "p1", pos: operationSite(map, 6), alive: true };
    const moving = tickOperation(state, map, [operative], [], 0);
    const damaged = damageOperationEscort(moving, 325);
    expect(damaged.escortHp).toBe(325);
    const destroyed = damageOperationEscort(damaged, 325);
    expect(destroyed.escortHp).toBe(0);
    expect(tickOperation(destroyed, map, [operative], [], 0).status).toBe("failed");
  });

  test("Zero Hour separates Juggernaut escort from the final commander elimination", () => {
    const mission = operationById("zero_hour")!;
    const escort = mission.objectives.find(objective => objective.kind === "escort")!;
    const commander = mission.objectives.find(objective => objective.boss)!;
    expect(escort.startSite).toBeDefined();
    expect(escort.payload).toBe("Juggernaut");
    expect(commander.kind).toBe("eliminate");
    expect(commander.site).toBeGreaterThan(0);
    const encounter = operationEncounter(mission, mission.objectives.indexOf(commander), "veteran", 1, false);
    expect(encounter?.boss).toBe(true);
  });

});
