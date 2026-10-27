# Map Studio — connected-district JSON maps

Open **/map-editor** while running the Next.js development server. Map Studio is a developer tool and is not linked from the player main menu.

## Object movement and rotation

3D editing saves every quarter-turn (0°, 90°, 180°, 270°) with the object instead of resetting it when moving or reselecting. For authored geometry, theme props, standalone hazards and overridden built-in objects, the saved extents remain axis-aligned for physics. City-building doorways, external/internal stairs and furniture rotate with the saved orientation. In Move mode, explicitly choose **Lock direction X / Y / Z**: the gizmo exposes only that direction, and commits reject movement along the other two axes, including accidental plane dragging.

The two prominent authoring modes are **Construction kits** (regions, walls, stairs, grouped kits and spawns) and **Paint tools** (buildings and themed scenery). Use **Dismiss guide** to hide the tutorial between visits; **Show guide** reopens it.

### Breakwater polish

Containers now show stripes on **both long faces** whether they run along the X or Z axis. The floating moving cargo platform and independent authored crane platform have been removed, while the dock layout, normal cover, existing supported crane routes and container stacks remain.

## Quick Build — dev workflow

Map Studio now includes a first-map guide, direct cursor placement, eight reusable city building kits, and seven geometry kits (alley, room, rooftop, market stalls, checkpoint, stairwell, courtyard).

In 3D, choose a building or kit and click the ground to stamp it. The building preview is green for a valid placement and red for a detected overlap, map-boundary or spawn problem. Repeat placement can stay enabled for bulk decoration. Existing procedural Afterlight buildings can be selected and converted into independently editable authored objects, suppressing their generated duplicates. The Day and Night variants share city geometry changes and authored props while retaining separate lighting palettes.

The Collision toggle displays the real shared collider geometry. Safety overlay highlights positioned map problems. District links shows a coarse overlap/portal network, not actual bot pathfinding. 2D and 3D author the same draft.

Playtest draft sends unsaved geometry directly into a non-rewarding offline FPS session with 0, 3 or 6 bots. Exit back to Map Studio to restore browser-local work. Save bundle exports one portable JSON containing both the complete blueprint document and visual themes; Import map / bundle restores either that bundle or a blueprint-only JSON.

Publishing still requires exporting the blueprint and theme JSON source files, reviewing and committing them in the repository, and rebuilding. This is deliberate: browser drafts do not mutate live multiplayer maps. Automated tests cover map schemas, city physics, editing primitives, playtest compilation and build checks; final rendering, FPS performance, sightlines and bot quality still require an actual browser/in-game playtest.

## Authoring

Choose one of six maps or type a new unique ID and select **New** to clone the current template. The editor supports:

- Draw connected **walkable regions** using rectangles and supported circle/triangle approximations; overlapping regions form larger districts and irregular footprints.
- Regions may be non-square rectangles or approximated circles/triangles. Arbitrary freehand polygons are not supported.
- Use **Select / Move** and drag inside a region or on its outline to reposition it. Regions are combined at runtime into one footprint: interior shared edges are not physical walls. The minimap also draws their **union outline**, while the editing view still shows individual rectangles for selection.
- Draw **hard cover**, **elevated platforms** with automatically generated physical stair flights, and place team/FFA **spawns**.
- Select, drag, edit precise dimensions, duplicate, delete, zoom and undo.
- Enable/disable **Snap drawing and movement to grid** in Placement precision. Select 1, 2, 5 or 10 world-unit X/Z increments. This controls horizontal placement, **not** platform height.
- Platforms expose height and generated stair geometry in the inspector. Independently authored stairs and elevation snapping are supported; see the object-authoring and 3D editing sections below.
- Edit name, short name, description and pace; import/export all maps together as JSON.
- Draft persistence to local browser storage, geometry and spawn validation.

The authoritative JSON file is `src/data/map-blueprints.json`. Export from Map Studio and **replace that file in the repository** to publish; restart/rebuild the game. No production API accepts arbitrary player-authored map mutations, avoiding user-content injection into shared matches.

