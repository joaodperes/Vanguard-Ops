import type { WeaponSlot } from "./game-data";

/** Q returns to the last distinct weapon, or toggles primary/secondary at spawn. */
export function quickSwapTarget(current: WeaponSlot, previous: WeaponSlot): WeaponSlot {
  if (previous !== current) return previous;
  return current === "primary" ? "secondary" : "primary";
}
