import {describe,expect,test} from "bun:test";
import {survivalPauseActive,survivalFirstChoiceDeadline,remainingSurvivalUpgradeSeconds,SURVIVAL_COOP_UPGRADE_GRACE_MS} from "../src/lib/survival-pause";
describe("Survival pausing",()=>{
 test("an outstanding upgrade pauses solo and co-op",()=>{
  expect(survivalPauseActive(1,1,false)).toBe(true);
  expect(survivalPauseActive(2,2,false)).toBe(true);
  expect(survivalPauseActive(2,1,false)).toBe(true);
  expect(survivalPauseActive(2,0,false)).toBe(false);
 });
 test("the Escape menu pauses only when solo",()=>{
  expect(survivalPauseActive(1,0,true)).toBe(true);
  expect(survivalPauseActive(2,0,true)).toBe(false);
  expect(survivalPauseActive(1,0,false)).toBe(false);
 });
 test("first co-op choice grants exactly ten seconds to the remaining player",()=>{
  const now=123456;
  expect(survivalFirstChoiceDeadline(2,2,1,now)).toBe(now+SURVIVAL_COOP_UPGRADE_GRACE_MS);
  expect(remainingSurvivalUpgradeSeconds(now+10000,now)).toBe(10);
  expect(remainingSurvivalUpgradeSeconds(now+10000,now+9001)).toBe(1);
  expect(remainingSurvivalUpgradeSeconds(now+10000,now+15000)).toBe(0);
 });
 test("solo and final selections do not trigger a new timeout",()=>{
  expect(survivalFirstChoiceDeadline(1,1,0,100)).toBeNull();
  expect(survivalFirstChoiceDeadline(2,1,0,100)).toBeNull();
  expect(survivalFirstChoiceDeadline(2,2,2,100)).toBeNull();
 });
});
