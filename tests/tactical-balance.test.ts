import {describe,expect,test} from "bun:test";
import {equipmentById} from "../src/lib/equipment";
import {MINE_TRIGGER_RADIUS,MINE_SPLASH_RADIUS,TASER_ADS_BLOCK_MS,isTaserAdsBlocked,
  fragDamage,flashDurationMs,mineSplashDamage,tacticalDirectDamage} from "../src/lib/tactical-balance";
describe("tactical rebalance",()=>{
 test("grenade and flash radii create impactful area control",()=>{
  expect(equipmentById("frag").radius).toBe(12);
  expect(equipmentById("flashbang").radius).toBe(14);
  expect(fragDamage(0)).toBe(140);
  expect(fragDamage(5)).toBeGreaterThan(70);
  expect(fragDamage(9)).toBeGreaterThan(20);
  expect(fragDamage(13)).toBe(0);
  expect(flashDurationMs(5)).toBeGreaterThan(2500);
  expect(flashDurationMs(13)).toBeGreaterThan(1000);
  expect(flashDurationMs(15)).toBe(0);
 });
 test("knife and the mine's trigger are lethal to regular health pools, not bosses",()=>{
  for(const hp of [40,100,160,500]){
   expect(tacticalDirectDamage(140,hp,false)).toBeGreaterThanOrEqual(hp);
  }
  expect(tacticalDirectDamage(140,500,true)).toBe(140);
  expect(equipmentById("knives").damage).toBeGreaterThan(100);
 });
 test("mine is single-target lethal with narrow, minor splash",()=>{
  expect(MINE_TRIGGER_RADIUS).toBeLessThan(MINE_SPLASH_RADIUS);
  expect(MINE_SPLASH_RADIUS).toBeLessThan(2.5);
  expect(mineSplashDamage(0)).toBeLessThan(40);
  expect(mineSplashDamage(2)).toBeLessThan(10);
  expect(mineSplashDamage(2.5)).toBe(0);
 });
 test("taser only jams ADS for its active window; movement and hip-fire are not governed by it",()=>{
  expect(TASER_ADS_BLOCK_MS).toBe(2400);
  expect(isTaserAdsBlocked(2400,0)).toBe(true);
  expect(isTaserAdsBlocked(2400,2399)).toBe(true);
  expect(isTaserAdsBlocked(2400,2400)).toBe(false);
  expect(isTaserAdsBlocked(0,2400)).toBe(false);
  expect(equipmentById("taser").damage).toBe(25);
 });
});
