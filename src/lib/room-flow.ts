import { MAP_LIST, mapAllowedForMode, teamSizeAllowed, type MapId, type GameMode, type TeamSize, type RoomSummary } from "./game-protocol";

/** Alternatives must support the room's mode and capacity. */
export function roomMapCandidates(mode: GameMode, current: MapId, size: TeamSize, round = 0,operationId?:string): MapId[] {
  if(operationId)return [current];
  const others = MAP_LIST.filter(m => m.id !== current && mapAllowedForMode(mode, m.id) && teamSizeAllowed(m.id, size, mode)).map(m => m.id);
  const offset = others.length ? round % others.length : 0;
  return [current, ...others.slice(offset), ...others.slice(0, offset)].slice(0, 3);
}

/** One vote per connected human; ties prefer the earlier candidate. */
export function winningRoomMap(candidates: readonly MapId[], votes: Record<string, MapId>, humans: readonly string[]): MapId {
  return candidates.reduce((best, map) => {
    const count = (id: MapId) => humans.filter(h => votes[h] === id).length;
    return count(map) > count(best) ? map : best;
  }, candidates[0]);
}

export function quickPlayRoom(rooms: readonly RoomSummary[], mode: GameMode): RoomSummary | undefined {
  return rooms.filter(r => r.mode === mode && !r.operationId && !r.hasPassword && r.humans > 0 && r.humans < r.capacity && (mode !== "survival" || !r.survivalTier || r.survivalTier === "default"))
    .sort((a,b) => Number(b.state === "playing") - Number(a.state === "playing") || b.humans - a.humans || a.createdAt - b.createdAt)[0];
}

export function roomInviteUrl(href: string, roomId: string): string {
  const url = new URL(href);
  url.searchParams.delete("password");
  url.searchParams.set("room", roomId);
  url.hash = "";
  return url.toString();
}
