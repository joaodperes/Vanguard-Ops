import { describe, expect, test } from "bun:test";
import { syncFirstPersonCameraFov } from "../src/lib/camera-projection";

function mockCamera(initialFov: number) {
  return {
    fov: initialFov,
    projections: 0,
    updateProjectionMatrix() { this.projections++; },
  };
}

const iron = { zoom: 1, adsFovReduction: 10 };

describe("first-person camera projection across match phases", () => {
  test("saved FOV takes effect during countdown, with no jump at GO", () => {
    const camera = mockCamera(90); // engine constructed before persisted settings load
    syncFirstPersonCameraFov(camera, 70, iron, 0, false);
    expect(camera.fov).toBe(70);
    expect(camera.projections).toBe(1);

    // Rendering a countdown frame and then a live frame should be identical.
    syncFirstPersonCameraFov(camera, 70, iron, 0, false);
    syncFirstPersonCameraFov(camera, 70, iron, 0, false);
    expect(camera.fov).toBe(70);
    expect(camera.projections).toBe(1);
  });

  test("live FOV changes update the camera once, even outside gameplay", () => {
    const camera = mockCamera(90);
    syncFirstPersonCameraFov(camera, 105, iron, 0, false);
    expect(camera.fov).toBe(105);
    expect(camera.projections).toBe(1);
    syncFirstPersonCameraFov(camera, 105, iron, 0, false);
    expect(camera.projections).toBe(1);
  });

  test("ADS still zooms normally and returns to hipfire", () => {
    const camera = mockCamera(90);
    syncFirstPersonCameraFov(camera, 90, iron, 0.5, false);
    expect(camera.fov).toBe(85);
    syncFirstPersonCameraFov(camera, 90, iron, 1, false);
    expect(camera.fov).toBe(80);
    syncFirstPersonCameraFov(camera, 90, iron, 0, false);
    expect(camera.fov).toBe(90);
  });

  test("riot shield remains at base FOV while raised", () => {
    const camera = mockCamera(90);
    syncFirstPersonCameraFov(camera, 76, { zoom: 4, adsFovReduction: 8 }, 1, true);
    expect(camera.fov).toBe(76);
  });
});
