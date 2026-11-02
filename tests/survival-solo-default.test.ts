import { expect, test } from "bun:test";
import { useGame } from "../src/lib/game-store";
import { roomCapacity } from "../src/lib/game-protocol";

test("Survival room creation defaults to solo and allows opting into co-op", () => {
  const previous = useGame.getState().roomConfig;
  try {
    expect(previous.survivalPlayers).toBe(1);
    useGame.getState().setRoomConfig({ mode: "survival" });
    expect(useGame.getState().roomConfig.survivalPlayers).toBe(1);
    expect(roomCapacity("survival", 5)).toBe(1);
    expect(roomCapacity("survival", 5, 1)).toBe(1);
    useGame.getState().setRoomConfig({ survivalPlayers: 2 });
    expect(useGame.getState().roomConfig.survivalPlayers).toBe(2);
    expect(roomCapacity("survival", 5, 2)).toBe(2);
  } finally {
    useGame.setState({ roomConfig: previous });
  }
});
