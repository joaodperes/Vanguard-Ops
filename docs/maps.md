# Maps — layouts, routes and map-specific mechanics

This document is the maintained reference for shipped map layouts and their notable
mechanics. The canonical runtime content remains in `src/data/maps/` and the shared
map, objective and event logic in `src/lib/`. Treat this document as an explanatory
guide, not a replacement for those sources.

## Floodgate

Floodgate is a hydroelectric PvP arena for CTF, TDM and Kill Confirmed. Supported
squad sizes include 5v5, 7v7, 9v9 and 16v16; 7v7 is the recommended team size. It
has 16 distinct spawn positions per side, plus a 32-player FFA spawn layout.

### Layout and routes

- **Turbine hall:** Collision-backed roof, alternating generator banks and split
  switchgear. The central approach provides an actual line of fire to the dam.
- **Northern spillway:** Staggered baffles, a five-section dam at the northern
  border, four timed steam grates before collapse, and raised decks for the
  post-collapse fight.
- **Southern maintenance yard:** Freight containers, pallets and a 240-HP
  maintenance shutter; these remain safely outside flood waters.
- **Control bases:** Ground-level flags at x=±132 and deliveries at x=±148.
  Spawn screens and offsets prevent direct base-to-base sniping.

### Dam collapse and flood

Five linked orange/brown structural sections occupy the north playable edge at
z=-99 (boundary near z=-106), spanning x=-56 to x=56. The orange central core
and all four panels share 3,000 HP in a single authoritative pool. Fire into any
exposed section; bullets and explosive hits all contribute to the same health.
A 74-damage Marksman DMR requires 41 registered shots to break the dam. The
240-HP maintenance shutter is independent.

When the dam breaks, all five colliders disappear atomically and the reservoir
is released. The breach cannot reset or be farmed during the match. A large
white-capped flood front travels from z=-103 to z=-36 in 14 seconds. Ground-level
players caught in the moving front take 28 damage per 900 ms, are pushed south
at 10 units/s, and experience a 28% movement-speed reduction. Existing collision
still blocks pushes through walls.

After the surge, low ground inside x=±132 and z=-103..-36 remains flooded for
the rest of the match: 12% movement-speed penalty plus a southbound 2.4-unit/s
current. Outer side-spawn approaches (beyond x=±132), central/south lanes and
elevated decks higher than 2.2 units remain dry. Flooding does not make captures
or team spawns impossible. Timed steam grates stop activating once flood water
overwhelms the northern spillway.

### Freight-container changes

Four upright freight containers at x=±21 and ±88 topple as the flood arrives.
After a 3.2-second fall, they become traversable ramps with eight 0.42-unit
steps and a 3.36-unit-high landing, connecting to the existing northern
overlooks. From each overlook, an 18-tread upper flight rises to the turbine-hall
roof at 11 units, with both dynamic physics and visible geometry.

The upper treads and landing have thin collision slabs matching their metal
decking, permitting shots and ground-level movement underneath wherever existing
static walls and structures leave headroom. The lower fallen container shell and
its first eight risers remain solid. The containers slope north-low to south-high
to match their steps. Before the event they provide cover; while falling,
collision is absent; afterward stair and bridge collision is active. Online bots
replan against the new routes. Reduced flooded-path penalties and a
collision-checked direct fallback let them cross water when dry alternatives
are unreachable. Late joiners receive the correct phase.

### Damage, visuals and audio

All five dam faces develop progressively denser cracks at 80%, 60%, 40% and
20% remaining HP. Cracks are reusable geometry, not additional collision.
The breached wall disappears, torrent falls from the dam, an animated
water-and-foam front crosses the playable strip, spray follows the crest, and
a deep cyan inundation remains on the low ground. The visuals own no physics;
client and server both use `floodgateWaterEffect` for gameplay.

Flooded footsteps use a quieter, lower-pitched splash sound rather than a sharp,
dominant one. Nearby opponent splashes are attenuated by distance, with Silent
Steps and footstep settings respected.

