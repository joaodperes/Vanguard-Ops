// Standalone entry for the game server (bun run dev).
// In the sandbox we actually run the server inside the Next.js process via
// src/instrumentation.ts (detached processes get reaped). This file remains
// for standalone / non-sandbox usage and keeps the mini-service contract.
import { startGameServer } from "../../src/lib/game-server";

startGameServer(3003);
