"use client";
import { useState, useSyncExternalStore } from "react";
import { getRoomStatus, getServerRoomStatus, subscribeRoom, roomSend, roomSocketConnected, roomSelfId } from "@/lib/room-session";
import { roomInviteUrl, winningRoomMap } from "@/lib/room-flow";
import { getMap } from "@/lib/game-protocol";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function RoomRoundPanel({ results = false }: { results?: boolean }) {
  const status = useSyncExternalStore(subscribeRoom, getRoomStatus, getServerRoomStatus);
  const [invite, setInvite] = useState("");
  if (!status || status.phase === "playing") return null;
  const selfId = roomSelfId() ?? "";
  const isHost = status.hostSocketId === selfId;
  const saving = status.phase === "ended" && status.players.some(p => !status.ready.includes(p.id));
  const winner = winningRoomMap(status.candidates, status.votes, status.players.map(p => p.id));
  const copyInvite = async () => {
    const url = roomInviteUrl(window.location.href, status.room.id);
    try { await navigator.clipboard.writeText(url); toast.success("Room link copied"); }
    catch { setInvite(url); }
  };
  return <section aria-label="Next round" className="rounded-xl border border-amber-500/25 bg-black/40 p-4 my-4 space-y-3">
    <div className="flex flex-wrap justify-between gap-2 items-center">
      <div><div className="font-bold text-white">{results ? "Stay together · Next round" : "Vote for the arena"}</div>
        <p className="text-xs text-white/60">{status.players.length} operatives · {status.room.name}</p></div>
      <Button variant="outline" size="sm" onClick={copyInvite}>Copy room link</Button>
    </div>
    {invite && <input aria-label="Room invite link" readOnly value={invite} onFocus={e => e.currentTarget.select()} className="w-full bg-black text-white text-xs p-2 rounded" />}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="group" aria-label="Map vote">
      {status.candidates.map(mapId => <button key={mapId} aria-pressed={status.votes[selfId] === mapId}
        onClick={() => roomSend({ t: "voteMap", mapId })}
        className={`rounded-lg border p-2 text-left text-sm ${status.votes[selfId] === mapId ? "border-amber-400 bg-amber-500/15 text-amber-200" : "border-white/20 text-white/80"}`}>
        <span className="block font-semibold">{getMap(mapId).name}</span>
        <span className="text-xs">{Object.values(status.votes).filter(v => v === mapId).length} votes{mapId === status.room.mapId ? " · Rematch" : ""}</span>
      </button>)}
    </div>
    <p className="text-xs text-white/50">Leading: {getMap(winner).name}. Ties keep the first arena. You can change your vote until the host starts.</p>
    {results && <>
      <p className="text-xs text-white/60">{status.players.map(p => `${p.name}${p.id === status.hostSocketId ? " (host)" : ""}`).join(" · ")}</p>
      {isHost ? <Button disabled={saving || !roomSocketConnected()} onClick={() => roomSend({ t: "startMatch" })} className="w-full bg-amber-600 hover:bg-amber-500">
        {saving ? `Saving results · ${status.ready.length}/${status.players.length} ready` : "Start next round"}
      </Button> : <p className="text-sm text-amber-200" role="status">{saving ? "Saving results…" : "Waiting for the host to start the next round."}</p>}
    </>}
  </section>;
}
