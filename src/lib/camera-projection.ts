import { adsFieldOfView, type SightDef } from "./game-data";

/** Keep the first-person projection in sync in lobby, countdown AND gameplay.
 * The camera may be created with default settings before saved preferences load.
 * Updating baseFov without refreshing its projection makes the first live frame
 * visibly resize every camera-mounted weapon (and the support-hand rig).
 */
export function syncFirstPersonCameraFov(
  camera: { fov: number; updateProjectionMatrix: () => void },
  baseFov: number,
  sight: Pick<SightDef, "zoom" | "adsFovReduction">,
  adsProgress: number,
  riotShield: boolean,
): void {
  const targetFov = riotShield ? baseFov : adsFieldOfView(baseFov, sight, adsProgress);
  if (Math.abs(camera.fov - targetFov) < 0.00001) return;
  camera.fov = targetFov;
  camera.updateProjectionMatrix();
}
