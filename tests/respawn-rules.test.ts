import { describe, expect, test } from "bun:test";
import { resolveRespawnState, respawnDelayForMode } from "../src/lib/respawn-rules";

describe("shared respawn policy", () => {
  test("uses standard respawn delay for ordinary modes", () => {
    expect(respawnDelayForMode("ffa", 5000, 9000)).toBe(5000);
    expect(respawnDelayForMode("gungame", 5000, 9000)).toBe(5000);
  });

  test("uses Survival delay and disables individual Search & Destroy respawns", () => {
    expect(respawnDelayForMode("survival", 5000, 9000)).toBe(9000);
    expect(respawnDelayForMode("searchdestroy", 5000, 9000)).toBeNull();
  });

  test("normalizes invalid delays without producing negative timers", () => {
    expect(respawnDelayForMode("ffa", -50, 9000)).toBe(0);
    expect(respawnDelayForMode("ffa", Number.NaN, 9000)).toBe(0);
  });
});

describe("shared fresh-life transition", () => {
  test("restores health, alive state, spawn position and protection deadline", () => {
    const position = [12, 2, -8] as const;
    const result = resolveRespawnState({
      position, maxHealth: 100, now: 5000, spawnProtectionMs: 2500,
    });
    expect(result).toEqual({
      position: [12, 2, -8], health: 100, alive: true, spawnProtectedUntil: 7500,
    });
    expect(result.position).not.toBe(position);
  });

  test("clamps invalid health and protection inputs defensively", () => {
    expect(resolveRespawnState({
      position: [0, 0, 0], maxHealth: Number.NaN, now: 1000, spawnProtectionMs: -5,
    })).toEqual({
      position: [0, 0, 0], health: 1, alive: true, spawnProtectedUntil: 1000,
    });
  });

  test("uses a safe timestamp when the supplied clock is invalid", () => {
    expect(resolveRespawnState({
      position: [1, 0, 1], maxHealth: 125, now: Number.NaN,
    }).spawnProtectedUntil).toBe(0);
  });
});
