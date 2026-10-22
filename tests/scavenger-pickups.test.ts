import { describe, expect, test } from "bun:test";
import { canCollectScavengerDrop, shouldCreateScavengerDrop } from "../src/lib/scavenger-pickups";
import { SCAVENGER_DROP_LIFETIME_MS, SCAVENGER_PICKUP_ARM_MS, SCAVENGER_PICKUP_RADIUS } from "../src/lib/perks";

describe("Scavenger packs belong only to the player who earned them", () => {
  test("ordinary and bot kills create no packs unless the killer has Scavenger", () => {
    expect(shouldCreateScavengerDrop("attacker", "victim", null)).toBe(false);
    expect(shouldCreateScavengerDrop("attacker", "victim", "battle_hardened")).toBe(false);
    expect(shouldCreateScavengerDrop("attacker", "victim", "scavenger")).toBe(true);
    expect(shouldCreateScavengerDrop("attacker", "attacker", "scavenger")).toBe(false);
    expect(shouldCreateScavengerDrop(null, "victim", "scavenger")).toBe(false);
  });

  const expiresAt = 100000 + SCAVENGER_DROP_LIFETIME_MS;
  const base = {
    now: 100000 + SCAVENGER_PICKUP_ARM_MS + 1,
    expiresAt, distance: SCAVENGER_PICKUP_RADIUS / 2,
    collectorId: "killer", ownerId: "killer",
    alive: true, perkId: "scavenger",
    mode: "ffa", collectorTeam: "ffa", defeatedTeam: "ffa",
  };

  test("other Scavengers cannot steal a pack another player earned", () => {
    expect(canCollectScavengerDrop(base)).toBe(true);
    expect(canCollectScavengerDrop({ ...base, collectorId: "other" })).toBe(false);
    expect(canCollectScavengerDrop({ ...base, perkId: "quickdraw" })).toBe(false);
    expect(canCollectScavengerDrop({ ...base, alive: false })).toBe(false);
  });

  test("pack requires proximity, a completed arming delay, and enemy elimination", () => {
    expect(canCollectScavengerDrop({ ...base, distance: SCAVENGER_PICKUP_RADIUS + 0.01 })).toBe(false);
    expect(canCollectScavengerDrop({ ...base, now: 100000 + SCAVENGER_PICKUP_ARM_MS - 1 })).toBe(false);
    expect(canCollectScavengerDrop({ ...base, now: expiresAt })).toBe(false);
    expect(canCollectScavengerDrop({ ...base, mode: "tdm", collectorTeam: "blue", defeatedTeam: "blue" })).toBe(false);
    expect(canCollectScavengerDrop({ ...base, mode: "tdm", collectorTeam: "red", defeatedTeam: "blue" })).toBe(true);
  });
});
