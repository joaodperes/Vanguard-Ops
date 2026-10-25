import { describe, expect, test } from "bun:test";
import { fullWonderCharges, spendWonderCharge, accelerateWonderCharge, tickWonderCharges } from "../src/lib/wonder-charge";
import weapons from "../src/data/catalogs/weapons.json";

const plagueheart = weapons.find(w => w.id === "wonder_corrosion")!;
const rules = plagueheart.wonder!;

describe("Plagueheart three-charge recharge", () => {
  test("starts with three charges and shows a three-round magazine", () => {
    expect(rules.maxCharges).toBe(3);
    expect(plagueheart.stats.magSize).toBe(3);
    expect(fullWonderCharges(rules).charges).toBe(3);
  });
  test("ordinary kills accelerate the next charge by five seconds", () => {
    const spent = spendWonderCharge(fullWonderCharges(rules), rules, 10000)!;
    expect(spent.charges).toBe(2);
    expect(spent.nextAt).toBe(48000);
    const afterKill = accelerateWonderCharge(spent, rules, 12000);
    expect(afterKill.charges).toBe(2);
    expect(afterKill.nextAt).toBe(43000);
  });
  test("recharges one missing charge per recharge cycle", () => {
    let state = fullWonderCharges(rules);
    state = spendWonderCharge(state, rules, 1000)!;
    state = spendWonderCharge(state, rules, 2000)!;
    state = spendWonderCharge(state, rules, 3000)!;
    expect(state.charges).toBe(0);
    expect(tickWonderCharges(state, rules, 39000).charges).toBe(1);
    expect(tickWonderCharges(state, rules, 77000).charges).toBe(2);
    expect(tickWonderCharges(state, rules, 115000).charges).toBe(3);
  });
});
