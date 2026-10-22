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

## Large-scale performance and gameplay

`Highwater Front` and `Afterlight City` extend past 380 units across, with outer strongholds and multiple separated combat districts. Larger maps intentionally support slower first contact and stronger reconnaissance/sightline choices. Both still have the inherited core as a contested hub, but their main flanks now sit far outside it.

Recommended validation before merging from dev: `bun test`, `npx tsc --noEmit`, `bun run build`, followed by human/bot 3v3–7v7 playtests on all maps, especially distant spawn fairness, tunnel junctions, stair transitions, FPS and minimap readability. Manual gameplay tests are necessary; basic geometry validation is not sufficient.
