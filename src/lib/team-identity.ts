/** Canonical player-facing identities for the two competitive teams.
 * Internal protocol IDs remain red/blue for backwards compatibility; these
 * identities are presentation-only and must not be used for combat feedback.
 */
export const TEAM_IDENTITIES = {
  red: {
    label: "ALPHA TEAM",
    shortLabel: "ALPHA",
    hex: "#0F766E",
    borderClass: "border-teal-500/40",
    backgroundClass: "bg-teal-500/10",
    textClass: "text-teal-400",
    dotClass: "bg-teal-500",
    allyTextClass: "text-teal-300/80",
  },
  blue: {
    label: "BRAVO TEAM",
    shortLabel: "BRAVO",
    hex: "#8B5CF6",
    borderClass: "border-violet-500/40",
    backgroundClass: "bg-violet-500/10",
    textClass: "text-violet-400",
    dotClass: "bg-violet-500",
    allyTextClass: "text-violet-300/80",
  },
} as const;

export type TeamIdentityId = keyof typeof TEAM_IDENTITIES;

export function teamIdentity(team: string) {
  return team === "red" || team === "blue" ? TEAM_IDENTITIES[team] : undefined;
}
