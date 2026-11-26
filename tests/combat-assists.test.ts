import { describe, expect, test } from "bun:test";
import { accumulateDamageContribution, countEligibleAssists, isAssistContributionEligible } from "../src/lib/combat-assists";

describe("shared combat assist rules", () => {
  test("accumulates recent damage and resets stale contributions", () => {
    expect(accumulateDamageContribution({damage:8,at:1000},9,100,9000)).toEqual({damage:17,at:9000});
    expect(accumulateDamageContribution({damage:8,at:1000},9,100,11001)).toEqual({damage:9,at:11001});
  });

  test("caps recorded contribution to remaining health and ignores invalid damage", () => {
    expect(accumulateDamageContribution(undefined,50,12,100)).toEqual({damage:12,at:100});
    expect(accumulateDamageContribution(undefined,Number.NaN,50,100)).toEqual({damage:0,at:100});
  });

  test("uses the same threshold and recency eligibility in both simulations", () => {
    expect(isAssistContributionEligible({damage:15,at:1000},11000)).toBe(true);
    expect(isAssistContributionEligible({damage:14.99,at:1000},11000)).toBe(false);
    expect(isAssistContributionEligible({damage:20,at:999},11000)).toBe(false);
  });

  test("awards only same-team contributors other than the killer", () => {
    const contributors = new Map([
      ["killer",{damage:40,at:9000,team:"red"}],
      ["ally",{damage:15,at:9000,team:"red"}],
      ["enemy",{damage:50,at:9000,team:"blue"}],
    ]);
    expect(countEligibleAssists(contributors,"killer","red",10000)).toEqual(["ally"]);
  });
});
