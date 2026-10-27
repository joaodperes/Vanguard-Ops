import { describe, expect, test } from "bun:test";
import { ctfFeedback } from "../src/lib/ctf-feedback";

describe("CTF event announcements", () => {
  test("a delivered flag is never described as lost", () => {
    expect(ctfFeedback("capture", "blue", "me", "me", "red")).toEqual({
      label: "FLAG DELIVERED! +75 XP / +30 CR", sound: "flag_scored",
    });
    expect(ctfFeedback("drop", "blue", "me", "me", "red")).toEqual({
      label: "FLAG LOST!", sound: "flag_lost",
    });
  });

  test("captures and pickups are positive for every teammate, negative for opponents", () => {
    expect(ctfFeedback("capture", "blue", "ally", "me", "red")).toEqual({
      label: "TEAM SCORED!", sound: "flag_scored",
    });
    expect(ctfFeedback("capture", "blue", "foe", "me", "blue")).toEqual({
      label: "ENEMY SCORED!", sound: "flag_enemy_scored",
    });
    expect(ctfFeedback("pickup", "blue", "ally", "me", "red").sound).toBe("flag_taken");
    expect(ctfFeedback("pickup", "blue", "foe", "me", "blue")).toEqual({
      label: "YOUR FLAG TAKEN!", sound: "flag_lost",
    });
  });

  test("return/drop notifications describe who has the flag", () => {
    expect(ctfFeedback("return", "red", "me", "me", "red").sound).toBe("flag_returned");
    expect(ctfFeedback("drop", "red", "foe", "me", "red").sound).toBe("flag_returned");
    expect(ctfFeedback("drop", "red", "foe", "me", "blue").sound).toBe("flag_lost");
    expect(ctfFeedback("auto_return", "red", "server", "me", "red")).toEqual({
      label: "YOUR FLAG AUTO-RETURNED!", sound: "flag_returned",
    });
    expect(ctfFeedback("auto_return", "red", "server", "me", "blue").sound).toBeNull();
  });
});
