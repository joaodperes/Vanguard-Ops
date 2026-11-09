import { expect, test } from "bun:test";
import {
  flashFacingExposure, flashDurationMs,
  TASER_HIPFIRE_SPREAD_MULTIPLIER, taserMovementJitter,
} from "../src/lib/tactical-balance";

const player:[number,number,number]=[0,1,0];

test("flashbang blinds only when within the player's facing arc",()=>{
  const front:[number,number,number]=[0,1,5];
  expect(flashFacingExposure(player,0,front)).toBe(1);
  expect(flashFacingExposure(player,Math.PI,front)).toBe(0);
  expect(flashFacingExposure(player,Math.PI/2,front)).toBe(0);
  expect(flashFacingExposure(player,0,[0,1,-5])).toBe(0);
});
test("flashbang reduces visual exposure progressively at peripheral angles",()=>{
  const partlyInFront:[number,number,number]=[9,1,2];
  const exposure=flashFacingExposure(player,0,partlyInFront);
  expect(exposure).toBeGreaterThan(0);
  expect(exposure).toBeLessThan(1);
  expect(flashFacingExposure(player,0,[5,1,5])).toBe(1);
});
test("flashbang preserves sound duration when turning away",()=>{
  const audibleMs=flashDurationMs(2);
  expect(audibleMs).toBeGreaterThan(0);
  expect(Math.round(audibleMs*flashFacingExposure(player,Math.PI,[0,1,2]))).toBe(0);
  expect(Math.round(audibleMs*flashFacingExposure(player,0,[0,1,2]))).toBe(audibleMs);
});
test("taser's random movement is bounded, stable between updates, and changes over time",()=>{
  const first=taserMovementJitter(1000);
  expect(first).toEqual(taserMovementJitter(1050));
  expect(taserMovementJitter(1220)).not.toEqual(first);
  for(let t=0;t<20000;t+=137){
    const {x,z}=taserMovementJitter(t);
    expect(Math.abs(x)).toBeLessThanOrEqual(.08);
    expect(Math.abs(z)).toBeLessThanOrEqual(.08);
  }
  expect(TASER_HIPFIRE_SPREAD_MULTIPLIER).toBeGreaterThan(1);
});