A new map's `templateMapId` chooses one of the six core environments for its lighting, inherited buildings and environmental objects; the blueprint supplies its additional districts. After committing its JSON, the new map is added to the runtime `MAPS` registry/Play map list through the blueprints. **Integration still needs review:** `MapId` in `src/lib/game-protocol.ts` is a fixed TypeScript union, and a new key should be checked against typed protocol/config consumers, room creation and server selection before declaring the map ready.

## Geometry specification

```json
{
  "version": 1,
  "maps": {
    "my_map": {
      "templateMapId": "compound",
      "name": "MY MAP",
      "shortName": "MYM",
      "description": "Connected districts",
      "pace": "balanced",
      "regions": [{"x":0,"z":0,"w":150,"d":150},{"x":90,"z":15,"w":75,"d":80}],
      "features": [{"id":"tower-a","x":88,"z":16,"w":12,"d":12,"h":5,"kind":"platform"}],
      "spawns": {"ffa":[[0,0,0]],"red":[[-40,0,0]],"blue":[[110,0,30]]}
    }
  }
}
```

- Coordinates use world-space **X / Y / Z**, with the floor at Y=0. Region/feature centers are X/Z; `w,d` are **full** extents, unlike the engine's CoverBox half-extents.
- A map footprint is the union of all regions. Shared edges disappear; the remaining segments become tall solid walls in the same collision/ballistics list on client and server. The legacy `size` is only the broadphase bounding square.
- Platforms create stairs at **both north and south sides**. Leave approach space clear, especially near the boundary. A platform is not a magic jump/teleport.
- New spawns must be inside the footprint, outside hard cover/hazards, and distributed across districts.
- JSON files are bundled at build time. Browser drafts do **not** silently override live multiplayer maps.


## Per-map visual identity (new)

A map is composed of **two independent JSON layers**:

1. `src/data/map-blueprints.json` — physical regions, cover, climbable platforms and spawns.
2. **`src/data/map-themes/<mapId>.json`** — biome, floor/wall/cover/trim colors, ambient illumination, visual landmarks and vegetation density.

The six shipped themes are:

| Map | Scale | Visual identity |
| --- | --- | --- |
| Blacksite (`bunker`) | compact | Warm concrete, emergency lights, tight vault chambers |
| Breakwater (`shipyard`) | compact | Sunlit dock containers, crane silhouettes, shipping machinery |
| Verdant Ruins (`compound`) | medium | Jungle canopy, moss-covered stone, ruined temples and boulders |
| Glassline (`terminal`) | medium | Bright city transit plaza, shops, windows and planters |
| Ridgefall (`skybridge`) | large indoor | Enclosed industrial steelworks, foundries, gantries and maintenance bays |
| Afterlight City (`arena_neon`) | enormous | Colorful downtown, shop signage, glowing windows and street lights |

Example theme file (use hex CSS colors, not integer colors):

```json
{
  "biome": "jungle",
  "label": "Lush jungle ruins",
  "palette": {
    "floor": "#566647", "wall": "#475340", "cover": "#849077",
    "accent": "#b9cf77", "platform": "#7b8b71", "stair": "#9c9c7c",
    "sky": "#9cc3b6", "fog": "#9fb9a5", "grid": "#53674a"
  },
  "ambient": 1.65,
  "vegetation": 0.8,
  "props": [
    { "kind": "tree", "x": 127, "z": 42, "h": 13 },
    { "kind": "rock", "x": 112, "z": -9, "w": 6, "d": 5, "h": 3 }
  ]
}
```

Supported `kind` values: `tree`, `bush`, `rock`, `ruin`, `temple`, `shop`, `lamp`, `container`, `crane`, `terminal`, `sign`, `antenna`, `building`, `boat`, `dock`, `garden`, `bench`, `bandstand`. Many types accept optional `w`, `d`, `h`, `text`. `vegetation` ranges from 0 to 1 and scatters deterministic flora inside the walkable region while avoiding cover and spawn locations. JSON theme files are imported through `src/lib/map-visuals.ts`; **for a new map-specific theme file**, add its static import to that module. A map without its own theme can inherit the theme matching its `templateMapId`.

