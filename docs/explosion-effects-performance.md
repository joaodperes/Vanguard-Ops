# Explosion effect performance

## Cause and rendering budget

Each explosion previously allocated a sphere, material and PointLight, then removed them after its flash. A cluster burst repeatedly changed the scene's point-light count. Three.js includes that count in its shader program key (`WebGLPrograms`); the changes forced lit world/avatar materials to compile additional variants during combat.

`src/lib/explosion-effects.ts` now owns a cosmetic pool of 12 unlit, low-poly explosion meshes sharing one geometry, plus one permanent non-shadowing point light. The light remains visible at zero intensity while idle. Active flashes only change uniforms (position, color, intensity and range), keeping the light count and shader layout constant. Nearby/recent effects take precedence when the pool is full; distant effects are culled. Slots are hidden/reused rather than inserted, removed or disposed during bursts. Shared geometry and per-slot materials are disposed once on engine shutdown.

Explosion audio is distance-attenuated and adjacent reports share a 100 ms audio budget. A full bomblet burst remains audible without creating six overlapping sets of launcher audio graphs. Visual expiry and the shared light update before the death-camera return, so an owner's death cannot leave lights or explosion meshes frozen.

The effect pool has no damage authority. Fuse times, ballistic paths, blast radius, damage, cover checks, charge economy and server hit resolution are unchanged. Cosmetic rejection does not bypass the caller's combat calculation. No catalog or protocol change is needed.

## Verification

The isolated headless Chromium software-rendering comparison used the same firing-range scene and seven sequential detonations:

| Metric | Before | After |
| --- | ---: | ---: |
| Shader programs across the burst | 8 → 36 | 8 → 8 |
| Point lights in the scene | 3 → 10 | 4 → 4 |
| Newly uploaded explosion geometries | 7 | 1 shared |
| Measured render time per detonation | 354–490 ms | 3–31 ms |

These timings describe the test browser, not a promised frame rate on another device. The key regression contract is zero additional shader variants and constant light/geometry budgets across the burst.

`tests/explosion-effects.test.ts` exercises fixed light count, node/geometry reuse, overload admission, proximity prioritization, expiry, idempotent disposal, audio coalescing and unchanged offline damage under visual saturation. Browser stress testing also exercises real local firing and overlapping replicated `clusterVolley` messages, then checks effect cleanup, shader counts and the visual cap. Existing two-client gameplay tests verify authoritative damage separately.

Run the normal `bun run test:smoke`, `bun run typecheck` and `bun run build` checks. For manual GPU verification, fire both charges in the firing range, repeat after recharge, and compare a crowded online firefight. Listen for a short combined burst rather than stacked full-volume reports, and inspect shader/program counts during detonations if investigating another device-specific stall.
