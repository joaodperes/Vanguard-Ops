"use client";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import { useGame } from "./game-store";
import { resolveGameServerConnection } from "./game-network";
import type { RoomStatus, S2C, C2S } from "./game-protocol";

// The room owns its connection; engines are disposable round views.
let socket: Socket | null = null;
let status: RoomStatus | null = null;
const listeners = new Set<() => void>();
function notify() { for (const listener of listeners) listener(); }
export const subscribeRoom = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getRoomStatus = () => status;
export const getServerRoomStatus = () => null;
export const roomSelfId = () => socket?.id;
export const roomSocketConnected = () => socket?.connected === true;
export function roomSend(message: C2S) { socket?.emit("message", message); }

export function acquireRoomSocket(): Socket {
  if (socket) return socket;
  const { socketUrl, socketPath } = resolveGameServerConnection(window.location);
  socket = io(socketUrl, { path: socketPath, transports: ["polling", "websocket"],
    reconnection: true, reconnectionAttempts: 8, reconnectionDelay: 1000, timeout: 10000 });
  socket.on("message", (message: S2C) => {
    if (message.t === "roomError" && useGame.getState().screen === "results") toast.error(message.message);
    if (message.t === "roomStatus") { status = message.status; notify(); }
    if (message.t === "roomJoined") {
      const state = useGame.getState();
      const previous = state.roomConnect;
      state.setRoomConnect({ kind: "join", roomId: message.matchId, roomName: message.roomName,
        password: previous?.password ?? previous?.config?.password ?? null });
      // Quick Play can pick another arena. Rebuild its geometry before playing.
      if (message.mapId !== state.playConfig.mapId || message.mode !== state.playConfig.mode) {
        useGame.setState({ playConfig: { ...state.playConfig, mode: message.mode, mapId: message.mapId },
          roundSerial: state.roundSerial + 1 });
      }
    }
    if (message.t === "roundLaunched") {
      const state = useGame.getState();
      state.setRoomConnect({ kind: "join", roomId: message.roomId,
        password: state.roomConnect?.password ?? state.roomConnect?.config?.password ?? null });
      useGame.setState({ screen: "playing", matchResult: null, roundSerial: state.roundSerial + 1,
        playConfig: { ...state.playConfig, online: true, mode: message.mode, mapId: message.mapId,
          scoreLimit: message.config.scoreLimit, timeLimit: message.config.timeLimit / 60,
          survivalTier: message.config.survivalTier } });
    }
  });
  socket.on("disconnect", () => {
    if (status) status = { ...status };
    notify();
    if (useGame.getState().screen === "results") toast.error("Room connection lost. Open match setup to rejoin.");
  });
  socket.on("connect", notify);
  return socket;
}

export function releaseRoomSession() {
  const current = socket;
  socket = null; status = null;
  current?.emit("message", { t: "leaveRoom" } satisfies C2S);
  current?.disconnect();
  notify();
}
