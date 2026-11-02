# Map art direction, retro surface materials and vetted references

## Viridian Blight low-glare concepts

The existing `prestige_toxic` skin keeps its **stable ID and ownership state**, but uses a quieter green palette and a lower emissive multiplier to prevent the neon sheen from distracting during ADS. Future selectable palettes (concept proposals; not automatically new purchasable skins):

| Concept | Base material | Subtle accent | Use |
| --- | --- | --- | --- |
| **Toxic Steel** | `#1c4334` | `#65a583`, emission 0.34 | Current calmer baseline |
| **Oxide Patina** | `#315c4a` | `#77967b`, emission 0.18 | Industrial oxidised metal |
| **Ghost Moss** | `#344939` | `#93a47d`, emission 0.14 | Mottled jungle camouflage |
| **Nocturnal Blight** | `#1d312e` | `#497e72`, emission 0.12 | Near-black silhouette, minimal glow |

Do not mint new prestige entitlements merely to display a concept; choose a palette through live gameplay review and then add explicitly validated variants if desired.

## Visual target

Vanguard Ops should feel like a readable, distinctive, slightly gritty **classic FPS**, not a uniform charcoal-colored greybox and not a photorealistic simulation. Influences include LibreQuake's readable silhouettes, clearly differentiated masonry/metal and limited-resolution surfaces; Kenney's retro color blocking; and modern PBR references for material logic. **No third-party texture pixels or meshes were copied in this implementation.** References are design inspiration and a documented shortlist for optional, future authored imports.

Each map owns its five surface recipes in `src/data/map-themes/<id>.json`:

```json
"surfaces": {
  "floor":    { "pattern": "moss",  "tileSize": 7,   "roughness": 0.95 },
  "wall":     { "pattern": "brick", "tileSize": 6,   "roughness": 0.90 },
  "cover":    { "pattern": "stone", "tileSize": 3.8, "roughness": 0.94 },
  "stair":    { "pattern": "stone", "tileSize": 2.8, "roughness": 0.90 },
  "platform": { "pattern": "stone", "tileSize": 5,   "roughness": 0.90 }
}
```

Available original procedural patterns: `concrete`, `metal`, `grate`, `planks`, `rust`, `moss`, `brick`, `stone`, `pavers`, `snow`, `asphalt`, `grass`. The `tileSize` parameter is **world metres per 128px tile**, not the physical size of a cover mesh. `roughness` is 0–1. Material creation is browser-only in `src/lib/map-materials.ts`; shared JSON recipes are verified by `src/lib/content-validation.ts`. Default materials are provided for future map templates without a surface entry.

`src/lib/fps-engine.ts` allocates just one set of five shared CanvasTexture materials per match and applies world-space UVs to floor tiles, walls, stairs, cover and platforms. All other physics/hitboxes are unaffected. Materials, including the city park's separate grass texture, are disposed at game teardown. The map architecture, walkable bounds, theme props and authoritative geometry are unchanged.

## Map-by-map visual hierarchy

| Map | Ground | Architecture | Props & accents |
| --- | --- | --- | --- |
| Blacksite | Warm worn concrete | Brown concrete and industrial wall panels | Rust-red alarm lights, grates and yellow-brown stair treads |
| Breakwater | Golden timber/planked dock | Ocean-blue/rust corrugated steel | Shipping containers, cranes, boats, dock bollards |
| Verdant Ruins | Green overgrown stone | Pale sandstone/lichen masonry | Mossy rock, temple debris and trees |
| Ridgefall | Worn steel and concrete | Enclosed steelworks, assembly hall and gantries | Heavy machinery, maintenance bays, industrial lighting |
| Afterlight City | Purple-blue worn asphalt | Mauve brick and painted masonry | Colourful shopfronts, lit windows, park grass and bandstand |
| Afterlight City (Day) | Sunlit pale stone pavers | Warm cream brick | Same city geometry, brighter daylight and teal trim |

Keep **player silhouettes and navigation readability** as the priority. Lighter floors and mid-tone walls must differentiate from player models. Use lighting accents to identify cover/perches but not obscure opponents. Avoid repeating oversized wall panels across whole maps; break them with accessible architecture and props, without restoring hallways.

## Researched art and texture sources (reviewed October 2026)

- **[LibreQuake](https://github.com/lavenderdotpet/LibreQuake)** — useful classic FPS art-direction reference: edge wear, trims, high-contrast readable environments. Repo documents its BSD-licensed art; if importing specific files, check their individual provenance and preserve the project's `COPYING` terms.
- **[Kenney Retro Textures Fantasy](https://kenney.nl/assets/retro-textures-fantasy)** — 115 CC0 retro-texture files, especially useful for ruin walls and stylised stone. The pack page explicitly states CC0.
- **[Kenney Retro Urban Kit](https://kenney.nl/assets/retro-urban-kit)** — 120 CC0 retro city props/structures as references for the two Afterlight scenes.
- **[Kenney Factory Kit](https://kenney.nl/assets/factory-kit)** and **[City Kit Industrial](https://kenney.nl/assets/city-kit-industrial)** — CC0 sources for dock/warehouse machinery and industrial structures.
- **[Kenney Pattern Pack](https://kenney.nl/assets/pattern-pack)** — 80 seamless CC0 pattern files; useful if replacing the hand-generated motifs with selected bundled patterns.
- **[Poly Haven Concrete Moss](https://polyhaven.com/a/concrete_moss)** — CC0 mossy concrete PBR material suitable for Verdant Ruins after deliberate style reduction. Poly Haven's asset license is CC0, but its public API has separate API terms; avoid runtime API dependencies.
- **[ambientCG](https://ambientcg.com/)** — CC0 PBR materials, especially metal, dirt, stone and asphalt. Reference rather than directly importing full-resolution materials to preserve the retro look and reasonable downloads.
- **[Quaternius](https://quaternius.com/license.html)** — optional source of stylised environmental meshes, but do **not** assume all modern packs are CC0. Its published license changed in August 2026; read the currently applicable license for each asset and do not redistribute standalone source packs.

These are **candidates**, not assets currently checked into Vanguard Ops. Do not hotlink third-party CDNs in game code.

## Safe future asset import workflow

1. Choose one biome and one surface family (e.g. 128/256px mossy stone or painted industrial metal) before downloading large packs.
2. Verify **license at the exact source item and download date**; keep URL, author, license and original terms in `docs/asset-provenance.md` if importing anything.
3. Bundle compressed, power-of-two, seamless textures in the game; downsample consciously to 128–512 px to preserve the pixel/retro direction. Bake useful normal and roughness detail only when it remains readable.
4. Expand the JSON recipe with an optional local asset path, and update schema/validator and rendering logic in one change. Restrict paths to local, allowlisted build assets; never fetch arbitrary URLs from client-side map JSON.
5. Keep floor UV scale consistent per metre; use packed atlases/shared materials and avoid multiplying one mesh/draw call per tiny decoration.
6. Profile large Ridgefall and Afterlight City on low-end GPUs, check artifacts around repeated region seams, accessibility, visibility, player contrast, and map memory before merging.

## Validation

```sh
bun run content:validate
bun run test:smoke
bun run typecheck
bun run build
```

`tests/map-surface-materials.test.ts` asserts complete surface recipes, correct biome texture patterns and world-space UV scaling. A green CI result is **not** a visual sign-off: compare live in-game scenes in daylight and night lighting, including walking up to a wall and inspecting 100-metre stretches without stretched or over-repeated motifs.
