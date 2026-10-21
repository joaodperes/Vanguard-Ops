# Vanguard Ops dev — playtest and validation checklist

Branch: `dev` (do **not** merge into `main` until evaluated).

## Run checks locally (does not use paid GitHub Actions minutes)

```bash
git switch dev
git pull
bun install --frozen-lockfile
bun run test:smoke
bun run typecheck
bun run build
bun run dev
```

Tests: `tests/movement-rules.test.ts`, `tests/bot-routing.test.ts`,
`tests/map-layout.test.ts`, and `tests/map-footprint.test.ts`.
`tsconfig.json` intentionally excludes Bun-only test files from the
Next.js application typecheck. They are covered by the Bun smoke suite.

## Player movement

- From rest, press/release WASD and reverse A→D / W→S repeatedly.
- Confirm instant braking and quick reversal without wall-hugging jitter.
- Tap jump shortly before landing; tap immediately after walking off a ledge.
- Verify holding Space does not cause automatic repeated jumps.
- Jump while sprinting, turn in midair, land on stairs and low cover.
- Repeat touch joystick tests: sprint activates at ~73% forward push and
  disengages below ~62%, without flickering at the threshold.
- Check frame-time consistency on slower/mobile devices.

## Map size and pacing

| Category | Map | Approximate full XZ footprint |
| --- | --- | ---: |
| Compact | Bunker | 98 × 98 |
| Compact | Shipyard | 112 × 112 |
| Balanced | Compound | 125 × 125 |
| Balanced | Terminal | 133 × 133 |
| Tactical | Skybridge | 145 × 145 |
| Tactical | Neon Plaza | 152 × 152 |

The map selector has an explicit pace filter; dimensions reflect XZ scaling
of base maps. Geometry, steps, spawns, hazards, jump launch vectors and lights
are scaled together. Player movement speed and collision radius are unchanged.
These are **design targets awaiting playtest**, not validated balance values.

For each map:
- Inspect all FFA/TDM spawn sites and exits, including new outer spawns.
- Run 3v3/5v5/7v7 with and without bots.
- Confirm at least two safe routes from spawn to the map centre.
- Check rooftop stair landings, rail-free elevated cover and fall recovery.
- Test destructible doors: actual route opening and safe alternate paths.
- Check hazard telegraphs and damage timing; avoid forced spawn hazards.
- Test every jump pad's **actual landing destination**, including movement
  carried into launch, and check that bots have stair alternatives.
- Check moving platforms only as optional routes (not essential links).
- Measure distance/time to first encounter and average fight frequency.
- Look for graphics/collision gaps introduced by uniformly scaling XZ.

## Online/offline parity

- Repeat a bot stair approach both offline and in an online room.
- Watch bots pursue players above them and below elevated bridges.
- Confirm bots never phase through containers or 'climb' tall solid walls.
- Observe AI against the redesigned checkpoint doors before/after destruction.
- Check time spent stationary/stuck near cover; record map and positions.
- Confirm player position and environmental damage replicate correctly.

## Actions billing / workflow notifications

The `.github/workflows/dev-validation.yml` trigger is **manual-only** to
avoid starting GitHub-hosted runners on every development commit.
The workflow file currently exists on `dev` only. GitHub requires a
`workflow_dispatch` workflow file on the default branch for normal
manual triggering from the Actions UI; run checks locally until it is
promoted to the default branch, or use a temporary review branch workflow
strategy after explicit approval.

Check account Actions allowance/budgets at
https://github.com/settings/billing and configure a hard budget with
**Stop usage when budget limit is reached** if you want to disallow overages.

## Sign-off

- [ ] Smoke tests pass
- [ ] TypeScript passes
- [ ] Next.js production build passes
- [ ] Movement feels responsive desktop/mobile
- [ ] Compact/Balanced/Tactical categories feel meaningfully different
- [ ] Bot route tests pass online and offline
- [ ] All map cover/hazard placements are purposeful and collision-safe
