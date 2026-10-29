import type { GameMode } from "./game-protocol";
import { formatMatchClock } from "./match-clock";

/** Rules are derived from the active match, not from mode defaults. */
export interface ScoreboardRuleState {
  scoreLimit?: number;
  timeLimitSec?: number;
  unlimitedTime: boolean;
  ctfOvertime?: boolean;
  timeLeft: number;
  elapsedSeconds: number;
  survivalWave?: number;
  survivalReinforcements?: number;
  gungameIndex?: number;
  gungameTotal?: number;
}
function clock(seconds: number): string {
  return formatMatchClock({ timeLeft: seconds, elapsedSeconds: 0, unlimitedTime: false });
}
export function scoreboardRules(mode: GameMode, hud: ScoreboardRuleState): string[] {
  const elapsed = clock(hud.elapsedSeconds);
  if (mode === "survival") return [
    `Wave ${hud.survivalWave ?? 0} · Survive the assault`,
    hud.survivalReinforcements === undefined ? `Elapsed ${elapsed}`
      : `Reinforcements: ${hud.survivalReinforcements} · Elapsed ${elapsed}`,
  ];
  if (mode === "gungame") {
    const progress = hud.gungameTotal && hud.gungameTotal > 0 && hud.gungameIndex !== undefined
      ? `Weapon ${Math.min(hud.gungameTotal, hud.gungameIndex + 1)}/${hud.gungameTotal} · Final weapon wins`
      : "Final weapon wins";
    return [progress, `No time limit · Elapsed ${elapsed}`];
  }
  const limit = Math.max(0, Math.floor(hud.scoreLimit ?? 0));
  const goal = limit === 0 ? "No score limit" :
    mode === "ctf" ? `First to ${limit} flag captures` :
    mode === "killconfirmed" ? `First to ${limit} confirmed points` :
    mode === "tdm" ? `First to ${limit} team kills` :
    `First to ${limit} kills`;
  if (mode === "ctf" && hud.ctfOvertime) return [goal, `Overtime · Elapsed ${elapsed}`];
  if (hud.unlimitedTime || !hud.timeLimitSec || hud.timeLimitSec <= 0)
    return [goal, `No time limit · Elapsed ${elapsed}`];
  return [goal, `Time ${formatMatchClock(hud)} remaining / ${clock(hud.timeLimitSec)} limit`];
}
