import { describe, expect, test } from "bun:test";
import { deathCauseLabel } from "../src/lib/death-cause";
import { EQUIPMENT } from "../src/lib/equipment";

describe("elimination source labels",()=>{
  test("tactical kills name the actual item rather than inventing an environment kill",()=>{
    for(const equipment of EQUIPMENT)
      expect(deathCauseLabel("equipment_"+equipment.id)).toBe(equipment.name);
    expect(deathCauseLabel("equipment_frag")).toBe("Frag Grenade");
    expect(deathCauseLabel("equipment_frag")).not.toContain("Environment");
  });
  test("standard weapons and genuine environment hazards keep their labels",()=>{
    expect(deathCauseLabel("rifle_ar")).not.toContain("Environment");
    expect(deathCauseLabel("hazard_spikes")).toBe("Environment: spikes");
  });
});