Before collapse, four pressure vents use a 36-second shared repeating period,
with a 7-second warning and 8-second active steam window. Flashing grates
communicate the warning without HUD countdowns. After collapse, vents stop
dealing steam damage and the flood surge replaces them as the northern hazard.

There is no dam integrity, damage percentage or breach-complete HUD banner;
the collapse is communicated spatially. An out-of-date multiplayer-server
warning is allowed to prevent misleading gameplay after an incompatible
deployment. The breach time is recorded in the match environment clock and
replicated in each snapshot (`floodgateBreachAt`), so late joiners see the
correct wave phase or permanent flooded aftermath. Compatibility requires
`floodgateRulesVersion: 6` (updated flood movement and dynamic collision).
Deploying to GitHub `dev` alone does not update a running client/server.

### Implementation references

- Geometry, hazards and spawn points: `src/data/maps/floodgate.json`
  (`blueprint`; old split file is a migration snapshot)
- Colors and non-colliding machinery dressing: `src/data/maps/floodgate.json`
  (`theme`; old split file is a migration snapshot)
- Shared flood geometry/damage predicates: `src/lib/map-battle-events.ts`
- Server-authoritative breach time, flood damage, bot movement and timed-vent
  cancellation: `src/lib/game-server.ts`
- Client prediction, offline damage and bot navigation: `src/lib/fps-engine.ts`
- Reused meshes and advancing wave: `src/lib/floodgate-scenery.ts`
- Deterministic dynamic stairs and bridges: `src/lib/floodgate-topple.ts`
- Dam fracture layers: `src/lib/floodgate-dam-cracks.ts`
- Wet footsteps: `src/lib/sound.ts`

## Whiteout Depot

`whiteout_depot` is a snowbound freight depot and the sixth CTF choice, completing
two rows of three in the desktop map picker. It provides a smaller alternative
to Floodgate: a 256×148 bounding footprint, normal gravity, 3v3/5v5/7v7 teams
and twelve distinct rear spawn positions per side. It also supports TDM and
Kill Confirmed. FFA, Gun Game and Survival are unavailable.

### Layout and routes

- **North platform:** Boxcars sit beside two rails under a platform canopy.
  Windbreaks and freight stacks interrupt the tracks and platform sightlines,
  with room to weave around each obstacle.
- **Freight sheds:** Open-ended, roofed halls have side-door connections and
  staggered cargo stacks. Stair-accessible signal decks offer local elevation
  without a view across the whole map.
- **Service gallery:** The sheltered southern route has several exits to the
  sheds. A 180-HP maintenance hatch at the center opens a direct passage when
  breached; the surrounding routes remain traversable with it intact.

West/east bases mirror each other. Ground flags are at X=±92, delivery rings
at X=±108, both at Z=0. Spawns occupy X=±112/±122 under dispatch canopies,
with independent side exits and forward screens. Base signs and warm lamps
identify the dispatch rooms. Snow surfaces, blue-grey steelwork and amber
platform signs provide the theme without particle effects or new lights per
frame.

### Authoring and validation

Canonical geometry, spawns, hatch, visual theme, objective positions and
optional CTF spawn selection are in
`src/data/maps/whiteout_depot.json`. The former
`src/data/map-blueprints.json`, `src/data/map-themes/whiteout_depot.json`
and `src/data/ctf-layouts.json` are migration/reference snapshots. The unified
document uses the same generic objective contract as Verdant/Ridgefall. The map
has empty legacy cover, spawn and environment arrays, so no unrelated template
objects are inherited. Theme props use existing primitives; all gameplay solids
come from shared geometry.

Run `bun run content:validate` and `bun run typecheck`. Manually check spawn
safety, objective clearance, pickup/delivery routes for both sides, the
intact/breached gallery, sightlines and hatch state isolation. Horizontal
samples alone are not proof against every diagonal or elevated sniper angle.

Human playtests are still required at 3v3, 5v5 and 7v7: compare return times
from both sides, base camping, deck usefulness, the intact/breached gallery,
visibility against snow, KC tag retrieval and frame rate. Automated routing
proves reachability rather than balance.
