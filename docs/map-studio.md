# Map Studio — connected-district JSON maps

Open **/map-editor** while running the Next.js development server. A link is also available from the main menu on desktop.

## Authoring

Choose one of six maps or type a new unique ID and select **New** to clone the current template. The editor supports:

- Draw **walkable region** rectangles; they overlap to form an irregular, connected footprint, including L/T/S-shaped layouts and side districts.
- Draw **hard cover**, **elevated platforms** with automatically generated physical stair flights, and place team/FFA **spawns**.
- Select, drag, edit precise dimensions, duplicate, delete, zoom and undo.
- Edit name, short name, description and pace; import/export all maps together as JSON.
- Draft persistence to local browser storage, geometry and spawn validation.

The authoritative JSON file is `src/data/map-blueprints.json`. Export from Map Studio and **replace that file in the repository** to publish; restart/rebuild the game. No production API accepts arbitrary player-authored map mutations, avoiding user-content injection into shared matches.

A new map's `templateMapId` chooses one of the six core environments for its lighting, inherited buildings and environmental objects; the blueprint supplies its additional districts. After committing its JSON, the new map automatically appears in the Play map list and is resolved by both browser and Socket.IO server through the same `MAPS` registry.

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
| Ridgefall (`skybridge`) | enormous | Mountain ridges, snow-dusted rocks, conifers and antennas |
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

Supported `kind` values: `tree`, `bush`, `rock`, `ruin`, `temple`, `shop`, `lamp`, `container`, `crane`, `terminal`, `sign`, `antenna`. Many types accept optional `w`, `d`, `h`, `text`. `vegetation` ranges from 0 to 1 and scatters deterministic flora inside the walkable region while avoiding cover and spawn locations. JSON theme files are imported through `src/lib/map-visuals.ts`; **for a new map-specific theme file**, add its static import to that module. A map without its own theme can inherit the theme matching its `templateMapId`.

**Important gameplay detail:** rock/tree/building silhouettes are shared with collision where appropriate; storefronts are **exterior buildings**, not modeled enterable interiors. To create an enterable interior, author real physical geometry and door paths; do not draw fake walkable doorways. The theme is not a replacement for the gameplay blueprint.

**Route-design rules:** keep two or more viable flanks around perches, short and interrupted sightlines around open courts, obstacles sized for cover rather than 100-unit hallway walls, and accessible elevated positions with real stairs. Sniper perches should overlook contested space but should not lock every route. Retain truly compact maps for shotgun/SMG combat as well as vast outdoor maps. Before publishing, playtest spawn safety and A-to-B travel times in 1v1, 3v3 and 7v7. The map builder suppresses new features intersecting known spawns, but this is a fail-safe, not an excuse to author invalid positions.

The Map Studio editor currently edits **blueprint geometry only**. Theme JSON is edited in the repository; restart/rebuild for changes to appear in the game. The editor's preview does not fully render Three.js scenery. Run `bun run content:validate`, `bun run test:smoke`, `bun run typecheck`, `bun run build` and a manual visual match before requesting a merge.

## Large-scale performance and gameplay

`Ridgefall` and `Afterlight City` extend past 380 units across, with outer strongholds and multiple separated combat districts. Larger maps intentionally support slower first contact and stronger reconnaissance/sightline choices. Both still have the inherited core as a contested hub, but their main flanks now sit far outside it.

Recommended validation before merging from dev: `bun test`, `npx tsc --noEmit`, `bun run build`, followed by human/bot 3v3–7v7 playtests on all maps, especially distant spawn fairness, tunnel junctions, stair transitions, FPS and minimap readability. Manual gameplay tests are necessary; basic geometry validation is not sufficient.
