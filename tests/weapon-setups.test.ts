import {describe,expect,test} from "bun:test";
import {parseWeaponSetups,rememberSetup} from "../src/lib/weapon-setups";
describe("per-weapon persistent setup memory",()=>{
 test("keeps multiple distinct skins and attachment loadouts across swaps",()=>{
   const sets=parseWeaponSetups("{}");
   rememberSetup(sets,"rifle_ar","crimson",'{"sight":"sight_red_dot","barrel":null}');
   rememberSetup(sets,"shotgun_combat","frost",'{"magazine":"mag_slug"}');
   const roundTrip=parseWeaponSetups(JSON.stringify(sets));
   expect(roundTrip.rifle_ar.skin).toBe("crimson");
   expect(roundTrip.rifle_ar.attachments.sight).toBe("sight_red_dot");
   expect(roundTrip.shotgun_combat.attachments.magazine).toBe("mag_slug");
 });
 test("rejects malformed and prototype-poisoning saved IDs",()=>{
   expect(parseWeaponSetups("oops")).toEqual({});
   expect(Object.hasOwn(parseWeaponSetups('{"__proto__":{"skin":"bad"}}'),"__proto__")).toBe(false);
 });
});
