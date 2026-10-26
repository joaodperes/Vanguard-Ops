# Map Studio 2 — unified map authoring

Map Studio is a developer tool at **/map-editor**, not linked from the player menu. This guide describes the new editor on `feat/map-editor-unified-rebuild-gpt6-20261026`. The previous split-blueprint workflow has been superseded.

## Authoring goals

The editor is for designing playable FPS maps, not merely drawing decorations. It provides two views over the same document: a **3D object editor** for placement and physics-aware transformations, and a **2D orthographic plan** for fast positioning and floor layout. Both operate in world X/Y/Z coordinates; `w` and `d` are full extents. Use an overlapping region layout to build connected districts and multiple routes, with clear spawning and genuine stair access to raised surfaces.

The toolbar offers rectangular, elliptical and triangular walkable regions, authored cover, platforms, independent stairs, hazards, FFA/red/blue spawns, props, eight reusable building kits and seven structure kits. The 3D inspector supports selection, axis-locked movement, quarter-turn rotations and resizing. Existing engine-authored collision and stairs can be moved, copied as authored geometry, hidden or restored using stable source-index overrides.

The right-hand inspector adjusts exact coordinates/dimensions, labels, stair attachment, hazards, building use/facade/shape/roof access, biome, palette, ambient/vegetation and surface recipes. Undo/redo supports Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z. 2D objects can be dragged; 3D has orbit/pan, ground placement, axis controls, and snap controls (0, 1, 2, 5 or 10 world units).

## One JSON file per map

The sole current **source of truth for authored data** is a versioned JSON file per map:

- `src/data/maps/bunker.json`
- `src/data/maps/shipyard.json`
- `src/data/maps/compound.json`
- `src/data/maps/terminal.json`
- `src/data/maps/skybridge.json`
- `src/data/maps/arena_neon.json`

Each version 2 map JSON contains the map ID, geometry blueprint, and visual theme:

```json
{
  "version": 2,
  "id": "training_ground",
  "blueprint": {
    "name": "TRAINING GROUND",
    "shortName": "TRG",
    "description": "Two flanking lanes and a raised central position.",
    "pace": "balanced",
    "templateMapId": "compound",
    "regions": [
      { "x": 0, "z": 0, "w": 140, "d": 100 },
      { "x": 60, "z": 40, "w": 80, "d": 75 }
    ],
    "features": [
      { "id": "middle_ledge", "kind": "platform", "x": 0, "z": 0, "w": 12, "d": 16, "h": 4 }
    ],
    "spawns": {
      "ffa": [[-40, 0, -20], [40, 0, 20]],
      "red": [[-40, 0, 20]],
      "blue": [[40, 0, -20]]
    }
  },
  "theme": {
    "biome": "desert",
    "label": "Dry training grounds",
    "palette": {
      "floor": "#887c67", "wall": "#7b6b56", "cover": "#786754",
      "accent": "#ddae70", "platform": "#9d896e", "stair": "#a48e74",
      "sky": "#94b6c4", "fog": "#a8b8b6", "grid": "#685949"
    },
    "ambient": 1.4,
    "vegetation": 0.05,
    "props": []
  }
}
```

The source is imported and registered in `src/lib/map-documents.ts`. Compatibility adapters expose `MAP_BLUEPRINTS` and `MAP_VISUAL_THEMES` to the existing deterministic physics, visuals and authoritative multiplayer code. The old `src/data/map-blueprints.json` and `src/data/map-themes/*.json` are kept only as legacy migration snapshots and should **not** be edited for new published content.

The six legacy TypeScript base environments still provide a common template and some inherited geometry. A map document is **not** a complete stand-alone game engine scene. Changes to gameplay semantics, new hazard kinds, true rotated colliders or new base templates still require coordinated engine/client/server work.

## Creating, importing and exporting

1. Choose an existing map or create a unique ID and choose **New**. A new map starts as a copy of the selected map with a stable template ID.
2. Author connected regions and real collision geometry. Place spawns clear of cover/hazards, then decorate with props and materials.
3. Watch validation warnings. Safety markers and district links are approximations, not pathfinding or an exhaustive physics simulation.
4. **Playtest** opens the actual offline FPS using the current unsaved draft with 0, 3 or 6 bots. It awards no progression and cannot publish to multiplayer. Return to the editor to continue.
5. **Export map** downloads exactly one `<mapId>.json` file. Publish by replacing `src/data/maps/<mapId>.json` in the repository and rebuilding. **Backup all** exports a portable library containing every editor map.
6. For a **new map ID**, add a static import and a `MAP_DOCUMENTS` entry in `src/lib/map-documents.ts`, review `MapId` in `src/lib/game-protocol.ts`, and test room creation, server selection and map loading before promotion.

Browser drafts are automatically stored under `vanguard-map-studio-v2`. First launch migrates older `vanguard-map-studio-v1` geometry and `vanguard-map-studio-themes-v1` theme drafts. The **Import** button also accepts a version-2 single map file, a version-2 backup, legacy blueprint JSON, a legacy Map Studio v1 bundle, or a legacy theme for the currently selected map. Import validation rejects structurally invalid data rather than silently replacing the shipped library. Always export a backup before major migrations.

## Map design and physics details

Regions overlap to form a union. Rectangle regions are exact; ellipse/triangle edges become narrow AABB strips for the existing collision system. Region outlines are not inner walls. Platforms create north/south stairs unless `autoStairs: false`; standalone stairs can be attached to the nearest platform. A `cover` object's `y` is **bottom elevation** and `h` is its own height. Spawns are `[x,y,z]` points.

Authored hazards are `fire`, `spikes`, `jump_pad`, `moving_platform` and `destructible_wall`. Authored building prop collision is derived deterministically and shared between the editor, offline play and authoritative gameplay. Procedural city lots can be converted into editable authored buildings. The two Afterlight editions (`terminal`, `arena_neon`) share authored geometry/buildings while retaining different visual themes.

Existing built-in boxes and stair flights are backed by stable `legacyCoverOverrides`, `legacyEnvironmentOverrides`, `legacyCoverDisabled` and `legacyEnvironmentDisabled` source indices in each blueprint; these override their inherited geometry without editing the TypeScript originals. Rotation is quarter-turn only; arbitrary-angle collision is not supported. The 3D editor uses physics proxies, so it is not a pixel-perfect preview of game materials.

Design multiple flanks around high positions, keep line-of-sight interruptions, leave stairs clear, and distribute spawns across the footprint. Test across compact and larger player counts to catch unreachable platforms, spawn traps, cover collision discrepancies and overloaded scenery.

## Validation and promotion

Run these checks before merging:

```sh
bun run content:validate
bun run test:smoke
bun run typecheck
bun run build
```

Review `tests/map-documents.test.ts`, `tests/map-document-io.test.ts`, `tests/map-studio-playtest.test.ts` and existing map physics, bot and layout tests. Finally conduct manual browser playtests in both map editor and actual FPS sessions, and compare client and server collision and bot navigation. Publishing remains a Git-controlled build operation. No player-upload endpoint accepts mutable shared multiplayer maps.
