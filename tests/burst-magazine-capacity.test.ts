import {describe,expect,test} from "bun:test";
import {WEAPONS,computeEffectiveStats,burstAlignedMagSize,compatibleAttachments} from "../src/lib/game-data";
const empty={sight:null,barrel:null,grip:null,magazine:null};
describe("burst magazine capacity",()=>{
  test("always carries complete bursts",()=>{
    expect(burstAlignedMagSize(21,3)).toBe(21);
    expect(burstAlignedMagSize(26,3)).toBe(27);
    expect(burstAlignedMagSize(17,2)).toBe(18);
    expect(burstAlignedMagSize(1,3)).toBe(3);
    expect(burstAlignedMagSize(17,undefined)).toBe(17);
  });
  test("all burst weapons keep burst-sized magazines across compatible attachments",()=>{
    const burstWeapons=WEAPONS.filter(w=>(w.stats.burst??1)>1&&!w.disabled);
    expect(burstWeapons.length).toBeGreaterThan(2);
    for(const weapon of burstWeapons)for(const magazine of [null,...compatibleAttachments(weapon.id,"magazine")]){
      const stats=computeEffectiveStats(weapon,{...empty,magazine});
      expect(stats.magSize%weapon.stats.burst!).toBe(0);
    }
  });
});
