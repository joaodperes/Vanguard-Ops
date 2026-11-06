# Map modes, limits and spawn safety

Team Deathmatch and Kill Confirmed each offer nine maps. Team Deathmatch includes Afterlight City (Day), and Kill Confirmed includes Afterlight City (Night). Forest Warfare, Orbital Nexus and Floodgate retain their map events in those modes. The HUD shows reactor status and purge warnings independently of CTF. Flag meshes, delivery rings and vault objective beacons appear only in CTF.

CTF supports Forest Warfare, Orbital Nexus, Floodgate, Whiteout Depot and two trial conversions, Verdant Ruins (`compound`) and Ridgefall (`skybridge`). The latter two are labelled **CTF trial** in the picker. Emberhold Castle (`emberhold`) takes Afterlight City (Day)'s slot in FFA, Gun Game and Survival.

| Map | Recommended team size | Maximum team size | Maximum FFA/Gun Game |
| --- | --- | --- | --- |
| Blacksite | 3v3 | 5v5 | 8 players |
| Breakwater | 5v5 | 7v7 | 14 players |
| Verdant Ruins / Ridgefall | 7v7 | 9v9 | 18 players |
| Forest Warfare / Orbital Nexus / Whiteout Depot | 5v5 | 7v7 | Unavailable |
| Afterlight City (Day) | 9v9 | 16v16 | Unavailable |
| Afterlight City (Night) | 9v9 | 16v16 | 32 players |
| Emberhold Castle | Unavailable | Unavailable | 32 players |
| Floodgate | 7v7 | 16v16 | Unavailable |

Survival continues to allow one or two humans, independently of wave enemies. Selecting a different map starts at its recommended size; changing mode clamps an unsupported size to the nearest available maximum. The shared `teamSizesForMap(mapId, mode)` / `teamSizeAllowed(mapId, count, mode)` contract drives menu options and server validation. The value `4` in `TeamSize` represents the eight-player Blacksite FFA/Gun Game option; it does not introduce 4v4 team matches. Legacy quick-match rooms also obey map/mode caps and replace a bot when a human joins a full bot-filled room. Human replacements balance against other humans, so a sequence of late joins cannot overfill one team while the opposite side still contains bots. The replaced bot is removed before the joining human’s spawn is chosen, releasing its occupied position even on pools with exactly one point per player.

## CTF conversions

`src/data/ctf-layouts.json` owns ground-level flag positions, delivery centers and ten rear spawn alternatives per team for the two conversions. Both simulations obtain the override with `getMap(mapId, mode)`; omitting the mode returns the original map for Map Studio and other modes. It never mutates `MAPS`. Ordinary team/FFA spawns remain unchanged, except Ridgefall gains three team alternatives per side and four FFA alternatives in `map-blueprints.json`, bringing it to 9/9 team and 16 FFA points.

Verdant uses its western jungle district and eastern temple district as opposing bases. Ridgefall uses the opposing freight bays. Each flag is forward of its delivery ring, outside cover and hazard volumes. Ground-objective bots use the existing region-aware pathfinder instead of Forest Warfare tree stairs. One quarter of a squad guards its own flag; other bots raid, escort or recover using the shared CTF state machine. Existing authored cover, stairs, destructibles and environmental hazards remain intact.

When editing the conversion JSON, keep each team pool unique, within walkable regions and outside solids/hazards. Check the entire delivery ring and keep at least the selected capacity in usable points. Run content validation and `tests/map-mode-layouts.test.ts`: it verifies every enabled PvP map/mode has enough unique usable positions, objective clearance and complete physical pickup/capture routes in both directions. This file does not author additional map geometry; use Map Studio for geometry changes.

## Shared spawn selection

`spawn-selection.ts` is called by the server and offline engine. It filters obstructed and damaging-hazard locations, then prioritizes candidates at least eight units from living combatants. Within that tier it prefers fewer visible enemies within 90 units, followed by distance, an eight-second recent-use penalty and a small random tie-break. Random jitter never contributes to the eight-unit threshold. Occupants include allies and enemies, so sequential initial spawns reserve their occupied space naturally; history is scoped to the individual room/engine. Crowded maps can still need the farthest available fallback: eight units is an avoidable-overlap preference, not an unconditional guarantee.

## Human playtest sign-off

- Play 3v3, 5v5 and 7v7 CTF in each trial conversion; compare first-contact times, attack/return times, base camping and capture rates from both sides.
- Use both factory/jungle flanks and the central routes, including intact/broken destructibles; inspect defenders and dropped-flag recovery.
- Check Blacksite at 3v3 and 5v5 and at eight-player FFA; use Breakwater 7v7 as the high-intensity option.
- Check TDM/KC on Forest, Orbital and Floodgate, including KC tags on elevated surfaces, reactor claims, map-event warnings and late joins.
- Run 32-human Floodgate/Afterlight matches on representative hardware. Automated spawn-count and bot tests do not establish human balance or performance.
- Play Emberhold with a full FFA lobby, follow bots across each bridge and stair, and step off the open bridge into the moat. Verify immediate elimination in Gun Game and Survival. In co-op Survival, a fallen player returns at the next wave if their partner clears the current wave.

Whiteout Depot uses the same generic CTF layout contract with twelve spawn alternatives per team. Its base geometry already matches that pool. See [Whiteout Depot](whiteout-depot.md) for routes, hatch and playtests.

### Unified Map Studio branch

The unified branch migrates the trial objectives and CTF rear spawn pools into `src/data/maps/compound.json` and `skybridge.json` (`blueprint.objectives` and `blueprint.modeSpawns.ctf`). The split `ctf-layouts.json` is retained as a migration/reference snapshot. Both published and draft mode compilation read the unified data; see [Map Studio](map-studio.md#synchronization-with-dev--2026-10-30).

## Editor sources (November 2026)

Map Studio's canonical authoring source is `src/data/maps/<mapId>.json` for every registered authored map, including the CTF trials and Whiteout Depot. Edit each blueprint's `objectives`, `modes` and optional `modeSpawns.ctf` there; the older `src/data/ctf-layouts.json` remains a compatibility/migration reference. Floodgate now also stores its latest dam and flood geometry under the unified document. Preserve the shared CTF and spawn regressions whenever editing either source.

## Emberhold vertical routes

The four corner towers share a continuous wall walk over the gatehouses. Two routes reach the keep stairs and its rooftop firing positions. The west and east outer-bank stairs lead into passages below the bridges. The dungeon chambers occupy a 104 × 80 footprint inside the 124 × 100 castle platform. The outer tunnel floors sit above the lava surface. The ruined chapel and the bottom landing of the keep’s spiral staircase provide two entrances from inside the castle.
