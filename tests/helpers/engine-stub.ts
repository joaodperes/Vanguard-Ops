/** Test-only partial-engine construction.
 * FPSEngine's WebGL constructor is intentionally skipped by isolated unit
 * tests. Keep subsystem default collections here, not scattered through
 * unrelated combat tests. Favor pure-function tests for new features.
 */
import {FPSEngine} from "../../src/lib/fps-engine";
export function makeEngineStub(): any {
  return Object.assign(Object.create(FPSEngine.prototype), {
    deployedCovers:new Map(),
  });
}
