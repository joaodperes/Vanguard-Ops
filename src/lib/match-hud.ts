import type { GameMode } from "./game-protocol";
import type { SurvivalTier } from "./survival";

/** Shared presentation for the countdown, top scoreboard and TAB scoreboard.
 * Never infer the game mode from a default/fallback FFA string. */
const MODE_HUD = {
  ffa: { title: "Free-For-All", short: "FFA", teamBased: false, teamObjective: "", personalPrimary: "K", personalSecondary: "D", personalGoal: true },
  tdm: { title: "Team Deathmatch", short: "TDM", teamBased: true, teamObjective: "KILLS", personalPrimary: "K", personalSecondary: "D", personalGoal: false },
  killconfirmed: { title: "Kill Confirmed", short: "KC", teamBased: true, teamObjective: "POINTS", personalPrimary: "PTS", personalSecondary: "DENIED", personalGoal: false },
  ctf: { title: "Capture the Flag", short: "CTF", teamBased: true, teamObjective: "CAPTURES", personalPrimary: "CAP", personalSecondary: "K", personalGoal: false },
  gungame: { title: "Gun Game", short: "GG", teamBased: false, teamObjective: "", personalPrimary: "K", personalSecondary: "D", personalGoal: false },
  survival: { title: "Standard Survival · 30 Waves", short: "SURV", teamBased: false, teamObjective: "", personalPrimary: "K", personalSecondary: "D", personalGoal: false },
} as const satisfies Record<GameMode, {
  title: string; short: string; teamBased: boolean; teamObjective: string;
  personalPrimary: string; personalSecondary: string; personalGoal: boolean;
}>;

export function matchHudInfo(mode: GameMode, survivalTier?: SurvivalTier) {
  const info = MODE_HUD[mode];
  if (mode !== "survival") return info;
  return {
    ...info,
    title: !survivalTier || survivalTier === "default"
      ? "Standard Survival · 30 Waves"
      : `${survivalTier.charAt(0).toUpperCase() + survivalTier.slice(1)} Survival · Endless`,
  };
}
