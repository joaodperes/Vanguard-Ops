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

Each authored map is a version-2 `src/data/maps/<mapId>.json` containing id, blueprint and theme. `src/lib/map-documents.ts` registers bunker, shipyard, compound, terminal, skybridge, arena_neon and orbital_nexus. Previous split JSON files remain migration snapshots. Underlying engine templates, Forest Warfare and reactor mechanics still contain TypeScript behavior.

Migration preserves current dev geometry, spawns and themes, including Orbital Nexus. Native map playtests use their native base environment even when old fallback template IDs differ. Afterlight day/night retain distinct playable regions and spawns; shared geometry/props synchronize when edited. Their exports include visible shared props instead of depending on another editor draft.

Browser drafts autosave under vanguard-map-studio-v2. Import accepts single v2 maps, v2 backups, v1 blueprint JSON and old split bundles. Undo and JSON roundtrips preserve links and assemblies. Export map writes one file for review/rebuild; Backup all saves the editor library. New map IDs still need static registration and room/protocol review before publishing.

## Validation and promotion

Run `bun run content:validate`, `bun run test:smoke`, `bun run typecheck` and `bun run build`. Connection regressions cover all landing directions, multiple heights, ascent/descent, blocked headroom, rotation, resizing, copying and JSON roundtrips. Preserve client/server parity and Orbital reactor rules.

Before promotion, verify real pointer/touch placement, player movement, inherited exact faces, undo/redo, draft recovery, map appearance and online behavior. See `docs/dev-test-checklist.md`; the previous guide is archived at `docs/archive/map-studio-before-connections.md`.

## Bundled texture library

Under Visual theme → Surface recipes, choose a bundled texture for floor, wall, cover, stair or platform. Each slot includes a preview, world-unit tile scale, roughness and a procedural fallback. Six Kenney CC0 prototype panel textures are bundled locally; no runtime CDN requests are made. Texture IDs survive map export/import. The 3D construction view remains a physics proxy; use Playtest to inspect the textured game rendering.