**Important gameplay detail:** rock/tree/building silhouettes are shared with collision where appropriate; storefronts are **exterior buildings**, not modeled enterable interiors. To create an enterable interior, author real physical geometry and door paths; do not draw fake walkable doorways. The theme is not a replacement for the gameplay blueprint.

**Route-design rules:** keep two or more viable flanks around perches, short and interrupted sightlines around open courts, obstacles sized for cover rather than 100-unit hallway walls, and accessible elevated positions with real stairs. Sniper perches should overlook contested space but should not lock every route. Retain truly compact maps for shotgun/SMG combat as well as vast outdoor maps. Before publishing, playtest spawn safety and A-to-B travel times in 1v1, 3v3 and 7v7. The map builder suppresses new features intersecting known spawns, but this is a fail-safe, not an excuse to author invalid positions.

The built-in **Orbital Nexus** map (`orbital_nexus`) is CTF-only. Flags live on the ground at X=±76 and deliveries at X=±86, with flat three-lane bot navigation rather than Forest Warfare tree stairs. Its blueprint includes mirrored cover, command decks, a breachable north bulkhead and ten jump pads; its `orbital_nexus.json` theme provides the orbital palette and decorative props. Decorative gas-giant/reactor geometry is rendered separately and does not add invisible shared collision.

For a new map ID, preserve all existing entries in the version-1 `maps` object; do not replace the whole export with a single-map fragment. Adding `src/data/map-themes/<mapId>.json` alone is insufficient: add the import and map entry to `MAP_VISUAL_THEMES` in `src/lib/map-visuals.ts` or the runtime will use its template palette. Confirm props, physical cover and spawns do not disagree, and test bot movement around platforms and exits.

**Editor scope:** Map Studio authors blueprint geometry, standalone stairs, supported hazards and local theme/prop drafts. Existing TypeScript template hazards, platform stairs and some scenery are displayed as read-only previews, not removed by blueprint exports. Theme exports are separate files and still require static import registration for new map IDs. The preview does not fully render Three.js materials, effects or scenery.

The editor loads as a browser-only Next.js component, avoiding hydration mismatches between server map labels and browser drafts. Drafts are stored under `vanguard-map-studio-v1` (blueprints) and `vanguard-map-studio-themes-v1` (themes). If an old draft has different map names, export it first before using **Restore shipped maps**. Restart the dev server if Turbopack displays stale code.

Run `bun run content:validate`, `bun run test:smoke`, `bun run typecheck`, `bun run build` and perform manual offline/online matches before requesting a merge.

## 3D map editing and legacy objects

Map Studio opens in **3D View** by default. Use the **2D View** button to return to the original precision drafting grid. Both views edit the same browser-local blueprint/theme drafts.

### Precise vertical placement

The 3D editor's original **Snap drawing and movement to grid** option was a 2-unit grid by default. Three.js's stock transform snap applies to all three axes, causing moving a wall, platform or stair flight up/down to jump between whole grid levels. **Map Studio now snaps X/Z only**; Y movement in Move mode remains free, even when the horizontal drawing grid is on.

For exact placement, select an object and use **Exact vertical placement → Bottom Y** or **Top Y** in the Inspector. Enter any decimal (for example `5.25`), then press Enter or leave the field. Changing either face moves the whole object **without resizing it**. Authored cover/platform/stairs and props use bottom-based Y; built-in collision boxes, original staircase groups, and hazards have center-based Y internally. The Inspector handles that conversion automatically. Spawn points have zero height and their Y is their exact elevation.

**Height (H)** is still the object's thickness/rise and can be edited separately. For example, a 2.5-unit-tall barrier with Bottom Y = 5.25 occupies Y = 5.25 through 7.75; setting Top Y to 8.0 moves it up to Bottom Y = 5.5 without stretching it.

### Navigating the 3D viewport

