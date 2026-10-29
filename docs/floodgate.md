# Floodgate

`floodgate` is the third CTF-only map: a hydroelectric complex for 3v3, 5v5, 7v7 or 16v16. The actual playable footprint is 352×212 world units, with connected districts and 16 distinct protected rear spawn positions per team.

The dam, reservoir, waterfalls and storm-dark mountain silhouettes form a distant northern backdrop. Every backdrop mesh stays beyond the playable boundary; collision-backed turbine halls, pressure towers and yard props define the spaces players can actually reach.

## Routes and objectives

- **Turbine hall:** a collision-backed roof, alternating generator banks, buttresses and switchgear create close and medium-range fights. Broken side walls provide frequent cross-connections.
- **North spillway:** tall staggered baffles break long sightlines. Pressure grates offer a risky shortcut; wide detours stay open throughout the event. Two low service decks have real stairs and limited views.
- **South maintenance yard:** containers, freight barriers and pallet cover create an alternate ground route. Two accessible maintenance decks have flanking approaches. A 240-HP shutter opens an extra hall-to-yard passage when destroyed.
- **Control bases:** flags at X=±132, deliveries at X=±148. Both are ground-level and outside hazards. Spawn screens, canopy roofs and offset approaches prevent a direct base-to-base shooting lane. Geometry is mirrored across X; the north and south routes deliberately play differently.

The CTF map picker displays all three maps, and Floodgate advertises **Up to 16v16**. Other CTF maps retain their previous 7v7 cap. Full squads assign four defenders and twelve attackers across three lanes; carriers, escorts and flag recovery retain priority over normal assignments. Nearby threats interrupt objective travel.

## Pressure purge

All four spillway grates share one 48-second cycle of active match time:

| First cycle | State | Player feedback |
| --- | --- | --- |
| 0–30 seconds | Idle | Teal grate rims and HUD countdown |
| 30–36 seconds | Warning | Flashing amber rims; HUD says to clear the grates |
| 36–42 seconds | Purging | Visible steam jets; 28 damage per 900 ms to occupants |
| 42–78 seconds | Idle | Next purge approaches |

The six-second warning precedes each six-second activation. Neither team owns the event; all players use the same timing. Covered hall and maintenance-yard routes remain safe, flags/spawns are outside all hazard bounds, and bots conservatively avoid pressure grates even while idle. Normal gravity applies.

The existing periodic damage object (`type: "spikes"`) accepts `visual: "steam"` and `warningFor: 6`. Both offline gameplay and the server use `periodicHazardPhase()`; online rendering/HUD follow `environmentTime` snapshots, including late joins. The event uses nine reusable meshes per grate, no spawned particles and no extra point lights. The maintenance shutter has room-local destruction state.

## Source and validation

- Layout, spawns and hazards: `src/data/map-blueprints.json`, under `maps.floodgate`.
- Palette, materials and props: `src/data/map-themes/floodgate.json`, imported by `map-visuals.ts`.
- Registration/capacity: `game-protocol.ts`; objective positions and bot roles: `ctf-rules.ts`.
- Regressions: `tests/floodgate.test.ts`, plus the shared map/capacity/material suites.

Automated traversal checks sweep actual collision with all pressure grates forbidden and the shutter intact, proving three independent cross-map ground routes. Sampled horizontal sightlines at ground eye height and service-deck eye height must stay below 112 units across the combat area. These samples do not prove every possible diagonal sightline is short. Tests also check spawn clearance, compiled feature preservation, flag actions, bot destinations, event boundaries, editor round trips and fixed animation resources.

Human offline/online 16v16 playtests remain necessary for balance, player readability, grenade behavior, carrier travel times and hardware-specific performance. Follow `docs/dev-test-checklist.md` before promoting to `main`.

## Development checks — 2026-10-29

Content validation, the complete 520-test suite, TypeScript and the production build pass. The map regressions include complete enemy-flag and carrier-return navigation in both directions, in addition to independent lane traversal and clearance checks.

A live Socket.IO room ran with 32 combatants, 16 on each team, through 44 seconds of active match time. A second client joined during the warning, replaced a bot and received the current event clock and correct delivery positions. The run received 981 host snapshots; all event phases occurred, 25 living bots reached the combat area, and no living bots were embedded in solid geometry at the final sample.

Browser checks verified the three-card CTF picker, 16v16 selection and 31-bot fill summary. The actual FPS renderer and HUD displayed both delivery rings, the warning and active purge without JavaScript errors. Four repeated active cycles kept geometry, texture, object and draw-call counts identical after initial allocation. These are automated development checks, not a human 32-player balance or hardware-performance sign-off.
