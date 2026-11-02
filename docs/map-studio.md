# Map Studio — connected construction and editable assets

Open `/map-editor`. The first-map guide, searchable Asset library, 2D plan and 3D view operate on the same browser draft. Select a recipe and click the viewport, or drag it from the palette. Playtest uses unsaved changes without awarding progression or changing multiplayer maps.

## Construction

- New construction uses 1-unit dimensions, 1-unit walls and 5-unit storeys; building presets are 5 or 10 units tall. Existing maps are not automatically quantized. Grid off enables free dimensions and sub-unit repairs.
- Draw wall: drag between endpoints in 2D; choose start/end with two clicks in 3D. Collision remains axis-aligned.
- Join faces attracts touching faces without an imposed gap. Align edges matches edges/centres. 3u clearance deliberately spaces pieces. Buildings retain access-space checks. Magnetic and Surfaces operate independently; Alt bypasses them while stamping.
- The 3D grid follows the selected snap interval. The 2D plan labels its major-line interval, which is an integer multiple of the snap setting when zoomed out.
- Join nearest wall face, or Close gap on a warning, extends one face while preserving the opposite end. Intentional openings can remain as warnings.

## Connected stairs and assemblies

Independent stairs use a top-landing anchor: x,z is the top edge; axis/sign describe the outward/downhill direction; w is width, d is horizontal run, y is the starting floor and h is rise. The plan, snapping and gizmos convert this to the same physical footprint used by collision.

Choose Attach to platform or Attach to nearest platform. New stairs close to a platform also attach when Magnetic is enabled. A saved connection contains:

```json
"attachment": { "platformId": "roof", "edge": "east", "offset": 0, "baseY": 0 }
```

The landing follows platform movement, dimensions, height and quarter-turn rotation. Its rise/run and safe tread count are derived in both editor and shared runtime compilation. Adjust the landing edge, offset and starting floor in the Inspector. Detach landing permits manual placement. Moving stairs individually detaches them; assembly operations retain links. Explicit attachment disables that platform's automatic stairs to avoid duplicate flights; Auto stairs can be re-enabled deliberately.

Construction kits retain an assemblyId. Edit entire assembly applies move, rotate, resize, duplicate and delete to all pieces in one undo action. Copies receive fresh IDs and internal references. Ungroup assembly allows separate editing while preserving landing attachments.

## Precision and diagnostics

Exact bottom/top Y controls move a face without changing thickness for authored props, hazards and inherited boxes/stair flights. Authored geometry uses bottom-based Y; inherited boxes and hazards use centre-based Y. Legacy flights retain a safe maximum rise for their fixed tread count.

Warnings measure small wall gaps, buried landings, height mismatches, missing platform references, and blocked stair routes/headroom. Stair tests use compiled boxes and shared bot traversal rules. Select an affected object directly from its warning. Checks do not prove exhaustive reachability, balance or rendering performance; still walk the routes and test with bots.

## Asset library

The library holds editable recipes. Container, Red container and Blue container share one primitive and collision recipe; the variants supply different colors. Each placed copy stores its own supported dimensions, orientation and color. Editing a copy does not change other copies or the original preset.

Search Construction, Buildings, Props and My assets. Edit an object or geometry assembly, enter a name and choose Save to My assets. Recipes keep relative offsets and internal landing links; stamping allocates fresh IDs. Personal recipes persist in that browser under vanguard-studio-assets-v1. Export assets / Import assets transfer a version-1 recipe library. Updating a recipe does not retrospectively update placed copies.

Current recipes use procedural game primitives. They do not import arbitrary model files, scripts or URLs. See `docs/asset-library-and-imports.md` for external art reuse.

## Canonical map files and migration

Each authored map is a version-2 `src/data/maps/<mapId>.json` containing id, blueprint and theme. `src/lib/map-documents.ts` registers bunker, shipyard, compound, terminal, skybridge, arena_neon, orbital_nexus and floodgate. Previous split JSON files remain migration snapshots. Underlying engine geometry templates and executable objective mechanics still contain TypeScript behavior; objective placement and supported modes are data-backed (see below).

Migration preserves current dev geometry, spawns and themes, including Orbital Nexus. Native map playtests use their native base environment even when old fallback template IDs differ. Afterlight day/night retain distinct playable regions and spawns; shared geometry/props synchronize when edited. Their exports include visible shared props instead of depending on another editor draft.

Browser drafts autosave under vanguard-map-studio-v2. Import accepts single v2 maps, v2 backups, v1 blueprint JSON and old split bundles. Undo and JSON roundtrips preserve links and assemblies. Export map writes one file for review/rebuild; Backup all saves the editor library. New map IDs still need static registration and room/protocol review before publishing.

## Validation and promotion

Run `bun run content:validate`, `bun run test:smoke`, `bun run typecheck` and `bun run build`. Connection regressions cover all landing directions, multiple heights, ascent/descent, blocked headroom, rotation, resizing, copying and JSON roundtrips. Preserve client/server parity and Orbital reactor rules.

Before promotion, verify real pointer/touch placement, player movement, inherited exact faces, undo/redo, draft recovery, map appearance and online behavior. See `docs/dev-test-checklist.md`; the previous guide is archived at `docs/archive/map-studio-before-connections.md`.

## Bundled texture library

Under Visual theme → Surface recipes, choose a bundled texture for floor, wall, cover, stair or platform. Each slot includes a preview, world-unit tile scale, roughness and a procedural fallback. Six Kenney CC0 prototype panel textures are bundled locally; no runtime CDN requests are made. Texture IDs survive map export/import. The 3D construction view remains a physics proxy; use Playtest to inspect the textured game rendering.

