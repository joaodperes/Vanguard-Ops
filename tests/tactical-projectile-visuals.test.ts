import {describe,expect,test} from "bun:test";
import {EQUIPMENT} from "../src/lib/equipment";
import {tacticalProjectileVisual,TACTICAL_PROJECTILE_VISUAL_IDS} from "../src/lib/tactical-projectile-visuals";

describe("tactical flight readability",()=>{
  test("every tactical has its own compact flight styling",()=>{
    expect([...TACTICAL_PROJECTILE_VISUAL_IDS].sort()).toEqual(EQUIPMENT.map(e=>e.id).sort());
    for(const item of EQUIPMENT){
      const style=tacticalProjectileVisual(item.id);
      expect(style.color).toBeGreaterThan(0);
      expect(style.haloRadius).toBeGreaterThanOrEqual(.25);
      expect(style.haloRadius).toBeLessThanOrEqual(.32);
      expect(style.trailWidth).toBeGreaterThan(0);
      expect(style.trailLength).toBeGreaterThanOrEqual(.75);
      expect(style.trailLength).toBeLessThanOrEqual(1.15);
    }
    expect(new Set(EQUIPMENT.map(e=>tacticalProjectileVisual(e.id).color)).size).toBe(EQUIPMENT.length);
  });
  test("unknown item defaults to safe visible styling",()=>{
    expect(tacticalProjectileVisual("unknown")).toEqual(tacticalProjectileVisual("frag"));
  });
});
