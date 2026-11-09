# Floodgate

Floodgate is a hydroelectric PvP arena for CTF, TDM and Kill Confirmed. Supported squad sizes include 5v5, 7v7, 9v9 and 16v16; 7v7 is the recommended team size. It has 16 distinct spawn positions per side, plus a 32-player FFA spawn layout.

## Dam collapse — a one-time match-changing flood

- **Dam placement:** Five linked orange/brown structural sections occupy the north playable edge at **z=-99** (boundary near z=-106), spanning x=-56 to x=56. The orange central core and all four panels share **3,000 HP** in a single authoritative pool.
- **Damage:** Fire into any exposed dam section; bullets and explosive hits all contribute to the same health. A 74-damage Marksman DMR requires **41 registered shots** to break the dam. The 240-HP maintenance shutter remains independent.
- **Collapse:** All five dam colliders disappear atomically, opening the northern view and releasing the reservoir. This cannot reset or be farmed during the match.
- **Hydraulic surge:** A large white-capped flood front travels from z=-103 to z=-36 in **14 seconds**. Ground-level players caught in the moving front take **28 damage per 900 ms**, are pushed south at 10 units/s, and experience a 28% movement-speed reduction. Existing collision still blocks pushes through walls.
- **Permanent aftermath:** Low ground inside x=±132 and z=-103..-36 remains flooded for the remainder of the match: 12% movement-speed penalty plus a southbound 2.4-unit/s current. Tactical positioning, north-lane chases and flag-carrier escapes change materially.
- **Freight collapse:** Four upright freight containers at x=±21 and ±88 topple as the flood arrives. After a 3.2-second fall, they become traversable ramps with eight 0.42-unit steps and a 3.36-unit high landing, connecting to the existing northern overlooks. From each overlook, an 18-tread upper flight rises to the turbine-hall roof at 11 units, with both dynamic physics and visible geometry. The upper treads and landing now have thin collision slabs matching their metal decking, permitting shots and ground-level movement underneath wherever existing static walls and structures leave headroom; the lower fallen container shell and its first eight risers remain solid. The containers slope north-low to south-high to match their steps. Before the event they provide cover; while falling collision is absent; afterward stair and bridge collision is active. Online bots replan against the new routes, while reduced flooded-path penalties and a collision-checked direct fallback let them cross water when dry alternatives are unreachable. Late joiners receive the correct phase.
- **Visible damage:** All five dam faces develop progressively denser cracks at 80%, 60%, 40% and 20% remaining HP. Cracks are reusable geometry, not additional collision.
- **Audio:** Flooded footsteps use a quieter, lower-pitched splash sound rather than a sharp, dominant one. Nearby opponent splashes are attenuated by distance, with Silent Steps and footstep settings respected.
- **Counterplay:** The outer side-spawn approaches (beyond x=±132), central/south lanes and elevated decks higher than 2.2 units remain dry. Flooding does not make captures or team spawns impossible. Timed steam grates stop activating once flood water overwhelms the northern spillway.
- **Visuals:** The breached wall disappears, torrent falls from the dam, an animated water-and-foam front crosses the playable strip, spray follows the crest, and a deep cyan inundation remains on the low ground. The visuals own no physics; client and server both use `floodgateWaterEffect` for gameplay.
- **HUD:** No dam integrity, damage percentage, or breach-complete banner. The collapse is communicated spatially. Only an out-of-date multiplayer-server warning is allowed, to prevent misleading gameplay after an incompatible deployment.

The breach time is recorded in the match environment clock and replicated in each snapshot (`floodgateBreachAt`); late joiners see the correct current wave phase or the permanent flooded aftermath. Compatibility requires `floodgateRulesVersion: 6` (updated flood movement and dynamic collision). Deploying to GitHub `dev` alone does not update a running client/server.

## Routes and hazards

- **Turbine hall:** Collision-backed roof, alternating generator banks and split switchgear. The central approach provides an actual line of fire to the dam.
- **Northern spillway:** Staggered baffles, a 5-section dam at the northern border, four timed steam grates *before* collapse, raised decks for the post-collapse fight.
- **Southern maintenance yard:** Freight containers, pallets and a 240-HP maintenance shutter; these remain safely outside flood waters.
- **Control bases:** Ground-level flags at x=±132 and deliveries at x=±148. Spawn screens and offsets prevent direct base-to-base sniping.

Before the dam collapses, four pressure vents use a 36-second shared repeating period, with a 7-second warning and 8-second active steam window. The hazard's warning is communicated by the flashing grates **without HUD countdowns**. After collapse, vents stop dealing steam damage, and the flood surge replaces them as the northern hazard.

## Implementation and checks

- Geometry, hazards and spawn points: `src/data/maps/floodgate.json` (`blueprint`; old split file is a migration snapshot)
- Colors and non-colliding machinery dressing: `src/data/maps/floodgate.json` (`theme`; old split file is a migration snapshot)
- Shared flood geometry/damage predicates: `src/lib/map-battle-events.ts`
- Server-authoritative breach time, flood damage, bot movement, timed-vent cancellation: `src/lib/game-server.ts`
- Client prediction, offline damage and bot navigation: `src/lib/fps-engine.ts`
- Reused meshes and advancing wave: `src/lib/floodgate-scenery.ts`
- Deterministic dynamic stairs and bridges: `src/lib/floodgate-topple.ts`
- Dam fracture layers: `src/lib/floodgate-dam-cracks.ts`
- Wet footsteps: `src/lib/sound.ts`
- Regression tests: `tests/map-battle-events.test.ts`, `tests/floodgate-hydraulics.test.ts`, `tests/footstep-audio.test.ts`, `tests/floodgate.test.ts` and shared layout/bot suites.

Regression checks should cover high-ground and flank safety, an actual 41-hit Marksman DMR sequence, absence of permanent cover masking the core, replicated breach age, flooded front animation with constant draw-call count, and all CTF routes remaining traversable. Human offline and multiplayer playtesting is still recommended before promoting to `main`.


Map Studio uses the unified `src/data/maps/floodgate.json` blueprint and theme; the previous split files remain migration references. Update the unified document when changing dam geometry, flooding layout or steam grates.
