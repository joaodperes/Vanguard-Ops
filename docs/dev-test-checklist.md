# Vanguard Ops — Dev branch QA checklist

**Target branch:** `dev` (not `main`).  
**Status:** changes committed; no live browser/gameplay test has been run by the assistant.

## 1. Pull, install, and run automated checks

```bash
git fetch origin
git switch dev
git pull --ff-only origin dev
bun install --frozen-lockfile
bun run test:smoke
bun run typecheck
bun run build
```

The smoke suite contains:
- `tests/movement-rules.test.ts`: ground acceleration, braking, reversal,
  mobile sprint hysteresis, buffered jumps, and frame-rate response.
- `tests/bot-routing.test.ts`: ground passage under overhead bridges,
  steep-wall rejection, stairs/raised roofs, hazard avoidance.
- `tests/map-layout.test.ts`: all six maps, outer-ring layouts, **all**
  spawn points, destructible gates, safe hazards and all 75 staircase crests.

`bun run test:movement`, `bun run test:maps`, and `bun run test:bots`
run the individual groups. `bun run typecheck` runs `tsc --noEmit`.
A `dev`-only GitHub Actions workflow is also included; confirm it is enabled
in repository Actions settings if no job appears.

## 2. Movement feel

Compare keyboard/mouse and touch:
- WASD from idle: immediate, predictable acceleration. Release should stop
  promptly without an icy drift; A↔D reversals should feel crisp.
- While airborne: retain enough momentum but permit correction, with no
  sudden change to maximum sprint speed.
- Tap Space just before landing: one buffered jump. Tap just after stepping
  off a ledge: ledge grace. Holding Space should **not** auto-bunny-hop.
- Try platform/stair steps vs chest-high crates. Players and bots now share
  0.55-unit automatic step height; higher cover should require jumping.
- Sprint + ads-perk, reload interruption, stamina cooldown, jump pads,
  moving platforms and respawn all still function.
- Touch stick: sprint engages ~0.73 stick magnitude when moving forward;
  remains active until ~0.62, without rapidly flickering at the threshold.

## 3. Map combat / environment

Check **Compound, Skybridge, Bunker, Shipyard, Terminal, Neon Plaza** in
FFA and team modes. At least one offline bot match and one online room should
be tested per map.

- Explore far outer edges: new spawn zones must be connected to the action
  and have genuinely useful hard-cover routes (not isolated decorations).
- Break a themed destructible door: the destroyed panel must open a
  **real passage** between intact fixed side walls.
- Compare central sightlines with outer flanks. No spawn should have only
  one escape direction or face an unavoidable active hazard.
- Fire should look purposeful (fuel/service/electrical locations); timed
  spikes must be visible *before* they become dangerous.
- Test jump-pad landing zones on Compound, Skybridge, Shipyard and Neon
  Plaza; stairs must provide a non-jump route to elevated spaces.
- Verify optional moving platforms in Shipyard/Terminal/Neon do not cause
  player or bot clipping, jitter, teleporting, or client/server desync.
- Neon Plaza: walk below and on the raised bridge, including the corner
  platforms and their lower-level spawns.
- Shipyard: test stacked container roofs and stair access; inspect crane
  overlaps from the first-person camera.

## 4. Bot navigation (highest-risk area)

- Follow bots from the ground up every major staircase, across a bridge,
  and back down. Confirm a genuine traversable route rather than
  teleporting or walking through solid cargo/cover.
- Test elevated player targets vs ground bots. Can bots find the stair
  approach and advance toward the correct *height*?
- Check that bots avoid active/visible hazards and can use new destructible
  shortcuts after the panel disappears.
- Watch for repeated route re-planning, standing still while aiming at
  elevated enemies, headbanging against cover and occasional stuck recovery.
- Compare offline and online bots using the **same map and difficulty**.
  Routing is shared, but movement loops and environment timing are separate.

## 5. Performance

New cover and corrected stairs add collision checks. Record frame-time/FPS
with high bot counts (prefer 3v3, 5v5 and 7v7) and compare to the prior
`main` build. Also check server tick stability under online bots.
The nav search has a hard expansion budget and broadphase pruning; this
still needs measurement, especially in Skybridge and Bunker.

## What to report back

Please send: map, game mode (offline/online), bot count, reproduction steps,
expected vs observed behavior, and any browser console/server log error.
A short video of a bot stuck near stairs or moving platforms is particularly
helpful. Please keep `main` unchanged until these checks pass.
