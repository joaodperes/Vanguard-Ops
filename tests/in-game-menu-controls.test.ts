import { describe, expect, test } from "bun:test";
import {
  initialPointerLockMenuState,
  pointerLockMenuTransition,
  ignorePointerLockRelease,
  escapeMenuAction,
} from "../src/lib/in-game-menu-controls";

describe("in-game Escape menu", () => {
  test("Escape toggles main menu and backs out of nested pages", () => {
    expect(escapeMenuAction(false, "main")).toBe("open");
    expect(escapeMenuAction(true, "main")).toBe("resume");
    for (const page of ["settings", "loadout", "quests", "quit"]) {
      expect(escapeMenuAction(true, page)).toBe("back");
    }
  });

  test("delayed intentional pointer unlock cannot reopen a closed menu", () => {
    let state = pointerLockMenuTransition(initialPointerLockMenuState, true, false).state;
    state = ignorePointerLockRelease(state); // opening the menu releases the cursor
    // Escape closes the menu before pointerlockchange(false) arrives.
    const lateUnlock = pointerLockMenuTransition(state, false, false);
    expect(lateUnlock.openMenu).toBe(false);
    expect(pointerLockMenuTransition(lateUnlock.state, false, false).openMenu).toBe(false);
  });

  test("a real release from gameplay opens the menu once", () => {
    const acquired = pointerLockMenuTransition(initialPointerLockMenuState, true, false);
    const released = pointerLockMenuTransition(acquired.state, false, false);
    expect(released.openMenu).toBe(true);
    expect(pointerLockMenuTransition(released.state, false, false).openMenu).toBe(false);
  });

  test("Resume button relocks; a later Escape release still opens the menu", () => {
    const locked = pointerLockMenuTransition(initialPointerLockMenuState, true, false);
    const opened = pointerLockMenuTransition(ignorePointerLockRelease(locked.state), false, true);
    expect(opened.openMenu).toBe(false);
    const resumed = pointerLockMenuTransition(opened.state, true, false);
    expect(resumed.openMenu).toBe(false);
    expect(pointerLockMenuTransition(resumed.state, false, false).openMenu).toBe(true);
  });

  test("a redundant unlock while already unlocked does not open the menu", () => {
    const unlocked = pointerLockMenuTransition(initialPointerLockMenuState, false, false);
    expect(unlocked.openMenu).toBe(false);
    expect(pointerLockMenuTransition(unlocked.state, false, false).openMenu).toBe(false);
  });
});
