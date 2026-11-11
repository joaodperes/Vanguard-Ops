/** Test-only partial-engine construction.
 * FPSEngine's WebGL constructor is intentionally skipped by isolated unit
 * tests. Keep subsystem default collections here, not scattered through
 * unrelated combat tests. Favor pure-function tests for new features.
 */
import {FPSEngine} from "../../src/lib/fps-engine";
export function makeEngineStub(): any {
  return Object.assign(Object.create(FPSEngine.prototype), {
    // Tests that bypass the browser-only WebGL constructor should share these
    // minimal defaults instead of repeating assumptions about new subsystems.
    opts:{mode:"ffa",online:false,loadout:{
      attachments:{sight:null,barrel:null,grip:null,magazine:null},
    }},
    deployedCovers:new Map(),
    // Prototype-only instances skip FPSEngine class-field initializers.
    akimboAmmoBySlot:{primary:{left:0,right:0},secondary:{left:0,right:0}},
    akimboLastHandShotBySlot:{
      primary:{left:-Infinity,right:-Infinity},secondary:{left:-Infinity,right:-Infinity},
    },
    akimboAmmo:{left:0,right:0},
    akimboPending:{left:-Infinity,right:-Infinity},
    akimboLastHandShot:{left:-Infinity,right:-Infinity},
    harbingerDrones:new Map(),
  });
}
