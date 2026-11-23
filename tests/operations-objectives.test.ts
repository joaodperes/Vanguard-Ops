import { beforeEach, describe, expect, test } from "bun:test";
import type { MapDef } from "../src/lib/game-protocol";
import { createOperationState, damageOperationEscort, operationById, operationEncounter, operationSite, operationTarget, planEscortRoute, tickOperation } from "../src/lib/operations";

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
  cover: [],
  size: 150,
} as unknown as Pick<MapDef, "spawns" | "cover" | "size">;

describe("Operations objective types", () => {
  beforeEach(() => map.cover.splice(0));
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

  test("secure and defend objectives complete with distant enemies still alive", () => {
    const operative = { id: "p1", pos: operationSite(map, 3), alive: true };
    const distantHostile = { id: "b1", pos: [120, 0, 120] as [number, number, number], alive: true };
    let secure = { ...createOperationState("silent_entry"), stage: 1 };
    for (let i = 0; i < 45 && secure.stage === 1; i++) secure = tickOperation(secure, map, [operative], [distantHostile], 1);
    expect(secure.stage).toBe(2);
    const defender = { id: "p1", pos: operationSite(map, 4), alive: true };
    let defend = { ...createOperationState("freight_intercept"), stage: 2 };
    for (let i = 0; i < 125 && defend.stage === 2; i++) defend = tickOperation(defend, map, [defender], [distantHostile], 1);
    expect(defend.stage).toBe(3);
  });

  test("escort route steers the cart around solid cover", () => {
    const obstacle = { pos: [-110, 0.9, 27] as [number, number, number], size: [8, 0.9, 10] as [number, number, number], kind: "solid" as const };
    const path = planEscortRoute([-99, 0, 43], [-122, 0, 18], [obstacle], 150);
    expect(path.length).toBeGreaterThan(2);
    expect(path.every(point => !(Math.abs(point[0] + 110) < 9.55 && Math.abs(point[2] - 27) < 11.85)).toBe(true);
  });

  test("survive objectives can protect a 650 HP PC without a defend-site radius", () => {
    const objective = operationById("relay_siege")!.objectives[3];
    expect(objective.kind).toBe("survive");
    expect(objective.site).toBeUndefined();
    expect(objective.targetHp).toBe(650);
    let state = { ...createOperationState("relay_siege"), stage: 3 };
    const operative = { id: "p1", pos: [100, 0, 100] as [number, number, number], alive: true };
    const hostile = { id: "b1", pos: [110, 0, 110] as [number, number, number], alive: true };
    for (let i = 0; i < 90 && state.stage === 3; i++) state = tickOperation(state, map, [operative], [hostile], 1);
    expect(state.stage).toBe(4);
    expect(state.escortComplete).toBe(true);
    expect(state.escortHp).toBe(650);
  });

  test("the PC cart has a persistent solid collider", () => {
    const state = { ...createOperationState("freight_intercept"), stage: 1 };
    const operative = { id: "p1", pos: operationSite(map, 6), alive: true };
    const moving = tickOperation(state, map, [operative], [], 1);
    const collider = map.cover.find(box => box.environmentId === "operation-escort-cart");
    expect(collider).toBeDefined();
    expect(collider?.pos[0]).toBe(moving.escortPos?.[0]);
  });

  test("extract objectives do not require eliminating every hostile", () => {
    const state = { ...createOperationState("silent_entry"), stage: 4 };
    const operative = { id: "p1", pos: operationSite(map, 0), alive: true };
    const hostile = { id: "b1", pos: [120, 0, 120] as [number, number, number], alive: true };
    let next = state;
    for (let i = 0; i < 15 && next.stage === 4; i++) next = tickOperation(next, map, [operative], [hostile], 1);
    expect(next.stage).toBe(5);
  });

  test("escort reaches the destination and completes the stage", () => {
    let state = { ...createOperationState("freight_intercept"), stage: 1 };
    for (let i = 0; i < 100 && state.stage === 1; i++) {
      const pos = state.escortPos ?? operationSite(map, 6);
      state = tickOperation(state, map, [{ id: "p1", pos, alive: true }], [], 1);
    }
    expect(state.stage).toBe(2);
    expect(state.escortPos).toEqual([-122, 0, 18]);
    expect(state.escortComplete).toBe(true);
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
