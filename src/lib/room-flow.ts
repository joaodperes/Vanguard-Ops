import {
  MAP_LIST, mapAllowedForMode, roomCapacity, recommendedTeamSize, teamSizesForMap,
  type MapId, type GameMode, type TeamSize,
} from "./game-protocol";

/** Pick a legal size for a candidate arena without dropping connected humans. */
export function roomTeamSizeForMap(
  mode: GameMode, mapId: MapId, currentSize: TeamSize, playerCount: number, survivalPlayers: 1 | 2 = 1,
): TeamSize | undefined {
  const legal = teamSizesForMap(mapId, mode);
  if (mode === "survival") {
    return legal.includes(currentSize) ? currentSize : recommendedTeamSize(mapId, mode);
  }
  const enoughRoom = legal.filter(size => roomCapacity(mode, size, survivalPlayers) >= Math.max(1, playerCount));
  if (!enoughRoom.length) return undefined;
  if (enoughRoom.includes(currentSize)) return currentSize;
  return [...enoughRoom].sort((a, b) => Math.abs(a - currentSize) - Math.abs(b - currentSize) || a - b)[0];
}

/** Alternatives support the room mode and can hold every connected human.
 * Different arenas may use a different legal team size; launchRoomRound resolves it. */
export function roomMapCandidates(
  mode: GameMode, current: MapId, size: TeamSize, round = 0, operationId?: string,
  playerCount = 1, survivalPlayers: 1 | 2 = 1,
): MapId[] {
  // Campaign missions have authored sites and must remain on their mission map.
  if (operationId) return [current];
  const others = MAP_LIST.filter(m =>
    m.id !== current && mapAllowedForMode(mode, m.id) &&
    roomTeamSizeForMap(mode, m.id, size, playerCount, survivalPlayers) !== undefined,
  ).map(m => m.id);
  const offset = others.length ? ((round % others.length) + others.length) % others.length : 0;
  return [current, ...others.slice(offset), ...others.slice(0, offset)].slice(0, 3);
}

/** One vote per connected human; ties prefer the earlier candidate. */
export function winningRoomMap(candidates: readonly MapId[], votes: Record<string, MapId>, humans: readonly string[]): MapId {
  return candidates.reduce((best, map) => {
    const count = (id: MapId) => humans.filter(h => votes[h] === id).length;
    return count(map) > count(best) ? map : best;
  }, candidates[0]);
}

export function roomInviteUrl(href: string, roomId: string): string {
  const url = new URL(href);
  url.searchParams.delete("password");
  url.searchParams.set("room", roomId);
  url.hash = "";
  return url.toString();
}
