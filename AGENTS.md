# Vanguard Ops — instructions for coding agents

This file is for autonomous coding agents and developers using AI assistants. Treat these rules as project policy when operating in this repository.

## Before editing
- Check the current Git branch and head SHA. For content system work, use a fresh topic branch from the current `dev` head; do not push directly to `main` or `dev` unless explicitly asked.
- Read `docs/content-authoring.md` first. For map work also read `docs/map-studio.md` and `src/lib/map-blueprints.ts`.
- Inspect nearby catalog entries and the matching TypeScript definition before adding a new object.
- Identify the catalog shape first (array, keyed object, scalar settings, versioned map dictionary or standalone theme); a single draft fragment is not a replacement for the whole file.
- Do not change unrelated game balance, player progression, authentication, Prisma schema or networking to implement a data-only object.

## Authoritative ownership
- JSON data in `src/data/catalogs/*.json` is the content source of truth. `src/lib/game-data.ts` provides stable exported types and lookup/runtime functions; never reintroduce a second hardcoded declaration of an object there.
- `src/data/map-blueprints.json` is the source for walkable regions, cover/platform features and spawns. The six existing base map templates remain partly in TypeScript, so do not claim the *entire* map engine is data-driven.
- Do not add new JSON keys that imply executable behavior unless the relevant client and server code explicitly implements them.
- Keep stable IDs and all existing player unlock references. Never rename, remove or recycle a shipped ID without a separately approved migration.
- Follow the actual attachment allowlists, challenge eligibility vs purchase ownership, and Wonder/Prestige exceptions explained in the handbook.
- Treat catalog schema validity as a starting point, not proof of integration: new skin IDs, operator IDs, optic types, map IDs, challenge metrics and game modes may need TypeScript registration, server tracking or unlock contracts.
- No live server endpoint should accept untrusted JSON catalogs as shared game content.

## Mandatory checks
- Run `bun run content:validate` for any catalog/map edit.
- Run `bun run test:smoke`, `bun run typecheck` and `bun run build` before calling a change ready.
- Inspect exact catalog-size assertions in `tests/content-catalogs.test.ts` after adding entries; compare against real JSON counts before editing tests.
- Validate server/client parity for new mechanics and run gameplay tests for new map layout, weapon tuning, rendering or bot navigation. A green CI build does not prove a map feels balanced.
- Update documentation whenever a new object kind, allowed enum value, required field, runtime behavior or authoring workflow changes.
- If any check has not actually run, state that clearly instead of claiming it passed.
- Keep generated reports and test commits on a feature branch unless an authorized maintainer explicitly requests direct `dev` changes; request review before merging into `dev` or promoting to `main`.
- Use `docs/dev-test-checklist.md` as the canonical QA and promotion checklist; dated plans and superseded proposals belong under `docs/archive/`.
- Release promotion uses `scripts/prepare-main-release.sh` and `docs/release-promotion.md` to create a curated, main-based PR. Never merge raw dev history directly into a clean main release, and never remove dev-only tests from `dev`.

## JSON object recipes
- Map: author in `/map-editor`, export to `src/data/map-blueprints.json`; check open plazas, multiple flanks, spawn clearance and stairs. Theme palette and scenery are in individual `src/data/map-themes/<mapId>.json` files. Add a static theme import to `src/lib/map-visuals.ts` for new map IDs. Do not reintroduce inherited sealed perimeter walls.
- Weapon: append to `weapons.json`, check category/stats/allowlists/challenges, Gun Game and visual behavior.
- Attachment: append to `attachments.json`, update compatibility JSON, check stats and challenge eligibility.
- Weapon skin: append to `weapon-skins.json` and implement any missing skin-challenge fallback or visuals.
- Operator skin: append to `operator-skins.json`, verify its operator contract and visual palette.
- Challenge/achievement: add supported metrics in JSON; new metrics always require tracking/server/test work.

When finished, report branch, commit SHA, changed catalog paths, test results, and any manual playtests still needed.

## New gameplay and scenery invariants
- Shotgun profiles must affect both offline and authoritative server simulation.
- Assist contributors are decided by server damage events, not player-selected IDs.
- No melee headshot mastery milestones; keep stable challenge IDs.
- Afterlight day/night share city building generation but have different playable footprints. Match visible geometry to collision.
- Do not copy LibreQuake binary assets without checking licenses and credits; current textures are procedurally authored.

## Art and texture direction

Map theme JSON `surfaces` now owns floor/wall/cover/stair/platform pattern, tileSize and roughness. The material vocabulary and source/license research are in `docs/art-direction-and-materials.md`. When changing material kinds, update its docs, `src/lib/map-visuals.ts`, `src/lib/map-materials.ts`, `src/lib/content-validation.ts`, `src/data/schemas/map-theme.schema.json` and tests. Do not hotlink texture assets, use third-party game screenshots as textures or accidentally import differently licensed source packs. Keep collision independent of graphics.
