# Floodgate

Floodgate is a hydroelectric PvP arena for CTF, TDM and Kill Confirmed. Supported squad sizes include 5v5, 7v7, 9v9 and 16v16; 7v7 is the recommended team size. It has 16 distinct spawn positions per side, plus a 32-player FFA spawn layout.

## Dam collapse — a one-time match-changing flood

- **Dam placement:** Five linked orange/brown structural sections occupy the north playable edge at **z=-99** (boundary near z=-106), spanning x=-56 to x=56. The orange central core and all four panels share **1,800 HP** in a single authoritative pool.
- **Damage:** Fire into any exposed dam section; bullets and explosive hits all contribute to the same health. A 74-damage Marksman DMR requires **25 registered shots** to break the dam. The 240-HP maintenance shutter remains independent.
- **Collapse:** All five dam colliders disappear atomically, opening the northern view and releasing the reservoir. This cannot reset or be farmed during the match.
- **Hydraulic surge:** A large white-capped flood front travels from z=-103 to z=-36 in **14 seconds**. Ground-level players caught in the moving front take **28 damage per 900 ms**, are pushed south at approximately 9 units/s, and experience 60% movement-speed reduction. Existing collision still blocks pushes through walls.
- **Permanent aftermath:** Low ground inside x=±62 and z=-103..-36 remains flooded for the remainder of the match: 32% movement-speed penalty plus a steady southbound 1.1-unit/s current. Tactical positioning, north-lane chases and flag-carrier escapes change materially.
- **Counterplay:** The outer flanks (beyond x=±62), central/south lanes and elevated decks higher than 2.2 units remain dry. Flooding does not make captures or team spawns impossible. Timed steam grates stop activating once flood water overwhelms the northern spillway.
- **Visuals:** The breached wall disappears, torrent falls from the dam, an animated water-and-foam front crosses the playable strip, spray follows the crest, and a deep cyan inundation remains on the low ground. The visuals own no physics; client and server both use `floodgateWaterEffect` for gameplay.
- **HUD:** No dam integrity, damage percentage, or breach-complete banner. The collapse is communicated spatially. Only an out-of-date multiplayer-server warning is allowed, to prevent misleading gameplay after an incompatible deployment.

The breach time is recorded in the match environment clock and replicated in each snapshot (`floodgateBreachAt`); late joiners see the correct current wave phase or the permanent flooded aftermath. Compatibility requires `floodgateRulesVersion: 3`. Deploying to GitHub `dev` alone does not update a running client/server.

## Routes and hazards

- **Turbine hall:** Collision-backed roof, alternating generator banks and split switchgear. The central approach provides an actual line of fire to the dam.
- **Northern spillway:** Staggered baffles, a 5-section dam at the northern border, four timed steam grates *before* collapse, raised decks for the post-collapse fight.
- **Southern maintenance yard:** Freight containers, pallets and a 240-HP maintenance shutter; these remain safely outside flood waters.
- **Control bases:** Ground-level flags at x=±132 and deliveries at x=±148. Spawn screens and offsets prevent direct base-to-base sniping.

Before the dam collapses, four pressure vents use a 36-second shared repeating period, with a 7-second warning and 8-second active steam window. The hazard's warning is communicated by the flashing grates **without HUD countdowns**. After collapse, vents stop dealing steam damage, and the flood surge replaces them as the northern hazard.

## Implementation and checks

- Geometry, hazards and spawn points: `src/data/map-blueprints.json`
- Colors and non-colliding machinery dressing: `src/data/map-themes/floodgate.json`
- Shared flood geometry/damage predicates: `src/lib/map-battle-events.ts`
- Server-authoritative breach time, flood damage, bot movement, timed-vent cancellation: `src/lib/game-server.ts`
- Client prediction, offline damage and bot navigation: `src/lib/fps-engine.ts`
- Reused meshes and advancing wave: `src/lib/floodgate-scenery.ts`
- Regression tests: `tests/map-battle-events.test.ts`, `tests/floodgate.test.ts` and shared layout/bot suites.

Regression checks should cover high-ground and flank safety, an actual 25-hit Marksman DMR sequence, absence of permanent cover masking the core, replicated breach age, flooded front animation with constant draw-call count, and all CTF routes remaining traversable. Human offline and multiplayer playtesting is still recommended before promoting to `main`.
