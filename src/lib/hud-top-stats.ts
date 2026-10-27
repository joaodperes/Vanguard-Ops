/**
 * Small, mode-specific HUD selectors. Keep the scoring perspective in one place
 * so the on-screen score isn't mistaken for an individual objective total.
 */
export interface HudRankRow { kills: number; isSelf: boolean }
export interface TeamTally { red: number; blue: number }
export interface HudFlag { carrierId: string | null; dropped: boolean }

/** Competition ranking by kills: players with equal kills share their rank. */
export function killRank(rows: readonly HudRankRow[], selfKills: number): { rank: number; players: number } {
  const kills = rows.find(row => row.isSelf)?.kills ?? selfKills;
  // Snapshot delivery can briefly omit the viewer; include that player in
  // the count so the rank can never display an impossible #2/1.
  const containsSelf = rows.some(row => row.isSelf);
  return { rank: 1 + rows.filter(row => row.kills > kills).length,
    players: Math.max(1, rows.length + (containsSelf ? 0 : 1)) };
}

/** Blue players see blue as their team; red players see red as theirs. */
export function teamScorePerspective(scores: TeamTally, selfTeam: string | undefined): { own: number; enemy: number } {
  return selfTeam === "blue"
    ? { own: scores.blue, enemy: scores.red }
    : { own: scores.red, enemy: scores.blue };
}

export function flagStateLabel(flag: HudFlag): "TAKEN" | "DROPPED" | "HOME" {
  return flag.carrierId ? "TAKEN" : flag.dropped ? "DROPPED" : "HOME";
}

/** The HUD reserves the second line for CTF flags and optional contextual alerts. */
export function ctfFlagLine(
  flags: { red: HudFlag; blue: HudFlag },
  selfTeam: string | undefined,
  carrying: boolean,
): { own: string; enemy: string } {
  const ownTeam = selfTeam === "blue" ? "blue" : "red";
  const enemyTeam = ownTeam === "red" ? "blue" : "red";
  return {
    own: flagStateLabel(flags[ownTeam]),
    enemy: carrying ? "CARRYING" : flagStateLabel(flags[enemyTeam]),
  };
}
