import { describe,expect,test } from "bun:test";
import { weaponById } from "../src/lib/game-data";
import { equipmentById } from "../src/lib/equipment";
import { TACTICAL_KNIFE_RANGE } from "../src/lib/throw-trajectory";
import {
  THROWING_KNIVES_ID, THROWING_KNIFE_RANGE, THROWING_KNIFE_MAX_CHARGES,
  THROWING_KNIFE_GUNGAME_RECHARGE_MS, fullThrowingKnives,
  isThrowingKnife, spendThrowingKnife, tickThrowingKnives, throwingKnifeRemainingMs,
} from "../src/lib/throwing-knives";

describe("Throwing Knives replacement",()=>{
  test("melee-slot and tactical knives keep distinct range, reserve and mechanics",()=>{
    const melee=weaponById(THROWING_KNIVES_ID),tactical=equipmentById("knives");
    expect(melee.id).not.toBe(tactical.id);
    expect(melee.stats.range).toBe(THROWING_KNIFE_RANGE);
    expect(melee.stats.magSize).toBe(THROWING_KNIFE_MAX_CHARGES);
    expect(THROWING_KNIFE_MAX_CHARGES).toBe(1);
    expect(tactical.type).toBe("knife");
    expect(tactical.charges).toBe(1);
    expect(tactical.radius).toBe(TACTICAL_KNIFE_RANGE);
    expect(TACTICAL_KNIFE_RANGE).toBeGreaterThan(THROWING_KNIFE_RANGE);
    const meleeSpent=spendThrowingKnife(fullThrowingKnives(),1000,false)!;
    expect(meleeSpent.charges).toBe(THROWING_KNIFE_MAX_CHARGES-1);
    expect(equipmentById("knives").charges).toBe(1);
  });

  test("preserves the baton ID and existing unlock progression",()=>{
    const knife=weaponById(THROWING_KNIVES_ID);
    expect(knife.name).toBe("Throwing Knives");
    expect(isThrowingKnife("baton")).toBe(true);
    expect(knife.category).toBe("melee");
    expect(knife.unlockLevel).toBe(16);
    expect(knife.unlockCost).toBe(900);
    expect(knife.special?.kind).toBe("throwing_knife");
    expect(knife.stats.magSize).toBe(THROWING_KNIFE_MAX_CHARGES);
    expect(knife.stats.reloadTime).toBe(0);
    expect(knife.stats.range).toBe(THROWING_KNIFE_RANGE);
    expect(knife.stats.damage).toBeGreaterThanOrEqual(100);
    expect(knife.attachments).toEqual([]);
  });

  test("one throw per life, no regeneration until death in ordinary modes",()=>{
    const initial=fullThrowingKnives();
    expect(initial.charges).toBe(THROWING_KNIFE_MAX_CHARGES);
    const spent=spendThrowingKnife(initial,1000,false)!;
    expect(spent.charges).toBe(0);
    expect(spendThrowingKnife(spent,1000000,false)).toBeNull();
    expect(tickThrowingKnives(spent,1000000,false)).toEqual(spent);
    expect(throwingKnifeRemainingMs(spent,1000000,false)).toBe(0);
    // A new life replenishes the reserve; merely waiting or swapping does not.
    expect(fullThrowingKnives()).toEqual(initial);
  });

  test("Gun Game restores the spent knife after the cooldown expires",()=>{
    const t=1000;
    const spent=spendThrowingKnife(fullThrowingKnives(),t,true)!;
    expect(spent.charges).toBe(0);
    expect(spent.nextAt).toBe(t+THROWING_KNIFE_GUNGAME_RECHARGE_MS);
    expect(spendThrowingKnife(spent,t+1000,true)).toBeNull();
    expect(throwingKnifeRemainingMs(spent,t+4500,true)).toBe(500);
    expect(tickThrowingKnives(spent,t+4999,true).charges).toBe(0);
    expect(tickThrowingKnives(spent,t+5000,true)).toEqual(fullThrowingKnives());
    expect(tickThrowingKnives(spent,t+10000,true)).toEqual(fullThrowingKnives());
  });

  test("Gun Game starts another recharge timer after a restored knife is thrown",()=>{
    const t=3000;
    const once=spendThrowingKnife(fullThrowingKnives(),t,true)!;
    const restored=tickThrowingKnives(once,t+5000,true);
    expect(restored).toEqual(fullThrowingKnives());
    const spentAgain=spendThrowingKnife(restored,t+5100,true)!;
    expect(spentAgain.nextAt).toBe(t+5100+THROWING_KNIFE_GUNGAME_RECHARGE_MS);
  });
});
