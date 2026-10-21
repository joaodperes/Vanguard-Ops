/** Patrol toward contact instead of orbiting a team's own spawn area.
 * Use opposing-team spawns as search objectives in TDM; in FFA, choose an
 * alternative spawn. Keep the waypoint for multiple AI decisions to avoid
 * oscillating around the spawn every 0.5 seconds. */
export function chooseBotPatrolPoint(
  team: string, mode: string, position: readonly number[],
  red: readonly (readonly number[])[], blue: readonly (readonly number[])[],
  ffa: readonly (readonly number[])[], random: () => number = Math.random,
): [number, number, number] {
  const candidates = mode === "tdm" ? (team === "red" ? blue : red) : ffa;
  const viable = candidates.filter(p => Math.hypot(p[0] - position[0], p[2] - position[2]) > 9);
  const pool = viable.length ? viable : (candidates.length ? candidates : ffa);
  if (!pool.length) return [position[0] + 12, position[1], position[2] + 8];
  const point = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
  return [point[0], point[1], point[2]];
}
