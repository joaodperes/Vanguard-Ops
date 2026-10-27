/**
 * Capture-the-flag announcements are driven by explicit, server-authoritative
 * events rather than guesses from subsequent position/carrier snapshots.
 * Both online and offline play use the same team-relative feedback.
 */
import type { SfxName } from "./sound";
import type { FlagTeam } from "./ctf-rules";

export type CtfAction = "pickup" | "capture" | "return" | "drop" | "auto_return";
export interface CtfFeedback { label: string; sound: SfxName | null }

/** flag identifies the flag affected, not the team performing the action. */
export function ctfFeedback(
  action: CtfAction, flag: FlagTeam, playerId: string,
  selfId: string, viewerTeam: FlagTeam,
): CtfFeedback {
  const actorTeam: FlagTeam = action === "return" || action === "auto_return"
    ? flag : flag === "red" ? "blue" : "red";
  const friendly = actorTeam === viewerTeam;
  const self = playerId === selfId;
  switch (action) {
    case "capture":
      return friendly
        ? { label: self ? "FLAG DELIVERED! +75 XP / +30 CR" : "TEAM SCORED!", sound: "flag_scored" }
        : { label: "ENEMY SCORED!", sound: "flag_enemy_scored" };
    case "pickup":
      return friendly
        ? { label: self ? "ENEMY FLAG TAKEN! +10% SPEED" : "TEAM HAS ENEMY FLAG!", sound: "flag_taken" }
        : { label: "YOUR FLAG TAKEN!", sound: "flag_lost" };
    case "return":
      return friendly
        ? { label: self ? "FLAG RETURNED!" : "TEAM FLAG RETURNED!", sound: "flag_returned" }
        : { label: "ENEMY FLAG RETURNED!", sound: null };
    case "drop":
      return friendly
        ? { label: self ? "FLAG LOST!" : "TEAM FLAG DROPPED!", sound: "flag_lost" }
        : { label: "ENEMY FLAG DROPPED!", sound: "flag_returned" };
    case "auto_return":
      return friendly
        ? { label: "YOUR FLAG AUTO-RETURNED!", sound: "flag_returned" }
        : { label: "ENEMY FLAG AUTO-RETURNED!", sound: null };
  }
}
