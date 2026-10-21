# Vanguard Ops — map layout and interaction audit

Source baseline: `src/lib/game-protocol.ts`, `src/lib/dynamic-environment.ts`,
`src/lib/bot-routing.ts`, `src/lib/bot-physics.ts` on `dev` (21 October 2026).

**Status:** initial source-level review, not a playtest or final layout approval.
**Purpose:** replace scattered cover and template hazards with designed fighting spaces,
meaningful routes and reliable bot traversal. Keep map edits isolated from Movement V2.

## Overall diagnosis

The arena half-extents are already 60–64 world units (120–128 across), so they
are not uniformly small in absolute size. However, many spawn locations and
landmarks sit in a much tighter inner ring, while large outer expansions have
sparse or weak cover. The current sprint speed is `8.65 * 1.95 = 16.87`
units/second, so players can cross 60 units in approximately 3.6 seconds
before obstacles. Increasing dimensions without fixing layouts could make
the empty stretches worse.

The six maps all reuse the **same five environment object types and nearly
the same coordinates**: fire on the negative-X side; spikes positive-X;
one jump pad at positive-Z; a low moving platform traversing X near positive-Z;
a small destructible wall at negative-Z. These are technically interactive,
but the source does not establish strategic or environmental reasons for
their positions. This is the highest-confidence systemic design problem.

### Static cover audit

Counts below are authored boxes only, excluding generated stair segments.
"Inner / middle / outer" counts include *short* `kind: "cover"` pieces with
centres in Chebyshev-distance bands 0–18 / 18–36 / 36–56 from the map centre,
excluding oversized perimeter walls; platforms, stairs and accents are not
counted as ground-level cover. This is a distribution proxy, **not** a
line-of-sight or walkability measurement.

| Map | Arena width | Cover boxes | Platforms | Stair approaches | Ground-cover bands inner / middle / outer |
| --- | ---: | ---: | ---: | ---: | --- |
| Compound | 128 | 56 | 9 | 13 | 22 / 24 / 6 |
| Skybridge | 128 | 36 | 13 | 18 | 20 / 12 / 0 |
| Bunker | 120 | 32 | 10 | 14 | 16 / 10 / 2 |
| Shipyard | 124 | 49 | 6 | 13 | 13 / 18 / 14 |
| Terminal | 128 | 60 | 3 | 6 | 16 / 24 / 16 |
| Neon Plaza | 128 | 42 | 8 | 11 | 8 / 14 / 16 |

**Important:** wall sections and crates inflate box counts but do not guarantee
useful firefight cover; short, isolated posts are particularly weak against
long-range crossfire. Generated stair boxes further inflate collision counts.

## Per-map design actions

### Compound — defensible three-lane training/combat facility

- **Problem:** a central platform and corner bunkers are identifiable, but
  scattered crates make outer routes feel like unstructured empty space.
  Elevated northern/southern walkways have long exposed segments.
- **Layout pass:** create a readable left / centre / right route network;
  use grouped concrete dividers, checkpoints, vehicle barriers and offset
  entrances to form a sequence of defendable positions every ~18–24 units.
  Maintain two viable flanking paths around every gate.
- **Interactions:** put the destructible wall at a purposeful service access
  connecting two lanes; put fire in a recognisable power/fuel compound with a
  safe bypass; keep spike traps off initial spawn paths; aim the jump pad at a
  usable overlook with an exposed landing.

### Skybridge — contested elevated transit hub

- **Problem:** many tall perches and ramps, but very little useful cover in
  the outer ring (zero qualifying small cover boxes beyond 36 by this proxy).
  Elevated lines of sight can suppress ground-level players.
- **Layout pass:** add cover *on* platforms and at stair heads, not merely
  below them. Add staggered maintenance bays and full-height obstructions
  underneath long bridges. Give every high-value perch at least two
  approach routes and a sheltered disengagement route.
- **Interactions:** place electrified/danger zones beneath a signed
  maintenance crossing; use a destructible door to open a new ground flank.
  A moving lift only belongs here if it reliably carries players/bots and
  connects reachable tiers.

### Bunker — compact interior plus purposeful outer service ring

- **Problem:** dense inner fights contrast with a large, thinly populated
  expansion to the ±50 ring; there are only two qualifying small cover boxes
  in the 36–56 band.
- **Layout pass:** build offset service corridors and two or three connected
  rooms around the original bunker. Segment long axes with bulkheads, short
  corners and alternate doorways, leaving sprint-friendly circulation space.
- **Interactions:** use a destructible bulkhead as a *real shortcut* between
  rooms; spikes should guard an optional security bypass with visible timing,
  rather than sit in the open. Do not add floor pits: existing height logic
  treats the arena floor as a hard minimum of Y=0.

