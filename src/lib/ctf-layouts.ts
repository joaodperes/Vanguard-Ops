/** Mode-specific ground objectives and rear spawn pools; shared by both simulations. */
import source from "../data/ctf-layouts.json";
import type {Vec3} from "./game-protocol";
export interface CtfLayout {
  home: Record<"red"|"blue",Vec3>;
  base: Record<"red"|"blue",Vec3>;
  spawns: Record<"red"|"blue",Vec3[]>;
}
export const CTF_LAYOUTS = source as unknown as Record<string,CtfLayout>;
