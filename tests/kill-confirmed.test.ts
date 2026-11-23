import { describe, expect, test } from "bun:test";
import { KC_TAG_LIFETIME_INFINITE_MS, KC_TAG_LIFETIME_OPTIONS_MS, isValidKillConfirmedTagLifetimeMs, killConfirmedPickupPoints, killConfirmedTagExpiresAt } from "../src/lib/game-protocol";

describe("Kill Confirmed denial scoring", () => {
  test("enemy tag confirmations always award one match point", () => {
    expect(killConfirmedPickupPoints("confirm", false)).toBe(1);
    expect(killConfirmedPickupPoints("confirm", true)).toBe(1);
  });

  test("recovering a friendly tag prevents opponent scoring without a point by default", () => {
    expect(killConfirmedPickupPoints("deny", false)).toBe(0);
  });

  test("optional denial scoring awards one point per friendly tag recovery", () => {
    expect(killConfirmedPickupPoints("deny", true)).toBe(1);
  });
});

describe("Kill Confirmed tag lifetime", () => {
  test("offers infinite alongside the existing lifetime presets", () => {
    expect(KC_TAG_LIFETIME_OPTIONS_MS).toEqual([10000, 15000, 25000, 30000, 45000, KC_TAG_LIFETIME_INFINITE_MS]);
    expect(isValidKillConfirmedTagLifetimeMs(KC_TAG_LIFETIME_INFINITE_MS)).toBe(true);
    expect(isValidKillConfirmedTagLifetimeMs(20000)).toBe(false);
  });

  test("infinite tags use a JSON-safe timestamp that never expires during a match", () => {
    const expiresAt = killConfirmedTagExpiresAt(1234, KC_TAG_LIFETIME_INFINITE_MS);
    expect(expiresAt).toBe(Number.MAX_SAFE_INTEGER);
    expect(expiresAt).toBeGreaterThan(Date.now());
    expect(JSON.parse(JSON.stringify({ expiresAt })).expiresAt).toBe(expiresAt);
  });

  test("finite tag lifetimes still expire after the selected duration", () => {
    expect(killConfirmedTagExpiresAt(1234, 25000)).toBe(26234);
  });
});
