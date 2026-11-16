# Large-map and crowded-match performance

This pass extends the existing city optimizations across the shared runtime.
It changes scheduling and presentation, not catalog values, player limits,
collision dimensions, damage, weapon cadence or authoritative tick rate.

## Runtime changes

- Non-city static cover is merged by material, shadow flags and 64-unit map
  cells. Existing world UVs are baked into the resulting geometry. Ballistic
  panels, moving objects and name-addressable parts stay independent. City
  instancing retains its existing spatial batches.
- Client and server share a cached static cover index with a live overlay for
  environment boxes. Platforms keep their current positions; wall destruction,
  deployed cover and freight stage changes invalidate the relevant cache.
  Movement, LOS and common weapon rays use conservative local candidates and
  retain the existing exact collision/penetration resolver. Very broad or
  invalid queries cannot create unbounded grid loops.
- Bot target acquisition and separation use an actor grid rebuilt once per AI
  pass and updated after each bot moves. Original roster ordering and the
  separation solver's maximum accumulated push are preserved. Existing
  perception/decision cooldowns remain; offline A* has a 50 ms budget window
  instead of receiving another search allowance at every rendered frame.
  Movement and combat continue at their normal rates.
- Ordinary movement state is coalesced to at most 30 Hz, with a 250 ms idle
  heartbeat. Aim, firing, sprint and reload transitions are sent immediately.
  Shot/event messages keep their existing immediate path. The budget resets
  on reconnection. The server still broadcasts authoritative snapshots at 20 Hz.
- Ordinary third-person weapon swaps retain the body, joints, skin material,
  armor and nameplate. Only the weapon assembly is replaced. Appearance changes
  still rebuild the complete character. Shared resources are disposed once,
  and static weapon pieces are batched. Tiny charms and unreadable labels use
  distance LOD; ADS restores them and body/weapon silhouettes stay visible.
- Authored map lights retain their logical flicker and visible fixtures, but
  feed a fixed pool of 6/10/20 rendered lights for Performance/Balanced/Quality.
  The closest influential sources are selected every 100 ms. Gravity fields
  use the same pool, so concurrent fields do not add shader light variants.
  Idle pooled lights remain visible at zero intensity. Directional lighting,
  shadows and the existing explosion pool retain their roles.

## Measurements and limits

`bun run perf:benchmark` runs a deterministic CPU and primitive-batching
experiment. It performs five measured batches of 1,000 ground-support queries
after warmup, using spawn positions plus small offsets. It checks identical
full-scan/indexed results. These are microbenchmarks, not whole-frame or GPU
timings; the city already used an index before this pass.

An isolated run on 2026-11-13 produced:

| Map | Cover boxes | Mean local candidates | Full scan, 1,000 queries | Indexed, 1,000 queries |
| --- | ---: | ---: | ---: | ---: |
| Castle / Emberhold | 630 | 4.0 | 4.224 ms | 1.754 ms |
| Floodgate | 267 | 0.3 | 5.525 ms | 0.552 ms |
| Afterlight night | 2,568 | 0.8 | 32.834 ms | 0.697 ms |
| Forest Warfare | 253 | 0.3 | 3.372 ms | 0.713 ms |

A separate comparison ran the actual `buildArena` methods from base commit
`23f18b3` and this implementation without a GPU (Canvas2D textures omitted in
both). It counted the base arena meshes, including ground and cover, before
decorative prop and avatar construction:

| Map | Arena meshes before | Arena meshes after | Triangle count, both |
| --- | ---: | ---: | ---: |
| Castle / Emberhold | 615 | 366 | 7,050 |
| Floodgate | 300 | 183 | 3,290 |
| Afterlight night | 231 | 231 | 18,216 |

World bounds matched to Float32 precision (less than 0.000002 units). Mesh
counts are not actual draw calls: visibility and shadow passes also matter.

Over ten seconds of continuous movement with stable combat flags, the send
budget produced 300 packets at 60 FPS, 288 at 144 FPS and 300 at 240 FPS,
versus 600, 1,440 and 2,400 with the former per-frame sender. Immediate combat
transitions can intentionally exceed that movement-only ceiling.

## Diagnostics and validation

`FPSEngine.getPerformanceStats()` returns recent frame/update/render percentiles,
draw calls, triangles, uploaded geometry/texture counts, shader count, pixel
ratio and cumulative movement packets. Renderer counters cover all passes in
one logical frame. Render milliseconds measure CPU submission; frame intervals
also include browser/GPU stalls. No diagnostic overlay or public endpoint is
added. Server-side load tools can import `getGameServerPerformanceStats()` to
inspect recent room tick percentiles.

`tests/large-map-performance.test.ts` checks collision/penetration equivalence
across every shipped map, moving/destructible geometry, Floodgate transitions,
dense-crowd separation, packet scheduling, UV/bounds preservation, body resource
reuse, light budgets and bounded diagnostics. `tests/multiplayer-performance.test.ts`
uses a disposable SQLite database and real Socket.IO clients to start full
Castle, Afterlight and Floodgate rooms, including 32 human clients. It verifies
authoritative snapshots, finite actor state and bounded movement traffic.
Set `VANGUARD_PERFORMANCE_REPORT` to a local path to retain its tick diagnostics.

Local production build, catalog validation, types and the full regression suite
must pass. Browser rendering benchmarks were blocked in this execution
environment: Chromium could not create its required Unix sockets, escalation
was disallowed, and the shared browser could not reach the isolated local
listener. A live GPU/visual stress test is still required before promotion:
check night lighting, scoped distant players, firefights, destroyed panels,
moving platforms and the Floodgate breach. Follow `dev-test-checklist.md`.

Snapshot metadata/delta compression, distance-based network interest management
and baked lighting remain separate follow-up work; this pass does not change
the snapshot protocol.
