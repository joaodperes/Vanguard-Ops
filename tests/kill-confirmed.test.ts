import { describe, expect, test } from "bun:test";
import { killConfirmedPickupPoints } from "../src/lib/game-protocol";

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
