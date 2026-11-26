import { describe, expect, test } from "bun:test";
import { combatThreats, type CombatHazard } from "../src/lib/combat-threats";

const viewer = {
  id: "viewer", team: "red", freeForAll: false,
  pos: [0, 0, 0] as [number, number, number], yaw: 0, now: 100,
};
const hazard = (weaponId: string): CombatHazard => ({
  id: weaponId, weaponId, pos: [0, 0, 2], radius: 3, expiresAt: 1_000,
  ownerId: "opponent", ownerTeam: "blue",
});

describe("combat threat HUD alerts", () => {
  test("does not advertise Stormweaver mines", () => {
    expect(combatThreats([hazard("wonder_stormweaver")], viewer, () => true)).toEqual([]);
  });

  test("continues advertising other nearby hazards", () => {
    const threats = combatThreats([hazard("wonder_turret")], viewer, () => true);
    expect(threats).toHaveLength(1);
    expect(threats[0].weaponId).toBe("wonder_turret");
    expect(threats[0].action).toBe("Break sight or destroy the turret");
  });
});