## Map objectives and supported modes

Under **Objectives and modes**, select a flag, capture zone or reactor, choose the team when applicable, and place its marker on a reachable surface. Markers appear in both 2D and 3D and in the Objectives layer. Select one to move it with the gizmo or edit exact X/Y/Z, horizontal trigger radius and vertical tolerance. Reactor records also expose charge radius and kills required. These are gameplay triggers; placing a marker does not construct a platform or stairs.

Enable the map's supported modes using the checkboxes. CTF requires exactly one red flag, blue flag, red capture zone and blue capture zone. Missing or duplicate roles, unsupported objective kinds, invalid tuning and positions outside the walkable footprint block playtest and single-map export. Other modes do not require these CTF records. The current runtime supports one optional reactor per map; it awards the existing temporary Nexus Reaper and resets its charge after one eligible claimant wins. Multiple reactors with independent state or another reward mechanic require an explicit runtime extension.

Choose **Playtest mode** to run that mode against the current draft, including its unsaved objective definitions. This works for a new draft ID without a map-name check. Draft previews remain offline and do not publish content or award progression. New deployed map IDs still require the existing static registration/protocol review.

For an elevated flag or reactor, add approach points at actual stair entrances. Bots choose the nearest entrance before approaching the objective. Optional `approachLandings` holds matching upper waypoints for a second leg (used by Forest Warfare's existing tree stairs); each landing corresponds to the entry at the same index. Moving the objective moves both entry and landing points, but does not move physical geometry. Inspect and traverse the route after editing. Trigger validation does not prove collision-free access or balanced flag placement.

The blueprint fields are shared by the editor, compiled maps, offline rules and authoritative server:

```json
{
  "modes": ["ctf", "tdm"],
  "gravityScale": 1,
  "objectives": [
    {
      "id": "central_reactor",
      "kind": "reactor",
      "pos": [20, 5, -10],
      "radius": 3.5,
      "verticalTolerance": 2.6,
      "chargeRadius": 38,
      "killsRequired": 10,
      "approaches": [[20, 0, -23], [20, 0, 3]]
    }
  ]
}
```

This is a reactor-only fragment, not a complete CTF setup: include all four team records when enabling CTF. A flag/capture-zone record uses `team: "red"` or `"blue"` instead of the reactor's charge fields. CTF contacts use horizontal radius and symmetric vertical tolerance. Reactor charging uses horizontal distance from its saved center and counts an eligible enemy kill when either fighter is in range, regardless of elevation; claiming requires standing within its radius from 0.65 units below its saved Y to `verticalTolerance` above it. Claim ties use distance to that center and then stable player ID. Base map gravity is independent of reactor presence; equipped Reaper movement effects still require the reactor mechanic.

Orbital Nexus objective positions, charge settings and 0.6 gravity are now stored in its canonical map JSON. Forest Warfare remains a native geometry template; its existing objective positions and stair waypoints live in `src/data/maps/forest-objectives.json`. Old orbital/forest imports that omit objective data receive their compatibility defaults; explicit empty arrays are preserved. Maps without a `modes` field retain the five previous non-CTF modes.

### Extending the system

`src/lib/map-objectives.ts` owns the typed objective grammar, mode requirement table, lookups, route helper and structural validation. New modes using existing flag/zone/reactor mechanics can share these definitions without adding coordinate checks for map names. Add the mode to `GameMode`, `MODE_OBJECTIVES`, its catalog/lobby and actual scoring/match handlers. For a new objective mechanic, add a discriminated kind and its schema/validator/editor fields, implement shared rules with client rendering and authoritative server state/events, and add regression tests. Arbitrary scripts, URLs and unknown behavior fields are rejected. Current `orbital*` wire event names are retained for compatibility; rules version 5 requires restarting/redeploying both client and server together.

## Synchronization with dev — 2026-10-30

Floodgate is registered as the eighth unified document, `src/data/maps/floodgate.json`. Its native empty base, authored geometry, theme, 16 unique spawns per team, four pressure vents and maintenance shutter are preserved. The editor exposes steam/spike appearance and warning duration for periodic hazards; exports, copies and draft playtests retain these fields. Full backdrop, purge rendering and synchronized event HUD remain in the game renderer. See [Floodgate](floodgate.md) for event timing and route notes.

Forest Warfare, Orbital Nexus and Floodgate support CTF/TDM/Kill Confirmed. Verdant Ruins and Ridgefall additionally support the CTF trial layouts from current dev. The CTF picker retains the three dedicated maps first. Updated map capacities, protected spawn selection and weapon/bot changes from dev are retained.

The trials' rear spawn pools now live in each unified blueprint's optional `modeSpawns.ctf` alongside their editable objectives. The **Objectives and modes** section exposes these override coordinates. `getMap(id, mode)` and `compileMapStudioDraft(id, blueprint, theme, mode)` apply the same overrides; other modes keep their normal pools. Choose CTF in Playtest mode to use them. Legacy `src/data/ctf-layouts.json` remains a migration/reference snapshot, while runtime contact positions and spawn selection use the compiled unified document. Explicit empty objective arrays are never silently replaced.

Regression checks compare Floodgate published/draft collision, hazards, spawns and objectives, and verify that unsaved trial edits affect neither other modes nor the published catalog. Live pointer/touch and offline/online gameplay review of this merged editor branch remains required.

## Whiteout Depot

The sixth CTF map (`whiteout_depot`) is authored entirely in blueprint/theme JSON, with ground objectives and twelve spawns per team in `ctf-layouts.json`. No executable objective kind was added. Its rotated maintenance hatch is flanked along Z; both simulations compile the same solids. See [Whiteout Depot](whiteout-depot.md).