- **Camera / select:** Left-drag to orbit; right-drag to pan; scroll to zoom. While the mouse is over the viewport, **W/A/S/D** flies horizontally, **Q/E** moves down/up, and **Shift** increases speed. Click a selectable object to highlight it.
- **Move object:** Select an object and choose **Move object**. Drag the red/green/blue gizmo arrows to change its coordinates.
- **Rotate 90°:** Choose **Rotate 90°** to use a yaw-only rotation gizmo. The current collision engine uses axis-aligned boxes, so turning an object swaps its width/depth. Full arbitrary-angle rotations and rotated triangular region footprints are not supported.
- **Resize object:** Choose **Resize object** and drag a gizmo axis; the right-hand **Inspector** also exposes exact dimensions. Changing the Y size of a cover, platform or stair object changes its height.
- Use the left toolbar to select a shape/object type and click **Add [object] at camera focus** in the viewport. The editor creates it under the camera's orbit target. Select and transform the new object, then export JSON.

### Editing pre-existing stairs, cover and hazards

The 3D viewport can select the game's **original engine-authored collision boxes**, including **complete stair flights**, as well as authored JSON features, spawns, props and hazards. Engine-authored objects appear as semi-transparent gray or amber boxes, and the Inspector labels them **Existing game geometry**.

These are not ordinary JSON `features` entries. Editing an original cover box adds a `legacyCoverOverrides[index]` entry to `src/data/map-blueprints.json`; original engine hazards similarly use `legacyEnvironmentOverrides[index]`. Each override stores an exact world-space center (`x,y,z`) and **full** dimensions (`w,h,d`). The runtime applies those overrides to the stable engine-authored prefix before adding JSON features and generated perimeter walls. The original TypeScript map source is not mutated.

**Original stair flights are selected as complete staircases**, not individual treads. In 3D, click *any* stair tread in a flight and the whole staircase highlights; choose Move, Rotate or Resize, or edit the flight's six dimensions in the Inspector. The 2D view also shows a selectable outline for each flight. **Reset edits** discards all its tread overrides together. One edit is expanded into a set of `legacyCoverOverrides` values for the original steps; the runtime still uses individual collision treads, so player/bot collision is unaffected by this editor grouping.

### Copying and deleting built-in objects

Select a built-in cover box, platform, hazard or entire staircase in **2D or 3D**, then use the Inspector's **Duplicate**, **Reset edits** or **Delete** buttons. These are deliberately separate operations:

- **Duplicate** makes a new independently editable JSON object, offset in X to avoid exact overlap. Built-in walls and platforms become `features`, a built-in staircase becomes one authored `stairs` feature whose treads are automatically generated, and built-in hazards become authored `hazards` retaining their gameplay properties. The original remains untouched. Copies can be moved, resized or deleted just like other authored objects.
- **Delete** removes the selected original from the **compiled game map**, including its collision/hazard behavior, by adding source indices to `legacyCoverDisabled` or `legacyEnvironmentDisabled` in the blueprint. Deleting a legacy staircase disables *every tread* in that flight together. IDs and original indices remain stable so deleting one object does not shift saved edits to another object.
- **Reset edits** resets the selected original's position/dimensions (or a full staircase's tread overrides); it does **not** delete the original.
- Deleted originals can be brought back individually in the Inspector's **Deleted built-in objects** section, or with **Undo**. This is more practical than permanently removing geometry from TypeScript templates.

**Copy and Delete affect local drafts first.** Use **Export JSON**, replace `src/data/map-blueprints.json`, and rebuild/restart to publish the changes to offline and online gameplay. The 3D editor is a physics-proxy preview, so copied staircases may not be an exact mesh match to the original; test clearances, stairs and bot routes after deleting structural support.

**Legacy stair flights keep their original number of steps.** The Inspector enforces a maximum safe total rise for that fixed number to avoid creating unclimbable stairs. For a taller structure or a different step count, create an **Independent stairs** feature; those are already one authored object and automatically generate the needed steps from their height and run. Check landing alignment and bot traversal after changing a flight; 90-degree rotation is supported, not arbitrary diagonal rotations. The 3D viewer uses lightweight collision/prop proxies, not an exact rendered game match.

