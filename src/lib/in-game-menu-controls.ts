/** Pointer-lock events are async: an unlock requested while opening the menu may
 * arrive after the user has already pressed Escape to close it. Only a NEW,
 * unhandled locked -> unlocked transition should open the menu. */
export type PointerLockMenuState = Readonly<{
  locked: boolean;
  ignoreUnlock: boolean;
}>;

export const initialPointerLockMenuState: PointerLockMenuState = {
  locked: false,
  ignoreUnlock: true,
};

/** The menu is already handling this unlock (e.g. setInputSuspended(true)). */
export function ignorePointerLockRelease(state: PointerLockMenuState): PointerLockMenuState {
  return { ...state, ignoreUnlock: true };
}

export function pointerLockMenuTransition(
  previous: PointerLockMenuState,
  locked: boolean,
  menuOpen: boolean,
): { state: PointerLockMenuState; openMenu: boolean } {
  if (locked) return { state: { locked: true, ignoreUnlock: false }, openMenu: false };
  return {
    state: { locked: false, ignoreUnlock: true },
    openMenu: previous.locked && !previous.ignoreUnlock && !menuOpen,
  };
}

export function escapeMenuAction(menuOpen: boolean, page: string): "open" | "back" | "resume" {
  if (!menuOpen) return "open";
  return page === "main" ? "resume" : "back";
}
