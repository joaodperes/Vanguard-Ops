import { describe, expect, test } from "bun:test";
import { advancePractice, COMPETITIVE_MODE_GUIDES, COMPETITIVE_MODE_IDS, newTutorialProgress, parseTutorialProgress, shouldOfferTutorial, tutorialStorageKey, type PracticeSample, type PracticeState } from "../src/lib/tutorial";
import matchModes from "../src/data/catalogs/match-modes.json";

const sample: PracticeSample = { x: 0, z: -32, aiming: false, kills: 0, ammo: 30, reloading: false, weaponId: "rifle_ar" };
describe("new-player tutorial", () => {
  test("competitive briefings cover every shipped PvP mode", () => {
    const shippedCompetitiveModes = Object.keys(matchModes).filter(id => id !== "survival").sort();
    expect([...COMPETITIVE_MODE_IDS].sort()).toEqual(shippedCompetitiveModes);
    for (const id of COMPETITIVE_MODE_IDS) {
      expect(COMPETITIVE_MODE_GUIDES[id].label).toBe(matchModes[id].label);
      expect(COMPETITIVE_MODE_GUIDES[id].objective.length).toBeGreaterThan(50);
      expect(COMPETITIVE_MODE_GUIDES[id].tip.length).toBeGreaterThan(20);
    }
  });

  test("new players are offered training; existing, completed and skipped profiles are left alone", () => {
    expect(shouldOfferTutorial({ xp: 0, matchesPlayed: 0 }, null)).toBe(true);
    expect(shouldOfferTutorial({ xp: 100, matchesPlayed: 0 }, null)).toBe(false);
    expect(shouldOfferTutorial({ xp: 0, matchesPlayed: 1 }, null)).toBe(false);
    for (const status of ["completed", "skipped"] as const)
      expect(shouldOfferTutorial({ xp: 0, matchesPlayed: 0 }, { ...newTutorialProgress(), status })).toBe(false);
    expect(shouldOfferTutorial({ xp: 100, matchesPlayed: 1 }, newTutorialProgress())).toBe(true);
  });
  test("checkpoints resume safely and are isolated per account/guest", () => {
    const saved = { ...newTutorialProgress(), phase: "practice", practiceStep: 3 };
    expect(parseTutorialProgress(JSON.stringify(saved))).toEqual(saved);
    expect(tutorialStorageKey("guest_a")).not.toBe(tutorialStorageKey("account_b"));
    for (const raw of [null, "oops", "{}", JSON.stringify({ ...saved, version: 99 }), JSON.stringify({ ...saved, phase: "forged" }), JSON.stringify({ ...saved, practiceStep: -1 }), JSON.stringify({ ...saved, practiceStep: 6 }), JSON.stringify({ ...saved, status: "unknown" })])
      expect(parseTutorialProgress(raw)).toBeNull();
  });
  test("live movement, ADS, a fresh elimination, a completed reload and swapping finish the drill in order", () => {
    let state: PracticeState = { step: 0, distance: 0 };
    state = advancePractice(state, sample);
    expect(state.step).toBe(0); // Initial spawn is not walked distance.
    state = advancePractice(state, { ...sample, x: 3 });
    state = advancePractice(state, { ...sample, x: 0 });
    expect(state.step).toBe(1); // Back-and-forth movement counts.
    state = advancePractice(state, { ...sample, aiming: true });
    expect(state.step).toBe(2);
    state = advancePractice(state, { ...sample, aiming: true, ammo: 29 });
    expect(state.step).toBe(2); // Firing without a kill is not an elimination.
    state = advancePractice(state, { ...sample, kills: 1, ammo: 20 });
    expect(state.step).toBe(3);
    state = advancePractice(state, { ...sample, kills: 1, ammo: 20, reloading: true });
    expect(state.step).toBe(3);
    state = advancePractice(state, { ...sample, kills: 1, ammo: 30 });
    expect(state.step).toBe(4);
    state = advancePractice(state, { ...sample, kills: 1, ammo: 15, weaponId: "pistol_side" });
    expect(state.step).toBe(5);
    expect(advancePractice(state, sample)).toBe(state);
  });
  test("cancelling reload by swapping cannot complete reload training", () => {
    let state = advancePractice({ step: 3, distance: 5 }, { ...sample, ammo: 10, reloading: true });
    state = advancePractice(state, { ...sample, ammo: 15, weaponId: "pistol_side" });
    expect(state.step).toBe(3);
    state = advancePractice(state, { ...sample, ammo: 15, reloading: true, weaponId: "pistol_side" });
    state = advancePractice(state, { ...sample, ammo: 15, weaponId: "pistol_side" });
    expect(state.step).toBe(3); // No actual refill occurred.
  });
  test("resuming a lesson does not mistake the new range's initial state for an action", () => {
    for (const step of [2, 3, 4]) expect(advancePractice({ step, distance: 0 }, sample).step).toBe(step);
  });
});
