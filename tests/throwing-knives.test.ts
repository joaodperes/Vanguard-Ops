import { describe,expect,test } from "bun:test";
import { weaponById } from "../src/lib/game-data";
import {
  THROWING_KNIVES_ID, THROWING_KNIFE_RANGE, THROWING_KNIFE_MAX_CHARGES,
  THROWING_KNIFE_GUNGAME_RECHARGE_MS, fullThrowingKnives,
  isThrowingKnife, spendThrowingKnife, tickThrowingKnives, throwingKnifeRemainingMs,
} from "../src/lib/throwing-knives";

describe("Throwing Knives replacement",()=>{
  test("preserves the baton ID and existing unlock progression",()=>{
    const knife=weaponById(THROWING_KNIVES_ID);
    expect(knife.name).toBe("Throwing Knives");
    expect(isThrowingKnife("baton")).toBe(true);
    expect(knife.category).toBe("melee");
    expect(knife.unlockLevel).toBe(16);
    expect(knife.unlockCost).toBe(900);
    expect(knife.special?.kind).toBe("throwing_knife");
    expect(knife.stats.magSize).toBe(2);
    expect(knife.stats.reloadTime).toBe(0);
    expect(knife.stats.range).toBe(THROWING_KNIFE_RANGE);
    expect(knife.stats.damage).toBeGreaterThanOrEqual(100);
    expect(knife.attachments).toEqual([]);
  });

  test("at most two throws; no reload, no charge regeneration in ordinary modes",()=>{
    const initial=fullThrowingKnives();
    expect(initial.charges).toBe(THROWING_KNIFE_MAX_CHARGES);
    const once=spendThrowingKnife(initial,1000,false)!;
    const twice=spendThrowingKnife(once,1700,false)!;
    expect(once.charges).toBe(1);
    expect(twice.charges).toBe(0);
    expect(spendThrowingKnife(twice,1000000,false)).toBeNull();
    expect(tickThrowingKnives(twice,1000000,false)).toEqual(twice);
    expect(throwingKnifeRemainingMs(twice,1000000,false)).toBe(0);
    // Death replenishes the entire shared reserve; swapping does not.
    expect(fullThrowingKnives().charges).toBe(2);
  });

  test("Gun Game recovers one knife per cooldown, even when fully exhausted",()=>{
    const t=1000;
    const once=spendThrowingKnife(fullThrowingKnives(),t,true)!;
    const empty=spendThrowingKnife(once,t+600,true)!;
    expect(once.nextAt).toBe(t+THROWING_KNIFE_GUNGAME_RECHARGE_MS);
    expect(empty.nextAt).toBe(once.nextAt);
    expect(spendThrowingKnife(empty,t+1000,true)).toBeNull();
    expect(throwingKnifeRemainingMs(empty,t+4500,true)).toBe(500);
    expect(tickThrowingKnives(empty,t+4999,true).charges).toBe(0);
    const restored=tickThrowingKnives(empty,t+5000,true);
    expect(restored.charges).toBe(1);
    expect(restored.nextAt).toBe(t+10000);
    const complete=tickThrowingKnives(restored,t+10000,true);
    expect(complete).toEqual(fullThrowingKnives());
    expect(tickThrowingKnives(empty,t+10000,true)).toEqual(fullThrowingKnives());
  });

  test("a newly spent charge joins an existing Gun Game recharge timer",()=>{
    const t=3000;
    const once=spendThrowingKnife(fullThrowingKnives(),t,true)!;
    const restored=tickThrowingKnives(once,t+5000,true);
    expect(restored).toEqual(fullThrowingKnives());
    const spentAgain=spendThrowingKnife(restored,t+5100,true)!;
    expect(spentAgain.nextAt).toBe(t+5100+THROWING_KNIFE_GUNGAME_RECHARGE_MS);
  });
});
