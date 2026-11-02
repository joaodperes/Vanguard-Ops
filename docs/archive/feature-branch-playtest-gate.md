> **Archived — 25 October 2026.** This document captures the historical feature-branch gate for JSON content and map revisions. The work has since landed on `dev`; some map descriptions (notably outdoor Ridgefall) and branch status notes below are obsolete. Use [the current QA checklist](../dev-test-checklist.md), [Map Studio](../map-studio.md) and runtime sources for release decisions.

# Feature-branch playtest gate and dev-merge checklist

Branch: `feature/json-content-catalogs`. These changes have **not** been merged into `dev`. Map geometry and graphics remain game-renderer dependent; a green automated build alone is not a release sign-off.

## Map checks before promotion

- **Afterlight City (night and day)**: `MAPS.terminal` and `MAPS.arena_neon` now share the same geometry, all spawn positions, physical colliders and props. Day changes only its palette and lighting. Confirm 1v1 and full-bot lobbies use identical initial positions. Walk each street and ensure the dense 40-metre building grid has no blocked dead ends.
- **Buildings**: enter through real southern openings, climb interior stairs to the roof hatch, and alternatively use exterior stairs against the west wall. Check that neither rooftop access route ends in a wall, roof lip or tree; validate bots cannot move through window-bearing solid walls. Note that not all decorative `shop` props are enterable: `building` props are the interior-enabled subset.
- **Central park**: verify the bandstand has four pillars touching the floor, a raised roof/canopy and physical sniper-platform stairs that can be climbed.
- **Breakwater**: check the widened central drydock ramps, the outer staircase approaches, the low/vaultable `solid` boundary walls, red/blue/yellow cargo containers and removal of fire/jump pads. Spikes and the moving cargo machinery remain.
- **Verdant Ruins**: check increased foliage and hard-cover variety, active spikes, and the new destructible south gate. It should have no jump pads or fire.
- **Ridgefall**: check the snow-vs-jungle material distinction, the radio and highland outposts, bot navigation around cliff cover and FPS over large routes.

## Gameplay and interface checks

- Equip primary weapon A with a skin and four attachments, switch to B, set B up, re-equip A. Repeat across a login/device, and verify neither loadout inherits another weapon's parts.
- Check the elimination recap against an online human, online bot, and hazard. Weapon and attachment names should be displayed when the authoritative killer loadout is available; offline bots and hazards may lack attachment telemetry.
- Die in **solo** Survival both offline and online: no co-op downed/revive overlay. Die in **co-op** Survival: downed state should still appear if a teammate can rescue.
- Inspect the larger home loadout badge on mobile and desktop, and test the Red Dot/Holo 1× HUD housing, the smaller ACOG chevron, and camera movement up long stairs.
- Check Viridian Blight at ADS and hipfire; emissive intensity is now reduced. Alternate visual palettes are documented in `docs/art-direction-and-materials.md`, **not** new separately purchasable skins.

## Persistent-data schema deployment (important)

`prisma/schema.prisma` now includes **`Loadout.weaponSetups String @default("{}")`**. This is an additive player-owned JSON cache for the previously equipped skin/attachments for each weapon. The new API loads and saves this cache, validates compatibility and skin ownership on restore, and never transfers attachments from an unrelated weapon.

**Before deploying code containing this field**, back up the live database and apply the Prisma schema using the existing `bun run db:push` workflow (or a reviewed additive database migration), then regenerate the Prisma client. Do not run an unreviewed `db push` against production. Automatic CI `prisma generate` only verifies schema syntax and TypeScript; it does not migrate an actual production database.

## Automated checks

From project root:
```sh
bun run content:validate
bun run test:smoke
bun run typecheck
bun run build
```
The feature-branch GitHub Actions validation runs this pipeline and map regression tests. Real gameplay, connection stability, database migration, video-frame performance and responsiveness on mobile hardware still require manual testing.

## Merge decision

Merge to `dev` only after in-game inspection, schema deployment planning, and approval of the playable content. Do not treat any generated concept art as an in-game screenshot or automatically imported asset.