**Export and rebuild:** 3D transformations are saved to your local editor draft; publish using **Export JSON** to replace `src/data/map-blueprints.json`. Theme edits still require their separate theme JSON export. Test the compiled map in an actual match after rebuilding. For new maps, update typed runtime registries as explained earlier.

## Map Studio object authoring (October 2026)

The feature branch `feat/map-studio-object-authoring-20261023` adds a **Geometry** tab and **Theme & props** tab. Both stay as browser-local drafts until the appropriate JSON files are exported, placed in the repository and rebuilt.

### Walkable shapes and region union

- **Rectangle**, **Circle / ellipse**, and **Triangle** tools draw regions. The inspector can switch their `shape`. The circle/ellipse uses its `w`/`d` bounding dimensions; the triangle has a north-facing tip and south-facing base. Regions can still be dragged and overlapped.
- Overlapping regions form one walkable footprint, not internal physical walls. All shapes are translated into a union of **horizontal rectangle strips** (usually 2 world units, capped at 120 strips for very large shapes) for the existing axis-aligned collision and visible floor generation. This means round and sloping boundaries have intentional small steps, *not* perfect curved/diagonal hitboxes. Playtest near those edges.
- The HUD minimap draws the union boundary, including curved regions approximated by their strips. Don't mistake individual editable region selection outlines for walls.

### Hard cover on raised platforms

A hard cover feature has two separate vertical coordinates: **`y` is the bottom elevation**, and **`h` is the wall's own height**. Previously the editor treated height as a ground-up solid, causing walls placed on floating platforms to extend down to y=0. Now select the cover, set Base elevation (Y) to the platform's top or click **Snap cover onto platform top**. Its height remains unchanged (for example a 2.3-unit barrier on a 5.2-unit catwalk occupies y=5.2–7.5). In 3D Move shifts the cover vertically without resizing it, and Resize changes its height.

### Independent stairs, hazards and existing environment previews

- **Independent stairs** are `features` with `kind: "stairs"`. `x,z` describe the top landing edge; `axis` is `x` or `z`; `sign` chooses the outward (descending) direction; `w` is width, `d` is horizontal run, and `h` is landing height. Steps automatically satisfy the engine's maximum approximately 0.42-unit rise. The selected stairs have **Snap to nearest platform**, which aligns them to the closest platform edge, matches height, selects axis/direction and derives the run. Review approach clearance and collision afterwards.
- Existing platform features continue to generate north and south flights unless you uncheck **Auto-generate north/south stairs** (`autoStairs: false`). This prevents duplicating stairs when authoring custom access.
- **Place hazard** supports `fire` (DPS), `spikes` (damage/period/active time), `jump_pad` (launch vector), `moving_platform` (destination/period) and `destructible_wall` (HP). Select an authored hazard for per-type parameters. These live under the blueprint's optional `hazards` array and convert to the existing shared `EnvironmentObject` representation used offline and by the server.
- Existing hazards and legacy stair objects from the engine's TypeScript templates are read-only previews. To move/remove those, edit the source template or migrate them deliberately; exporting the new JSON does not erase the template objects. Avoid ID conflicts and placement over spawns.

### Visual themes and props

- **Theme & props** edits theme label, biome, palette colors, ambient intensity, vegetation density, optional surface patterns, tile sizes and roughness. Choose **Place prop** and drag a footprint; select it to edit the scenery kind, position, dimensions, height, text and optional color.
- Click **Export theme** to download `<mapId>.json`, then replace or add `src/data/map-themes/<mapId>.json`. New map-specific themes require a **static import and registry entry** in `src/lib/map-visuals.ts`; they do not auto-load at runtime. Map blueprints still export separately via **Export JSON** into `src/data/map-blueprints.json`.
- **Import theme** loads an existing theme file into the currently selected map's local editor draft. Drafts auto-save under `vanguard-map-studio-themes-v1` and `vanguard-map-studio-v1`. A theme edit is not reflected live in the game's 3D renderer before export and rebuild.

### Shipping checks

