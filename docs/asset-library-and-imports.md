# Asset recipes, variants and external art

An asset recipe is a reusable default object or geometry assembly. Placing it creates an independent editable instance. A shipping container has one rendering primitive, while red/blue variants set its color field and share collision dimensions. Supported dimensions, quarter-turn orientation and color remain per-instance values. Buildings also expose facade/use/roof-access parameters. This is not unrestricted mesh sculpting.

My assets saves an edited object or assembly as a new recipe. Relative geometry, internal platform links and component offsets survive export/import; placed IDs are regenerated. It is browser-local until exported. Definitions are in `src/lib/map-studio-assets.ts`. Complete maps serialize instantiated geometry/props, so the server does not depend on a personal recipe library.

## LibreQuake feasibility

LibreQuake describes its art as BSD-licensed and allows reuse/modification while retaining the applicable license. Its engine/game code is separately licensed. Review exact asset provenance and retain copyright, license and contributor notices from the selected archive before bundling art. Original proprietary Quake assets are not an interchangeable source.

Primary references checked 28 October 2026:

- https://github.com/lavenderdotpet/LibreQuake — README and art licensing statement.
- https://github.com/lavenderdotpet/LibreQuake/blob/main/CONTRIBUTING.md — provenance requirements; model sources include .blend and exported .mdl.
- https://github.com/lavenderdotpet/LibreQuake/releases — developer packages include .wad texture archives and .map sources.

Reuse is technically feasible, but these formats need a conversion pipeline. Extract approved textures to PNG/WebP or convert selected meshes to a web-oriented format, normalize scale/pivots and author game-compatible collision. Register reviewed local files in a build-time catalog with source revision, author, license, dimensions, collision proxies and allowed material overrides. Arbitrary URLs and executable game code do not belong in player-authored map JSON.

Textures are an economical first import because existing walls/platforms retain editable dimensions and shared collision. Mesh instances can expose tint, scale and material variants; reshaping a mesh or UV mapping requires source-model editing. Whole brush/BSP maps and gameplay entities require a separate importer and collision/gameplay adaptation.

No LibreQuake textures, meshes, binaries or code are bundled by this change. The editor currently imports validated Vanguard recipes. Actual third-party art selection/conversion remains a separate content task.

The texture library now supports six bundled Kenney CC0 panel textures, selectable per surface by stable textureId. These are actual bundled PNG resources, not asset recipes. Original license/provenance are included under public/textures/kenney. External URLs and unknown IDs are rejected. LibreQuake files are still not included.
