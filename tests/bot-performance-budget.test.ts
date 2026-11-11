import { describe, expect, test } from "bun:test";
import { BotRouteBudget, botRouteJitter } from "../src/lib/bot-performance-budget";

describe("staggered bot pathfinding budget", () => {
  test("limits concurrent A* searches per tick without accumulating unused allowances", () => {
    const budget = new BotRouteBudget();
    budget.beginTick(1);
    expect(budget.take()).toBe(true);
    expect(budget.take()).toBe(false);
    budget.beginTick(2);
    expect(budget.take()).toBe(true);
    expect(budget.take()).toBe(true);
    expect(budget.take()).toBe(false);
    budget.beginTick(0);
    expect(budget.take()).toBe(false);
  });
  test("route deadlines are stable and spread across bots", () => {
    const delays = Array.from({ length: 32 }, (_, i) => botRouteJitter("bot-" + i));
    expect(new Set(delays).size).toBeGreaterThan(18);
    expect(delays.every(x => x >= 0 && x < 350)).toBe(true);
    expect(botRouteJitter("bot-9")).toBe(botRouteJitter("bot-9"));
    expect(botRouteJitter("bot-9", 0)).toBe(0);
  });
});