### Shipyard — container yard / loading dock

- **Problem:** the strongest existing theme, but the container footprints
  cluster in straight symmetric rows; the far extensions feel disconnected
  from the central dock and crane routes.
- **Layout pass (best first playable prototype):** make two legible container
  alleys and a wider loading lane, with forklift/container-stack cover at
  their junctions. Offset container mouths for short LOS breaks, and tie
  crane platform access to actual loading structures.
- **Interactions:** fire at a fuel/loading zone, a destructible container
  gate between two routes, and a jump pad that intentionally reaches a
  container-top route. Validate the landing and at least one stair-only
  route for bots.

### Terminal — concourse / kiosks / baggage processing

- **Problem:** repeated evenly spaced kiosks and very low benches produce
  a symmetrical open-floor look. The long centre planter uses `kind:
  "accent"`, meaning it is decorative/nonblocking rather than real cover.
- **Layout pass:** establish check-in/security/baggage clusters with
  zig-zag visibility, luggage carts and robust planters; protect transitions
  between the existing mezzanine and floor. Turn the central planter into
  actual collision/ballistic cover only after checking it does not seal
  circulation or make bot paths invalid.
- **Interactions:** place a breakable security partition at a checkpoint,
  and any timed hazard as an obviously signalled maintenance obstacle.
  A moving platform would be more convincing as a functional baggage
  system than an unexplained open-air platform.

### Neon Plaza — commercial district, not a bare square

- **Problem:** large vacant spaces between the central tower, corners and
  edge cover. Four-corner symmetry plus isolated short boxes offers few
  memorable routes. The bridge platforms need safer approaches.
- **Layout pass:** create shop fronts, alley cuts, holo-billboard sight
  blockers and central cover islands. Preserve a fast central sprint
  channel with flanking paths and a protected lower-level loop.
- **Interactions:** place the shock hazard at a visibly energized
  advertisement/electrical section; use a destructible shutter to reveal
  a market alley. Jump pads should be visibly connected to a reachable
  roof/bridge and not bypass all defensible routes.

## Architectural constraints uncovered

1. `bot-routing.ts` is a coarse **2D** grid A* router, with no height or
   transition-link model. Do not rely on it to find a multi-level path.
2. `bot-physics.ts` permits 0.55-unit steps; the map stair helper generates
   steps no higher than 0.5. This supports walking on authored stairs
   locally, but does not prove the routing algorithm will find them.
3. `makeEnvironmentMap` copies collision cover per room, while moving
   platforms change position over time. Verify player carry, landing,
   client/server sync, and bot traversal before elevating platforms into
   required routes.
4. Dynamic hazards operate in both offline and online gameplay. Relocating
   any object requires checking collision, spawns, telegraphing, damage
   cooldowns and replica state—not merely updating its coordinates.
5. `kind: "accent"` is skipped by physical/ballistic cover checks. Props
   intended to shelter a player must use meaningful solid/cover geometry.

## Recommended implementation sequence

1. **Shipyard vertical/cover pilot**: keep the existing map boundary at
   first; replace scatter with authored junction cover and clearly marked
   loading lanes. Reposition one jump pad and one destructible wall by
   gameplay purpose; ensure an alternate non-jump route.
2. **Bot navigation milestone**: height-aware surface graph or explicit
   links for each staircase, jump and drop. Shared traversal costs for
   local bots and server bots; stuck recovery and unreachable-goal fallback.
3. **Skybridge + Bunker**: fix unprotected elevated landing points and
   empty outer-ring cover first; then correct environment placements.
4. **Compound, Terminal, Neon**: thematic route identity, LOS segmentation,
   meaningful access and deliberate interaction positions.
5. **Only then revisit area dimensions**: prototype width 150–170 on maps
   that still feel compressed *after* the active area has usable landmarks
   and cover. Preserve Bunker's CQC identity rather than uniformly scaling
   all maps.

## Playtest / acceptance checklist (targets, not validated results)

- Test 3v3, 5v5, 7v7 and FFA with different bot skills.
- Every meaningful spawn has at least two unobstructed exits and a nearby
  cover option; no spawn is forced through active damage.
- Every long sightline has a credible break/retreat route; routes include
  alternating *hard* cover, not only small decorative scatter.
- At least two plausible approaches to each elevated fighting position;
  bots demonstrably reach both levels without phasing through boxes.
- Every hazard communicates **what it is, where it acts, and how to avoid it**.
  Each destructible object opens a real tactical option.
- Time traversal from spawn to first engagement and count engagements per
  lane; compare before/after rather than treating arena size as success.
- Verify no bot gets permanently stuck against new geometry; verify
  local/online collision and environment synchronisation.
- FPS/frame-time check with all stair and cover boxes loaded.