```sh
bun run content:validate
bun run test:smoke
bun run typecheck
bun run build
```

Test new hazards on both offline and authoritative-server matches; test stair traversal by players and bots, circle/triangle boundaries for leaks and stuck states, and new themes in 3D and on the minimap. Automated structural tests do not replace this.

## Large-scale performance and gameplay

Ridgefall's enclosed factory and Afterlight City's connected districts have substantial, distinct playable footprints. Validate travel time, sightlines, navigation and frame time against the **current exported blueprints**, not earlier map-size estimates.

Recommended validation before merging from dev: `bun test`, `npx tsc --noEmit`, `bun run build`, followed by human/bot 3v3–7v7 playtests on all maps, especially distant spawn fairness, tunnel junctions, stair transitions, FPS and minimap readability. Manual gameplay tests are necessary; basic geometry validation is not sufficient.

## October 2026 map art update

- Afterlight City (Night) and Afterlight City (Day) share a single building/road generator in `src/lib/map-visuals.ts`; daytime palette inherits night prop definitions. Their current authored region and spawn arrays are identical; the visual themes differ.
- Both city editions exclude hazards and legacy arena cover. New scenery prop types: `building`, `boat`, `dock`, `garden`, `bench`, `bandstand`.
- Enterable buildings have physically open doorways, exterior stairs, and climbable roof geometry. City centers feature an open park and bandstand.
- Breakwater has physical docklands, cranes, vessels and container props. Verdant Ruins uses foliage and ruined masonry; Ridgefall is now an enclosed steelworks, not an outdoor snowfield.
- The renderer creates procedural worn surface textures without third-party binary assets. [LibreQuake](https://github.com/lavenderdotpet/LibreQuake) is used for visual guidance; redistribute its individual textures only after verifying the exact license and retaining appropriate credits/notice.

## Retro FPS material language

Surface material patterns, physical repeat scale and roughness are now authored alongside each map's existing palette in its individual `src/data/map-themes/<mapId>.json` file. Each theme configures `floor`, `wall`, `cover`, `stair` and `platform`. These patterns are generated once as original 128px repeating textures and map to world units, eliminating large stretched grey surfaces. See [Art direction and researched materials](art-direction-and-materials.md) for palettes, source/license shortlist, authoring recipes and performance guidelines. Map Studio also edits authored props, theme palettes and surface material settings; exported JSON remains authoritative.

## Afterlight interior and façade design

Both Afterlight lighting variants share deterministic architectural plans. City lots now vary across additional shops and public uses (including clinics, gyms, florist shops, workshops and galleries), six façade materials, building height/footprint, furnishing plans and whether the roof can be climbed. Enterable street levels have collision-backed rear-room walls with a real center doorway and type-specific furniture such as beds, counters, bookshelves and reception desks. Only buildings with `roofAccess: true` have interior/exterior rooftop stairways. The no-access buildings have a solid, sealed roof. Visible partitions and furniture use the same `cityBuildingBoxes` / `cityInteriorFixtures` geometry as game collision. Avoid cluttering the front center entrance or the east-side roof hatch aisle; inspect both lighting variants for signs, room usability and frame rate.

### Orbital Nexus reactor and gravity

The Orbital Nexus arena uses 60% normal gravity, ten jump pads and expanded cover. Cross-like antenna props and named district signage were removed. Five legitimate enemy kills anywhere on Orbital Nexus — including at either flag base and along the flank routes — charge its cyan-to-purple core. The CTF HUD shows Reactor 0–5/5 and highlights when the charge is ready. When full, its rings spin and flash. The first living combatant — human or bot — to reach the center platform at Y=3.2 claims the temporary **Nexus Reaper** melee weapon in slot 3. On a fully charged reactor, each team sends its nearest eligible bot toward the deck via its north/south stairs; flag carriers remain focused on scoring and threats within 12 units interrupt a bot's rush. Winning bots switch to close-range melee attacks. The reactor resets immediately and the weapon is forfeited on death. In offline play bot models change when the weapon is claimed or lost. Server-owned rules apply online; the transient weapon is absent from the Armory catalog.
