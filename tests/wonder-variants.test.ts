import {expect,test} from "bun:test";
import {WEAPONS} from "../src/lib/game-data";
test("unmerged derivative Wonder prototypes are replaced with genuinely new mechanics",()=>{
  for(const id of ["wonder_rift_needle","wonder_miasma_bloom","wonder_caustic_javelin"])expect(WEAPONS.some(w=>w.id===id)).toBe(false);
});
